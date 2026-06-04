// Catalog layer for Supplement Superstores (supplementsuperstores.com) — a US
// Shopify supplement discounter (USD). Same mechanism as the Protein House build
// (public /products.json + Shopify cart permalinks for real auto-cart), with two
// store-specific differences:
//   1. USD pricing (with cents), not MUR.
//   2. product_type is empty on this store, so categorisation is driven by the
//      product TAGS (a rich English vocabulary: Protein, Pre-Workout, Creatine,
//      Thermogenic, Testosterone Support, Vitamins - Wellness, …) with a
//      title-keyword fallback. Apparel/merch tags route to "accessories" so they
//      never enter a recommendation pool.

export const STORE_DOMAIN = "supplementsuperstores.com";
export const CURRENCY = "USD";

// Format a USD amount for display ("$26.99", "$120").
export function formatUSD(n: number): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export type Category =
  | "protein"
  | "mass-gainer"
  | "creatine"
  | "pre-workout"
  | "amino-recovery"
  | "carbs"
  | "fat-burner"
  | "test-wellness"
  | "vitamins-minerals"
  | "collagen"
  | "sleep-recovery"
  | "accessories"
  | "other";

export type Goal =
  | "muscle-gain"
  | "fat-loss"
  | "strength-power"
  | "endurance"
  | "recovery"
  | "general-wellness";

export type CatalogItem = {
  productId: number;
  variantId: number;
  title: string;
  handle: string;
  url: string;
  vendor: string;
  productType: string;
  tags: string[];
  price: number; // numeric USD (may have cents)
  compareAtPrice: number | null; // original price when on sale
  available: boolean;
  category: Category;
  goals: Goal[];
  image: string | null;
  description: string; // plain-text, trimmed from body_html
};

type ShopifyImage = { src: string; variant_ids: number[]; position: number };
type ShopifyVariant = {
  id: number;
  title: string;
  price: string;
  compare_at_price: string | null;
  available: boolean;
  featured_image: { src: string } | null;
};
type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string[];
  body_html: string | null;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
};

function plainText(html: string | null, max = 280): string {
  if (!html) return "";
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + "…" : text;
}

function imageFor(p: ShopifyProduct, v: ShopifyVariant): string | null {
  if (v.featured_image?.src) return v.featured_image.src;
  const tagged = p.images?.find((im) => im.variant_ids?.includes(v.id));
  if (tagged) return tagged.src;
  const primary = p.images?.slice().sort((a, b) => a.position - b.position)[0];
  return primary?.src ?? null;
}

// --- Classification ------------------------------------------------------
// product_type is blank store-wide, so TAGS are the primary signal. Each tag
// maps to one supplement category; apparel/merch tags map to "accessories".

const TAG_CATEGORY: Record<string, Category> = {
  // protein
  protein: "protein",
  "protein isolate": "protein",
  "protein blend": "protein",
  "mass gainer": "mass-gainer",
  // performance
  creatine: "creatine",
  "creatine monohydrate": "creatine",
  "pre-workout": "pre-workout",
  stimulant: "pre-workout",
  "pump/blood flow": "pre-workout",
  vasodilator: "pre-workout",
  "nootropics/energy": "pre-workout",
  // recovery / aminos
  "amino acids": "amino-recovery",
  eaa: "amino-recovery",
  bcaa: "amino-recovery",
  glutamine: "amino-recovery",
  // fuel
  "carbohydrate powders": "carbs",
  "intra-workout": "carbs",
  endurance: "carbs",
  electrolytes: "carbs",
  // fat loss
  "weight loss": "fat-burner",
  thermogenic: "fat-burner",
  carnitine: "fat-burner",
  diuretic: "fat-burner",
  // hormones
  "testosterone support": "test-wellness",
  "testosterone booster": "test-wellness",
  // structure
  collagen: "collagen",
  "joint repair": "collagen",
  // sleep / recovery
  "sleep aid": "sleep-recovery",
  "night time supplements": "sleep-recovery",
  // health
  "vitamins - wellness": "vitamins-minerals",
  "multi-vitamin": "vitamins-minerals",
  "fish oil": "vitamins-minerals",
  "greens powder": "vitamins-minerals",
  "digestive health": "vitamins-minerals",
  "liver support": "vitamins-minerals",
  "heart health": "vitamins-minerals",
  "vitamin c": "vitamins-minerals",
  "thyroid support": "vitamins-minerals",
};

