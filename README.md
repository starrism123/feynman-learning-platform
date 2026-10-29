# 费曼学习平台：第 1–16 课完整实践

本项目是《大前端与AI实战》的课程项目：用户写下知识点，用自己的话录音复述，AI 转写、点评打分，再出题测评。目录名虽然是 `Android`，实际是 Node.js 后端 + React 前端 + Python 语音识别服务。

| 部分         | 目录                                                    | 技术                                                             | 对应课次     |
| ------------ | ------------------------------------------------------- | ---------------------------------------------------------------- | ------------ |
| 后端         | `src/`                                                  | Express 5、MongoDB/Mongoose、JWT                                 | 第 1–3 课    |
| 前端         | `feynman-platform-frontend/`                            | React 19、Vite、React Router、Markdown/KaTeX/Mermaid             | 第 4–6 课    |
| 语音识别     | `whisper-service/`                                      | Flask + 本地 Whisper（small）                                    | 第 7、7.5 课 |
| AI 能力      | `src/services/`                                         | DeepSeek 优先，本地 Ollama（qwen2.5:7b）兜底                     | 第 8–9 课    |
| 知识库       | `src/services/vectorStoreService.js`                    | 文本切分 + 本地 bge-base-zh-v1.5 向量化 + MongoDB 存向量         | 第 10 课     |
| 知识库问答   | `src/services/ragService.js`、前端「AI 助手」           | 检索相关笔记 → 大模型照着回答，带引用来源，流式输出              | 第 11 课     |
| 知识图谱     | `src/services/graphService.js`、前端「知识图谱」        | ECharts 力导向图；引用边 + 向量相似边（互为前 2 近邻）           | 第 12 课     |
| 3D 视界      | `feynman-platform-frontend/src/three/`、前端「3D 视界」 | Three.js：场景、相机、渲染器、轨道控制器；悬停高亮               | 第 13 课     |
| 知识宇宙     | 前端「知识宇宙」                                        | Three.js + d3-force-3d 三维力导向布局；点击选中高亮              | 第 14 课     |
| 桌面端和 PWA | `feynman-platform-frontend/electron/`、`vite.config.js` | Electron 打包 Windows 安装程序；网页版可在 Chrome 安装、离线打开 | 第 15 课     |

## 第 4–16 课：完整运行（前端 + 后端 + AI）

