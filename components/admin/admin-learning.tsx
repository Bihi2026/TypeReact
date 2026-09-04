"use client";

import * as React from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { GraduationCap, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { parseBodyToBlocks } from "@/lib/barks/content-blocks";
import { detectSource } from "@/lib/detect-source";
import {
  learningCategories,
  learningTypeMeta,
  slugifyLearningTitle,
} from "@/lib/learning/catalog";
import type {
  LearningCategory,
  LearningResourceType,
  SourcePlatform,
} from "@/lib/types";

type FormState = {
  title: string;
  slug: string;
  description: string;
  type: LearningResourceType;
  category: LearningCategory;
  sortOrder: number;
  durationMinutes: string;
  thumbnailUrl: string;
  videoUrl: string;
  videoPlatform: SourcePlatform;
  articleBody: string;
  externalDownloadUrl: string;
  fileName: string;
  fileContentType: string;
  fileStorageId: Id<"_storage"> | null;
};

const emptyForm = (): FormState => ({
  title: "",
  slug: "",
  description: "",
  type: "article",
  category: "getting-started",
  sortOrder: 0,
  durationMinutes: "",
  thumbnailUrl: "",
  videoUrl: "",
  videoPlatform: "youtube",
  articleBody: "",
  externalDownloadUrl: "",
  fileName: "",
  fileContentType: "",
  fileStorageId: null,
});

function blocksToBody(
  blocks: Array<{ kind: string; text?: string; items?: string[]; attribution?: string }>
): string {
  return blocks
    .map((block) => {
      if (block.kind === "heading") return `## ${block.text ?? ""}`;
      if (block.kind === "quote") {
        const attr = block.attribution ? `\n— ${block.attribution}` : "";
        return `> ${block.text ?? ""}${attr}`;
      }
      if (block.kind === "list") {
        return (block.items ?? []).map((item) => `- ${item}`).join("\n");
      }
      if (block.kind === "paragraph") return block.text ?? "";
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function AdminLearningPanel() {
  const { isAuthenticated } = useConvexAuth();
  const rows = useQuery(api.learning.listAll, isAuthenticated ? {} : "skip");
  const create = useMutation(api.learning.create);
  const update = useMutation(api.learning.update);
  const publish = useMutation(api.learning.publish);
  const unpublish = useMutation(api.learning.unpublish);
  const remove = useMutation(api.learning.remove);
  const generateUploadUrl = useMutation(api.learning.generateUploadUrl);
  const seedStarter = useMutation(api.learning.seedStarter);

  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] =
    React.useState<Id<"learningResources"> | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: Id<"learningResources">;
    title: string;
  } | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (row: NonNullable<typeof rows>[number]) => {
    setEditingId(row._id);
    setForm({
      title: row.title,
      slug: row.slug,
      description: row.description,
      type: row.type,
      category: row.category,
      sortOrder: row.sortOrder,
      durationMinutes: row.durationMinutes?.toString() ?? "",
      thumbnailUrl: row.thumbnailUrl ?? "",
      videoUrl: row.videoUrl ?? "",
      videoPlatform: row.videoPlatform ?? "youtube",
      articleBody: blocksToBody(row.contentBlocks ?? []),
      externalDownloadUrl: row.externalDownloadUrl ?? "",
      fileName: row.fileName ?? "",
      fileContentType: row.fileContentType ?? "",
      fileStorageId: row.fileStorageId ?? null,
    });
    setOpen(true);
  };

  const patchForm = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const detectVideoMeta = (url: string) => {
    const detected = detectSource(url, []);
    if (!detected) return;
    patchForm({
      videoPlatform: detected.source.platform,
      thumbnailUrl: detected.source.thumbnailUrl ?? form.thumbnailUrl,
    });
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const postUrl = await generateUploadUrl({});
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed");
      const { storageId } = (await result.json()) as {
        storageId: Id<"_storage">;
      };
      patchForm({
        fileStorageId: storageId,
        fileName: file.name,
        fileContentType: file.type || "application/octet-stream",
      });
      toast.success("File uploaded");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload file"
      );
    } finally {
      setUploading(false);
    }
  };

  const buildPayload = () => {
    const duration = form.durationMinutes.trim()
      ? Number(form.durationMinutes)
      : undefined;
    const contentBlocks =
      form.type === "article"
        ? parseBodyToBlocks(form.articleBody, 0).filter(
            (b) => b.kind !== "evidence"
          )
        : undefined;

    return {
      title: form.title,
      slug: form.slug || slugifyLearningTitle(form.title),
      description: form.description,
      type: form.type,
      category: form.category,
      sortOrder: form.sortOrder,
      durationMinutes: Number.isFinite(duration) ? duration : undefined,
      thumbnailUrl: form.thumbnailUrl || undefined,
      videoUrl: form.type === "video" ? form.videoUrl : undefined,
      videoPlatform: form.type === "video" ? form.videoPlatform : undefined,
      contentBlocks,
      fileStorageId:
        form.type === "download" ? form.fileStorageId ?? undefined : undefined,
      fileName: form.type === "download" ? form.fileName || undefined : undefined,
      fileContentType:
        form.type === "download" ? form.fileContentType || undefined : undefined,
      externalDownloadUrl:
        form.type === "download" ? form.externalDownloadUrl || undefined : undefined,
    };
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await update({ id: editingId, ...payload });
        toast.success("Resource updated");
      } else {
        await create(payload);
        toast.success("Draft created");
      }
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const runSeed = async () => {
    try {
      const result = await seedStarter({});
      if (result.skipped) toast.message("Starter content already exists");
      else toast.success(`Seeded ${result.inserted} resources`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Seed failed");
    }
  };

  if (!isAuthenticated || rows === undefined) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading learning resources…
      </p>
    );
  }

  if (rows === null) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="Admins only"
        description="Learning Center management is limited to site admins."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Learning Center</h3>
          <p className="text-sm text-muted-foreground">
            Publish videos, articles, and downloads at{" "}
            <Link href="/learn" className="text-primary hover:underline">
              /learn
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void runSeed()}>
            Seed starter
          </Button>
          <Button type="button" onClick={openCreate}>
            New resource
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No learning resources yet"
          description="Seed starter content or create your first guide."
          action={
            <Button type="button" onClick={openCreate}>
              New resource
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{row.title}</p>
                  <Badge variant={row.status === "published" ? "default" : "secondary"}>
                    {row.status}
                  </Badge>
                  <Badge variant="outline">{learningTypeMeta[row.type].label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  /learn/{row.slug} · sort {row.sortOrder}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href={`/learn/${row.slug}`} target="_blank">
                    View
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(row)}
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </Button>
                {row.status === "published" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void unpublish({ id: row._id }).then(() =>
                        toast.success("Unpublished")
                      )
                    }
                  >
                    Unpublish
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      void publish({ id: row._id })
                        .then(() => toast.success("Published"))
                        .catch((e) =>
                          toast.error(
                            e instanceof Error ? e.message : "Publish failed"
                          )
                        )
                    }
                  >
                    Publish
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    setDeleteTarget({ id: row._id, title: row.title })
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title="Delete this resource?"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.title}"? This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await remove({ id: deleteTarget.id });
          toast.success("Deleted");
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit resource" : "New resource"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="lr-title">Title</Label>
              <Input
                id="lr-title"
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  patchForm({
                    title,
                    slug: form.slug || slugifyLearningTitle(title),
                  });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lr-slug">Slug</Label>
              <Input
                id="lr-slug"
                value={form.slug}
                onChange={(e) => patchForm({ slug: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lr-desc">Description</Label>
              <Textarea
                id="lr-desc"
                value={form.description}
                onChange={(e) => patchForm({ description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    patchForm({ type: v as LearningResourceType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="download">Download</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    patchForm({ category: v as LearningCategory })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {learningCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lr-sort">Sort order</Label>
                <Input
                  id="lr-sort"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    patchForm({ sortOrder: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lr-thumb">Thumbnail URL</Label>
                <Input
                  id="lr-thumb"
                  value={form.thumbnailUrl}
                  onChange={(e) => patchForm({ thumbnailUrl: e.target.value })}
                />
              </div>
            </div>

            {form.type === "video" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="lr-video">Video URL</Label>
                  <Input
                    id="lr-video"
                    value={form.videoUrl}
                    onChange={(e) => patchForm({ videoUrl: e.target.value })}
                    onBlur={() => detectVideoMeta(form.videoUrl)}
                    placeholder="https://youtube.com/watch?v=…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lr-duration">Duration (minutes)</Label>
                  <Input
                    id="lr-duration"
                    type="number"
                    value={form.durationMinutes}
                    onChange={(e) =>
                      patchForm({ durationMinutes: e.target.value })
                    }
                  />
                </div>
              </>
            ) : null}

            {form.type === "article" ? (
              <div className="space-y-1.5">
                <Label htmlFor="lr-body">Body</Label>
                <Textarea
                  id="lr-body"
                  value={form.articleBody}
                  onChange={(e) => patchForm({ articleBody: e.target.value })}
                  rows={10}
                  placeholder={"## Heading\n\nParagraph text.\n\n> Quote\n\n- List item"}
                />
              </div>
            ) : null}

            {form.type === "download" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="lr-ext">External download URL</Label>
                  <Input
                    id="lr-ext"
                    value={form.externalDownloadUrl}
                    onChange={(e) =>
                      patchForm({ externalDownloadUrl: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lr-file">Upload file</Label>
                  <Input
                    id="lr-file"
                    type="file"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadFile(file);
                    }}
                  />
                  {form.fileName ? (
                    <p className="text-xs text-muted-foreground">
                      {form.fileName}
                      {form.fileStorageId ? " (uploaded)" : ""}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void save()}>
              {submitting ? "Saving…" : "Save draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
