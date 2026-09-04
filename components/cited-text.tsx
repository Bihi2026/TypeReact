import Link from "next/link";
import { Fragment } from "react";

/** Matches TR-/BRK-/CASE- codes, optionally prefixed with @ */
const CODE_RE = /(@?(?:TR|BRK|CASE)-\d{4}-\d{3,5})/gi;

export function CitedText({
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
          return <Fragment key={i}>{part}</Fragment>;
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
