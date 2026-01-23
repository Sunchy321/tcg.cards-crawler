import { drizzle } from 'drizzle-orm/node-postgres';

import { Gatherer } from './schema';

// 从环境变量获取数据库连接信息
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5430';

export const db = drizzle(connectionString, { casing: 'snake_case' });

export { Gatherer };
