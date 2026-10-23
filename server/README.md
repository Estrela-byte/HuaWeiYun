# SME-I Manager · 后端数据接口

小微企业经营管理工具（SME-I Manager）的后端 API。
对应产品设计报告里的六个功能模块：数据采集、记账管理、经营分析、智能问答、预警提醒、系统管理。

- 运行时：**Node.js 22.5+**（本机 v24.21.0 已满足）
- 数据库：**Node 内置 `node:sqlite`**，零外部依赖、零配置
- 依赖：只有 `express` + `cors`
- 金额：数据库里一律存**整数分**，只在返回给前端时转「元」

---

## 一、快速开始（3 条命令）

```bash
npm install
npm run seed      # 建表 + 灌演示数据（数字已和效果图对齐）
npm start         # 默认 http://127.0.0.1:3000
```

打开 <http://127.0.0.1:3000/api/health> 看到 `{"ok":true,...}` 就成功了。

### 演示账号

| 姓名 | 手机号 | 密码 | 角色 |
|---|---|---|---|
| 张总 | 13800000001 | 123456 | owner（老板） |
| 李会计 | 13800000002 | 123456 | staff（店员） |

```bash
# 登录拿 token
curl -X POST http://127.0.0.1:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800000001","password":"123456"}'
```

### 演示数据核对（可直接拿去对效果图）

```
2026-06  营业额 128,400   成本 82,150   利润 46,250   毛利率 36.0%
2026-05  营业额 135,200   成本 82,337   利润 52,863   毛利率 39.1%
环比：营业额 -5.0%   原材料 +12.2%   毛利率 -3.1 个点
同比：营业额 -1.8%
待归类 34 笔
成本结构：原材料 44.9% / 人工 22.0% / 房租 18.0% / 其他 15.1%
商品毛利：招牌奶茶 62% / 双人套餐 48% / 咖啡 71%
```

---

## 二、目录结构

```
sme-i-api/
├── src/
│   ├── index.js            # 入口：中间件 + 挂路由 + 监听
│   ├── db.js               # 建表语句 + 数据库连接（换 RDS 只改这里）
│   ├── seed.js             # 演示数据（可复现，每次生成一样）
│   ├── lib/
│   │   ├── money.js        # 分/元转换、百分比、环比
│   │   ├── metrics.js      # ★ 指标计算（收入/成本/毛利/毛利率/环比/同比）
│   │   ├── csv.js          # ★ 微信/支付宝账单解析（编码探测 + 跳过说明行）
│   │   ├── classifier.js   # 关键词自动分类
│   │   └── auth.js         # HMAC token + 鉴权中间件
│   └── routes/             # 按模块拆分的路由
│       ├── auth.js  transactions.js  import.js  categories.js  products.js
│       └── analytics.js  ai.js  alerts.js  ocr.js  system.js
├── API.md                  # ★ 接口契约（给前端队友）
├── Dockerfile              # 容器化部署
├── start.sh                # CodeArts Deploy 自定义脚本部署
├── .env.example            # 环境变量模板
└── package.json
```

---

## 三、环境变量

复制 `.env.example` 为 `.env`（**不要提交到仓库**）：

| 变量 | 必填 | 说明 |
|---|---|---|
| `PORT` | | 监听端口，默认 3000 |
| `DB_PATH` | | SQLite 文件路径，默认 `./data/sme.db` |
| `AUTH_SECRET` | ✅ 生产必改 | token 签名密钥 |
| `LLM_API_KEY` | | 不填则智能问答自动降级为内置规则引擎（**演示不需要**） |
| `LLM_BASE_URL` | | 默认 `https://api.deepseek.com/v1`（任何 OpenAI 兼容接口都行） |
| `LLM_MODEL` | | 默认 `deepseek-chat` |

> ⚠️ 加载 `.env` 需要 Node 22.7+ 的 `--env-file`，或自己装 `dotenv`。
> 最简单：启动前 `export $(grep -v '^#' .env | xargs)`，或在 CodeArts 里配成环境变量。

---

## 四、在华为云 CodeArts 上的操作

> CodeArts 是**研发工具链**，不负责运行你的接口。接口最终跑在 **ECS** 上。