// Apparel / merch / accessory tags — route to "accessories" (never recommended).
const APPAREL_TAGS = new Set([
  "s2 apparel", "men's apparel", "women's apparel", "headwear", "t-shirt", "hat",
  "tanks", "snapback", "hoodie", "shorts", "leggings", "pants", "sports bra",
  "long sleeve", "beanie", "performance tee", "oversized tee", "s2 merchandise",
  "shaker cup", "shaker", "s2 t-shirt", "gear", "workout clothes", "workout gear",
  "s2 rewards item", "seasonings", "food - snacks", "healthy snack", "shirt",
]);

// Title-keyword fallback for the handful of products with no categorising tag.
const TITLE_RULES: { category: Category; keywords: RegExp }[] = [
  { category: "mass-gainer", keywords: /mass gainer|weight gain|serious mass|gainer/i },
  { category: "creatine", keywords: /creatine|kre-?alkalyn/i },
  { category: "pre-workout", keywords: /pre-?workout|pre-?wo|pump|nitric|\bc4\b/i },
  { category: "amino-recovery", keywords: /\bbcaa\b|\beaa\b|amino|glutamine|intra-?workout/i },
  { category: "fat-burner", keywords: /fat burn|burner|burnout|thermo|carniti|\bcla\b|thyro|lean/i },
  { category: "collagen", keywords: /collagen/i },
  { category: "test-wellness", keywords: /testosterone|test boost|ashwagandha|tribulus|shilajit/i },
  { category: "vitamins-minerals", keywords: /vitamin|multivit|omega|fish oil|magnesium|zinc|greens|probiotic|immune/i },
  { category: "protein", keywords: /whey|isolate|casein|protein/i },
  { category: "carbs", keywords: /carb|dextrose|maltodextrin|electrolyte|hydration|endurance/i },
  { category: "accessories", keywords: /t-?shirt|hoodie|tee\b|apparel|hat|beanie|shaker|bottle|tank|legging|shorts/i },
];

const CATEGORY_GOALS: Record<Category, Goal[]> = {
  protein: ["muscle-gain", "recovery", "fat-loss"],
  "mass-gainer": ["muscle-gain"],
  creatine: ["strength-power", "muscle-gain"],
  "pre-workout": ["strength-power", "endurance"],
  "amino-recovery": ["recovery", "endurance", "muscle-gain"],
  carbs: ["endurance", "muscle-gain"],
  "fat-burner": ["fat-loss"],
  "test-wellness": ["general-wellness", "strength-power"],
  "vitamins-minerals": ["general-wellness"],
  collagen: ["general-wellness", "recovery"],
  "sleep-recovery": ["general-wellness", "recovery"],
  accessories: [],
  other: ["general-wellness"],
};

function classify(p: ShopifyProduct): { category: Category; goals: Goal[] } {
  const tags = p.tags.map((t) => t.trim().toLowerCase());
  // 1. Tag → supplement category (most specific, store-curated).
  for (const tag of tags) {
    const cat = TAG_CATEGORY[tag];
    if (cat) return { category: cat, goals: CATEGORY_GOALS[cat] };
  }
  // 2. Apparel/merch tag → accessories (excluded from pools).
  if (tags.some((t) => APPAREL_TAGS.has(t))) {
    return { category: "accessories", goals: CATEGORY_GOALS.accessories };
  }
  // 3. Title-keyword fallback.
  const hay = `${p.title} ${tags.join(" ")}`;
  for (const rule of TITLE_RULES) {
    if (rule.keywords.test(hay)) {
      return { category: rule.category, goals: CATEGORY_GOALS[rule.category] };
    }
  }
  return { category: "other", goals: CATEGORY_GOALS.other };
}

// --- Fetch + cache -------------------------------------------------------

let cache: { items: CatalogItem[]; at: number } | null = null;
const TTL_MS = 1000 * 60 * 30; // 30 minutes

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const res = await fetch(`https://${STORE_DOMAIN}/products.json?limit=250&page=${page}`, {
    headers: { accept: "application/json" },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`products.json page ${page} -> ${res.status}`);
  const data = (await res.json()) as { products: ShopifyProduct[] };
  return data.products ?? [];
}

