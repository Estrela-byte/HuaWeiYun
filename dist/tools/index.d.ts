import type { AgentName } from "../types/domain.js";
export interface ToolDefinition {
    name: string;
    agent: AgentName;
    description: string;
    module: string;
}
/**
 * 工具注册表：将确定性内核接口以工具形式指派给对应专家智能体，
 * 严守"数据管家不下经营结论、诊断师不开方、主智能体不产专业结论"边界。
 */
export declare const TOOLS: ToolDefinition[];
export declare function toolsOf(agent: AgentName): ToolDefinition[];
