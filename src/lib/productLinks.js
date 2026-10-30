// Shared product linking for the batch, warehouse and QA modules: every one of
// them reads finished goods from the Product Master and the recipe that belongs
// to the item, instead of keeping its own copy of the product name.
import { loadBatchRecords } from "@/lib/labels";
import { loadProducts, loadRecipes } from "@/lib/planning";
import { activeRecipeFor } from "@/lib/recipeMaster";

// The three fields stored on any record that points at a Product Master item.
export const productLink = (product) => ({
  product_id: product?.id || "",
  product_code: product?.product_code || "",
  product_name: product?.product_name || "",
});

export const productText = (record) =>
  record?.product_code
    ? `${record.product_code}${record.product_name ? ` · ${record.product_name}` : ""}`
    : record?.product_name || "—";

// Batch numbers already recorded for one product, used by the batch pickers.
export const batchesForProduct = (records = [], productId) =>
  !productId
    ? []
    : records
        .filter((r) => r.product_id === productId)
        .map((r) => r.batch_number)
        .filter(Boolean)
        .sort();

// The active recipe of the item (product id accepted as well).
export const recipeOf = (recipes = [], product) => activeRecipeFor(recipes, product);

export const recipeLabel = (recipe) =>
  recipe ? `${recipe.recipe_name || "Recipe"} · v${recipe.version}` : "";

export const loadProductLinkData = async () => {
  const [products, recipes, records] = await Promise.all([loadProducts(), loadRecipes(), loadBatchRecords()]);
  return { products, recipes, records };
};