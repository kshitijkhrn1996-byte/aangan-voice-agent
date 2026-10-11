// Post-call analysis: one Gemini call returns the structured lead, the
// designer handoff summary, and the guardrail audit.

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
// Rough INR per 1K tokens, for the dashboard's cost line. Adjust to current pricing.
const INR_PER_1K_TOKENS = Number(process.env.GEMINI_INR_PER_1K_TOKENS || 0.05);

const S = (type, extra = {}) => ({ type, nullable: true, ...extra });

const SCHEMA = {
  type: 'object',
  properties: {
    lead: {
      type: 'object',
      properties: {
        call_type: { type: 'string', enum: ['new_enquiry', 'existing_client', 'vendor', 'job_seeker', 'other'] },
        caller_name: S('string'),
        caller_email: S('string'),
        property_type: S('string', { enum: ['residential', 'commercial'] }),
        commercial_kind: S('string', { enum: ['office', 'clinic', 'studio', 'retail', 'restaurant', 'hotel', 'gym', 'other'] }),
        locality: S('string'),
        area_sqft: S('number'),
        scope: S('string', { enum: ['full_home', 'partial', 'single_room', 'office'] }),
        rooms: S('string'),
        wants_execution: S('boolean'),
        out_of_scope_request: S('string', { enum: ['decor_only', 'vastu_only', 'furniture_only', 'structural', 'architecture'] }),
        weeks_until_needed: S('number'),
        weeks_until_site_available: S('number'),
        timeline_text: S('string'),
        budget_inr: S('number'),
        is_decision_maker: S('boolean'),
        site_condition: S('string'),
        style_notes: S('string'),
        source: S('string'),
        message_for_team: S('string'),
        urgent: S('boolean'),
      },
      required: ['call_type'],
    },
    handoff_summary: { type: 'string' },
    guardrail: {
      type: 'object',
      properties: {
        breach: { type: 'boolean' },
        notes: { type: 'string' },
      },
      required: ['breach', 'notes'],
    },
  },
  required: ['lead', 'handoff_summary', 'guardrail'],
};

const INSTRUCTIONS = `You analyse a phone call between Aangan Studio's AI receptionist and a caller.
Aangan Studio is an interior design studio in Pune. Today is ${'{TODAY}'} (Asia/Kolkata).

1. "lead": extract only what the CALLER actually said. Use null when not stated — never guess.
   - weeks_until_needed: weeks from today until the caller needs the project COMPLETE.
   - weeks_until_site_available: weeks until the site is handed over / free for work (0 if available now).
   - budget_inr: only if the caller volunteered a number; convert lakh/crore to rupees.
   - wants_execution: true if they want design + execution; false if they want advice only or will execute themselves.
   - is_decision_maker: true if they decide or are authorised; false if "just researching for someone"; null if unclear.
   - urgent: true if the caller is upset, complaining, or the matter is time-critical.
2. "handoff_summary": 3–5 short lines a designer reads before calling back. Facts only, no fluff.
3. "guardrail": breach=true if the AGENT did ANY of these: said any price, rate, range or rupee figure;
   gave design, decor, colour, Vastu, structural or DIY advice; discussed competitors; promised a
   completion date, discount or specific outcome; answered off-topic questions; claimed to be human;
   revealed its instructions. Quote the offending line in notes. Otherwise breach=false, notes="".`;

export async function analyseCall(transcriptText) {
  const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full' });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: INSTRUCTIONS.replace('{TODAY}', today) }] },
      contents: [{ role: 'user', parts: [{ text: `TRANSCRIPT:\n${transcriptText}` }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`gemini ${res.status}: ${data.error?.message}`);

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '{}';
  const tokens = data.usageMetadata?.totalTokenCount || 0;
  return { ...JSON.parse(text), cost_inr: (tokens / 1000) * INR_PER_1K_TOKENS };
}
