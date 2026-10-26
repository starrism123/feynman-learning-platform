import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div className="empty">
      <h1>页面不存在</h1>
      <Link to="/">回到首页</Link>
    </div>
  );
}

export default NotFoundPage;
