export type StopDraft = {
  name: string;
  description: string;
  lore: string;
  points: number;
  sublocation: string;
  geocodeQuery: string;
};

export type VerificationResult = {
  success: boolean;
  message: string;
};

export function quoteTextBlock(label: string, value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : JSON.stringify(value ?? null, null, 2);
  return `<${label}>\n${text}\n</${label}>`;
}

export function stringifyJsonBlock(label: string, value: unknown): string {
  return `<${label}>\n${JSON.stringify(value, null, 2)}\n</${label}>`;
}

export function normalizeText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.replace(/\s+/g, ' ').trim() || fallback;
}

export function normalizeStopDraft(
  value: unknown,
  pointRange: { min: number; max: number },
): StopDraft {
  const raw = (value ?? {}) as Record<string, unknown>;
  const pointsValue = Number(raw.points);
  const points = Number.isFinite(pointsValue)
    ? Math.max(pointRange.min, Math.min(pointRange.max, Math.round(pointsValue)))
    : pointRange.min;

  return {
    name: normalizeText(raw.name, 'Mystery Stop'),
    description: normalizeText(raw.description, 'A real stop that fits the hunt theme.'),
    lore: normalizeText(raw.lore, 'A place with a story worth discovering.'),
    points,
    sublocation: normalizeText(raw.sublocation, 'Unknown Venue · Nearby'),
    geocodeQuery: normalizeText(raw.geocodeQuery, normalizeText(raw.sublocation, normalizeText(raw.name, 'Unknown Venue'))),
  };
}

export function validateStopDraft(value: unknown): value is StopDraft {
  if (!value || typeof value !== 'object') return false;
  const stop = value as Record<string, unknown>;
  return (
    typeof stop.name === 'string' &&
    stop.name.trim().length >= 3 &&
    typeof stop.description === 'string' &&
    stop.description.trim().length >= 8 &&
    typeof stop.lore === 'string' &&
    stop.lore.trim().length >= 8 &&
    typeof stop.points === 'number' &&
    Number.isFinite(stop.points) &&
    typeof stop.sublocation === 'string' &&
    stop.sublocation.trim().length >= 3 &&
    typeof stop.geocodeQuery === 'string' &&
    stop.geocodeQuery.trim().length >= 3
  );
}

export function assertStops(
  value: unknown,
  expectedCount: number,
  pointRange: { min: number; max: number },
): StopDraft[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected "items" to be an array.');
  }
  if (value.length !== expectedCount) {
    throw new Error(`Expected exactly ${expectedCount} stops, received ${value.length}.`);
  }
  const normalized = value.map((item) => normalizeStopDraft(item, pointRange));
  if (!normalized.every(validateStopDraft)) {
    throw new Error('One or more generated stops were missing required fields.');
  }
  return normalized;
}

export function assertSingleStop(
  value: unknown,
  pointRange: { min: number; max: number },
): StopDraft {
  const normalized = normalizeStopDraft(value, pointRange);
  if (!validateStopDraft(normalized)) {
    throw new Error('Generated stop was missing required fields.');
  }
  return normalized;
}

export function assertVerificationResult(value: unknown): VerificationResult {
  if (!value || typeof value !== 'object') {
    throw new Error('Expected a verification object.');
  }
  const result = value as Record<string, unknown>;
  if (typeof result.success !== 'boolean') {
    throw new Error('Verification result was missing a boolean success field.');
  }
  const message = normalizeText(
    result.message,
    result.success ? 'Nice find.' : 'Close, but try a clearer shot of the target.'
  );
  return { success: result.success, message };
}

export async function requestValidatedJson<T>(args: {
  client: { chat: { completions: { create: (input: unknown) => Promise<any> } } };
  request: {
    model: string;
    response_format: { type: 'json_object' };
    messages: Array<{ role: 'system' | 'user'; content: any }>;
    max_tokens?: number;
  };
  validate: (data: unknown) => T;
  repairPrompt: string;
  maxAttempts?: number;
}): Promise<T> {
  const { client, request, validate, repairPrompt, maxAttempts = 2 } = args;
  let lastError = 'Unknown validation error';
  let messages = request.messages;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await Promise.race([
      client.chat.completions.create({ ...request, messages }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OpenAI request timed out after 25s')), 25000)
      ),
    ]);
    const text = response.choices?.[0]?.message?.content ?? '{}';

    try {
      const parsed = JSON.parse(text);
      return validate(parsed);
    } catch (error: any) {
      lastError = error?.message ?? 'Failed to parse JSON.';
      messages = [
        ...request.messages,
        {
          role: 'user',
          content: `${repairPrompt}\nValidation error: ${lastError}\nReturn corrected JSON only.`,
        },
      ];
    }
  }

  throw new Error(lastError);
}
