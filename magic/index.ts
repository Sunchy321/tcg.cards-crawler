#!/usr/bin/env bun

import { parseArgs } from 'node:util';
import { GathererCrawler } from './gatherer';

interface CliOptions {
    maxId:            number;
    startId?:         number;
    ignoreUnexpired?: boolean;
    concurrency?:     number;
}

function showHelp() {
    console.log(`
Gatherer Crawler - Crawl Magic: The Gathering cards from Gatherer

Usage:
  bun index.ts <maxId> [options]

Arguments:
  maxId                 Maximum multiverse ID to crawl to

Options:
  --start <id>            Starting multiverse ID (default: 1)
  --ignore-unexpired      Ignore (force refresh) cards with unexpired cache data (default: false)
  --concurrency <num>     Number of concurrent requests (default: 5)
  -h, --help              Show this help message

Examples:
  # Crawl from 1 to 1000, skip unexpired cache
  bun index.ts 1000

  # Crawl from 500 to 1000, force refresh all
  bun index.ts 1000 --start 500 --ignore-unexpired

  # Crawl with higher concurrency
  bun index.ts 1000 --concurrency 10

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
        },
    });

    if (values.help || positionals.length === 0) {
        showHelp();
        process.exit(0);
    }

    const maxId = parseInt(positionals[0], 10);
    if (isNaN(maxId) || maxId < 1) {
        console.error('Error: maxId must be a positive number');
        process.exit(1);
    }

    const options: CliOptions = {
        maxId,
        ignoreUnexpired: values['ignore-unexpired'] ?? false,
    };

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
    console.log(`Range: ${options.startId ?? 1} to ${options.maxId}`);
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
