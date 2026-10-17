import { Decimal } from "../types/decimal.js";
const OUT_OF_RANGE = new Decimal(3n, 1); // 30%
/** 情景测算引擎：基于假设参数做敏感性测算，强制标注为推断 */
export class ScenarioEngine {
    scenario(base, params) {
        const warnings = [];
        if (params.magnitude.abs().gt(OUT_OF_RANGE)) {
            warnings.push({
                level: "warning",
                message: `假设参数 ${params.magnitude.toString()} 超出常规范围，请确认是否继续`,
            });
        }
        const revenue = this.find(base, "revenue");
        const grossProfit = this.find(base, "grossProfit");
        const operatingCashflow = this.find(base, "operatingCashflow");
        const cost = revenue && grossProfit ? revenue.value.sub(grossProfit.value) : new Decimal(0n, 2);
        const magnitude = params.magnitude;
        const projectedRevenue = revenue ? this.projectRevenue(revenue, magnitude, params.lever, cost) : revenue;
        const projectedCashflow = operatingCashflow
            ? { ...operatingCashflow, value: operatingCashflow.value.mul(magnitude.add(new Decimal(1n, 0))) }
            : operatingCashflow;
        const indicators = [];
        if (revenue && projectedRevenue) {
            const newCost = params.lever === "cost"
                ? cost.mul(new Decimal(1n, 0).sub(magnitude))
                : params.lever === "customer"
                    ? cost.mul(new Decimal(1n, 0).add(magnitude))
                    : cost;
            const newGross = projectedRevenue.value.sub(newCost);
            indicators.push(...this.rebuild(revenue, projectedRevenue.value, newGross));
        }
        else if (revenue) {
            indicators.push(revenue);
        }
        if (grossProfit && !revenue) {
            indicators.push(grossProfit);
        }
        if (projectedCashflow && (params.lever === "customer")) {
            indicators.push(projectedCashflow);
        }
        return {
            projected: { indicators, skipped: base.skipped },
            isAssumption: true,
            warnings,
        };
    }
    projectRevenue(revenue, magnitude, lever, cost) {
        const factor = new Decimal(1n, 0);
        if (lever === "price") {
            const newRevenue = revenue.value.mul(factor.add(magnitude));
            return { ...revenue, value: newRevenue, formula: `revenue * (1 + ${magnitude.toString()})（提价假设）` };
        }
        if (lever === "customer") {
            const newRevenue = revenue.value.mul(factor.add(magnitude));
            return { ...revenue, value: newRevenue, formula: `revenue * (1 + ${magnitude.toString()})（扩客假设）` };
        }
        // cost 降本不影响收入
        return { ...revenue, value: revenue.value, formula: "revenue 不变（降本假设）" };
    }
    rebuild(revenue, newRevenue, newGross) {
        const out = [];
        out.push({ ...revenue, value: newRevenue, formula: `${revenue.formula}（情景调整）` });
        const grossMargin = revenue.value.isZero()
            ? new Decimal(0n, 2)
            : newGross.div(newRevenue, 6);
        out.push({
            name: "grossProfit",
            value: newGross,
            unit: "CNY",
            formula: "情景假设下 grossProfit = revenue - cost",
            caliber: revenue.caliber,
            period: revenue.period,
            credibility: revenue.credibility,
        });
        out.push({
            name: "grossMargin",
            value: grossMargin,
            unit: "ratio",
            formula: "情景假设下 grossProfit / revenue",
            caliber: revenue.caliber,
            period: revenue.period,
            credibility: revenue.credibility,
        });
        return out;
    }
    find(set, name) {
        return set.indicators.find((i) => i.name === name);
    }
}
//# sourceMappingURL=scenario-engine.js.map