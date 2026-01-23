import winston from 'winston';
import path from 'path';

const logDir = path.join(__dirname, '../../log/magic');

export const logger = winston.createLogger({
    level:  process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logDir, 'gatherer-error.log'),
            level:    'error',
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'gatherer.log'),
        }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
        ),
    }));
}
