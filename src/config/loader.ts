import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AlertThresholds } from "../types/alert.js";

const here = dirname(fileURLToPath(import.meta.url));

/** 外置化配置加载：口径/权重/阈值以 JSON 维护，支持调整后回算 */
export function loadConfig<T>(filename: string): T {
  const raw = readFileSync(join(here, filename), "utf-8");
  return JSON.parse(raw) as T;
}

export interface WeightsConfig {
  profitability: number;
  growth: number;
  solvency: number;
  efficiency: number;
  cashflow: number;
}

export interface RiskConfig {
  marginRed: number;
  marginYellow: number;
  expenseRed: number;
  expenseYellow: number;
  turnoverRed: number;
  turnoverYellow: number;
  netMarginRed: number;
}

export function loadWeights(): WeightsConfig {
  return loadConfig<WeightsConfig>("weights.json");
}

export function loadRisk(): RiskConfig {
  return loadConfig<RiskConfig>("risk.json");
}
export function loadAlertThresholds(): AlertThresholds {
  return loadConfig<{ alert: AlertThresholds }>("thresholds.json").alert;
}