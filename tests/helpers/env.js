// 测试里不在后台调用真实的向量化服务；需要时由测试自己 mock embeddingService.embed
process.env.RAG_INDEXING = "off";
