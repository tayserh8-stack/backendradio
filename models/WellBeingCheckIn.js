/**
 * Well-Being Check-In Model
 * Daily employee well-being tracking (anonymous)
 */

var mongoose = require('mongoose');

var MoodLevel = {
  VERY_STRESSED: 1,
  STRESSED: 2,
  NEUTRAL: 3,
  GOOD: 4,
  EXCELLENT: 5
};

var WorkloadLevel = {
  TOO_HEAVY: 'too_heavy',
  NORMAL: 'normal',
  LIGHT: 'light'
};

var EnergyLevel = {
  VERY_LOW: 'very_low',
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high'
};

var SupportNeed = {
  YES: 'yes',
  MAYBE: 'maybe',
  NO: 'no'
};

var wellBeingCheckInSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  periodKey: {
    type: String,
    required: true
  },
  mood: {
    type: Number,
    enum: Object.values(MoodLevel),
    required: true
  },
  workload: {
    type: String,
    enum: Object.values(WorkloadLevel),
    required: true
  },
  energy: {
    type: String,
    enum: Object.values(EnergyLevel),
    required: true
  },
  supportNeeded: {
    type: String,
    enum: Object.values(SupportNeed),
    required: true
  },
  comment: {
    type: String,
    default: null,
    maxlength: 500
  },
  ipHash: {
    type: String,
    default: null
  }
}, { timestamps: true });

wellBeingCheckInSchema.index({ userId: 1, periodKey: 1 }, { unique: true });
wellBeingCheckInSchema.index({ date: -1 });
wellBeingCheckInSchema.index({ periodKey: 1 });

wellBeingCheckInSchema.statics.hasSubmittedToday = async function(userId) {
  var today = new Date();
  var periodKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  var existing = await this.findOne({ userId: userId, periodKey: periodKey });
  return !!existing;
};

wellBeingCheckInSchema.statics.getAggregatedStats = async function(periodKey, departmentId, minResponses) {
  if (minResponses === undefined) minResponses = 5;
  var query = { periodKey: periodKey };
  var responses = await this.find(query);
  
  if (responses.length < minResponses) {
    return null;
  }

  var moodScores = responses.map(function(r) { return r.mood; });
  var sumMood = 0;
  for (var i = 0; i < moodScores.length; i++) sumMood += moodScores[i];
  var avgMood = sumMood / moodScores.length;

  var workloadCounts = { too_heavy: 0, normal: 0, light: 0 };
  var energyCounts = { very_low: 0, low: 0, normal: 0, high: 0 };
  var supportCounts = { yes: 0, maybe: 0, no: 0 };

  for (var j = 0; j < responses.length; j++) {
    var r = responses[j];
    if (workloadCounts[r.workload] !== undefined) workloadCounts[r.workload]++;
    if (energyCounts[r.energy] !== undefined) energyCounts[r.energy]++;
    if (supportCounts[r.supportNeeded] !== undefined) supportCounts[r.supportNeeded]++;
  }

  var totalResponses = responses.length;
  var comments = [];
  for (var k = 0; k < responses.length; k++) {
    if (responses[k].comment) comments.push(responses[k].comment);
  }

  var veryStressed = 0, stressed = 0, neutral = 0, good = 0, excellent = 0;
  for (var m = 0; m < moodScores.length; m++) {
    if (moodScores[m] === 1) veryStressed++;
    else if (moodScores[m] === 2) stressed++;
    else if (moodScores[m] === 3) neutral++;
    else if (moodScores[m] === 4) good++;
    else if (moodScores[m] === 5) excellent++;
  }

  return {
    responseCount: totalResponses,
    avgMood: Math.round(avgMood * 100) / 100,
    moodDistribution: {
      veryStressed: veryStressed,
      stressed: stressed,
      neutral: neutral,
      good: good,
      excellent: excellent
    },
    workloadDistribution: {
      tooHeavy: workloadCounts.too_heavy,
      normal: workloadCounts.normal,
      light: workloadCounts.light
    },
    energyDistribution: energyCounts,
    supportDistribution: supportCounts,
    comments: comments.slice(0, 20),
    supportPercentage: Math.round((supportCounts.yes / totalResponses) * 100)
  };
};

wellBeingCheckInSchema.statics.getTrendData = async function(days, departmentId) {
  if (days === undefined) days = 7;
  var results = [];
  var now = new Date();

  for (var i = days - 1; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(d.getDate() - i);
    var periodKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    
    var stats = await this.getAggregatedStats(periodKey, departmentId, 0);
    results.push({
      date: periodKey,
      avgMood: stats ? stats.avgMood : null,
      responseCount: stats ? stats.responseCount : 0
    });
  }

  return results;
};

wellBeingCheckInSchema.statics.detectBurnoutRisk = async function(departmentId) {
  var last7Days = await this.getTrendData(7, departmentId);
  var validDays = [];
  for (var j = 0; j < last7Days.length; j++) {
    if (last7Days[j].avgMood !== null) {
      validDays.push(last7Days[j]);
    }
  }

  if (validDays.length < 5) return { risk: false, level: 'unknown' };

  var sumMood = 0;
  for (var k = 0; k < validDays.length; k++) sumMood += validDays[k].avgMood;
  var avgMood = sumMood / validDays.length;
  var decliningDays = [];
  
  for (var i = 1; i < validDays.length; i++) {
    if (validDays[i].avgMood < validDays[i - 1].avgMood) {
      decliningDays.push(i);
    }
  }

  var riskLevel = 'low';
  if (avgMood < 2.5) riskLevel = 'high';
  else if (avgMood < 3.0 || decliningDays.length >= 3) riskLevel = 'medium';

  return {
    risk: riskLevel !== 'low',
    level: riskLevel,
    avgMoodLast7Days: Math.round(avgMood * 100) / 100,
    decliningTrendDays: decliningDays.length,
    dailyData: validDays
  };
};

var WellBeingCheckIn = mongoose.model('WellBeingCheckIn', wellBeingCheckInSchema);

module.exports = { 
  WellBeingCheckIn: WellBeingCheckIn, 
  MoodLevel: MoodLevel, 
  WorkloadLevel: WorkloadLevel, 
  EnergyLevel: EnergyLevel, 
  SupportNeed: SupportNeed 
};