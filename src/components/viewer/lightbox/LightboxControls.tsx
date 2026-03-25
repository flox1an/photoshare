import { CommentIcon, HeartIcon } from "../icons";
import RoundButton from "../RoundButton";
import type { PhotoReactions } from "@/hooks/useReactions";
import type { PhotoEntry } from "@/types/album";
import type { Dispatch, SetStateAction } from "react";

interface LightboxControlsProps {
  photo: PhotoEntry;
  photosLength: number;
  currentIndex: number;
  controlsVisible: boolean;
  reactionsPanelOpen: boolean;
  setReactionsPanelOpen: Dispatch<SetStateAction<boolean>>;
  reactionsByPhoto?: Map<string, PhotoReactions>;
  onReact?: (photoHash: string) => Promise<void>;
  onComment?: (photoHash: string, text: string) => Promise<void>;
  onDownload: (index: number) => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasReacted?: boolean;
  mobileNavVisible: boolean;
}

export function LightboxControls({
  photo,
  photosLength,
  currentIndex,
  controlsVisible,
  reactionsPanelOpen,
  setReactionsPanelOpen,
  reactionsByPhoto,
  onReact,
  onComment,
  onDownload,
  onClose,
  onPrev,
  onNext,
  hasReacted,
  mobileNavVisible,
}: LightboxControlsProps) {
  const heartCount = reactionsByPhoto?.get(photo.hash)?.reactions.length ?? 0;
  const commentCount = reactionsByPhoto?.get(photo.hash)?.comments.length ?? 0;

  return (
    <>
      {reactionsByPhoto && onReact && (
        <div
          className={`absolute bottom-4 right-4 z-10 transition-opacity duration-500 ${
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          } ${reactionsPanelOpen ? "max-md:hidden" : ""}`}
        >
          <RoundButton
            pill
            onClick={() => void onReact(photo.hash)}
            disabled={hasReacted}
            aria-label={hasReacted ? "Liked" : "Like"}
            className={hasReacted ? "disabled:opacity-100" : undefined}
          >
            <HeartIcon className={`h-5 w-5 shrink-0 ${hasReacted ? "text-rose-500" : ""}`} solid={hasReacted} />
            {heartCount > 0 && <span className="tabular-nums">{heartCount}</span>}
          </RoundButton>
        </div>
      )}

      <div
        className={`absolute top-4 right-4 z-10 flex items-center gap-2 transition-opacity duration-500 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        } ${reactionsPanelOpen ? "max-md:hidden" : ""}`}
      >
        {reactionsByPhoto && onComment && (
          <RoundButton
            pill
            active={reactionsPanelOpen}
            onClick={() => setReactionsPanelOpen((open) => !open)}
            aria-label="Comments"
          >
            <CommentIcon className="h-5 w-5 shrink-0" />
            {commentCount > 0 && <span className="tabular-nums">{commentCount}</span>}
          </RoundButton>
        )}
        <RoundButton onClick={() => onDownload(currentIndex)} aria-label="Download">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </RoundButton>
        <RoundButton onClick={onClose} aria-label="Close">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </RoundButton>
      </div>

      {photosLength > 1 && (
        <div
          className={`absolute bottom-4 left-0 right-0 z-10 text-center pointer-events-none transition-opacity duration-500 ${
            controlsVisible ? "opacity-100" : "opacity-0"
          } ${reactionsPanelOpen ? "max-md:hidden" : ""}`}
        >
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-zinc-400 font-mono">
            {currentIndex + 1} / {photosLength}
          </span>
        </div>
      )}

      {currentIndex > 0 && (
        <RoundButton
          className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 transition-[opacity,colors] duration-500 ${
            controlsVisible ? "md:opacity-100" : "md:opacity-0 md:pointer-events-none"
          } ${mobileNavVisible && !reactionsPanelOpen ? "max-md:opacity-100" : "max-md:opacity-0 max-md:pointer-events-none"}`}
          onClick={onPrev}
          aria-label="Previous"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </RoundButton>
      )}

      {currentIndex < photosLength - 1 && (
        <RoundButton
          className={`absolute right-3 top-1/2 -translate-y-1/2 z-10 transition-[opacity,colors] duration-500 ${
            controlsVisible ? "md:opacity-100" : "md:opacity-0 md:pointer-events-none"
          } ${mobileNavVisible && !reactionsPanelOpen ? "max-md:opacity-100" : "max-md:opacity-0 max-md:pointer-events-none"}`}
          onClick={onNext}
          aria-label="Next"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </RoundButton>
      )}
    </>
  );
}
