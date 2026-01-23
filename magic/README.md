1·# Gatherer Crawler

使用 Crawlee 框架和 Bun 运行时的 Magic: The Gathering Gatherer 爬虫。

## 功能特性

- 📦 基于 Crawlee 框架，稳定可靠
- 🚀 支持并发爬取，提高效率
- 💾 自动保存到 PostgreSQL 数据库
- ⏱️ 智能缓存机制，默认 30 天过期
- 🔄 支持断点续传
- 📝 完整的日志记录

## 安装

确保项目根目录已安装所有依赖：

```bash
cd /Users/sunchy321/Desktop/WebServer/crawler
bun install
```

## 使用方法

### 基本用法

```bash
cd magic
bun index.ts <maxId>
```

爬取从 1 到指定 ID 的所有卡片：

```bash
bun index.ts 1000
```

### 高级选项

#### 指定起始 ID

```bash
bun index.ts 1000 --start 500
```

#### 强制刷新所有数据（忽略缓存）

```bash
bun index.ts 1000 --no-skip-unexpired
```

#### 设置并发数

```bash
bun index.ts 1000 --concurrency 10
```

#### 组合使用

```bash
bun index.ts 5000 --start 1000 --concurrency 8 --no-skip-unexpired
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `maxId` | 最大 multiverse ID | 必填 |
| `--start <id>` | 起始 ID | 1 |
| `--skip-unexpired` | 跳过未过期的缓存数据 | true |
| `--no-skip-unexpired` | 强制爬取所有卡片 | - |
| `--concurrency <num>` | 并发请求数 | 5 |
| `-h, --help` | 显示帮助信息 | - |

## 环境变量

### DATABASE_URL

PostgreSQL 数据库连接字符串。

```bash
export DATABASE_URL="postgresql://username:password@localhost:5432/tcg_cards"
```

默认值：`postgresql://localhost:5432/tcg_cards`

## 数据结构

爬虫会将数据保存到 `magic.data_gatherer` 表中：

- `multiverse_id`: 卡片的 multiverse ID（主键）
- `data`: JSON 格式的卡片完整数据
- `created_at`: 数据创建时间
- `expires_at`: 数据过期时间（30 天后）

## 日志

日志文件保存在 `/log/magic/` 目录下：

- `gatherer.log`: 所有日志
- `gatherer-error.log`: 仅错误日志

## 示例

### 爬取前 100 张卡片

```bash
bun index.ts 100
```

### 从第 500 张开始爬取到第 1000 张

```bash
bun index.ts 1000 --start 500
```

### 刷新所有已存在的数据

```bash
bun index.ts 1000 --no-skip-unexpired
```

### 高并发爬取（适合服务器性能较好的情况）

```bash
bun index.ts 10000 --concurrency 20
```

## 注意事项

1. 请合理设置并发数，避免对 Gatherer 网站造成过大压力
2. 建议首次爬取时使用较低的并发数（5-10）
3. 数据会自动去重，重复爬取会更新数据库中的记录
4. 定期检查日志文件以监控爬虫运行状态

## 故障排除

### 连接数据库失败

检查 `DATABASE_URL` 环境变量是否正确设置。

### 爬取速度太慢

可以适当增加 `--concurrency` 参数值，但不建议超过 20。

### 部分卡片爬取失败

查看 `gatherer-error.log` 获取详细错误信息，可能是网络问题或页面结构变化。

## 技术栈

- **Bun** - 高性能 JavaScript 运行时
- [Crawlee](https://crawlee.dev/) - 网页爬虫框架
- [Drizzle ORM](https://orm.drizzle.team/) - 数据库 ORM
- [Cheerio](https://cheerio.js.org/) - HTML 解析
- [Winston](https://github.com/winstonjs/winston) - 日志记录
- TypeScript
