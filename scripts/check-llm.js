// 用法：node scripts/check-llm.js —— 逐个测试 .env 中配置的模型是否可用
import { config } from '../src/config.js';
import { chat } from '../src/llm.js';

if (!config.engines.length) { console.error('未配置任何模型：请在 .env 中设置 LLM_API_KEY（以及可选的 GEO_ENGINES）'); process.exit(1); }
for (const e of config.engines) {
  process.stdout.write(`${e.label} (${e.model}) @ ${e.baseUrl} ... `);
  try { const r = await chat(e, [{ role: 'user', content: '请只回复“OK”' }], { maxTokens: 500, timeoutMs: 30000 }); console.log(`✓ ${r.ms}ms：${r.text.slice(0, 30)}`); }
  catch (err) { console.log(`✗ ${err.message}`); }
}
