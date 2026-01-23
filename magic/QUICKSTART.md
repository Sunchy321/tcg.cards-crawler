# 快速启动指南

## 1. 安装依赖（首次运行）

```bash
cd /Users/sunchy321/Desktop/WebServer/crawler
bun install
```

## 2. 配置数据库（如果还未配置）

在 `magic` 目录下创建 `.env` 文件：

```bash
cd magic
cp .env.example .env
```

编辑 `.env` 文件，设置数据库连接字符串。

## 3. 运行爬虫

### 测试运行（推荐首次使用）

爬取前 10 张卡片测试：

```bash
bun index.ts 10
```

### 小规模爬取

爬取前 100 张卡片：

```bash
bun index.ts 100
```

### 中等规模爬取

爬取前 1000 张卡片：

```bash
bun index.ts 1000
```

### 大规模爬取

爬取前 10000 张卡片（使用较高并发）：

```bash
bun index.ts 10000 --concurrency 10
```

### 断点续传

如果之前爬到了 500，从 501 继续：

```bash
bun index.ts 1000 --start 501
```

### 强制刷新

忽略缓存，重新爬取所有数据：

```bash
bun index.ts 1000 --no-skip-unexpired
```

## 4. 查看日志

爬虫运行时会在控制台输出进度，详细日志保存在：

- 全部日志: `../../log/magic/gatherer.log`
- 错误日志: `../../log/magic/gatherer-error.log`

## 5. 检查数据库

使用 SQL 客户端连接数据库，查询 `magic.data_gatherer` 表：

```sql
-- 查看已爬取的卡片数量
SELECT COUNT(*) FROM magic.data_gatherer;

-- 查看最近爬取的卡片
SELECT multiverse_id, data->>'instanceName' as name, created_at
FROM magic.data_gatherer
ORDER BY created_at DESC
LIMIT 10;

-- 查看即将过期的数据
SELECT multiverse_id, data->>'instanceName' as name, expires_at
FROM magic.data_gatherer
WHERE expires_at < NOW() + INTERVAL '7 days'
ORDER BY expires_at
LIMIT 10;
```

## 常见问题

### Q: 爬虫速度太慢？
A: 可以增加并发数，例如 `--concurrency 15`

### Q: 遇到网络错误？
A: Crawlee 会自动重试，如果持续失败请降低并发数

### Q: 如何知道爬虫是否正常工作？
A: 查看控制台输出和日志文件，每成功爬取一张卡片都会有记录

### Q: 数据存储在哪里？
A: 数据存储在 PostgreSQL 的 `magic.data_gatherer` 表中

## 下一步

完成爬取后，可以：
1. 分析爬取的数据
2. 导出数据用于其他用途
3. 定期运行爬虫更新数据（建议 30 天更新一次）

## 获取帮助

查看完整帮助信息：

```bash
bun index.ts --help
```

查看项目文档：

```bash
cat README.md
cat SUMMARY.md
```
