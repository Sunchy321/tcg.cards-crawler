import { createLogger, format, transports } from 'winston';

import { TransformableInfo } from 'logform';

function formatter(info: TransformableInfo): string {
    const level = info.level[0];
    const tag = info.category != null ? `${level}/${info.category}` : level;

    return `${info.timestamp} ${tag.padEnd(10, ' ').toUpperCase()} ${
        info.message
    }`;
}
export const logger = createLogger({
    level:      'info',
    format:     format.combine(format.timestamp(), format.printf(formatter)),
    transports: [
        new transports.Console(),
        new transports.File({
            filename: `./default.log`,
        }),
    ],
});
