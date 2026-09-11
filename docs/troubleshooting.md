# 常见问题排查

先运行：

```powershell
npm run verify
```

自动测试通过但手工启动失败，问题通常在外部配置或运行环境；自动测试也失败，则先处理输出中的第一条具体错误。

## `jest` 或其他命令无法识别

原因：依赖尚未安装或安装中断。

```powershell
npm install
npm run verify
```

不要从其他项目复制 `node_modules`。本机曾出现中断安装留下不完整目录的情况；确定目录只包含可重建依赖且没有 npm 进程占用后，再移走该目录并重新安装。

## 首次测试等待较久

`mongodb-memory-server` 首次运行需要下载与当前平台匹配的 MongoDB 二进制，后续会使用缓存。保持网络可用并等待；若失败，查看错误中给出的下载 URL、代理或证书原因。

本项目使用 Mongoose 8.x。Mongoose 9 / MongoDB Driver 7 在当前 Node.js 24 测试环境中曾与内存数据库产生客户端元数据兼容错误，因此不要无验证地升级主版本。

## `缺少 MONGO_URI`

`npm start` 读取真实数据库配置；复制示例并修改：

```powershell
Copy-Item .env.example .env
```

测试命令不依赖 `.env`。如果使用 Atlas，确认用户名、密码、集群地址和网络访问规则正确；密码中的特殊字符需要 URL 编码。

## `缺少 JWT_SECRET`

在 `.env` 中配置足够长且随机的密钥。不要把真实密钥写入源码、Postman 集合或 Git。Docker Compose 中的值只用于本机课程演示，不能用于公开部署。

## 3000 端口被占用

查看占用者，不要直接结束不认识的进程：

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object LocalAddress,LocalPort,OwningProcess
Get-Process -Id <OwningProcess>
```

可以在 `.env` 中改为 `PORT=3001`，随后 Postman 环境的 `baseUrl` 也要改。

## Docker 命令存在但无法连接 API

说明 Docker CLI 已安装但 Docker Desktop 引擎没有运行。启动 Docker Desktop，等界面显示引擎就绪，再运行：

```powershell
docker version
docker compose up --build -d
docker compose ps
```

若容器不是 healthy：

```powershell
docker compose logs mongo
docker compose logs app
```

## 数据库连接成功，但请求仍失败

按状态码判断：

- 400：请求字段、类型、状态值或 ObjectId 有误。
- 401：Token 缺失、格式错误、签名错误或过期。
- 404：路径错误，或知识点不存在/不属于当前用户。
- 409：用户名或邮箱重复。
- 500：查看服务端终端的完整错误堆栈。

## Postman Bearer Token 总是 401

1. 先运行注册或登录请求，确认响应 `data.token` 存在。
2. 确认集合测试脚本已把它保存到环境变量 `token`。
3. Authorization 类型选择 Bearer Token，内容只填 Token，不要再次写 `Bearer`。
4. 若同时手工添加了 `x-auth-token`，确保两个值相同或删除旧头。
5. Token 默认 5 小时过期，过期后重新登录。

## Windows `curl` 示例换行失败

讲义里的反斜杠 `\` 是 Bash 换行，不适用于 PowerShell。优先使用 Postman、`Invoke-RestMethod` 或项目的 `scripts/smoke-test.ps1`。

## 修改了代码但行为没变化

- `npm start` 不自动重启；停止后重启，或开发时使用 `npm run dev`。
- Docker 镜像中的代码不会自动同步；执行 `docker compose up --build -d` 重建。
- 确认访问的是正确端口，且没有另一个旧 Node 进程监听同一端口。
