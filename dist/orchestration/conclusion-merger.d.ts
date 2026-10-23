import type { FinalReply } from "../types/domain.js";
export interface ConclusionFragment {
    summary: string;
    assumptions?: string[];
    dataDependencies?: string[];
}
/** 结论整合器：汇总去重、统一口径、剔除矛盾，产出面向经营者的最终答复 */
export declare class ConclusionMerger {
    merge(fragments: ConclusionFragment[], failures?: string[]): FinalReply;
    private dedup;
}
