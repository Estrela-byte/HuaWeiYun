// 用户路由：注册与登录（公开接口，不挂载 auth 中间件）
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { success, fail } = require('../utils/respond');

// 注册接口：POST /api/users/register
router.post('/register', async (req, res) => {
  const { username, password, shop_name } = req.body;
  if (!username || !password) {
    return fail(res, '用户名和密码不能为空');
  }
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (rows.length > 0) {
      return fail(res, '用户名已被占用');
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    await pool.query(
      'INSERT INTO users (username, password_hash, shop_name) VALUES (?, ?, ?)',
      [username, passwordHash, shop_name || null]
    );
    return success(res, null, '注册成功');
  } catch (err) {
    console.error(err);
    return fail(res, '注册失败', 500);
  }
});

// 登录接口：POST /api/users/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return fail(res, '用户名和密码不能为空');
  }
  try {
    const [rows] = await pool.query('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return fail(res, '用户名或密码错误');
    }
    const user = rows[0];
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return fail(res, '用户名或密码错误');
    }
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'shop_secret',
      { expiresIn: '7d' }
    );
    return success(res, { token }, '登录成功');
  } catch (err) {
    console.error(err);
    return fail(res, '登录失败', 500);
  }
});

module.exports = router;