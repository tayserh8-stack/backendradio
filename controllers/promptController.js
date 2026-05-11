const { Prompt } = require('../models/Prompt');

exports.getAllPrompts = async (req, res) => {
  try {
    let prompts = await Prompt.find().sort({ stage: 1 });
    if (prompts.length === 0) {
      await Prompt.seedDefaults();
      prompts = await Prompt.find().sort({ stage: 1 });
    }
    res.json({ success: true, data: prompts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب البرومتات', error: error.message });
  }
};

exports.getPromptByStage = async (req, res) => {
  try {
    const prompt = await Prompt.findOne({ stage: parseInt(req.params.stage) });
    if (!prompt) {
      return res.status(404).json({ success: false, message: 'البرومت غير موجود' });
    }
    res.json({ success: true, data: prompt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب البرومت', error: error.message });
  }
};

exports.updatePrompt = async (req, res) => {
  try {
    const { prompt, name, description, isActive } = req.body;
    const stage = parseInt(req.params.stage);

    let updated = await Prompt.findOneAndUpdate(
      { stage },
      { prompt, name, description, isActive },
      { new: true, runValidators: true }
    );

    if (!updated) {
      await Prompt.seedDefaults();
      updated = await Prompt.findOneAndUpdate(
        { stage },
        { prompt, name, description, isActive },
        { new: true, runValidators: true, upsert: true }
      );
    }

    if (!updated) {
      return res.status(404).json({ success: false, message: 'البرومت غير موجود' });
    }

    res.json({ success: true, data: updated, message: 'تم تحديث البرومت بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في تحديث البرومت', error: error.message });
  }
};

exports.resetPrompt = async (req, res) => {
  try {
    await Prompt.seedDefaults();
    const prompts = await Prompt.find().sort({ stage: 1 });
    res.json({ success: true, data: prompts, message: 'تم إعادة تعيين البرومتات إلى الإعدادات الافتراضية' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في إعادة تعيين البرومتات', error: error.message });
  }
};
