"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { FileText, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const MAX_POST_ATTACHMENTS = 5;
export const MAX_POST_FILE_BYTES = 10 * 1024 * 1024;
export const POST_ATTACHMENT_ACCEPT =
  "image/*,application/pdf,.pdf,.doc,.docx,.txt,.md,text/plain,text/markdown";

export type DraftAttachment = {
  id: string;
  storageId: Id<"_storage">;
  fileName: string;
  contentType?: string;
  previewUrl?: string;
  /** True when this file was newly uploaded in the current draft (safe to deleteUpload). */
  unbound?: boolean;
};

export type ListedAttachment = {
  storageId: Id<"_storage">;
  fileName?: string;
  contentType?: string;
  url: string | null;
};

export function isImageType(contentType?: string, fileName?: string) {
  if (contentType?.startsWith("image/")) return true;
  return Boolean(fileName?.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/i));
}

export function listedToDraft(
  files: ListedAttachment[] | undefined
): DraftAttachment[] {
  return (files ?? []).map((file) => ({
    id: `att-${file.storageId}`,
    storageId: file.storageId,
    fileName: file.fileName || "Attachment",
    contentType: file.contentType,
    previewUrl: file.url && isImageType(file.contentType, file.fileName)
      ? file.url
      : undefined,
    unbound: false,
  }));
}

export function draftToPayload(files: DraftAttachment[]) {
  return files.map((file) => ({
    storageId: file.storageId,
    fileName: file.fileName,
    contentType: file.contentType,
  }));
}

export function revokeDraftPreviews(files: DraftAttachment[]) {
  for (const file of files) {
    if (file.unbound && file.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(file.previewUrl);
    }
  }
}

export function PostAttachmentList({
  attachments,
}: {
  attachments: ListedAttachment[];
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="space-y-2">
      {attachments.map((file) => {
        const label = file.fileName || "Attachment";
        if (file.url && isImageType(file.contentType, file.fileName)) {
          return (
            <a
              key={file.storageId}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.url}
                alt={label}
                className="max-h-64 w-full object-cover"
              />
            </a>
          );
        }
        return (
          <a
            key={file.storageId}
            href={file.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
          >
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </a>
        );
      })}
    </div>
  );
}

export function DraftAttachmentChips({
  attachments,
  onRemove,
}: {
  attachments: DraftAttachment[];
  onRemove: (id: string) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((file) => (
        <div
          key={file.id}
          className="flex max-w-full items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
        >
          {file.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.previewUrl}
              alt=""
              className="size-6 rounded object-cover"
            />
          ) : (
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{file.fileName}</span>
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label={`Remove ${file.fileName}`}
            onClick={() => onRemove(file.id)}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useCirclePostAttachments(
  attachments: DraftAttachment[],
  setAttachments: React.Dispatch<React.SetStateAction<DraftAttachment[]>>
) {
  const generateUploadUrl = useMutation(api.evidenceFiles.generateUploadUrl);
  const registerUpload = useMutation(api.evidenceFiles.registerUpload);
  const deleteUpload = useMutation(api.evidenceFiles.deleteUpload);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const removeAttachment = React.useCallback(
    async (id: string) => {
      const file = attachments.find((row) => row.id === id);
      if (!file) return;
      if (file.unbound && file.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(file.previewUrl);
      }
      if (file.unbound) {
        try {
          await deleteUpload({ storageId: file.storageId });
        } catch {
          // Keep UI responsive if cleanup fails.
        }
      }
      setAttachments((prev) => prev.filter((row) => row.id !== id));
    },
    [attachments, deleteUpload, setAttachments]
  );

  const onPickFiles = React.useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const remaining = MAX_POST_ATTACHMENTS - attachments.length;
      if (remaining <= 0) {
        toast.message(`You can attach up to ${MAX_POST_ATTACHMENTS} files`);
        return;
      }
      const chosen = Array.from(files).slice(0, remaining);
      setUploading(true);
      try {
        for (const file of chosen) {
          if (file.size > MAX_POST_FILE_BYTES) {
            toast.error(`${file.name} is larger than 10MB`);
            continue;
          }
          const postUrl = await generateUploadUrl();
          const uploaded = await fetch(postUrl, {
            method: "POST",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          });
          if (!uploaded.ok) throw new Error("Upload failed");
          const payload = (await uploaded.json()) as { storageId?: string };
          if (!payload.storageId) throw new Error("Upload failed");
          const storageId = payload.storageId as Id<"_storage">;
          await registerUpload({ storageId });
          const previewUrl = isImageType(file.type, file.name)
            ? URL.createObjectURL(file)
            : undefined;
          setAttachments((prev) => [
            ...prev,
            {
              id: `att-${storageId}`,
              storageId,
              fileName: file.name,
              contentType: file.type || undefined,
              previewUrl,
              unbound: true,
            },
          ]);
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not attach file"
        );
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [attachments.length, generateUploadUrl, registerUpload, setAttachments]
  );

  const attachButton = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={POST_ATTACHMENT_ACCEPT}
        multiple
        onChange={(e) => void onPickFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        aria-label="Attach file"
        disabled={uploading || attachments.length >= MAX_POST_ATTACHMENTS}
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip className="size-4" />
        {uploading ? "Uploading…" : "Attach"}
      </Button>
    </>
  );

  return { uploading, removeAttachment, attachButton };
}
