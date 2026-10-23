import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { govern } from "./index.js";
import { unify, buildDefaultDictionary, DEFAULT_TAX_RATE } from "./metric-dictionary.js";
function rec(partial) {
    const { amount, ...rest } = partial;
    return {
        source: "file",
        bizDate: "2024-01-05",
        amount: Decimal.fromString(amount),
        caliber: "tax_inclusive",
        currency: "CNY",
        category: "revenue",
        dimensions: {},
        ...rest,
    };
}
test("口径统一：含税换算为不含税", () => {
    const records = [rec({ amount: "113" })];
    const unified = unify(records, buildDefaultDictionary(), { targetCaliber: "tax_exclusive", taxRate: DEFAULT_TAX_RATE });
    const expected = Decimal.fromString("113").div(Decimal.fromInt(1).add(DEFAULT_TAX_RATE), 4);
    assert.ok(unified.records[0].amount.eq(expected));
    assert.equal(unified.records[0].caliberNormalized, "tax_exclusive");
});
test("质量分级：完整数据为 A 级", () => {
    const g = govern([rec({ amount: "1000" }), rec({ amount: "600", category: "cost" })]);
    assert.equal(g.grade.level, "A");
});
test("质量分级：口径冲突为 C 级", () => {
    const g = govern([
        rec({ amount: "1000" }),
        rec({ amount: "500", currency: "XXX" }),
    ]);
    assert.equal(g.grade.level, "C");
});
test("质量分级：合理性异常为 B 级", () => {
    const g = govern([
        rec({ amount: "1000" }),
        rec({ amount: "-500", category: "revenue" }),
    ]);
    assert.equal(g.grade.level, "B");
});
test("溯源记录 ID 唯一", () => {
    const g = govern([rec({ amount: "1000" })]);
    assert.ok(g.provenance.id.length > 0);
    assert.equal(g.unified.records[0].provenanceRef, g.provenance.id);
});
//# sourceMappingURL=govern.test.js.map