### Step 1 建项目与仓库
1. CodeArts 控制台 → 新建项目 → 选「Scrum」
2. 左侧「代码托管」→ 新建仓库 → 拿到 clone 地址
3. 本地把本目录提交上去：

```bash
cd sme-i-api
git init
git add .
git commit -m "feat: 数据接口骨架（六模块 + 演示数据）"
git remote add origin <你的仓库地址>
git push -u origin master
```

### Step 2 用 CodeArts IDE Online 开发（可选）
CodeArts → 「CodeArts IDE Online」→ 新建工作空间 → 在浏览器里 clone 仓库、改代码、跑 `npm start`。
适合不想在本地配环境的场景，但**预览地址是临时的，不能当正式部署**。

### Step 3 建 ECS
1. 控制台 → 弹性云服务器 ECS → 购买（最低配 1核2G / Ubuntu 22.04 即可）
2. **安全组放行 3000 端口**（或你改的端口）
3. 装 Node：`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`
4. 挂一块数据盘给 SQLite（否则重装系统数据会丢）

### Step 4 两种部署方式

**方式 A：容器（推荐，最省心）**
```bash
docker build -t sme-i-api .
docker run -d -p 3000:3000 -v /data/sme:/app/data -e AUTH_SECRET=xxx sme-i-api
```
`-v` 挂载是**必须**的，不然容器一删数据库就没了。

**方式 B：CodeArts Deploy 自定义脚本**
用仓库里的 `start.sh`。CodeArts Deploy 的「部署」支持自定义脚本/自定义应用，把它配成启动脚本即可。
进程守护建议用 `systemd` 或 `pm2`，别用 `nohup`。

### Step 5 流水线（可选，加分项）
代码检查 → 编译构建（`npm ci` + 打 tar 或镜像）→ 部署到 ECS。
**答辩前把这条跑通一次**，答辩时演示自动化部署很加分。

---

## 五、给前端的联调约定

1. **接口基址**：`http://<ECS公网IP>:3000`，本地开发用 `http://127.0.0.1:3000`
2. **鉴权**：登录拿 `token`，之后所有请求带 `Authorization: Bearer <token>`
3. **金额**：所有金额字段已经是「元」（数字，如 `128400`），不需要再除 100
4. **月份**：统一 `YYYY-MM`（如 `2026-06`）；日期统一 `YYYY-MM-DD`
5. **列表分页**：统一返回 `{ items, total, page, size }`
6. **错误格式**：统一 `{ error, message }`，HTTP 状态码有意义（400/401/403/404/409/500）
7. **跨域**：已开 `cors()`，前端本地开发直接调，不用配代理

完整接口见 **[API.md](./API.md)**。

---

## 六、常见问题

**`npm install` 报 `EPERM` / `~/.npm` 权限不足**
以前用 `sudo npm` 留下的问题，修一次即可：
```bash
sudo chown -R $(id -u):$(id -g) ~/.npm
```
临时绕过：`npm install --cache /tmp/npm-cache`

**导入账单后中文乱码**
说明编码探测失败了。检查文件是不是从微信/支付宝**原始导出**的 CSV（不是用 Excel 另存过的）。

**导入报「找不到表头行」**
文件被 Excel 另存过会丢掉表头格式。重新从微信/支付宝导出一次。

**换了服务器后数据没了**
SQLite 是本地文件。要么挂持久化卷，要么换华为云 RDS（改 `src/db.js` 里的连接和 SQL 方言即可，上层不用动）。

**智能问答回答很死板**
那是**没配 `LLM_API_KEY` 时的规则引擎兜底**，不是模型。配上 Key 就会走大模型。

---

## 七、待办（按优先级）

- [ ] `server.js` 接入真 OCR（华为云文字识别），替换 `src/routes/ocr.js` 里的 `recognize()`
- [ ] 导出真 Excel / PDF（现在是 CSV 降级）→ 接 `exceljs` / `pdfkit`
- [ ] 预警改为定时任务自动生成（现在预警是种子数据）
- [ ] 换 RDS 时替换 `src/db.js`
- [ ] 加单元测试（`node:test` 内置，不用装依赖）
