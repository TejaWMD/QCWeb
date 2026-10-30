// Product Master lifecycle: what uses a product, status changes and the
// soft delete that only moves a product to Recently Deleted.
import { productService } from "@/services/productService";
import { base44 } from "@/api/base44Client";
import { actingUserName } from "@/lib/permissions";
import { logProductAudit, productStatus, statusPayload } from "@/lib/productMaster";

const REFERENCING = [
  ["ProductionOrder", "production order(s)"],
  ["BatchRecord", "batch record(s)"],
  ["Recipe", "recipe(s)"],
  ["BatchYield", "batch yield(s)"],
  ["FillCheck", "fill check(s)"],
  ["ReworkRecord", "rework record(s)"],
];

// Records that point at this product, by id or by Item Code.
export const productUsage = async (product) => {
  const results = await Promise.all(
    REFERENCING.map(async ([entity, label]) => {
      const [byId, byCode] = await Promise.all([
        base44.entities[entity].count({ product_id: product.id }).catch(() => 0),
        base44.entities[entity].count({ product_code: product.product_code }).catch(() => 0),
      ]);
      return { entity, label, count: Math.max(byId || 0, byCode || 0) };
    })
  );
  return results.filter((row) => row.count > 0);
};

export const usageSummary = (rows = []) => rows.map((row) => `${row.count} ${row.label}`).join(", ");

export const setProductStatus = async ({ product, status, user }) => {
  await productService.updateProduct(product.id, { status });
  await logProductAudit({
    user,
    action: status === "Active" ? "Activated" : "Deactivated",
    recordId: product.product_code,
    details: `${product.product_code} set to ${status}`,
    oldValue: productStatus(product),
    newValue: status,
  });
};

// A product used anywhere can only be set to Inactive; an unused one may be deleted.
export const deleteProduct = async ({ product, user }) => {
  const usage = await productUsage(product);
  if (usage.length) return { blocked: true, usage };
  await productService.softDeleteProduct(product.id, actingUserName(user));
  await logProductAudit({
    user,
    action: "Deleted",
    recordId: product.product_code,
    details: `${product.product_code} moved to Recently Deleted`,
    oldValue: productStatus(product),
    newValue: "Deleted",
  });
  return { blocked: false, usage };
};

export const restoreProduct = async ({ product, user }) => {
  await productService.restoreProduct(product.id);
  await logProductAudit({
    user,
    action: "Restored",
    recordId: product.product_code,
    details: `${product.product_code} restored from Recently Deleted`,
    oldValue: "Deleted",
    newValue: productStatus(product),
  });
};