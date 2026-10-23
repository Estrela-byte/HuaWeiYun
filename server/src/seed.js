'use strict';
/**
 * 初始化数据库 + 灌入演示数据。
 *
 * 演示数字已与效果图对齐，可用来验证指标口径：
 *   2026-06  营业额 128,400  成本 82,150  利润 46,250  毛利率 36.0%
 *   2026-05  营业额 135,200  成本 82,337  利润 52,863  毛利率 39.1%
 *   → 环比: 营业额 -5.0%  原材料 +12.2%  毛利率 -3.1 个点
 *   成本结构: 原材料 45% / 人工 22% / 房租 18% / 其他 15%
 *
 * 用法:
 *   node src/seed.js               # 建表；库为空时灌入演示数据
 *   node src/seed.js --init-only   # 只建表，不灌数据
 *   node src/seed.js --force       # 清空后重新灌入
 */
const { db, initSchema } = require('./db');
const { hashPassword } = require('./lib/auth');

const toCents = (v) => Math.round(Number(v) * 100);

// ---------- 可复现的伪随机（保证每次生成的数据一样） ----------
let _seed = 20260615;
const rnd = () => (_seed = (_seed * 1103515245 + 12345) % 2147483648) / 2147483648;

/** 把总金额按权重拆成 n 份（整数分，最后一份补齐差额，保证总和精确） */
function split(totalCents, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.floor((totalCents * w) / sum));
  out[out.length - 1] += totalCents - out.reduce((a, b) => a + b, 0);
  return out;
}

const CATEGORIES = [
  ['营业收入', 'income'],
  ['退款', 'expense'],
  ['原材料', 'expense'],
  ['人工', 'expense'],
  ['房租', 'expense'],
  ['其他', 'expense'],
];

/**
 * 每个月的数据：[月份, 收入(元), 原材料, 人工, 房租, 其他]
 * 注意 2026-05 / 2026-06 的原材料金额是专门为效果图对齐的。
 */
const MONTHS = [
  ['2025-06', 130800, 31000, 18000, 14000, 16900],
  ['2026-01', 112000, 28000, 17000, 14000, 15000],
  ['2026-02',  98000, 26000, 16000, 14000, 12000],
  ['2026-03', 121000, 30000, 17500, 14000, 17500],
  ['2026-04', 127000, 31500, 18000, 14000, 17500],
  ['2026-05', 135200, 32900, 18073, 14787, 16577],
  ['2026-06', 128400, 36900, 18073, 14787, 12390],
];

const EXPENSE_LABELS = {
  原材料: ['采购原材料', '采购咖啡豆', '进货-奶基底', '进货-杯材', '进货-水果'],
  人工: ['员工薪资', '兼职时薪', '社保公积金'],
  房租: ['门店房租', '物业费', '水电费'],
  其他: ['设备维修', '外卖平台服务费', '门店物料', '团建'],
};

