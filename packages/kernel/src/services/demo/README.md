# SME-I 演示传输层

`createDemoFetch()` 在内存中创建一份独立账本，可注入现有 API 客户端：

```js
import { createApiClient, createSmeApi } from '../api/index.js'
import { createDemoFetch } from './index.js'

const api = createSmeApi(createApiClient({
  fetchImpl: createDemoFetch(),
  getBusinessId: () => 'demo-business',
  getAccessToken: () => null,
}))
```

只有应用明确选择演示模式时才调用它。真实接口请求继续使用正常 `fetch`；网络失败不会回退到这份账本。每次调用 `createDemoFetch()` 都从同一组种子数据重新开始，状态不写入浏览器持久存储。

金额均为人民币整数分字符串，业务日期按 `YYYY-MM-DD` 查询，`endDate` 不含当天。初始 2026 年 6 月销售收入 12,840,000 分、经营支出 8,215,000 分、经营结余 4,625,000 分、结余率 `0.3602`；5 月对应为 13,520,000、8,233,680、5,286,320 分及 `0.3910`。页面将比例保留一位百分数时分别显示 36.0% 和 39.1%。经营支出由原材料、人工、房租和其他支出组成。另有一笔 6 月 5,000 元账户转账，`kind: 'transfer'`，不计入经营指标。指标名称统一使用“经营结余”，不假设未商定的会计毛利口径。

MVP 方法包括身份与主体资料、流水、分类、商品、成本归集、CSV 导入、分析、证据和问答。列表支持 `cursor`、`limit` 及相关过滤；写入更新 `meta.dataVersion`。编辑和导入行确认使用服务端返回的 `revision`，通过 `If-Match` 提交。需要幂等的写入使用 `Idempotency-Key`；同一 key 与相同内容重试只返回首次结果。

导入文件使用 `FormData` 的 `file` 字段，可用 `platform` 指定 `wechat` 或 `alipay`。演示解析 UTF-8 CSV，识别常见日期、收支、金额、业务类型、摘要和交易单号列。正式映射契约为 `{源列: 目标字段}`；演示层还兼容反向旧写法。上传只创建待核对批次；用途不明、转账语义模糊及退款先留在 `needs_review`，退款须核对原流水关系。只有用户明确勾选 `ready` 行并调用 `imports.commit` 才产生流水。可识别的交易单号用于去重；同日期同金额但不同单号保留为不同交易。确认后可通过 `jobs.get` 读取导入任务结果，并通过流水的 `source.importId`、可选 `source.importRowId` 回查来源。已入账行不可再次修正；重新映射保留其状态，演示账本还按批次和行核对，防止没有平台交易单号的行重复入账。行预览使用 `cursor`、`limit` 分页，刷新不自动勾选新行。

已有退款的原流水不能作废，也不能通过单笔修改或批量分类改为会使退款关系、分类或累计金额无效的记录。跨月退款可能让单月收入为负，比率计算会正确处理负分母。导入历史、问答会话和消息由页面按不透明 `nextCursor` 翻页；服务端不保证首页就是最新数据。

OCR、主动预警、成员、备份、导出、数据删除等扩展路径返回 HTTP 501 与 `FEATURE_NOT_AVAILABLE`，不会模拟成功。演示问答仅根据账本的确定性指标生成解释与证据，不调用模型，也不推断客流或供应商价格。

验证：

```sh
node --test src/services/demo/index.test.js
```
