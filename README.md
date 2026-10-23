# SME-I Manager 前端框架

依据《中小型企业经济智慧管理工具软件设计报告 v6》建立的 Vue 3 + Vite 前端框架。报告一期面向微信小程序；这个仓库是 Web 页面与后续 PC 端的实现基础。两端共用业务接口契约，Vue 页面本身不能直接视为微信小程序。

完整的[项目分析与组件规范](docs/SME-I开发思路与组件规范.md)、[前后端接口对接清单](docs/前后端接口对接清单.md)、[CSS 基线示例](docs/sme-i-ui-reference.css)和[API 方法说明](src/services/api/README.md)用于分工与逐项联调。

## 本地运行

```powershell
npm install
npm run dev
```

默认是**演示模式**。页面和领域 API 均会使用显式注入的本地演示传输层，数据属于同一套可复算的 2026 年 6 月经营样本。界面会标注演示数据。演示模式的写入只在本次页面会话的内存中生效，刷新页面会重置。

运行测试和生产构建检查：

```powershell
npm test
npm run build
```

这里的 `build` 是本地静态构建检查，不会部署到生产环境。

## 与队友的服务联调

可复制 [`.env.example`](.env.example) 为 `.env.local`，把它改为以下**非敏感**配置，然后重启开发服务器：

```dotenv
VITE_API_MODE=live
VITE_API_BASE_URL=/api/v1
```

也可将 `VITE_API_BASE_URL` 指向队友确认的测试环境地址。`live` 模式只请求真实 API，网络失败不会静默显示演示成功。`src/App.vue` 使用 `createApiClient` 和 `createSmeApi` 装配全部领域方法；组件只依赖 `api.*`，因此路径或云函数适配集中放在 `src/services/api`。当前登录协议仍要与队友按 Web/小程序接入方式确认：客户端预留 `getAccessToken` 回调，也支持同源会话 Cookie。模型 API Key、密码、长期令牌等**不要**放进任何 `VITE_` 环境变量，也不要写入代码或日志。

客户端约定成功响应 `{ data, meta }`，失败响应 `{ error, meta }`；日期范围结束日期不含当天；金额为正的分整数字符串，收支方向单独传。导入确认、创建流水等操作由页面生成一次幂等键，重试同一操作复用；编辑携带 revision。服务端必须验证经营主体权限，并承担正式数据解析、去重、指标计算和 AI 解释。

若采用直接打开 `/app/analytics` 等路由，部署测试环境时需要把未知路径回退到 `index.html`。本仓库使用浏览器 History API 完成小型路由，未引入未在当前项目验证的新库。

## 目录与阶段

- `src/views/`：落地页、总览、数据采集、记账、分析、问答，以及扩展阶段的预警和系统管理视图。
- `src/components/` 和 `src/styles/`：应用框架、公共组件与响应式样式。
- `src/services/api/`：各模块接口与请求、金额、状态类型契约。
- `src/services/demo/`：显式演示模式的可复算样本；不作为生产数据源。
- `src/app/`：浏览器路由与日期查询上下文。

MVP 的开发和验收主线是“录账或导入 → 分类确认 → 指标与图表 → 有依据的智能问答”。票据 OCR、主动预警、成员权限、备份和导出按报告后续阶段预留接口与页面位置。界面上需要服务端真实结果的状态仅在对接后才会显示成功。
