# AGENTS.md

<!-- project-knowledge-sync:managed-agents:start -->

## 项目边界

- 这是《大前端与AI实战》的「费曼学习平台」，目前完成第 1–10 课：根目录是 Node.js 后端，`feynman-platform-frontend/` 是 React 前端，`whisper-service/` 是本机 AI 服务（第 7.5 课的 Whisper 语音识别 + 第 10 课的 bge-base-zh-v1.5 向量化）。目录名 `Android` 不代表包含 Android 客户端。
- `要求文档/` 是原始需求证据，只读保留；实现冲突以 `docs/usage-and-design.md` 和 `docs/openapi.yaml` 中记录的统一契约为准。
- 第 10 课完成知识库建库与检索（`vectorStoreService`、`/api/rag/*`）；第 11 课以后的知识库问答、知识图谱、3D、桌面端尚未实现，不要描述为已完成。
- 向量化（2026-10-27）：原定用本地 Ollama，但 Ollama 导入的 bge-m3、Qwen3-Embedding 中文相似度失常（无关句子比相关句子分数还高），改为在 whisper-service 里用 transformers 加载 bge-base-zh-v1.5。向量存 MongoDB，不用 HNSWLib。
- AI 选型（2026-10-26 楠定）：语音识别用本地 Whisper 替代百度；大模型 DeepSeek 为主、本地 Ollama（qwen2.5:7b）备用，统一走 OpenAI 兼容接口（`src/services/llmService.js`）。模型文件在 `F:\AI-models\`，不进仓库。
- 提交信息用中文，不加 AI 署名；每课完成后打 `lesson-N` 标签并推送到私有仓库 `starrism123/feynman-learning-platform`。

## 架构与契约

- 使用 CommonJS。`src/app.js` 只创建应用，`src/server.js` 管理数据库和监听端口。
- `scripts/start-learning-demo.js` 复用真实 `createApp()`，只为教学管理临时 MongoDB、API 和 `examples/ajax-demo/` 静态页；不得复制或分叉业务路由。
- 保持 route、controller、validator、model、middleware、config 分层；不要把新业务堆回 `app.js`。
- 正式契约为 `/api/users/*`、Bearer Token、`username`、PATCH；继续兼容旧路径、`name`、`x-auth-token`、PUT，除非做显式破坏性版本变更。
- 所有知识点查询必须按当前认证用户隔离；更新字段采用白名单。密码不得出现在查询默认值、响应或日志中。
- API 变化必须同步 `docs/openapi.yaml`、Postman 集合、测试和使用文档。
- 测试里不真实调用大模型或 Whisper：用 `jest.spyOn(llmService, "chatJson")`、`jest.spyOn(speechService, "transcribe")`、`jest.spyOn(embeddingService, "embed")` 替换，后台向量化由 `tests/helpers/env.js` 设 `RAG_INDEXING=off` 关闭；控制器因此要通过模块对象调用（`llmService.chatJson(...)`），不要解构导入。
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
