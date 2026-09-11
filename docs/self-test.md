# 苏格拉底式自测：你是真的懂了吗？

使用方法：先只看问题，把答案说出声或写下来；如果只能复述名词，就继续追问“为什么”和“如果不这样会怎样”。最后再展开参考答案。

## 第一课：从程序到 HTTP 服务

### 1. 为什么安装 Express 后还要写 `app.listen`？

追问：`require("express")`、`express()`、注册路由、监听端口分别发生了什么？自动测试为什么可以不监听端口？

<details>
<summary>参考答案</summary>

安装只把代码放进 `node_modules`；`require` 加载模块；`express()` 创建应用；注册路由只是建立规则；`listen` 才让操作系统把端口交给进程并接收网络连接。Supertest 可以直接调用 Express 应用，因此无需占用真实端口。

</details>

### 2. `package.json` 和 `package-lock.json` 为什么都要提交？

追问：为什么不提交 `node_modules`？`npm install` 与 `npm ci` 的目标有什么区别？

<details>
<summary>参考答案</summary>

`package.json` 描述直接依赖范围和脚本；锁文件记录解析后的完整依赖树。`node_modules` 体积大、平台相关且可重建。`npm install` 适合开发时调整依赖，`npm ci` 按锁文件做确定性干净安装。

</details>

### 3. `/user` 为什么从环境变量读姓名和专业？

追问：哪些内容属于代码，哪些属于部署配置？如果环境变量不存在会发生什么？

<details>
<summary>参考答案</summary>

接口行为属于代码，个人信息属于环境配置。这样同一份代码可以在不同学生环境使用。代码提供 `YourName`、`YourMajor` 默认值，真实值可在 `.env` 中覆盖。

</details>

## 第二课：从 API 到持久化数据

### 4. 为什么注册用 POST，而查询列表用 GET？

追问：URL 应表达资源还是动作？状态码 200 和 201 有什么信息差别？

<details>
<summary>参考答案</summary>

POST 通常创建资源并改变服务器状态；GET 只读取。REST 倾向用 URL 表示资源，用 HTTP 方法表示动作。201 明确说明创建了新资源，200 是一般成功。

</details>

### 5. Schema 已经标记 `required`，为什么还写 validator？

追问：如果只等数据库报错，客户端会得到怎样的信息？唯一索引和主动查重是否完全等价？

<details>
<summary>参考答案</summary>

请求层验证能提前返回稳定、可读的 400 错误；Schema 是最后防线。主动查重改善错误信息，但并发注册仍可能同时通过查询，所以数据库唯一索引和 `11000` 错误兜底仍不可少。

</details>

### 6. 为什么 bcrypt 不能“解密密码”？那它怎样登录？

追问：随机盐解决什么问题？如果两个用户密码相同，数据库中的结果应相同吗？

<details>
<summary>参考答案</summary>

bcrypt 是单向哈希。登录时 `compare` 读取哈希中包含的盐和成本参数，对输入执行同样计算并比较结果。随机盐让相同密码产生不同哈希，降低批量破解和彩虹表价值。

</details>

### 7. `await User.findOne()` 中，如果去掉 `await`，变量是什么？

追问：查询何时开始、Promise 何时得到、结果何时可用？失败怎样进入错误中间件？

<details>
<summary>参考答案</summary>

变量会是 Promise/Query，而不是用户文档。调用产生异步查询，`await` 等待其兑现后才得到结果。异步函数抛出的错误会使 Promise 拒绝，Express 5 把该错误交给错误处理中间件。

</details>

### 8. CORS 为什么在 Postman 中通常看不出问题？

<details>
<summary>参考答案</summary>

CORS 是浏览器执行的跨源策略，不是服务器之间通信的通用限制。Postman 不受浏览器同源策略约束，因此可以调用没有 CORS 许可头的 API。

</details>

## 第三课：身份和资源边界

### 9. JWT 签名了，为什么 Payload 仍不能放密码？

追问：签名、编码、加密分别解决什么问题？

<details>
<summary>参考答案</summary>

JWT Payload 通常只是 Base64URL 编码，拿到 Token 的人可以读取。签名证明内容未被篡改，不提供保密；加密才提供保密。本项目只放用户 ID。

</details>

### 10. 认证成功后，为什么查询知识点还要带 `user: req.user.id`？

<details>
<summary>参考答案</summary>

认证只说明 Token 属于某个用户，不说明他拥有任意知识点。把当前用户 ID 加入查询才完成资源授权，否则知道他人 ObjectId 就可能越权访问。

</details>

### 11. 为什么他人的知识点返回 404，而不是讲义中的 401？

追问：两种返回会向攻击者透露什么不同信息？

<details>
<summary>参考答案</summary>

用户已有合法身份，所以 401 并不准确。若对存在但无权的 ID 返回特殊状态，攻击者能枚举哪些 ID 存在。统一按 404 处理“不存在或不属于你”可减少信息泄露。

</details>

### 12. Bearer Token 与 `x-auth-token` 同时存在且不同，为什么不能随便选一个？

<details>
<summary>参考答案</summary>

静默选择会让代理、客户端和服务器对“哪个身份生效”产生歧义，也可能掩盖配置或攻击问题。明确拒绝冲突请求更可预测。

</details>

### 13. PATCH 与 PUT 有什么区别？本项目为什么两个都支持？

<details>
<summary>参考答案</summary>

严格 REST 语义中 PUT 倾向完整替换，PATCH 是部分更新。讲义用 PUT 做部分更新，所以本项目以 PATCH 为正式入口，同时保留 PUT 并明确采用相同兼容语义。

</details>

### 14. 为什么更新接口只接受白名单字段？

追问：如果直接把 `req.body` 传给数据库，用户可能修改什么？

<details>
<summary>参考答案</summary>

直接写入请求体可能允许用户修改 `user`、时间戳或未来的管理字段，形成批量赋值漏洞。白名单只允许 `title`、`content`、`status`、`reviewList`。

</details>

## 工程化：证据与复现

### 15. “服务器能启动”为什么不足以证明项目完成？

<details>
<summary>参考答案</summary>

启动只证明语法、依赖和最初连接可能正常，不能证明重复注册、密码安全、Token 过期、CRUD、越权隔离等行为。需要针对成功和失败路径的自动测试及真实环境冒烟测试。

</details>

### 16. 内存 MongoDB 测试与 Docker 冒烟测试各能证明什么？

<details>
<summary>参考答案</summary>

内存数据库测试快速、隔离、无需外部服务，证明应用行为和真实 Mongoose 查询；Docker 冒烟测试证明镜像、容器网络、启动顺序、持久化数据库和真实端口协同正常。二者互补。

</details>

### 17. 如果 Swagger 文档写着接口存在，但测试失败，应相信哪一个？

<details>
<summary>参考答案</summary>

文档是意图和合同，运行测试是当前实现证据。失败说明二者至少一个过期或实现有缺陷，应定位并同步修复，不能用文档替代运行证据。

</details>

## 最终口头复述题

不看源码，用两分钟完整说明：

> 用户在 Postman 注册后创建一个知识点，这两个请求从进入 Express 到保存 MongoDB，再到返回 JSON，分别经过哪些模块？密码和 JWT 各怎样处理？系统怎样保证他只能看到自己的知识点？

如果你能按执行顺序回答，并能指出对应源码与测试，就已经掌握前三课的主干。
