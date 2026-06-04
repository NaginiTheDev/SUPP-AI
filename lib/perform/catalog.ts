// Catalog layer for perform.is (Icelandic supplement store).
//
// perform.is is a custom React/Vite SPA backed by a public REST API (no auth):
//   LIST   GET https://api.perform.is/api/products        -> array of ~379 products
//   DETAIL GET https://api.perform.is/api/products/{slug}  -> full product + variations
// There is NO Shopify-style cart permalink here, so (unlike the Protein House
// build) we deep-link each recommendation to its product page; auto-cart is
// gated behind perform.is auth and deferred.
//
// All facts below were verified live during recon (see workflow perform-is-recon):
//   - price_from is an INTEGER in ISK (e.g. 5490 = 5.490 kr.) — never divide by 100.
//     It is the MINIMUM price across variations, so display it as "Frá {verð}".
//   - sold_out is the authoritative availability flag (purchasable is true for all).
//   - images[].id is a Cloudinary public_id under cloud `dj0wwxv7z`.
//   - the customer-facing product URL is /product/{slug} (SINGULAR).

export const API_BASE = "https://api.perform.is/api";
export const SITE = "https://perform.is";
export const CURRENCY = "ISK";

const CLOUDINARY = "https://res.cloudinary.com/dj0wwxv7z/image/upload";
export const imageThumb = (id: string) => `${CLOUDINARY}/f_auto,q_auto,w_500/${id}`;

