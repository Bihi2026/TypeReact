import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LearningResource } from "@/lib/types";

export function LearningDownload({ resource }: { resource: LearningResource }) {
  const url = resource.downloadUrl;
  const fileName = resource.fileName ?? "Download file";

  if (!url) {
    return (
      <div className="rounded-xl border px-4 py-8 text-center text-sm text-muted-foreground">
        Download is not available yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border p-6 text-center sm:flex-row sm:p-8 sm:text-left">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <FileText className="size-7 text-primary" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">{fileName}</p>
        {resource.fileContentType ? (
          <p className="text-sm text-muted-foreground">
            {resource.fileContentType}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">{resource.description}</p>
      </div>
      <Button asChild size="lg" className="shrink-0">
        <a href={url} target="_blank" rel="noopener noreferrer" download>
          <Download className="size-4" aria-hidden />
          Download
        </a>
      </Button>
    </div>
  );
}
