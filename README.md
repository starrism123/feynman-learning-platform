# 费曼学习平台后端

这是《大前端与AI实战》前三次课程的连续实践项目。当前 `lesson-2` 阶段已经在第一课基础上加入 MongoDB、用户注册、密码哈希和登录挑战任务。

## 快速开始

```powershell
npm install
Copy-Item .env.example .env
# 按实际环境修改 .env 中的 MONGO_URI
npm start
```

打开 `http://localhost:3000`，应看到 `Hello, Feynman Learner!`。

## 验证

```powershell
npm run verify
```

测试使用内存 MongoDB，不读取 `.env`，无需预先启动本地数据库。
