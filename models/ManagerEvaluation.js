/**
 * Manager Evaluation Model
 * Anonymous manager evaluation system
 */

const mongoose = require('mongoose');

// Evaluation questions
const EVALUATION_QUESTIONS = [
  { id: 'communication', question: 'manager_communicates', textAr: 'يتواصل المدير بوضوح مع الفريق' },
  { id: 'fairness', question: 'treats_fairly', textAr: 'يعامل المدير الموظفين بعدالة' },
  { id: 'development', question: 'supports_development', textAr: 'يدعم المدير تطور الموظفين' },
  { id: 'feedback', question: 'listens_feedback', textAr: 'يستمع المدير لآراء الفريق' },
  { id: 'problem_solving', question: 'resolves_problems', textAr: 'يحل المدير المشكلات بفعالية' },
  { id: 'goals', question: 'communicates_goals', textAr: 'يوضح المدير الأهداف والتوقعات' },
  { id: 'environment', question: 'positive_environment', textAr: 'يخلق المدير بيئة عمل إيجابية' }
];

// Get current evaluation period (Q1-Q4 based on current quarter)
const getEvaluationPeriod = () => {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${quarter}-${now.getFullYear()}`;
};

// Evaluation period schema
const evaluationPeriodSchema = new mongoose.Schema({
  period: {
    type: String,
    required: true,
    unique: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Individual evaluation response (no employee identifier)
const evaluationResponseSchema = new mongoose.Schema({
  period: {
    type: String,
    required: true
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  responses: [{
    questionId: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 }
  }],
  strengthsComment: { type: String, default: null },
  improvementsComment: { type: String, default: null },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes for efficient queries
evaluationResponseSchema.index({ period: 1, manager: 1 });
evaluationResponseSchema.index({ period: 1 });

// Check if employee already submitted evaluation for this period
evaluationResponseSchema.statics.hasSubmitted = async function(period, managerId) {
  const existing = await this.findOne({ period, manager: managerId });
  return !!existing;
};

// Get aggregated results for a manager in a period
evaluationResponseSchema.statics.getAggregatedResults = async function(period, managerId) {
  const responses = await this.find({ period, manager: managerId });
  
  if (responses.length < 5) {
    return null;
  }
  
  const questionTotals = {};
  const questionCounts = {};
  
  responses.forEach(response => {
    response.responses.forEach(r => {
      if (!questionTotals[r.questionId]) {
        questionTotals[r.questionId] = 0;
        questionCounts[r.questionId] = 0;
      }
      questionTotals[r.questionId] += r.rating;
      questionCounts[r.questionId]++;
    });
  });
  
  const averages = Object.keys(questionTotals).map(qId => ({
    questionId: qId,
    average: questionTotals[qId] / questionCounts[qId],
    count: questionCounts[qId]
  }));
  
  const overallAverage = averages.reduce((sum, q) => sum + q.average, 0) / averages.length;
  
  const allComments = responses
    .filter(r => r.strengthsComment || r.improvementsComment)
    .map(r => ({
      strengths: r.strengthsComment,
      improvements: r.improvementsComment
    }));
  
  return {
    responseCount: responses.length,
    overallAverage: overallAverage.toFixed(2),
    questionAverages: averages,
    comments: allComments
  };
};

const EvaluationPeriod = mongoose.model('EvaluationPeriod', evaluationPeriodSchema);
const EvaluationResponse = mongoose.model('EvaluationResponse', evaluationResponseSchema);

module.exports = { 
  EvaluationPeriod, 
  EvaluationResponse, 
  EVALUATION_QUESTIONS,
  getEvaluationPeriod 
};