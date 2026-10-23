import type { IssueGrade, RootCause } from "../types/domain.js";
/**
 * 问题分级器：严重度 × 紧急度 × 可控度三维评价。
 * rank = 严重度*0.5 + 紧急度*0.3 + (10-可控度)*0.2，越高越优先。
 */
export declare class IssueGrader {
    grade(rootCauses: RootCause[]): IssueGrade[];
    private severityOf;
    private urgencyOf;
    private controllabilityOf;
}
