# SME-I Manager 数据接口说明

小微企业经济智慧管理工具（SME-I Manager）后端 API。Node.js 24 + Express 4 + node:sqlite（Node 内置），依赖仅 2 个。共 **39 个接口**。

## 一、接口总表（39 个）

基址 `http://<IP>:3000`｜鉴权 `Authorization: Bearer <token>`｜金额单位「元」｜月份 `YYYY-MM`｜⭐ = 核心接口

| # | 模块 | 方法 | 路径 | 用途 |
|---|---|---|---|---|
| 1 | 系统 | GET | `/api/health` | 健康检查（免鉴权） |
| 2 | 认证 | POST | `/api/auth/login` | 登录，返回 token |
| 3 | 认证 | GET | `/api/auth/me` | 当前用户与角色 |
| 4 | 认证 | POST | `/api/auth/logout` | 登出 |
| 5 | 记账 | GET | ⭐ `/api/transactions/summary` | 汇总：收入/支出/毛利/待归类 |
| 6 | 记账 | GET | `/api/transactions/pending` | 待确认列表 |
| 7 | 记账 | GET | `/api/transactions` | 流水列表（分页+筛选） |
| 8 | 记账 | POST | ⭐ `/api/transactions` | 手工录入 |
| 9 | 记账 | POST | ⭐ `/api/transactions/:id/confirm` | 人工确认归类 |
| 10 | 记账 | PUT | `/api/transactions/:id` | 修改 |
| 11 | 记账 | DELETE | `/api/transactions/:id` | 删除 |
| 12 | 采集 | POST | ⭐ `/api/import/bills` | 上传账单 CSV（微信/支付宝） |
| 13 | 采集 | GET | `/api/import` | 导入历史 |
| 14 | 采集 | GET | `/api/import/:jobId` | 单次导入结果 |
| 15 | 分类 | GET | `/api/categories` | 分类列表 |
| 16 | 分类 | POST | `/api/categories` | 新建分类 |
| 17 | 商品 | GET | `/api/products` | 商品列表（含毛利率） |
| 18 | 商品 | POST | `/api/products` | 新建 |
| 19 | 商品 | PUT | `/api/products/:id` | 修改 |
| 20 | 商品 | DELETE | `/api/products/:id` | 删除 |
| 21 | 分析 | GET | ⭐ `/api/analytics/overview` | 四张卡 + 环比 + 同比 |
| 22 | 分析 | GET | ⭐ `/api/analytics/trend` | 营收趋势 |
| 23 | 分析 | GET | ⭐ `/api/analytics/cost-structure` | 成本结构 |
| 24 | 分析 | GET | `/api/analytics/product-margin` | 商品毛利 |
| 25 | 分析 | GET | `/api/analytics/compare` | 同环比对比表 |
| 26 | 问答 | POST | ⭐ `/api/ai/ask` | 智能问答（归因+建议+依据） |
| 27 | 预警 | GET | `/api/alerts` | 预警列表 |
| 28 | 预警 | GET | `/api/alerts/settings` | 读阈值 |
| 29 | 预警 | PUT | `/api/alerts/settings` | 改阈值 |
| 30 | 预警 | POST | `/api/alerts/:id/ignore` | 忽略预警 |
| 31 | 预警 | GET | `/api/alerts/unread-count` | 未读数 |
| 32 | 票据 | POST | `/api/ocr/receipt` | 票据识别 |
| 33 | 票据 | POST | `/api/ocr/receipt/:id/confirm` | 确认入账 |
| 34 | 票据 | GET | `/api/ocr/receipts` | 票据历史 |
| 35 | 系统 | GET | `/api/system/members` | 成员列表 |
| 36 | 系统 | POST | `/api/system/members/invite` | 邀请成员（老板） |
| 37 | 系统 | PUT | `/api/system/members/:id` | 改角色（老板） |
| 38 | 系统 | POST | `/api/system/backup` | 全库备份（老板） |
| 39 | 系统 | GET | `/api/system/export` | 导出 CSV |

## 二、模块职责

| 模块 | 接口数 | 职责 |
|---|---|---|
| 认证 | 3 | HMAC 签名 token；老板 / 店员两级权限 |
| 记账 | 7 | 交易增删改查、月度汇总、待确认归类 |
| 采集 | 3 | 微信 / 支付宝账单导入、自动分类、导入记录 |
| 分类 | 2 | 收支科目维护 |
| 商品 | 4 | 商品售价成本、单品毛利率 |
| 分析 | 5 | 收入 / 成本 / 利润 / 毛利率、环比同比、趋势、成本结构 |
| 问答 | 1 | 自然语言提问 → 归因 + 建议 + 计算依据 |
| 预警 | 5 | 阈值设置、预警列表、忽略、未读数 |
| 票据 | 3 | 票据识别 → 确认入账 |
| 系统 | 5 | 成员权限、全库备份、数据导出 |

## 三、数据表

| 表 | 关键字段 | 说明 |
|---|---|---|
| `users` | `name, phone, role, password_hash` | 老板 / 店员 |
| `categories` | `name, kind` | 收支科目 |
| `transactions` | `date, type, amount_cents, category_id, source, status` | 核心表，记账明细 |
| `products` | `name, price_cents, cost_cents` | 商品与成本价 |
| `alerts` | `type, level, title, threshold, status` | 预警记录 |
| `alert_settings` | `cost_ratio, revenue_volatility, margin_floor` | 预警阈值 |
| `receipts` | `merchant, date, amount_cents, category, confidence_json` | 票据识别结果 |
| `import_jobs` | `platform, total, categorized, pending` | 导入任务记录 |

金额一律存**整数分**（`amount_cents`），仅在返回前端时转「元」，避免浮点误差。

## 四、关键技术点

1. **账单编码自动识别**：微信导出是 UTF-8 带 BOM、前约 16 行说明；支付宝是 GBK、前约 24 行说明。先严格试 UTF-8，失败按 GBK 解码，再扫描前 80 行定位表头。
2. **先算数、再解释**：所有指标由后端 SQL 算出，作为上下文注入大模型，模型只做归因与语言组织，不参与计算，避免编造数字。
3. **金额整数化**：全链路用「分」存储与计算，杜绝 `0.1 + 0.2` 类误差。
4. **无 API Key 可演示**：智能问答内置规则引擎兜底，断网或未配置模型时仍能给出基于真实数据的结论。

## 五、运行与部署

```bash
npm install && npm run seed && npm start   # 默认 3000 端口
```

环境变量：`PORT`、`DB_PATH`、`AUTH_SECRET`（必改为随机串）、`LLM_API_KEY`（可选）。
容器部署需挂载 `data/` 目录持久化 SQLite；换华为云 RDS 时只需改 `src/db.js`。

## 六、已知边界

| 项 | 现状 |
|---|---|
| 票据 OCR | 接口与入账链路完整，`recognize()` 为占位实现（返回固定结果），接云 OCR 只改此函数 |
| 导出 | `format=csv` 真实可用；`xlsx` / `pdf` 暂降级为 CSV |
| 预警 | 数据模型与接口完整，规则定时计算属扩展阶段 |
