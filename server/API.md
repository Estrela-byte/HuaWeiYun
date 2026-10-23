# SME-I Manager · 接口契约 v0.1

> 给前端同学：**这是唯一以本文档为准的接口约定。** 有改动我会在这里更新并通知。

- 基址：`http://<ECS公网IP>:3000`（本地 `http://127.0.0.1:3000`）
- 鉴权：除 `/api/auth/login` 和 `/api/health` 外，全部需要
  `Authorization: Bearer <token>`
- 金额：返回的金额字段**已经是「元」**（数字），不需要再除 100
- 时间：月份 `YYYY-MM`，日期 `YYYY-MM-DD`
- 错误：统一 `{ "error": "...", "message": "..." }`

---

## 接口总表（共 39 个 = 38 个业务接口 + 1 个健康检查）

> 按模块：认证 3｜记账 7｜采集 3｜分类 2｜商品 4｜分析 5｜问答 1｜预警 5｜票据 3｜系统 5｜健康检查 1

| 模块 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 系统 | GET | `/api/health` | 健康检查（无需鉴权） |
| 认证 | POST | `/api/auth/login` | 登录 |
| | GET | `/api/auth/me` | 当前用户 |
| | POST | `/api/auth/logout` | 登出 |
| 记账 | GET | `/api/transactions` | 交易列表（分页） |
| | GET | `/api/transactions/summary` | **四张卡汇总** |
| | GET | `/api/transactions/pending` | 待确认列表 |
| | POST | `/api/transactions` | 手工录入 |
| | PUT | `/api/transactions/:id` | 修改 |
| | DELETE | `/api/transactions/:id` | 删除 |
| | POST | `/api/transactions/:id/confirm` | 人工确认归类 |
| 采集 | POST | `/api/import/bills` | **上传账单 CSV** |
| | GET | `/api/import` | 导入历史 |
| | GET | `/api/import/:jobId` | 导入结果 |
| 分类 | GET | `/api/categories` | 分类列表 |
| | POST | `/api/categories` | 新建分类 |
| 商品 | GET | `/api/products` | 商品列表（含毛利率） |
| | POST | `/api/products` | 新建商品 |
| | PUT | `/api/products/:id` | 修改 |
| | DELETE | `/api/products/:id` | 删除 |
| 分析 | GET | `/api/analytics/overview` | **四张卡 + 环比同比** |
| | GET | `/api/analytics/trend` | 营收趋势折线 |
| | GET | `/api/analytics/cost-structure` | 成本结构饼图 |
| | GET | `/api/analytics/product-margin` | 商品毛利 |
| | GET | `/api/analytics/compare` | 同环比表 |
| 问答 | POST | `/api/ai/ask` | **智能问答** |
| 预警 | GET | `/api/alerts` | 预警列表 |
| | GET/PUT | `/api/alerts/settings` | 阈值设置 |
| | POST | `/api/alerts/:id/ignore` | 忽略 |
| | GET | `/api/alerts/unread-count` | 未读数（小红点） |
| 票据 | POST | `/api/ocr/receipt` | 票据识别 |
| | POST | `/api/ocr/receipt/:id/confirm` | 确认入账 |
| | GET | `/api/ocr/receipts` | 票据历史 |
| 系统 | GET | `/api/system/members` | 成员列表 |
| | POST | `/api/system/members/invite` | 邀请成员（老板） |
| | PUT | `/api/system/members/:id` | 改角色（老板） |
| | POST | `/api/system/backup` | 备份（老板） |
| | GET | `/api/system/export` | 导出 |

---

## 1. 认证

### POST `/api/auth/login`
```json
// 请求
{ "phone": "13800000001", "password": "123456" }
// 返回 200
{
  "token": "1.b98371b074c6bca72fc326f172e48c1a",
  "user": { "id": 1, "name": "张总", "role": "owner", "phone": "13800000001", "industry": "餐饮" }
}
```
`role`：`owner`（老板，全部权限）/ `staff`（店员，不能改系统设置）

### GET `/api/auth/me` → `{ "user": {...} }`

---

## 2. 记账管理

### GET `/api/transactions/summary?month=2026-06` —— 顶部四张卡
```json
{
  "month": "2026-06",
  "revenue": 128400,      // 本月收入
  "cost": 82150,          // 本月支出
  "profit": 46250,        // 毛利
  "margin": 36,           // 毛利率(%)
  "pendingCount": 34      // 待归类笔数
}
```

