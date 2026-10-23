import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { DEFAULT_CALIBRATION_TARGET, inTargetRange } from "./index.js";

test("inTargetRange: recall 与 precision 均落入区间返回 true", () => {
  assert.equal(
    inTargetRange(Decimal.fromString("0.8"), Decimal.fromString("0.8"), DEFAULT_CALIBRATION_TARGET),
    true,
  );
});

test("inTargetRange: 越上界返回 false", () => {
  assert.equal(
    inTargetRange(Decimal.fromString("0.95"), Decimal.fromString("0.8"), DEFAULT_CALIBRATION_TARGET),
    false,
  );
  assert.equal(
    inTargetRange(Decimal.fromString("0.8"), Decimal.fromString("0.95"), DEFAULT_CALIBRATION_TARGET),
    false,
  );
});

test("inTargetRange: 越下界返回 false", () => {
  assert.equal(
    inTargetRange(Decimal.fromString("0.6"), Decimal.fromString("0.8"), DEFAULT_CALIBRATION_TARGET),
    false,
  );
});

test("inTargetRange: 边界相等返回 true（闭区间）", () => {
  assert.equal(
    inTargetRange(Decimal.fromString("0.7"), Decimal.fromString("0.9"), DEFAULT_CALIBRATION_TARGET),
    true,
  );
  assert.equal(
    inTargetRange(Decimal.fromString("0.7"), Decimal.fromString("0.7"), DEFAULT_CALIBRATION_TARGET),
    true,
  );
});

test("inTargetRange: 任一指标不可计算返回 false", () => {
  assert.equal(
    inTargetRange(undefined, Decimal.fromString("0.8"), DEFAULT_CALIBRATION_TARGET),
    false,
  );
  assert.equal(
    inTargetRange(Decimal.fromString("0.8"), undefined, DEFAULT_CALIBRATION_TARGET),
    false,
  );
  assert.equal(inTargetRange(undefined, undefined, DEFAULT_CALIBRATION_TARGET), false);
});