// Icelandic ISK formatting: "." thousands separator, no decimals, "kr." suffix.
// formatISK(5490) === "5.490 kr."
export function formatISK(n: number): string {
  try {
    return new Intl.NumberFormat("is-IS", {
      style: "currency",
      currency: "ISK",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toLocaleString("is-IS")} kr.`;
  }
}

export type GoalKey =
  | "vodvauppbygging"
  | "fitubrennsla"
  | "styrkur_afl"
  | "uthald"
  | "almenn_heilsa";

export type PerformProduct = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string; // primary advisory category slug, for display
  categories: string[]; // all category slugs, for goal matching
  goals: GoalKey[];
  priceISK: number; // price_from — integer ISK, a MINIMUM ("from") price
  inStock: boolean; // !sold_out (authoritative)
  fewLeft: boolean;
  imageUrl: string | null;
  productUrl: string; // https://perform.is/product/{slug}
  description: string; // "" until enriched from DETAIL
  tags: string[];
};

// --- goal → category mapping (slugs), foundational first -----------------
export const GOAL_CATEGORY_SLUGS: Record<GoalKey, string[]> = {
  vodvauppbygging: ["protein", "kreatin", "frammistada", "aminosyrur", "thyngdarstjornun", "vitamin-and-heilsa"],
  fitubrennsla: ["protein", "brennsluefni", "aminosyrur", "thyngdarstjornun", "electrolytes-hydration", "vitamin-and-heilsa"],
  styrkur_afl: ["kreatin", "pre-workout", "protein", "frammistada", "aminosyrur", "vitamin-and-heilsa"],
  uthald: ["frammistada", "electrolytes-hydration", "aminosyrur", "kreatin", "protein", "vitamin-and-heilsa"],
  almenn_heilsa: ["vitamin-and-heilsa", "protein", "electrolytes-hydration", "aminosyrur"],
};

// Non-advisory categories never recommended (shakers, accessories, food, gift cards, sale buckets).
const EXCLUDED_CATEGORIES = new Set([
  "hristibrusar", "aukahlutir", "matvara", "gjafabref", "sprengidagur",
  "tilbod-manadarins", "performlagerhreinsun", "cream-of-rice", "orkudrykkir",
]);

// Top-level advisory categories, in display-priority order.
const ADVISORY_PRIMARY = [
  "protein", "kreatin", "pre-workout", "aminosyrur", "frammistada",
  "brennsluefni", "electrolytes-hydration", "thyngdarstjornun", "vitamin-and-heilsa", "vegan",
];

// --- Raw API shapes (only the fields we use) -----------------------------
type RawCategory = { name: string; slug: string; parent?: string };
type RawImage = { id: string };
type RawTag = { name?: string; slug?: string };
type RawListItem = {
  _id: string;
  name: string;
  slug: string;
  brand?: { name?: string };
  categories?: RawCategory[];
  tags?: RawTag[];
  images?: RawImage[];
  main_image_index?: number;
  price_from: number;
  sold_out?: boolean;
  fewLeft?: boolean;
};

function goalsFor(categorySlugs: string[]): GoalKey[] {
  const goals: GoalKey[] = [];
  for (const goal of Object.keys(GOAL_CATEGORY_SLUGS) as GoalKey[]) {
    if (GOAL_CATEGORY_SLUGS[goal].some((slug) => categorySlugs.includes(slug))) {
      goals.push(goal);
    }
  }
  return goals;
}

function primaryCategory(categorySlugs: string[]): string {
  const advisory = ADVISORY_PRIMARY.find((slug) => categorySlugs.includes(slug));
  return advisory ?? categorySlugs[0] ?? "annad";
}

function normalize(p: RawListItem): PerformProduct {
  const categories = (p.categories ?? []).map((c) => c.slug).filter(Boolean);
  const imgIdx = typeof p.main_image_index === "number" ? p.main_image_index : 0;
  const img = p.images?.[imgIdx] ?? p.images?.[0];
  const tags = (p.tags ?? []).map((t) => t.name ?? t.slug ?? "").filter(Boolean);
  return {
    id: p._id,
    name: p.name,
    slug: p.slug,
    brand: p.brand?.name ?? "",
    category: primaryCategory(categories),
    categories,
    goals: goalsFor(categories),
    priceISK: p.price_from,
    inStock: p.sold_out !== true,
    fewLeft: p.fewLeft === true,
    imageUrl: img?.id ? imageThumb(img.id) : null,
    productUrl: `${SITE}/product/${p.slug}`,
    description: "",
    tags,
  };
}

// --- Fetch + cache (LIST returns all 379 in one call; no pagination) ------
let cache: { items: PerformProduct[]; at: number } | null = null;
const TTL_MS = 30 * 60 * 1000;

export async function getCatalog(): Promise<PerformProduct[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.items;
  const res = await fetch(`${API_BASE}/products`, {
    headers: { accept: "application/json" },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`perform LIST ${res.status}`);
  const raw = (await res.json()) as RawListItem[];
  const items = raw
    .filter((p) => p && p.slug && typeof p.price_from === "number")
    .map(normalize);
  cache = { items, at: Date.now() };
  return items;
}

// Build a goal-/budget-scoped candidate pool, spread across price points per
// category. The AI selects the final stack strictly from this pool.
export async function gatherCandidates(
  goal: GoalKey,
  budgetISK: number,
  perCategory = 6,
): Promise<PerformProduct[]> {
  const items = await getCatalog();
  const noLimit = !budgetISK || budgetISK <= 0;
  const out: PerformProduct[] = [];
  const seen = new Set<string>();

  for (const catSlug of GOAL_CATEGORY_SLUGS[goal] ?? GOAL_CATEGORY_SLUGS.almenn_heilsa) {
    const inCat = items
      .filter(
        (it) =>
          it.categories.includes(catSlug) &&
          !it.categories.some((c) => EXCLUDED_CATEGORIES.has(c)) &&
          it.inStock &&
          (noLimit || it.priceISK <= budgetISK),
      )
      .sort((a, b) => a.priceISK - b.priceISK);

    const step = Math.max(1, Math.floor(inCat.length / perCategory));
    let picked = 0;
    for (let i = 0; i < inCat.length && picked < perCategory; i += step) {
      const it = inCat[i];
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
      picked++;
    }
  }
  return out;
}

export async function getBySlugs(slugs: string[]): Promise<Map<string, PerformProduct>> {
  const items = await getCatalog();
  const want = new Set(slugs);
  return new Map(items.filter((it) => want.has(it.slug)).map((it) => [it.slug, it]));
}

// Optional: enrich a chosen product with a short plain-text blurb from DETAIL.
// description is HTML and DETAIL-only; fall back description -> body -> "".
export async function fetchDescription(slug: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(slug)}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return "";
    const d = (await res.json()) as { description?: string; body?: string };
    return plainText(d.description || d.body || "");
  } catch {
    return "";
  }
}

function plainText(html: string, max = 280): string {
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
