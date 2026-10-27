// 测试里不在后台调用真实的向量化服务；需要时由测试自己 mock embeddingService.embed
process.env.RAG_INDEXING = "off";
// 万一哪个测试忘了 mock，请求会打到一个没人监听的端口立刻失败，而不是调用本机真实的 AI 服务
process.env.WHISPER_URL = "http://127.0.0.1:9";
