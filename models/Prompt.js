const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema({
  stage: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 6
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  prompt: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

promptSchema.statics.seedDefaults = async function () {
  const defaults = [
    {
      stage: 1,
      name: 'تحسين البداية',
      description: 'Lead Optimization - إعادة صياغة الفقرة الأولى',
      prompt: 'إعادة صياغة الفقرة الأولى من الخبر لتكون أكثر جاذبية واختصاراً. إزالة العبارات الافتتاحية الطويلة مثل "في إطار" و"من جهة" و"يذكر أن". التأكد أن الفقرة تبدأ مباشرة بالمعلومة الأهم.'
    },
    {
      stage: 2,
      name: 'التدقيق اللغوي والتحريري',
      description: 'تصحيح الأخطاء وتحسين التراكيب',
      prompt: 'تصحيح الأخطاء اللغوية والنحوية. استبدال العبارات الطويلة بمرادفاتها المختصرة. تحسين علامات الترقيم. توحيد المصطلحات. إزالة التكرار.'
    },
    {
      stage: 3,
      name: 'ضبط النبرة والحزم',
      description: 'نبرة رسمية مباشرة وجادة',
      prompt: 'ضبط النبرة لتكون رسمية ومباشرة وموضوعية. إزالة العبارات العاطفية والمبالغات. تحويل الجمل الاستفهامية إلى جمل خبرية. الحفاظ على الحياد التام.'
    },
    {
      stage: 4,
      name: 'اللمسة الإنسانية المهنية',
      description: 'تحسين السلاسة وإبراز الأثر',
      prompt: 'تحسين سلاسة النص مع الحفاظ على المهنية. إضافة لمسات إنسانية مناسبة. تحسين تدفق الجمل. التأكد من أن النص يقرأ بطلاقة.'
    },
    {
      stage: 5,
      name: 'فحص منع الإضافة',
      description: 'التحقق من عدم إضافة معلومات',
      prompt: 'مقارنة النص المعالج مع النص الأصلي. تحديد أي كلمات أو معلومات جديدة غير موجودة في الأصل. إزالة الإضافات غير المصرح بها. التأكد من الدقة والأمانة في النقل.'
    },
    {
      stage: 6,
      name: 'الهوية التحريرية النهائية',
      description: 'تنسيق النهائي بثلاث فقرات',
      prompt: 'تنسيق النص النهائي في ثلاث فقرات متوازنة بدون أي عناوين أو تسميات للفقرات. الفقرة الأولى: المقدمة وأهم المعلومات. الفقرة الثانية: التفاصيل والمعلومات الإضافية. الفقرة الثالثة: الخاتمة والسياق. المطلوب: إخراج النص فقط دون إضافة كلمات مثل "بالنسبة لـ" أو "المقدمة:" أو أي تسميات أخرى.'
    }
  ];

  for (const item of defaults) {
    await this.findOneAndUpdate(
      { stage: item.stage },
      { ...item, isActive: true },
      { upsert: true, new: true }
    );
  }
  console.log('تم تهيئة البرومتات الافتراضية للمسار التحريري');
};

const Prompt = mongoose.model('Prompt', promptSchema);

module.exports = { Prompt };
