/**
 * Settings Model
 * Stores configurable weights for the evaluation system
 */

const mongoose = require('mongoose');

// Settings Schema
const settingsSchema = new mongoose.Schema({
  // Settings key (unique identifier)
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Settings value (JSON string for complex values)
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Description in Arabic
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Default evaluation weights
const DEFAULT_EVALUATION_WEIGHTS = {
  managerScoreWeight: 0.5,        // 50% - Manager evaluation weight
  hoursWeight: 0.2,               // 20% - Worked hours weight
  tasksWeight: 0.3,               // 30% - Completed tasks weight
  requiredHoursPerWeek: 40,       // Required hours per week
  minimumTasksForRanking: 5       // Minimum tasks for ranking
};

// Static method to get or create settings
settingsSchema.statics.getValue = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

// Static method to set settings
settingsSchema.statics.setValue = async function(key, value, description = '') {
  return this.findOneAndUpdate(
    { key },
    { key, value, description },
    { upsert: true, new: true }
  );
};

// Static method to initialize default settings
settingsSchema.statics.initializeDefaults = async function() {
  const defaults = [
    { key: 'managerScoreWeight', value: 0.5, description: 'وزن تقييم المدير' },
    { key: 'hoursWeight', value: 0.2, description: 'وزن ساعات العمل' },
    { key: 'tasksWeight', value: 0.3, description: 'وزن المهام المكتملة' },
    { key: 'requiredHoursPerWeek', value: 40, description: 'الساعات المطلوبة أسبوعياً' },
    { key: 'minimumTasksForRanking', value: 5, description: 'الحد الأدنى من المهام للترتيب' }
  ];
  
  for (const setting of defaults) {
    await this.setValue(setting.key, setting.value, setting.description);
  }
  
  console.log('✅ تم تهيئة الإعدادات الافتراضية');
};

// Static method to get all evaluation weights
settingsSchema.statics.getEvaluationWeights = async function() {
  const weights = {};
  const keys = ['managerScoreWeight', 'hoursWeight', 'tasksWeight', 'requiredHoursPerWeek', 'minimumTasksForRanking'];
  
  for (const key of keys) {
    weights[key] = await this.getValue(key, DEFAULT_EVALUATION_WEIGHTS[key]);
  }
  
  return weights;
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = { Settings, DEFAULT_EVALUATION_WEIGHTS };