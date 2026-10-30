// Pcs per carton is encoded in the product name after the net weight.
// e.g. "CIK SURI CHICKEN STOCK 100G X 14 X 4" -> 14 x 4 = 56
const NET_WEIGHT = /\d+(?:\.\d+)?\s*(?:KGS?|GMS?|G|ML|LTRS?|LITRES?|CL|L)\b/gi;
const PACK_MULTIPLIER = /[Xx×]\s*(\d+)(?:'s)?/g;

// Returns 0 when the name carries no packing config (to be filled in manually)
export function pcsPerCarton(productName) {
  if (!productName) return 0;
  let from = 0;
  let match;
  NET_WEIGHT.lastIndex = 0;
  while ((match = NET_WEIGHT.exec(productName)) !== null) from = match.index + match[0].length;
  const tail = productName.slice(from);
  const parts = [...tail.matchAll(PACK_MULTIPLIER)].map((m) => Number(m[1]));
  if (!parts.length) return 0;
  return parts.reduce((a, b) => a * b, 1);
}