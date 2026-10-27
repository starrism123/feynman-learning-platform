const { sendSuccess } = require("../utils/response");
const graphService = require("../services/graphService");

// 第 12 课：知识图谱，返回 ECharts 关系图需要的 nodes 和 links
async function getKnowledgeMap(req, res) {
  const graph = await graphService.buildKnowledgeMap(req.user.id);
  return sendSuccess(res, 200, graph);
}

module.exports = { getKnowledgeMap };
