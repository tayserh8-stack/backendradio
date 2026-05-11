const AI_CONFIG = {
  apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
  baseUrl: (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, ''),
  model: process.env.AI_MODEL || process.env.OPENAI_MODEL || 'deepseek-chat',
};

const isGemini = AI_CONFIG.baseUrl.includes('googleapis.com');

const executeWithFetch = async (systemPrompt, userText) => {
  const url = isGemini
    ? `${AI_CONFIG.baseUrl}/chat/completions?key=${AI_CONFIG.apiKey}`
    : `${AI_CONFIG.baseUrl}/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };
  if (!isGemini) {
    headers['Authorization'] = `Bearer ${AI_CONFIG.apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      temperature: 0.3,
      max_tokens: 4096,
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
};

exports.processWithPrompt = async (systemPrompt, userText) => {
  if (!AI_CONFIG.apiKey) {
    throw new Error('مفتاح API للذكاء الاصطناعي غير مضبوط في ملف .env');
  }
  return executeWithFetch(systemPrompt, userText);
};

exports.isAIConfigured = () => {
  return !!AI_CONFIG.apiKey;
};

exports.getAIConfig = () => ({
  configured: !!AI_CONFIG.apiKey,
  model: AI_CONFIG.model,
  baseUrl: AI_CONFIG.baseUrl,
});
