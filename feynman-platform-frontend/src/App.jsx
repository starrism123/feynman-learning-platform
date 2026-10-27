import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import KnowledgePointFormPage from './pages/KnowledgePointFormPage';
import KnowledgePointDetailPage from './pages/KnowledgePointDetailPage';
import FeynmanRecordPage from './pages/FeynmanRecordPage';
import QuizPage from './pages/QuizPage';
import AgentPage from './pages/AgentPage';

// 图表库体积大，按需加载：只有打开图谱页时才下载 ECharts
const GraphPage = lazy(() => import('./pages/GraphPage'));
const ThreeJSPage = lazy(() => import('./pages/ThreeJSPage'));
const KnowledgeUniversePage = lazy(() => import('./pages/KnowledgeUniversePage'));
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* 公共路由 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* 受保护的路由：没有 token 会被 ProtectedRoute 重定向到登录页 */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/kp/new" element={<KnowledgePointFormPage />} />
          <Route path="/kp/edit/:id" element={<KnowledgePointFormPage />} />
          <Route path="/kp/:id" element={<KnowledgePointDetailPage />} />
          <Route path="/feynman/:id" element={<FeynmanRecordPage />} />
          <Route path="/quiz/:id" element={<QuizPage />} />
          <Route path="/agent" element={<AgentPage />} />
          <Route
            path="/graph"
            element={
              <Suspense fallback={<p className="muted">正在加载…</p>}>
                <GraphPage />
              </Suspense>
            }
          />
          <Route
            path="/3d-world"
            element={
              <Suspense fallback={<p className="muted">正在加载…</p>}>
                <ThreeJSPage />
              </Suspense>
            }
          />
          <Route
            path="/universe"
            element={
              <Suspense fallback={<p className="muted">正在加载…</p>}>
                <KnowledgeUniversePage />
              </Suspense>
            }
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
