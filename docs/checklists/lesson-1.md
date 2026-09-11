# 第一课验收：Express 基础服务

对应标签：`lesson-1`

## 自动检查

```powershell
git show --stat lesson-1
npm install
npm run verify
```

该标签预期通过 3 个测试。

## 人工检查

- [ ] `node -v`、`npm -v`、`git --version` 能输出版本。
- [ ] `package.json` 能说明项目名称、依赖和脚本。
- [ ] `node_modules` 被 `.gitignore` 排除。
- [ ] `npm start` 后访问 `/` 返回 `Hello, Feynman Learner!`。
- [ ] `/user` 返回包含 `name` 和 `major` 的 JSON。
- [ ] `/health` 返回成功状态。
- [ ] 能解释 `req`、`res`、路由、端口和 `app.listen`。

AI 编程助手安装和登录依赖个人编辑器账号，代码仓库只能提供使用原则，不能伪造“已登录”证据。
