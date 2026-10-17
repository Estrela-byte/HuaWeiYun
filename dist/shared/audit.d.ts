export interface AuditEntry {
    traceId: string;
    tenantId: string;
    stage: string;
    status: "success" | "failed";
    message?: string;
    timestamp: string;
}
/** 审计日志：记录请求标识、企业标识、处理阶段与结果状态，追加写 */
export declare class AuditLogger {
    private entries;
    log(stage: string, status: "success" | "failed", tenantId?: string, message?: string): AuditEntry;
    all(): AuditEntry[];
}
