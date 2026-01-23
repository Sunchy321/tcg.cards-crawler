#!/bin/bash

# Gatherer 爬虫快速启动脚本示例

# 设置环境变量（如果需要）
# export DATABASE_URL="postgresql://username:password@localhost:5432/tcg_cards"

cd "$(dirname "$0")"

# 示例 1: 爬取前 100 张卡片
echo "示例 1: 爬取前 100 张卡片"
# bun index.ts 100

# 示例 2: 从 ID 500 开始爬取到 1000
echo "示例 2: 从 ID 500 开始爬取到 1000"
# bun index.ts 1000 --start 500

# 示例 3: 强制刷新所有数据（忽略缓存）
echo "示例 3: 强制刷新所有数据"
# bun index.ts 100 --ignore-unexpired

# 示例 4: 高并发爬取
echo "示例 4: 高并发爬取（并发数 10）"
# bun index.ts 1000 --concurrency 10

echo ""
echo "请取消注释上面的示例来运行"
echo "或者直接运行: bun index.ts <maxId> [options]"
