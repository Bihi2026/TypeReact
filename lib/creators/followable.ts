import type { Creator } from "@/lib/types";

export function isFollowableCreator(
  creator: Pick<Creator, "status" | "hasTeaBarksProfile">
): boolean {
  return creator.status === "approved" && creator.hasTeaBarksProfile;
}
