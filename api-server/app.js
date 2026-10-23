// 应用入口：极简 Express 骨架（暂不挂载业务路由）
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// 基础中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查接口
app.get('/', (req, res) => {
  res.json({ code: 0, message: '经营管理工作后端已启动' });
});

// 托管前端静态页面（public 目录）
app.use(express.static('public'));

// 挂载业务路由
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/summary', require('./routes/summary'));
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/members', require('./routes/members'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/export', require('./routes/export'));

// 统一错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器已启动，端口：${PORT}`);
});