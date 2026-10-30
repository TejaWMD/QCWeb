import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload } from "lucide-react";

// Evidence attachment control: uploads a file privately and shows the uploaded
// file so it can be attached to a record. value: { uri, name }.
export default function EvidenceUpload({ value = {}, onChange, label = "Evidence Attachment" }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const res = await base44.integrations.Core.UploadPrivateFile({ file });
      onChange({ uri: res.file_uri, name: file.name });
    } catch (e) {
      setError(e?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label && <span className="text-xs text-[#a0aec0]">{label}</span>}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {!value.uri && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="bg-[#0e131d] border-[#1e2740] text-[#e2e8f0] hover:bg-[#18202f] hover:text-white w-full justify-start"
        >
          {uploading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" /> Uploading...
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5 mr-1" /> Attach evidence file
            </>
          )}
        </Button>
      )}
      {value.uri && (
        <div className="flex items-center gap-2 bg-[#0e131d] border border-[#1e2740] rounded-md px-2.5 py-1.5">
          <Paperclip className="w-3.5 h-3.5 text-[#00ff9d] shrink-0" />
          <span className="text-xs text-[#e2e8f0] truncate flex-1">{value.name || "Evidence file"}</span>
          <button type="button" className="text-[10px] text-[#ff4d4d] hover:underline" onClick={() => onChange({ uri: "", name: "" })}>
            Remove
          </button>
        </div>
      )}
      {error && <p className="text-xs text-[#ff4d4d]">{error}</p>}
    </div>
  );
}