### GET `/api/transactions?month=&type=&category=&source=&status=&page=&size=`
- `status` 默认 `confirmed`；传 `all` 看全部，`pending` 看待确认
```json
{
  "items": [{
    "id": 133, "date": "2026-06-29", "type": "income", "amount": 5560.4,
    "category": "营业收入", "categoryId": 1, "summary": "门店营业额",
    "note": null, "source": "manual", "status": "confirmed"
  }],
  "total": 39, "page": 1, "size": 20
}
```
`source`：`manual` / `wechat` / `alipay` / `ocr`

### GET `/api/transactions/pending?size=50` → `{ "items": [...] }`（结构同上）

### POST `/api/transactions` —— 手工录入
```json
{ "date": "2026-06-15", "type": "expense", "amount": 128.5,
  "category": "原材料", "summary": "采购珍珠奶茶原料", "note": "" }
```
返回 201 + 单条交易对象。`amount` 传「元」，可以带小数。

### POST `/api/transactions/:id/confirm` —— 人工确认归类
```json
{ "category": "原材料" }   // category 省略则沿用原分类
```
返回更新后的交易对象。

### PUT `/api/transactions/:id` / DELETE `/api/transactions/:id`

---

## 3. 数据采集（账单导入）

### POST `/api/import/bills?platform=wechat|alipay`
**不是 multipart，是原始字节！**

```http
POST /api/import/bills?platform=wechat
Content-Type: application/octet-stream
X-Filename: 微信支付账单.csv

<文件原始字节>
```

前端发送方式（浏览器里读文件内容再发）：
```js
const buf = await file.arrayBuffer();
const res = await fetch(`/api/import/bills?platform=wechat`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
  body: buf,
});
```

返回 201：
```json
{
  "jobId": 1,
  "total": 5,          // 共 5 笔
  "categorized": 2,    // 自动分类成功
  "pending": 3,        // 待确认
  "skipped": 1,        // 跳过（不计收支/汇总行）
  "encoding": "utf-8", // 自动探测的编码（支付宝一般是 gbk）
  "headerLine": 17     // 表头在第几行
}
```
对应「数据采集」页的「共 486 笔 / 自动分类 452 笔 / 待确认 34 笔」。

### GET `/api/import` → `{ "items": [导入历史] }`
### GET `/api/import/:jobId` → 单条导入记录

---

## 4. 经营分析

### GET `/api/analytics/overview?month=2026-06`
```json
{
  "month": "2026-06",
  "revenue": 128400, "cost": 82150, "profit": 46250, "margin": 36,
  "mom": { "revenue": -5, "cost": -0.2, "profit": -12.5, "margin": -3.1 },
  "yoy": { "revenue": -1.8, "cost": 2.8, "profit": -9.1, "margin": -2.9 },
  "prev": { "month": "2026-05", "revenue": 135200, "cost": 82337, "profit": 52863, "margin": 39.1 },
  "pendingCount": 34
}
```
> `mom.margin` / `yoy.margin` 是**百分点差**（−3.1 表示降低 3.1 个点），不是百分比。

### GET `/api/analytics/trend?from=2026-01&to=2026-06`
```json
{ "from": "2026-01", "to": "2026-06",
  "items": [{ "month": "2026-01", "revenue": 112000, "cost": 74000, "profit": 38000 }] }
```

### GET `/api/analytics/cost-structure?month=2026-06`
```json
{ "month": "2026-06", "total": 82150,
  "items": [
    { "name": "原材料", "amount": 36900, "ratio": 44.9 },
    { "name": "人工",   "amount": 18073, "ratio": 22 },
    { "name": "房租",   "amount": 14787, "ratio": 18 },
    { "name": "其他",   "amount": 12390, "ratio": 15.1 }
  ] }
```

### GET `/api/analytics/product-margin`
```json
{ "items": [
  { "id": 1, "name": "招牌奶茶", "price": 18, "cost": 6.84, "margin": 62 },
  { "id": 2, "name": "双人套餐", "price": 68, "cost": 35.36, "margin": 48 },
  { "id": 3, "name": "咖啡",     "price": 16, "cost": 4.64,  "margin": 71 }
] }
```

### GET `/api/analytics/compare?month=2026-06` → 同环比表

---

## 5. 智能问答

