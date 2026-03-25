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
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-zinc-300"
      />
      <div>
        <p className="text-xs font-medium text-zinc-400">{title}</p>
        <p className="text-xs text-zinc-600">{description}</p>
      </div>
    </label>
  );
}
