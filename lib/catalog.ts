// Catalog layer — reads the public Shopify product feed at proteinhouse.mu,
// normalizes it into a searchable index, and builds Shopify cart permalinks.
//
// The store exposes /products.json with no auth. We page through it, flatten to
// the *variant* level (a variant is the buyable unit on Shopify), classify each
// product into supplement categories + the fitness goals it serves, and cache
// the result in-memory for STORE-side reuse across requests.

export const STORE_DOMAIN = "proteinhouse.mu";
export const CURRENCY = "Rs"; // Mauritian Rupee (MUR)

export type Category =
  | "protein"
  | "mass-gainer"
  | "creatine"
  | "pre-workout"
  | "amino-recovery"
  | "vitamins-minerals"
  | "fat-burner"
  | "test-wellness"
  | "collagen"
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
  price: number; // numeric MUR
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

// Strip HTML to a short plain-text blurb for display + to help the AI choose.
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

// Pick the best image for a variant: its own featured image, else an image
// explicitly tagged with this variant, else the product's primary image.
function imageFor(p: ShopifyProduct, v: ShopifyVariant): string | null {
  if (v.featured_image?.src) return v.featured_image.src;
  const tagged = p.images?.find((im) => im.variant_ids?.includes(v.id));
  if (tagged) return tagged.src;
  const primary = p.images?.slice().sort((a, b) => a.position - b.position)[0];
  return primary?.src ?? null;
}

// --- Classification ------------------------------------------------------

// Keyword sets are matched against a haystack of title + product_type + tags.
// Order matters: the first matching category wins, so more specific buckets
// (mass-gainer, creatine) come before the broad "protein" bucket.
const CATEGORY_RULES: { category: Category; keywords: RegExp }[] = [
  { category: "mass-gainer", keywords: /mass gainer|anabolic mass|hyperbolic mass|weight gain|serious mass|gainer/i },
  { category: "creatine", keywords: /creatine|creakong|kre-?alkalyn|creabolic/i },
  { category: "pre-workout", keywords: /pre-?workout|pre-?wo|pump|nitric|n\.o\.|qhush|c4\b/i },
  { category: "amino-recovery", keywords: /bcaa|\beaa\b|amino|glutamine|recovery|intra-?workout|geaar|all9/i },
  { category: "fat-burner", keywords: /fat burn|burner|lipo|carniburn|l-?carnitine|cla\b|thermo|cut\b|detox|slim|phedra/i },
  { category: "collagen", keywords: /collagen/i },
  { category: "test-wellness", keywords: /testosterone|test boost|shilajit|tribulus|ashwagandha|maca|herbal|libido|growth peptide|arginine/i },
  { category: "vitamins-minerals", keywords: /vitamin|multivit|mineral|zinc|magnesium|omega|fish oil|d3|k2|greens|immune|probiotic|eyes formula|brain|memory protein/i },
  { category: "protein", keywords: /whey|isolate|casein|protein|iso\b|hydro/i },
  { category: "accessories", keywords: /shaker|bottle|bag|t-?shirt|gym|belt|strap|scoop|accessor|wrist|sleeve/i },
];

// Which goals each category typically serves. The AI uses this as a prior; it
// can still reason beyond it, but it keeps recommendations sensible.
const CATEGORY_GOALS: Record<Category, Goal[]> = {
  protein: ["muscle-gain", "recovery", "fat-loss"],
  "mass-gainer": ["muscle-gain"],
  creatine: ["strength-power", "muscle-gain"],
  "pre-workout": ["strength-power", "endurance"],
  "amino-recovery": ["recovery", "endurance", "muscle-gain"],
  "vitamins-minerals": ["general-wellness"],
  "fat-burner": ["fat-loss"],
  "test-wellness": ["general-wellness", "strength-power"],
  collagen: ["general-wellness", "recovery"],
  accessories: [],
  other: ["general-wellness"],
};