需要 Node.js 20+、Python 3.12、[Ollama](https://ollama.com)。模型都放在 F 盘：Whisper 模型在 `F:\AI-models\whisper`，向量模型在 `F:\AI-models\embedding\bge-base-zh-v1.5`，Ollama 模型在 `F:\AI-models\ollama-models`（由用户环境变量 `OLLAMA_MODELS` 指定）。

第一次准备：

```powershell
npm install
Copy-Item .env.example .env   # 填 JWT_SECRET；有 DeepSeek key 就填 DEEPSEEK_API_KEY，没有就只用本地 Ollama
cd feynman-platform-frontend; npm install; cd ..
cd whisper-service; py -3.12 -m venv .venv; .\.venv\Scripts\pip install -r requirements.txt; cd ..
ollama pull qwen2.5:7b
# 向量模型：从 https://modelscope.cn/models/BAAI/bge-base-zh-v1.5/files 下载 config.json、pytorch_model.bin、
# special_tokens_map.json、tokenizer.json、tokenizer_config.json、vocab.txt 到 F:\AI-models\embedding\bge-base-zh-v1.5
# 下好后启动 whisper-service，运行 npm run rag:check 体检：相关句子的相似度要明显高于无关句子
```

每次启动，各开一个终端：

```powershell
npm run db:local                                      # 本机 MongoDB，数据存在 .data/mongo，重启不丢
npm run dev                                           # 后端 http://localhost:3000
cd feynman-platform-frontend; npm run dev             # 前端 http://localhost:5173
cd whisper-service; .\.venv\Scripts\python app.py  # 语音识别 + 向量化 http://127.0.0.1:5001
ollama serve                                          # 本地大模型 http://127.0.0.1:11434，已在后台运行就不用开
```

想要一套固定的演示数据（录屏用）：运行 `npm run seed:demo`，会创建演示账号 `demo@feynman.test` 和 8 个知识点，并建好向量索引（需要 whisper-service 已启动），密码见 `scripts/seed-demo.js`。

用户流程：注册/登录 → 知识点列表 → 开始复述（录音 → Whisper 转写 → 可修改文字）→ AI 教练点评（润色、四维打分、优缺点，低于 60 分自动进入待复习）→ 测评（AI 出单选或简答题，简答题由 AI 判分，答错进入待复习）。

为什么换了讲义里的服务：讲义用百度语音识别，这里换成本地 Whisper，不用申请密钥、不按次计费；大模型按讲义用 DeepSeek，另加本地 Ollama 兜底，没网或没余额时演示也能跑。

第 10 课的知识库：讲义用百度千帆向量化、HNSWLib 存本地文件。这里向量化换成本机的 bge-base-zh-v1.5（和 Whisper 在同一个 Python 服务里），向量存进 MongoDB 的 `knowledgechunks` 集合：知识点更新时整组替换、删除时一起删，不会像 HNSWLib 那样留下旧向量。切分方式的对比见 [docs/rag-splitter-comparison.md](docs/rag-splitter-comparison.md)。

第 15 课的桌面端和 PWA（命令都在 `feynman-platform-frontend` 里运行，后端要开着）：

```powershell
npm run electron:dev        # 开发：Vite 开发服务器 + Electron 窗口，改代码自动刷新
npm run electron:start      # 用打包后的页面开 Electron 窗口（file:// 协议，和安装版一样）
npm run electron:build      # 打 Windows 安装程序，输出到 release/（约 120MB，未签名，exe 用蓝底「F」图标；要开 Windows 开发者模式）
npm run electron:build:no-icon   # 没开开发者模式时用：跳过改 exe 图标，其余一样
npm run build; npm run preview   # PWA：打开 http://localhost:4173，地址栏右侧点「安装」；断网后刷新仍能打开
```

第一次打包会下载 Electron（约 150MB）和打包工具。想放在 F 盘，先在同一个终端设 `$env:electron_config_cache="F:\AI-models\electron-cache"; $env:ELECTRON_BUILDER_CACHE="F:\AI-models\electron-builder-cache"` 再 `npm install`、打包。

第 11 课的知识库问答：讲义用 LangChain 的 LCEL 把检索、提示词、大模型串成一条链，这里每一步是一个普通函数，按顺序调用（`src/services/ragService.js`）。在讲义基础上做了两道选做题：回答附带编号的引用来源、流式输出（SSE）。检索效果用 `npm run rag:eval` 评测，相关度门槛和块长都按评测数据定，见 [docs/rag-retrieval-eval.md](docs/rag-retrieval-eval.md)。

第 16 课的总结材料：[项目总结](docs/project-summary.md)（实际架构、和讲义的不同、工程问题）、[部署说明](docs/deployment.md)（已有的容器化配置和上线还差什么，没有实际上云）、[汇报演示流程](docs/final-demo.md)（8–10 分钟时间线、演示前检查、常见问题）。

## 先从这里开始

| 你的目标             | 入口                                          |
| -------------------- | --------------------------------------------- |
| 从零看懂 AJAX 调用链 | [通俗 AJAX 教学](docs/beginner-ajax-guide.md) |
| 马上验证全部功能     | 运行 `npm run verify`                         |
| 第一次系统学习       | [系统学习指南](docs/learning-guide.md)        |
| 临时查命令和概念     | [知识点速查](docs/quick-reference.md)         |
| 对照需求、源码和测试 | [源码与测试索引](docs/source-test-map.md)     |
| 检查每次课成果       | [课程验收清单](docs/checklists/README.md)     |
| 检验自己是否真的理解 | [苏格拉底式自测](docs/self-test.md)           |
| 遇到运行错误         | [常见问题排查](docs/troubleshooting.md)       |
| 查看完整 API         | 启动后打开 `http://localhost:3000/api-docs`   |

## 方式零：一键 AJAX 学习实验室

如果函数、Promise、Express 和前后端调用还没有连起来，先使用不依赖 Docker 的互动演示：

```powershell
npm install
npm run learn:ajax
```

打开终端显示的 `http://127.0.0.1:5173`，按顺序完成健康检查、注册、登录和知识点 CRUD。网页会同时展示本次请求等价的完整 `fetch`、请求包、后端调用链和响应包。

演示直接使用当前真实 API，但数据库和 JWT 密钥只存在于本次学习进程；按 `Ctrl+C` 后数据自动清空。端口冲突时可以设置 `LEARNING_API_PORT` 和 `LEARNING_WEB_PORT`。完整操作与概念解释见 [从 JavaScript 到 AJAX](docs/beginner-ajax-guide.md)。

## 方式一：无需 Docker 的自动验收

要求 Node.js 20 或更高版本。测试数据库由 `mongodb-memory-server` 临时创建，不读取 `.env`，也不要求 Docker 或 Atlas。

```powershell
npm install
npm run verify
```

Windows 上也可以运行包含干净安装的验收脚本：

```powershell
.\scripts\verify.ps1
```

## 方式二：Docker 持久化演示

先启动 Docker Desktop，再在项目根目录执行：

```powershell
docker compose up --build -d
docker compose ps
.\scripts\smoke-test.ps1
```

浏览器入口：

- 服务首页：`http://localhost:3000`
- Swagger：`http://localhost:3000/api-docs`
- 健康检查：`http://localhost:3000/health`

停止服务但保留数据：

```powershell
docker compose down
```

`docker compose down -v` 会删除课程演示数据库，除非确定不再需要数据，否则不要加 `-v`。

## 方式三：本机 Node.js + 自选 MongoDB

```powershell
Copy-Item .env.example .env
# 修改 .env 中的 MONGO_URI 与 JWT_SECRET
npm start
```

`MONGO_URI` 可以指向本机 MongoDB、Docker 暴露的 MongoDB 或个人 MongoDB Atlas。真实密钥只放 `.env`，不要提交。

## 主要接口

| 方法                 | 路径                                 | 是否认证 | 用途               |
| -------------------- | ------------------------------------ | -------- | ------------------ |
| GET                  | `/`                                  | 否       | 第一课 Hello World |
| GET                  | `/user`                              | 否       | 第一课选做接口     |
| POST                 | `/api/users/register`                | 否       | 注册并自动登录     |
| POST                 | `/api/users/login`                   | 否       | 登录并签发 JWT     |
| GET/POST             | `/api/knowledge-points`              | 是       | 列表与创建         |
| GET/PATCH/PUT/DELETE | `/api/knowledge-points/:id`          | 是       | 详情、更新与删除   |
| GET                  | `/api/knowledge-points/:id/attempts` | 是       | 复述记录           |
| POST                 | `/api/audio/transcribe`              | 是       | 上传录音并转文字   |
| POST                 | `/api/ai/evaluate`                   | 是       | AI 点评复述        |
| POST                 | `/api/ai/generate-question`          | 是       | AI 出题            |
| POST                 | `/api/ai/grade-answer`               | 是       | AI 判简答题        |

正式认证头是 `Authorization: Bearer <token>`；为匹配第三课讲义，也兼容 `x-auth-token`。第二课旧路径 `/api/register`、`/api/login` 同样可用。

## 查看每课检查点

```powershell
git tag --list
git show lesson-1
git show lesson-2
git show lesson-3
git show lesson-6
git show lesson-9
git show lesson-10
git show lesson-11
git show lesson-12
git show lesson-13
git show lesson-14
git show lesson-15
git show lesson-16
```

标签含义：

- `lesson-1`：Express、Hello World、`/user` 和基础测试。
- `lesson-2`：MongoDB、用户模型、bcrypt 注册与登录挑战。
- `lesson-3`：JWT、认证中间件、知识点 CRUD、工程化资产和完整学习资料。
- `lesson-6`：React 前端、登录注册、知识点列表与 Markdown 编辑器。
- `lesson-9`：录音复述、Whisper 转写、AI 点评、AI 出题与判分。
- `lesson-10`：知识库建库：文本切分、本地向量化、向量存储和语义检索接口。
- `lesson-11`：知识库问答：检索加生成、引用来源、流式输出、AI 助手页面和检索评测。
- `lesson-12`：知识图谱：ECharts 力导向图，引用关系和向量相似度两种连线。
- `lesson-13`：Three.js 入门：旋转立方体，知识点随机撒成 3D 星球，鼠标悬停高亮星球和相连的线。
- `lesson-14`：3D 知识宇宙：d3-force-3d 力导向布局，点击选中知识点，高亮邻居、其余变暗。
- `lesson-15`：桌面端和 PWA：Electron 打包 Windows 安装程序，网页版可安装、可离线打开。
- `lesson-16`：项目总结、部署说明（理论）和期末汇报演示流程。

## 项目结构

```text
src/
  app.js          创建 Express 应用，不监听端口，便于测试
  server.js       连接数据库并启动/关闭服务器
  config/         数据库、JWT、Swagger 配置
  routes/         URL 与控制器的映射
  controllers/    业务流程
  models/         Mongoose 数据模型
  middleware/     JWT 认证与统一错误处理
  validators/     输入校验与讲义兼容规则
  services/       大模型调用（多服务兜底）、语音识别、提示词
feynman-platform-frontend/  React 前端
whisper-service/  Flask + Whisper 语音识别服务
tests/            无 Docker 自动测试
docs/             学习、设计、API 与验收资料
postman/          Postman 集合和环境
scripts/          Windows 验收脚本
examples/         可运行的 AJAX 学习页
```

完整设计取舍和扩展边界见 [使用与设计说明](docs/usage-and-design.md)。
