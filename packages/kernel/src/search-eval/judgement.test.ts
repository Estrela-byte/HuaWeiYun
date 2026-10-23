import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { judgePass } from "./judgement.js";
import type { EvalMetrics, EvalThresholds } from "./types.js";

const thresholds: EvalThresholds = {
  recall: Decimal.fromString("0.5"),
  precision: Decimal.fromString("0.5"),
};

function metrics(recall?: Decimal, precision?: Decimal): EvalMetrics {
  return {
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    totalRelevant: 0,
    totalReturned: 0,
    ...(recall !== undefined ? { recall } : {}),
    ...(precision !== undefined ? { precision } : {}),
  };
}

test("达标判定：两项均达标为 pass", () => {
  const j = judgePass(metrics(Decimal.fromString("0.8"), Decimal.fromString("0.8")), thresholds);
  assert.equal(j.overall, "pass");
  assert.equal(j.recallPassed, true);
  assert.equal(j.precisionPassed, true);
});

test("达标判定：两项均不达标为 fail", () => {
  const j = judgePass(metrics(Decimal.fromString("0.2"), Decimal.fromString("0.2")), thresholds);
  assert.equal(j.overall, "fail");
  assert.equal(j.recallPassed, false);
  assert.equal(j.precisionPassed, false);
});

test("达标判定：一项达标一项不达标为 partial", () => {
  const j = judgePass(metrics(Decimal.fromString("0.8"), Decimal.fromString("0.2")), thresholds);
  assert.equal(j.overall, "partial");
});

test("达标判定：指标不可计算为 incomputable", () => {
  const j = judgePass(metrics(undefined, Decimal.fromString("0.8")), thresholds);
  assert.equal(j.overall, "incomputable");
  assert.equal(j.recallPassed, undefined);
});