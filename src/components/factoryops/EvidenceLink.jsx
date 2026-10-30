import React from "react";
import { base44 } from "@/api/base44Client";
import { Paperclip } from "lucide-react";

// Inline link to an attached evidence file: signs the private file on demand and
// opens it in a new tab. uri is the private file_uri stored on the record.
export default function EvidenceLink({ uri, name }) {
  if (!uri) return <span className="text-sm text-[#a0aec0]">—</span>;
  const view = async () => {
    try {
      const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri });
      window.open(res.signed_url, "_blank");
    } catch {
      window.alert("Could not open the attachment. Please try again.");
    }
  };
  return (
    <button
      type="button"
      onClick={view}
      className="text-[#00e5ff] hover:underline text-xs inline-flex items-center gap-1 max-w-[160px] truncate"
      title={name || "View evidence"}
    >
      <Paperclip className="w-3 h-3 shrink-0" />
      {name || "View"}
    </button>
  );
}