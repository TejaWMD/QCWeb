import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, FileText, ImagePlus, X } from "lucide-react";

const ACCEPT = "image/jpeg,image/png,image/heic,.heic,.pdf";
const MAX_FILES = 10;
const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED_EXT = ["jpg", "jpeg", "png", "heic", "pdf"];

// Photos are compressed before upload so they transfer fast on factory Wi-Fi.
// HEIC files cannot be re-encoded in the browser, so they upload as-is.
const compressImage = (file) =>
  new Promise((resolve) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= 1024 * 1024) return resolve(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1600;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file),
        "image/jpeg",
        0.8
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });

// Multi-file evidence picker: Take Photo / Choose from Gallery on phones and
// tablets, drag & drop on desktop, thumbnails with captions, removable before
// submitting. Files upload privately when the request is submitted.
export default function EvidenceUploader({ files, onChange, max = MAX_FILES }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const addFiles = async (list) => {
    setError("");
    const next = [...files];
    for (const file of Array.from(list || [])) {
      if (next.length >= max) {
        setError(`Up to ${max} files per request.`);
        break;
      }
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        setError(`"${file.name}" is not a JPG, PNG, HEIC or PDF file.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        setError(`"${file.name}" is larger than 25 MB.`);
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random()}`,
        file: await compressImage(file),
        caption: "",
        preview: /\.pdf$/i.test(file.name) ? null : URL.createObjectURL(file),
      });
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border border-dashed px-4 py-4 text-center transition-colors ${
          dragging ? "border-[#00e5ff] bg-[#00e5ff]/5" : "border-[#3a4560] bg-[#0e131d]"
        }`}
      >
        <p className="text-xs text-[#a0aec0] mb-2 hidden sm:block">
          Drag &amp; drop photos or PDFs here (JPG, PNG, HEIC, PDF — up to {max})
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" size="sm" onClick={() => cameraRef.current?.click()} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17]">
            <Camera className="w-4 h-4 mr-1" /> Take Photo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => galleryRef.current?.click()}
            className="bg-[#0e131d] border-[#1e2740] text-[#e2e8f0] hover:bg-white/5"
          >
            <ImagePlus className="w-4 h-4 mr-1" /> Choose from Gallery
          </Button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs text-[#ff4d4d]">{error}</p>}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {files.map((f) => (
            <div key={f.id} className="rounded-lg border border-[#1e2740] bg-[#0e131d] p-2 space-y-1.5">
              <a href={f.preview || undefined} target="_blank" rel="noreferrer" className="block">
                {f.preview ? (
                  <img src={f.preview} alt={f.file.name} className="w-full h-20 object-cover rounded" />
                ) : (
                  <div className="w-full h-20 flex items-center justify-center rounded bg-[#131926]">
                    <FileText className="w-6 h-6 text-[#a0aec0]" />
                  </div>
                )}
              </a>
              <p className="text-[10px] text-[#a0aec0] truncate">{f.file.name}</p>
              <Input
                value={f.caption}
                onChange={(e) => onChange(files.map((x) => (x.id === f.id ? { ...x, caption: e.target.value } : x)))}
                placeholder="Caption (optional)"
                className="h-7 text-xs bg-[#0e131d] border-[#1e2740] text-white"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange(files.filter((x) => x.id !== f.id))}
                className="w-full h-6 text-[#ff4d4d] hover:bg-[#ff4d4d]/10 text-[10px]"
              >
                <X className="w-3 h-3 mr-1" /> Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}