import { defaultKnowledgeBase } from "./dist/knowledge/index.js";
import { evaluate } from "./dist/search-eval/index.js";
import { Decimal } from "./dist/types/decimal.js";

const kb = defaultKnowledgeBase();

const search = {
  async search(req) {
    const limit = req.topK ?? 5;
    const hits = kb.search(req.query, limit);
    return {
      hits: hits.map((h) => ({
        docId: h.doc.id,
        title: h.doc.title,
        snippet: h.doc.content.slice(0, 60),
        source: "local",
        relevance: Decimal.fromInt(h.score),
      })),
      degraded: false,
      emptyKnowledge: kb.list().length === 0,
    };
  },
};

const testSet = {
  queries: [
    { id: "p1", query: "毛利率的定义和计算公式", sampleType: "positive", relevantDocIds: ["kpi-gross-margin"] },
    { id: "p2", query: "利润下降有哪些原因怎么应对", sampleType: "positive", relevantDocIds: ["faq-profit-decline"] },
    { id: "p3", query: "现金流管理的关键指标与对策", sampleType: "positive", relevantDocIds: ["faq-cashflow"] },
    { id: "n1", query: "如何制作提拉米苏蛋糕", sampleType: "negative", relevantDocIds: [] },
  ],
};

const thresholds = { recall: Decimal.fromString("0.5"), precision: Decimal.fromString("0.5") };

const result = await evaluate(testSet, thresholds, search);

if (!result.ok) {
  console.log("评估失败:", result.error.code, result.error.message);
  process.exit(1);
}

const r = result.value;
console.log("========== 检索质量评估报告 ==========");
console.log(`评估范围: knowledgeIds=[${r.scope.knowledgeIds.join(",")}] version="${r.scope.version}"`);
console.log(`生成时间: ${r.generatedAt}`);
console.log();
console.log("【整体指标】");
console.log(`  召回率(Recall)   = ${r.metrics.recall?.toString() ?? "N/A(不可计算)"}`);
console.log(`  精确度(Precision)= ${r.metrics.precision?.toString() ?? "N/A(不可计算)"}`);
console.log(`  TP=${r.metrics.truePositive}  FP=${r.metrics.falsePositive}  FN=${r.metrics.falseNegative}`);
console.log(`  标注相关总数=${r.metrics.totalRelevant}  返回文档总数=${r.metrics.totalReturned}`);
console.log(`  达标判定: ${r.judgement.overall}（${r.conclusion}）`);
console.log();
console.log("【逐查询明细】");
for (const d of r.details) {
  const q = testSet.queries.find((x) => x.id === d.queryId);
  console.log(`  [${d.queryId}] ${d.sampleType === "negative" ? "负样本" : "正样本"} "${q.query}"`);
  console.log(`      标注相关=${d.relevantCount} 返回=${d.returnedCount} 命中相关=${d.returnedRelevantCount}`);
  console.log(`      召回=${d.recall?.toString() ?? "N/A"}  精确=${d.precision?.toString() ?? "N/A"}  误检=${d.falsePositive} 漏检=${d.falseNegative} 失败=${d.failed}`);
}
console.log();
const neg = r.details.find((d) => d.sampleType === "negative");
const negQ = testSet.queries.find((x) => x.id === neg.queryId);
console.log("【不在知识库的问题（负样本）专项结果】");
console.log(`  问题: "${negQ.query}"`);
console.log(`  返回文档数: ${neg.returnedCount}`);
if (neg.returnedCount === 0) {
  console.log(`  => 正确空命中，未误检（理想行为：对不在知识库的问题不返回内容）`);
} else {
  console.log(`  => 误检！返回了不相关内容，精确度受损`);
}
console.log(`  该问题召回率: ${neg.recall?.toString() ?? "N/A（负样本无标注相关文档，召回率不适用）"}`);
console.log(`  该问题精确度: ${neg.precision?.toString() ?? "N/A（空命中，精确度不适用）"}`);