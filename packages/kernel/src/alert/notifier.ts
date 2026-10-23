import type { Notification, Notifier } from "../types/alert.js";

/** 占位通知器：消息存入内存，便于测试与后续替换为真实微信推送 */
export class LogNotifier implements Notifier {
  readonly sent: Notification[] = [];

  send(notification: Notification): void {
    this.sent.push(notification);
  }
}

/** 控制台通知器：占位实现，仅打印日志，不真正对接微信 */
export class ConsoleNotifier implements Notifier {
  send(notification: Notification): void {
    console.log(
      `[alert:${notification.level}] ${notification.title}: ${notification.message} (channel=${notification.channel})`,
    );
  }
}