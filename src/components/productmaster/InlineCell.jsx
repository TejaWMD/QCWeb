import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Check, Pencil, X } from "lucide-react";
import { inputClass } from "@/components/planning/styles";

// A table cell that can be edited in place. Saves on Enter or blur.
export default function InlineCell({ value, display, type = "text", onSave, canEdit, placeholder = "—" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(value ?? ""); }, [value]);

  const commit = async () => {
    if (!editing) return;
    setEditing(false);
    const next = type === "number" ? Number(draft || 0) : draft;
    if (String(next) === String(value ?? "")) return;
    setSaving(true);
    try {
      await onSave?.(next);
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) return <span>{display ?? (value || placeholder)}</span>;

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
          }}
          className={`${inputClass} h-7 text-xs`}
        />
        <button type="button" onClick={commit} className="text-[#00ff9d] hover:text-white"><Check className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => { setDraft(value ?? ""); setEditing(false); }} className="text-[#5f6b7f] hover:text-white"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={saving}
      className="inline-flex items-center gap-1 text-left hover:text-[#00e5ff] group"
      title="Click to edit"
    >
      <span>{display ?? (value || placeholder)}</span>
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60" />
    </button>
  );
}