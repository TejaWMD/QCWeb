import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, Search } from "lucide-react";
import { inputClass } from "@/components/planning/styles";

// Searchable product dropdown over the Product Master.
export default function ProductPicker({ products = [], value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = products.find((p) => p.id === value) || null;

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products
      .filter((p) => !term || `${p.product_name} ${p.product_code}`.toLowerCase().includes(term))
      .slice(0, 60);
  }, [products, query]);

  const pick = (product) => {
    onChange(product);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 rounded-md border border-[#1e2740] bg-[#0a0e17] px-3 py-2 text-sm text-left disabled:opacity-50 ${selected ? "text-white" : "text-[#5f6b7f]"}`}
      >
        <span className="truncate">
          {selected ? `${selected.product_name}` : "Select a product"}
          {selected?.product_code ? <span className="text-[#5f6b7f]"> · {selected.product_code}</span> : null}
        </span>
        <ChevronDown className="w-4 h-4 opacity-60 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-[#1e2740] bg-[#0b1018] shadow-xl">
          <div className="flex items-center gap-2 border-b border-[#1e2740] px-2 py-1.5">
            <Search className="w-3.5 h-3.5 text-[#5f6b7f]" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or code"
              className={`${inputClass} h-7 border-0 shadow-none focus-visible:ring-0 text-sm`}
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[#5f6b7f]">No product matches.</p>
            ) : (
              matches.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => pick(product)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-left text-[#a0aec0] hover:bg-white/5 hover:text-white"
                >
                  <span className="truncate">
                    {product.product_name}
                    <span className="text-[10px] text-[#5f6b7f] ml-1.5">{product.product_code}</span>
                  </span>
                  {product.id === value && <Check className="w-3.5 h-3.5 text-[#00e5ff]" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}