# baomemory

给 AI 助手用的**分层外置记忆库**。Cloudflare Workers 提供 REST + MCP 接口，Supabase（Postgres + pgvector）存数据，Workers AI 负责向量和夜间整理。全部跑在免费额度内。

## 三层记忆

| 层 | 内容 | 怎么用 |
|---|---|---|
| L1 核心 | 夜间生成的摘要 + `tier=1` 的置顶条目 | `GET /v1/context`，每次对话开头拉一次 |
| L2 细节 | 所有有效条目，带向量 | `GET /v1/memories/search?q=` 混合检索（向量 + 关键词，RRF 融合） |
| L3 归档 | 90 天未访问、重要度 ≤2 的条目 | 不进摘要，`archived=true` 时可搜 |

写入时自动去重：与最近条目相似度 ≥ 0.92 就更新原条目而不是新增。密码、私钥、API Key、银行卡号会被拒绝写入。

## 目录结构

```
src/
├── core/                    # 纯业务，零框架依赖
│   ├── domain/              # 实体与值类型
│   ├── ports/               # 适配器接口：MemoryRepository / Embedder / Summarizer / SecretGuard
│   └── services/            # 用例：remember / recall / context / manage / compact
├── adapters/                # 可插拔实现
│   ├── storage/supabase/    # Supabase（默认）
│   ├── storage/in-memory/   # 内存版（测试、本地）
│   ├── embedding/           # Workers AI · Qwen3 Embedding
│   ├── summarizer/          # Workers AI · GLM-4.7 Flash
│   ├── guard/               # 敏感信息拦截
│   └── registry.ts          # 适配器注册表（插拔点）
├── app/container.ts         # 组装依赖，每个 isolate 只建一次
├── http/                    # Hono + OpenAPI：路由、校验、鉴权、错误映射
├── mcp/                     # MCP（Streamable HTTP，无状态）
├── jobs/                    # Cron：夜间整理
└── index.ts                 # Worker 入口：fetch + scheduled
supabase/migrations/         # 建表与检索函数 SQL
test/                        # 用内存适配器跑的用例测试
```

依赖方向只有一个：`http / mcp / jobs → services → ports ← adapters`。核心层不知道 Supabase、Cloudflare 的存在。

## 接口

所有 `/v1/*` 和 `/mcp` 需要 `Authorization: Bearer <API_KEY>`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/v1/context` | L1 上下文文本 |
| GET | `/v1/memories/search?q=&limit=&tags=&archived=` | 混合检索 |
| GET | `/v1/memories?tags=&tier=&limit=` | 列表 |
| POST | `/v1/memories` | 写入 `{content, kind?, tags?, tier?, importance?, source?}` |
| GET / PATCH / DELETE | `/v1/memories/:id` | 读取 / 修改 / 删除 |
| POST | `/v1/admin/compact` | 立即整理 |
| ALL | `/mcp` | MCP 工具：`get_context` `recall` `remember` `update_memory` `forget` |
| GET | `/openapi.json` | OpenAPI 3.1 文档 |
| GET | `/health` | 健康检查 |

## 部署

1. 数据库：在 Supabase SQL Editor 运行 `supabase/migrations/*.sql`。
2. Cloudflare：Workers & Pages → 创建 → 导入 Git 仓库 → 选 `baomemory`，构建命令留空，部署命令 `npx wrangler deploy`。
3. 在 Worker 设置 → 变量和机密 中添加三个**机密**：
   - `SUPABASE_URL`：Supabase 项目地址，形如 `https://xxxx.supabase.co`
   - `API_KEY`：自己生成的 32 位以上随机字符串
   - `SUPABASE_SERVICE_KEY`：Supabase → Project Settings → API Keys → secret key
4. Cron（每天北京时间 03:00）和 AI 绑定已在 `wrangler.jsonc` 里配置好。

## 换一个适配器

1. 在 `src/adapters/<类别>/` 下实现对应 port 接口。
2. 在 `src/adapters/registry.ts` 里注册一个名字。
3. 把 `STORAGE_ADAPTER` / `EMBEDDER_ADAPTER` / `SUMMARIZER_ADAPTER` 改成这个名字。

业务代码不用动。

## 开发

```bash
pnpm install
pnpm test        # Vitest，内存适配器
pnpm typecheck   # TypeScript 7
pnpm lint        # Biome
pnpm dev         # 本地运行，需要 .dev.vars（见 .dev.vars.example）
```
