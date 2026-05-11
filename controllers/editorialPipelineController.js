const stage1_optimizeLead = (text) => {
  const paragraphs = text.trim().split(/\n\s*\n/);
  if (paragraphs.length === 0) return text;
  const firstPara = paragraphs[0].trim();
  const rest = paragraphs.slice(1).join('\n\n');
  let optimized = firstPara;
  optimized = optimized.replace(/^(في إطار|ضمن إطار|في سياق|من جهة|حيث إن|يذكر أن|تجدر الإشارة إلى أن|من ناحية|على صعيد آخر|وفي موضوع آخر)\s*/i, '');
  optimized = optimized.replace(/^(أعلن|صرح|كشف|أفاد|قال)\s+(المتحدث|المصدر|المسؤول|الجهة)\s+/i, '');
  if (!/^(أعلن|صرح|كشف|أفاد|أكد|نقل|كشفت|أعلنت|صرحت|أكدت|كشفت|قال|قالت)\s/.test(optimized)) {
    optimized = optimized.replace(/^(.{10,60}?)\s+(أن|إن)\s+/, '$1\n');
  }
  optimized = optimized.replace(/\s{2,}/g, ' ').trim();
  return optimized + (rest ? '\n\n' + rest : '');
};

const stage2_proofread = (text) => {
  let result = text;
  const replacements = [
    [/\bوسوف\b/g, 'سوف'],
    [/\bحيث أن\b/g, 'إذ'],
    [/\bحيث إن\b/g, 'إذ'],
    [/\bبالنسبة إلى\b/g, 'في'],
    [/\bبالنسبة لـ\b/g, 'لـ'],
    [/\bفيما يتعلق بـ\b/g, 'في'],
    [/\bعلى الرغم من أن\b/g, 'رغم'],
    [/\bعلى الرغم من أنّ\b/g, 'رغم'],
    [/\bعلى اعتبار أن\b/g, 'باعتبار'],
    [/\bمن الممكن أن\b/g, 'قد'],
    [/\bمن المحتمل أن\b/g, 'قد'],
    [/\bلا بد أن\b/g, 'لابد'],
    [/\bما زال\b/g, 'لا يزال'],
    [/\bما زالت\b/g, 'لا تزال'],
    [/\bبشكل عام\b/g, 'عموماً'],
    [/\bبصورة عامة\b/g, 'عموماً'],
    [/\bبشكل خاص\b/g, 'خصوصاً'],
    [/\bبصورة خاصة\b/g, 'خصوصاً'],
    [/\bفي الوقت نفسه\b/g, 'في الوقت ذاته'],
    [/\bفي الوقت عينه\b/g, 'في الوقت ذاته'],
    [/\bفي نفس الوقت\b/g, 'في الوقت نفسه'],
  ];
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  result = result.replace(/،\s*،/g, '،');
  result = result.replace(/\.\s*\./g, '.');
  result = result.replace(/\s+\./g, '.');
  result = result.replace(/\s+،/g, '،');
  result = result.replace(/[,،]\s*$/, '');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
};

