import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { format } from 'echarts';
import apiClient, { getErrorMessage } from '../api/axios';

// ECharts 的提示框按 HTML 渲染，标题是用户自己写的，必须转义，否则又是一个 XSS 入口（见第 6 课）
const escape = (text) => format.encodeHTML(String(text ?? ''));

function buildOption({ nodes, links }) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return {
    tooltip: {
      formatter: (params) => {
        if (params.dataType === 'node') {
          const tip = params.data.indexed ? '' : '<br/>还没建向量索引，不参与相似连线';
          return `<b>${escape(params.data.name)}</b>${tip}`;
        }
        const { source, target, type, score } = params.data;
        const pair = `${escape(byId.get(source)?.name)} — ${escape(byId.get(target)?.name)}`;
        return type === 'reference' ? `${pair}<br/>正文里提到了对方` : `${pair}<br/>内容相似度 ${score}`;
      },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true, // 鼠标滚轮缩放、拖动画布
        draggable: true, // 拖动节点
        data: nodes.map((node) => ({
          ...node,
          itemStyle: node.indexed ? { color: '#2f6fed' } : { color: '#c5cad3' },
        })),
        links: links.map((link) =>
          link.type === 'reference'
            ? {
                ...link,
                symbol: ['none', 'arrow'],
                lineStyle: { type: 'solid', width: 2, color: '#1f2430', curveness: 0 },
              }
            : {
                ...link,
                // 越相似线越粗；虚线和引用边区分开
                lineStyle: {
                  type: 'dashed',
                  width: 1 + (link.score - 0.4) * 8,
                  color: '#2f6fed',
                  opacity: 0.6,
                  curveness: 0.15,
                },
              },
        ),
        edgeSymbolSize: 8,
        label: { show: true, position: 'right', formatter: '{b}' },
        force: { repulsion: 260, edgeLength: [80, 160], gravity: 0.08 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 4 } },
      },
    ],
  };
}

function GraphPage() {
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    apiClient
      .get('/graph/knowledge-map')
      .then((response) => setGraph(response.data.data))
      .catch((err) => setError(getErrorMessage(err, '获取图谱数据失败')));
  }, []);

  const option = useMemo(() => (graph ? buildOption(graph) : null), [graph]);

  // 点击节点打开知识点详情
  const onEvents = useMemo(
    () => ({
      click: (params) => {
        if (params.dataType === 'node') navigate(`/kp/${params.data.id}`);
      },
    }),
    [navigate],
  );

  if (error) return <p className="error">{error}</p>;
  if (!graph) return <p className="muted">正在生成知识图谱…</p>;

  const similarCount = graph.links.filter((link) => link.type === 'similar').length;
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>知识图谱</h1>
          <p className="muted">
            黑色实线箭头：正文里提到了另一个知识点的标题；蓝色虚线：内容相似（两个知识点互相排在对方最相似的前{' '}
            {graph.meta.similarNeighbors} 名里，线越粗越相似）。点击节点打开知识点，拖动节点调整位置，滚轮缩放。
          </p>
        </div>
      </div>
      {graph.nodes.length === 0 ? (
        <div className="empty">
          还没有知识点。<Link to="/kp/new">去新建一个</Link>
        </div>
      ) : (
        <div className="panel graph-panel">
          <p className="small muted">
            {graph.nodes.length} 个知识点 · {graph.links.length - similarCount} 条引用 · {similarCount} 条相似
            {graph.meta.unindexed > 0 && ` · ${graph.meta.unindexed} 个还没建向量索引（灰色），可在 AI 助手页重建`}
          </p>
          <ReactECharts option={option} style={{ height: '620px', width: '100%' }} onEvents={onEvents} />
        </div>
      )}
    </div>
  );
}

export default GraphPage;
