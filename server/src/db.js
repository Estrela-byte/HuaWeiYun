'use strict';
/**
 * 数据库层：使用 Node 24 内置的 node:sqlite，零外部依赖。
 * 金额统一用「整数分」存储，避免浮点误差。
 *
 * 换成华为云 RDS(MySQL) 时，只需替换本文件里的 SQL 方言和驱动，
 * 上层 routes / lib 都不用改（这就是分层的好处）。
 */
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'sme.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  phone         TEXT,
  industry      TEXT,
  role          TEXT    NOT NULL DEFAULT 'staff',   -- owner(老板) | staff(店员)
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  name       TEXT    NOT NULL,
  kind       TEXT    NOT NULL,                       -- income | expense
  color      TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  date         TEXT    NOT NULL,                     -- YYYY-MM-DD
  type         TEXT    NOT NULL,                     -- income | expense
  amount_cents INTEGER NOT NULL,                     -- 金额（分），永远为正
  category_id  INTEGER REFERENCES categories(id),
  summary      TEXT,
  note         TEXT,
  source       TEXT    NOT NULL DEFAULT 'manual',    -- manual | wechat | alipay | ocr
  status       TEXT    NOT NULL DEFAULT 'confirmed', -- confirmed | pending
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tx_user_status ON transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_tx_user_created ON transactions(user_id, created_at);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  name        TEXT    NOT NULL,
  price_cents INTEGER NOT NULL,                      -- 售价
  cost_cents  INTEGER NOT NULL,                      -- 成本价
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  platform   TEXT    NOT NULL,                       -- wechat | alipay
  filename   TEXT,
  total      INTEGER NOT NULL DEFAULT 0,
  categorized INTEGER NOT NULL DEFAULT 0,
  pending    INTEGER NOT NULL DEFAULT 0,
  status     TEXT    NOT NULL DEFAULT 'done',        -- running | done | failed
  message    TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS alerts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  type       TEXT    NOT NULL,                       -- cost_ratio | revenue_mom | no_flow
  level      TEXT    NOT NULL DEFAULT 'info',        -- high | medium | info
  title      TEXT    NOT NULL,
  detail     TEXT,
  threshold  TEXT,
  status     TEXT    NOT NULL DEFAULT 'open',        -- open | ignored
  pushed_at  TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS alert_settings (
  user_id            INTEGER PRIMARY KEY REFERENCES users(id),
  cost_ratio         REAL NOT NULL DEFAULT 40,
  revenue_volatility REAL NOT NULL DEFAULT 5,
  margin_floor       REAL NOT NULL DEFAULT 30
);

CREATE TABLE IF NOT EXISTS receipts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  image_path      TEXT,
  merchant        TEXT,
  date            TEXT,
  amount_cents    INTEGER,
  category        TEXT,
  note            TEXT,
  confidence_json TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',   -- pending | confirmed
  created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 业务主体成员关系：一个用户可属于多个主体（business），多对多
CREATE TABLE IF NOT EXISTS business_members (
  business_id INTEGER NOT NULL,                          -- 业务主体 ID（逻辑主体，可对接外部系统）
  user_id     INTEGER NOT NULL REFERENCES users(id),
  role        TEXT    NOT NULL DEFAULT 'staff',          -- 该主体内角色：owner | staff
  joined_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (business_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bm_user ON business_members(user_id);

-- 唯一约束：防重复注册 / 重复分类
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cat_user_name_kind ON categories(user_id, name, kind);

-- 业务查询索引
CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_import_user_created ON import_jobs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_user_status ON alerts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_receipts_user_status ON receipts(user_id, status);
`;

function initSchema() {
  db.exec(SCHEMA);
  return db;
}

module.exports = { db, initSchema, DB_PATH };
