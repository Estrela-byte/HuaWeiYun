import { test } from "node:test";
import assert from "node:assert/strict";
import { ingest } from "../data-ingestion/index.js";
import { govern } from "../data-governance/index.js";
import { analyze } from "../financial-analysis/index.js";
import { AlertEngine, LogNotifier } from "./index.js";

function fixture(csv: string) {
  const ing = ingest("file", { format: "csv", filename: "alert.csv", content: csv });
  assert.ok(ing.ok);
  if (!ing.ok) throw new Error("ingest failed");
  const governed = govern(ing.value.records);
  const indicators = analyze(governed.unified);
  return { unified: governed.unified, indicators };
}

test("预警：成本占比超阈值与毛利低于下限同时触发", () => {
  const csv = [
    "category,bizDate,amount,caliber,currency",
    "revenue,2024-01-10,100000,不含税,CNY",
    "cost,2024-01-10,80000,不含税,CNY",
  ].join("\n");
  const { unified, indicators } = fixture(csv);

  const alerts = new AlertEngine().check(unified, indicators);

  assert.ok(alerts.some((a) => a.type === "cost_ratio"));
  assert.ok(alerts.some((a) => a.type === "margin_below"));
});

test("预警：营收环比下降超波动容忍度触发", () => {
  const csv = [
    "category,bizDate,amount,caliber,currency",
    "revenue,2024-01-10,100000,不含税,CNY",
    "revenue,2024-02-10,90000,不含税,CNY",
  ].join("\n");
  const { unified, indicators } = fixture(csv);

  const alerts = new AlertEngine().check(unified, indicators);

  assert.ok(alerts.some((a) => a.type === "revenue_drop"));
});

test("预警：数据范围存在无流水日期触发", () => {
  const csv = [
    "category,bizDate,amount,caliber,currency",
    "revenue,2024-01-01,1000,不含税,CNY",
    "revenue,2024-01-03,1000,不含税,CNY",
  ].join("\n");
  const { unified, indicators } = fixture(csv);

  const alerts = new AlertEngine().check(unified, indicators);

  assert.ok(alerts.some((a) => a.type === "no_transaction"));
});

test("预警：通知器占位实现收到告警消息", () => {
  const csv = [
    "category,bizDate,amount,caliber,currency",
    "revenue,2024-01-10,100000,不含税,CNY",
    "cost,2024-01-10,80000,不含税,CNY",
  ].join("\n");
  const { unified, indicators } = fixture(csv);

  const notifier = new LogNotifier();
  const alerts = new AlertEngine(undefined, notifier).check(unified, indicators);

  assert.ok(alerts.length > 0);
  assert.equal(notifier.sent.length, alerts.length);
  assert.equal(notifier.sent[0]!.channel, "wechat");
});

test("预警：正常数据不触发告警", () => {
  const csv = [
    "category,bizDate,amount,caliber,currency",
    "revenue,2024-01-10,100000,不含税,CNY",
    "cost,2024-01-10,30000,不含税,CNY",
  ].join("\n");
  const { unified, indicators } = fixture(csv);

  const alerts = new AlertEngine().check(unified, indicators);

  assert.equal(alerts.length, 0);
});