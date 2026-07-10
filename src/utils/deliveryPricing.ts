interface CartItemLike {
  name?: string;
  category?: string;
  quantity?: number;
}

export interface DeliveryFeeBreakdown {
  fee: number;
  distanceKm: number;
  baseFee: number;
  distanceFee: number;
  handlingFee: number;
  loadFee: number;
  bulkFee: number;
  estimatedWeightKg: number;
  totalUnits: number;
}

const HEAVY_CATEGORY_KEYWORDS = [
  'bulk',
  'wholesale',
  'beverage',
  'drinks',
  'water',
  'household',
  'cleaning',
  'frozen',
  'meat',
  'rice',
  'flour',
  'grain',
  'produce'
];

const HEAVY_NAME_KEYWORDS = [
  'crate',
  'bag',
  'sack',
  'bucket',
  'box',
  'case',
  'bottle',
  'water',
  'rice',
  'flour',
  'oil',
  'bulk',
  'pack'
];

function toLowerSafe(v?: string): string {
  return (v || '').toLowerCase();
}

function parseExplicitWeightKg(itemName: string): number | null {
  const match = itemName.match(/(\d+(?:\.\d+)?)\s?(kg|g|lb|lbs|l|ml)\b/i);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(value) || value <= 0) return null;

  if (unit === 'kg') return value;
  if (unit === 'g') return value / 1000;
  if (unit === 'lb' || unit === 'lbs') return value * 0.453592;
  // Assume liquids are roughly water-density where 1L ~= 1kg.
  if (unit === 'l') return value;
  if (unit === 'ml') return value / 1000;

  return null;
}

function estimateItemWeightKg(item: CartItemLike): number {
  const name = toLowerSafe(item.name);
  const category = toLowerSafe(item.category);

  const explicitWeight = parseExplicitWeightKg(name);
  if (explicitWeight != null) return Math.max(0.15, explicitWeight);

  const heavyCategory = HEAVY_CATEGORY_KEYWORDS.some((k) => category.includes(k));
  if (heavyCategory) return 1.8;

  const heavyName = HEAVY_NAME_KEYWORDS.some((k) => name.includes(k));
  if (heavyName) return 1.4;

  return 0.45;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function calculateDistanceComponent(distanceKm: number): number {
  const d = Math.max(0, distanceKm);

  // Piecewise rate: short trips are cheaper per km, long trips progressively cost more.
  const firstBand = Math.min(d, 3) * 1.8;
  const secondBand = Math.max(0, Math.min(d - 3, 7)) * 2.4;
  const thirdBand = Math.max(0, d - 10) * 3.2;

  return firstBand + secondBand + thirdBand;
}

function calculateLoadFee(estimatedWeightKg: number): number {
  if (estimatedWeightKg <= 4) return 0;
  if (estimatedWeightKg <= 10) return 4;
  if (estimatedWeightKg <= 20) return 8;
  return 14;
}

export function calculateDeliveryFeeFromCart(distanceKm: number, cart: CartItemLike[]): DeliveryFeeBreakdown {
  const safeCart = Array.isArray(cart) ? cart : [];

  const totalUnits = safeCart.reduce((sum, item) => sum + Math.max(1, item.quantity || 1), 0);
  const estimatedWeightKg = safeCart.reduce(
    (sum, item) => sum + estimateItemWeightKg(item) * Math.max(1, item.quantity || 1),
    0
  );

  const baseFee = 10;
  const distanceFee = calculateDistanceComponent(distanceKm);
  const handlingFee = totalUnits > 3 ? Math.min((totalUnits - 3) * 0.9, 10) : 0;
  const loadFee = calculateLoadFee(estimatedWeightKg);
  const bulkFee = totalUnits > 20 ? Math.min((totalUnits - 20) * 0.35, 12) : 0;

  let fee = baseFee + distanceFee + handlingFee + loadFee + bulkFee;

  // Safety floor and cap to avoid extreme charges from unusual inputs.
  fee = Math.max(12, Math.min(fee, 120));

  return {
    fee: round2(fee),
    distanceKm: round2(Math.max(0, distanceKm)),
    baseFee: round2(baseFee),
    distanceFee: round2(distanceFee),
    handlingFee: round2(handlingFee),
    loadFee: round2(loadFee),
    bulkFee: round2(bulkFee),
    estimatedWeightKg: round2(estimatedWeightKg),
    totalUnits
  };
}
