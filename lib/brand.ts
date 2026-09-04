export const BRAND_NAME = "TypeReact";
export const REACTION_SINGULAR = "Reaction";
export const REACTION_PLURAL = "Reactions";
export const REACTION_ID_LABEL = "Reaction ID";

export function contentKindLabel(kind: "bark" | "case"): string {
  return kind === "bark" ? REACTION_SINGULAR : "Case";
}
