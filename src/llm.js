// OpenAI 兼容的大模型调用封装（适配 one-api / new-api 网关、DeepSeek、通义、智谱等）
import { config, llmConfigured } from './config.js';
import { HttpError } from './http.js';

export class LlmError extends Error {
  constructor(message, code = 'LLM_ERROR') { super(message); this.code = code; }
}

export function listEngines() {
  return config.engines.map(e => ({ id: e.id, label: e.label, model: e.model, web: e.web }));
}

export function getEngine(id) {
  const e = config.engines.find(x => x.id === id) || config.engines[0];
  if (!e || !e.apiKey) throw new HttpError(503, 'AI 引擎尚未配置（请在服务器 .env 中设置 LLM_API_KEY / GEO_ENGINES）', 'LLM_NOT_CONFIGURED');
  return e;
}

export function judgeEngine() {
  const gemini = config.engines.find(e => e.id === 'gemini') || config.engines.find(e => e.id === 'gemini-pro');
  if (gemini) return { ...gemini, id: 'judge' };
  const base = getEngine();
  return { ...base, id: 'judge', model: config.llm.judgeModel || base.model };
}

export function assertLlm() {
  if (!llmConfigured()) throw new HttpError(503, 'AI 引擎尚未配置（请在服务器 .env 中设置 LLM_API_KEY）', 'LLM_NOT_CONFIGURED');
}

// 全局并发闸门，避免一次舆情任务把网关打爆
let active = 0; const waiters = [];
async function acquire() {
  if (active < config.llm.concurrency) { active++; return; }
  await new Promise(r => waiters.push(r));
  active++;
}
function release() { active--; const w = waiters.shift(); if (w) w(); }

const stripThink = (t) => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

const noJsonMode = new Set(); // 记录不支持 response_format 的模型

export async function chat(engine, messages, opts = {}) {
  const useJson = !!opts.json && !noJsonMode.has(engine.model);
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await chatOnce(engine, messages, { ...opts, json: useJson });
    } catch (e) {
      lastErr = e;
      if (useJson && e.code === 'LLM_NO_JSON_MODE') {
        noJsonMode.add(engine.model);
        return await chatOnce(engine, messages, { ...opts, json: false });
      }
      if (e.code === 'LLM_RATE_LIMIT' && attempt < 2) {
        const delay = (attempt + 1) * 2500;
        console.warn(`[llm 429 backoff] ${engine.label} 限流，等待 ${delay}ms 后第 ${attempt + 1} 次重试...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function chatOnce(engine, messages, { temperature = 0.3, maxTokens = 1800, timeoutMs = config.llm.timeoutMs, json = false } = {}) {
  await acquire();
  const started = Date.now();
  try {
    const isVertex = engine.baseUrl && engine.baseUrl.includes('aiplatform.googleapis.com');
    if (isVertex) {
      const url = `${engine.baseUrl}/${engine.model}:generateContent?key=${engine.apiKey}`;
      const systemMsg = messages.find(m => m.role === 'system');
      const nonSystemMsgs = messages.filter(m => m.role !== 'system');
      const body = {
        contents: nonSystemMsgs.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content || '') }]
        })),
        generationConfig: {
          temperature,
          maxOutputTokens: Math.max(maxTokens + 4000, 8192),
          ...(json ? { responseMimeType: 'application/json' } : {})
        }
      };
      if (systemMsg) {
        body.systemInstruction = { parts: [{ text: String(systemMsg.content || '') }] };
      }
      let resp;
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        throw new LlmError(e.name === 'TimeoutError' ? `${engine.label} 响应超时` : `${engine.label} 连接失败：${e.message}`, 'LLM_NETWORK');
      }
      const raw = await resp.text();
      if (!resp.ok) {
        throw new LlmError(`${engine.label} 返回错误 HTTP ${resp.status}${raw ? '：' + raw.slice(0, 160) : ''}`, 'LLM_UPSTREAM');
      }
      let data;
      try { data = JSON.parse(raw); } catch { throw new LlmError(`${engine.label} 返回了无法解析的内容`, 'LLM_BAD_RESPONSE'); }
      const text = stripThink(data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '');
      if (!text) throw new LlmError(`${engine.label} 返回了空回答`, 'LLM_EMPTY');
      const usage = data.usageMetadata ? {
        prompt_tokens: data.usageMetadata.promptTokenCount,
        completion_tokens: data.usageMetadata.candidatesTokenCount,
        total_tokens: data.usageMetadata.totalTokenCount
      } : null;
      return { text, model: data.modelVersion || engine.model, ms: Date.now() - started, usage };
    }

    const maxOut = Math.max((maxTokens || 2048) + 4000, 8192);
    const body = { model: engine.model, messages, temperature, max_tokens: maxOut, stream: false };
    if (json) body.response_format = { type: 'json_object' };
    let resp;
    try {
      resp = await fetch(`${engine.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${engine.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new LlmError(e.name === 'TimeoutError' ? `${engine.label} 响应超时` : `${engine.label} 连接失败：${e.message}`, 'LLM_NETWORK');
    }
    const raw = await resp.text();
    if (!resp.ok) {
      if (resp.status === 429 || /rpm exhausted|rate_limit|exceeds.*limit/i.test(raw)) {
        throw new LlmError(`${engine.label} 请求频次超限(429)：${raw.slice(0, 120)}`, 'LLM_RATE_LIMIT');
      }
      // 部分网关不支持 response_format，自动降级重试一次
      if (json && resp.status === 400 && /response_format|json_object/i.test(raw)) {
        throw new LlmError('response_format unsupported', 'LLM_NO_JSON_MODE');
      }
      throw new LlmError(`${engine.label} 返回错误 HTTP ${resp.status}${raw ? '：' + raw.slice(0, 160) : ''}`, 'LLM_UPSTREAM');
    }
    let data;
    try { data = JSON.parse(raw); } catch { throw new LlmError(`${engine.label} 返回了无法解析的内容`, 'LLM_BAD_RESPONSE'); }
    const msg = data.choices?.[0]?.message;
    const text = stripThink(msg?.content || msg?.reasoning_content);
    if (!text) throw new LlmError(`${engine.label} 返回了空回答`, 'LLM_EMPTY');
    return { text, model: data.model || engine.model, ms: Date.now() - started, usage: data.usage || null };
  } finally {
    release();
  }
}

// 从模型输出中稳健提取 JSON
export function extractJson(text) {
  let t = String(text || '').replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1').trim();
  try { return JSON.parse(t); } catch { /* 继续 */ }
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a !== -1 && b > a) {
    let s = t.slice(a, b + 1);
    try { return JSON.parse(s); } catch { /* 继续 */ }
    s = s.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"');
    try { return JSON.parse(s); } catch { /* 放弃 */ }
  }
  throw new LlmError('模型未按要求返回 JSON，请重试', 'LLM_BAD_JSON');
}

export async function chatJson(engine, messages, opts = {}) {
  let lastErr;
  for (let i = 0; i < 2; i++) {
    const r = await chat(engine, messages, { ...opts, json: true });
    try { return { ...r, json: extractJson(r.text) }; } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// 按并发执行一组异步任务，单个失败不影响整体
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { results[idx] = { ok: true, value: await fn(items[idx], idx) }; } catch (e) { results[idx] = { ok: false, error: e }; }
    }
  });
  await Promise.all(workers);
  return results;
}
