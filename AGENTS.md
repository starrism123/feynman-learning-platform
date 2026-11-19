# AGENTS.md

<!-- project-knowledge-sync:managed-agents:start -->

## 项目边界

- 这是《大前端与AI实战》的「费曼学习平台」，目前完成第 1–16 课：根目录是 Node.js 后端，`feynman-platform-frontend/` 是 React 前端，`whisper-service/` 是本机 AI 服务（第 7.5 课的 Whisper 语音识别 + 第 10 课的 bge-base-zh-v1.5 向量化）。目录名 `Android` 不代表包含 Android 客户端。
- `要求文档/` 是原始需求证据，只读保留；实现冲突以 `docs/usage-and-design.md` 和 `docs/openapi.yaml` 中记录的统一契约为准。
- 第 10 课完成知识库建库与检索（`vectorStoreService`、`/api/rag/*`）；第 11 课完成知识库问答（`ragService`、`/api/ai/rag-qa`、`/api/ai/rag-qa/stream`、前端 `/agent`）。第 12 课完成知识图谱（`graphService`、`/api/graph/knowledge-map`、前端 `/graph`，ECharts）。第 13 课完成 Three.js 入门（前端 `/3d-world`，共用场景代码在 `feynman-platform-frontend/src/three/knowledgeScene.js`）。第 14 课完成 3D 知识宇宙（前端 `/universe`，d3-force-3d 力导向布局，复用同一份场景代码）。第 15 课完成桌面端和 PWA：`vite build --mode electron` 出 `dist-desktop/`（相对路径 + HashRouter，不启用 PWA），Electron 主进程在 `feynman-platform-frontend/electron/main.cjs`，`electron:build` 改 exe 图标，要开 Windows 开发者模式，没开时用 `electron:build:no-icon`（`signAndEditExecutable=false`）；网页版 `npm run build` 带 vite-plugin-pwa。改路由或 vite 配置时两种模式都要构建一遍。第 16 课是总结和部署理论：`docs/project-summary.md`、`docs/deployment.md`、`docs/final-demo.md`；没有部署到云服务器，不要描述为已上线。期末实训报告（docx）不在本仓库，模板确定前不要动手。
- 改检索参数（门槛、块长、取几块、点名保底）后跑 `npm run rag:eval`，并按新数据改 `scripts/eval-retrieval.js` 里的结论。
- 向量化（2026-10-27）：原定用本地 Ollama，但 Ollama 导入的 bge-m3、Qwen3-Embedding 中文相似度失常（无关句子比相关句子分数还高），改为在 whisper-service 里用 transformers 加载 bge-base-zh-v1.5。向量存 MongoDB，不用 HNSWLib。换向量模型或升级 transformers/torch 后先跑 `npm run rag:check`；每个块存 `model` 和 `contentHash`，检索只比同模型的块，状态接口据此报告过期。同一知识点的建索引和删除通过 `vectorStoreService` 内的队列串行执行，不要绕过它直接写 `KnowledgeChunk`。
- AI 选型（2026-10-26 楠定）：语音识别用本地 Whisper 替代百度；大模型 DeepSeek 为主、本地 Ollama（qwen2.5:7b）备用，统一走 OpenAI 兼容接口（`src/services/llmService.js`）。模型文件在 `F:\1_Apps\AI\Models\`，不进仓库。
- 提交信息用中文，不加 AI 署名；每课完成后打 `lesson-N` 标签并推送到私有仓库 `starrism123/feynman-learning-platform`。

## 架构与契约

- 使用 CommonJS。`src/app.js` 只创建应用，`src/server.js` 管理数据库和监听端口。
- `scripts/start-learning-demo.js` 复用真实 `createApp()`，只为教学管理临时 MongoDB、API 和 `examples/ajax-demo/` 静态页；不得复制或分叉业务路由。
- 保持 route、controller、validator、model、middleware、config 分层；不要把新业务堆回 `app.js`。
- 正式契约为 `/api/users/*`、Bearer Token、`username`、PATCH；继续兼容旧路径、`name`、`x-auth-token`、PUT，除非做显式破坏性版本变更。
- 所有知识点查询必须按当前认证用户隔离；更新字段采用白名单。密码不得出现在查询默认值、响应或日志中。
- API 变化必须同步 `docs/openapi.yaml`、Postman 集合、测试和使用文档。
- 测试里不真实调用大模型或 Whisper：用 `jest.spyOn(llmService, "chatJson")`、`chatText`、`chatStream`、`jest.spyOn(speechService, "transcribe")`、`jest.spyOn(embeddingService, "embed")`、`jest.spyOn(embeddingService, "health")` 替换，后台向量化由 `tests/helpers/env.js` 设 `RAG_INDEXING=off` 关闭，`WHISPER_URL` 指向空端口防止误调真实服务；控制器因此要通过模块对象调用（`llmService.chatJson(...)`），不要解构导入。
- 前端有自己的 `package.json`，用 oxlint 和 `vite build` 检查；后端的 prettier、eslint 不检查前端和 `whisper-service/`。

## 必须验证

```powershell
npm run verify
```

修改 AJAX 教学页、学习启动器或相关文档时还需运行：

```powershell
npm test -- --runInBand tests/learningDemo.test.js
npm run learn:ajax
```

容器、数据库版本或启动流程变化时还需：

```powershell
docker compose up --build -d
.\scripts\smoke-test.ps1
docker compose down
```

- 测试默认使用 `mongodb-memory-server`，不依赖个人 `.env`、Atlas 或 Docker。
- 学习演示的数据和固定 JWT 密钥只在临时进程中使用；退出后清空，不得描述为持久化或生产配置。
- Mongoose 保持 8.x；升级数据库相关主版本前必须证明内存测试和 Docker 冒烟测试都通过。
- 不提交 `.env`、Token、数据库凭据或其他秘密。

<!-- project-knowledge-sync:managed-agents:end -->
