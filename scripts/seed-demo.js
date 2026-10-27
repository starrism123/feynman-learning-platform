// 给演示和录屏准备一套固定数据：一个演示账号 + 几个知识点（第 10 课起同时建好向量索引）。
// 用法：先 npm run db:local，再 npm run seed:demo（会清掉这个演示账号原有的知识点和复述记录）
//       npm run seed:demo -- --reset 只删除演示账号本身，供录屏从注册开始
require("dotenv").config();
const bcrypt = require("bcryptjs");
const {
  connectDatabase,
  disconnectDatabase,
} = require("../src/config/database");
const User = require("../src/models/User");
const KnowledgePoint = require("../src/models/KnowledgePoint");
const FeynmanAttempt = require("../src/models/FeynmanAttempt");
const KnowledgeChunk = require("../src/models/KnowledgeChunk");
const vectorStoreService = require("../src/services/vectorStoreService");

// 仅用于本机演示的测试账号
const DEMO_USER = {
  username: "demo_student",
  email: "demo@feynman.test",
  password: "demo-pass-2026",
};

const KNOWLEDGE_POINTS = [
  {
    title: "JWT 登录认证",
    status: "in_progress",
    content: `# JWT 是什么

JWT（JSON Web Token）是服务器在登录成功后发给浏览器的一张**签了名的通行证**。之后浏览器每次请求都在请求头里带上它，服务器验一下签名就知道"你是谁"，不用在服务器上保存会话，这叫**无状态认证**。

| 组成部分 | 作用 |
| --- | --- |
| Header | 说明用的签名算法，比如 HS256 |
| Payload | 放用户 id、过期时间等信息（只是编码，不是加密） |
| Signature | 用服务器密钥算出的签名，防止被篡改 |

签名的计算可以写成：$Signature = HMAC_{SHA256}(base64(header) + "." + base64(payload),\\ secret)$

\`\`\`mermaid
sequenceDiagram
  participant B as 浏览器
  participant S as 后端
  B->>S: 登录（邮箱 + 密码）
  S-->>B: 校验通过，返回 JWT
  B->>S: 请求知识点（Authorization: Bearer JWT）
  S->>S: 验证签名和过期时间
  S-->>B: 返回当前用户的数据
\`\`\`

**要点**：Payload 谁都能解码，所以不能放密码；密钥只在服务器上；token 过期后需要重新登录。`,
  },
  {
    title: "React 中的 State 与 Props",
    status: "not_started",
    content: `# State 与 Props

- **Props** 是父组件传给子组件的数据，子组件只能读、不能改，就像函数的参数。
- **State** 是组件自己管理、会变化的数据，用 \`useState\` 创建；调用 setter 更新 State 后，React 会重新渲染这个组件。

\`\`\`mermaid
flowchart LR
  P[父组件 State] -- props --> C1[子组件 A]
  P -- props --> C2[子组件 B]
  C1 -- 回调函数 --> P
\`\`\`

数据**自上而下**流动；子组件想改父组件的数据，要调用父组件通过 props 传下来的回调函数。`,
  },
  {
    title: "RESTful API 设计",
    status: "mastered",
    content: `# RESTful API

用 **URL 表示资源**，用 **HTTP 方法表示动作**：

| 方法 | 路径 | 含义 |
| --- | --- | --- |
| GET | /api/knowledge-points | 查询列表 |
| POST | /api/knowledge-points | 新建 |
| PATCH | /api/knowledge-points/:id | 部分更新 |
| DELETE | /api/knowledge-points/:id | 删除 |

状态码表达结果：200 成功、201 已创建、400 参数错误、401 未登录、404 不存在、500 服务器出错。`,
  },
  {
    title: "密码哈希与 bcrypt",
    status: "in_progress",
    content: `# 为什么不能存明文密码

数据库一旦泄露，明文密码会被直接拿去登录，用户在别的网站用的同一个密码也跟着暴露。所以注册时只保存密码的**哈希值**：哈希是单向的，能从密码算出哈希，却不能从哈希反推密码。

## bcrypt 做了什么

- **加盐**：每个密码先拼上一段随机的盐再哈希，两个人用同样的密码，存下来的哈希也不一样，攻击者没法用提前算好的彩虹表批量破解。
- **故意算得慢**：cost 参数（本项目用 10）控制计算轮数。登录时多花几十毫秒用户感觉不到，暴力破解却要慢上千倍。

登录时用 \`bcrypt.compare(输入的密码, 存的哈希)\` 比对，比对通过才签发 JWT。`,
  },
  {
    title: "跨域与 CORS",
    status: "not_started",
    content: `# 浏览器的同源策略

协议、域名、端口三者都相同才算**同源**。前端开发服务器在 5173 端口，后端在 3000 端口，端口不同就是跨域。浏览器默认不让网页读取跨域请求的响应，防止恶意网站冒用你的登录状态偷数据。

## CORS 怎么放行

CORS 是后端在响应头里声明「允许哪些来源访问」，比如 \`Access-Control-Allow-Origin\`。浏览器看到声明后才把响应交给前端代码。带自定义请求头（如 Authorization）的请求，浏览器会先发一个 OPTIONS **预检请求**问后端是否允许。

注意：CORS 是浏览器的限制，不是服务器的防护。用 Postman 或 curl 直接请求不受它约束，接口的安全还是要靠认证，见「JWT 登录认证」。`,
  },
  {
    title: "useEffect 与副作用",
    status: "in_progress",
    content: `# 什么是副作用

React 组件的主要工作是根据 State 和 Props 算出界面。除此之外的事，比如请求接口、设置定时器、订阅事件、操作 DOM，都叫**副作用**，放在 \`useEffect\` 里做。

## 依赖数组决定什么时候执行

- 不写依赖数组：每次渲染后都执行。
- 空数组 \`[]\`：只在组件第一次显示时执行一次，适合首次拉取列表。
- \`[id]\`：id 变化时重新执行，适合详情页切换知识点后重新请求。

useEffect 可以返回一个清理函数，组件卸载或下次执行前调用，用来清掉定时器、停止录音，避免内存泄漏。`,
  },
  {
    title: "费曼学习法",
    status: "mastered",
    content: `# 费曼学习法

核心是**用自己的话把一个概念讲给外行听**。讲不清楚的地方，就是自己没真正理解的地方。

## 四个步骤

1. 选一个概念，写下你知道的一切。
2. 假装讲给一个完全不懂的人听，只用简单的词。
3. 卡住或者只能复述原文的地方，回去重新学。
4. 简化和类比，直到能用一句话讲清楚。

本平台把这个过程做成了闭环：录音复述 → 语音转文字 → AI 指出讲错和遗漏的地方并打分 → 低分的知识点自动加入复习列表 → 再用 AI 出题检验。`,
  },
  {
    title: "MongoDB 与 Mongoose",
    status: "not_started",
    content: `# 文档数据库

MongoDB 把数据存成类似 JSON 的**文档**，同一个集合里的文档结构可以不同，不需要先建表。一个知识点就是一个文档，包含标题、内容、状态和所属用户。

## Mongoose 补上了什么

MongoDB 本身不检查字段，Mongoose 在 Node.js 这一侧加了一层 **Schema**：规定字段类型、必填、长度上限、枚举值，保存前先校验，写错字段名或少了必填项会直接报错。

- \`ref\` 表示引用另一个集合，比如知识点的 user 字段指向用户。
- \`index\` 建索引，按用户查知识点时不用扫描整个集合。
- \`timestamps\` 自动维护创建时间和更新时间。`,
  },
];

