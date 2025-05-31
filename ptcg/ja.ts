import WebCrawler from '../crawler';

import fs from 'fs';
import path from 'path';

import { Cheerio, CheerioAPI } from 'cheerio';
import { Element } from 'domhandler';

import { Card, MainType, SubType } from '@interface/ptcg/card';
import { Print } from '@interface/ptcg/print';

import { last } from 'lodash';

import { logger } from './logger';

type Entry = Omit<Card & Print, 'cardId' | 'localization' | 'legalities'> & {
    setImageUrl?:    string;
    rarityImageUrl?: string;
    setTotal?:       string;
};

const baseUrl = `https://www.pokemon-card.com/card-search/resultAPI.php?keyword=&se_ta=&regulation_sidebar_form=all&pg=&illust=&sm_and_keyword=true`;

interface PokemonCardResponse {
    result:          number;
    errMsg:          string;
    thisPage:        number;
    maxPage:         number;
    hitCnt:          number;
    cardStart:       number;
    cardEnd:         number;
    searchCondition: string[];
    regulation:      string;
    cardList:        PokemonCard[];
}

interface PokemonCard {
    cardID:           string;
    cardThumbFile:    string;
    cardNameAltText:  string;
    cardNameViewText: string;
}

const teraText = 'このポケモンは、ベンチにいるかぎり、ワザのダメージを受けない。';

const iconMap: Record<string, string> = {
    grass:    'G',
    fire:     'R',
    water:    'W',
    electric: 'L',
    psychic:  'P',
    fighting: 'F',
    dark:     'D',
    metal:    'M',
    fairy:    'Y',
    dragon:   'N',
    none:     'C',
};

const pokemonList = [
    '特性',
    'ワザ',
    '進化',
    '古代能力',
    'GXワザ',
    'ポケパワー',
    'ポケボディー',
    'どうぐ',
    'きのみ',
];

const nonPokemonMap: Record<string, [MainType, SubType | undefined]> = {
    基本エネルギー:  ['energy', 'basic'],
    特殊エネルギー:  ['energy', 'special'],
    サポート:     ['trainer', 'supporter'],
    グッズ:      ['trainer', 'item'],
    ポケモンのどうぐ: ['trainer', 'item'],
    スタジアム:    ['trainer', 'stadium'],
    ワザマシン:    ['trainer', 'technical_machine'],
};

const tagList = [
    'ACE SPEC',
    'ex',
    'Tera',
    'かがやく',
    'Radiant',
    'VMAX',
    'VSTAR',
    'V-UNION',
    'V',
    'TAG TEAM',
    'プリズムスター',
    'Prism Star',
    'GX',
    'EX',
    'M進化',
    'Mega',
    'ゲンシ',
    'Primal',
    'BREAK',
    'LEGEND',
    'レベルアップ',
    'LV.X',
    '☆', // star
    'Star',
    '賞', // event card
    '公式大会では使えない', // Banned card
    '何枚でも', // Arceus LV.100
    'レギュレーション', // Mew: regulation statement
    'ポケモンのどうぐは', // Pokemon Tool rule
    'サポートは', // Supporter rule
    'スタジアムは', // Stadium rule
    'Baby',
    'Shining',
    '稜柱之星', // Prism Star
    '光輝', // Radiant
];

class PtcgJACrawler extends WebCrawler {
    async run() {
        const first = await this.json<PokemonCardResponse>(baseUrl);

        await this.runPage(first);

        for (let i = 2; i <= first.maxPage; ++i) {
            const url = `${baseUrl}&page=${i}`;

            const page = await this.json<PokemonCardResponse>(url);

            await this.runPage(page);
        }
    }

    async runPage(page: PokemonCardResponse) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        console.log(`${page.thisPage}/${page.maxPage}, total: ${page.cardList.length}/${page.hitCnt}`);

