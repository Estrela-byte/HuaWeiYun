import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import {
  DEFAULT_SEARCH_PRECISION_CONFIG,
  loadSearchPrecisionConfig,
  validateSearchConfig,
} from "./search-precision-config.js";

function cfg(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    wTitle: "20",
    wTag: "8",
    wContent: "1",
    relevanceThreshold: "9",
    scoreGapThreshold: "50",
    maxTopK: 5,
    ...overrides,
  };
}

test("配置校验：合规配置通过", () => {
  const r = validateSearchConfig(cfg());
  assert.equal(r.ok, true);
});

test("配置校验：权重非正返回 E_SEARCH_WEIGHT_INVALID", () => {
  const r = validateSearchConfig(cfg({ wTitle: "0" }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "E_SEARCH_WEIGHT_INVALID");
  }
});

test("配置校验：区分度倒序返回错误", () => {
  const r = validateSearchConfig(cfg({ wTitle: "5", wTag: "8" }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "E_SEARCH_WEIGHT_INVALID");
  }
});

test("配置校验：阈值负返回 E_SEARCH_THRESHOLD_MISSING", () => {
  const r = validateSearchConfig(cfg({ relevanceThreshold: "-1" }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "E_SEARCH_THRESHOLD_MISSING");
  }
});

test("配置校验：maxTopK 越界返回错误", () => {
  const r0 = validateSearchConfig(cfg({ maxTopK: 0 }));
  assert.equal(r0.ok, false);
  const r11 = validateSearchConfig(cfg({ maxTopK: 11 }));
  assert.equal(r11.ok, false);
  const rFrac = validateSearchConfig(cfg({ maxTopK: 3.5 }));
  assert.equal(rFrac.ok, false);
});

test("配置校验：断层参数非正返回 E_SEARCH_GAP_PARAM_MISSING", () => {
  const r = validateSearchConfig(cfg({ scoreGapThreshold: "0" }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "E_SEARCH_GAP_PARAM_MISSING");
  }
});

test("配置校验：数字形态权重可解析", () => {
  const r = validateSearchConfig({
    wTitle: 20,
    wTag: 8,
    wContent: 1,
    relevanceThreshold: 9,
    scoreGapThreshold: 50,
    maxTopK: 5,
  });
  assert.equal(r.ok, true);
});

test("加载配置：返回字段正确（从 JSON 或回退默认一致）", () => {
  const c = loadSearchPrecisionConfig();
  assert.ok(c.wTitle.eq(Decimal.fromInt(20)));
  assert.ok(c.wTag.eq(Decimal.fromInt(8)));
  assert.ok(c.wContent.eq(Decimal.fromInt(1)));
  assert.ok(c.relevanceThreshold.eq(Decimal.fromInt(9)));
  assert.ok(c.scoreGapThreshold.eq(Decimal.fromInt(50)));
  assert.equal(c.maxTopK, 5);
});

test("默认配置字段正确", () => {
  const c = DEFAULT_SEARCH_PRECISION_CONFIG;
  assert.ok(c.wTitle.gt(c.wTag));
  assert.ok(c.wTag.gt(c.wContent));
  assert.equal(c.maxTopK, 5);
});