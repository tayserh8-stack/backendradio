/**
 * Manager Evaluation Controller
 * Handles anonymous manager evaluation logic
 */

const { EvaluationPeriod, EvaluationResponse, EVALUATION_QUESTIONS, getEvaluationPeriod } = require('../models/ManagerEvaluation');
const { User } = require('../models/User');

// Get current evaluation period info
const getCurrentPeriod = async () => {
  const period = getEvaluationPeriod();
  let periodDoc = await EvaluationPeriod.findOne({ period });
  
  if (!periodDoc) {
    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    const quarterStartMonth = (quarter - 1) * 3;
    const startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
    const endDate = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
    
    periodDoc = await EvaluationPeriod.create({
      period,
      startDate,
      endDate,
      isActive: true
    });
  }
  
  return periodDoc;
};

// Check if evaluation period is open
const isPeriodOpen = async (period) => {
  const periodDoc = await EvaluationPeriod.findOne({ period });
  if (!periodDoc) return false;
  
  const now = new Date();
  return periodDoc.isActive && now >= periodDoc.startDate && now <= periodDoc.endDate;
};

// Get evaluation form data (questions)
exports.getQuestions = async (req, res) => {
  try {
    const period = await getCurrentPeriod();
    const questions = EVALUATION_QUESTIONS.map(q => ({
      id: q.id,
      questionAr: q.textAr
    }));
    
    res.json({
      success: true,
      data: {
        period: period.period,
        startDate: period.startDate,
        endDate: period.endDate,
        isOpen: period.isActive,
        questions
      }
    });
  } catch (error) {
    console.error('Error getting questions:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب بيانات التقييم' });
  }
};

// Submit evaluation
exports.submitEvaluation = async (req, res) => {
  try {
    const { managerId, responses, strengthsComment, improvementsComment } = req.body;
    const period = getEvaluationPeriod();
    
    const periodDoc = await getCurrentPeriod();
    if (!periodDoc.isActive) {
      return res.status(400).json({ success: false, message: 'فترة التقييم مغلقة حالياً' });
    }
    
    const now = new Date();
    if (now < periodDoc.startDate || now > periodDoc.endDate) {
      return res.status(400).json({ success: false, message: 'فترة التقييم غير مفتوحة' });
    }
    
    if (!managerId || !responses || responses.length === 0) {
      return res.status(400).json({ success: false, message: 'يرجى إكمال جميع حقول التقييم' });
    }
    
    const hasSubmitted = await EvaluationResponse.hasSubmitted(period, req.user._id);
    if (hasSubmitted) {
      return res.status(400).json({ success: false, message: 'لقد قمت بتقديم تقييمك بالفعل لهذه الفترة' });
    }
    
    const manager = await User.findOne({ _id: managerId, role: 'manager' });
    if (!manager) {
      return res.status(404).json({ success: false, message: 'المدير غير موجود' });
    }
    
    const hasAlreadyEvaluated = await EvaluationResponse.findOne({ 
      period, 
      manager: managerId,
      _id: { $ne: req.user._id }
    });
    
    const evaluation = await EvaluationResponse.create({
      period,
      manager: managerId,
      responses,
      strengthsComment: strengthsComment || null,
      improvementsComment: improvementsComment || null
    });
    
    res.status(201).json({
      success: true,
      message: 'تم إرسال تقييمك بنجاح',
      data: { evaluationId: evaluation._id }
    });
  } catch (error) {
    console.error('Error submitting evaluation:', error);
    res.status(500).json({ success: false, message: 'خطأ في إرسال التقييم' });
  }
};

// Check if current user submitted
exports.checkSubmissionStatus = async (req, res) => {
  try {
    const period = getEvaluationPeriod();
    const hasSubmitted = await EvaluationResponse.hasSubmitted(period, req.user._id);
    
    res.json({
      success: true,
      data: { hasSubmitted, period }
    });
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({ success: false, message: 'خطأ في التحقق' });
  }
};

// Get managers for evaluation (for employees to select)
exports.getManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager', isActive: true })
      .select('_id name department');
    
    res.json({
      success: true,
      data: { managers }
    });
  } catch (error) {
    console.error('Error getting managers:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب المديرين' });
  }
};

// Admin: Get all evaluation results
exports.getResults = async (req, res) => {
  try {
    const { period } = req.query;
    const targetPeriod = period || getEvaluationPeriod();
    
    const periods = await EvaluationPeriod.find().sort({ createdAt: -1 }).limit(8);
    const managers = await User.find({ role: 'manager', isActive: true })
      .select('_id name department');
    
    const results = [];
    for (const manager of managers) {
      const aggregated = await EvaluationResponse.getAggregatedResults(targetPeriod, manager._id);
      if (aggregated) {
        results.push({
          manager: {
            id: manager._id,
            name: manager.name,
            department: manager.department
          },
          ...aggregated
        });
      }
    }
    
    results.sort((a, b) => parseFloat(b.overallAverage) - parseFloat(a.overallAverage));
    
    res.json({
      success: true,
      data: {
        period: targetPeriod,
        periods: periods.map(p => p.period),
        results,
        minimumResponses: 5
      }
    });
  } catch (error) {
    console.error('Error getting results:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب النتائج' });
  }
};

// Admin: Get manager detailed results
exports.getManagerResults = async (req, res) => {
  try {
    const { managerId, period } = req.query;
    const targetPeriod = period || getEvaluationPeriod();
    
    const aggregated = await EvaluationResponse.getAggregatedResults(targetPeriod, managerId);
    
    if (!aggregated) {
      return res.json({
        success: true,
        data: {
          message: 'لا توجد بيانات كافية',
          minimumResponses: 5,
          currentResponses: 0
        }
      });
    }
    
    const questions = EVALUATION_QUESTIONS;
    const detailedResults = aggregated.questionAverages.map(q => {
      const questionInfo = questions.find(qs => qs.id === q.questionId);
      return {
        questionId: q.questionId,
        questionAr: questionInfo?.textAr || q.questionId,
        average: q.average.toFixed(2),
        count: q.count
      };
    });
    
    res.json({
      success: true,
      data: {
        managerId,
        period: targetPeriod,
        responseCount: aggregated.responseCount,
        overallAverage: aggregated.overallAverage,
        detailedResults,
        comments: aggregated.comments
      }
    });
  } catch (error) {
    console.error('Error getting manager results:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب النتائج' });
  }
};

// Admin: Get period trends
exports.getTrends = async (req, res) => {
  try {
    const { managerId } = req.query;
    
    if (!managerId) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد المدير' });
    }
    
    const periods = await EvaluationPeriod.find().sort({ startDate: 1 }).limit(8);
    const trends = [];
    
    for (const p of periods) {
      const aggregated = await EvaluationResponse.getAggregatedResults(p.period, managerId);
      if (aggregated) {
        trends.push({
          period: p.period,
          overallAverage: aggregated.overallAverage,
          responseCount: aggregated.responseCount
        });
      }
    }
    
    res.json({
      success: true,
      data: { trends }
    });
  } catch (error) {
    console.error('Error getting trends:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب الاتجاهات' });
  }
};