# 前三课知识点速查

## 常用命令

| 命令                           | 作用                                   |
| ------------------------------ | -------------------------------------- |
| `node -v` / `npm -v`           | 检查运行时和包管理器                   |
| `npm install`                  | 按 `package.json` 安装依赖并更新锁文件 |
| `npm ci`                       | 严格按锁文件进行干净安装               |
| `npm start`                    | 连接 `.env` 指定的 MongoDB 并启动服务  |
| `npm run dev`                  | 文件变化后自动重启开发服务             |
| `npm test`                     | 运行全部 Jest/Supertest 测试           |
| `npm run lint`                 | 查找 JavaScript 静态问题               |
| `npm run format:check`         | 检查格式但不改文件                     |
| `npm run verify`               | 格式检查 + 静态检查 + 测试             |
| `docker compose up --build -d` | 构建并后台启动应用和 MongoDB           |
| `docker compose ps`            | 查看容器和健康状态                     |
| `docker compose logs app`      | 查看应用容器日志                       |
| `docker compose down`          | 停止容器，保留数据库卷                 |
| `git status`                   | 查看工作区和暂存区变化                 |
| `git log --oneline --decorate` | 查看提交与标签                         |

## 核心概念一句话

| 概念            | 一句话理解                                        |
| --------------- | ------------------------------------------------- |
| Node.js         | 在浏览器外运行 JavaScript 的服务端运行时          |
| npm             | 依赖管理器和项目脚本入口                          |
| Express         | 把 HTTP 请求映射到 JavaScript 处理函数的 Web 框架 |
| API             | 客户端与服务端关于请求和响应的合同                |
| REST            | 用资源 URL 和 HTTP 方法表达业务操作的设计风格     |
| JSON            | HTTP 中常用的文本数据格式                         |
| MongoDB         | 以 BSON 文档保存数据的数据库                      |
| Mongoose        | 用 Schema、Model 和查询 API 操作 MongoDB 的 ODM   |
| Schema          | 数据字段、类型、默认值和约束的定义                |
| Model           | 根据 Schema 创建、查询、更新文档的入口            |
| 中间件          | 在最终路由处理前后执行的流水线函数                |
| CORS            | 浏览器对跨源请求的安全机制及其服务端许可头        |
| 环境变量        | 与源码分离的运行配置或秘密                        |
| bcrypt          | 带盐、可调成本的单向密码哈希算法                  |
| JWT             | 可验证签名和过期时间的 Token 格式                 |
| 认证            | 确认请求者是谁                                    |
| 授权            | 确认请求者能操作哪些资源                          |
| CRUD            | 创建、读取、更新、删除                            |
| Promise         | 表示一个未来完成或失败的异步结果                  |
| `async/await`   | 以接近同步阅读顺序等待 Promise 的语法             |
| Swagger/OpenAPI | 机器可读的 API 合同和交互页面                     |
| Jest            | 组织测试、执行测试和提供断言                      |
| Supertest       | 不占真实端口测试 Express HTTP 行为                |

## HTTP 快查

| 状态码 | 本项目含义                              |
| ------ | --------------------------------------- |
| 200    | 查询、更新或删除成功                    |
| 201    | 新资源创建成功                          |
| 400    | 请求字段或资源 ID 不合法                |
| 401    | 没有有效 Token 或登录凭据错误           |
| 404    | 路由不存在，或资源不存在/不属于当前用户 |
| 409    | 用户名或邮箱唯一值冲突                  |
| 500    | 未预料到的服务端错误                    |

```text
GET    查询
POST   创建
PATCH  部分更新（正式接口）
PUT    讲义兼容更新
DELETE 删除
```

## 认证快查

正式写法：

```http
Authorization: Bearer eyJ...
```

讲义兼容写法：

```http
x-auth-token: eyJ...
```

二者同时出现时必须相同。JWT Payload 能被读取，不要放密码；JWT 必须用 HTTPS 防止传输中被窃取。

## 数据模型

```text
User
  _id, username, email, password(默认不查询), createdAt, updatedAt

KnowledgePoint
  _id, user(User._id), title, content,
  status(not_started|in_progress|mastered), reviewList,
  createdAt, updatedAt
```

## 统一响应

```json
{ "success": true, "data": {}, "message": "可选" }
```

```json
{
  "success": false,
  "error": { "code": "ERROR_CODE", "message": "说明", "details": [] }
}
```

## 最短排错顺序

1. 看终端第一条错误，不只看最后一行。
2. 确认自己位于项目根目录。
3. 运行 `node -v`、`npm install`、`npm run verify`。
4. 启动服务时检查 `.env` 的 `MONGO_URI`、`JWT_SECRET`。
5. 检查 3000 端口和 Docker 状态。
6. 对照 [常见问题排查](troubleshooting.md)。
