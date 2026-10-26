import { useEffect, useRef, useState } from 'react';

// 第 7 课：直接用浏览器的 MediaStream + MediaRecorder 录音。
// 讲义推荐的 react-media-recorder 只声明支持到 React 18，这里自己写一个小 Hook，顺便看清底层原理。
export function useAudioRecorder({ onStop } = {}) {
  const [status, setStatus] = useState('idle'); // idle | recording | stopped | denied
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const onStopRef = useRef(onStop);

  // 回调存在 ref 里，录音中途组件重新渲染也能调用到最新的 onStop
  useEffect(() => {
    onStopRef.current = onStop;
  }, [onStop]);

  const start = async () => {
    try {
      // 向用户申请麦克风权限，只在 HTTPS 或 localhost 下可用
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      // 录音数据是一小块一小块到的，先攒起来
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      // 停止时把所有数据块拼成一个完整的音频文件（Blob）
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        setStatus('stopped');
        onStopRef.current?.(blob);
      };

      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setStatus('recording');
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setStatus('denied');
    }
  };

  const stop = () => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  return { status, seconds, audioUrl, start, stop };
}
