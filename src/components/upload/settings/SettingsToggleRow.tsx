interface SettingsToggleRowProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description: string;
}

export function SettingsToggleRow({
  checked,
  onChange,
  title,
  description,
}: SettingsToggleRowProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 appearance-none rounded border border-indigo-300/35 bg-black/42 checked:border-indigo-300/60 checked:bg-indigo-400 focus:ring-2 focus:ring-indigo-300/35 focus:ring-offset-0"
      />
      <div>
        <p className="text-xs font-medium text-zinc-400">{title}</p>
        <p className="text-xs text-zinc-600">{description}</p>
      </div>
    </label>
  );
}
