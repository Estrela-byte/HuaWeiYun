import { AlertEngine, DEFAULT_ALERT_THRESHOLDS, missingTransactionDays } from "./alert-engine.js";

export { AlertEngine, DEFAULT_ALERT_THRESHOLDS, missingTransactionDays } from "./alert-engine.js";
export { LogNotifier, ConsoleNotifier } from "./notifier.js";

export type { Alert, AlertThresholds, AlertLevel, AlertType, Notification, Notifier } from "../types/alert.js";

/** 便捷入口：使用默认阈值 + 可注入的通知器 */
export function createAlertEngine(notifier?: import("../types/alert.js").Notifier): AlertEngine {
  return new AlertEngine(DEFAULT_ALERT_THRESHOLDS, notifier);
}