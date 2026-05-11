const mongoose = require('mongoose');

const coupletPromptSchema = new mongoose.Schema({
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

coupletPromptSchema.statics.seedDefaults = async function () {
  const defaults = [
    {
      stage: 1,
      name: 'تحسين البداية',
      description: 'إعادة صياغة الفقرة الأولى',
      prompt: 'إعادة صياغة الفقرة الأولى من النص لتكون أكثر جاذبية واختصاراً. إزالة العبارات الافتتاحية الطويلة. التأكد أن الفقرة تبدأ مباشرة بالمعلومة الأهم.'
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
      prompt: 'ضبط النبرة لتكون رسمية ومباشرة وموضوعية. إزالة العبارات العاطفية والمبالغات. الحفاظ على الحياد التام.'
    },
    {
      stage: 4,
      name: 'اللمسة الإنسانية المهنية',
      description: 'تحسين السلاسة وإبراز الأثر',
      prompt: 'تحسين سلاسة النص مع الحفاظ على المهنية. تحسين تدفق الجمل. التأكد من أن النص يقرأ بطلاقة.'
    },
    {
      stage: 5,
      name: 'فحص منع الإضافة',
      description: 'التحقق من عدم إضافة معلومات',
      prompt: 'مقارنة النص المعالج مع النص الأصلي. تحديد أي كلمات أو معلومات جديدة غير موجودة في الأصل. إزالة الإضافات غير المصرح بها.'
    },
    {
      stage: 6,
      name: 'التنسيق الرباعي الثنائي',
      description: 'تقسيم النص إلى أسطر من 4 كلمات في ثنائيات',
      prompt: 'تنسيق النص النهائي في أسطر كل سطر يحتوي على 4 كلمات فقط، ثم تجميع كل سطرين متتاليين في ثنائي (مقطع من سطرين)، والفصل بين الثنائيات بسطر فارغ. لا تضف أي عناوين أو تسميات.'
    }
  ];

  for (const item of defaults) {
    await this.findOneAndUpdate(
      { stage: item.stage },
      { ...item, isActive: true },
      { upsert: true, new: true }
    );
  }
  console.log('تم تهيئة برومتات نافذة التحرير الثانية');
};

const CoupletPrompt = mongoose.model('CoupletPrompt', coupletPromptSchema);

module.exports = { CoupletPrompt };
