import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient, { getErrorMessage } from '../api/axios';

const DIFFICULTIES = ['基础', '中等', '困难'];
const TYPES = [
  { value: 'single-choice', label: '单选题' },
  { value: 'short-answer', label: '简答题' },
];

function QuizPage() {
  const { id } = useParams(); // 知识点 ID
  const [knowledgePoint, setKnowledgePoint] = useState(null);
  const [type, setType] = useState('single-choice');
  const [question, setQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [result, setResult] = useState(null); // { isCorrect, explanation, score? }
  const [isLoading, setIsLoading] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState('');

  // 1. 加载知识点
  useEffect(() => {
    apiClient
      .get(`/knowledge-points/${id}`)
      .then((response) => setKnowledgePoint(response.data.data.knowledgePoint))
      .catch((err) => setError(getErrorMessage(err, '读取知识点失败')));
  }, [id]);

  // 2. 选好难度后请 AI 出题
  const fetchQuestion = async (difficulty) => {
    setIsLoading(true);
    setQuestion(null);
    setResult(null);
    setSelectedOption('');
    setAnswerText('');
    setError('');
    try {
      const response = await apiClient.post('/ai/generate-question', {
        knowledgePointId: id,
        difficulty,
        type,
      });
      setQuestion(response.data.data);
    } catch (err) {
      setError(getErrorMessage(err, 'AI 出题失败，请重试'));
    } finally {
      setIsLoading(false);
    }
  };

  // 答错了就把知识点放进复习列表
  const markForReview = async () => {
    try {
      await apiClient.patch(`/knowledge-points/${id}`, { reviewList: true });
    } catch {
      // 标记失败不影响答题结果展示
    }
  };

  // 3. 提交答案：单选题前端直接比对，简答题交给 AI 阅卷
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (question.type === 'single-choice') {
      if (!selectedOption) return;
      const isCorrect = selectedOption === question.answer;
      setResult({ isCorrect, explanation: question.explanation });
      if (!isCorrect) markForReview();
      return;
    }

    if (!answerText.trim()) return;
    setIsGrading(true);
    try {
      const response = await apiClient.post('/ai/grade-answer', {
        question: question.question,
        answerKeyPoints: question.answer_key_points,
        studentAnswer: answerText,
      });
      setResult(response.data.data);
      if (!response.data.data.isCorrect) markForReview();
    } catch (err) {
      setError(getErrorMessage(err, 'AI 阅卷失败，请重试'));
    } finally {
      setIsGrading(false);
    }
  };

  if (!knowledgePoint) {
    return error ? <p className="error">{error}</p> : <p className="muted">加载中…</p>;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <Link to={`/kp/${id}`} className="muted small">
            ← 返回知识点
          </Link>
          <h1>测评：{knowledgePoint.title}</h1>
          <p className="muted">选题型和难度，AI 现场出题。</p>
        </div>
      </div>

      <section className="panel">
        <div className="row">
          <span className="muted">题型</span>
          {TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`btn btn-small ${type === item.value ? 'btn-selected' : ''}`}
              onClick={() => setType(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <span className="muted">难度</span>
          {DIFFICULTIES.map((difficulty) => (
            <button
              key={difficulty}
              type="button"
              className="btn btn-small"
              onClick={() => fetchQuestion(difficulty)}
              disabled={isLoading}
            >
              {difficulty}
            </button>
          ))}
        </div>
      </section>

      {isLoading && <p className="muted">AI 出题官正在出题…</p>}
      {error && <p className="error">{error}</p>}

      {question && (
        <form className="panel" onSubmit={handleSubmit}>
          <div className="feedback-head">
            <h2>{question.question}</h2>
            <span className="muted small">
              {question.difficulty} · {question.provider}
            </span>
          </div>

          {question.type === 'single-choice' ? (
            <div className="options">
              {Object.entries(question.options).map(([key, value]) => {
                const answered = Boolean(result);
                const isAnswer = answered && key === question.answer;
                const isWrongPick = answered && key === selectedOption && !result.isCorrect;
                return (
                  <label
                    key={key}
                    className={`option ${selectedOption === key ? 'picked' : ''} ${
                      isAnswer ? 'right' : ''
                    } ${isWrongPick ? 'wrong' : ''}`}
                  >
                    <input
                      type="radio"
                      name="option"
                      value={key}
                      checked={selectedOption === key}
                      onChange={(e) => setSelectedOption(e.target.value)}
                      disabled={answered}
                    />
                    <b>{key}.</b> {value}
                  </label>
                );
              })}
            </div>
          ) : (
            <textarea
              className="transcript"
              rows={5}
              placeholder="用自己的话作答…"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              disabled={Boolean(result)}
            />
          )}

          {!result && (
            <button type="submit" className="btn btn-primary" disabled={isGrading}>
              {isGrading ? 'AI 阅卷中…' : '提交答案'}
            </button>
          )}

          {result && (
            <div className={`result ${result.isCorrect ? 'good' : 'bad'}`}>
              <strong>
                {result.isCorrect ? '回答正确' : '回答错误，已加入复习列表'}
                {typeof result.score === 'number' && `（${result.score} 分）`}
              </strong>
              <p>{result.explanation}</p>
              {question.answer_key_points && (
                <>
                  <p className="muted small">答案要点：</p>
                  <ul>
                    {question.answer_key_points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export default QuizPage;
