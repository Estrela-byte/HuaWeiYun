import { test } from "node:test";
import assert from "node:assert/strict";
import { ingest } from "./index.js";

const CSV = [
  "category,bizDate,amount,caliber,currency,dim_channel",
  "revenue,2024-01-05,10000,含税,CNY,线上",
  "cost,2024-01-05,6000,含税,CNY,线上",
].join("\n");

test("CSV 解析成功并生成 batchId", () => {
  const r = ingest("file", { format: "csv", filename: "a.csv", content: CSV });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.recordCount, 2);
    assert.ok(r.value.batchId.length > 0);
  }
});

test("CSV 缺少必填列返回格式错误", () => {
  const r = ingest("file", { format: "csv", filename: "a.csv", content: "category,bizDate\nrevenue,2024-01-01" });
  assert.ok(!r.ok);
  if (!r.ok) assert.equal(r.error.code, "E_INGEST_FORMAT");
});

test("CSV 金额非法返回格式错误", () => {
  const r = ingest("file", { format: "csv", filename: "a.csv", content: "category,bizDate,amount,caliber,currency\nrevenue,2024-01-01,abc,含税,CNY" });
  assert.ok(!r.ok);
  if (!r.ok) assert.equal(r.error.code, "E_INGEST_FORMAT");
});

test("JSON 解析成功", () => {
  const json = JSON.stringify({
    records: [
      { category: "revenue", bizDate: "2024-02-01", amount: "5000", caliber: "不含税", currency: "CNY", dimensions: { product: "A" } },
    ],
  });
  const r = ingest("manual", { format: "json", filename: "b.json", content: json });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.recordCount, 1);
});

test("非法 JSON 返回格式错误", () => {
  const r = ingest("file", { format: "json", filename: "b.json", content: "{not valid" });
  assert.ok(!r.ok);
  if (!r.ok) assert.equal(r.error.code, "E_INGEST_FORMAT");
});

test("不支持格式返回错误", () => {
  const r = ingest("file", { format: "xml" as never, filename: "c.xml", content: "" });
  assert.ok(!r.ok);
});