### POST `/api/ai/ask`
```json
// 请求
{ "question": "为什么这个月利润下降？", "month": "2026-06" }
```
```json
// 返回
{
  "month": "2026-06",
  "question": "为什么这个月利润下降？",
  "answer": "主要有 3 个原因：\n• 营业额下降 5%\n• 原材料成本上涨 12.2%\n• 毛利率下降 3.1 个点",
  "suggestion": "原材料成本上涨而收入未同步增长，建议先与该类供应商议价…",
  "basis": [
    { "label": "营业额", "month": "2026-06", "current": 128400, "prev": 135200, "mom": -5 },
    { "label": "成本",   "month": "2026-06", "current": 82150,  "prev": 82337,  "mom": -0.2 },
    { "label": "利润",   "month": "2026-06", "current": 46250,  "prev": 52863,  "mom": -12.5 },
    { "label": "毛利率", "month": "2026-06", "current": 36,     "prev": 39.1,   "mom": -3.1 }
  ],
  "costStructure": { "month": "2026-06", "total": 82150, "items": [...] },
  "costDelta": [
    { "name": "原材料", "current": 36900, "prev": 32900, "mom": 12.2 },
    { "name": "人工",   "current": 18073, "prev": 18073, "mom": 0 },
    { "name": "房租",   "current": 14787, "prev": 14787, "mom": 0 },
    { "name": "其他",   "current": 12390, "prev": 16577, "mom": -25.3 }
  ],
  "engine": "rule-based",       // 或模型名，如 "deepseek-chat"
  "actions": ["看细节", "对比上月", "出报告"]
}
```

> `basis` 就是效果图右侧**「计算依据」**那块，直接渲染即可。
> `engine` 为 `rule-based` 表示没配大模型 Key，走的是内置规则引擎。

---

## 6. 预警提醒

### GET `/api/alerts?status=open`
```json
{ "openCount": 3,
  "items": [
    { "id": 1, "type": "cost_ratio", "level": "high",
      "title": "原材料成本占比 45%", "detail": "已连续 2 周超标",
      "threshold": "阈值 40%", "status": "open", "pushed_at": "今天 09:20" }
  ] }
```
`level`：`high`（红）/ `medium`（黄）/ `info`（蓝）

### GET `/api/alerts/settings`
```json
{ "user_id": 1, "cost_ratio": 40, "revenue_volatility": 5, "margin_floor": 30 }
```

### PUT `/api/alerts/settings`
```json
{ "cost_ratio": 40, "revenue_volatility": 5, "margin_floor": 30 }
```

### POST `/api/alerts/:id/ignore` → `{ "ok": true }`
### GET `/api/alerts/unread-count` → `{ "count": 3 }`

---

## 7. 票据识别

### POST `/api/ocr/receipt`
```http
POST /api/ocr/receipt
Content-Type: application/octet-stream
X-Filename: receipt.jpg

<图片原始字节>
```
```json
// 返回 201
{
  "id": 1,
  "merchant": "悦茶饮品店",
  "date": "2026-06-15",
  "amount": 128.5,
  "category": "原材料",
  "note": "珍珠奶茶 ×2",
  "confidence": { "merchant": 98, "date": 99, "amount": 97, "category": 96, "note": 94 }
}
```
> ⚠️ 当前是**占位实现**（返回固定结果）。接真 OCR 后字段完全不变，前端不用改。

### POST `/api/ocr/receipt/:id/confirm` → `{ "ok": true, "receiptId": 1, "transactionId": 182 }`
可传 `{ date, amount, summary, note }` 覆盖识别结果（对应「手动修正」）。

### GET `/api/ocr/receipts` → 票据历史

---

## 8. 系统管理

### GET `/api/system/members` → 成员列表
### POST `/api/system/members/invite`（owner）
```json
{ "name": "王店员", "phone": "13800000003", "password": "123456", "role": "staff" }
```
### PUT `/api/system/members/:id`（owner）
```json
{ "role": "owner" }
```
### POST `/api/system/backup`（owner）
```json
{ "ok": true, "at": "2026-10-22T10:13:53.013Z",
  "file": "backup-1792664033014.json", "size": 68307,
  "tables": { "users": 2, "transactions": 189, "products": 3, "alerts": 3 } }
```
### GET `/api/system/export?format=csv&month=2026-06`
返回 CSV 文件流（带 BOM，Excel 打开不乱码）。
`format=xlsx|pdf` 目前**降级为 CSV**，响应头带 `X-Warning` 说明。

---

## 状态码约定

| 码 | 含义 |
|---|---|
| 200 / 201 | 成功 / 创建成功 |
| 400 | 参数错误（`bad_request` / `bad_csv`） |
| 401 | 未登录或 token 失效（`unauthorized`） |
| 403 | 权限不足（`forbidden`，如店员做老板操作） |
| 404 | 资源不存在（`not_found`） |
| 409 | 冲突（`conflict`，如重复确认入账） |
| 500 | 服务端异常（`internal_error`） |
