/**
 * Dialogue attribution + duration helpers for story Watch films.
 * LLM path uses OPENAI_API_KEY when set; otherwise heuristic attribution.
 */

export type ScriptBeat = {
  paragraphIndex: number;
  speaker: string;
  isNarration: boolean;
  text: string;
};

export type ScriptCharacter = {
  name: string;
  genderHint?: string;
  ageHint?: string;
};

export type AttributionScript = {
  beats: ScriptBeat[];
  characters: ScriptCharacter[];
  confidence: "high" | "degraded";
};

export const MAX_FILM_PARAGRAPHS = 80;
export const WORDS_PER_MINUTE = 150;

export const VOICE_CATALOG = [
  { id: "voice_narrator", label: "Narrator" },
  { id: "voice_a", label: "Voice A" },
  { id: "voice_b", label: "Voice B" },
  { id: "voice_c", label: "Voice C" },
  { id: "voice_d", label: "Voice D" },
  { id: "voice_e", label: "Voice E" },
  { id: "voice_f", label: "Voice F" },
] as const;

export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function estimatedDurationSec(wordCount: number): number {
  return Math.max(5, Math.round((wordCount / WORDS_PER_MINUTE) * 60));
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function voiceIdForCharacter(name: string, isNarrator: boolean): string {
  if (isNarrator || name.toLowerCase() === "narrator") {
    return VOICE_CATALOG[0].id;
  }
  const voices = VOICE_CATALOG.slice(1);
  return voices[hashString(name.toLowerCase()) % voices.length].id;
}

export function characterKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48) || "character";
}

/** Heuristic attribution: quoted lines + optional "Name said" patterns. */
export function attributeHeuristically(body: string): AttributionScript {
  const paragraphs = splitParagraphs(body);
  const beats: ScriptBeat[] = [];
  const characterNames = new Set<string>();
  let lastSpeaker = "Narrator";

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]!;
    const saidMatch = para.match(
      /^["“]([\s\S]+?)["”]\s*,?\s*([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)?)\s+(said|asked|replied|whispered|shouted)/
    );
    const nameColon = para.match(
      /^([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)?)\s*:\s*["“]([\s\S]+)["”]\s*$/
    );
    const quoted = para.match(/^["“]([\s\S]+)["”]\s*$/);

    if (saidMatch) {
      const speaker = saidMatch[2]!;
      characterNames.add(speaker);
      lastSpeaker = speaker;
      beats.push({
        paragraphIndex: i,
        speaker,
        isNarration: false,
        text: saidMatch[1]!,
      });
      continue;
    }
    if (nameColon) {
      const speaker = nameColon[1]!;
      characterNames.add(speaker);
      lastSpeaker = speaker;
      beats.push({
        paragraphIndex: i,
        speaker,
        isNarration: false,
        text: nameColon[2]!,
      });
      continue;
    }
    if (quoted) {
      characterNames.add(lastSpeaker === "Narrator" ? "Speaker" : lastSpeaker);
      const speaker = lastSpeaker === "Narrator" ? "Speaker" : lastSpeaker;
      if (speaker !== "Narrator") characterNames.add(speaker);
      beats.push({
        paragraphIndex: i,
        speaker,
        isNarration: false,
        text: quoted[1]!,
      });
      continue;
    }

    beats.push({
      paragraphIndex: i,
      speaker: "Narrator",
      isNarration: true,
      text: para,
    });
  }

  const characters: ScriptCharacter[] = [
    { name: "Narrator" },
    ...[...characterNames]
      .filter((n) => n !== "Narrator")
      .map((name) => ({ name })),
  ];

  const coverage = beats.reduce((n, b) => n + b.text.replace(/\s+/g, "").length, 0);
  const source = body.replace(/\s+/g, "").length;
  const confidence =
    source > 0 && coverage / source >= 0.95 ? "high" : "degraded";

  return { beats, characters, confidence };
}

export async function attributeWithLlm(
  body: string,
  title: string,
  genre: string
): Promise<AttributionScript | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Attribute every line of this story chapter to a speaker. Return ONLY JSON:
{"beats":[{"paragraphIndex":0,"speaker":"Narrator","isNarration":true,"text":"..."}],"characters":[{"name":"Narrator"}]}
Rules: never drop text; narration uses Narrator; dialogue uses character names; preserve order.
Title: ${title}
Genre: ${genre}
Chapter:
${body.slice(0, 12000)}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You attribute dialogue in fiction. Output JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      beats?: ScriptBeat[];
      characters?: ScriptCharacter[];
    };
    if (!parsed.beats?.length) return null;
    return {
      beats: parsed.beats,
      characters: parsed.characters?.length
        ? parsed.characters
        : [{ name: "Narrator" }],
      confidence: "high",
    };
  } catch {
    return null;
  }
}

export async function buildAttributionScript(
  body: string,
  title: string,
  genre: string
): Promise<AttributionScript> {
  const llm = await attributeWithLlm(body, title, genre);
  if (llm) {
    const sourceLen = body.replace(/\s+/g, "").length;
    const coverage = llm.beats.reduce(
      (n, b) => n + b.text.replace(/\s+/g, "").length,
      0
    );
    if (sourceLen > 0 && coverage / sourceLen >= 0.9) return llm;
    // Retry once is omitted in helper; merge residual as narrator
    const heuristic = attributeHeuristically(body);
    return {
      beats: heuristic.beats,
      characters: mergeCharacters(llm.characters, heuristic.characters),
      confidence: "degraded",
    };
  }
  return attributeHeuristically(body);
}

function mergeCharacters(
  a: ScriptCharacter[],
  b: ScriptCharacter[]
): ScriptCharacter[] {
  const map = new Map<string, ScriptCharacter>();
  for (const c of [...a, ...b]) {
    map.set(c.name.toLowerCase(), c);
  }
  return [...map.values()];
}
