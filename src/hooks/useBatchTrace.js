import { useEffect, useState } from "react";
import { loadOrders } from "@/lib/production";
import { loadRecipes } from "@/lib/planning";
import { loadBatchRecords } from "@/lib/labels";
import {
  batchesUsingLot, downtimeInBatchWindow, ingredientLotsForBatch, loadDowntimes, loadLotReceipts, loadMovements,
  lotDetails, packagingIssuedForBatch, productRecipe,
} from "@/lib/batchTrace";

const upper = (v) => (v || "").trim().toUpperCase();

const EMPTY = {
  loading: true,
  record: null,
  order: null,
  downtimes: [],
  lots: [],
  packaging: [],
  lotMatches: [],
  lotInfo: { receipts: [], movements: [] },
};

// Loads everything a batch or a supplier lot trace needs in one go.
export default function useBatchTrace(batch, lot) {
  const [data, setData] = useState(EMPTY);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setData((prev) => ({ ...prev, loading: true }));
      const [records, orders, recipes, receipts, movements, downtimes] = await Promise.all([
        loadBatchRecords(), loadOrders(), loadRecipes(), loadLotReceipts(), loadMovements(), loadDowntimes(),
      ]);
      if (!active) return;

      const record = batch
        ? records.find((r) => upper(r.batch_number) === upper(batch)) || null
        : null;
      const order = record
        ? orders.find((o) => (record.order_id && o.id === record.order_id) || (o.batch_codes || []).includes(record.batch_number)) || null
        : null;

      setData({
        loading: false,
        record,
        order,
        downtimes: record ? downtimeInBatchWindow({ record, order, downtimes }) : [],
        lots: record ? ingredientLotsForBatch({ recipe: productRecipe(recipes, record.product_id), receipts }) : [],
        packaging: record ? packagingIssuedForBatch({ record, movements }) : [],
        lotMatches: lot ? batchesUsingLot({ lot, records, recipes, receipts, movements }) : [],
        lotInfo: lot ? lotDetails({ lot, receipts, movements }) : { receipts: [], movements: [] },
      });
    };
    load();
    return () => { active = false; };
  }, [batch, lot]);

  return data;
}