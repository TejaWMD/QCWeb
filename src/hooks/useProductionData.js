import { useCallback, useEffect, useState } from "react";
import { loadMachines, loadPackagingItems, loadProducts, loadRecipes } from "@/lib/planning";
import { loadOrders, loadProductionSettings, loadReceipts } from "@/lib/production";

// Everything the production pages need in one load: orders plus the Product
// Master, Machines, recipes, packaging stock and warehouse receipts they link to.
export default function useProductionData() {
  const [data, setData] = useState({
    orders: [],
    products: [],
    machines: [],
    recipes: [],
    packagingItems: [],
    receipts: [],
    settings: { id: "", batch_pattern: "", default_cph: 300 },
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [orders, products, machines, recipes, packagingItems, receipts, settings] = await Promise.all([
      loadOrders(),
      loadProducts(),
      loadMachines(),
      loadRecipes(),
      loadPackagingItems(),
      loadReceipts(),
      loadProductionSettings(),
    ]);
    setData({ orders, products, machines, recipes, packagingItems, receipts, settings });
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...data, loading, reload };
}