export async function getCatalog(): Promise<CatalogItem[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.items;

  const items: CatalogItem[] = [];
  for (let page = 1; page <= 6; page++) {
    const products = await fetchPage(page);
    if (products.length === 0) break;
    for (const p of products) {
      const { category, goals } = classify(p);
      const description = plainText(p.body_html);
      for (const v of p.variants) {
        const price = Number.parseFloat(v.price);
        if (!Number.isFinite(price) || price <= 0) continue;
        const compare = v.compare_at_price ? Number.parseFloat(v.compare_at_price) : NaN;
        items.push({
          productId: p.id,
          variantId: v.id,
          title: v.title === "Default Title" ? p.title : `${p.title} — ${v.title}`,
          handle: p.handle,
          url: `https://${STORE_DOMAIN}/products/${p.handle}?variant=${v.id}`,
          vendor: p.vendor,
          productType: p.product_type,
          tags: p.tags,
          price,
          compareAtPrice: Number.isFinite(compare) && compare > price ? compare : null,
          available: v.available,
          category,
          goals,
          image: imageFor(p, v),
          description,
        });
      }
    }
  }
  cache = { items, at: Date.now() };
  return items;
}

// Ordered list of which categories matter most for each goal (foundational
// first). Used to gather a focused candidate pool the AI selects the stack from.
export const GOAL_CATEGORY_PRIORITY: Record<Goal, Category[]> = {
  "muscle-gain": ["protein", "creatine", "amino-recovery", "mass-gainer", "carbs", "vitamins-minerals"],
  "fat-loss": ["protein", "fat-burner", "amino-recovery", "vitamins-minerals"],
  "strength-power": ["creatine", "pre-workout", "protein", "amino-recovery", "test-wellness"],
  endurance: ["carbs", "amino-recovery", "pre-workout", "protein", "vitamins-minerals"],
  recovery: ["protein", "amino-recovery", "collagen", "sleep-recovery", "vitamins-minerals"],
  "general-wellness": ["vitamins-minerals", "collagen", "sleep-recovery", "test-wellness", "protein"],
};

// Build a curated candidate pool for a goal within a budget: a spread of price
// points per relevant category, available items only. The AI picks the final
// stack strictly from this pool, so it can never invent a product/price.
export async function gatherCandidates(
  goal: Goal,
  budget: number,
  perCategory = 6,
): Promise<CatalogItem[]> {
  const items = await getCatalog();
  const noLimit = !budget || budget <= 0;
  const cats = GOAL_CATEGORY_PRIORITY[goal] ?? GOAL_CATEGORY_PRIORITY["general-wellness"];
  const out: CatalogItem[] = [];
  const seenProducts = new Set<number>();

  for (const cat of cats) {
    const inCat = items
      .filter((it) => it.category === cat && it.available && (noLimit || it.price <= budget))
      .sort((a, b) => a.price - b.price);

    const picked: CatalogItem[] = [];
    const step = Math.max(1, Math.floor(inCat.length / perCategory));
    for (let i = 0; i < inCat.length && picked.length < perCategory; i += step) {
      const it = inCat[i];
      if (seenProducts.has(it.productId)) continue;
      seenProducts.add(it.productId);
      picked.push(it);
    }
    out.push(...picked);
  }
  return out;
}

export async function getVariants(variantIds: number[]): Promise<CatalogItem[]> {
  const items = await getCatalog();
  const byId = new Map(items.map((it) => [it.variantId, it]));
  return variantIds.map((id) => byId.get(id)).filter((x): x is CatalogItem => Boolean(x));
}

// Shopify cart permalink: https://{store}/cart/{variantId}:{qty},…
// Loads the items into the customer's real cart and lands at checkout.
export function buildCartPermalink(lines: { variantId: number; quantity: number }[]): string {
  const segs = lines
    .filter((l) => l.quantity > 0)
    .map((l) => `${l.variantId}:${l.quantity}`)
    .join(",");
  return `https://${STORE_DOMAIN}/cart/${segs}?storefront=true`;
}
