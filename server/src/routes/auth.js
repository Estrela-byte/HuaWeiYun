'use strict';
const express = require('express');
const { db } = require('../db');
const { hashPassword, verifyPassword, needsRehash, signToken, requireAuth } = require('../lib/auth');

const router = express.Router();

/** POST /api/auth/login  { phone | name, password } */
router.post('/login', (req, res) => {
  const { phone, name, password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'bad_request', message: '请输入密码' });

  const user = phone
    ? db.prepare('SELECT * FROM users WHERE phone=?').get(String(phone))
    : db.prepare('SELECT * FROM users WHERE name=?').get(String(name || ''));

  // 统一错误消息，避免用户枚举
  if (!user || !verifyPassword(user.password_hash, password)) {
    return res.status(401).json({ error: 'unauthorized', message: '账号或密码错误' });
  }

  // 旧 sha256 哈希自动升级为 scrypt
  if (needsRehash(user.password_hash)) {
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password), user.id);
  }

  res.json({
    token: signToken(user.id),
    user: { id: user.id, name: user.name, role: user.role, phone: user.phone, industry: user.industry },
  });
});

/** GET /api/auth/me */
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

/** POST /api/auth/logout —— token 是无状态的，前端删掉即可 */
router.post('/logout', requireAuth, (req, res) => res.json({ ok: true }));

module.exports = router;