function classify(p: ShopifyProduct): { category: Category; goals: Goal[] } {
  const hay = `${p.title} ${p.product_type} ${p.tags.join(" ")}`;
  for (const rule of CATEGORY_RULES) {
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
  const res = await fetch(
    `https://${STORE_DOMAIN}/products.json?limit=250&page=${page}`,
    { headers: { accept: "application/json" }, next: { revalidate: 1800 } },
  );
  if (!res.ok) throw new Error(`products.json page ${page} -> ${res.status}`);
  const data = (await res.json()) as { products: ShopifyProduct[] };
  return data.products ?? [];
}

export async function getCatalog(): Promise<CatalogItem[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.items;

  const items: CatalogItem[] = [];
  for (let page = 1; page <= 10; page++) {
    const products = await fetchPage(page);
    if (products.length === 0) break;
    for (const p of products) {
      const { category, goals } = classify(p);
      const description = plainText(p.body_html);
      for (const v of p.variants) {
        const price = Number.parseFloat(v.price);
        if (!Number.isFinite(price)) continue;
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

// --- Search --------------------------------------------------------------

export type SearchFilters = {
  query?: string;
  category?: Category;
  goal?: Goal;
  vendor?: string;
  maxPrice?: number;
  minPrice?: number;
  availableOnly?: boolean;
  limit?: number;
};

export async function searchCatalog(f: SearchFilters): Promise<CatalogItem[]> {
  const items = await getCatalog();
  const q = f.query?.toLowerCase().trim();
  const results = items.filter((it) => {
    if (f.availableOnly !== false && !it.available) return false;
    if (f.category && it.category !== f.category) return false;
    if (f.goal && !it.goals.includes(f.goal)) return false;
    if (f.vendor && it.vendor.toLowerCase() !== f.vendor.toLowerCase()) return false;
    if (typeof f.maxPrice === "number" && it.price > f.maxPrice) return false;
    if (typeof f.minPrice === "number" && it.price < f.minPrice) return false;
    if (q) {
      const hay = `${it.title} ${it.vendor} ${it.productType} ${it.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  // Cheapest-first within a category tends to match budget intent best.
  results.sort((a, b) => a.price - b.price);
  return results.slice(0, f.limit ?? 12);
}

// Ordered list of which categories matter most for each goal. Used to gather a
// focused candidate pool the AI then selects the final stack from.
export const GOAL_CATEGORY_PRIORITY: Record<Goal, Category[]> = {
  "muscle-gain": ["protein", "creatine", "amino-recovery", "mass-gainer", "vitamins-minerals"],
  "fat-loss": ["protein", "fat-burner", "amino-recovery", "vitamins-minerals"],
  "strength-power": ["creatine", "pre-workout", "protein", "amino-recovery"],
  endurance: ["amino-recovery", "pre-workout", "protein", "vitamins-minerals"],
  recovery: ["protein", "amino-recovery", "collagen", "vitamins-minerals"],
  "general-wellness": ["vitamins-minerals", "collagen", "test-wellness", "protein"],
};

// Build a curated candidate pool for a goal within a budget: a spread of
// price points per relevant category, available items only. The AI picks the
// final stack strictly from this pool, so it can never invent a product/price.
export async function gatherCandidates(
  goal: Goal,
  budget: number,
  perCategory = 6,
): Promise<CatalogItem[]> {
  const items = await getCatalog();
  const cats = GOAL_CATEGORY_PRIORITY[goal] ?? GOAL_CATEGORY_PRIORITY["general-wellness"];
  const out: CatalogItem[] = [];
  const seenProducts = new Set<number>();

  for (const cat of cats) {
    const inCat = items
      .filter((it) => it.category === cat && it.available && it.price <= budget)
      .sort((a, b) => a.price - b.price);

    // Spread across price points (cheap → premium) rather than only the cheapest,
    // and avoid stacking many variants of the same product.
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

// --- Cart permalink ------------------------------------------------------
// Shopify cart permalink: https://{store}/cart/{variantId}:{qty},{variantId}:{qty}
// Loads the items straight into the customer's real cart and lands at checkout.
export function buildCartPermalink(lines: { variantId: number; quantity: number }[]): string {
  const segs = lines
    .filter((l) => l.quantity > 0)
    .map((l) => `${l.variantId}:${l.quantity}`)
    .join(",");
  return `https://${STORE_DOMAIN}/cart/${segs}?storefront=true`;
}
