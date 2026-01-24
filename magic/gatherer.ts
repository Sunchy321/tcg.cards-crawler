import { CheerioCrawler, Dataset, log, CheerioAPI } from 'crawlee';
import { db, Gatherer } from './db';
import type { GathererData } from './schema';
import { and, gte, lte } from 'drizzle-orm';

// 缓存过期天数
const CACHE_EXPIRATION_DAYS = 30;

interface CrawlerOptions {
    maxId:            number;
    startId?:         number;
    ignoreUnexpired?: boolean;
    concurrency?:     number;
}

export class GathererCrawler {
    private options: Required<CrawlerOptions>;
    private lastLogWasNoData = false;

    constructor(options: CrawlerOptions) {
        this.options = {
            maxId:           options.maxId,
            startId:         options.startId ?? 1,
            ignoreUnexpired: options.ignoreUnexpired ?? false,
            concurrency:     options.concurrency ?? 5,
        };
    }

    async run() {
        const { startId, maxId, ignoreUnexpired, concurrency } = this.options;

        log.info(`Starting Gatherer crawler from ${startId} to ${maxId}`);
        log.info(`Ignore unexpired: ${ignoreUnexpired}, Concurrency: ${concurrency}`);

        // 创建请求列表
        const requests = [];

        if (!ignoreUnexpired) {
            // 如果不忽略未过期数据，先查询数据库过滤
            log.info('Querying database to filter unexpired data...');

            // 一次性查询范围内所有未过期的数据
            const now = new Date();
            const unexpiredRecords = await db
                .select({ multiverseId: Gatherer.multiverseId })
                .from(Gatherer)
                .where(
                    and(
                        gte(Gatherer.multiverseId, startId),
                        lte(Gatherer.multiverseId, maxId),
                        gte(Gatherer.expiresAt, now),
                    ),
                );

            // 创建一个 Set 用于快速查找未过期的 ID
            const unexpiredIds = new Set(unexpiredRecords.map(r => r.multiverseId));

            // 只添加不在未过期列表中的请求
            for (let id = startId; id <= maxId; id++) {
                if (!unexpiredIds.has(id)) {
                    requests.push({
                        url:      `https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=${id}&printed=true`,
                        userData: { multiverseId: id },
                    });
                }
            }

            log.info(`Filtered: ${maxId - startId + 1} total, ${requests.length} to crawl, ${unexpiredIds.size} skipped (unexpired)`);
        } else {
            // 忽略未过期数据，添加所有请求
            for (let id = startId; id <= maxId; id++) {
                requests.push({
                    url:      `https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=${id}&printed=true`,
                    userData: { multiverseId: id },
                });
            }
        }

        if (requests.length === 0) {
            log.info('No requests to process. All data is up to date.');
            return;
        }

        const crawler = new CheerioCrawler({
            maxConcurrency:            concurrency,
            maxRequestRetries:         3,
            requestHandlerTimeoutSecs: 60,
            navigationTimeoutSecs:     30,
            preNavigationHooks:        [
                (_, gotOptions) => {
                    gotOptions.http2 = false; // 👈 force HTTP/1.1
                },
            ],
            requestHandler: async ({ request, $, log }) => {
                const multiverseId = request.userData.multiverseId as number;

                try {
                    // 解析页面
                    const cardData = await this.parseGathererPage($, multiverseId);

                    // 保存到数据库（无论是否解析成功）
                    await this.saveToDatabase(multiverseId, cardData);

                    if (cardData) {
                        log.info(`Successfully crawled ${multiverseId}: ${cardData.instanceName}`);

                        // 保存到数据集
                        await Dataset.pushData({
                            multiverseId,
                            name: cardData.instanceName,
                            set:  cardData.setName,
                        });
                    } else {
                        log.warning(`No card data found for ${multiverseId}, saved as null`);
                    }
                } catch (error) {
                    log.error(`Error crawling ${multiverseId}:`, error);
                    // 解析失败时也保存 null
                    await this.saveToDatabase(multiverseId, null);
                    // 不再抛出错误，继续处理下一个
                }
            },
            failedRequestHandler: async ({ request, log }) => {
                const multiverseId = request.userData.multiverseId;
                log.error(`Request failed for ${multiverseId}: ${request.url}`);
            },
        });

        await crawler.run(requests);

        log.info('Crawler finished');
    }

    private async parseGathererPage($: CheerioAPI, multiverseId: number): Promise<GathererData | null> {
        // 查找包含卡片数据的 script 标签
        const script = $('script').filter((_, el) => {
            const innerHtml = $(el).html() ?? '';
            return innerHtml.includes('__next_f') && innerHtml.includes('instanceName');
        }).get(0);

        if (!script) {
            return null;
        }

        // 提取 hydration 数据
        const scriptContent = $(script).html();
        if (!scriptContent) {
            return null;
        }

        const hydration = scriptContent
            .replace(/^self.__next_f\.push\(\[\d+,"\d+:/, '"')
            .replace(/\]\)$/, '');

        try {
            const hydrationText = JSON.parse(hydration);
            const hydrationData = JSON.parse(hydrationText);

            // 递归查找卡片数据
            const cardData = this.recursiveFindCard(hydrationData);

            if (!cardData) {
                log.warning(`Card data not found in hydration for ${multiverseId}`);
                return null;
            }

            return cardData;
        } catch (error) {
            log.error(`Failed to parse hydration data for ${multiverseId}:`, error);
            return null;
        }
    }

    private recursiveFindCard(obj: any): GathererData | null {
        if (obj == null) {
            return null;
        }

        if (obj.card != null) {
            return obj.card as GathererData;
        }

        if (Array.isArray(obj)) {
            if (Array.isArray(obj[0])) {
                return this.recursiveFindCard(obj[0][3]);
            } else if (Array.isArray(obj[1])) {
                return this.recursiveFindCard(obj[1][3]);
            } else {
                return this.recursiveFindCard(obj[3]);
            }
        }

        if (obj.children != null) {
            return this.recursiveFindCard(obj.children);
        }

        return null;
    }

    private async saveToDatabase(multiverseId: number, data: GathererData | null): Promise<void> {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + CACHE_EXPIRATION_DAYS);

        await db
            .insert(Gatherer)
            .values({
                multiverseId,
                data,
                expiresAt,
            })
            .onConflictDoUpdate({
                target: [Gatherer.multiverseId],
                set:    {
                    data,
                    createdAt: new Date(),
                    expiresAt,
                },
            });
    }
}
