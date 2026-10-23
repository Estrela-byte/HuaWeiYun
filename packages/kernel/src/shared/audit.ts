import { randomUUID } from "node:crypto";

export interface AuditEntry {
  traceId: string;
  tenantId: string;
  stage: string;
  status: "success" | "failed";
  message?: string;
  timestamp: string;
}

/** 审计日志：记录请求标识、企业标识、处理阶段与结果状态，追加写 */
export class AuditLogger {
  private entries: AuditEntry[] = [];

  log(stage: string, status: "success" | "failed", tenantId = "default", message?: string): AuditEntry {
    const entry: AuditEntry = {
      traceId: randomUUID(),
      tenantId,
      stage,
      status,
      message,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  all(): AuditEntry[] {
    return [...this.entries];
  }
}