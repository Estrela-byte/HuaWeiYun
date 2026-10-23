import { test } from "node:test";
import assert from "node:assert/strict";
import { ingest } from "./data-ingestion/index.js";
import { govern } from "./data-governance/index.js";
import { analyze, analyzeGuarded, gradeRisk } from "./financial-analysis/index.js";
import { diagnose } from "./diagnosis-engine/index.js";
import { strategize } from "./strategy-engine/index.js";

const CSV = [
  "category,bizDate,amount,caliber,currency,dim_channel",
  "revenue,2024-01-10,100000,不含税,CNY,线上",
  "revenue,2024-01-10,50000,不含税,CNY,线下",
  "cost,2024-01-10,80000,不含税,CNY,线上",
  "expense,2024-01-10,12000,不含税,CNY,运营",
].join("\n");

test("端到端流水线：数据导入→治理→财务→诊断→策略", () => {
  const ing = ingest("file", { format: "csv", filename: "e2e.csv", content: CSV });
  assert.ok(ing.ok);
  if (!ing.ok) return;

  const governed = govern(ing.value.records);
  assert.ok(governed.grade.level === "A" || governed.grade.level === "B");

  const indicators = analyzeGuarded(governed.unified, governed.grade);
  assert.ok(indicators.ok);
  if (!indicators.ok) return;

  const set = indicators.value;
  const revenue = set.indicators.find((i) => i.name === "revenue");
  assert.equal(revenue!.value.toString(), "150000");

  const risk = gradeRisk(set);
  assert.ok(risk.signals.length > 0);

  const report = diagnose(governed.unified, set);
  assert.ok(report.dimensionScores.length === 5);

  const plan = strategize(report, set);
  assert.ok(plan.ok);
  if (plan.ok) {
    assert.ok(plan.value.strategies.length > 0);
  }
});

test("C 级数据阻断：不再流向分析", () => {
  const json = JSON.stringify({
    records: [
      { category: "revenue", bizDate: "2024-01-01", amount: "1000", caliber: "含税", currency: "XXX" },
    ],
  });
  const ing = ingest("file", { format: "json", filename: "c.json", content: json });
  assert.ok(ing.ok);
  if (!ing.ok) return;
  const governed = govern(ing.value.records);
  assert.equal(governed.grade.level, "C");
  const r = analyzeGuarded(governed.unified, governed.grade);
  assert.ok(!r.ok);
  if (!r.ok) assert.equal(r.error.code, "E_LOW_CREDIBILITY");
});