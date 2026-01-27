#!/usr/bin/env bun

import { parseArgs } from 'node:util';
import { GathererCrawler } from './gatherer';

interface CliOptions {
    maxId?:           number;
    startId?:         number;
    ignoreUnexpired?: boolean;
    concurrency?:     number;
    fullScan?:        boolean;
}

function showHelp() {
    console.log(`
Gatherer Crawler - Crawl Magic: The Gathering cards from Gatherer

Usage:
  bun index.ts [maxId] [options]

Arguments:
  maxId                   Maximum multiverse ID to crawl to (optional, filters IDs)

Options:
  --start <id>            Starting multiverse ID (default: 1)
  --ignore-unexpired      Ignore (force refresh) cards with unexpired cache data (default: false)
  --concurrency <num>     Number of concurrent requests (default: 5)
  --full-scan             Scan all IDs in range instead of only Print table IDs (default: false)
  -h, --help              Show this help message

Examples:
  # Crawl only IDs from Print table
  bun index.ts

  # Crawl Print table IDs up to 50000
  bun index.ts 50000

  # Full scan from 1 to 1000
  bun index.ts 1000 --full-scan

  # Full scan from 500 to 1000, force refresh all
  bun index.ts 1000 --start 500 --full-scan --ignore-unexpired

  # Crawl with higher concurrency
  bun index.ts --concurrency 10

Environment Variables:
  DATABASE_URL          PostgreSQL connection string (default: postgresql://localhost:5432)
    `);
}

function parseCliArgs(): CliOptions {
    const { values, positionals } = parseArgs({
        args:             process.argv.slice(2),
        allowPositionals: true,
        options:          {
            'help': {
                type:  'boolean',
                short: 'h',
            },
            'start': {
                type:  'string',
                short: 's',
            },
            'ignore-unexpired': {
                type:    'boolean',
                default: false,
                short:   'i',
            },
            'concurrency': {
                type: 'string',
            },
            'full-scan': {
                type:    'boolean',
                default: false,
                short:   'f',
            },
        },
    });

    if (values.help) {
        showHelp();
        process.exit(0);
    }

    const fullScan = values['full-scan'] ?? false;

    const options: CliOptions = {
        ignoreUnexpired: values['ignore-unexpired'] ?? false,
        fullScan,
    };

    // 解析 maxId（如果提供）
    if (positionals.length > 0) {
        const maxId = parseInt(positionals[0], 10);
        if (isNaN(maxId) || maxId < 1) {
            console.error('Error: maxId must be a positive number');
            process.exit(1);
        }
        options.maxId = maxId;
    } else if (fullScan) {
        // full-scan 模式必须有 maxId
        console.error('Error: maxId is required when using --full-scan');
        process.exit(1);
    }

    if (values.start !== undefined) {
        const startId = parseInt(values.start, 10);
        if (isNaN(startId) || startId < 1) {
            console.error('Error: start ID must be a positive number');
            process.exit(1);
        }
        options.startId = startId;
    }

    if (values.concurrency !== undefined) {
        const concurrency = parseInt(values.concurrency, 10);
        if (isNaN(concurrency) || concurrency < 1) {
            console.error('Error: concurrency must be a positive number');
            process.exit(1);
        }
        options.concurrency = concurrency;
    }

    return options;
}

async function main() {
    const options = parseCliArgs();

    console.log('Starting Gatherer Crawler...');
    if (options.fullScan) {
        console.log(`Mode: Full scan`);
        console.log(`Range: ${options.startId ?? 1} to ${options.maxId}`);
    } else {
        console.log(`Mode: Print table IDs only`);
        if (options.maxId || options.startId) {
            const start = options.startId ?? 1;
            const end = options.maxId ?? '∞';
            console.log(`Filter range: ${start} to ${end}`);
        }
    }
    console.log(`Ignore unexpired: ${options.ignoreUnexpired}`);
    console.log(`Concurrency: ${options.concurrency ?? 5}`);
    console.log('');

    try {
        const crawler = new GathererCrawler(options);
        await crawler.run();
        console.log('\n✓ Crawling completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n✗ Crawling failed:', error);
        process.exit(1);
    }
}

main();
