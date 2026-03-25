import ReactionsPanel from "../ReactionsPanel";
import type { PhotoReactions } from "@/hooks/useReactions";

interface ReactionsDrawerProps {
  open: boolean;
  photoHash: string;
  reactions: PhotoReactions | undefined;
  loading?: boolean;
  onComment: (photoHash: string, text: string) => Promise<void>;
  onLoginRequest: () => void;
  onEditName?: () => void;
  onClose: () => void;
}

export function ReactionsDrawer({
  open,
  photoHash,
  reactions,
  loading,
  onComment,
  onLoginRequest,
  onEditName,
  onClose,
}: ReactionsDrawerProps) {
  if (!open) return null;

  return (
    <>
      <div className="absolute inset-y-0 right-0 z-20 hidden md:flex w-80 flex-col bg-zinc-950/95 border-l border-zinc-800 backdrop-blur-sm">
        <ReactionsPanel
          photoHash={photoHash}
          reactions={reactions}
          loading={loading}
          onComment={onComment}
          onLoginRequest={onLoginRequest}
          onEditName={onEditName}
          onClose={onClose}
        />
      </div>
      <div className="absolute inset-0 z-20 flex md:hidden flex-col bg-black/75 backdrop-blur-sm">
        <ReactionsPanel
          photoHash={photoHash}
          reactions={reactions}
          loading={loading}
          onComment={onComment}
          onLoginRequest={onLoginRequest}
          onEditName={onEditName}
          onClose={onClose}
        />
      </div>
    </>
  );
}
