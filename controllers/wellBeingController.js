/**
 * Well-Being Controller
 * Anonymous employee well-being check-in system
 */

var WellBeingCheckIn = require('../models/WellBeingCheckIn').WellBeingCheckIn;
var MoodLevel = require('../models/WellBeingCheckIn').MoodLevel;

function getPeriodKey(date) {
  if (!date) date = new Date();
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

exports.getStatus = async function(req, res) {
  try {
    var periodKey = getPeriodKey();
    var hasSubmitted = await WellBeingCheckIn.hasSubmittedToday(req.user._id);

    res.json({
      success: true,
      data: {
        hasSubmitted: hasSubmitted,
        periodKey: periodKey,
        questions: [
          {
            id: 'mood',
            question: 'كيف تشعر اليوم في العمل؟',
            type: 'mood',
            options: [
              { value: 1, label: 'متوتر جداً', emoji: '😞', color: '#EF4444' },
              { value: 2, label: 'متوتر', emoji: '🙁', color: '#F97316' },
              { value: 3, label: 'محايد', emoji: '😐', color: '#EAB308' },
              { value: 4, label: 'جيد', emoji: '🙂', color: '#22C55E' },
              { value: 5, label: 'ممتاز', emoji: '😃', color: '#10B981' }
            ]
          },
          {
            id: 'workload',
            question: 'ما هي كمية عملك اليوم؟',
            type: 'workload',
            options: [
              { value: 'too_heavy', label: 'كثيرة جداً', color: '#EF4444' },
              { value: 'normal', label: 'طبيعية', color: '#22C55E' },
              { value: 'light', label: 'قليلة', color: '#3B82F6' }
            ]
          },
          {
            id: 'energy',
            question: 'ما هو مستوى طاقتك اليوم؟',
            type: 'energy',
            options: [
              { value: 'very_low', label: 'منخفضة جداً', color: '#EF4444' },
              { value: 'low', label: 'منخفضة', color: '#F97316' },
              { value: 'normal', label: 'طبيعية', color: '#22C55E' },
              { value: 'high', label: 'عالية', color: '#10B981' }
            ]
          },
          {
            id: 'support',
            question: 'هل تحتاج لدعم اليوم؟',
            type: 'support',
            options: [
              { value: 'yes', label: 'نعم', color: '#EF4444' },
              { value: 'maybe', label: 'ربما', color: '#F97316' },
              { value: 'no', label: 'لا', color: '#22C55E' }
            ]
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
  }
};

exports.submitCheckIn = async function(req, res) {
  try {
    var mood = req.body.mood;
    var workload = req.body.workload;
    var energy = req.body.energy;
    var supportNeeded = req.body.supportNeeded;
    var comment = req.body.comment;

    if (!mood || !workload || !energy || !supportNeeded) {
      return res.status(400).json({ success: false, message: 'يرجى إكمال جميع الحقول المطلوبة' });
    }

    var validMoods = [1, 2, 3, 4, 5];
    if (validMoods.indexOf(mood) === -1) {
      return res.status(400).json({ success: false, message: 'قيمة المزاج غير صالحة' });
    }

    var periodKey = getPeriodKey();
    var hasSubmitted = await WellBeingCheckIn.hasSubmittedToday(req.user._id);

    if (hasSubmitted) {
      return res.status(400).json({ success: false, message: 'لقد سجلت حالتك اليوم بالفعل' });
    }

    var checkIn = await WellBeingCheckIn.create({
      userId: req.user._id,
      date: new Date(),
      periodKey: periodKey,
      mood: mood,
      workload: workload,
      energy: energy,
      supportNeeded: supportNeeded,
      comment: comment || null
    });

    res.status(201).json({
      success: true,
      message: 'تم إرسال تقريرك بنجاح ✓',
      data: { checkInId: checkIn._id }
    });
  } catch (error) {
    console.error('Error submitting check-in:', error);
    res.status(500).json({ success: false, message: 'خطأ في إرسال التقرير' });
  }
};

exports.getTodayStats = async function(req, res) {
  try {
    var periodKey = getPeriodKey();
    var stats = await WellBeingCheckIn.getAggregatedStats(periodKey);

    res.json({
      success: true,
      data: stats || { message: 'لا توجد بيانات كافية', minResponses: 5 }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب الإحصائيات' });
  }
};

exports.getTrends = async function(req, res) {
  try {
    var days = parseInt(req.query.days) || 7;
    if (days > 30) days = 30;
    var trendData = await WellBeingCheckIn.getTrendData(days);

    res.json({
      success: true,
      data: { trendData: trendData }
    });
  } catch (error) {
    console.error('Error getting trends:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب الاتجاهات' });
  }
};

exports.getBurnoutRisk = async function(req, res) {
  try {
    var burnoutData = await WellBeingCheckIn.detectBurnoutRisk();

    res.json({
      success: true,
      data: burnoutData
    });
  } catch (error) {
    console.error('Error detecting burnout:', error);
    res.status(500).json({ success: false, message: 'خطأ في التحليل' });
  }
};

exports.getDepartmentStats = async function(req, res) {
  try {
    var User = require('../models/User');
    var department = req.query.department;
    var periodKey = getPeriodKey();

    var userFilter = { role: 'employee' };
    if (department) {
      userFilter.department = department;
    }

    var employees = await User.find(userFilter).select('_id');
    var userIds = [];
    for (var i = 0; i < employees.length; i++) userIds.push(employees[i]._id);

    var responses = await WellBeingCheckIn.find({ periodKey: periodKey, userId: { $in: userIds } });

    if (responses.length < 5) {
      return res.json({
        success: true,
        data: { message: 'لا توجد بيانات كافية', minResponses: 5 }
      });
    }

    var moodScores = [];
    for (var j = 0; j < responses.length; j++) moodScores.push(responses[j].mood);
    var sumMood = 0;
    for (var k = 0; k < moodScores.length; k++) sumMood += moodScores[k];
    var avgMood = sumMood / moodScores.length;

    var workloadCounts = { too_heavy: 0, normal: 0, light: 0 };
    for (var l = 0; l < responses.length; l++) {
      if (workloadCounts[responses[l].workload] !== undefined) {
        workloadCounts[responses[l].workload]++;
      }
    }

    res.json({
      success: true,
      data: {
        responseCount: responses.length,
        avgMood: Math.round(avgMood * 100) / 100,
        workloadDistribution: workloadCounts
      }
    });
  } catch (error) {
    console.error('Error getting department stats:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب الإحصائيات' });
  }
};