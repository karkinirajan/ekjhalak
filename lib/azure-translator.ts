const AZURE_TRANSLATOR_ENDPOINT =
  process.env.AZURE_TRANSLATOR_ENDPOINT ||
  "https://api.cognitive.microsofttranslator.com";
const AZURE_TRANSLATOR_KEY = process.env.AZURE_TRANSLATOR_KEY;
const AZURE_TRANSLATOR_REGION = process.env.AZURE_TRANSLATOR_REGION;

export interface AzureTranslationItem {
  to: string;
  text: string;
}

export interface AzureTranslateResult {
  detectedLanguage: { language: string; score?: number } | null;
  translations: AzureTranslationItem[];
}

export interface AzureBatchTranslateResult {
  detectedLanguage: { language: string; score?: number } | null;
  translations: AzureTranslationItem[][];
}

interface TranslateWithAzureParams {
  text: string;
  from?: string;
  to: string | string[];
}

interface TranslateManyWithAzureParams {
  texts: string[];
  from?: string;
  to: string | string[];
}

export function isAzureTranslatorConfigured() {
  return Boolean(AZURE_TRANSLATOR_KEY);
}

function buildAzureTranslateUrl(
  from: string | undefined,
  to: string | string[],
) {
  const targets = Array.isArray(to) ? to : [to];
  if (targets.length === 0 || targets.some((lang) => !lang?.trim())) {
    throw new Error("Target language is required");
  }

  const url = new URL("/translate", AZURE_TRANSLATOR_ENDPOINT);
  url.searchParams.set("api-version", "3.0");
  if (from?.trim()) {
    url.searchParams.set("from", from.trim());
  }
  for (const lang of targets) {
    url.searchParams.append("to", lang.trim());
  }

  return url;
}

async function postAzureTranslation(
  body: Array<{ text: string }>,
  from: string | undefined,
  to: string | string[],
) {
  const url = buildAzureTranslateUrl(from, to);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_TRANSLATOR_KEY!,
      ...(AZURE_TRANSLATOR_REGION
        ? { "Ocp-Apim-Subscription-Region": AZURE_TRANSLATOR_REGION }
        : {}),
      "Content-Type": "application/json",
      "X-ClientTraceId": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      `Azure Translator HTTP ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  return data;
}

export async function translateWithAzure({
  text,
  from,
  to,
}: TranslateWithAzureParams): Promise<AzureTranslateResult> {
  if (!AZURE_TRANSLATOR_KEY) {
    throw new Error("Azure Translator is not configured");
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error("Text is required");
  }

  const data = await postAzureTranslation([{ text: trimmedText }], from, to);

  return {
    detectedLanguage: data?.[0]?.detectedLanguage ?? null,
    translations:
      data?.[0]?.translations?.map(
        (item: { to: string; text: string }): AzureTranslationItem => ({
          to: item.to,
          text: item.text,
        }),
      ) ?? [],
  };
}

export async function translateManyWithAzure({
  texts,
  from,
  to,
}: TranslateManyWithAzureParams): Promise<AzureBatchTranslateResult> {
  if (!AZURE_TRANSLATOR_KEY) {
    throw new Error("Azure Translator is not configured");
  }

  const trimmedTexts = texts.map((text) => text.trim()).filter(Boolean);
  if (trimmedTexts.length === 0) {
    return { detectedLanguage: null, translations: [] };
  }

  const data = await postAzureTranslation(
    trimmedTexts.map((text) => ({ text })),
    from,
    to,
  );

  return {
    detectedLanguage: data?.[0]?.detectedLanguage ?? null,
    translations:
      data?.map(
        (entry: { translations?: Array<{ to: string; text: string }> }) =>
          entry.translations?.map(
            (item): AzureTranslationItem => ({
              to: item.to,
              text: item.text,
            }),
          ) ?? [],
      ) ?? [],
  };
}