async function main() {
  await connectDatabase();

  // 录屏要从注册开始演示：先用 --reset 删掉演示账号，在页面上注册后再运行一次本脚本补上知识点
  if (process.argv.includes("--reset")) {
    const existing = await User.findOne({ email: DEMO_USER.email });
    if (existing) {
      await FeynmanAttempt.deleteMany({ user: existing._id });
      await KnowledgeChunk.deleteMany({ user: existing._id });
      await KnowledgePoint.deleteMany({ user: existing._id });
      await existing.deleteOne();
    }
    console.log(`已删除演示账号：${DEMO_USER.email}`);
    await disconnectDatabase();
    return;
  }

  let user = await User.findOne({ email: DEMO_USER.email });
  if (!user) {
    user = await User.create({
      username: DEMO_USER.username,
      email: DEMO_USER.email,
      password: await bcrypt.hash(DEMO_USER.password, 10),
    });
  }

  await FeynmanAttempt.deleteMany({ user: user._id });
  await KnowledgeChunk.deleteMany({ user: user._id });
  await KnowledgePoint.deleteMany({ user: user._id });
  // 倒序创建，让第一个知识点排在列表最前面
  const created = [];
  for (const kp of [...KNOWLEDGE_POINTS].reverse()) {
    created.push(await KnowledgePoint.create({ ...kp, user: user._id }));
  }

  // 向量化需要本机 AI 服务（whisper-service）；没启动也不影响其余数据，之后在页面上重建索引即可
  try {
    let chunks = 0;
    for (const kp of created)
      chunks += (await vectorStoreService.indexKnowledgePoint(kp)).chunks;
    console.log(`向量索引已建好：${chunks} 个文本块`);
  } catch (error) {
    console.warn(`向量索引没建成（${error.message}），可稍后在知识库页面重建`);
  }

  console.log(
    `演示数据已就绪：${DEMO_USER.email}，${KNOWLEDGE_POINTS.length} 个知识点`,
  );
  await disconnectDatabase();
}

module.exports = { demoKnowledgePoints: KNOWLEDGE_POINTS };

// 被别的脚本 require 时只导出数据，不连数据库
if (require.main === module) {
  main().catch(async (error) => {
    console.error("写入演示数据失败:", error.message);
    await disconnectDatabase();
    process.exitCode = 1;
  });
}
