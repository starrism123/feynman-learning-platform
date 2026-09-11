# 费曼学习平台后端：前三课完整实践

本项目把《大前端与AI实战》前三次课程合并成一个可运行、可测试、可按课次回看的后端。它覆盖 Express、REST、MongoDB/Mongoose、密码哈希、JWT、中间件和知识点 CRUD；目录名虽然是 `Android`，本轮范围只有讲义明确要求的 Node.js 后端。

## 先从这里开始

| 你的目标             | 入口                                        |
| -------------------- | ------------------------------------------- |
| 马上验证全部功能     | 运行 `npm run verify`                       |
| 第一次系统学习       | [系统学习指南](docs/learning-guide.md)      |
| 临时查命令和概念     | [知识点速查](docs/quick-reference.md)       |
| 对照需求、源码和测试 | [源码与测试索引](docs/source-test-map.md)   |
| 检查每次课成果       | [课程验收清单](docs/checklists/README.md)   |
| 检验自己是否真的理解 | [苏格拉底式自测](docs/self-test.md)         |
| 遇到运行错误         | [常见问题排查](docs/troubleshooting.md)     |
| 查看完整 API         | 启动后打开 `http://localhost:3000/api-docs` |

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

| 方法                 | 路径                        | 是否认证 | 用途               |
| -------------------- | --------------------------- | -------- | ------------------ |
| GET                  | `/`                         | 否       | 第一课 Hello World |
| GET                  | `/user`                     | 否       | 第一课选做接口     |
| POST                 | `/api/users/register`       | 否       | 注册并自动登录     |
| POST                 | `/api/users/login`          | 否       | 登录并签发 JWT     |
| GET/POST             | `/api/knowledge-points`     | 是       | 列表与创建         |
| GET/PATCH/PUT/DELETE | `/api/knowledge-points/:id` | 是       | 详情、更新与删除   |

正式认证头是 `Authorization: Bearer <token>`；为匹配第三课讲义，也兼容 `x-auth-token`。第二课旧路径 `/api/register`、`/api/login` 同样可用。

## 查看三课真实检查点

```powershell
git tag --list
git show lesson-1
git show lesson-2
git show lesson-3
```

标签含义：

- `lesson-1`：Express、Hello World、`/user` 和基础测试。
- `lesson-2`：MongoDB、用户模型、bcrypt 注册与登录挑战。
- `lesson-3`：JWT、认证中间件、知识点 CRUD、工程化资产和完整学习资料。

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
tests/            无 Docker 自动测试
docs/             学习、设计、API 与验收资料
postman/          Postman 集合和环境
scripts/          Windows 验收脚本
```

完整设计取舍和扩展边界见 [使用与设计说明](docs/usage-and-design.md)。
