'use strict';
/**
 * 服务入口。
 * 启动顺序：建表 -> 鉴权自检 -> 注册中间件 -> 挂路由 -> 监听
 *
 * 端口从 process.env.PORT 读（云上必须这样，不能硬编码），
 * 日志打到 stdout（云平台靠它收日志）。
 */
const express = require('express');
const cors = require('cors');
const { initSchema } = require('./db');
const { assertSecret } = require('./lib/auth');

const PORT = Number(process.env.PORT || 3000);
const app = express();

initSchema();
assertSecret();

// CORS：生产环境通过 CORS_ORIGIN 限定允许来源（逗号分隔），默认 * 仅限开发
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : '*';
app.use(cors({ origin: corsOrigin }));

app.use(express.json({ limit: '2mb' }));
// 账单 CSV 以原始字节上传（前端用 text/plain 或 application/octet-stream 发送文件内容）
app.use('/api/import/bills', express.raw({ type: '*/*', limit: '20mb' }));
// 票据图片同理。⚠️ 只匹配二进制类型，避免把 /receipt/:id/confirm 的 JSON 也当 Buffer 吃掉
app.use('/api/ocr/receipt', express.raw({ type: ['application/octet-stream', 'image/*', 'application/pdf'], limit: '20mb' }));

// ---- 健康检查：CodeArts 部署 / K8s / 负载均衡都靠它 ----
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'sme-i-api', version: '0.1.0', node: process.version, time: new Date().toISOString() });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/import', require('./routes/import'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/system', require('./routes/system'));

// 404
app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));

// 统一错误处理（必须放最后，4 个参数才是错误中间件）
app.use((err, req, res, next) => {
  console.error('[error]', req.method, req.path, err.message);
  const status = err.status || 500;
  // 生产环境隐藏内部错误细节，仅暴露业务错误码
  const expose = status < 500 || process.env.NODE_ENV !== 'production';
  res.status(status).json({
    error: err.code || 'internal_error',
    message: expose ? err.message : '内部错误',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[sme-i-api] listening on http://0.0.0.0:${PORT}`);
  console.log(`[sme-i-api] health : http://127.0.0.1:${PORT}/api/health`);
  console.log(`[sme-i-api] docs   : see API.md`);
});
