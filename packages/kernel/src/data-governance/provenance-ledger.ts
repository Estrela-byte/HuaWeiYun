import { randomUUID } from "node:crypto";
import type { DataSourceType, ProvenanceRecord } from "../types/domain.js";

/** 溯源台账：为每批数据/结论生成唯一溯源记录，支撑全链路回溯 */
export class ProvenanceLedger {
  createRecord(source: DataSourceType, batchId: string, processSteps: string[]): ProvenanceRecord {
    return {
      id: randomUUID(),
      source,
      timestamp: new Date().toISOString(),
      processSteps,
      batchId,
    };
  }
}