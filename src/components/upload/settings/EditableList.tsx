import { useState } from "react";
import type { ReactNode } from "react";

interface EditableListProps {
  items: string[];
  onRemove: (index: number) => void;
  onAdd: (value: string) => Promise<string | null> | string | null;
  addPlaceholder: string;
  showPrimaryOnFirst?: boolean;
  renderSuffix?: (item: string) => ReactNode;
}

export function EditableList({
  items,
  onRemove,
  onAdd,
  addPlaceholder,
  showPrimaryOnFirst = false,
  renderSuffix,
}: EditableListProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const value = input.trim();
    if (!value) return;
    setIsAdding(true);
    setError(null);
    const maybeError = await onAdd(value);
    if (maybeError) {
      setError(maybeError);
    } else {
      setInput("");
    }
    setIsAdding(false);
  };

  return (
    <>
      <ul className="mb-3 space-y-1.5">
        {items.map((item, i) => (
          <li
            key={item}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-black/34 px-3 py-2"
          >
            {showPrimaryOnFirst && i === 0 && (
              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-400">
                primary
              </span>
            )}
            <span className="flex-1 truncate font-mono text-xs text-zinc-300">{item}</span>
            {renderSuffix?.(item)}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="shrink-0 text-zinc-600 hover:text-red-400 transition-colors"
              aria-label={`Remove ${item}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <input
          type="text"
          className="flex-1 rounded-lg border border-zinc-700 bg-black/34 p-3 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleAdd();
            }
          }}
          placeholder={addPlaceholder}
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={isAdding || !input.trim()}
          className="shrink-0 rounded-lg border border-zinc-700 bg-black/46 px-4 py-3 text-xs font-medium text-zinc-300 hover:bg-black/58 disabled:opacity-50 transition-colors"
        >
          {isAdding ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-zinc-300" />
          ) : (
            "Add"
          )}
        </button>
      </div>

      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </>
  );
}
