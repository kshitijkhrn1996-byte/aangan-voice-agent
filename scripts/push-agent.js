// Pushes prompts/receptionist.md and call settings to the Vaani agent.
// Run: node --env-file=.env scripts/push-agent.js

import { readFileSync } from 'node:fs';

const BASE = `https://api.vaanivoice.ai/api/agent/${process.env.VAANI_AGENT_ID}`;

async function patch(section, body) {
  const res = await fetch(`${BASE}/${section}`, {
    method: 'PATCH',
    headers: { 'X-API-Key': process.env.VAANI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${section} → ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  console.log(`${section}: ok`);
  return data;
}

await patch('persona', {
  identity: {
    system_prompt: readFileSync(new URL('../prompts/receptionist.md', import.meta.url), 'utf8'),
    greeting_message: {
      agent_message: "Hello, you've reached Aangan Studio. I'm the studio's virtual assistant, and this call is recorded. How can I help you today?",
      agent_speech_delay: 1,
      interruptible: true,
      let_user_speak_first: false,
      user_speech_delay: 0,
    },
  },
  senses_capabilities: {
    language: 'English',
    brain: { llm: { primary: { provider: 'google', model: process.env.GEMINI_MODEL || 'gemini-3.5-flash', parameters: { temperature: 0.3 } } } },
  },
});

await patch('experience', {
  settings: {
    call_settings: {
      max_duration_enabled: true,
      max_call_duration: 8,
      max_duration_hangup_message: 'I need to wrap up now — our team will call you back shortly. Thank you for calling Aangan Studio.',
    },
    end_call: { enabled: true },
  },
});
