import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "./decimal.js";

test("Decimal 字符串构造与显示", () => {
  assert.equal(Decimal.fromString("123.45").toString(), "123.45");
  assert.equal(Decimal.fromString("-0.05").toString(), "-0.05");
  assert.equal(Decimal.fromString("100").toString(), "100");
});

test("Decimal 加法精度安全（0.1+0.2=0.3）", () => {
  const sum = Decimal.fromString("0.1").add(Decimal.fromString("0.2"));
  assert.equal(sum.toString(), "0.3");
});

test("Decimal 减法", () => {
  assert.equal(Decimal.fromString("1.5").sub(Decimal.fromString("0.6")).toString(), "0.9");
});

test("Decimal 乘法与除法", () => {
  assert.equal(Decimal.fromString("2.5").mul(Decimal.fromString("2")).toString(), "5.0");
  assert.equal(Decimal.fromString("3").div(Decimal.fromString("4"), 4).toString(), "0.75");
});

test("Decimal 四舍五入", () => {
  assert.equal(Decimal.fromString("1.005").round(2).toString(), "1.01");
  assert.equal(Decimal.fromString("2.345").round(2).toString(), "2.35");
});

test("Decimal 比较运算", () => {
  assert.ok(Decimal.fromString("1.01").gt(Decimal.fromString("1.0")));
  assert.ok(Decimal.fromString("1.00").eq(Decimal.fromString("1")));
});

test("Decimal 除零抛错", () => {
  assert.throws(() => Decimal.fromInt(1).div(Decimal.fromInt(0)));
});