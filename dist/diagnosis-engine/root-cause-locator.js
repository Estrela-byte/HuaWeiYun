import { Decimal } from "../types/decimal.js";
/** 根因定位器：决策树下钻，从现象定位到市场/产品/价格/渠道/成本结构/资金链层 */
export class RootCauseLocator {
    locate(anomalies, indicators) {
        const v = (name) => indicators.indicators.find((i) => i.name === name)?.value;
        const causes = [];
        for (const a of anomalies) {
            // "数据不足"类异常不编造经营根因
            if (a.indicator === "trend" || a.indicator === "benchmark") {
                causes.push({
                    anomalyIndicator: a.indicator,
                    description: "缺少历史或基准数据，根因待补数",
                    evidenceIndicator: "revenue",
                    layer: "market",
                });
                continue;
            }
            switch (a.indicator) {
                case "grossMargin": {
                    const revenue = v("revenue");
                    causes.push({
                        anomalyIndicator: "grossMargin",
                        description: revenue && revenue.isZero()
                            ? "收入为零，毛利率异常源于经营停滞"
                            : "毛利下滑指向成本结构偏高或产品/渠道定价能力不足",
                        evidenceIndicator: "revenue",
                        layer: "cost_structure",
                    });
                    break;
                }
                case "netMargin": {
                    const expense = v("expenseRatio");
                    causes.push({
                        anomalyIndicator: "netMargin",
                        description: expense && expense.gt(new Decimal(5n, 1))
                            ? "净利率为负主因是期间费用失控"
                            : "净利率为负源于毛利不足或费用过高",
                        evidenceIndicator: "expenseRatio",
                        layer: "cost_structure",
                    });
                    break;
                }
                case "expenseRatio": {
                    causes.push({
                        anomalyIndicator: "expenseRatio",
                        description: "费用率偏高，指向费用管控或渠道投入效率不足",
                        evidenceIndicator: "expenseRatio",
                        layer: "channel",
                    });
                    break;
                }
                default: {
                    causes.push({
                        anomalyIndicator: a.indicator,
                        description: `异常 ${a.indicator} 需结合更多维度数据下钻`,
                        evidenceIndicator: a.indicator,
                        layer: "market",
                    });
                }
            }
        }
        return causes;
    }
}
//# sourceMappingURL=root-cause-locator.js.map