import { Decimal } from "../types/decimal.js";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function scoreOf(value, reference, max) {
    if (reference <= 0)
        return 0;
    const ratio = value.div(new Decimal(BigInt(Math.round(reference * 100)), 0), 6).toNumber();
    return clamp(Math.round(ratio * max), 0, 100);
}
/** 五维度健康度评分器，各维度独立 0-100 分，加权合成总评 */
export class HealthScorer {
    score(indicators, weights = DEFAULT_WEIGHTS) {
        const v = (name) => indicators.indicators.find((i) => i.name === name)?.value;
        const dims = [];
        // 盈利能力：净利率与毛利率综合
        const netMargin = v("netMargin");
        const grossMargin = v("grossMargin");
        const profitability = this.profitability(netMargin, grossMargin);
        dims.push({ dimension: "profitability", score: profitability });
        // 成长能力：有营收为基础；缺乏同比数据时按营收规模与毛利弹性给分
        const revenue = v("revenue");
        const growth = this.growth(revenue, grossMargin);
        dims.push({ dimension: "growth", score: growth });
        // 偿债能力：现金流为正、应收可控
        const cashflow = v("operatingCashflow");
        const receivable = v("receivableTurnover");
        const solvency = this.solvency(cashflow, receivable);
        dims.push({ dimension: "solvency", score: solvency });
        // 运营效率：应收与库存周转
        const inventory = v("inventoryTurnover");
        const efficiency = this.efficiency(receivable, inventory);
        dims.push({ dimension: "efficiency", score: efficiency });
        // 现金流安全
        const cashflowScore = this.cashflowScore(cashflow);
        dims.push({ dimension: "cashflow", score: cashflowScore });
        let total = 0;
        let weightSum = 0;
        for (const d of dims) {
            const w = weights[d.dimension] ?? 0.2;
            total += d.score * w;
            weightSum += w;
        }
        const totalScore = weightSum > 0 ? Math.round((total / weightSum) * 10) / 10 : 0;
        return { dimensionScores: dims, totalScore };
    }
    profitability(netMargin, grossMargin) {
        if (!netMargin && !grossMargin)
            return 0;
        const parts = [];
        if (netMargin)
            parts.push(scoreOf(netMargin, 0.25, 100));
        if (grossMargin)
            parts.push(scoreOf(grossMargin, 0.4, 60));
        const avg = parts.reduce((a, b) => a + b, 0) / Math.max(parts.length, 1);
        return Math.round(avg);
    }
    growth(revenue, grossMargin) {
        if (!revenue || revenue.isZero())
            return 0;
        let score = 40;
        if (grossMargin && !grossMargin.isNegative()) {
            score += clamp(Math.round(grossMargin.div(new Decimal(5n, 2), 4).mul(new Decimal(200n, 0)).toNumber()), 0, 60);
        }
        return clamp(score, 0, 100);
    }
    solvency(cashflow, receivable) {
        let score = 50;
        if (cashflow && !cashflow.isNegative())
            score += 30;
        if (cashflow && cashflow.isNegative())
            score -= 30;
        if (receivable && receivable.gte(new Decimal(6n, 0)))
            score += 20;
        if (receivable && receivable.lt(new Decimal(3n, 0)))
            score -= 20;
        return clamp(Math.round(score), 0, 100);
    }
    efficiency(receivable, inventory) {
        const parts = [];
        if (receivable)
            parts.push(scoreOf(receivable, 10, 100));
        if (inventory)
            parts.push(scoreOf(inventory, 10, 100));
        if (parts.length === 0)
            return 0;
        return clamp(Math.round(parts.reduce((a, b) => a + b, 0) / parts.length), 0, 100);
    }
    cashflowScore(cashflow) {
        if (!cashflow)
            return 50;
        if (cashflow.isZero())
            return 50;
        return cashflow.isNegative() ? 20 : 80;
    }
}
export const DEFAULT_WEIGHTS = {
    profitability: 0.3,
    growth: 0.2,
    solvency: 0.2,
    efficiency: 0.15,
    cashflow: 0.15,
};
//# sourceMappingURL=health-scorer.js.map