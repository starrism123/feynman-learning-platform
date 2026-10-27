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

## 知识库问答（第 11 课）

前端「AI 助手」页面调用 `POST /api/ai/rag-qa/stream`；不需要流式时可调 `POST /api/ai/rag-qa`。流程在 `src/services/ragService.js`：

1. 检索：取当前用户最相关的最多 4 块。相似度低于 0.3 的丢掉；但知识点标题里的英文术语被问题点名时（如「JWT、bcrypt 和 CORS 各解决什么」），这个知识点最相关的一块一定入选，否则一句话问几个概念时会漏掉。
2. 一块都没有：直接回答「知识库里没有」，不调用大模型。
3. 拼提示词：资料放在 `<context>` 里、每条带编号，问题放在 `<question>` 里；系统提示要求只用资料、句末标来源编号、资料不足就说没有。讲义把这种带标签的写法叫「MCP」，它其实只是结构化提示词，和 Model Context Protocol 不是一回事。
4. 生成：走 `llmService`，DeepSeek 优先、本地 Ollama 兜底。流式输出时，还没吐出第一个字就失败才换下一个模型；吐到一半失败就推送 error 事件，不换模型从头说。

流式接口用 SSE 格式：先推 `sources`，再推若干 `token`，最后 `done` 或 `error`。浏览器的 EventSource 只能发 GET、不能带 Authorization 头，所以前端用 fetch 读 `response.body` 的流（`feynman-platform-frontend/src/api/ragStream.js`），并用 TextDecoder 按流解码，避免汉字被拆到两个数据包里时乱码。用户点「停止」或离开页面时，前端中止请求，后端随之中止对大模型的请求。

门槛 0.3、块长 300 和「标题点名保底」都来自 `npm run rag:eval` 的实测，数据和取舍见 `docs/rag-retrieval-eval.md`。0.3–0.45 之间有答案和没答案的问题分数重叠，门槛分不开，靠提示词让模型自己判断。

## 知识图谱（第 12 课）

前端「知识图谱」页调用 `GET /api/graph/knowledge-map`（`src/services/graphService.js`），用 ECharts 的力导向关系图展示。节点是当前用户的知识点，内容越长节点越大；边有两种：

- 引用边（`type: "reference"`，黑色实线箭头）：A 的正文里出现了 B 的完整标题，讲义的规则。
- 相似边（`type: "similar"`，蓝色虚线，第 12 课挑战）：每个知识点的向量取它所有块向量的平均；两个知识点互相排在对方最相似的前 2 名里才连线，`score` 是余弦相似度。

不用「相似度超过某个分数就连线」，是因为实测 8 个演示知识点两两相似度全在 0.46–0.69 之间（都是技术笔记，向量有一大块公共成分），分数线很难定，换一批笔记还要重调；「互为前 K 名」只看排名，也能避免一个泛泛的知识点和所有点都连上。还没建向量索引的知识点显示为灰色，不参与相似连线。

ECharts 的提示框按 HTML 渲染，知识点标题会先用 `format.encodeHTML` 转义。图表库较大，图谱页按需加载，打开时才下载 ECharts。

## 3D 视界（第 13 课）

前端「3D 视界」页（`/3d-world`）用 Three.js 把知识图谱的数据放进三维空间，有两个模式：

- 入门：旋转立方体。Three.js 的最小程序：场景（Scene）、透视相机（PerspectiveCamera）、渲染器（WebGLRenderer），再加一个网格（Mesh = 几何体 + 材质），每一帧转一点。
- 知识宇宙：知识点是球（随机撒在 200×200×200 的空间里，内容越长球越大），图谱的两种边画成线段；节点名用 CSS2DRenderer 叠成 HTML 标签。鼠标悬停时用 Raycaster 从相机穿过鼠标位置发射线，碰到的球变橙色，和它相连的线、邻居一起高亮（第 13 课挑战）。

场景代码在 `feynman-platform-frontend/src/three/knowledgeScene.js`，第 14 课会复用。几个容易踩的点：

- React 开发模式会把 `useEffect` 执行两次，组件卸载时必须调用 `dispose()`：停动画循环、释放几何体和材质、移除画布，否则画布叠两层、显存一直涨。
- 鼠标坐标要按画布自己的 `getBoundingClientRect()` 换算成 -1 到 1，不能用窗口大小，画布不占满窗口时会拾取偏。
- 节点标签用 `textContent` 填，不拼 HTML。
- Three.js 约 560 KB（gzip 后约 140 KB），页面按需加载。

## 知识宇宙（第 14 课）

前端「知识宇宙」页（`/universe`）和 3D 视界用同一份场景代码，区别只在节点位置：不再随机撒点，而是交给 d3-force-3d 做三维力导向布局。

- 三种力：连线是弹簧（`forceLink`，距离 70），把有引用或相似关系的知识点拉近；节点互相排斥（`forceManyBody`，强度 -160），避免重叠；中心力（`forceCenter`）把整体拉回原点。
- 连线用的是第 12 课图谱接口的两种边，所以「内容相似」的知识点会自然聚在一起（第 14 课挑战：节点关系来自向量相似度）。
- d3 默认用自己的定时器推进模拟，这里调用 `.stop()` 停掉，改在 Three.js 的动画循环里每帧 `tick()` 一步，模拟稳定（`alpha < alphaMin`）后不再挪动节点。d3 会改写传入的对象，所以传的是节点和边的副本。
- 点击选中（挑战）：用 Raycaster 拾取，选中的星球变橙色，邻居变浅蓝，相连的线高亮，其余星球和线变暗；页面下方显示知识点名、相连数量和打开链接。点空白处取消。按下到抬起移动超过 5 像素算拖动视角，不触发选中。
- 讲义的模板用 CesiumJS 做地球场景；这里按讲义正文用 Three.js + d3-force-3d，没有引入 Cesium。选中信息只用一行文字展示，没有做浮层（约定跳过的挑战）。

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
- 第 11 课的问答是单轮的，不记上下文：追问「那它呢」时检索不到上一轮说的东西。桌面端和 PWA 尚未实现。
- 知识图谱每次请求都重新计算两两相似度，知识点到几百个时（几万对）会明显变慢，届时要缓存或只算近邻。演示数据只有一条引用边（「跨域与 CORS」正文提到「JWT 登录认证」）。
- 「标题点名保底」只对标题里有英文术语的知识点生效；纯中文的概念名一句话问多个时，仍可能漏掉一部分。
- 向量化依赖本机 AI 服务；测试里用 `RAG_INDEXING=off` 关闭后台向量化，把 `WHISPER_URL` 指向空端口，并 mock `embeddingService.embed` 和 `embeddingService.health`。
- 建索引的排队只在一个后端进程内有效；部署成多个进程时要改用数据库锁或任务队列。
- 检索把当前用户的全部向量读进内存逐个计算，几百块约 50 毫秒；上万块时要换近似索引。
- Whisper 和向量模型在同一个 Python 进程里，转写长录音时向量化会变慢；服务挂掉时两样功能一起不可用。

<!-- project-knowledge-sync:managed-manual:end -->
