import { test } from "node:test";
import assert from "node:assert/strict";
import { ingest } from "../data-ingestion/index.js";
import { govern } from "../data-governance/index.js";
import { analyze } from "../financial-analysis/index.js";
import { analyzeBusiness } from "./index.js";

const CSV = [
  "category,bizDate,amount,caliber,currency,dim_channel",
  "revenue,2024-01-10,100000,不含税,CNY,线上",
  "revenue,2024-01-15,50000,不含税,CNY,线下",
  "cost,2024-01-10,60000,不含税,CNY,线上",
  "cost,2024-01-15,20000,不含税,CNY,线下",
  "expense,2024-01-20,10000,不含税,CNY,运营",
  "revenue,2024-02-10,80000,不含税,CNY,线上",
  "revenue,2024-02-15,40000,不含税,CNY,线下",
  "cost,2024-02-10,50000,不含税,CNY,线上",
  "cost,2024-02-15,15000,不含税,CNY,线下",
  "expense,2024-02-20,12000,不含税,CNY,运营",
].join("\n");

function fixture() {
  const ing = ingest("file", { format: "csv", filename: "ba.csv", content: CSV });
  assert.ok(ing.ok);
  if (!ing.ok) throw new Error("ingest failed");
  const governed = govern(ing.value.records);
  const indicators = analyze(governed.unified);
  return { unified: governed.unified, indicators };
}

test("经营分析：KPI 汇总与营收趋势按月聚合", () => {
  const { unified, indicators } = fixture();
  const report = analyzeBusiness(unified, indicators);

  assert.equal(report.kpi.revenue, "270000");
  assert.equal(report.kpi.cost, "145000");
  assert.equal(report.kpi.grossProfit, "125000");

  assert.equal(report.trend.length, 2);
  assert.equal(report.trend[0]!.period, "2024-01");
  assert.equal(report.trend[0]!.revenue, "150000");
  assert.equal(report.trend[1]!.period, "2024-02");
  assert.equal(report.trend[1]!.revenue, "120000");
});

test("经营分析：成本结构按维度分解且占比合计为 1", () => {
  const { unified, indicators } = fixture();
  const report = analyzeBusiness(unified, indicators, { dimension: "channel" });

  assert.equal(report.costStructure.length, 2);
  const online = report.costStructure.find((s) => s.name === "线上");
  const offline = report.costStructure.find((s) => s.name === "线下");
  assert.ok(online);
  assert.ok(offline);
  assert.equal(online!.amount, "110000");
  assert.equal(offline!.amount, "35000");
});

test("经营分析：同环比对比识别营收下降", () => {
  const { unified, indicators } = fixture();
  const report = analyzeBusiness(unified, indicators);

  const revenueRow = report.comparison.find((r) => r.metric === "营业额");
  assert.ok(revenueRow);
  assert.equal(revenueRow!.current, "120000");
  assert.equal(revenueRow!.previous, "150000");
  assert.equal(revenueRow!.change, "-0.2");
});

test("经营分析：毛利率健康时归纳为优势", () => {
  const { unified, indicators } = fixture();
  const report = analyzeBusiness(unified, indicators);

  assert.ok(report.insights.some((i) => i.type === "strength" && i.title.includes("毛利")));
});