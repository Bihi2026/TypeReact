import Link from "next/link";
import { Fragment } from "react";

const CODE_RE = /(@?(?:TR|BRK|CASE)-\d{4}-\d{3,5})/gi;
const MENTION_RE = /(@[a-zA-Z0-9_]{2,32})/g;

function MentionSpans({ text }: { text: string }) {
  const parts = text.split(MENTION_RE);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^@([a-zA-Z0-9_]{2,32})$/);
        if (!match) {
          return <Fragment key={i}>{part}</Fragment>;
        }
        const handle = match[1];
        return (
          <Link
            key={i}
            href={`/profile/${handle}`}
            className="font-medium text-primary hover:underline"
          >
            @{handle}
          </Link>
        );
      })}
    </>
  );
}

export function MentionText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = text.split(CODE_RE);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        const match = part.match(/^@?((?:TR|BRK|CASE)-\d{4}-\d{3,5})$/i);
        if (!match) {
          return <MentionSpans key={i} text={part} />;
        }
        const code = match[1].toUpperCase();
        const href = code.startsWith("CASE")
          ? `/cases/${code}`
          : `/barks/${code}`;
        return (
          <Link
            key={i}
            href={href}
            className="font-mono text-[0.9em] font-medium text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary"
          >
            {part.startsWith("@") ? `@${code}` : code}
          </Link>
        );
      })}
    </span>
  );
}
