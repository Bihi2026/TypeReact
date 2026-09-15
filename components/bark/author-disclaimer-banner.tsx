import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";

export function AuthorDisclaimerBanner() {
  return (
    <aside aria-labelledby="author-disclaimer-heading">
      <Card className="gap-0 border-primary/40 bg-primary/10 p-0">
        <div className="flex items-start gap-3 p-4">
          <Info
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p
              id="author-disclaimer-heading"
              className="text-sm font-semibold tracking-wide text-primary"
            >
              AUTHOR DISCLAIMER
            </p>
            <p className="text-xs text-accent-foreground">
              This reaction represents the author’s own opinions, views, and
              expressions. The author does not work for, represent, or speak on
              behalf of TypeReact. The views expressed are those of the author
              alone and do not necessarily reflect the views of TypeReact. The
              author is solely responsible for the content, opinions, and
              statements expressed in this reaction.
            </p>
          </div>
        </div>
      </Card>
    </aside>
  );
}
