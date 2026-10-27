import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { forceCenter, forceLink, forceManyBody, forceSimulation, forceX, forceY, forceZ } from 'd3-force-3d';
import apiClient, { getErrorMessage } from '../api/axios';
import { createGraphObjects, createStage, pickNode } from '../three/knowledgeScene';

// 第 14 课：3D 知识宇宙。和第 13 课用同一套场景代码，区别是节点位置：
// 不再随机撒点，而是交给 d3-force-3d 力导向模拟——连线像弹簧把相关的知识点拉近，
// 节点之间互相排斥不重叠，中心力把整体挪回原点，再加一点向原点的引力。模拟每一帧推进一步，星球慢慢「散开、落位」。
// 挑战：点击星球选中它，它和邻居高亮、其余变暗（Raycaster 拾取）。

// 按下到抬起移动超过这个距离（像素）算拖动视角，不算点击
const CLICK_TOLERANCE = 5;

function KnowledgeUniversePage() {
  const mountRef = useRef(null);
  const [graph, setGraph] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get('/graph/knowledge-map')
      .then((response) => setGraph(response.data.data))
      .catch((err) => setError(getErrorMessage(err, '获取图谱数据失败')));
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !graph || graph.nodes.length === 0) return undefined;
    const stage = createStage(container);
    const objects = createGraphObjects(stage.scene, graph);

    // d3 会改写传进去的对象（加 x/y/z、把 link 的 source/target 换成节点对象），所以传副本
    const simNodes = graph.nodes.map((node) => ({ id: node.id }));
    const simLinks = graph.links.map((link) => ({ source: link.source, target: link.target }));
    const simulation = forceSimulation(simNodes, 3)
      .force(
        'link',
        forceLink(simLinks)
          .id((node) => node.id)
          .distance(70),
      )
      .force('charge', forceManyBody().strength(-160))
      .force('center', forceCenter(0, 0, 0))
      // forceCenter 只平移整体，不拉单个点；没有连线的知识点会被斥力一路推出画面，所以每个点再加一点向原点的引力
      .force('x', forceX(0).strength(0.08))
      .force('y', forceY(0).strength(0.08))
      .force('z', forceZ(0).strength(0.08))
      // d3 默认用自己的定时器推进；这里停掉，改在 Three.js 的动画循环里每帧推进一步，两边节奏一致
      .stop();

    stage.onFrame(() => {
      if (simulation.alpha() < simulation.alphaMin()) return; // 已经稳定，不再挪动
      simulation.tick();
      simNodes.forEach((node, i) => objects.meshes[i].position.set(node.x, node.y, node.z));
      objects.updateLines();
    });

    // 点击选中：pointerdown 记下位置，pointerup 时位移很小才算点击，否则是在拖动视角
    let downAt = null;
    const onPointerDown = (event) => {
      downAt = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event) => {
      if (!downAt) return;
      const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
      downAt = null;
      if (moved > CLICK_TOLERANCE) return;
      const node = pickNode(event, stage.canvas, stage.camera, objects.meshes);
      objects.highlight(node?.id ?? null, { dimOthers: true });
      setSelected(node ? { node, neighbors: objects.neighbors.get(node.id).size } : null);
    };
    // 悬停只换鼠标指针，提示这里能点
    const onPointerMove = (event) => {
      if (downAt) return;
      stage.canvas.style.cursor = pickNode(event, stage.canvas, stage.camera, objects.meshes) ? 'pointer' : '';
    };
    stage.canvas.addEventListener('pointerdown', onPointerDown);
    stage.canvas.addEventListener('pointerup', onPointerUp);
    stage.canvas.addEventListener('pointermove', onPointerMove);

    return () => {
      stage.canvas.removeEventListener('pointerdown', onPointerDown);
      stage.canvas.removeEventListener('pointerup', onPointerUp);
      stage.canvas.removeEventListener('pointermove', onPointerMove);
      simulation.stop();
      stage.dispose();
      setSelected(null);
    };
  }, [graph]);

  if (error) return <p className="error">{error}</p>;
  if (!graph) return <p className="muted">正在加载知识宇宙…</p>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>知识宇宙</h1>
          <p className="muted">
            星球的位置由力导向布局算出：有连线的知识点被拉近，没关系的互相推开。点击星球选中它，再点空白处取消。
          </p>
        </div>
      </div>
      {graph.nodes.length === 0 ? (
        <div className="empty">
          还没有知识点。<Link to="/kp/new">去新建一个</Link>
        </div>
      ) : (
        <>
          <div className="three-stage" ref={mountRef} />
          <p className="small muted universe-info">
            {selected ? (
              <>
                已选中：<b>{selected.node.name}</b>，和 {selected.neighbors} 个知识点相连。{' '}
                <Link to={`/kp/${selected.node.id}`}>打开这个知识点</Link>
              </>
            ) : (
              `${graph.nodes.length} 个知识点 · ${graph.links.length} 条连线。白线：正文提到了对方；蓝线：内容相似。`
            )}
          </p>
        </>
      )}
    </div>
  );
}

export default KnowledgeUniversePage;