const stage3_adjustTone = (text) => {
  let result = text;
  const emotional = [
    [/\bمؤسف\b/g, ''],
    [/\bمؤلمة\b/g, ''],
    [/\bمؤثر\b/g, ''],
    [/\bمروع\b/g, ''],
    [/\bفظيع\b/g, ''],
    [/\bمخيف\b/g, ''],
    [/\bمرعب\b/g, ''],
    [/\bمذهل\b/g, ''],
    [/\bرائع\b/g, ''],
    [/\bمدهش\b/g, ''],
    [/\bمثير\b/g, ''],
    [/\bمشين\b/g, ''],
    [/\bمخز\b/g, ''],
    [/\bكارثة\b/g, 'كارثة'],
    [/\bنكبة\b/g, ''],
    [/\bمأساة\b/g, ''],
    [/\bيجدر الذكر\b/g, ''],
    [/\bيجدر الإشارة\b/g, ''],
    [/\bمن الجدير بالذكر\b/g, ''],
  ];
  for (const [pattern, replacement] of emotional) {
    result = result.replace(pattern, replacement);
  }
  const exaggerations = [
    /\bأكبر\s+(من\s+)?[^.]*?(في\s+)?التاريخ\b/gi,
    /\bالأول\s+(من\s+)?نوعه\b/gi,
    /\bلم\s+يسبق\s+له\s+مثيل\b/gi,
    /\bغير\s+مسبوق\b/gi,
    /\bتاريخي\b/g,
  ];
  for (const pattern of exaggerations) {
    result = result.replace(pattern, (match) => {
      if (match.includes('تاريخي')) return 'مهم';
      return match;
    });
  }
  result = result.replace(/(!+)/g, '.');
  result = result.split('\n').map(line => {
    line = line.trim();
    if (line.endsWith('؟')) {
      line = line.slice(0, -1).trim() + '.';
    }
    return line;
  }).join('\n');
  result = result.replace(/\s{2,}/g, ' ').trim();
  return result;
};

const stage4_humanTouch = (text) => {
  let result = text;
  const paragraphs = result.split(/\n\s*\n/);
  const processed = paragraphs.map((para, index) => {
    let p = para.trim();
    if (!p) return p;
    if (index === paragraphs.length - 1) {
      if (!/\.$/.test(p.trim())) {
        p = p.trim() + '.';
      }
      return p;
    }
    if (index === 0) {
      return p;
    }
    if (p.length > 150) {
      const sentences = p.split(/(?<=[.!?])\s+/);
      if (sentences.length > 1) {
        const last = sentences[sentences.length - 1];
        if (last.length > 20 && !/^(يذكر|هذا|ذلك|وتجدر|من\s+جهة)/.test(last)) {
        }
      }
    }
    return p;
  });
  result = processed.join('\n\n');
  result = result.replace(/\s{2,}/g, ' ').trim();
  return result;
};

