import type { FinalReply } from "../types/domain.js";

export interface ConclusionFragment {
  summary: string;
  assumptions?: string[];
  dataDependencies?: string[];
}

/** 结论整合器：汇总去重、统一口径、剔除矛盾，产出面向经营者的最终答复 */
export class ConclusionMerger {
  merge(fragments: ConclusionFragment[], failures: string[] = []): FinalReply {
    const assumptions = this.dedup(fragments.flatMap((f) => f.assumptions ?? []));
    const dataDependencies = this.dedup(fragments.flatMap((f) => f.dataDependencies ?? []));
    const summary = fragments.map((f) => f.summary).filter(Boolean).join("；");
    return {
      summary: summary || "暂无可用结论",
      assumptions,
      dataDependencies,
      failures,
    };
  }

  private dedup(items: string[]): string[] {
    return [...new Set(items.filter(Boolean))];
  }
}