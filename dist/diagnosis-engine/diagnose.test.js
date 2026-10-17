import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { govern } from "../data-governance/index.js";
import { analyze } from "../financial-analysis/index.js";
import { diagnose } from "./index.js";
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
test("五维度评分与总评", () => {
    const g = govern([rec("10000", "revenue"), rec("6000", "cost"), rec("1000", "expense")]);
    const indicators = analyze(g.unified);
    const report = diagnose(g.unified, indicators);
    assert.equal(report.dimensionScores.length, 5);
    assert.ok(report.totalScore >= 0 && report.totalScore <= 100);
});
test("异常识别：低毛利产生异常信号", () => {
    const g = govern([rec("1000", "revenue"), rec("990", "cost")]);
    const indicators = analyze(g.unified);
    const report = diagnose(g.unified, indicators);
    assert.ok(report.anomalies.some((a) => a.indicator === "grossMargin"));
});
test("根因可回溯到具体指标", () => {
    const g = govern([rec("1000", "revenue"), rec("990", "cost")]);
    const indicators = analyze(g.unified);
    const report = diagnose(g.unified, indicators);
    assert.ok(report.rootCauses.length > 0);
    assert.ok(report.rootCauses.every((rc) => typeof rc.evidenceIndicator === "string"));
});
test("问题分级按严重度排序", () => {
    const g = govern([rec("1000", "revenue"), rec("990", "cost")]);
    const indicators = analyze(g.unified);
    const report = diagnose(g.unified, indicators);
    const ranks = report.issueGrades.map((i) => i.rank);
    for (let i = 0; i < ranks.length - 1; i++) {
        assert.ok(ranks[i] >= ranks[i + 1]);
    }
});
//# sourceMappingURL=diagnose.test.js.map