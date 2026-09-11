# 第二课验收：API、MongoDB 与用户

对应标签：`lesson-2`

## 自动检查

```powershell
git switch --detach lesson-2
npm install
npm run verify
git switch main
```

该标签预期通过 9 个测试，不需要 Docker 或 Atlas。

## 功能检查

- [ ] 应用先连接 MongoDB，再监听端口。
- [ ] `User` 包含唯一用户名、唯一邮箱、密码与时间戳。
- [ ] 注册成功返回 201，数据库中不是明文密码，响应中没有密码。
- [ ] 重复用户名/邮箱返回 409。
- [ ] 非法邮箱、短密码和短用户名返回 400。
- [ ] 正确密码可以登录，错误密码或未知用户返回 401。
- [ ] `/api/register`、`/api/login` 兼容第二课讲义。
- [ ] 注册接受 `username`；第三课的 `name` 写法也已经兼容。
- [ ] 能解释 REST、JSON、Schema、Model、CORS、dotenv、bcrypt 和 async/await。
