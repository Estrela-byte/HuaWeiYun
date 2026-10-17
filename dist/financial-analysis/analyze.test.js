import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { govern } from "../data-governance/index.js";
import { analyze, analyzeGuarded, gradeRisk, scenario } from "./index.js";
function unified(records) {
    return govern(records).unified;
}
function rec(amount, category) {
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
test("指标计算：收入/毛利/毛利率/净利率/费用率", () => {
    const data = unified([
        rec("10000", "revenue"),
        rec("6000", "cost"),
        rec("1000", "expense"),
    ]);
    const set = analyze(data);
    const by = (n) => set.indicators.find((i) => i.name === n)?.value.toString();
    assert.equal(by("revenue"), "10000");
    assert.equal(by("grossProfit"), "4000");
    assert.equal(by("grossMargin"), "0.4");
    assert.equal(by("netMargin"), "0.3");
    assert.equal(by("expenseRatio"), "0.1");
});
test("指标附公式与口径", () => {
    const set = analyze(unified([rec("10000", "revenue"), rec("6000", "cost")]));
    const grossMargin = set.indicators.find((i) => i.name === "grossMargin");
    assert.ok(grossMargin.formula.length > 0);
    assert.ok(grossMargin.caliber.tax === "tax_exclusive");
});
test("除零保护：收入为零时毛利率进入 skipped", () => {
    const set = analyze(unified([rec("0", "revenue")]));
    const skipped = set.skipped.find((s) => s.name === "grossMargin");
    assert.ok(skipped);
});
test("守卫：C 级数据中止计算", () => {
    // 制造 C 级：缺汇率导致口径冲突
    const c = govern([rec("1000", "revenue"), { ...rec("500", "cost"), currency: "XXX" }]);
    const r = analyzeGuarded(c.unified, c.grade);
    assert.ok(!r.ok);
    if (!r.ok)
        assert.equal(r.error.code, "E_LOW_CREDIBILITY");
});
test("情景测算：提价标注为假设", () => {
    const set = analyze(unified([rec("10000", "revenue"), rec("6000", "cost")]));
    const r = scenario(set, { lever: "price", magnitude: new Decimal(5n, 2) });
    assert.equal(r.isAssumption, true);
    assert.ok(r.projected.indicators.length > 0);
});
test("情景测算：超范围参数产生警告", () => {
    const set = analyze(unified([rec("10000", "revenue"), rec("6000", "cost")]));
    const r = scenario(set, { lever: "price", magnitude: new Decimal(50n, 2) });
    assert.ok(r.warnings.some((w) => w.level === "warning"));
});
test("风险分级：低毛利触发红色信号", () => {
    const set = analyze(unified([rec("1000", "revenue"), rec("980", "cost")]));
    const report = gradeRisk(set);
    assert.ok(report.signals.some((s) => s.level === "red"));
});
//# sourceMappingURL=analyze.test.js.map