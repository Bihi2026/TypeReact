import type { Infer } from "convex/values";
import { contentBlock } from "./validators";

type ContentBlock = Infer<typeof contentBlock>;

export function parseBodyToBlocks(
  body: string,
  evidenceCount = 0
): ContentBlock[] {
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const lines = text.split("\n");
  const blocks: ContentBlock[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    const joined = paragraph.join("\n").trim();
    paragraph = [];
    if (!joined) return;
    const parts = joined.split(/(\[\[ev:\d+\]\])/gi);
    for (const part of parts) {
      const ev = part.match(/^\[\[ev:(\d+)\]\]$/i);
      if (ev) {
        const index = Number(ev[1]);
        if (index >= 0 && index < evidenceCount) {
          blocks.push({ kind: "evidence", evidenceId: String(index) });
        }
        continue;
      }
      const chunk = part.trim();
      if (chunk) blocks.push({ kind: "paragraph", text: chunk });
    }
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ kind: "list", items: listItems });
    listItems = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList();
      flushParagraph();
      continue;
    }

    const heading = trimmed.match(/^##\s+(.+)$/);
    if (heading) {
      flushList();
      flushParagraph();
      blocks.push({ kind: "heading", text: heading[1].trim() });
      continue;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      flushList();
      flushParagraph();
      const quoteText = quote[1].trim();
      const attr = quoteText.match(/^(.*?)\s+—\s+(.+)$/);
      if (attr) {
        blocks.push({
          kind: "quote",
          text: attr[1].trim(),
          attribution: attr[2].trim(),
        });
      } else {
        blocks.push({ kind: "quote", text: quoteText });
      }
      continue;
    }

    const list = trimmed.match(/^[-*]\s+(.+)$/);
    if (list) {
      flushParagraph();
      listItems.push(list[1].trim());
      continue;
    }

    const onlyEv = trimmed.match(/^\[\[ev:(\d+)\]\]$/i);
    if (onlyEv) {
      flushList();
      flushParagraph();
      const index = Number(onlyEv[1]);
      if (index >= 0 && index < evidenceCount) {
        blocks.push({ kind: "evidence", evidenceId: String(index) });
      }
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushList();
  flushParagraph();
  return blocks.length > 0 ? blocks : [{ kind: "paragraph", text }];
}

export function scoreEvidenceRating(
  evidence: Array<{ attestCount?: number; challengeCount?: number }>
) {
  const count = evidence.length;
  let attest = 0;
  let challenge = 0;
  for (const item of evidence) {
    attest += item.attestCount ?? 0;
    challenge += item.challengeCount ?? 0;
  }
  const score = 55 + count * 5 + attest * 8 - challenge * 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}
