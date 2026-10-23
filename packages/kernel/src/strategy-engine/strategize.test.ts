import { test } from "node:test";
import assert from "node:assert/strict";
import type { HealthReport, IndicatorSet, RawRecord } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";
import { govern } from "../data-governance/index.js";
import { analyze } from "../financial-analysis/index.js";
import { diagnose } from "../diagnosis-engine/index.js";
import { strategize } from "./index.js";

function rec(amount: string, category: RawRecord["category"]): RawRecord {
  return {
    source: "file",
    bizDate: "2024-01-05",
    amount: Decimal.fromString(amount),
    caliber: "tax_exclusive",
    currency: "CNY",
    category,
    dimensions: {},
  };
}

test("无诊断结论拒绝开方", () => {
  const empty: HealthReport = { dimensionScores: [], totalScore: 0, anomalies: [], rootCauses: [], issueGrades: [] };
  const emptySet: IndicatorSet = { indicators: [], skipped: [] };
  const r = strategize(empty, emptySet);
  assert.ok(!r.ok);
  if (!r.ok) assert.equal(r.error.code, "E_NO_DIAGNOSIS");
});

test("有诊断结论生成策略并四因素排序", () => {
  const g = govern([rec("1000", "revenue"), rec("990", "cost"), rec("200", "expense")]);
  const indicators = analyze(g.unified);
  const report = diagnose(g.unified, indicators);
  const r = strategize(report, indicators);
  assert.ok(r.ok);
  if (r.ok) {
    assert.ok(r.value.strategies.length > 0);
    for (let i = 0; i < r.value.strategies.length - 1; i++) {
      assert.ok(r.value.strategies[i]!.priorityScore >= r.value.strategies[i + 1]!.priorityScore);
    }
    assert.ok(r.value.strategies.every((s) => s.verifyMetric.name.length > 0));
    assert.ok(r.value.strategies.every((s) => s.quantified.benefit !== undefined));
  }
});