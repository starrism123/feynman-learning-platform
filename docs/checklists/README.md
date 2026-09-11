# 三次课程验收入口

每次课都有一个真实 Git 标签和一份独立检查表：

- [第一课：Express 与 Git](lesson-1.md)
- [第二课：API、MongoDB 与用户](lesson-2.md)
- [第三课：JWT 与知识点 CRUD](lesson-3.md)

查看某课代码：

```powershell
git switch --detach lesson-1
# 验收后回到最终版本
git switch main
```

切换标签前应先确认 `git status` 没有未保存修改。只想浏览而不切换，可用 `git show lesson-1`。
