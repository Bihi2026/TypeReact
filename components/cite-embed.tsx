"use client";

import * as React from "react";
import { Check, Code2, Copy, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { BRAND_NAME } from "@/lib/brand";

const CITE_KIND_LABEL: Record<"bark" | "case", string> = {
  bark: "Reaction",
  case: "case",
};

export function CiteEmbed({
  code,
  title,
  path,
  kind = "bark",
}: {
  code: string;
  title: string;
  path: string;
  kind?: "bark" | "case";
}) {
  const [origin, setOrigin] = React.useState("https://typereact.com");
  const [copied, setCopied] = React.useState<"embed" | "cite" | null>(null);

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = `${origin}${path}`;
  const cite =
    kind === "bark"
      ? `${title} (${code}). ${BRAND_NAME}. ${url}`
      : `${title} (${code}). ${BRAND_NAME} Accountability Case. ${url}`;
  const embed = `<blockquote cite="${url}" data-typereact="${code}">
  <p><a href="${url}">${title}</a> — <code>${code}</code></p>
  <footer>${BRAND_NAME}</footer>
</blockquote>
<script async src="${origin}/embed.js" data-code="${code}"></script>`;

  const copy = async (text: string, key: "embed" | "cite", label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Couldn't copy.");
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <QrCode className="size-4 text-primary" aria-hidden />
          Cite this {CITE_KIND_LABEL[kind]}
        </CardTitle>
        <CardDescription className="text-xs">
          For articles, orgs, and classrooms — QR, citation, or embed snippet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="qr">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="qr" className="text-xs">
              QR
            </TabsTrigger>
            <TabsTrigger value="cite" className="text-xs">
              Cite
            </TabsTrigger>
            <TabsTrigger value="embed" className="text-xs">
              Embed
            </TabsTrigger>
          </TabsList>
          <TabsContent value="qr" className="mt-3 flex flex-col items-center gap-3">
            <div className="rounded-lg border bg-card p-3">
              <QRCodeSVG value={url} size={140} level="M" includeMargin={false} />
            </div>
            <p className="text-center font-mono text-[10px] text-[#E83F00]">
              {code}
            </p>
          </TabsContent>
          <TabsContent value="cite" className="mt-3 space-y-2">
            <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
              {cite}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => copy(cite, "cite", "Citation")}
            >
              {copied === "cite" ? (
                <Check className="size-3.5 text-agree" />
              ) : (
                <Copy className="size-3.5" />
              )}
              Copy citation
            </Button>
          </TabsContent>
          <TabsContent value="embed" className="mt-3 space-y-2">
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-mono text-[10px] leading-relaxed">
              {embed}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => copy(embed, "embed", "Embed code")}
            >
              {copied === "embed" ? (
                <Check className="size-3.5 text-agree" />
              ) : (
                <Code2 className="size-3.5" />
              )}
              Copy embed
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
