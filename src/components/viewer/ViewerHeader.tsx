import type { DownloadMode } from "@/hooks/useAlbumViewer";
import type { Dispatch, RefObject, SetStateAction } from "react";

interface ViewerHeaderProps {
  title: string;
  photoCount: number;
  isExpired: boolean;
  gridFullscreen: boolean;
  headerVisible: boolean;
  downloadMenuOpen: boolean;
  setDownloadMenuOpen: Dispatch<SetStateAction<boolean>>;
  downloadMenuRef: RefObject<HTMLDivElement | null>;
  isDownloading: boolean;
  isIOS: boolean;
  onToggleFullscreen: () => void;
  onDownloadAll: (mode: DownloadMode) => void;
}

export default function ViewerHeader({
  title,
  photoCount,
  isExpired,
  gridFullscreen,
  headerVisible,
  downloadMenuOpen,
  setDownloadMenuOpen,
  downloadMenuRef,
  isDownloading,
  isIOS,
  onToggleFullscreen,
  onDownloadAll,
}: ViewerHeaderProps) {
  const headerClassName = `sticky top-0 z-30 flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950 transition-transform duration-300${gridFullscreen ? " hidden" : ""} ${headerVisible ? "translate-y-0" : "-translate-y-full"}`;
  const headerActionButtonClass = "h-9 w-9 items-center justify-center rounded-full transition-colors";
  const downloadTriggerClass = `${headerActionButtonClass} flex disabled:opacity-50 disabled:cursor-not-allowed ${downloadMenuOpen ? "bg-zinc-700 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"}`;
  const downloadMenuItemClass = "w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors";

  return (
    <header className={headerClassName}>
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
          <a
            href={window.location.origin}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-300 transition-colors"
          >
            {title}
          </a>
        </h1>
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          {photoCount} {photoCount === 1 ? "photo" : "photos"}
          {isExpired && (
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-950 text-amber-400 border border-amber-800/60">
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Expired
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleFullscreen}
          aria-label="Toggle fullscreen"
          className={`${headerActionButtonClass} hidden md:flex bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </button>

        <div ref={downloadMenuRef} className="relative">
          <button
            onClick={() => setDownloadMenuOpen((open) => !open)}
            disabled={isDownloading}
            aria-label="Download"
            className={downloadTriggerClass}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </button>

          {downloadMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl py-1">
              <button onClick={() => onDownloadAll("zip")} className={downloadMenuItemClass}>
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
                Download as ZIP
              </button>
              {!isIOS && (
                <button onClick={() => onDownloadAll("files")} className={downloadMenuItemClass}>
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                  </svg>
                  Individual files
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
