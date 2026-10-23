'use strict';
/**
 * 智能问答 —— PRD 的核心创新点：**系统算数、模型解释**。
 *
 * 流程：
 *   1. 后端先把数字算好（metrics.overview）
 *   2. 把数字作为「计算依据」放进提示词上下文
 *   3. 调用大模型，只让它做归因和语言组织
 *   4. 返回 answer + basis，前端右侧直接展示 basis
 *
 * 没有配置 LLM_API_KEY 时自动降级为「内置规则引擎」，
 * 演示时不依赖网络，也不会因为是断网就讲不了。
 */
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../lib/auth');
const metrics = require('../lib/metrics');

const router = express.Router();
router.use(requireAuth);

const curMonth = () => new Date().toISOString().slice(0, 7);
const fd = (n) => (n === null || n === undefined ? '—' : `${n > 0 ? '+' : ''}${n}%`);

/** 把指标整理成「计算依据」数组（前端右侧那块） */
function buildBasis(o) {
  return [
    { label: '营业额', month: o.month, current: o.revenue, prev: o.prev.revenue, mom: o.mom.revenue },
    { label: '成本', month: o.month, current: o.cost, prev: o.prev.cost, mom: o.mom.cost },
    { label: '利润', month: o.month, current: o.profit, prev: o.prev.profit, mom: o.mom.profit },
    { label: '毛利率', month: o.month, current: o.margin, prev: o.prev.margin, mom: o.mom.margin },
  ];
}

/** 生成提示词上下文（数字全部来自系统计算） */
function buildPrompt(o) {
  return [
    `本月(${o.month})：营业额 ${o.revenue} 元，成本 ${o.cost} 元，利润 ${o.profit} 元，毛利率 ${o.margin}%。`,
    `上月(${o.prev.month})：营业额 ${o.prev.revenue} 元，成本 ${o.prev.cost} 元，利润 ${o.prev.profit} 元，毛利率 ${o.prev.margin}%。`,
    `环比：营业额 ${fd(o.mom.revenue)}，成本 ${fd(o.mom.cost)}，利润 ${fd(o.mom.profit)}，毛利率 ${o.mom.margin} 个百分点。`,
    `同比：营业额 ${fd(o.yoy.revenue)}，利润 ${fd(o.yoy.profit)}。`,
    `待确认账单 ${o.pendingCount} 笔。`,
  ].join('\n');
}

const SYSTEM_PROMPT = `你是小微企业经营管理助手。
规则：
1. 所有数字都由系统计算好后提供给你，你只能引用，绝不能自己计算或编造数字。
2. 用中文回答，先说原因（3 条以内），再给 1 条可执行建议。
3. 语言简洁，面向没有财务基础的店主。
4. 不要输出 Markdown 表格。`;

/** 无 API Key 时的兜底：内置规则引擎 */
function ruleBasedAnswer(o, costDelta, question) {
  const reasons = [];

  // 1) 收入侧
  if (o.mom.revenue !== null && o.mom.revenue < 0) {
    reasons.push(`营业额下降 ${Math.abs(o.mom.revenue)}%`);
  } else if (o.mom.revenue > 0) {
    reasons.push(`营业额上升 ${o.mom.revenue}%`);
  }

  // 2) 成本侧：找涨幅最大的成本项（分类级，不是总额）
  const rising = costDelta
    .filter((c) => c.mom !== null && c.mom > 0 && c.prev > 0)
    .sort((a, b) => b.mom - a.mom)[0];
  if (rising) {
    reasons.push(`${rising.name}成本上涨 ${rising.mom}%`);
  } else if (o.mom.cost !== null && o.mom.cost > 0) {
    reasons.push(`总成本上涨 ${o.mom.cost}%`);
  }

  // 3) 利润质量
  if (o.mom.margin < 0) {
    reasons.push(`毛利率下降 ${Math.abs(o.mom.margin)} 个点`);
  } else if (o.mom.margin > 0) {
    reasons.push(`毛利率提升 ${o.mom.margin} 个点`);
  }

  if (!reasons.length) reasons.push('本月各项指标与上月基本持平');

  let suggestion = '建议保持当前成本结构，继续观察 2 周趋势。';
  if (o.mom.revenue < 0) {
    suggestion = '营业额下滑，建议排查客流变化，并针对高毛利商品做组合推荐。';
  }
  if (rising && o.mom.revenue <= 0) {
    suggestion = `${rising.name}成本上涨而收入未同步增长，建议先与该类供应商议价，或调整套餐结构提高客单价。`;
  }

  return {
    answer: `主要有 ${reasons.length} 个原因：\n` + reasons.map((r) => `• ${r}`).join('\n'),
    suggestion,
  };
}

/** POST /api/ai/ask  { question, month } */
router.post('/ask', async (req, res, next) => {
  const { question, month } = req.body || {};
  if (!question || !String(question).trim()) {
    return res.status(400).json({ error: 'bad_request', message: 'question 不能为空' });
  }

  const o = metrics.overview(db, req.user.id, month || curMonth());
  const basis = buildBasis(o);
  const context = buildPrompt(o);

  // 成本结构也可以作为补充上下文（按需拼进去）
  const cs = metrics.costStructure(db, req.user.id, o.month);
  const costDelta = metrics.categorySeries(db, req.user.id, o.month, o.prev.month);
  const csText = cs.items.map((i) => `${i.name} ${i.ratio}%`).join('，');

  const apiKey = process.env.LLM_API_KEY;
  let engine = 'rule-based';
  let answer, suggestion;

  if (apiKey) {
    try {
      const base = process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1';
      const model = process.env.LLM_MODEL || 'deepseek-chat';
      const resp = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `【系统已计算的真实数据】\n${context}\n\n【成本结构】${csText}\n\n【用户问题】${question}\n\n请只基于上面的数据回答，不要编造数字。`,
            },
          ],
        }),
        signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 20000)),
      });
      if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}`);
      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('LLM 返回为空');
      answer = text;
      suggestion = null;
      engine = model;
    } catch (e) {
      console.warn('[ai] 大模型调用失败，降级为规则引擎:', e.message);
      const fb = ruleBasedAnswer(o, costDelta, question);
      answer = fb.answer; suggestion = fb.suggestion;
    }
  } else {
    const fb = ruleBasedAnswer(o, costDelta, question);
    answer = fb.answer; suggestion = fb.suggestion;
  }

  res.json({
    month: o.month,
    question,
    answer,
    suggestion,
    basis,
    costStructure: cs,
    costDelta,
    engine,
    actions: ['看细节', '对比上月', '出报告'],
  });
});

module.exports = router;
