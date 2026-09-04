"use client";

import * as React from "react";
import { Bookmark } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SaveBarkButton({
  barkCode,
  className,
  iconOnly = false,
  initialSaves,
}: {
  barkCode: string;
  className?: string;
  iconOnly?: boolean;
  initialSaves?: number;
}) {
  const { isSignedIn } = useAuth();
  const state = useQuery(api.barks.saveState, { code: barkCode });
  const collections = useQuery(
    api.barks.listSaveCollections,
    isSignedIn ? {} : "skip"
  );
  const toggleSave = useMutation(api.barks.toggleSave);
  const createCollection = useMutation(api.barks.createSaveCollection);
  const updateSaveMeta = useMutation(api.barks.updateSaveMeta);
  const saved = state?.saved ?? false;
  const saves = state?.saves ?? initialSaves;
  const [open, setOpen] = React.useState(false);
  const [collectionId, setCollectionId] = React.useState<string>("none");
  const [note, setNote] = React.useState("");
  const [newCollection, setNewCollection] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const unsave = async () => {
    try {
      await toggleSave({ code: barkCode });
      toast.success("Removed from saved", { description: barkCode });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update save"
      );
    }
  };

  const saveWithMeta = async () => {
    setBusy(true);
    try {
      let targetCollection: Id<"saveCollections"> | undefined;
      if (collectionId === "new") {
        const name = newCollection.trim();
        if (!name) {
          toast.error("Name the new collection");
          setBusy(false);
          return;
        }
        targetCollection = await createCollection({ name });
      } else if (collectionId !== "none") {
        targetCollection = collectionId as Id<"saveCollections">;
      }

      if (saved) {
        await updateSaveMeta({
          code: barkCode,
          collectionId: targetCollection ?? null,
          note: note.trim() || null,
        });
        toast.success("Save updated", { description: barkCode });
      } else {
        await toggleSave({
          code: barkCode,
          ...(targetCollection ? { collectionId: targetCollection } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        toast.success("Reaction saved", { description: barkCode });
      }
      setOpen(false);
      setNote("");
      setNewCollection("");
      setCollectionId("none");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update save"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant={saved ? "secondary" : "outline"}
        size="sm"
        className={cn(className)}
        aria-pressed={saved}
        aria-label={saved ? "Manage saved reaction" : "Save reaction"}
        onClick={() => {
          if (!isSignedIn) {
            toast.message("Sign in to save");
            return;
          }
          if (saved) {
            setOpen(true);
            return;
          }
          setOpen(true);
        }}
      >
        <Bookmark className={saved ? "size-3.5 fill-current" : "size-3.5"} />
        {iconOnly
          ? saves !== undefined
            ? formatNumber(saves)
            : null
          : saved
            ? "Saved"
            : "Save"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {saved ? "Update saved reaction" : "Save to library"}
            </DialogTitle>
            <DialogDescription>
              Organize this Reaction into a collection and add a research note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="save-collection">Collection</Label>
              <Select value={collectionId} onValueChange={setCollectionId}>
                <SelectTrigger id="save-collection">
                  <SelectValue placeholder="Uncategorized" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  <SelectItem value="new">Create new…</SelectItem>
                  {(collections ?? []).map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {collectionId === "new" ? (
              <div className="space-y-1.5">
                <Label htmlFor="new-collection">New collection name</Label>
                <Input
                  id="new-collection"
                  value={newCollection}
                  onChange={(e) => setNewCollection(e.target.value)}
                  placeholder="e.g. Climate claims"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="save-note">Note (optional)</Label>
              <Textarea
                id="save-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why you’re saving this…"
                className="min-h-20"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {saved ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    await unsave();
                    setBusy(false);
                    setOpen(false);
                  })();
                }}
              >
                Unsave
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={busy}
              onClick={() => void saveWithMeta()}
            >
              {busy ? "Saving…" : saved ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
