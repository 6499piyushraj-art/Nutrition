// AI Provider abstraction — supports multiple vendors for different task types
//
// Task categories:
//   vision  — reading nutrition labels, identifying food in photos
//   text    — parsing pasted nutrition text, structured extraction
//
// Providers:
//   anthropic — Claude Haiku (good vision + text, moderate cost)
//   groq      — GPT-OSS-20B (fast text, near-free, no vision)
//   gemini    — Gemini Flash (good vision + text, free tier available)

export type AITask = 'vision' | 'text';

export interface AIProvider {
  name: string;
  parseText(text: string, systemPrompt: string): Promise<string>;
  parseImage?(base64: string, mediaType: string, systemPrompt: string, userPrompt: string): Promise<string>;
}

// Provider selection: pick the cheapest provider that supports the task
export function getProvider(task: AITask): AIProvider {
  if (task === 'vision') {
    // Vision requires image support: gemini > anthropic
    if (process.env.GEMINI_API_KEY) return createGeminiProvider();
    if (process.env.ANTHROPIC_API_KEY) return createAnthropicProvider();
    throw new Error('No AI provider configured for vision. Set GEMINI_API_KEY or ANTHROPIC_API_KEY.');
  }

  // Prefer Gemini when configured so text and image extraction use the same key.
  if (process.env.GEMINI_API_KEY) return createGeminiProvider();
  if (process.env.GROQ_API_KEY) return createGroqProvider();
  if (process.env.ANTHROPIC_API_KEY) return createAnthropicProvider();
  throw new Error('No AI provider configured. Set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY.');
}

function createAnthropicProvider(): AIProvider {
  return {
    name: 'anthropic',
    async parseText(text: string, systemPrompt: string) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      });
      const block = response.content[0];
      return block.type === 'text' ? block.text : '';
    },
    async parseImage(base64: string, mediaType: string, systemPrompt: string, userPrompt: string) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg', data: base64 } },
            { type: 'text', text: userPrompt },
          ],
        }],
      });
      const block = response.content[0];
      return block.type === 'text' ? block.text : '';
    },
  };
}

function createGroqProvider(): AIProvider {
  return {
    name: 'groq',
    async parseText(text: string, systemPrompt: string) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          max_tokens: 1024,
          temperature: 0.1,
        }),
      });
      if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
      const data = await res.json();
      return data.choices[0].message.content;
    },
    // No vision support for Groq
  };
}

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

interface GeminiResponse {
  error?: { message?: string };
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

async function generateWithGemini(
  parts: GeminiPart[],
  systemPrompt: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing from the server environment.');
  }

  // Gemini 2.5 models can return NOT_FOUND for projects without prior model access.
  // Use the current, low-cost multimodal model by default and allow an explicit override.
  const model = (process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite')
    .replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null) as GeminiResponse | null;
    const detail = errorData?.error?.message?.trim();
    if (res.status === 404) {
      throw new Error(
        `Gemini model "${model}" returned 404 (not found or unavailable to this project).` +
        ` Default model is gemini-3.5-flash-lite. Google response: ${detail || 'No details provided.'}`,
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Gemini API authentication/permission error (${res.status}). Check the GEMINI_API_KEY in Render Environment. ${detail || ''}`.trim(),
      );
    }
    if (res.status === 429) {
      throw new Error(`Gemini quota/rate limit reached (429). Wait and retry. ${detail || ''}`.trim());
    }
    throw new Error(`Gemini API error (${res.status}): ${detail || res.statusText}`);
  }

  const data = await res.json() as GeminiResponse;
  const output = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!output) {
    const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason;
    throw new Error(`Gemini returned no text${reason ? ` (${reason})` : ''}. Try a different food description or image.`);
  }
  return output;
}

function createGeminiProvider(): AIProvider {
  return {
    name: 'gemini',
    async parseText(text: string, systemPrompt: string) {
      return generateWithGemini([{ text }], systemPrompt);
    },
    async parseImage(base64: string, mediaType: string, systemPrompt: string, userPrompt: string) {
      return generateWithGemini([
        { inline_data: { mime_type: mediaType, data: base64 } },
        { text: userPrompt },
      ], systemPrompt);
    },
  };
}
