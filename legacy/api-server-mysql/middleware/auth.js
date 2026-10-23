// 登录认证中间件：校验 JWT Token
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }
  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'shop_secret');
    req.user = decoded; // 把用户信息挂到 req 上，后续路由可用 req.user.id
    next();
  } catch (e) {
    return res.status(401).json({ code: 401, message: '登录已失效' });
  }
}

module.exports = { auth };