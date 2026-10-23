'use strict';
/**
 * 微信支付 / 支付宝 账单 CSV 解析器。
 *
 * ⚠️ 这是整个项目最容易出错的地方，两个平台的格式完全不同：
 *
 *   微信支付：
 *     - 编码 UTF-8（带 BOM）
 *     - 前面约 16 行是说明文字，"交易时间"那行才是表头
 *     - 金额列名 "金额(元)"
 *
 *   支付宝：
 *     - 编码 GBK（必须转码，否则中文全是乱码）
 *     - 前面约 24 行说明文字
 *     - 金额列名 "金额"
 *
 * 用法：parseBill(buffer, 'wechat' | 'alipay')
 */
const { toCents } = require('./money');

/** 自动探测编码：先严格试 UTF-8，失败则按 GBK 解 */
function decodeBuffer(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(String(buf), 'utf8');
  // 去 BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    buf = buf.subarray(3);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder('gbk').decode(buf);
    } catch {
      return new TextDecoder('utf-8').decode(buf);
    }
  }
}

function splitLines(text) {
  return String(text).replace(/\r\n?/g, '\n').split('\n');
}

/** 支持双引号包裹的简易 CSV 行解析 */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuote = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** 在前 80 行里找表头（必须包含指定列名） */
function findHeaderIndex(lines, required) {
  const limit = Math.min(lines.length, 80);
  for (let i = 0; i < limit; i++) {
    const cells = parseCsvLine(lines[i]);
    if (required.every((k) => cells.some((c) => c.includes(k)))) return i;
  }
  return -1;
}

const cleanNum = (s) =>
  String(s || '')
    .replace(/[¥,，\s"元]/g, '')
    .trim();

/** 收/支 列 -> income | expense | skip */
function mapDirection(s) {
  const v = String(s || '').trim();
  if (v.includes('收入') || v === '收') return 'income';
  if (v.includes('支出') || v === '支') return 'expense';
  return 'skip'; // "不计收支" / 空
}

/** "2026-06-15 12:34:56" -> "2026-06-15" */
function toDate(s) {
  const m = String(s || '').match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
}

const PLATFORM_COLUMNS = {
  wechat: {
    required: ['交易时间', '金额'],
    time: ['交易时间'],
    dir: ['收/支'],
    amount: ['金额(元)', '金额'],
    item: ['商品'],
    party: ['交易对方'],
    note: ['备注'],
  },
  alipay: {
    required: ['交易时间', '金额'],
    time: ['交易时间'],
    dir: ['收/支'],
    amount: ['金额'],
    item: ['商品说明', '商品名称'],
    party: ['交易对方'],
    note: ['备注'],
  },
};

function pick(cells, header, names) {
  for (const n of names) {
    const idx = header.findIndex((h) => h === n || h.includes(n));
    if (idx >= 0 && cells[idx] !== undefined && cells[idx] !== '') return cells[idx];
  }
  return '';
}

function parseBill(buffer, platform = 'wechat') {
  const cfg = PLATFORM_COLUMNS[platform] || PLATFORM_COLUMNS.wechat;
  const text = decodeBuffer(buffer);
  const lines = splitLines(text);

  const hIdx = findHeaderIndex(lines, cfg.required);
  if (hIdx < 0) {
    const err = new Error('找不到表头行，请确认上传的是微信/支付宝导出的原始账单 CSV');
    err.status = 400; err.code = 'bad_csv';
    throw err;
  }
  const header = parseCsvLine(lines[hIdx]);

  const rows = [];
  let skipped = 0;
  for (let i = hIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cells = parseCsvLine(line);
    // 跳过表尾汇总行
    if (line.includes('------') || /^总|合计|汇总/.test(cells[0] || '')) { skipped++; continue; }

    const dir = mapDirection(pick(cells, header, cfg.dir));
    const date = toDate(pick(cells, header, cfg.time));
    const amount = cleanNum(pick(cells, header, cfg.amount));

    if (dir === 'skip' || !date || !amount) { skipped++; continue; }
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents === 0) { skipped++; continue; }

    const item = pick(cells, header, cfg.item);
    const party = pick(cells, header, cfg.party);
    rows.push({
      date,
      type: dir,
      amount_cents: Math.abs(cents),
      summary: item || party || '未命名',
      counterparty: party,
      note: pick(cells, header, cfg.note),
      platform,
    });
  }

  return { rows, headerLine: hIdx + 1, skipped, encoding: detectEncodingName(buffer) };
}

function detectEncodingName(buf) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, 4096));
    return 'utf-8';
  } catch {
    return 'gbk';
  }
}

module.exports = { parseBill, decodeBuffer, parseCsvLine };