        for (const [i, c] of page.cardList.entries()) {
            await this.runCard(Number.parseInt(c.cardID, 10));

            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(`${i + 1}/${page.cardList.length} cards`);
        }
    }

    completeUrl(url: string) {
        return 'https://www.pokemon-card.com' + url;
    }

    getEnergy(elem: Cheerio<Element>): string {
        console.assert(elem.hasClass('icon'));

        const klass = elem.attr('class');

        const iconName = klass!.match(/(?<=icon-)(\w+)/)![1];

        return iconMap[iconName];
    }

    getAttack(elem: Element, $: CheerioAPI) {
        const children = $(elem).contents().get();

        let cost = '';
        let name: string | undefined;
        let damage: string | undefined;

        for (const c of children) {
            if (c.type === 'text') {
                name = $(c).text().trim();
            } else if (c.type === 'tag' && c.name === 'span') {
                if ($(c).hasClass('icon')) {
                    cost += this.getEnergy($(c));
                } else if ($(c).hasClass('f_right')) {
                    damage = $(c).text().trim();
                } else {
                    throw new Error(`Unknown span in attack`);
                }
            } else {
                throw new Error(`Unknown child type ${c.type} in attack`);
            }
        }

        return { cost, name: name ?? '', damage };
    }

    getText(elem: Cheerio<Element>, $: CheerioAPI) {
        return elem.contents().get().map(e => {
            if (e.type === 'text') {
                return $(e).text();
            } else if (e.type === 'tag') {
                if (e.name === 'span') {
                    if ($(e).hasClass('pcg-prismstar')) {
                        return '{PRISM}';
                    }

                    if ($(e).hasClass('pcg-megamark')) {
                        return '{MEGA}';
                    }

                    if ($(e).hasClass('icon')) {
                        return `{${this.getEnergy($(e))}}`;
                    }

                    return $(e).text();
                }
            } else {
                logger.error(`Unknown element type: ${e.type}`);
            }
        }).join('').trim();
    }

    findEvolveFrom(elems: Element[], $: CheerioAPI): string | undefined {
        const lines = $(elems).filter('div.evolution').get();

        for (const [i, l] of lines.entries()) {
            if ($(l).hasClass('ev_on') || $(l).find('.ev_on').length > 0) {
                for (const n of lines.slice(i + 1)) {
                    const tags = $(n).find('a');

                    if (tags.length == 1) {
                        const arrow = $(tags[0]).siblings('div.arrow_off');

                        if (arrow.length > 0) {
                            return $(tags[0]).text().trim();
                        }
                    }
                }
            }
        }
    }

    async runCard(id: number) {
        const url = `https://www.pokemon-card.com/card-search/details.php/card/${id}`;

        const jsonPath = `./data/ptcg/ja/${id}.json`;

        const dir = path.dirname(jsonPath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(jsonPath)) {
            return;
        }

        const $ = await this.html(url);

        //  名称
        const name = this.getText($('.Heading1'), $);

        // 图片链接
        const imageSrc = $('.fit').attr('src');

        const imageUrl = imageSrc != null ? this.completeUrl(imageSrc) : '';

        // 类别栏
        const h2 = $('h2').first();

        const typeline = h2.text().trim();

        const [main, sub] = (() => {
            if (pokemonList.includes(typeline)) {
                return ['pokemon', undefined] as [MainType, undefined];
            }

            if (nonPokemonMap[typeline] != null) {
                return nonPokemonMap[typeline];
            }

            throw new Error(`Unknown typeline "${typeline}" for card ${id} (${name})`);
        })();

        // 系列
        let set = '';
        let number = '';
        let setImageUrl = undefined;
        let setTotal = undefined;

        const setIcon = $('img.img-regulation');

        if (setIcon.length > 0) {
            set = setIcon.attr('alt')!.trim();
            setImageUrl = setIcon.attr('src');
        }

        // 收集编号
        const subtext = $('div.subtext').text();

        if (subtext !== '') {
            const m = /(\d+|\w+)\s*\/\s*(\w+-?\w+|\d+)/.exec(subtext);

            if (m != null) {
                number = m[1];
                setTotal = m[2];
            } else {
                number = subtext;
                setTotal = '';
            }
        }

        // 稀有度
        let rarity = '';
        let rarityImageUrl = undefined;

        const rarityImg = $('img[width=24]');

        if (rarityImg.length > 0) {
            const src = rarityImg.attr('src')!;

            rarity = src.split('.')[0].split('ic_')[1];
            rarityImageUrl = this.completeUrl(src);
        }

        // 画师
        const artist = $('.author a')
            .map((i, el) => $(el).text().trim())
            .get();

        // 宝可梦信息
        let pokedex: Card['pokedex'] = undefined;
        let flavorText = undefined;

        const pokedexDiv = $('div.card');

        if (pokedexDiv.length > 0) {
            const h4 = pokedexDiv.find('h4').first();

            if (h4.length > 0) {
                const dexline = h4.text().trim().split('\u3000');

                if (dexline.length === 2) {
                    pokedex ??= { };

                    pokedex.number = Number.parseInt(dexline[0].split('.')[1], 10);
                    pokedex.category = dexline[1];
                } else {
                    throw new Error(`Unknown dexline "${h4.text()}" for card ${id} (${name})`);
                }
            }

            const p = pokedexDiv.find('p');

            if (p.length === 2) {
                const [height, weight] = $(p[0]).text().split(/\u3000+/);

                pokedex ??= { };

                pokedex.height = height.split('：')[1];
                pokedex.weight = weight.split('：')[1];

                flavorText = $(p[1]).text();
            } else if (p.length === 1) {
                const text = p.text();

                if (text.includes('重さ')) {
                    const [height, weight] = $(p[0]).text().split('\u3000');

                    pokedex ??= { };

                    pokedex.height = height.split('：')[1];
                    pokedex.weight = weight.split('：')[1];
                } else {
                    flavorText = p.text();
                }
            } else {
                throw new Error(`Unknown pokedex p length ${p.length} for card ${id} (${name})`);
            }
        }

        // 阶段
        let stage = undefined;

        const stageSpan = $('span.type');

        if (stageSpan.length > 0) {
            stage = stageSpan.text().trim().replace(/\xa0/, ' ');
        }

        // 血量
        let hp = undefined;

        const hpSpan = $('span.hp-num');

        if (hpSpan.length > 0) {
            hp = Number.parseInt(hpSpan.text().trim(), 10);
        }

        // 等级
        let level = undefined;

        const levelSpan = $('span.level-num');

        if (levelSpan.length > 0) {
            level = Number.parseInt(levelSpan.text().trim(), 10);
        }

        // 属性
        let types = undefined;

        const typeSpan = $('div.td-r').children('span.icon');

        if (typeSpan.length > 0) {
            types = typeSpan.get().map(e => this.getEnergy($(e))).join('');
        }

        // 文本
        let text = '';
        let abilities: Card['abilities'];
        let attacks: Card['attacks'];
        let vstarPower: Card['vstarPower'];
        let rule: Card['rule'];
        let evolveFrom: Card['evolveFrom'];
        let tags: string[] = [];

        if (main !== 'pokemon') {
            const elems = h2.siblings('p').get();

            for (const e of elems) {
                const para = this.getText($(e), $);

                if (para.startsWith(typeline + 'は') || para.startsWith('グッズは')) {
                    continue;
                }

                text += '\n' + this.getText($(e), $);
            }

            text = text.trim();
        } else {
            const elems = $('.RightBox-inner .TopInfo~*').get();

            const groups: {
                title:    Element | undefined;
                contents: Element[];
            }[] = [];

            for (const e of elems) {
                if (e.tagName == 'h2') {
                    groups.push({
                        title:    e,
                        contents: [],
                    });
                } else {
                    if (groups.length === 0) {
                        groups.push({
                            title:    undefined,
                            contents: [e],
                        });
                    } else {
                        last(groups)!.contents.push(e);
                    }
                }
            }

            for (const g of groups) {
                if (g.title === undefined) {
                    if (g.contents.some(v => $(v).text() === teraText)) {
                        tags.push('tera');
                    }

                    text += g.contents.map(e => $(e).text()).join('\n');

                    continue;
                }

                const titleText = $(g.title).text().trim();

                const name = $(g.contents.find(e => e.tagName === 'h4')).text().trim();

                const effect = g.contents
                    .filter(e => e.tagName === 'p')
                    .map(e => this.getText($(e), $))
                    .join('\n')
                    .trim();

                if (titleText === '特性') {
                    abilities ??= [];
                    abilities.push({ name, effect });

                    text += `\n\n[特性]${name}\n${effect}`;
                } else if (titleText === '古代能力') {
                    text += `\n\n[古代能力]${name}\n${effect}`;

                    tags.push('ancient_trait');
                } else if (titleText === 'ポケパワー') {
                    text += `\n\n[ポケパワー]${name}\n${effect}`;

                    tags.push('poke_power');
                } else if (titleText === 'ポケボディー') {
                    text += `\n\n[ポケボディー]${name}\n${effect}`;

                    tags.push('poke_body');
                } else if (titleText === 'どうぐ') {
                    text += `\n\n[どうぐ]${name}\n${effect}`;

                    tags.push('held_item');
                } else if (titleText === 'きのみ') {
                    text += `\n\n[きのみ]${name}\n${effect}`;

                    tags.push('held_berry');
                } else if (titleText === 'ワザ' || titleText === 'GXワザ') {
                    attacks ??= [];

                    for (const e of g.contents) {
                        if (e.tagName === 'h4') {
                            const { cost, name, damage } = this.getAttack(e, $);

                            attacks.push({
                                cost,
                                name,
                                damage,
                                effect: '',
                            });
                        } else if (e.tagName === 'p') {
                            last(attacks)!.effect += '\n' + this.getText($(e), $);
                        }
                    }

                    for (const a of attacks) {
                        a.effect = a.effect.trim();

                        text += `\n\n[ワザ]${a.name}\n${a.cost}${a.damage ? ' ' + a.damage : ''}\n${a.effect}`;
                    }
                } else if (titleText === 'VSTARパワー') {
                    const [type, nameElem] = g.contents.filter(e => e.tagName === 'h4');

                    const typeText = $(type).text().trim();

                    const effect = g.contents
                        .filter(e => e.tagName === 'p')
                        .map(e => this.getText($(e), $))
                        .join('\n');

                    if (typeText === '特性') {
                        vstarPower = {
                            type: 'ability',
                            name: $(nameElem).text().trim(),
                            effect,
                        };

                        text += `\n\n[VSTAR特性]${vstarPower.name}\n${effect}`;
                    } else if (typeText === 'ワザ') {
                        const { cost, name, damage } = this.getAttack(nameElem, $);

                        vstarPower = {
                            type: 'attack',
                            cost,
                            name,
                            damage,
                            effect,
                        };

                        text += `\n\n[VSTARワザ]${vstarPower.name}\n${vstarPower.cost}${vstarPower.damage ? ' ' + vstarPower.damage : ''}\n${effect}`;
                    } else {
                        throw new Error(`Unknown VSTAR type "${typeText}" for card ${id} (${name})`);
                    }

                    tags.push('vstar_power');
                } else if (titleText === '特別なルール') {
                    for (const e of g.contents) {
                        if (e.tagName !== 'p') {
                            continue;
                        }

                        const text = this.getText($(e), $);

                        if (text === '') {
                            continue;
                        }

                        rule = text;

                        let tagKnown = false;

                        for (const tag in tagList) {
                            if (text.includes(tag)) {
                                tags.push(tag);
                                tagKnown = true;
                            }
                        }

                        if (!tagKnown) {
                            throw new Error(`Unknown tag "${text}" for card ${id} (${name})`);
                        }

                        if (tags.includes('LV.X')) {
                            tags = tags.filter(v => v !== 'V');
                        }

                        if (tags.includes('Prism Star')) {
                            tags = tags.filter(v => v !== 'Star');
                        }

                        if (tags.includes('獎賞卡')) {
                            tags = tags.filter(v => v !== '賞');
                        }
                    }
                } else if (Object.keys(nonPokemonMap).includes(titleText)) {
                    continue;
                } else if (titleText === '進化') {
                    if (stage !== 'たね') {
                        const result = this.findEvolveFrom(g.contents, $);

                        if (result == null) {
                            throw new Error(`Unknown evolve from for card ${id} (${name})`);
                        }

                        evolveFrom = result;
                    }
                }
            }

            text = text.trim();
        }

        // 弱点/抵抗力/撤退
        let weakness: Card['weakness'];
        let resistance: Card['resistance'];
        let retreat: Card['retreat'];

        const td = $('.RightBox-inner .TopInfo~* td').get();

        if (td.length > 0 && $(td[0]).find('span').length > 0) {
            const type = $(td[0])
                .children('span.icon')
                .get()
                .map(e => this.getEnergy($(e)))
                .join();

            const value = $(td[0]).text().trim();

            weakness = { type, value };
        }

        if (td.length > 1 && $(td[1]).find('span').length > 0) {
            const type = $(td[1])
                .children('span.icon')
                .get()
                .map(e => this.getEnergy($(e)))
                .join();

            const value = $(td[1]).text().trim();

            resistance = { type, value };
        }

        if (td.length > 2) {
            retreat = $(td[2]).find('span').length;
        }

        const result: Entry = {
            lang: 'ja',
            set,
            number,

            name,
            text,
            evolveFrom,

            type: { main, sub },

            hp,
            stage,
            types,
            level,

            abilities,
            attacks,
            vstarPower,
            rule,

            weakness,
            resistance,
            retreat,

            category: 'normal',
            tags,

            layout: 'normal',
            rarity,

            pokedex,
            flavorText,

            artist,
            releaseDate: '',

            imageUrl,
            setImageUrl,
            rarityImageUrl,

            jpId: id,

            setTotal,
        };

        fs.writeFileSync(jsonPath, JSON.stringify(result, null, 4));
    }
}

const crawler = new PtcgJACrawler();

if (process.argv[2] != null) {
    crawler.runCard(Number.parseInt(process.argv[2], 10)).catch(e => {
        logger.error(e.message);
    });
} else {
    crawler.run().catch(e => {
        logger.error(e.message);
    });
}
