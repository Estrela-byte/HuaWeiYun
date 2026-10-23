'use strict';
/**
 * 主体权限中间件 checkBusiness。
 *
 * 用途：校验当前登录用户是否有权访问请求头指定的业务主体（business）。
 * 必须挂在 requireAuth 之后使用——它依赖 req.user.id（requireAuth 设置），
 * 同时兼容暂用的 req.userId。
 *
 * 协议：
 *   请求头 X-Business-Id 携带主体 ID。
 *
 * 行为：
 *   1. 缺少 X-Business-Id        → 403「缺少主体ID」
 *   2. 当前用户不在该主体的成员表 → 403「无权访问该主体」
 *   3. 校验通过                  → req.businessId = bid，next()
 *
 * 依赖表 business_members(business_id, user_id)（由建表脚本维护，本中间件只读）。
 */
const { db } = require('../db');

function checkBusiness(req, res, next) {
  const raw = req.headers['x-business-id'];
  if (raw === undefined || raw === null || raw === '') {
    return res.status(403).json({ error: 'forbidden', message: '缺少主体ID' });
  }

  const bid = Number(raw);
  if (!Number.isInteger(bid) || bid <= 0) {
    return res.status(403).json({ error: 'forbidden', message: '缺少主体ID' });
  }

  // 兼容 requireAuth 设置的 req.user.id，或暂用的 req.userId
  const userId = (req.user && req.user.id) || req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'unauthorized', message: '请先登录' });
  }

  const member = db.prepare(
    'SELECT 1 FROM business_members WHERE business_id = ? AND user_id = ? LIMIT 1'
  ).get(bid, userId);

  if (!member) {
    return res.status(403).json({ error: 'forbidden', message: '无权访问该主体' });
  }

  req.businessId = bid;
  next();
}

module.exports = checkBusiness;
