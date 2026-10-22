import { DEFAULT_DOCS, KnowledgeBase, KnowledgeReadonlySearchAdapter } from "./dist/knowledge/index.js";
import { evaluate } from "./dist/search-eval/index.js";
import { DEFAULT_ENHANCED_TEST_SET, toEvalTestSet } from "./dist/eval-calibration/index.js";
import { Decimal } from "./dist/types/decimal.js";

const thresholds = { recall: Decimal.fromString("0.5"), precision: Decimal.fromString("0.5") };
const evalTestSet = toEvalTestSet(DEFAULT_ENHANCED_TEST_SET);
const PRECISION_FLOOR = Decimal.fromString("0.8");

const space = {
  weightSets: [
    { wTitle: Decimal.fromInt(10), wTag: Decimal.fromInt(5), wContent: Decimal.fromInt(1) },
    { wTitle: Decimal.fromInt(10), wTag: Decimal.fromInt(4), wContent: Decimal.fromInt(1) },
    { wTitle: Decimal.fromInt(20), wTag: Decimal.fromInt(8), wContent: Decimal.fromInt(1) },
  ],
  relevanceThresholds: [6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map((n) => Decimal.fromInt(n)),
  scoreGapThresholds: [10, 15, 20, 25, 30, 40, 50, 100].map((n) => Decimal.fromInt(n)),
  maxTopKs: [2, 3, 4, 5, 6],
};

const candidates = [];
for (const ws of space.weightSets) {
  for (const rt of space.relevanceThresholds) {
    for (const gap of space.scoreGapThresholds) {
      for (const topK of space.maxTopKs) {
        candidates.push({ wTitle: ws.wTitle, wTag: ws.wTag, wContent: ws.wContent, relevanceThreshold: rt, scoreGapThreshold: gap, maxTopK: topK });
      }
    }
  }
}

const feasible = [];
for (const config of candidates) {
  const kb = new KnowledgeBase([...DEFAULT_DOCS], config);
  const adapter = new KnowledgeReadonlySearchAdapter(kb);
  const r = await evaluate(evalTestSet, thresholds, adapter);
  if (!r.ok) continue;
  const recall = r.value.metrics.recall;
  const precision = r.value.metrics.precision;
  if (recall === undefined || precision === undefined) continue;
  if (precision.gte(PRECISION_FLOOR)) {
    feasible.push({ config, recall, precision });
  }
}

feasible.sort((a, b) => {
  if (a.recall.gt(b.recall)) return -1;
  if (a.recall.lt(b.recall)) return 1;
  if (a.precision.gt(b.precision)) return -1;
  if (a.precision.lt(b.precision)) return 1;
  return 0;
});

console.log(`precision >= 0.7 的候选共 ${feasible.length} 个，Top 8（按召回率降序）:`);
for (const f of feasible.slice(0, 8)) {
  const c = f.config;
  console.log(`  recall=${f.recall} precision=${f.precision} | wTitle=${c.wTitle} wTag=${c.wTag} wContent=${c.wContent} threshold=${c.relevanceThreshold} gap=${c.scoreGapThreshold} maxTopK=${c.maxTopK}`);
}

if (feasible.length === 0) {
  console.log("�?precision >= 0.7 的候�?);
}
