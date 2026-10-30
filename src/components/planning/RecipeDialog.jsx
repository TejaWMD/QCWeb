import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Field from "@/components/planning/Field";
import IngredientEditor from "@/components/planning/IngredientEditor";
import { logPlanningAudit, num } from "@/lib/planning";
import { saveRecipeVersion } from "@/lib/recipeMaster";
import { todayStr } from "@/lib/warehouse";
import { dialogClass, inputClass, primaryButton, subtleButton } from "@/components/planning/styles";

// Editing a recipe never overwrites history: the save creates the next version of
// the shared recipe and every product linked to it points at the new version.
export default function RecipeDialog({ open, onClose, recipe, product, products = [], versions = [], materials = [], onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ recipe_name: "", batch_cartons: "", standard_yield_pct: "", effective_date: todayStr(), notes: "", ingredients: [] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const linked = products.length ? products : product ? [product] : [];
  const version = num(recipe?.version) + 1;
  const defaultName = recipe?.recipe_name || product?.recipe_name || product?.product_name || "";

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({
      recipe_name: defaultName,
      batch_cartons: recipe?.batch_cartons ?? product?.standard_batch_cartons ?? "",
      standard_yield_pct: recipe?.standard_yield_pct ?? "",
      effective_date: todayStr(),
      notes: "",
      ingredients: (recipe?.ingredients || []).map((i) => ({ ...i })),
    });
  }, [open, recipe, product]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    const recipeName = (form.recipe_name || "").trim();
    const ingredients = (form.ingredients || []).filter(
      (r) => (r.material_id || (r.material_name || "").trim()) && num(r.quantity_per_batch) > 0
    );
    if (!recipeName) return setError("Enter the recipe name.");
    if (!ingredients.length) return setError("Add at least one ingredient with a quantity per batch.");
    setSaving(true);
    setError("");
    try {
      const saved = await saveRecipeVersion({
        versions,
        products: linked,
        recipeName,
        form: {
          ...form,
          ingredients,
          cooking_time_hr: product?.cooking_time_hr ?? recipe?.cooking_time_hr,
          batch_output_kg: product?.batch_output_kg ?? recipe?.batch_output_kg,
        },
        user,
      });
      await logPlanningAudit({
        user,
        module: "Recipe Master",
        action: recipe ? "Updated" : "Created",
        recordId: linked[0]?.product_code || "",
        details: `Recipe v${saved.version} for ${recipeName} (${ingredients.length} ingredient(s), ${linked.length} item(s))`,
        oldValue: recipe ? `v${recipe.version}` : "",
        newValue: `v${saved.version}`,
      });
      toast({ title: `Recipe v${saved.version} saved`, description: recipeName });
      onSaved?.();
    } catch (e) {
      setError(e?.message || "Could not save the recipe.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="text-white">Recipe — v{version}</DialogTitle>
          <p className="text-xs text-[#5f6b7f]">
            {recipe
              ? `Saving keeps version ${recipe.version} in the history and makes version ${version} the active recipe for every item below.`
              : "Saving creates the first version of this recipe."}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Recipe Name" className="sm:col-span-2">
            <Input value={form.recipe_name} onChange={(e) => set("recipe_name", e.target.value)} className={inputClass} placeholder="Recipe name from Product Master" />
          </Field>
          <Field label="Cartons per Batch">
            <Input type="number" min="0" value={form.batch_cartons} onChange={(e) => set("batch_cartons", e.target.value)} className={inputClass} placeholder="Quantity one batch makes" />
          </Field>
          <Field label="Standard Yield %" hint="Batch yield is measured against this">
            <Input type="number" min="0" step="0.1" value={form.standard_yield_pct} onChange={(e) => set("standard_yield_pct", e.target.value)} className={inputClass} placeholder="98" />
          </Field>
          <Field label="Effective Date">
            <Input type="date" value={form.effective_date} onChange={(e) => set("effective_date", e.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="rounded-lg border border-[#1e2740] bg-[#0e131d] p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f]">Items using this recipe</p>
          <div className="flex flex-wrap gap-1.5">
            {linked.map((p) => (
              <span key={p.id} className="text-xs px-1.5 py-0.5 rounded bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30">
                {p.product_code}
              </span>
            ))}
            {linked.length === 0 && <span className="text-xs text-[#5f6b7f]">No item linked yet.</span>}
          </div>
          {product && (
            <p className="text-[11px] text-[#5f6b7f]">
              Product Master: {num(product.batch_output_kg) || "—"} kg per batch · {num(product.cooking_time_hr) || "—"} h cooking
            </p>
          )}
        </div>

        <Field label="Ingredients (quantity per batch)" hint={materials.length ? undefined : "No warehouse materials found — type the ingredient names in."}>
          <IngredientEditor value={form.ingredients} onChange={(v) => set("ingredients", v)} materials={materials} />
        </Field>

        <Field label="Notes">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputClass} min-h-[70px]`} placeholder="Optional" />
        </Field>

        {error && <p className="text-sm text-[#ff4d4d]">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton}>Cancel</Button>
          <Button onClick={save} disabled={saving} className={primaryButton}>{saving ? "Saving..." : `Save version ${version}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}