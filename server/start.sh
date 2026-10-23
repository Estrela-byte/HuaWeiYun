#!/bin/sh
# 用于 CodeArts Deploy 的自定义脚本部署（不走容器时）
set -e

echo "==> 检查 Node 版本"
node -v

echo "==> 安装依赖"
npm ci --omit=dev || npm install --omit=dev

echo "==> 初始化数据库（已存在则跳过，不会覆盖数据）"
node src/seed.js

echo "==> 启动服务（端口 ${PORT:-3000}）"
exec node src/index.js
