# SME-I Manager 后端数据接口
# Node 24 内置 node:sqlite，无需安装数据库驱动
FROM node:24-alpine

WORKDIR /app

# 先装依赖，利用 Docker 层缓存
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

ENV PORT=3000
ENV DB_PATH=/app/data/sme.db
EXPOSE 3000
# 数据库持久化：避免容器重建后演示/业务数据丢失
VOLUME ["/app/data"]

# 健康检查：CodeArts 部署服务 / K8s 靠它判断实例是否存活
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# 首次启动若无数据库则自动建库并灌入演示数据
CMD ["sh", "-c", "node src/seed.js && node src/index.js"]
