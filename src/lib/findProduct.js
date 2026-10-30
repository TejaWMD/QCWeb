// One shared product lookup for every scan screen: SKU barcode, then carton
// barcode, then Item Code. Matching ignores a leading "*" and one leading zero.
import { base44 } from "@/api/base44Client";
import { barcodeKey, cleanBarcode } from "@/lib/productMaster";

const MATCH_PIECE = "piece";
const MATCH_CARTON = "carton";
const MATCH_ITEM_CODE = "item_code";

const productBarcodes = (product) =>
  [product?.barcode, product?.carton_barcode, ...(product?.carton_skus || []).map((row) => row.barcode)].filter(Boolean);

export async function findProduct(value) {
  const raw = (value ?? "").toString().trim();
  if (!raw) return { product: null, match: null, scanned: raw };
  const key = barcodeKey(raw);
  const code = raw.toUpperCase();

  const page = await base44.entities.Product.filter({ deleted: { $ne: true } }, { limit: 2000 }).catch(() => ({ items: [] }));
  const products = page?.items || [];

  const piece = products.find((product) => product.barcode && barcodeKey(product.barcode) === key);
  if (piece) return { product: piece, match: MATCH_PIECE, scanned: raw };

  const carton = products.find((product) =>
    [product.carton_barcode, ...(product.carton_skus || []).map((row) => row.barcode)]
      .filter(Boolean)
      .some((barcode) => barcodeKey(barcode) === key)
  );
  if (carton) return { product: carton, match: MATCH_CARTON, scanned: raw };

  const byCode = products.find((product) => (product.product_code || "").toUpperCase() === code);
  if (byCode) return { product: byCode, match: MATCH_ITEM_CODE, scanned: raw };

  // The leading-zero rule can also hide a zero the scanner dropped.
  const loose = products.find((product) =>
    productBarcodes(product).some((barcode) => cleanBarcode(barcode).replace(/^0+/, "") === cleanBarcode(raw).replace(/^0+/, ""))
  );
  if (loose) {
    const isCarton = [loose.carton_barcode, ...(loose.carton_skus || []).map((row) => row.barcode)].filter(Boolean).some((barcode) => barcodeKey(barcode) === key);
    return { product: loose, match: isCarton ? MATCH_CARTON : MATCH_PIECE, scanned: raw };
  }

  return { product: null, match: null, scanned: raw };
}

export const matchLabel = (match) =>
  match === MATCH_PIECE ? "piece" : match === MATCH_CARTON ? "carton" : match === MATCH_ITEM_CODE ? "item code" : "";