# Gatherer 爬虫项目总结

## 项目结构

```
crawler/magic/
├── .env.example          # 环境变量示例文件
├── .gitignore           # Git 忽略文件
├── README.md            # 项目文档
├── db.ts                # 数据库连接配置
├── gatherer.ts          # 核心爬虫逻辑
├── index.ts             # 命令行入口
├── logger.ts            # 日志工具
├── run-examples.sh      # 使用示例脚本
└── schema.ts            # 数据库 Schema 定义
```

## 功能特性

✅ **基于 Crawlee 框架**
- 使用业界标准的爬虫框架
- 内置请求队列管理
- 自动重试失败的请求
- 并发控制

✅ **智能缓存机制**
- 数据默认缓存 30 天
- 可选跳过未过期数据
- 自动更新过期数据

✅ **灵活的配置**
- 支持指定起始和结束 ID
- 可配置并发数
- 环境变量支持

✅ **完善的日志系统**
- 分级日志（info, warn, error）
- 错误单独记录
- 控制台和文件双输出

✅ **数据持久化**
- 使用 PostgreSQL 存储
- Drizzle ORM 管理数据
- 支持数据去重和更新

## 核心文件说明

### 1. gatherer.ts
核心爬虫类 `GathererCrawler`：
- `run()`: 启动爬虫
- `parseGathererPage()`: 解析 Gatherer 页面
- `recursiveFindCard()`: 递归查找卡片数据
- `saveToDatabase()`: 保存数据到数据库

### 2. index.ts
命令行界面：
- 参数解析
- 使用说明
- 错误处理

### 3. db.ts
数据库连接：
- PostgreSQL 连接配置
- Drizzle ORM 初始化

### 4. schema.ts
数据库 Schema：
- `Gatherer` 表定义
- `GathererData` 接口

### 5. logger.ts
日志工具：
- Winston 日志配置
- 文件和控制台输出

## 使用方法

### 1. 安装依赖

```bash
cd /Users/sunchy321/Desktop/WebServer/crawler
bun install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并配置数据库连接：

```bash
cp magic/.env.example magic/.env
```

编辑 `.env` 文件：
```
DATABASE_URL=postgresql://username:password@localhost:5432/tcg_cards
```

### 3. 运行爬虫

```bash
cd magic
bun index.ts <maxId> [options]
```

示例：
```bash
# 爬取 ID 1-1000
bun index.ts 1000

# 从 500 开始爬取到 1000
bun index.ts 1000 --start 500

# 强制刷新所有数据
bun index.ts 1000 --no-skip-unexpired

# 使用 10 个并发
bun index.ts 1000 --concurrency 10
```

## 数据库结构

表名: `magic.data_gatherer`

| 字段 | 类型 | 说明 |
|------|------|------|
| multiverse_id | integer | Multiverse ID（主键） |
| data | jsonb | 卡片完整数据 |
| created_at | timestamp | 创建时间 |
| expires_at | timestamp | 过期时间 |

## 技术栈

- **Crawlee**: 网页爬虫框架
- **Cheerio**: HTML 解析
- **Drizzle ORM**: 数据库 ORM
- **PostgreSQL**: 数据库
- **Winston**: 日志管理
- **TypeScript**: 编程语言

## 注意事项

1. ⚠️ 请合理设置并发数，避免对 Gatherer 网站造成压力
2. ⚠️ 首次运行建议使用较小的 ID 范围测试
3. ⚠️ 定期检查日志文件了解运行状态
4. ⚠️ 确保数据库连接正常

## 日志位置

- 所有日志: `/log/magic/gatherer.log`
- 错误日志: `/log/magic/gatherer-error.log`

## 依赖包

已添加到 `crawler/package.json`：
- `drizzle-orm`: ^0.30.0
- `postgres`: ^3.4.0

其他依赖已存在：
- `crawlee`: ^3.15.3
- `cheerio`: ^1.0.0
- `winston`: ^3.17.0

## 下一步

1. 安装依赖: `bun install`
2. 配置环境变量
3. 运行测试爬取: `ts-node index.ts 10`
4. 检查日志和数据库
5. 根据需要调整参数

## 故障排除

### 数据库连接失败
- 检查 `DATABASE_URL` 配置
- 确认数据库服务运行中
- 验证用户权限

### 爬取失败
- 查看 `gatherer-error.log`
- 检查网络连接
- 降低并发数

### 找不到卡片数据
- 可能是 ID 不存在
- 检查 Gatherer 网站是否可访问
- 查看详细日志
