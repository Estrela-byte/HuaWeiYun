import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { checkDiscriminability } from "./index.js";

test("checkDiscriminability: recall 不可计算 → incomputable", () => {
  const r = checkDiscriminability(undefined, Decimal.fromString("0.8"));
  assert.equal(r.discriminable, false);
  assert.equal(r.reason, "incomputable");
});

test("checkDiscriminability: recall=1 且 precision=1 → perfect_score", () => {
  const r = checkDiscriminability(Decimal.fromInt(1), Decimal.fromInt(1));
  assert.equal(r.discriminable, false);
  assert.equal(r.reason, "perfect_score");
});

test("checkDiscriminability: recall=0 → all_zero", () => {
  const r = checkDiscriminability(Decimal.fromInt(0), Decimal.fromInt(0));
  assert.equal(r.discriminable, false);
  assert.equal(r.reason, "all_zero");
});

test("checkDiscriminability: 其余 → ok", () => {
  const r = checkDiscriminability(Decimal.fromString("0.7"), Decimal.fromString("0.875"));
  assert.equal(r.discriminable, true);
  assert.equal(r.reason, "ok");
});