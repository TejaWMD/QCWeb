// Shared logic for the Planning section: product master, recipe versions and machines.
import { base44 } from "@/api/base44Client";
import { actingUserName, appRoleOf, isAdminUser } from "@/lib/permissions";
import { eventStamp } from "@/lib/warehouse";
import { activeRecipeFor, recipeVersionsFor } from "@/lib/recipeMaster";

import { productService } from "@/services/productService";
import { supabase } from "@/api/supabaseClient";

export const PRODUCT_CATEGORIES = ["Sauce", "Paste", "Seasoning", "Honey", "Beverage", "Powder Mix", "OEM", "Other"];
export const MACHINE_STATUSES = ["Active", "Under Maintenance"];
export const INGREDIENT_UNITS = ["kg", "g", "L", "ml", "PCS", "pack", "box"];

// Recipes are owned by QA; the product and machine masters by planning roles.
export const canEditRecipes = (user) => isAdminUser(user) || appRoleOf(user) === "qa_officer";
export const canEditProducts = (user) =>
  isAdminUser(user) || ["manager", "supervisor", "qa_officer"].includes(appRoleOf(user));
export const canEditMachines = (user) => isAdminUser(user) || appRoleOf(user) === "manager";

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const fmtQty = (v) => num(v).toLocaleString("en-US", { maximumFractionDigits: 3 });

export const loadMachines = async () => {
  return await productService.getMachines();
};

export const loadProducts = async () => {
  return await productService.getActiveProducts();
};

export const loadRecipes = async () => {
  return await productService.getRecipes();
};

export const loadPackagingItems = async () => {
  return await productService.getPackagingItems();
};

// Warehouse materials that recipes draw from (empty when the warehouse list is unused).
export const loadMaterials = async () => {
  const { data } = await supabase.from('warehouse_items').select('*').order('item_code').catch(() => ({ data: [] }));
  return Array.isArray(data) ? data : [];
};

const upper = (s) => (s || "").trim().toUpperCase();

export const codeExists = (code, products, ignoreId) =>
  products.some((p) => p.id !== ignoreId && upper(p.product_code) === upper(code));

// A product is resolved through its recipe link (shared by every product with the
// same recipe name), so a product or a product id both work here.
export const versionsFor = (recipes, product) => recipeVersionsFor(recipes, product);

export const activeRecipe = (recipes, product) => activeRecipeFor(recipes, product);

export const nextVersion = (recipes, product) => num(versionsFor(recipes, product)[0]?.version) + 1;

export const logPlanningAudit = async ({ user, module, action, recordId, details, oldValue = "", newValue = "" }) => {
  try {
    await base44.entities.AuditLog.create({
      event_time: new Date().toISOString(),
      event_stamp: eventStamp(),
      user_name: actingUserName(user),
      module,
      action,
      record_id: recordId || "",
      details,
      old_value: oldValue,
      new_value: newValue,
    });
  } catch {
    // The saved record stands even if the audit entry cannot be written.
  }
};