// 第 8、9 课的 Prompt 集中放在这里：角色 + 明确任务 + 输入材料 + 严格的 JSON 输出格式

function feynmanEvaluationPrompt({ title, originalContent, transcribedText }) {
  return [
    {
      role: "system",
      content:
        "你是一位严格而友善的学习教练，熟悉费曼学习法：能用简单的话把概念讲清楚，才算真正学会。你只输出 JSON。",
    },
    {
      role: "user",
      content: `下面是一个知识点的原文，以及学生凭记忆口头复述后经语音识别得到的文字（可能有错别字和口语化表达）。

【知识点标题】${title}

【知识点原文】
"""
${originalContent}
"""

【学生的复述】
"""
${transcribedText}
"""

请完成两件事：
1. 润色：把学生的复述改写成通顺的书面语，保留学生自己的讲法，修正识别错字。不要补充学生没讲到的内容；学生讲错的地方也照原意保留，不要在润色里改对，错误留到评价里指出。
2. 评价：对照原文，从准确性、清晰度、完整性、简洁性四个方面各打 1–10 分，再给出 0–100 的综合分。分数要根据这次复述的实际表现打，讲错一处关键概念，准确性不应超过 6 分。

严格按以下 JSON 格式返回，尖括号里是填写说明，不要原样照抄，也不要输出任何其他文字：
{
  "polishedText": "<润色后的文本>",
  "dimensions": { "accuracy": <1-10 整数>, "clarity": <1-10 整数>, "completeness": <1-10 整数>, "conciseness": <1-10 整数> },
  "score": <0-100 整数>,
  "evaluation": "<一两句话的综合评价>",
  "strengths": ["<学生这次讲对、讲清楚的具体内容>"],
  "weaknesses": ["<具体讲错或遗漏的知识点，并说明正确的说法>"]
}`,
    },
  ];
}

const QUESTION_FORMATS = {
  "single-choice": `{
  "type": "single-choice",
  "difficulty": "{{difficulty}}",
  "question": "<题干>",
  "options": { "A": "<选项>", "B": "<选项>", "C": "<选项>", "D": "<选项>" },
  "answer": "<正确选项的字母>",
  "explanation": "<为什么这个选项正确，其他选项错在哪>"
}`,
  "short-answer": `{
  "type": "short-answer",
  "difficulty": "{{difficulty}}",
  "question": "<题干>",
  "answer_key_points": ["<答案要点>", "<答案要点>", "<答案要点>"]
}`,
};

function questionPrompt({ content, difficulty, type }) {
  const format = QUESTION_FORMATS[type].replace("{{difficulty}}", difficulty);
  const typeName = type === "single-choice" ? "单项选择题" : "简答题";
  return [
    {
      role: "system",
      content: "你是一个专业的计算机科学出题专家。你只输出 JSON。",
    },
    {
      role: "user",
      content: `请根据以下知识点内容和指定难度，出一道${typeName}。题目必须能从知识点内容中找到依据。如果是选择题：只有一个选项正确，其余选项必须明确是错的；正确答案放在 A–D 中随机的位置。

【知识点内容】
"""
${content}
"""

【指定难度】${difficulty}（基础：考概念记忆；中等：考理解和对比；困难：考在新场景中的运用）

严格按以下 JSON 格式返回，尖括号里是填写说明，确保所有字段都存在，不要输出任何其他文字：
${format}`,
    },
  ];
}

function gradePrompt({ question, answerKeyPoints, studentAnswer }) {
  return [
    {
      role: "system",
      content: "你是一个客观的计算机科学阅卷老师。你只输出 JSON。",
    },
    {
      role: "user",
      content: `请根据题目、答案要点和学生的回答，判断学生是否答对，并给出理由。覆盖了大部分要点、没有原则性错误即可判为正确。

【题目】${question}

【答案要点】
${answerKeyPoints.map((point, index) => `${index + 1}. ${point}`).join("\n")}

【学生的回答】
${studentAnswer}

严格按以下 JSON 格式返回，尖括号里是填写说明，不要输出任何其他文字：
{
  "isCorrect": <true 或 false>,
  "score": <0-100 整数>,
  "explanation": "<评判理由：答到了哪些要点，漏了或讲错了什么>"
}`,
    },
  ];
}

module.exports = { feynmanEvaluationPrompt, questionPrompt, gradePrompt };
