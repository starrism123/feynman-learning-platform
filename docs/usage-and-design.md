# 使用与设计说明

<!-- project-knowledge-sync:managed-manual:start -->

## 用户工作流

项目提供一个学习入口和两条互不依赖的验证通道：

1. `npm run learn:ajax` 同时启动真实 Express API、临时 MongoDB 和 AJAX 教学网页，适合从浏览器点击追踪到数据库；退出后练习数据清空。
2. `npm run verify` 使用临时 MongoDB，适合开发、提交前检查和没有 Docker 的课堂电脑。
3. `docker compose up --build -d` 启动应用和持久化 MongoDB，再用 `scripts/smoke-test.ps1` 验证真实 HTTP 链路。

AJAX 教学页默认位于 `127.0.0.1:5173`，API 默认位于 `127.0.0.1:3000`；可用 `LEARNING_WEB_PORT` 和 `LEARNING_API_PORT` 覆盖。API 的机器可读合同是 `docs/openapi.yaml`，运行后的交互页面位于 `/api-docs`；Postman 集合用于课堂手工演示。README 是所有学习与验收资料的入口。

## 架构与数据流

`src/app.js` 只组装 Express 应用；`src/server.js` 负责数据库生命周期与端口。路由只映射 URL，控制器组织业务，验证器处理输入，模型负责持久化，中间件承担认证与错误响应。这种分离允许 Supertest 不监听真实端口就完成集成测试。

`scripts/start-learning-demo.js` 复用 `createApp()`，并为教学单独管理临时 MongoDB、API 监听和静态网页监听。`examples/ajax-demo/` 只负责观察和调用现有合同，不定义第二套业务 API。教学 Token 仅保存在页面内存，刷新后丢失；网络失败使用前端本地错误码 `CLIENT_NETWORK_ERROR` 展示，不能误认为后端响应。

正式 API 使用 `/api/users/*`、Bearer Token、`username` 和 PATCH；为课程讲义保留旧用户路径、`name`、`x-auth-token` 和 PUT。兼容入口调用相同逻辑，不维护两套业务实现。成功和失败响应保持统一结构。

知识点所有权在数据库查询条件中同时校验 `_id` 和 `user`。未找到与越权统一返回 404，防止资源枚举。更新只允许四个业务字段，密码默认不参与 Mongoose 查询及 JSON 序列化。

## 知识库（第 10 课）

知识点创建或标题、内容修改后，`vectorStoreService.indexInBackground` 在后台把它切块、向量化，存进 `KnowledgeChunk`；接口先返回，不等向量化完成。只改状态或复习标记不会重新向量化。删除知识点时同步删除它的全部文本块。

切分先按 Markdown 标题分节，节内按段落、换行、中文句号断开，块长 300 字、重叠 50 字，每块开头带上标题路径；向量化时再拼上知识点标题。向量由本机 AI 服务（`whisper-service/app.py` 的 `/embed`，bge-base-zh-v1.5）计算并归一化，检索时用点积（即余弦相似度）逐块打分。个人知识库只有几百块，逐块计算约 50 毫秒；块数到上万再换 HNSW 等近似索引。切分方式的对比见 `docs/rag-splitter-comparison.md`。

向量化失败（例如 AI 服务没启动）只记日志，旧的块保留；之后调用 `POST /api/rag/reindex` 重建。`GET /api/rag/status` 查看每个知识点的块数和是否过期：每个块存着建索引时标题和内容的指纹（`contentHash`）和向量模型名，指纹对不上或模型和当前服务不一致，就算过期（`outdated`）。

同一个知识点的建索引和删除在进程内排队执行，每次排到时重新读数据库里的最新内容，所以连续保存两次、建索引途中删除，都不会留下重复块或孤儿块。替换时先插入新块再删旧块，插入失败时旧块完好。检索只和当前模型算出的块比较，换了向量模型要先重建。

换模型、升级依赖或换机器后，先运行 `npm run rag:check` 体检：用几组答案已知的句子检查相关句子的相似度是否明显高于无关句子。

`POST /api/rag/search` 只做检索、不调用大模型，用来观察召回结果。

## 配置与安全边界

- `MONGO_URI`、`JWT_SECRET`、`JWT_EXPIRES_IN`、`PORT` 是运行配置；JWT 密钥至少 32 个字符。
- `STUDENT_NAME`、`STUDENT_MAJOR` 只用于第一课选做接口。
- `.env` 永不提交；`.env.example` 只放占位值。
- Compose 密钥只适用于本地课程演示，公开部署必须替换并启用 HTTPS。
- 当前范围没有 Token 吊销、刷新 Token、速率限制、邮箱验证和生产监控；这些属于后续课程或生产增强，不应被描述为已实现。

## 扩展方式

新增资源时沿用 `model → validator → controller → route → app mount → tests → OpenAPI` 的顺序。需要认证的资源路由在路由层统一 `router.use(auth)`，控制器仍必须实施资源级授权。

依赖升级尤其是 Mongoose、MongoDB Driver、MongoDB Server 主版本，需要同时运行无 Docker 测试和 Docker 冒烟测试。当前教学基线固定 Mongoose 8.x，以避免已观察到的 Driver 7/内存 MongoDB 兼容问题。

## 已知限制

- 自动测试首次可能需要下载 MongoDB 二进制。
- AJAX 演示首次也可能等待临时 MongoDB 二进制下载；退出后数据不持久化。
- AJAX 演示的固定 JWT 密钥仅用于独立的临时学习进程，不得用于普通启动或公开部署。
- Docker 完整验收需要 Docker Desktop 引擎已启动。
- Atlas 账号、IP 白名单及个人密钥无法由仓库预置。
- 第 10 课只完成知识库的建库和检索；基于知识库的问答（第 11 课）、知识图谱、3D 和桌面端尚未实现。
- 向量化依赖本机 AI 服务；测试里用 `RAG_INDEXING=off` 关闭后台向量化，把 `WHISPER_URL` 指向空端口，并 mock `embeddingService.embed` 和 `embeddingService.health`。
- 建索引的排队只在一个后端进程内有效；部署成多个进程时要改用数据库锁或任务队列。
- 检索把当前用户的全部向量读进内存逐个计算，几百块约 50 毫秒；上万块时要换近似索引。
- Whisper 和向量模型在同一个 Python 进程里，转写长录音时向量化会变慢；服务挂掉时两样功能一起不可用。

<!-- project-knowledge-sync:managed-manual:end -->
