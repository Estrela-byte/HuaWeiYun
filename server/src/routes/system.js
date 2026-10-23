'use strict';
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { db, DB_PATH } = require('../db');
const { requireAuth, requireOwner, hashPassword } = require('../lib/auth');
const { toYuan } = require('../lib/money');
const { monthRange } = require('../lib/metrics');
const checkBusiness = require('../middleware/checkBusiness');

const router = express.Router();
router.use(requireAuth);

/** GET /api/system/members —— 当前主体下的账号与权限（前置 checkBusiness 校验主体归属） */
router.get('/members', checkBusiness, (req, res) => {
  const rows = db.prepare(
    `SELECT u.id,u.name,u.phone,u.role,u.industry,u.created_at
       FROM users u
       JOIN business_members m ON m.user_id = u.id
      WHERE m.business_id = ?
      ORDER BY u.id`
  ).all(req.businessId);
  res.json({ items: rows });
});

/** POST /api/system/members/invite —— 仅老板 */
router.post('/members/invite', requireOwner, (req, res) => {
  const { name, phone, password = '123456', role = 'staff' } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'bad_request', message: 'name / phone 必填' });
  if (!['owner', 'staff'].includes(role)) return res.status(400).json({ error: 'bad_request', message: 'role 非法' });
  const exist = db.prepare('SELECT id FROM users WHERE phone=?').get(String(phone));
  if (exist) return res.status(409).json({ error: 'conflict', message: '该手机号已存在' });
  const info = db.prepare('INSERT INTO users(name,phone,industry,role,password_hash) VALUES(?,?,?,?,?)')
    .run(name, String(phone), '餐饮', role, hashPassword(password));
  res.status(201).json(db.prepare('SELECT id,name,phone,role FROM users WHERE id=?').get(Number(info.lastInsertRowid)));
});

/** PUT /api/system/members/:id —— 改角色 */
router.put('/members/:id', requireOwner, (req, res) => {
  const { role } = req.body || {};
  if (!['owner', 'staff'].includes(role)) return res.status(400).json({ error: 'bad_request', message: 'role 非法' });
  const info = db.prepare('UPDATE users SET role=? WHERE id=?').run(role, Number(req.params.id));
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json(db.prepare('SELECT id,name,phone,role FROM users WHERE id=?').get(Number(req.params.id)));
});

/** POST /api/system/backup —— 导出全库 JSON 快照到 data/backups/ */
router.post('/backup', requireOwner, (req, res) => {
  const tables = ['users', 'categories', 'transactions', 'products', 'alerts', 'alert_settings', 'receipts'];
  const snapshot = { at: new Date().toISOString(), db: DB_PATH, data: {} };
  for (const t of tables) snapshot.data[t] = db.prepare(`SELECT * FROM ${t}`).all();

  const dir = path.join(path.dirname(DB_PATH), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `backup-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));

  res.json({
    ok: true,
    at: snapshot.at,
    file: path.basename(file),
    size: fs.statSync(file).size,
    tables: Object.fromEntries(Object.entries(snapshot.data).map(([k, v]) => [k, v.length])),
  });
});

/** GET /api/system/export?format=csv|xlsx|pdf&month=2026-06 */
router.get('/export', (req, res) => {
  const format = String(req.query.format || 'csv').toLowerCase();
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const [from, to] = monthRange(month);

  const rows = db
    .prepare(
      `SELECT t.date, t.type, t.amount_cents, COALESCE(c.name,'未分类') cat, t.summary, t.source, t.status
         FROM transactions t LEFT JOIN categories c ON c.id=t.category_id
        WHERE t.user_id=? AND t.date>=? AND t.date<?
        ORDER BY t.date, t.id`
    )
    .all(req.user.id, from, to);

  const head = ['日期', '类型', '金额(元)', '分类', '摘要', '来源', '状态'];
  const lines = [head.join(',')].concat(
    rows.map((r) => [r.date, r.type === 'income' ? '收入' : '支出', toYuan(r.amount_cents), r.cat,
      `"${(r.summary || '').replace(/"/g, '""')}"`, r.source, r.status].join(','))
  );
  const csv = '\uFEFF' + lines.join('\n'); // BOM 让 Excel 正确识别中文

  if (format === 'xlsx' || format === 'pdf') {
    // 扩展项：接 exceljs / pdfkit 后可输出真格式，当前降级为 CSV
    res.setHeader('X-Warning', `${format} 尚未实现，已降级为 CSV`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sme-i-${month}.csv"`);
    return res.send(csv);
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="sme-i-${month}.csv"`);
  res.send(csv);
});

module.exports = router;
