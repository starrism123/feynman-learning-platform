# Postman 使用方法

1. 导入 `Feynman-Platform.postman_collection.json`。
2. 导入并选择 `Local.postman_environment.json`。
3. 确保本地服务运行在 `http://localhost:3000`。
4. 使用 Collection Runner 按原顺序运行整个集合。

注册请求每次都会生成唯一邮箱并保存 JWT；创建知识点会保存资源 ID，后续详情、更新和删除请求会自动复用，因此集合可以直接重复运行。

第 04 组是第 7–9 课的语音与 AI 接口，需要先启动 `whisper-service` 和 Ollama（或在 `.env` 配好 DeepSeek key）。「上传录音转文字」要在 Postman 里把 `audio` 字段指向本机的一段录音；AI 返回的文字每次不同，测试只检查结构。

集合和环境文件都不保存真实密码、Token 或数据库密钥。运行时生成的 Token 只存在 Postman 本地集合变量中。
