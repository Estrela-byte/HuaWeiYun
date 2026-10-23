'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../lib/auth');
const { parseBill } = require('../lib/csv');
const { classify } = require('../lib/classifier');

const router = express.Router();
router.use(requireAuth);

function getOrCreateCategory(userId, name, kind) {
  const hit = db.prepare('SELECT id FROM categories WHERE user_id=? AND name=?').get(userId, name);
  if (hit) return hit.id;
  const info = db.prepare('INSERT INTO categories(user_id,name,kind) VALUES(?,?,?)').run(userId, name, kind);
  return Number(info.lastInsertRowid);
}

/**
 * POST /api/import/bills?platform=wechat|alipay
 * Body: 账单 CSV 的原始字节（Content-Type: application/octet-stream 或 text/plain）
 *
 * 返回：{ jobId, total, categorized, pending, skipped, encoding }
 * 正好对应「数据采集」页的「共 486 笔 / 自动分类 452 笔 / 待确认 34 笔」
 */
router.post('/bills', (req, res) => {
  const platform = String(req.query.platform || req.headers['x-platform'] || 'wechat').toLowerCase();
  if (!['wechat', 'alipay'].includes(platform)) {
    return res.status(400).json({ error: 'bad_request', message: 'platform 只能是 wechat 或 alipay' });
  }

  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
  if (!buf.length) {
    return res.status(400).json({ error: 'bad_request', message: '请求体为空，请把账单 CSV 内容作为原始字节上传' });
  }

  let parsed;
  try {
    parsed = parseBill(buf, platform);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.code || 'bad_csv', message: e.message });
  }

  let categorized = 0;
  let pending = 0;
  const insert = db.prepare(
    `INSERT INTO transactions(user_id,date,type,amount_cents,category_id,summary,note,source,status)
     VALUES(?,?,?,?,?,?,?,?,?)`
  );

  db.exec('BEGIN');
  try {
    for (const r of parsed.rows) {
      const c = classify(r);
      const catId = getOrCreateCategory(req.user.id, c.category, r.type);
      const status = c.matched ? 'confirmed' : 'pending';
      insert.run(
        req.user.id, r.date, r.type, r.amount_cents, catId,
        r.summary, r.note || null, platform, status
      );
      if (c.matched) categorized++; else pending++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const info = db
    .prepare(
      `INSERT INTO import_jobs(user_id,platform,filename,total,categorized,pending,status,message)
       VALUES(?,?,?,?,?,?,'done',?)`
    )
    .run(req.user.id, platform, req.headers['x-filename'] || null,
      parsed.rows.length, categorized, pending,
      `编码 ${parsed.encoding}，表头在第 ${parsed.headerLine} 行，跳过 ${parsed.skipped} 行`);

  res.status(201).json({
    jobId: Number(info.lastInsertRowid),
    total: parsed.rows.length,
    categorized,
    pending,
    skipped: parsed.skipped,
    encoding: parsed.encoding,
    headerLine: parsed.headerLine,
  });
});

/** GET /api/import —— 导入历史 */
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM import_jobs WHERE user_id=? ORDER BY id DESC LIMIT 20')
    .all(req.user.id);
  res.json({ items: rows });
});

/** GET /api/import/:jobId —— 导入结果 */
router.get('/:jobId', (req, res) => {
  const job = db
    .prepare('SELECT * FROM import_jobs WHERE id=? AND user_id=?')
    .get(Number(req.params.jobId), req.user.id);
  if (!job) return res.status(404).json({ error: 'not_found' });
  res.json(job);
});

module.exports = router;
