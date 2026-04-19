/**
 * Settings Controller
 * Handles application settings
 */

const { Settings, DEFAULT_EVALUATION_WEIGHTS } = require('../models/Settings');

/**
 * Get all settings
 * GET /api/settings
 */
const getAllSettings = async (req, res) => {
  try {
    const settings = await Settings.find();
    
    // Convert to key-value object
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });

    // Add defaults for any missing keys
    Object.keys(DEFAULT_EVALUATION_WEIGHTS).forEach(key => {
      if (!settingsObj[key]) {
        settingsObj[key] = DEFAULT_EVALUATION_WEIGHTS[key];
      }
    });

    res.json({
      success: true,
      data: {
        settings: settingsObj
      }
    });
  } catch (error) {
    console.error('خطأ في جلب الإعدادات:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get single setting
 * GET /api/settings/:key
 */
const getSetting = async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: req.params.key });
    
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'الإعداد غير موجود'
      });
    }

    res.json({
      success: true,
      data: {
        setting
      }
    });
  } catch (error) {
    console.error('خطأ في جلب الإعداد:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Update setting
 * PUT /api/settings/:key
 */
const updateSetting = async (req, res) => {
  try {
    const { value, description } = req.body;
    const { key } = req.params;

    // Validate value exists
    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال القيمة'
      });
    }

    // Validate numeric values for weights
    if (key.includes('Weight')) {
      if (value < 0 || value > 1) {
        return res.status(400).json({
          success: false,
          message: 'يجب أن تكون القيمة بين 0 و 1'
        });
      }
    }

    const setting = await Settings.setValue(key, value, description);

    res.json({
      success: true,
      message: 'تم تحديث الإعداد بنجاح',
      data: {
        setting
      }
    });
  } catch (error) {
    console.error('خطأ في تحديث الإعداد:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Update multiple settings
 * PUT /api/settings
 */
const updateMultipleSettings = async (req, res) => {
  try {
    const settingsData = req.body;

    const results = [];
    for (const [key, value] of Object.entries(settingsData)) {
      if (value !== undefined) {
        const setting = await Settings.setValue(key, value);
        results.push(setting);
      }
    }

    res.json({
      success: true,
      message: 'تم تحديث الإعدادات بنجاح',
      data: {
        settings: results
      }
    });
  } catch (error) {
    console.error('خطأ في تحديث الإعدادات:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get evaluation weights
 * GET /api/settings/weights
 */
const getEvaluationWeights = async (req, res) => {
  try {
    const weights = await Settings.getEvaluationWeights();

    res.json({
      success: true,
      data: {
        weights
      }
    });
  } catch (error) {
    console.error('خطأ في جلب الأوزان:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Reset to default settings
 * POST /api/settings/reset
 */
const resetSettings = async (req, res) => {
  try {
    await Settings.initializeDefaults();

    res.json({
      success: true,
      message: 'تم إعادة تعيين الإعدادات الافتراضية'
    });
  } catch (error) {
    console.error('خطأ في إعادة تعيين الإعدادات:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

module.exports = {
  getAllSettings,
  getSetting,
  updateSetting,
  updateMultipleSettings,
  getEvaluationWeights,
  resetSettings
};
