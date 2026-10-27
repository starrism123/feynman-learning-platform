// 分镜表：讲稿每一段（section）里的自然段（paras，从 0 数）配什么画面。
// still：output/stills 里的图；diagram：架构图，居中放在白底上；clip：output/clips 里的录屏。
// clip 默认按配音长度适当加速（最多 maxSpeed 倍），比配音短就停在最后一帧；fit: "tail" 只用最后一帧。
export const plan = [
  {
    section: 0,
    shots: [
      { paras: [0, 1], still: "title" },
      { paras: [2], clip: "tour" },
    ],
  },
  {
    section: 1,
    shots: [
      { paras: [0], diagram: "arch-all" },
      { paras: [1], diagram: "arch-fe" },
      { paras: [2], diagram: "arch-be" },
      { paras: [3], diagram: "arch-whisper" },
      { paras: [4], diagram: "arch-llm" },
      { paras: [5], diagram: "arch-all" },
    ],
  },
  {
    section: 2,
    shots: [
      { paras: [0], clip: "register" },
      { paras: [1], clip: "login" },
      { paras: [2, 3], still: "code1-auth" },
      { paras: [4], clip: "login", fit: "tail" },
    ],
  },
  {
    section: 3,
    shots: [
      { paras: [0], clip: "search" },
      { paras: [1], clip: "editor" },
      { paras: [2, 3], clip: "saved" },
    ],
  },
  {
    section: 4,
    shots: [
      {
        paras: [0],
        clip: "record-start",
        maxSpeed: 4,
        // 旁白念完后，放几秒学生复述的原声
        tailAudio: {
          file: "assets/student-retell.mp3",
          start: 0,
          duration: 6,
          caption: "（学生复述录音）",
        },
      },
      { paras: [1], clip: "record-stop" },
      { paras: [2], still: "code2-recorder" },
      { paras: [3], still: "code2-whisper" },
      { paras: [4], still: "transcript" },
    ],
  },
  {
    section: 5,
    shots: [
      { paras: [0], diagram: "sequence" },
      { paras: [1], clip: "evaluate" },
      { paras: [2], still: "code3-llm" },
      { paras: [3], still: "code4-prompt" },
    ],
  },
  {
    section: 6,
    shots: [
      { paras: [0, 1], clip: "quiz-single" },
      { paras: [2], clip: "quiz-short" },
      { paras: [3], clip: "quiz-short", fit: "tail" },
    ],
  },
  {
    section: 7,
    shots: [
      { paras: [0, 1], still: "term-verify" },
      { paras: [2], clip: "swagger" },
      { paras: [3], still: "term-git" },
      { paras: [4], still: "term-record" },
      { paras: [5], clip: "review" },
      { paras: [6], diagram: "arch-all" },
      { paras: [7], still: "end" },
    ],
  },
];
