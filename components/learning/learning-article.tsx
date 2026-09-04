"use client";

import { MentionText } from "@/components/comments/mention-text";
import { ReadingProse } from "@/components/reading-prose";
import type { ContentBlock } from "@/lib/types";

export function LearningArticle({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <ReadingProse>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "heading":
            return (
              <h2 key={i}>
                <MentionText text={block.text} />
              </h2>
            );
          case "paragraph":
            return (
              <p key={i}>
                <MentionText text={block.text} />
              </p>
            );
          case "quote":
            return (
              <blockquote key={i}>
                <MentionText text={block.text} />
                {block.attribution ? (
                  <footer className="mt-2 font-sans text-xs not-italic text-muted-foreground">
                    — {block.attribution}
                  </footer>
                ) : null}
              </blockquote>
            );
          case "list":
            return (
              <ul key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>
                    <MentionText text={item} />
                  </li>
                ))}
              </ul>
            );
          default:
            return null;
        }
      })}
    </ReadingProse>
  );
}
