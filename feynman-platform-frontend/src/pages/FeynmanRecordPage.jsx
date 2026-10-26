import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient, { getErrorMessage } from '../api/axios';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { STATUS_LABELS } from '../constants';

const RECORD_STATUS = {
  idle: '准备就绪',
  recording: '录音中',
  stopped: '已停止',
  denied: '没有麦克风权限',
};

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function FeynmanRecordPage() {
  const { id } = useParams(); // 知识点 ID
  const [kp, setKp] = useState(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get(`/knowledge-points/${id}`)
      .then((response) => setKp(response.data.data.knowledgePoint))
      .catch((err) => setError(getErrorMessage(err, '读取知识点失败')));
  }, [id]);

  // 第 7 课：录音停止后自动上传，后端转发给 Whisper 识别
  const uploadAudio = async (blob) => {
    setIsUploading(true);
    setTranscribedText('');
    setAiFeedback(null);
    setError('');
    try {
      const formData = new FormData();
      formData.append('audio', blob, `feynman-${id}.webm`); // 'audio' 要和后端 multer 字段名一致
      const response = await apiClient.post('/audio/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTranscribedText(response.data.data.result);
    } catch (err) {
      setError(getErrorMessage(err, '上传或转录失败，请重试'));
    } finally {
      setIsUploading(false);
    }
  };

  const recorder = useAudioRecorder({ onStop: uploadAudio });

  // 第 8 课：把复述交给 AI 润色和打分
  const getAiEvaluation = async () => {
    setIsEvaluating(true);
    setAiFeedback(null);
    setError('');
    try {
      const response = await apiClient.post('/ai/evaluate', {
        knowledgePointId: id,
        transcribedText,
      });
      setAiFeedback(response.data.data);
      setKp((old) => ({
        ...old,
        status: response.data.data.status,
        reviewList: response.data.data.reviewList,
      }));
    } catch (err) {
      setError(getErrorMessage(err, '获取 AI 评价失败'));
    } finally {
      setIsEvaluating(false);
    }
  };

  if (!kp) return error ? <p className="error">{error}</p> : <p className="muted">加载中…</p>;

  const recording = recorder.status === 'recording';

  return (
    <div>
      <div className="page-head">
        <div>
          <Link to={`/kp/${id}`} className="muted small">
            ← 返回知识点
          </Link>
          <h1>复述：{kp.title}</h1>
          <p className="muted">不看原文，用自己的话把它讲给一个完全不懂的人听。</p>
        </div>
        <span className={`badge badge-${kp.status}`}>{STATUS_LABELS[kp.status]}</span>
      </div>

      <section className="panel recorder">
        <div className={`record-dot ${recording ? 'on' : ''}`} />
        <div className="record-time">{formatTime(recorder.seconds)}</div>
        <p className="muted">{RECORD_STATUS[recorder.status]}</p>
        <div className="row">
          {recording ? (
            <button type="button" className="btn btn-record" onClick={recorder.stop}>
              ■ 停止录音
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={recorder.start}
              disabled={isUploading}
            >
              ● 开始录音
            </button>
          )}
        </div>
        {recorder.audioUrl && <audio src={recorder.audioUrl} controls />}
      </section>

      <section className="panel">
        <h2>语音识别结果</h2>
        {isUploading && <p className="muted">正在上传并转录，请稍候…</p>}
        {transcribedText && (
          <>
            <textarea
              className="transcript"
              value={transcribedText}
              onChange={(e) => setTranscribedText(e.target.value)}
              rows={5}
            />
            <div className="row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={getAiEvaluation}
                disabled={isEvaluating}
              >
                {isEvaluating ? 'AI 教练正在批阅…' : '请 AI 教练点评'}
              </button>
              <span className="muted small">识别有错字可以先手动改一下</span>
            </div>
          </>
        )}
        {!transcribedText && !isUploading && <p className="muted">录完音后，文字会出现在这里。</p>}
        {error && <p className="error">{error}</p>}
      </section>

      {aiFeedback && (
        <section className="panel feedback">
          <div className="feedback-main">
            <div className="feedback-head">
              <h2>AI 润色后的文本</h2>
              <span className="muted small">
                服务提供方：{aiFeedback.provider}（{(aiFeedback.latencyMs / 1000).toFixed(1)} 秒）
              </span>
            </div>
            <p className="polished">{aiFeedback.polishedText}</p>

            <h2>综合评价</h2>
            <p>{aiFeedback.evaluation}</p>

            <div className="two-col">
              <div>
                <h3>优点</h3>
                <ul>
                  {aiFeedback.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>待改进</h3>
                <ul>
                  {aiFeedback.weaknesses.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <aside className="score-box">
            <span className="muted small">综合得分</span>
            <div className={`score ${aiFeedback.score >= 80 ? 'good' : 'warn'}`}>
              {aiFeedback.score}
            </div>
            <ul className="dims">
              <li>准确 {aiFeedback.dimensions.accuracy}/10</li>
              <li>清晰 {aiFeedback.dimensions.clarity}/10</li>
              <li>完整 {aiFeedback.dimensions.completeness}/10</li>
              <li>简洁 {aiFeedback.dimensions.conciseness}/10</li>
            </ul>
            {aiFeedback.reviewList && <p className="review-tip">低于 60 分，已加入复习列表</p>}
            <Link to={`/quiz/${id}`} className="btn btn-small">
              去做几道题巩固
            </Link>
          </aside>
        </section>
      )}
    </div>
  );
}

export default FeynmanRecordPage;
