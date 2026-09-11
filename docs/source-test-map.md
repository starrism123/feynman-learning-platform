# 需求、接口、源码与测试索引

这张表回答“课程要求到底在哪里实现，又由什么证据证明”。行号会随代码调整，使用稳定文件和测试名称定位。

| 课程需求              | 对外接口                              | 主要源码                                  | 自动证据                                      |
| --------------------- | ------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| 第一课 Hello World    | `GET /`                               | `src/app.js`                              | `tests/basic.test.js`：GET / 返回 Hello World |
| 第一课选做用户 JSON   | `GET /user`                           | `src/app.js`                              | `tests/basic.test.js`：返回可配置学生信息     |
| 服务健康检查          | `GET /health`                         | `src/app.js`                              | `tests/basic.test.js`：返回健康状态           |
| MongoDB 连接          | 启动流程                              | `src/config/database.js`、`src/server.js` | 所有数据库测试真实连接内存 MongoDB            |
| User Schema           | —                                     | `src/models/User.js`                      | `tests/users.test.js` 查询实际保存文档        |
| 密码哈希              | 注册接口                              | `src/controllers/userController.js`       | 明文不等于存储值，`bcrypt.compare` 为 true    |
| 统一输入验证          | 注册、登录、CRUD                      | `src/validators/`                         | 非法字段、冲突字段、非法状态测试              |
| 用户注册              | `POST /api/users/register`            | `userRoutes.js` → `userController.js`     | 注册、重复、旧路径、`name` 兼容测试           |
| 登录挑战与 JWT        | `POST /api/users/login`               | `userController.js`、`config/auth.js`     | 正确/错误凭据、Token 返回测试                 |
| 认证中间件            | 知识点全部接口                        | `src/middleware/auth.js`                  | 缺失、伪造、过期、双头冲突测试                |
| KnowledgePoint Schema | —                                     | `src/models/KnowledgePoint.js`            | CRUD 和枚举验证测试                           |
| 创建/列表             | `POST/GET /api/knowledge-points`      | 路由、控制器、模型                        | 创建默认值与按用户列表测试                    |
| 讲义留空的详情        | `GET /api/knowledge-points/:id`       | `knowledgePointController.js`             | 详情、非法 ID、越权 404 测试                  |
| 更新                  | `PATCH/PUT /api/knowledge-points/:id` | validator、controller                     | PATCH、PUT、白名单、空更新测试                |
| 删除                  | `DELETE /api/knowledge-points/:id`    | controller                                | 删除后 404、越权删除测试                      |
| 用户数据隔离          | 全部知识点接口                        | `findOwnedKnowledgePoint` 与列表查询      | 两用户列表/详情/更新/删除隔离测试             |
| Swagger               | `GET /api-docs`、`/api-docs.json`     | `docs/openapi.yaml`、`config/swagger.js`  | YAML 加载及基础接口测试                       |
| Docker 完整链路       | 3000 端口                             | `Dockerfile`、`compose.yaml`              | `scripts/smoke-test.ps1`                      |

## 手工追踪示例

以 `PATCH /api/knowledge-points/:id` 为例：

1. `src/app.js` 将 `/api/knowledge-points` 交给知识点路由。
2. `src/routes/knowledgePointRoutes.js` 先执行 `auth`，再匹配 `PATCH /:id`。
3. `src/middleware/auth.js` 验证 Token，写入 `req.user.id`。
4. `src/controllers/knowledgePointController.js` 同时用 `id + user.id` 查询所属资源。
5. `src/validators/knowledgePointValidator.js` 只接受允许更新的四个字段。
6. Mongoose `save()` 把变更写入 MongoDB。
7. `sendSuccess` 返回统一 JSON。
8. `tests/knowledgePoints.test.js` 同时证明正常更新和越权失败。
