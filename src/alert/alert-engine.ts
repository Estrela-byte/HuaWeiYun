import { randomUUID } from "node:crypto";
import type { Alert, AlertLevel, AlertThresholds, AlertType, Notifier } from "../types/alert.js";
import type { IndicatorSet, RecordCategory, UnifiedData } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";
import { monthlyAggregate } from "../business-analysis/trend.js";

const ZERO = Decimal.zero(2);

/** 与预警截图对齐的默认阈值：成本占比 40% / 收入波动 5% / 毛利下限 30% / 无流水 1 天 */
export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  costRatioMax: "0.40",
  revenueFluctuation: "0.05",
  grossMarginMin: "0.30",
  noTransactionDays: 1,
};

function sum(unified: UnifiedData, category: RecordCategory): Decimal {
  return unified.records
    .filter((r) => r.category === category)
    .reduce((acc, r) => acc.add(r.amount), ZERO);
}

function toPct(ratio: Decimal): string {
  return `${ratio.mul(Decimal.fromInt(100)).round(1).toString()}%`;
}

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 数据日期范围内的无流水天数（存在空档日期即视为无流水） */
export function missingTransactionDays(unified: UnifiedData): number {
  const dates = new Set(unified.records.map((r) => r.bizDate));
  const sorted = [...dates].sort();
  if (sorted.length < 2) return 0;

  const start = new Date(sorted[0] ?? "");
  const end = new Date(sorted[sorted.length - 1] ?? "");
  let missing = 0;
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    if (!dates.has(iso(d))) missing++;
  }
  return missing;
}

/** 预警引擎：四类规则（成本占比 / 营收环比 / 无流水 / 毛利下限），阈值外置化 */
export class AlertEngine {
  constructor(
    private readonly thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS,
    private readonly notifier?: Notifier,
  ) {}

  check(unified: UnifiedData, indicators: IndicatorSet, now: Date = new Date()): Alert[] {
    const t = this.thresholds;
    const costRatioMax = Decimal.fromString(t.costRatioMax);
    const revenueFluctuation = Decimal.fromString(t.revenueFluctuation);
    const grossMarginMin = Decimal.fromString(t.grossMarginMin);

    const alerts: Alert[] = [];

    // 1. 成本占比超阈值
    const revenue = sum(unified, "revenue");
    const cost = sum(unified, "cost");
    if (!revenue.isZero()) {
      const costRatio = cost.div(revenue, 6);
      if (costRatio.gt(costRatioMax)) {
        alerts.push(
          this.make(
            "cost_ratio",
            "warning",
            "成本占比超阈值",
            `成本占比 ${toPct(costRatio)} 超过上限 ${toPct(costRatioMax)}`,
            costRatio.toString(),
            costRatioMax.toString(),
            "costRatio = cost / revenue",
            now,
          ),
        );
      }
    }

    // 2. 营收环比下降超波动容忍度
    const months = monthlyAggregate(unified);
    const keys = [...months.keys()].sort();
    if (keys.length >= 2) {
      const prevKey = keys[keys.length - 2];
      const currKey = keys[keys.length - 1];
      if (prevKey !== undefined && currKey !== undefined) {
        const prev = months.get(prevKey);
        const curr = months.get(currKey);
        if (prev && curr && !prev.revenue.isZero()) {
          const change = curr.revenue.sub(prev.revenue).div(prev.revenue, 6);
          if (change.isNegative() && change.abs().gt(revenueFluctuation)) {
            alerts.push(
              this.make(
                "revenue_drop",
                "warning",
                "营收环比下降超阈值",
                `营收环比下降 ${toPct(change.abs())}，超过波动容忍 ${toPct(revenueFluctuation)}`,
                change.toString(),
                `-${revenueFluctuation.toString()}`,
                "revenue 环比变动超阈值",
                now,
              ),
            );
          }
        }
      }
    }

    // 3. 无流水检测
    const missing = missingTransactionDays(unified);
    if (missing >= t.noTransactionDays) {
      alerts.push(
        this.make(
          "no_transaction",
          "warning",
          "存在无流水日期",
          `数据范围内有 ${missing} 天无经营流水`,
          String(missing),
          String(t.noTransactionDays),
          "bizDate 空档天数超阈值",
          now,
        ),
      );
    }

    // 4. 毛利率低于下限
    const grossMargin = indicators.indicators.find((i) => i.name === "grossMargin")?.value;
    if (grossMargin && grossMargin.lt(grossMarginMin)) {
      alerts.push(
        this.make(
          "margin_below",
          "warning",
          "毛利率低于下限",
          `毛利率 ${grossMargin.toString()} 低于下限 ${grossMarginMin.toString()}`,
          grossMargin.toString(),
          grossMarginMin.toString(),
          "grossMargin 低于阈值",
          now,
        ),
      );
    }

    // 占位推送
    for (const a of alerts) {
      this.notifier?.send({
        title: a.title,
        message: a.detail,
        level: a.level,
        channel: "wechat",
        timestamp: a.timestamp,
      });
    }

    return alerts;
  }

  private make(
    type: AlertType,
    level: AlertLevel,
    title: string,
    detail: string,
    value: string,
    threshold: string,
    basis: string,
    now: Date,
  ): Alert {
    return {
      id: randomUUID(),
      level,
      type,
      title,
      detail,
      value,
      threshold,
      basis,
      timestamp: now.toISOString(),
    };
  }
}