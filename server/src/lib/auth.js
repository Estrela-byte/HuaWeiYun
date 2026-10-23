'use strict';
/**
 * 认证模块：HMAC 签名 token + scrypt 密码哈希。
 *
 * 密码哈希：
 *   - 新格式 scrypt$<salthex>$<hashhex>，每用户随机盐 + scrypt（Node 内置，无新依赖）
 *   - 兼容旧 sha256(pw+SECRET) 哈希（无前缀），验证命中后由上层触发升级
 *
 * token：HMAC-SHA256，无状态，重启不失效。
 *
 * 安全要求：生产环境必须设置 AUTH_SECRET，否则拒绝启动（见 assertSecret）。
 */
const crypto = require('node:crypto');
const { db } = require('../db');

const DEFAULT_SECRET = 'dev-only-secret-please-change';
const SECRET = process.env.AUTH_SECRET || DEFAULT_SECRET;

/** 启动时调用：生产环境缺密钥则拒绝启动，开发环境打印告警 */
function assertSecret() {
  if (!process.env.AUTH_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境必须设置 AUTH_SECRET 环境变量');
    }
    console.warn('[auth] 警告：未设置 AUTH_SECRET，使用默认密钥，仅限开发环境');
  }
}

const SCRYPT_KEYLEN = 32;
const SCRYPT_SALTLEN = 16;

function hashPassword(pw) {
  const salt = crypto.randomBytes(SCRYPT_SALTLEN);
  const hash = crypto.scryptSync(String(pw), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** 验证密码，兼容旧 sha256 与新 scrypt 格式 */
function verifyPassword(stored, pw) {
  const s = String(stored || '');
  const input = String(pw);
  if (s.startsWith('scrypt$')) {
    const parts = s.split('$');
    if (parts.length !== 3 || !parts[1] || !parts[2]) return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expect = crypto.scryptSync(input, salt, SCRYPT_KEYLEN);
    const got = Buffer.from(parts[2], 'hex');
    if (expect.length !== got.length) return false;
    return crypto.timingSafeEqual(expect, got);
  }
  // 兼容旧 sha256(pw + SECRET) 格式
  const legacy = crypto.createHash('sha256').update(input + SECRET).digest('hex');
  if (legacy.length !== s.length) return false;
  return crypto.timingSafeEqual(Buffer.from(legacy), Buffer.from(s));
}

/** 旧 sha256 哈希是否需要升级为 scrypt */
function needsRehash(stored) {
  return !String(stored || '').startsWith('scrypt$');
}

function signToken(userId) {
  const sig = crypto.createHmac('sha256', SECRET).update(String(userId)).digest('hex').slice(0, 32);
  return `${userId}.${sig}`;
}

function verifyToken(token) {
  const [id, sig] = String(token || '').split('.');
  if (!id || !sig) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(String(id)).digest('hex').slice(0, 32);
  if (sig.length !== expect.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  return Number(id);
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const userId = verifyToken(token);
  if (!userId) return res.status(401).json({ error: 'unauthorized', message: '请先登录' });
  const user = db.prepare('SELECT id,name,phone,role,industry FROM users WHERE id=?').get(userId);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.user = user;
  next();
}

/** 只有老板能改系统设置/成员 */
function requireOwner(req, res, next) {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'forbidden', message: '需要老板权限' });
  }
  next();
}

module.exports = { hashPassword, verifyPassword, needsRehash, signToken, verifyToken, requireAuth, requireOwner, assertSecret };
