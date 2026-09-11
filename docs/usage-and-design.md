# 使用与设计说明

<!-- project-knowledge-sync:managed-manual:start -->

## 用户工作流

项目提供两条互不依赖的验证通道：

1. `npm run verify` 使用临时 MongoDB，适合开发、提交前检查和没有 Docker 的课堂电脑。
2. `docker compose up --build -d` 启动应用和持久化 MongoDB，再用 `scripts/smoke-test.ps1` 验证真实 HTTP 链路。

API 的机器可读合同是 `docs/openapi.yaml`，运行后的交互页面位于 `/api-docs`；Postman 集合用于课堂手工演示。README 是所有学习与验收资料的入口。

## 架构与数据流

`src/app.js` 只组装 Express 应用；`src/server.js` 负责数据库生命周期与端口。路由只映射 URL，控制器组织业务，验证器处理输入，模型负责持久化，中间件承担认证与错误响应。这种分离允许 Supertest 不监听真实端口就完成集成测试。

正式 API 使用 `/api/users/*`、Bearer Token、`username` 和 PATCH；为课程讲义保留旧用户路径、`name`、`x-auth-token` 和 PUT。兼容入口调用相同逻辑，不维护两套业务实现。成功和失败响应保持统一结构。

知识点所有权在数据库查询条件中同时校验 `_id` 和 `user`。未找到与越权统一返回 404，防止资源枚举。更新只允许四个业务字段，密码默认不参与 Mongoose 查询及 JSON 序列化。

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
- Docker 完整验收需要 Docker Desktop 引擎已启动。
- Atlas 账号、IP 白名单及个人密钥无法由仓库预置。
- 本项目是前三课后端，不包含 Android、React、录音、AI 或知识图谱功能。

<!-- project-knowledge-sync:managed-manual:end -->
