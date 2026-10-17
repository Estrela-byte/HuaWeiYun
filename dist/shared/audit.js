import { randomUUID } from "node:crypto";
/** 审计日志：记录请求标识、企业标识、处理阶段与结果状态，追加写 */
export class AuditLogger {
    entries = [];
    log(stage, status, tenantId = "default", message) {
        const entry = {
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
    all() {
        return [...this.entries];
    }
}
//# sourceMappingURL=audit.js.map