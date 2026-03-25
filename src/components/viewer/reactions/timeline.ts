import type { PhotoReactions } from "@/hooks/useReactions";
import type { UnwrappedRumor } from "@/lib/nostr/nip59";

export type TimelineEntry = UnwrappedRumor & { _kind: "comment" | "reaction" };

export function buildTimelineEntries(reactions: PhotoReactions | undefined): TimelineEntry[] {
  return [
    ...(reactions?.reactions ?? []).map((r) => ({ ...r, _kind: "reaction" as const })),
    ...(reactions?.comments ?? []).map((c) => ({ ...c, _kind: "comment" as const })),
  ].sort((a, b) => a.created_at - b.created_at);
}
