# SME-I Manager 数据接口（39 个）

基址 `http://<IP>:3000`　鉴权 `Authorization: Bearer <token>`　金额单位「元」　月份 `YYYY-MM`　⭐=MVP 核心

| # | 模块 | 方法 | 路径 | 用途 |
|---|---|---|---|---|
| 1 | 系统 | GET | `/api/health` | 健康检查（免鉴权） |
| 2 | 认证 | POST | `/api/auth/login` | 登录，返回 token |
| 3 | 认证 | GET | `/api/auth/me` | 当前用户与角色 |
| 4 | 认证 | POST | `/api/auth/logout` | 登出 |
| 5 | 记账 | GET | `/api/transactions` | 流水列表（分页+筛选） |
| 6 | 记账 | GET | ⭐ `/api/transactions/summary` | 汇总：收入/支出/毛利/待归类 |
| 7 | 记账 | GET | `/api/transactions/pending` | 待确认列表 |
| 8 | 记账 | POST | ⭐ `/api/transactions` | 手工录入 |
| 9 | 记账 | PUT | `/api/transactions/:id` | 修改 |
| 10 | 记账 | DELETE | `/api/transactions/:id` | 删除 |
| 11 | 记账 | POST | ⭐ `/api/transactions/:id/confirm` | 人工确认归类 |
| 12 | 采集 | POST | ⭐ `/api/import/bills` | 上传账单 CSV（微信 UTF-8 / 支付宝 GBK） |
| 13 | 采集 | GET | `/api/import` | 导入历史 |
| 14 | 采集 | GET | `/api/import/:jobId` | 单次导入结果 |
| 15 | 分类 | GET | `/api/categories` | 分类列表 |
| 16 | 分类 | POST | `/api/categories` | 新建分类 |
| 17 | 商品 | GET | `/api/products` | 商品列表（含毛利率） |
| 18 | 商品 | POST | `/api/products` | 新建 |
| 19 | 商品 | PUT | `/api/products/:id` | 修改 |
| 20 | 商品 | DELETE | `/api/products/:id` | 删除 |
| 21 | 分析 | GET | ⭐ `/api/analytics/overview` | 四张卡 + 环比 + 同比 |
| 22 | 分析 | GET | ⭐ `/api/analytics/trend` | 营收趋势折线 |
| 23 | 分析 | GET | ⭐ `/api/analytics/cost-structure` | 成本结构饼图 |
| 24 | 分析 | GET | `/api/analytics/product-margin` | 商品毛利 |
| 25 | 分析 | GET | `/api/analytics/compare` | 同环比对比表 |
| 26 | 问答 | POST | ⭐ `/api/ai/ask` | 智能问答（归因+建议+计算依据） |
| 27 | 预警 | GET | `/api/alerts` | 预警列表 |
| 28 | 预警 | GET | `/api/alerts/settings` | 读阈值 |
| 29 | 预警 | PUT | `/api/alerts/settings` | 改阈值 |
| 30 | 预警 | POST | `/api/alerts/:id/ignore` | 忽略预警 |
| 31 | 预警 | GET | `/api/alerts/unread-count` | 未读数 |
| 32 | 票据 | POST | `/api/ocr/receipt` | 票据识别（占位实现） |
| 33 | 票据 | POST | `/api/ocr/receipt/:id/confirm` | 确认入账 |
| 34 | 票据 | GET | `/api/ocr/receipts` | 票据历史 |
| 35 | 系统 | GET | `/api/system/members` | 成员列表 |
| 36 | 系统 | POST | `/api/system/members/invite` | 邀请成员（老板） |
| 37 | 系统 | PUT | `/api/system/members/:id` | 改角色（老板） |
| 38 | 系统 | POST | `/api/system/backup` | 全库备份（老板） |
| 39 | 系统 | GET | `/api/system/export` | 导出 CSV |

**模块分布**：认证 3｜记账 7｜采集 3｜分类 2｜商品 4｜分析 5｜问答 1｜预警 5｜票据 3｜系统 5｜健康检查 1 = **39**

**数据表 7 张**：`users` `categories` `transactions` `products` `alerts` `alert_settings` `receipts`（另 `import_jobs` 记导入任务）
金额一律存整数「分」，前端拿到的是「元」。
