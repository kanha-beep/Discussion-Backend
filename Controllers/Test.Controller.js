import { ExpressError } from "../Middlewares/ExpressError.js";
import { Test } from "../Models/Test.Model.js";
import { TestSubmission } from "../Models/TestSubmission.Model.js";
import { User } from "../Models/User.Models.js";
import { generateTestFromPrompt } from "../services/testGeneration.service.js";
import { sendTestSummaryMail } from "../services/testMail.service.js";
import { evaluateTestSubmission } from "../utils/evaluateTestSubmission.js";

const mapTestCard = (testDoc) => ({
  _id: testDoc._id,
  title: testDoc.title,
  description: testDoc.description,
  durationMinutes: testDoc.durationMinutes,
  totalMarks: testDoc.totalMarks,
  totalQuestions: testDoc.questions?.length || 0,
  instructions: testDoc.instructions || [],
  promptSource: testDoc.promptSource || "",
  createdAt: testDoc.createdAt,
});

export const listTests = async (req, res) => {
  const tests = await Test.find({ createdBy: req.user._id })
    .sort({ createdAt: -1 })
    .select("title description durationMinutes totalMarks questions instructions promptSource createdAt")
    .lean();

  res.json(tests.map(mapTestCard));
};

export const createGeneratedTest = async (req, res, next) => {
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) {
    return next(new ExpressError(400, "Prompt is required"));
  }

  const generated = await generateTestFromPrompt(prompt);
  if (!generated.questions?.length) {
    return next(new ExpressError(502, "Failed to generate test"));
  }

  const test = await Test.create({
    title: generated.title,
    description: generated.description,
    durationMinutes: generated.durationMinutes,
    totalMarks: generated.totalMarks || generated.questions.length,
    instructions: generated.instructions,
    promptSource: prompt,
    createdBy: req.user._id,
    questions: generated.questions,
  });

  res.status(201).json(mapTestCard(test));
};

export const getTestById = async (req, res, next) => {
  const test = await Test.findOne({ _id: req.params.id, createdBy: req.user._id }).lean();
  if (!test) {
    return next(new ExpressError(404, "Test not found"));
  }

  res.json({
    ...mapTestCard(test),
    questions: test.questions.map((question) => ({
      _id: question._id,
      number: question.number,
      prompt: question.prompt,
      subject: question.subject,
      difficulty: question.difficulty,
      options: question.options,
    })),
  });
};

export const listSubmissions = async (req, res) => {
  const candidateName = String(req.query?.candidateName || "").trim();
  const filter = { userId: req.user._id };
  if (candidateName) {
    filter.candidateName = candidateName;
  }

  const submissions = await TestSubmission.find(filter)
    .sort({ createdAt: -1 })
    .populate("testId", "title totalMarks durationMinutes description")
    .lean();

  res.json(
    submissions.map((submission) => ({
      _id: submission._id,
      candidateName: submission.candidateName,
      score: submission.score,
      summary: submission.summary,
      submittedAt: submission.createdAt,
      test: submission.testId,
    })),
  );
};

export const submitTest = async (req, res, next) => {
  const test = await Test.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!test) {
    return next(new ExpressError(404, "Test not found"));
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ExpressError(404, "User not found"));
  }

  const payloadAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const candidateName =
    String(req.body?.candidateName || "").trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email?.split("@")[0] ||
    "User";

  const evaluation = evaluateTestSubmission(test, payloadAnswers);

  const submission = await TestSubmission.create({
    testId: test._id,
    userId: user._id,
    candidateName,
    answers: payloadAnswers,
    score: evaluation.score,
    summary: evaluation.summary,
    evaluatedAnswers: evaluation.evaluatedAnswers,
  });

  await sendTestSummaryMail({ user, test, submission });

  res.status(201).json({
    submissionId: submission._id,
    testId: test._id,
    candidateName: submission.candidateName,
    score: submission.score,
    summary: submission.summary,
    submittedAt: submission.createdAt,
  });
};

export const getSubmissionById = async (req, res, next) => {
  const submission = await TestSubmission.findOne({
    _id: req.params.id,
    userId: req.user._id,
  })
    .populate("testId", "title totalMarks durationMinutes description")
    .lean();

  if (!submission) {
    return next(new ExpressError(404, "Submission not found"));
  }

  res.json({
    _id: submission._id,
    candidateName: submission.candidateName,
    score: submission.score,
    summary: submission.summary,
    submittedAt: submission.createdAt,
    test: submission.testId,
    evaluatedAnswers: submission.evaluatedAnswers,
  });
};
