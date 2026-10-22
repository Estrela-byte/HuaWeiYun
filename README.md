# 中小型企业经济智慧管理工具（zcst-huawei-cloud）

> `smart-business-mgmt` —— 中小型企业经营智慧管理业务系统的**确定性内核库**（TypeScript）

本仓库是一组**确定性（Deterministic）经营分析内核**，以"工具（tool）"形式指派给一组专家智能体（主智能体 + 4 位专家），构成一个面向中小型企业的经营智慧管理多智能体系统。各内核模块只做一件事、做对一件事：数据接入、数据治理、财务分析、经营诊断、策略建议、任务编排、智能问答、预警、检索质量评估。

## 架构

```
诉求（自然语言）
   │  归类 / 澄清
   ▼
business-advisor（主智能体 · orchestration）
   │  任务路由 + DAG 编排
   ├──► data-steward（数据管家）──► ingest / govern
   ├──► financial-analyst（财务分析）─► analyze / scenario / business-analysis
   ├──► business-diagnostician（经营诊断师）► diagnose / alert
   └──► strategy-consultant（策略顾问）► strategize
   │
   ▼
ConclusionMerger ──► 最终结论（FinalReply）
```

**职责边界（硬约束）**：数据管家不下经营结论、诊断师不开方、主智能体不产专业结论。内核只输出确定性的数据/指标/分级/建议结构，专业结论由对应专家智能体基于内核产物生成。

**核心设计原则**

- 统一返回 `Result<T, E>`（`ok` / `err`），**不抛异常**；
- 金额计算使用精确 `Decimal` 算术，规避浮点误差；
- 阈值 / 权重 / 风险等级外置到 `src/config/*.json`，调整后可回算；
- **先审数、后算账**：C 级（低可信）数据会被 `analyzeGuarded` 阻断，不再流向分析层。

## 项目结构

```
src/
├── index.ts               # 统一出口（re-export 全部模块 + 共享设施 + 配置加载 + TOOLS 注册表）
├── data-ingestion/        # 数据接入：CSV / JSON / XLSX → 标准化原始记录
├── data-governance/       # 数据治理：校验、口径统一、质量分级（A/B/C）、溯源留痕
├── financial-analysis/    # 财务分析：指标计算、情景测算、风险分级
├── diagnosis-engine/      # 经营诊断：五维健康度评分、异常识别、根因下钻、问题分级
├── strategy-engine/       # 策略建议：方向判定、行动项量化、优先级排序
├── orchestration/         # 任务编排：诉求归类、澄清、DAG 构建与调度、结论整合
├── business-analysis/     # 经营分析：KPI、趋势、成本结构、同环比、优势/问题归纳
├── knowledge/             # 知识库：本地检索、智能问答、检索精度调优、召回守卫
├── alert/                 # 预警：交易中断 / 成本占比等规则检测 + 通知器
├── search-eval/           # 检索质量评估：召回率 / 精确度 / 混淆矩阵 / 达标判定
├── shared/                # 审计、加密、存储、调度
├── tools/                 # 工具注册表（内核接口 ↔ 专家智能体的映射）
├── types/                 # 领域类型、Result、Decimal、错误
└── config/                # 外置 JSON 配置（weights / risk / thresholds / search-precision）
```

测试（`*.test.ts`，共 21 个）分布于各模块目录，另有端到端集成测试 `src/integration.test.ts`。

---

## 模块与主入口 API

| 模块 | 专家智能体 | 主入口（`src/<module>/index.ts`） |
| --- | --- | --- |
| 数据接入 `data-ingestion` | data-steward | `ingest(sourceType, input): Result<IngestResult>` |
| 数据治理 `data-governance` | data-steward | `govern(records, options?): GovernedData` |
| 财务分析 `financial-analysis` | financial-analyst | `analyze(unified)` / `analyzeGuarded(unified, grade)` / `scenario(base, params)` / `gradeRisk(indicators)` |
| 经营诊断 `diagnosis-engine` | business-diagnostician | `diagnose(data, indicators, options?): HealthReport` |
| 经营分析 `business-analysis` | financial-analyst | `analyzeBusiness(unified, indicators, options?): BusinessAnalysisReport` |
| 策略建议 `strategy-engine` | strategy-consultant | `strategize(report, set): Result<StrategyPlan>` |
| 任务编排 `orchestration` | business-advisor | `orchestrate(requirement): Result<OrchestrationResult>`（含 `classifyTaskTypes` / `needsClarification` / `buildDag` / `executeDag`） |
| 智能问答 `knowledge` | business-advisor | `defaultKnowledgeBase()` / `answerQuestion(...)` |
| 预警 `alert` | business-diagnostician | `createAlertEngine(notifier?): AlertEngine` |
| 检索评估 `search-eval` | — | `evaluate(testSet, thresholds, search): Result<EvalReport>` |

共享设施：`AuditLogger`、`Crypto`、`Storage`、`Scheduler`；工具注册表：`TOOLS` / `toolsOf(agent)`；配置加载：`loadConfig` / `loadWeights` / `loadRisk` / `loadAlertThresholds`。

---

## 使用示例

### 端到端流水线（数据 → 治理 → 财务 → 诊断 → 策略）

