import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import apiClient, { getErrorMessage } from '../api/axios';
import { createGraphObjects, createStage, pickNode } from '../three/knowledgeScene';

// 第 13 课：Three.js 入门。
// 「旋转立方体」是讲义的 Hello World：场景、相机、渲染器 + 几何体 × 材质 = 网格；
// 「随机星图」把第 12 课的图谱数据放进 3D：知识点是星球（随机位置），连线是航线。
// 挑战：鼠标悬停在星球上，它和相连的航线一起高亮（Raycaster 光线投射）。
function ThreeJSPage() {
  const mountRef = useRef(null);
  const [mode, setMode] = useState('universe');
  const [graph, setGraph] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get('/graph/knowledge-map')
      .then((response) => setGraph(response.data.data))
      .catch((err) => setError(getErrorMessage(err, '获取图谱数据失败')));
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || (mode === 'universe' && !graph)) return undefined;
    const stage = createStage(container);
    const cleanups = [];

    if (mode === 'cube') {
      // 网格 = 几何体（形状）+ 材质（外观）
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(60, 60, 60),
        new THREE.MeshStandardMaterial({ color: 0x3ddc84 }),
      );
      stage.scene.add(cube);
      stage.onFrame(() => {
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
      });
    } else {
      const objects = createGraphObjects(stage.scene, graph);
      // 讲义的做法：在 200×200×200 的空间里随机放置；第 14 课换成力导向布局
      for (const mesh of objects.meshes) {
        mesh.position.set((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200);
      }
      objects.updateLines();

      // 只在鼠标移动时做一次拾取，不在每一帧都做
      let current = null;
      const onPointerMove = (event) => {
        const node = pickNode(event, stage.canvas, stage.camera, objects.meshes);
        if (node?.id === current?.id) return;
        current = node;
        objects.highlight(node?.id ?? null);
        stage.canvas.style.cursor = node ? 'pointer' : '';
        setHovered(node);
      };
      stage.canvas.addEventListener('pointermove', onPointerMove);
      cleanups.push(() => stage.canvas.removeEventListener('pointermove', onPointerMove));
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      stage.dispose();
      setHovered(null);
    };
  }, [mode, graph]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>3D 视界</h1>
          <p className="muted">左键拖动旋转，滚轮缩放，右键拖动平移。</p>
        </div>
        <div className="row">
          <button
            type="button"
            className={`btn btn-small ${mode === 'universe' ? 'btn-selected' : ''}`}
            onClick={() => setMode('universe')}
          >
            随机星图
          </button>
          <button
            type="button"
            className={`btn btn-small ${mode === 'cube' ? 'btn-selected' : ''}`}
            onClick={() => setMode('cube')}
          >
            入门：旋转立方体
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="three-stage" ref={mountRef} />
      <p className="small muted">
        {mode === 'cube'
          ? '一个立方体 = 几何体（BoxGeometry，形状）+ 材质（MeshStandardMaterial，外观）。'
          : hovered
            ? `鼠标下：${hovered.name}（和它相连的航线已高亮）`
            : '星球位置是随机的；把鼠标移到星球上，它和相连的航线会高亮。力导向布局见导航栏的「知识宇宙」。'}
      </p>
    </div>
  );
}

export default ThreeJSPage;
