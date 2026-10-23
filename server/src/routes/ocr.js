'use strict';
/**
 * 票据识别（OCR）—— 当前是**占位实现**。
 *
 * 为什么先做占位：
 *   前端需要「上传图片 -> 拿到识别结果 -> 确认入账」这条链路能跑通。
 *   真 OCR（华为云文字识别 / 腾讯云 OCR）需要开通服务 + 鉴权 + 调额度，
 *   先把链路打通，再换实现，前端完全不用改。
 *
 * 换成真 OCR 时只改 recognize() 这一个函数。
 */
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../lib/auth');
const { toYuan } = require('../lib/money');

const router = express.Router();
router.use(requireAuth);

/** 占位识别：返回和效果图一致的结果结构 */
async function recognize(buffer, filename) {
  return {
    merchant: '悦茶饮品店',
    date: '2026-06-15',
    amount: 128.5,
    category: '原材料',
    note: '珍珠奶茶 ×2',
    confidence: { merchant: 98, date: 99, amount: 97, category: 96, note: 94 },
    _placeholder: true,
  };
}

/** POST /api/ocr/receipt —— Body 为图片原始字节 */
router.post('/receipt', async (req, res, next) => {
  try {
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!buf.length) return res.status(400).json({ error: 'bad_request', message: '请上传图片（Content-Type: application/octet-stream 或 image/*）' });

    const r = await recognize(buf, req.headers['x-filename'] || null);
    const info = db
      .prepare(
        `INSERT INTO receipts(user_id,image_path,merchant,date,amount_cents,category,note,confidence_json,status)
         VALUES(?,?,?,?,?,?,?,?,'pending')`
      )
      .run(req.user.id, req.headers['x-filename'] || null, r.merchant, r.date,
        Math.round(r.amount * 100), r.category, r.note, JSON.stringify(r.confidence));

    res.status(201).json({ id: Number(info.lastInsertRowid), ...r, amount: toYuan(Math.round(r.amount * 100)) });
  } catch (e) { next(e); }
});

/** POST /api/ocr/receipt/:id/confirm —— 确认入账 */
router.post('/receipt/:id/confirm', (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('SELECT * FROM receipts WHERE id=? AND user_id=?').get(id, req.user.id);
  if (!r) return res.status(404).json({ error: 'not_found' });
  if (r.status === 'confirmed') return res.status(409).json({ error: 'conflict', message: '该票据已入账' });

  let cat = db.prepare('SELECT id FROM categories WHERE user_id=? AND name=?').get(req.user.id, r.category);
  let catId;
  if (!cat) {
    const info = db.prepare('INSERT INTO categories(user_id,name,kind) VALUES(?,?,?)').run(req.user.id, r.category, 'expense');
    catId = Number(info.lastInsertRowid);
  } else catId = cat.id;

  const body = req.body || {};
  const txInfo = db
    .prepare(
      `INSERT INTO transactions(user_id,date,type,amount_cents,category_id,summary,note,source,status)
       VALUES(?,?,'expense',?,?,?,?,'ocr','confirmed')`
    )
    .run(req.user.id, body.date || r.date, body.amount !== undefined ? Math.round(Number(body.amount) * 100) : r.amount_cents,
      catId, body.summary || r.merchant, body.note || r.note);

  db.prepare(`UPDATE receipts SET status='confirmed' WHERE id=?`).run(id);
  res.status(201).json({ ok: true, receiptId: id, transactionId: Number(txInfo.lastInsertRowid) });
});

/** GET /api/ocr/receipts —— 票据历史 */
router.get('/receipts', (req, res) => {
  const rows = db.prepare('SELECT * FROM receipts WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id);
  res.json({ items: rows.map((r) => ({ ...r, amount: toYuan(r.amount_cents) })) });
});

module.exports = router;
