import { Decimal } from "../types/decimal.js";
import { buildDefaultDictionary } from "../data-governance/metric-dictionary.js";
const ZERO = Decimal.zero(2);
/** 指标计算器：纯确定性函数，每个指标附公式、口径、时点与可信度 */
export class IndicatorCalculator {
    dictionary;
    caliber;
    constructor(dictionary = buildDefaultDictionary()) {
        this.dictionary = dictionary;
        this.caliber = dictionary.revenue?.caliber ?? { tax: "tax_exclusive", includeDepreciation: false, description: "" };
    }
    analyze(unified, credibility = "A") {
        const period = this.periodOf(unified);
        const indicators = [];
        const skipped = [];
        const revenue = this.sum(unified, "revenue");
        const cost = this.sum(unified, "cost");
        const expense = this.sum(unified, "expense");
        const receivable = this.sum(unified, "receivable");
        const inventory = this.sum(unified, "inventory");
        const operatingCashflow = this.sum(unified, "cashflow_operating");
        const grossProfit = revenue.sub(cost);
        const netProfit = grossProfit.sub(expense);
        const push = (name, value, unit, formula) => {
            indicators.push({
                name,
                value: value.round(4),
                unit,
                formula,
                caliber: this.caliber,
                period,
                credibility,
            });
        };
        const skip = (name, reason) => skipped.push({ name, reason });
        push("revenue", revenue, "CNY", "revenue = Σ amount[category=revenue]");
        push("grossProfit", grossProfit, "CNY", "grossProfit = revenue - cost");
        push("operatingCashflow", operatingCashflow, "CNY", "operatingCashflow = Σ amount[category=cashflow_operating]");
        this.ratio(push, skip, revenue, grossProfit, "grossMargin", "grossMargin = grossProfit / revenue");
        this.ratio(push, skip, revenue, netProfit, "netMargin", "netMargin = netProfit / revenue");
        this.ratio(push, skip, revenue, expense, "expenseRatio", "expenseRatio = expense / revenue");
        this.turnover(push, skip, revenue, receivable, "receivableTurnover", "receivableTurnover = revenue / receivable");
        this.turnover(push, skip, cost, inventory, "inventoryTurnover", "inventoryTurnover = cost / inventory");
        // 盈亏平衡点 = 期间费用 / 毛利率（近似固定成本口径）
        const gpRatio = revenue.isZero() ? ZERO : grossProfit.div(revenue, 6);
        if (gpRatio.isZero()) {
            skip("breakEvenPoint", "毛利率为零，无法计算盈亏平衡点");
        }
        else {
            push("breakEvenPoint", expense.div(gpRatio, 2), "CNY", "breakEvenPoint = fixedExpense / grossMargin");
        }
        return { indicators, skipped };
    }
    ratio(push, skip, denominator, numerator, name, formula) {
        if (denominator.isZero()) {
            skip(name, "分母（收入）为 0，数据不足无法计算");
            return;
        }
        push(name, numerator.div(denominator, 6), "ratio", formula);
    }
    turnover(push, skip, flow, balance, name, formula) {
        if (balance.isZero()) {
            skip(name, "期初/期末余额为 0，数据不足无法计算");
            return;
        }
        push(name, flow.div(balance, 4), "times", formula);
    }
    sum(unified, category) {
        return unified.records
            .filter((r) => r.category === category)
            .reduce((acc, r) => acc.add(r.amount), ZERO);
    }
    periodOf(unified) {
        if (unified.records.length === 0) {
            return { start: "", end: "" };
        }
        const dates = unified.records.map((r) => r.bizDate).sort();
        return { start: dates[0] ?? "", end: dates[dates.length - 1] ?? "" };
    }
}
//# sourceMappingURL=indicator-calculator.js.map