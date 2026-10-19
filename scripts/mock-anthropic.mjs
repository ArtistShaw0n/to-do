/**
 * A stand-in for api.anthropic.com, for trying the AI features without a key.
 *
 *     node scripts/mock-anthropic.mjs            # listens on 8792
 *
 * Point a local hub at it:
 *
 *     npx wrangler dev --local --port 8788 \
 *       --var ANTHROPIC_API_KEY:test --var ANTHROPIC_BASE_URL:http://127.0.0.1:8792
 *
 * It answers in the right *shape* with obviously fake content, so what you see
 * proves the plumbing — the model's judgement is not on trial here.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8792);

const message = (model, text) => ({
  id: 'msg_mock', type: 'message', role: 'assistant', model,
  content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 120, output_tokens: 30 },
});

function answer(body) {
  const content = body.messages?.[0]?.content;
  const text = typeof content === 'string'
    ? content
    : (content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const schema = body.output_config?.format?.schema;

  if (schema?.properties?.steps) {
    return JSON.stringify({ steps: ['Reproduce it on the live build', 'Find the component that renders it', 'Fix and check on mobile', 'Ship in the next release'] });
  }
  if (schema?.properties?.items) {
    const picture = (content ?? []).find?.((b) => b.type === 'image');
    if (picture) {
      // A tiny picture stands in for one with no work in it, so the empty screen can be seen.
      if ((picture.source?.data ?? '').length < 3000) {
        return JSON.stringify({ seen: 'A settings dialog with no list or request in it (stand-in model).', items: [] });
      }
      return JSON.stringify({ seen: 'A bug sheet with three rows (stand-in model).', items: [
        { type: 'task', title: 'Show a preview before download in the email Drive', project: 'OERP', tags: ['bug', 'email'], notes: 'Row 1 of the screenshot', due: null, priority: 2 },
        { type: 'task', title: 'Freeze the SL column header in the booking table', project: 'OERP', tags: ['bug', 'property-booking'], notes: 'Row 2 of the screenshot', due: null, priority: 1 },
        { type: 'task', title: 'Lift the portal login box above the tablet keyboard', project: 'OERP', tags: ['bug', 'portal'], notes: null, due: null, priority: 2 },
      ] });
    }
    const line = (text.split('Input: ')[1] ?? '').trim();
    return JSON.stringify({ items: [
      { type: 'task', title: `Clean version of: ${line}`, project: 'OERP', tags: ['frontend'], notes: 'Rewritten by the stand-in model', due: null, priority: 2 },
    ] });
  }
  if (String(body.system).includes('daily brief')) {
    return 'আজ **৪৪টা কাজ** খোলা। সবচেয়ে জরুরি — `Fix the reported OERP email module bugs and ship a new release`।\n\n- email-এ ৫টা bug জমে আছে\n- (এটা stand-in model-এর লেখা)';
  }
  return 'এখন **৪৪টা** কাজ খোলা আছে, তার মধ্যে ১২টা bug। (stand-in-এর উত্তর)';
}

createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : {};
    console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${req.url} model=${body.model} effort=${body.output_config?.effort}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    setTimeout(() => res.end(JSON.stringify(message(body.model, answer(body)))), 700); // a model is never instant
  });
}).listen(PORT, '127.0.0.1', () => console.log(`stand-in Anthropic API on http://127.0.0.1:${PORT}`));
