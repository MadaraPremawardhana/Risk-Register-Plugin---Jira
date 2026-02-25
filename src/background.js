// Background service worker — handles all Gemini API calls to avoid CORS issues

chrome.runtime.onInstalled.addListener(async () => {
  const { riskRegister } = await chrome.storage.local.get('riskRegister');
  if (!riskRegister) await chrome.storage.local.set({ riskRegister: [] });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_RISK') {
    handleAnalysis(message.payload)
      .then(result => sendResponse({ ok: true, data: result }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function handleAnalysis({ apiKey, model, task, framework }) {
  const frameworkPrompts = {
    standard: 'Use a standard risk matrix: Likelihood (1-5) × Impact (1-5). Score = L × I.',
    iso31000: 'Use ISO 31000: Rate Likelihood (1-5) and Consequence (1-5). Score = L × C.',
    pmbok: 'Use PMBOK: Rate Probability (1-5) and Impact (1-5) across cost/schedule/scope/quality.'
  };

  const prompt = `You are a senior project risk analyst. Analyze this Jira task and return a JSON risk assessment.

TASK:
Key: ${task.key}
Title: ${task.title}
Type: ${task.type || 'Unknown'}
Priority: ${task.priority || 'Unknown'}
Labels: ${task.labels?.join(', ') || 'None'}
Story Points: ${task.storyPoints || 'Unknown'}
Description: ${task.description || 'No description provided'}

FRAMEWORK: ${frameworkPrompts[framework] || frameworkPrompts.standard}

Risk level mapping: score 1-4=low, 5-9=medium, 10-14=high, 15-25=critical

Respond with ONLY valid JSON, no markdown fences, no explanation:
{
  "likelihood": <1-5>,
  "impact": <1-5>,
  "score": <likelihood × impact>,
  "level": "low"|"medium"|"high"|"critical",
  "risks": ["risk 1", "risk 2", "risk 3", "risk 4"],
  "mitigations": ["mitigation 1", "mitigation 2", "mitigation 3", "mitigation 4"],
  "summary": "one sentence summary"
}`;

  const geminiModel = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `API error ${res.status}`;
    if (res.status === 400) throw new Error('Invalid API key — get a free key at aistudio.google.com');
    if (res.status === 403) throw new Error('API key lacks permission — check aistudio.google.com');
    if (res.status === 429) throw new Error('Rate limit hit — wait a moment and retry');
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip any accidental markdown fences then parse
  const clean = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('AI returned invalid JSON — try again');
  }
}
