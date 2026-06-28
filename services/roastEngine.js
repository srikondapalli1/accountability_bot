import OpenAI from 'openai';
import { OPENAI_API_KEY, ROAST_SYSTEM_PROMPT } from '../config.js';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const LEVER_NAMES = {
  career: 'CAREER (LeetCode/System Design skip)',
  fitness: 'FITNESS (gym/protein skip)',
  cleanliness: 'CLEANLINESS (nightly 10-min clean skip)',
  social: 'SOCIAL (weekly NYC social goal skip)',
};

export async function generateRoast({ violations }) {
  if (!violations.length) return null;

  const leverContext = violations.map((v) => LEVER_NAMES[v]).join(', ');
  const userMessage = `Sri failed his check-in today. Activate these levers in your roast: ${leverContext}. Focus on the specific habits he skipped.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: ROAST_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 200,
  });

  let roast = response.choices[0]?.message?.content?.trim() ?? '';
  const words = roast.split(/\s+/);
  if (words.length > 120) {
    roast = words.slice(0, 120).join(' ') + '...';
  }
  return roast;
}