```ts
import { ingest, govern, analyzeGuarded, gradeRisk, diagnose, strategize } from "smart-business-mgmt";

// 1. 接入（CSV / JSON / XLSX）
const CSV = [
  "category,bizDate,amount,caliber,currency,dim_channel",
  "revenue,2024-01-10,100000,不含税,CNY,线上",
  "revenue,2024-01-10,50000,不含税,CNY,线下",
  "cost,2024-01-10,80000,不含税,CNY,线上",
  "expense,2024-01-10,12000,不含税,CNY,运营",
].join("\n");

const ing = ingest("file", { format: "csv", filename: "data.csv", content: CSV });
if (!ing.ok) throw ing.error;

// 2. 治理（校验 → 口径统一 → 质量分级 → 溯源）
const governed = govern(ing.value.records);

// 3. 财务指标（守卫版：C 级数据阻断，不流入分析）
const set = analyzeGuarded(governed.unified, governed.grade);
if (!set.ok) throw set.error; // E_LOW_CREDIBILITY

// 4. 风险信号
const risk = gradeRisk(set.value);

// 5. 经营诊断（五维评分 → 异常 → 根因 → 问题分级）
const report = diagnose(governed.unified, set.value);

// 6. 策略建议（方向 + 行动项 + 优先级）
const plan = strategize(report, set.value);
if (plan.ok) {
  for (const s of plan.value.strategies) {
    console.log(`[${s.direction}] ${s.action}  → ${s.verifyMetric.name}`);
  }
}
```

### 任务编排（自然语言诉求 → DAG）

```ts
import { orchestrate } from "smart-business-mgmt";

const result = orchestrate("帮我对本月利润做个诊断，并给点降本增效的策略");
if (result.ok) {
  console.log("DAG:", result.value.dag.map((n) => n.routeTarget).join(" → "));
  console.log(result.value.output.summary);
} else {
  // 模糊诉求会返回澄清问题
  console.log("需要澄清:", result.error.context?.questions);
}
```

### 智能问答（本地知识库 + 检索精度控制）

```ts
import { defaultKnowledgeBase, answerQuestion } from "smart-business-mgmt";

const kb = defaultKnowledgeBase();
const answer = await answerQuestion(kb, "毛利率的定义和计算公式是什么？");
console.log(answer);
```

### 预警

```ts
import { createAlertEngine, ConsoleNotifier } from "smart-business-mgmt";

const engine = createAlertEngine(new ConsoleNotifier());
// 基于经营指标 / 交易记录触发阈值检测
```

### 检索质量评估（独立脚本 `eval-run.mjs`）

仓库根目录的 `eval-run.mjs` 演示了用 `evaluate()` 对本地知识库检索跑一轮正/负样本的召回率 / 精确度评估，并输出逐查询明细与负样本空命中检验（"正确空命中"为理想行为）。

---

## 开发

```bash
# 安装依赖（仅 TypeScript + @types/node）
npm install

# 类型检查
npm run typecheck

# 构建（tsc → dist/）
npm run build

# 运行测试（先构建，再跑 dist/**/*.test.js）
npm test
```

### 其他脚本

| 脚本 | 说明 |
| --- | --- |
| `eval-run.mjs` | 检索质量评估演示（正/负样本 → 召回率/精确度报告） |
| `scripts/generate-wiki.mjs` | 将 `DEFAULT_DOCS` 知识库文档导出为 `docs/wiki/project-knowledge/` 下的 Markdown 文件 |

---

## 测试覆盖

测试文件共 **21 个**（`*.test.ts`），覆盖：

| 领域 | 文件 | 关注点 |
| --- | --- | --- |
| 端到端 | `integration.test.ts` | 完整流水线 + C 级阻断 |
| 数据接入 | `ingest.test.ts` | CSV / JSON / XLSX 解析 |
| 数据治理 | `govern.test.ts` | 质量分级、口径统一 |
| 财务分析 | `financial-analysis/analyze.test.ts` | 指标计算、情景、风险 |
| 经营诊断 | `diagnose.test.ts` | 健康度评分、异常、根因 |
| 策略建议 | `strategize.test.ts` | 方向判定、优先级 |
| 任务编排 | `orchestrate.test.ts` | 归类、DAG 构建 |
| 知识库 | `knowledge.test.ts` / `search-*.test.ts` | 检索、精度调优、召回守卫 |
| 检索评估 | `search-eval/*.test.ts` | 指标计算、判定、报告 |
| 预警 | `alert.test.ts` | 阈值检测 |
| 经营分析 | `business-analysis/analyze.test.ts` | KPI / 趋势 / 成本结构 |
| 金额计算 | `types/decimal.test.ts` | Decimal 精度 |

---

## 技术栈

- **语言**：TypeScript 5.6（ES2022 / NodeNext）
- **运行时**：Node.js（ES Modules）
- **测试**：`node --test`（原生 Node.js test runner）
- **依赖**：无运行时依赖（`devDependencies` 仅 `typescript` + `@types/node`）
- **金额计算**：自研 `Decimal` 精确算术（无浮点误差）

---

## 许可证

私有仓库，未声明公开许可证。
