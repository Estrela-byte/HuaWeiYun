// ============ 预警提醒 ============

export type AlertLevel = "info" | "warning" | "critical";

export type AlertType =
  | "cost_ratio" // 成本占比超阈值
  | "revenue_drop" // 营收环比下降超阈值
  | "no_transaction" // 连续无流水
  | "margin_below"; // 毛利率低于下限

/** 预警阈值（外置化配置，字符串便于与 JSON 对齐） */
export interface AlertThresholds {
  costRatioMax: string; // 成本占比上限，如 "0.40"
  revenueFluctuation: string; // 收入波动容忍度，如 "0.05"
  grossMarginMin: string; // 毛利下限，如 "0.30"
  noTransactionDays: number; // 连续无流水天数，如 1
}

export interface Alert {
  id: string;
  level: AlertLevel;
  type: AlertType;
  title: string;
  detail: string;
  value: string; // 实际值
  threshold: string; // 触发阈值
  basis: string; // 判定依据
  timestamp: string; // ISO 8601
}

/** 通知消息与推送通道（占位接口，不真正对接微信） */
export interface Notification {
  title: string;
  message: string;
  level: AlertLevel;
  channel: string; // "wechat" | "log" | ...
  timestamp: string;
}

export interface Notifier {
  send(notification: Notification): void;
}