const stage5_antiAdditionCheck = (text, originalText) => {
  if (!originalText) return { passed: true, cleaned: text, issues: [] };
  const issues = [];
  const originalWords = new Set(originalText.split(/\s+/).map(w => w.replace(/[^\w\u0600-\u06FF]/g, '').toLowerCase()).filter(Boolean));
  const processedWords = text.split(/\s+/).map(w => w.replace(/[^\w\u0600-\u06FF]/g, '').toLowerCase()).filter(Boolean);
  const newWords = processedWords.filter(w => !originalWords.has(w));
  const namedEntities = ['وزير', 'رئيس', 'مدير', 'نائب', 'المتحدث', 'المملكة', 'الرياض', 'جدة', 'القاهرة', 'دمشق', 'بيروت', 'بغداد', 'الداخلية', 'الخارجية', 'الدفاع', 'النفط', 'الاتصالات', 'التعليم', 'الصحة', 'التجارة', 'الاستثمار'];
  const novelWordsWithContext = [];
  for (const word of [...new Set(newWords)]) {
    if (word.length < 3) continue;
    if (/^\d+$/.test(word)) continue;
    if (namedEntities.includes(word)) continue;
    const inOriginal = originalText.toLowerCase().includes(word);
    if (!inOriginal) {
      novelWordsWithContext.push(word);
    }
  }
  if (novelWordsWithContext.length > 3) {
    issues.push(`تم العثور على ${novelWordsWithContext.length} كلمة غير موجودة في النص الأصلي`);
    for (const word of novelWordsWithContext.slice(0, 5)) {
      try {
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^.]*\\.`, 'gi');
        const match = text.match(regex);
        if (match) {
          issues.push(`- "${word}" في: "${match[0].slice(0, 50)}..."`);
        }
      } catch (e) {
      }
    }
    let cleaned = text;
    for (const word of novelWordsWithContext) {
      try {
        const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        cleaned = cleaned.replace(wordRegex, '').replace(/\s{2,}/g, ' ').trim();
      } catch (e) {
      }
    }
    return { passed: novelWordsWithContext.length <= 3, cleaned, issues };
  }
  return { passed: true, cleaned: text, issues };
};

const stage6_finalIdentity = (text) => {
  let result = text;
  const paragraphs = result.split(/\n\s*\n/).filter(p => p.trim());
  if (paragraphs.length === 0) return text;
  const intro = paragraphs[0].trim();
  const body = paragraphs.slice(1).filter(p => p.trim());
  const sections = [];
  sections.push(intro);
  if (body.length > 0) {
    const infoPara = body.join(' ').replace(/\s{2,}/g, ' ').trim();
    sections.push(infoPara);
  }
  if (sections.length < 3) {
    const lastSection = sections[sections.length - 1];
    const sentences = lastSection.split(/(?<=[.!?])\s+/);
    if (sentences.length > 2) {
      const midPoint = Math.ceil(sentences.length / 2);
      const part1 = sentences.slice(0, midPoint).join(' ');
      const part2 = sentences.slice(midPoint).join(' ');
      sections[sections.length - 1] = part1;
      if (sections.length < 3) {
        sections.push(part2);
      }
    }
  }
  return sections.map(s => s.trim()).filter(s => s.length > 0).join('\n\n').trim();
};

const { Prompt } = require('../models/Prompt');
const aiService = require('../services/aiService');

const STAGE_NAMES = [
  { stage: 1, name: 'تحسين البداية', desc: 'Lead Optimization - إعادة صياغة الفقرة الأولى' },
  { stage: 2, name: 'التدقيق اللغوي والتحريري', desc: 'تصحيح الأخطاء وتحسين التراكيب' },
  { stage: 3, name: 'ضبط النبرة والحزم', desc: 'نبرة رسمية مباشرة وجادة' },
  { stage: 4, name: 'اللمسة الإنسانية المهنية', desc: 'تحسين السلاسة وإبراز الأثر' },
  { stage: 5, name: 'فحص منع الإضافة', desc: 'التحقق من عدم إضافة معلومات' },
  { stage: 6, name: 'الهوية التحريرية النهائية', desc: 'تنسيق النهائي بثلاث فقرات' },
];

const loadPrompts = async () => {
  try {
    const prompts = await Prompt.find().sort({ stage: 1 });
    if (prompts.length === 0) return null;
    return prompts;
  } catch {
    return null;
  }
};

const runPipeline = (text, originalText, prompts = null) => {
  const stages = [];
  let currentText = text;
  const promptMap = prompts ? Object.fromEntries(prompts.map(p => [p.stage, p])) : {};

  stages.push({ stage: 1, name: 'تحسين البداية', text: '', prompt: promptMap[1]?.prompt || '' });
  currentText = stage1_optimizeLead(currentText);
  stages[0].text = currentText;

  stages.push({ stage: 2, name: 'التدقيق اللغوي والتحريري', text: '', prompt: promptMap[2]?.prompt || '' });
  currentText = stage2_proofread(currentText);
  stages[1].text = currentText;

  stages.push({ stage: 3, name: 'ضبط النبرة والحزم', text: '', prompt: promptMap[3]?.prompt || '' });
  currentText = stage3_adjustTone(currentText);
  stages[2].text = currentText;

  stages.push({ stage: 4, name: 'اللمسة الإنسانية المهنية', text: '', prompt: promptMap[4]?.prompt || '' });
  currentText = stage4_humanTouch(currentText);
  stages[3].text = currentText;

  stages.push({ stage: 5, name: 'فحص منع الإضافة', text: '', prompt: promptMap[5]?.prompt || '' });
  const checkResult = stage5_antiAdditionCheck(currentText, originalText);
  currentText = checkResult.cleaned;
  stages[4].text = currentText;
  stages[4].checkResult = checkResult;

  stages.push({ stage: 6, name: 'الهوية التحريرية النهائية', text: '', prompt: promptMap[6]?.prompt || '' });
  currentText = stage6_finalIdentity(currentText);
  stages[5].text = currentText;

  return { stages, finalText: currentText };
};

const runAIPipeline = async (text, prompts) => {
  const stages = [];
  let currentText = text;
  const promptMap = Object.fromEntries(prompts.map(p => [p.stage, p]));

  for (let stage = 1; stage <= 6; stage++) {
    const promptData = promptMap[stage];
    const stageInfo = STAGE_NAMES[stage - 1];
    const systemPrompt = promptData?.prompt || stageInfo.name;

    stages.push({ stage, name: stageInfo.name, text: '', prompt: systemPrompt });

    try {
      const result = await aiService.processWithPrompt(
        `أنت محرر أخبار محترف. ${systemPrompt}\n\nيجب أن تحافظ على جميع المعلومات والحقائق الواردة في النص الأصلي دون إضافة أو حذف أي معلومات جوهرية. النص الأصلي:\n\n${text}`,
        currentText
      );
      currentText = result;
    } catch (err) {
      currentText = `[خطأ AI في المرحلة ${stage}: ${err.message}]\n\n${currentText}`;
    }

    stages[stage - 1].text = currentText;
    stages[stage - 1].aiProcessed = true;
  }

  return { stages, finalText: currentText };
};

exports.processPipeline = async (req, res) => {
  try {
    const { text, mode } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'النص مطلوب للمعالجة'
      });
    }
    const prompts = await loadPrompts();

    if (mode === 'ai') {
      if (!aiService.isAIConfigured()) {
        return res.status(400).json({
          success: false,
          message: 'الذكاء الاصطناعي غير مهيأ. يرجى ضبط مفتاح API في ملف .env'
        });
      }
      const result = await runAIPipeline(text, prompts || []);
      return res.json({
        success: true,
        data: {
          stages: result.stages,
          finalText: result.finalText,
          mode: 'ai'
        }
      });
    }

    const result = runPipeline(text, text, prompts);
    res.json({
      success: true,
      data: {
        stages: result.stages,
        finalText: result.finalText,
        mode: 'regex'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في معالجة النص التحريري',
      error: error.message
    });
  }
};

exports.runSingleStage = async (req, res) => {
  try {
    const { text, stage, mode } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'النص مطلوب للمعالجة'
      });
    }

    const prompt = await Prompt.findOne({ stage: parseInt(stage) });

    if (mode === 'ai') {
      if (!aiService.isAIConfigured()) {
        return res.status(400).json({
          success: false,
          message: 'الذكاء الاصطناعي غير مهيأ. يرجى ضبط مفتاح API في ملف .env'
        });
      }
      const stageInfo = STAGE_NAMES[parseInt(stage) - 1] || { name: '' };
      const systemPrompt = prompt?.prompt || stageInfo.name || '';
      const result = await aiService.processWithPrompt(
        `أنت محرر أخبار محترف. ${systemPrompt}\n\nيجب أن تحافظ على جميع المعلومات والحقائق الواردة في النص الأصلي دون إضافة أو حذف أي معلومات جوهرية. النص الأصلي:\n\n${text}`,
        text
      );
      return res.json({
        success: true,
        data: { text: result, prompt: systemPrompt, mode: 'ai' }
      });
    }

    let result;
    switch (stage) {
      case 1: result = stage1_optimizeLead(text); break;
      case 2: result = stage2_proofread(text); break;
      case 3: result = stage3_adjustTone(text); break;
      case 4: result = stage4_humanTouch(text); break;
      case 5: {
        const check = stage5_antiAdditionCheck(text, text);
        result = check.cleaned;
        break;
      }
      case 6: result = stage6_finalIdentity(text); break;
      default: result = text;
    }
    res.json({
      success: true,
      data: { text: result, prompt: prompt?.prompt || '' }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في معالجة المرحلة',
      error: error.message
    });
  }
};

exports.checkAIConfig = async (req, res) => {
  res.json({
    success: true,
    data: aiService.getAIConfig()
  });
};
