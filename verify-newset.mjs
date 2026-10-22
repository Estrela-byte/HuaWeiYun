import { defaultKnowledgeBase, KnowledgeReadonlySearchAdapter } from "./dist/knowledge/index.js";
import { evaluate } from "./dist/search-eval/index.js";
import { Decimal } from "./dist/types/decimal.js";

const thresholds = { recall: Decimal.fromString("0.5"), precision: Decimal.fromString("0.5") };

const newSet = {
  queries: [
    { id: "d1", query: "毛利率的定义和计算公式", sampleType: "positive", relevantDocIds: ["kpi-gross-margin"] },
    { id: "d2", query: "盈亏平衡点如何计算", sampleType: "positive", relevantDocIds: ["kpi-break-even"] },
    { id: "d3", query: "净利率的计算公式", sampleType: "positive", relevantDocIds: ["kpi-net-margin"] },
    { id: "d4", query: "现金流管理有哪些要点", sampleType: "positive", relevantDocIds: ["faq-cashflow"] },
    { id: "d5", query: "费用率的计算公式", sampleType: "positive", relevantDocIds: ["kpi-expense-ratio"] },
    { id: "d6", query: "利润下降的原因有哪些", sampleType: "positive", relevantDocIds: ["faq-profit-decline"] },
    { id: "d7", query: "收入波动预警的规则", sampleType: "positive", relevantDocIds: ["rule-revenue-fluctuation"] },
    { id: "c1", query: "卖一单货刨去成本到底能剩多少", sampleType: "positive", relevantDocIds: ["kpi-gross-margin"] },
    { id: "c2", query: "做到多少生意才能不亏本", sampleType: "positive", relevantDocIds: ["kpi-break-even"] },
    { id: "p1", query: "毛利占营业收入的比重", sampleType: "positive", relevantDocIds: ["kpi-gross-margin"] },
    { id: "p2", query: "净利润大概能拿到多少", sampleType: "positive", relevantDocIds: ["kpi-net-margin"] },
    { id: "b1", query: "毛利率低于多少需要警惕", sampleType: "positive", relevantDocIds: ["rule-gross-margin-floor"] },
    { id: "b2", query: "成本占比超过多少会预警", sampleType: "positive", relevantDocIds: ["rule-cost-ratio"] },
    { id: "i1", query: "如何制作提拉米苏蛋糕", sampleType: "negative", relevantDocIds: [] },
    { id: "i2", query: "如何饲养一只金毛犬", sampleType: "negative", relevantDocIds: [] },
    { id: "f1", query: "应收账款周转率怎么计算", sampleType: "negative", relevantDocIds: [] },
    { id: "f2", query: "存货周转天数如何缩短", sampleType: "negative", relevantDocIds: [] },
  ],
};

const result = await evaluate(newSet, thresholds, new KnowledgeReadonlySearchAdapter(defaultKnowledgeBase()));
if (!result.ok) {
  console.log("FAIL:", result.error.code, result.error.message);
  process.exit(1);
}
const m = result.value.metrics;
console.log("recall:", m.recall?.toString(), "precision:", m.precision?.toString());
console.log("TP:", m.truePositive, "FP:", m.falsePositive, "FN:", m.falseNegative);
for (const d of result.value.details) {
  if (d.sampleType === "positive" && d.falseNegative) {
    console.log("FN sample:", d.queryId, JSON.stringify(d.query));
  }
  if (d.falsePositive) {
    console.log("FP sample:", d.queryId, JSON.stringify(d.query));
  }
}