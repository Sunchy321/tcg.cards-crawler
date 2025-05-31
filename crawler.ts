import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

class WebCrawler {
    private userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';

    async fetch(url: string): Promise<string> {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': this.userAgent,
            },
            timeout: 10000,
        });

        return response.data;
    }

    async html(url: string): Promise<cheerio.CheerioAPI> {
        return cheerio.load(await this.fetch(url));
    }

    async json<T = any>(url: string): Promise<T> {
        return await this.fetch(url) as T;
    }

    /**
   * 保存爬取的数据到JSON文件
   * @param data 爬取的数据
   * @param filePath 保存路径
   */
    save(data: any[], filePath: string): void {
        try {
            const dirName = path.dirname(filePath);
            if (!fs.existsSync(dirName)) {
                fs.mkdirSync(dirName, { recursive: true });
            }

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`数据已保存到 ${filePath}`);
        } catch (error) {
            console.error(`保存数据时出错: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

export default WebCrawler;