function main() {
  const args = process.argv.slice(2);
  initSchema();

  const hasData = Number(db.prepare('SELECT COUNT(*) c FROM users').get().c) > 0;

  if (args.includes('--force')) {
    console.log('[seed] --force：清空原有数据');
    for (const t of ['receipts', 'alerts', 'alert_settings', 'import_jobs', 'transactions', 'products', 'categories', 'users']) {
      db.exec(`DELETE FROM ${t}`);
    }
  } else if (args.includes('--init-only')) {
    console.log('[seed] 仅建表，不灌数据');
    return;
  } else if (hasData) {
    console.log('[seed] 数据库已有数据，跳过。要重建请执行: npm run reset');
    return;
  }

  db.exec('BEGIN');
  try {
    // ---------- 用户 ----------
    const insUser = db.prepare('INSERT INTO users(name,phone,industry,role,password_hash) VALUES(?,?,?,?,?)');
    const ownerId = Number(insUser.run('张总', '13800000001', '餐饮', 'owner', hashPassword('123456')).lastInsertRowid);
    insUser.run('李会计', '13800000002', '餐饮', 'staff', hashPassword('123456'));

    // ---------- 分类 ----------
    const insCat = db.prepare('INSERT INTO categories(user_id,name,kind) VALUES(?,?,?)');
    const catId = {};
    for (const [name, kind] of CATEGORIES) catId[name] = Number(insCat.run(ownerId, name, kind).lastInsertRowid);

    // ---------- 交易 ----------
    const insTx = db.prepare(
      `INSERT INTO transactions(user_id,date,type,amount_cents,category_id,summary,note,source,status)
       VALUES(?,?,?,?,?,?,?,?,?)`
    );
    const pad = (n) => String(n).padStart(2, '0');

    for (const [month, income, mat, labor, rent, other] of MONTHS) {
      // 收入：老月份用 4 条汇总，2026-06 用 25 条日流水（让列表看起来真实）
      if (month === '2026-06') {
        const n = 25;
        const w = Array.from({ length: n }, () => 0.6 + rnd() * 0.8);
        const parts = split(toCents(income), w);
        for (let i = 0; i < n; i++) {
          const day = 1 + Math.floor((i * 30) / n);
          insTx.run(ownerId, `${month}-${pad(Math.min(day, 30))}`, 'income', parts[i],
            catId['营业收入'], '门店营业额', null, i % 5 === 0 ? 'wechat' : (i % 7 === 0 ? 'alipay' : 'manual'), 'confirmed');
        }
      } else {
        const parts = split(toCents(income), [1, 1, 1, 1]);
        for (let i = 0; i < 4; i++) {
          insTx.run(ownerId, `${month}-${pad(5 + i * 7)}`, 'income', parts[i],
            catId['营业收入'], '门店营业额（周汇总）', null, i % 2 ? 'wechat' : 'alipay', 'confirmed');
        }
      }

      // 支出：每个科目 2~5 条，按权重拆分
      const expensePlan = [['原材料', mat], ['人工', labor], ['房租', rent], ['其他', other]];
      for (const [cat, amount] of expensePlan) {
        if (!amount) continue;
        const labels = EXPENSE_LABELS[cat];
        const n = Math.min(labels.length, cat === '房租' ? 3 : 4);
        const w = Array.from({ length: n }, () => 0.7 + rnd() * 0.6);
        const parts = split(toCents(amount), w);
        for (let i = 0; i < n; i++) {
          const day = 3 + Math.floor((i * 24) / n);
          insTx.run(ownerId, `${month}-${pad(Math.min(day, 28))}`, 'expense', parts[i],
            catId[cat], labels[i % labels.length], null,
            cat === '原材料' ? (i % 2 ? 'alipay' : 'manual') : 'manual', 'confirmed');
        }
      }
    }

    // ---------- 待确认账单 34 笔（对应「待归类 34 笔」） ----------
    const pendingLabels = ['未知收款方', '扫码支付', '线上订单', '供应商A', '供应商B'];
    for (let i = 0; i < 34; i++) {
      const cents = toCents(8 + Math.floor(rnd() * 300));
      insTx.run(ownerId, `2026-06-${pad(1 + (i % 28))}`, i % 3 === 0 ? 'income' : 'expense', cents,
        null, pendingLabels[i % pendingLabels.length], '自动分类未命中，待人工确认',
        i % 2 ? 'wechat' : 'alipay', 'pending');
    }

    // ---------- 商品（毛利率对齐效果图） ----------
    const insProd = db.prepare('INSERT INTO products(user_id,name,price_cents,cost_cents) VALUES(?,?,?,?)');
    insProd.run(ownerId, '招牌奶茶', toCents(18.0), toCents(6.84));   // 62%
    insProd.run(ownerId, '双人套餐', toCents(68.0), toCents(35.36));  // 48%
    insProd.run(ownerId, '咖啡', toCents(16.0), toCents(4.64));       // 71%

    // ---------- 预警 ----------
    const insAlert = db.prepare(
      'INSERT INTO alerts(user_id,type,level,title,detail,threshold,pushed_at) VALUES(?,?,?,?,?,?,?)'
    );
    insAlert.run(ownerId, 'cost_ratio', 'high', '原材料成本占比 45%',
      '已连续 2 周超标', '阈值 40%', '今天 09:20');
    insAlert.run(ownerId, 'revenue_mom', 'medium', '营业额环比下降 5%',
      '低于近 3 个月均值', '阈值 5%', '今天 09:20');
    insAlert.run(ownerId, 'no_flow', 'info', '本周有 1 天无流水',
      '可能漏记，建议补录', null, '昨天 18:05');

    // ---------- 预警阈值 ----------
    db.prepare('INSERT INTO alert_settings(user_id,cost_ratio,revenue_volatility,margin_floor) VALUES(?,?,?,?)')
      .run(ownerId, 40, 5, 30);

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const txCount = Number(db.prepare('SELECT COUNT(*) c FROM transactions').get().c);
  console.log(`[seed] 完成：用户 2 个，交易 ${txCount} 条，商品 3 个，预警 3 条`);
  console.log('[seed] 演示账号：张总 / 13800000001 / 123456（老板）；李会计 / 13800000002 / 123456（店员）');
}

main();
