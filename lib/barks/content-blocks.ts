import type { ContentBlock } from "@/lib/types";

/**
 * Parse markdown-ish reaction body into structured blocks.
 * Supports: ## headings, > quotes, - lists, [[ev:N]] evidence embeds.
 */
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
    // Split evidence embeds out of paragraph text
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
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

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
  return blocks.length > 0
    ? blocks
    : [{ kind: "paragraph", text: text }];
}

export function blocksToPlainExcerpt(blocks: ContentBlock[], max = 220) {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.kind === "heading" || block.kind === "paragraph") {
      parts.push(block.text);
    } else if (block.kind === "quote") {
      parts.push(block.text);
    } else if (block.kind === "list") {
      parts.push(block.items.join(" "));
    }
  }
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  return joined.length > max ? `${joined.slice(0, max - 1)}…` : joined;
}

export function resolveBlockEvidenceIds(
  blocks: ContentBlock[],
  code: string
): ContentBlock[] {
  return blocks.map((block) => {
    if (block.kind !== "evidence") return block;
    const index = Number(block.evidenceId);
    if (Number.isFinite(index)) {
      return { kind: "evidence", evidenceId: `${code}-ev-${index}` };
    }
    return block;
  });
}
