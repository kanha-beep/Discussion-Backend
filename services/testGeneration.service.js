const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://127.0.0.1:8000";

const defaultInstructions = [
  "Each question has one correct answer.",
  "You can skip questions or mark them for review before submitting.",
  "Use the profile Tests section to revisit your attempted papers and scores.",
];

const cleanTopic = (prompt) =>
  String(prompt || "")
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (value) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const buildFallbackQuestions = (topic) => {
  const normalizedTopic = titleCase(topic || "General Knowledge");
  const stems = [
    {
      subject: `${normalizedTopic} Basics`,
      prompt: `Which statement best describes the central idea of ${normalizedTopic}?`,
      options: [
        "It focuses only on unrelated side facts.",
        `It covers the main concepts, context, and key understanding of ${normalizedTopic}.`,
        "It excludes any foundational knowledge.",
        "It can never be explained using examples.",
      ],
      correctOption: "B",
      explanation: `A strong answer about ${normalizedTopic} should cover the main concepts and context rather than random details.`,
    },
    {
      subject: `${normalizedTopic} Application`,
      prompt: `Why is practical understanding of ${normalizedTopic} important?`,
      options: [
        "Because it helps connect theory with real-world use.",
        "Because it avoids any need for examples.",
        "Because it removes the need for revision.",
        "Because it guarantees every answer is the same.",
      ],
      correctOption: "A",
      explanation: `Application matters because learners should connect ${normalizedTopic} concepts to real situations.`,
    },
    {
      subject: `${normalizedTopic} Analysis`,
      prompt: `When evaluating a topic like ${normalizedTopic}, what should a learner do first?`,
      options: [
        "Ignore definitions and context.",
        "Memorize one line only.",
        "Identify the main idea and supporting details.",
        "Skip the topic entirely.",
      ],
      correctOption: "C",
      explanation: `Good analysis starts with the main idea and the supporting details around ${normalizedTopic}.`,
    },
    {
      subject: `${normalizedTopic} Reasoning`,
      prompt: `Which approach shows stronger reasoning in ${normalizedTopic}?`,
      options: [
        "Choosing an answer without evidence",
        "Comparing options and selecting the one best supported by facts",
        "Avoiding all explanations",
        "Selecting the longest option by default",
      ],
      correctOption: "B",
      explanation: "Reasoning improves when the learner compares options and uses evidence.",
    },
    {
      subject: `${normalizedTopic} Revision`,
      prompt: `What is the most effective revision strategy for ${normalizedTopic}?`,
      options: [
        "Review concepts, practice questions, and learn from mistakes",
        "Read once and never revisit",
        "Skip incorrect answers",
        "Focus only on question length",
      ],
      correctOption: "A",
      explanation: "Revision works best when concepts, practice, and mistake analysis are combined.",
    },
  ];

  return stems.map((item, index) => ({
    number: index + 1,
    prompt: item.prompt,
    subject: item.subject,
    difficulty: index < 2 ? "Easy" : index < 4 ? "Medium" : "Hard",
    options: item.options.map((text, optionIndex) => ({
      key: ["A", "B", "C", "D"][optionIndex],
      text,
    })),
    correctOption: item.correctOption,
    explanation: item.explanation,
  }));
};

const normalizeGeneratedPayload = (prompt, payload) => {
  const questions = Array.isArray(payload?.questions) ? payload.questions : [];
  const normalizedQuestions = questions.map((question, index) => ({
    number: index + 1,
    prompt: question.prompt,
    subject: question.subject || `Question ${index + 1}`,
    difficulty: ["Easy", "Medium", "Hard"].includes(question.difficulty)
      ? question.difficulty
      : "Medium",
    options: question.options,
    correctOption: question.correctOption,
    explanation: question.explanation,
  }));

  return {
    title: payload?.title || `AI Test on ${titleCase(prompt)}`,
    description:
      payload?.description ||
      `Prompt-based practice paper generated for ${cleanTopic(prompt)}.`,
    durationMinutes: Number(payload?.durationMinutes) || Math.max(10, normalizedQuestions.length * 2),
    totalMarks: normalizedQuestions.length,
    instructions:
      Array.isArray(payload?.instructions) && payload.instructions.length
        ? payload.instructions
        : defaultInstructions,
    questions: normalizedQuestions,
  };
};

async function requestPythonGeneration(prompt) {
  const response = await fetch(`${PYTHON_AI_URL}/generate-test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "AI service request failed" }));
    throw new Error(error.detail || "AI service request failed");
  }

  return response.json();
}

export async function generateTestFromPrompt(prompt) {
  const cleanedPrompt = cleanTopic(prompt);

  try {
    const generated = await requestPythonGeneration(cleanedPrompt);
    const normalized = normalizeGeneratedPayload(cleanedPrompt, generated);
    if (normalized.questions.length) {
      return normalized;
    }
  } catch (error) {
    console.log("test generation fallback:", error?.message || error);
  }

  const fallbackQuestions = buildFallbackQuestions(cleanedPrompt);
  return {
    title: `Practice Test: ${titleCase(cleanedPrompt)}`,
    description: `Auto-prepared practice test based on the prompt "${cleanedPrompt}".`,
    durationMinutes: Math.max(10, fallbackQuestions.length * 2),
    totalMarks: fallbackQuestions.length,
    instructions: defaultInstructions,
    questions: fallbackQuestions,
  };
}
