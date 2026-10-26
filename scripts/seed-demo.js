// 给演示和录屏准备一套固定数据：一个演示账号 + 几个知识点。
// 用法：先 npm run db:local，再 npm run seed:demo（会清掉这个演示账号原有的知识点和复述记录）
require("dotenv").config();
const bcrypt = require("bcryptjs");
const {
  connectDatabase,
  disconnectDatabase,
} = require("../src/config/database");
const User = require("../src/models/User");
const KnowledgePoint = require("../src/models/KnowledgePoint");
const FeynmanAttempt = require("../src/models/FeynmanAttempt");

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
];

async function main() {
  await connectDatabase();

  let user = await User.findOne({ email: DEMO_USER.email });
  if (!user) {
    user = await User.create({
      username: DEMO_USER.username,
      email: DEMO_USER.email,
      password: await bcrypt.hash(DEMO_USER.password, 10),
    });
  }

  await FeynmanAttempt.deleteMany({ user: user._id });
  await KnowledgePoint.deleteMany({ user: user._id });
  // 倒序创建，让第一个知识点排在列表最前面
  for (const kp of [...KNOWLEDGE_POINTS].reverse()) {
    await KnowledgePoint.create({ ...kp, user: user._id });
  }

  console.log(
    `演示数据已就绪：${DEMO_USER.email}，${KNOWLEDGE_POINTS.length} 个知识点`,
  );
  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error("写入演示数据失败:", error.message);
  await disconnectDatabase();
  process.exitCode = 1;
});
