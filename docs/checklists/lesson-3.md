# 第三课验收：JWT 与知识点 CRUD

对应标签：`lesson-3`

## 自动检查

```powershell
npm run verify
```

最终版本应通过全部 14 个以上测试（以后增加测试时数量可以更多，但不能减少既有行为覆盖）。

## API 检查

- [ ] 注册和登录都返回 JWT，响应不泄露密码。
- [ ] Bearer Token 可以访问知识点接口。
- [ ] `x-auth-token` 兼容可用；冲突双头被拒绝。
- [ ] 缺失、伪造、过期 Token 分别返回明确的 401 错误码。
- [ ] 知识点创建、列表、详情、PATCH、PUT、删除闭环通过。
- [ ] 详情接口已补齐，不再是讲义中的空实现。
- [ ] 非法 ObjectId、状态、布尔值、未知字段和空更新被拒绝。
- [ ] 用户 A 无法看到或操作用户 B 的知识点。
- [ ] `http://localhost:3000/api-docs` 能展示 Swagger。

## 完整环境检查

```powershell
docker compose up --build -d
docker compose ps
.\scripts\smoke-test.ps1
```

- [ ] `mongo` 与 `app` 都变为 healthy。
- [ ] 冒烟脚本完整完成注册、认证、CRUD。
- [ ] `docker compose down` 后命名卷仍存在。
- [ ] Postman 集合可以自动保存 Token 和知识点 ID。
