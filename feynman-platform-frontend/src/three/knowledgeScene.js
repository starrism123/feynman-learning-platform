import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

// 第 13、14 课共用的 Three.js 场景代码。
// 两个页面的区别只在「节点放在哪」：第 13 课随机撒点，第 14 课用力导向布局。

const COLORS = {
  background: 0x0e1726,
  node: 0x5b8ff9,
  unindexed: 0x8a93a3,
  focus: 0xffb020,
  neighbor: 0x7fd1ff,
  reference: 0xe8ecf3,
  similar: 0x6ea0ff,
};

// 舞台：场景 + 相机 + 渲染器 + 轨道控制器 + 灯光 + 动画循环。
// 返回 dispose，React 组件卸载时必须调用：React 开发模式会把 useEffect 执行两次，
// 不清理的话画布会叠两层、显存一直涨
export function createStage(container) {
  const width = container.clientWidth;
  const height = container.clientHeight;

  // 1. 场景：所有物体、灯光都放在这里
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.background);

  // 2. 透视相机：视角 60 度，近大远小
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
  camera.position.set(0, 0, 240);

  // 3. 渲染器：把相机看到的画面画到 <canvas> 上
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // 节点的文字标签用 HTML 叠在画布上，比在 3D 里画文字清楚
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(width, height);
  labelRenderer.domElement.className = 'label-layer';
  container.appendChild(labelRenderer.domElement);

  // 4. 轨道控制器：左键旋转、滚轮缩放、右键平移；阻尼让转动有惯性
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // 5. 灯光：MeshStandardMaterial 需要光才看得见
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const light = new THREE.DirectionalLight(0xffffff, 1.6);
  light.position.set(100, 150, 200);
  scene.add(light);

  // 6. 容器大小变化（窗口缩放、侧栏展开）时同步相机和画布
  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  });
  resizeObserver.observe(container);

  // 7. 动画循环：每帧先跑各页面登记的回调（转立方体、推进力导向模拟），再渲染
  const callbacks = [];
  let frame = 0;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    callbacks.forEach((callback) => callback());
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  };
  frame = requestAnimationFrame(loop);

  return {
    scene,
    camera,
    canvas: renderer.domElement,
    onFrame: (callback) => callbacks.push(callback),
    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
      container.removeChild(labelRenderer.domElement);
    },
  };
}

// 把图谱数据变成 3D 物体：知识点是球（星球），连线是线段（航线）
export function createGraphObjects(scene, { nodes, links }) {
  const sphere = new THREE.SphereGeometry(1, 24, 24);
  const meshes = [];
  const meshById = new Map();
  for (const node of nodes) {
    const material = new THREE.MeshStandardMaterial({
      color: node.indexed ? COLORS.node : COLORS.unindexed,
      roughness: 0.4,
      transparent: true,
    });
    const mesh = new THREE.Mesh(sphere, material);
    // 半径随内容长度变化：接口的 symbolSize 是 20–50，换算成半径 5–12.5
    mesh.scale.setScalar(node.symbolSize / 4);
    mesh.userData.node = node;

    // 标题用 textContent 填，不拼 HTML，避免 XSS
    const label = document.createElement('div');
    label.className = 'node-label';
    label.textContent = node.name;
    const labelObject = new CSS2DObject(label);
    labelObject.position.set(0, 1.6, 0);
    mesh.add(labelObject);
    mesh.userData.label = label;

    scene.add(mesh);
    meshes.push(mesh);
    meshById.set(node.id, mesh);
  }

  const lines = [];
  const neighbors = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const link of links) {
    const source = meshById.get(link.source);
    const target = meshById.get(link.target);
    if (!source || !target) continue;
    const geometry = new THREE.BufferGeometry().setFromPoints([source.position, target.position]);
    const material = new THREE.LineBasicMaterial({
      color: link.type === 'reference' ? COLORS.reference : COLORS.similar,
      transparent: true,
      opacity: link.type === 'reference' ? 0.9 : 0.55,
    });
    const line = new THREE.Line(geometry, material);
    line.userData = { link, source, target, baseOpacity: material.opacity };
    scene.add(line);
    lines.push(line);
    neighbors.get(link.source).add(link.target);
    neighbors.get(link.target).add(link.source);
  }

  // 节点挪动后（力导向布局每一帧都在挪），把线段两端拉到球心
  const updateLines = () => {
    for (const line of lines) {
      const { source, target } = line.userData;
      const position = line.geometry.attributes.position;
      position.setXYZ(0, source.position.x, source.position.y, source.position.z);
      position.setXYZ(1, target.position.x, target.position.y, target.position.z);
      position.needsUpdate = true;
      line.geometry.computeBoundingSphere();
    }
  };

  // 高亮一个节点和它的连线、邻居；dimOthers 时其余的变暗（第 14 课点击选中用）
  const highlight = (focusId, { dimOthers = false } = {}) => {
    const related = focusId ? neighbors.get(focusId) : null;
    for (const mesh of meshes) {
      const { id } = mesh.userData.node;
      const isFocus = id === focusId;
      const isNeighbor = related?.has(id);
      mesh.material.emissive.setHex(isFocus ? COLORS.focus : isNeighbor ? COLORS.neighbor : 0x000000);
      mesh.material.emissiveIntensity = isFocus ? 0.9 : 0.35;
      const visible = !focusId || !dimOthers || isFocus || isNeighbor;
      mesh.material.opacity = visible ? 1 : 0.2;
      mesh.userData.label.style.opacity = visible ? '1' : '0.25';
    }
    for (const line of lines) {
      const touches = focusId && (line.userData.link.source === focusId || line.userData.link.target === focusId);
      line.material.color.setHex(
        touches ? COLORS.focus : line.userData.link.type === 'reference' ? COLORS.reference : COLORS.similar,
      );
      line.material.opacity = touches ? 1 : focusId && dimOthers ? 0.06 : line.userData.baseOpacity;
    }
  };

  return { meshes, meshById, neighbors, updateLines, highlight };
}

// 鼠标拾取：从相机穿过鼠标位置发一条射线，看先碰到哪个球。
// 坐标要按画布自己的位置和大小换算，不能用 window.innerWidth：画布没占满窗口时会点偏
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
export function pickNode(event, canvas, camera, meshes) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(meshes, false)[0]?.object.userData.node ?? null;
}
