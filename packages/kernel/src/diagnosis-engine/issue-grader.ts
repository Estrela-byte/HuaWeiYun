import type { IssueGrade, RootCause } from "../types/domain.js";

/**
 * 问题分级器：严重度 × 紧急度 × 可控度三维评价。
 * rank = 严重度*0.5 + 紧急度*0.3 + (10-可控度)*0.2，越高越优先。
 */
export class IssueGrader {
  grade(rootCauses: RootCause[]): IssueGrade[] {
    const issues = rootCauses.map((rc) => {
      const severity = this.severityOf(rc.layer);
      const urgency = this.urgencyOf(rc.layer);
      const controllability = this.controllabilityOf(rc.layer);
      const rank = Math.round((severity * 0.5 + urgency * 0.3 + (10 - controllability) * 0.2) * 10) / 10;
      return {
        issue: rc.description,
        severity,
        urgency,
        controllability,
        rank,
      } satisfies IssueGrade;
    });
    return issues.sort((a, b) => b.rank - a.rank);
  }

  private severityOf(layer: RootCause["layer"]): number {
    switch (layer) {
      case "funding_chain":
        return 10;
      case "cost_structure":
        return 8;
      case "channel":
        return 6;
      case "price":
        return 7;
      case "product":
        return 5;
      default:
        return 5;
    }
  }

  private urgencyOf(layer: RootCause["layer"]): number {
    switch (layer) {
      case "funding_chain":
        return 10;
      case "cost_structure":
        return 7;
      case "price":
        return 6;
      case "channel":
        return 5;
      default:
        return 4;
    }
  }

  private controllabilityOf(layer: RootCause["layer"]): number {
    switch (layer) {
      case "channel":
        return 8;
      case "cost_structure":
        return 6;
      case "price":
        return 7;
      case "product":
        return 5;
      default:
        return 4;
    }
  }
}