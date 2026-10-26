# AGENTS.md

<!-- project-knowledge-sync:managed-agents:start -->

## 项目边界

- 这是《大前端与AI实战》前三课 Node.js 后端；目录名 `Android` 不代表本阶段包含 Android 客户端。
- `要求文档/` 是原始需求证据，只读保留；实现冲突以 `docs/usage-and-design.md` 和 `docs/openapi.yaml` 中记录的统一契约为准。
- 不把 React、录音、AI、知识图谱或生产级认证功能描述为当前已实现。

## 架构与契约

- 使用 CommonJS。`src/app.js` 只创建应用，`src/server.js` 管理数据库和监听端口。
- `scripts/start-learning-demo.js` 复用真实 `createApp()`，只为教学管理临时 MongoDB、API 和 `examples/ajax-demo/` 静态页；不得复制或分叉业务路由。
- 保持 route、controller、validator、model、middleware、config 分层；不要把新业务堆回 `app.js`。
- 正式契约为 `/api/users/*`、Bearer Token、`username`、PATCH；继续兼容旧路径、`name`、`x-auth-token`、PUT，除非做显式破坏性版本变更。
- 所有知识点查询必须按当前认证用户隔离；更新字段采用白名单。密码不得出现在查询默认值、响应或日志中。
- API 变化必须同步 `docs/openapi.yaml`、Postman 集合、测试和使用文档。

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
