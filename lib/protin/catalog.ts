// Catalog layer for protin.is — an Icelandic Shopify supplement store (ISK).
// Same mechanism as the Protein House build (public /products.json + Shopify
// cart permalinks for real auto-cart), but ISK currency and Icelandic
// product_type → goal classification.

export const STORE_DOMAIN = "protin.is";
export const CURRENCY = "ISK";

export function formatISK(n: number): string {
  try {
    return new Intl.NumberFormat("is-IS", { style: "currency", currency: "ISK", maximumFractionDigits: 0 }).format(n);
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

export type CatalogItem = {
  productId: number;
  variantId: number;
  title: string;
  handle: string;
  url: string;
  vendor: string;
  productType: string;
  category: string; // normalized advisory category (Icelandic display)
  tags: string[];
  priceISK: number;
  compareAtISK: number | null;
  available: boolean;
  goals: GoalKey[];
  image: string | null;
  description: string;
};

// protin.is product_type values (Icelandic) → which goals they serve.
// Non-advisory types (shakers, clothing, gear, gift cards, CBD) are omitted so
// they never enter a recommendation pool.
const TYPE_GOALS: Record<string, GoalKey[]> = {
  "Prótín": ["vodvauppbygging", "fitubrennsla", "styrkur_afl", "uthald", "almenn_heilsa"],
  "prótínstangir": ["vodvauppbygging", "fitubrennsla"],
  "Amínósýrur": ["vodvauppbygging", "uthald", "styrkur_afl", "fitubrennsla"],
  "Kreatín": ["styrkur_afl", "vodvauppbygging"],
  "Pre Workout": ["styrkur_afl", "uthald"],
  "Uppbygging": ["vodvauppbygging"],
  "Kolvetni": ["uthald", "vodvauppbygging"],
  "Orkudrykkir": ["uthald"],
  "Brennsluefni": ["fitubrennsla"],
  "Testobooster": ["styrkur_afl", "almenn_heilsa"],
  "Vítamín": ["almenn_heilsa", "vodvauppbygging", "fitubrennsla", "uthald"],
  "Vitamins & Supplements": ["almenn_heilsa"],
  "Steinefni": ["almenn_heilsa", "uthald"],
  "Fitusýrur": ["almenn_heilsa"],
  "Melting": ["almenn_heilsa", "fitubrennsla"],
  "Náttúruvörur": ["almenn_heilsa"],
};

// Display label per goal (for result subtitle).
export const GOAL_LABELS: Record<GoalKey, string> = {
  vodvauppbygging: "Vöðvauppbygging",
  fitubrennsla: "Fitubrennsla / Þyngdartap",
  styrkur_afl: "Styrkur & afl",
  uthald: "Úthald",
  almenn_heilsa: "Almenn heilsa",
};

// Per-goal ordered category priority (by product_type), foundational first.
export const GOAL_TYPE_PRIORITY: Record<GoalKey, string[]> = {
  vodvauppbygging: ["Prótín", "Kreatín", "Uppbygging", "Amínósýrur", "Kolvetni", "Vítamín"],
  fitubrennsla: ["Prótín", "Brennsluefni", "Amínósýrur", "Melting", "Vítamín"],
  styrkur_afl: ["Kreatín", "Pre Workout", "Prótín", "Amínósýrur", "Testobooster", "Vítamín"],
  uthald: ["Kolvetni", "Amínósýrur", "Pre Workout", "Kreatín", "Prótín", "Orkudrykkir", "Steinefni"],
  almenn_heilsa: ["Vítamín", "Steinefni", "Fitusýrur", "Melting", "Náttúruvörur", "Prótín"],
};

// Goal-specific professional guidance (used in the AI system prompt).
export const GOAL_GUIDANCE: Record<GoalKey, string> = {
  vodvauppbygging: "Fyrir vöðvauppbyggingu er prótín nær alltaf undirstaðan (tier=foundational) — veldu prótín fyrst nema mataræði/athugasemdir útiloki það, bættu svo við kreatíni og loks stuðningsvöru.",
  fitubrennsla: "Fyrir fitubrennslu er prótín undirstaðan til að halda vöðvamassa í kaloríuhalla; bættu svo við brennsluefni og/eða amínósýrum eftir áætlun.",
  styrkur_afl: "Fyrir styrk og afl er kreatín undirstaðan; bættu svo við pre-workout og prótíni eftir því sem áætlun leyfir.",
  uthald: "Fyrir úthald eru kolvetni og amínósýrur undirstaðan; bættu svo við kreatíni og prótíni til endurheimtar.",
  almenn_heilsa: "Fyrir almenna heilsu er gott fjölvítamín eða omega-3 (fitusýrur) undirstaðan; bættu svo við prótíni og/eða steinefnum eftir þörfum.",
};

type ShopifyVariant = { id: number; title: string; price: string; compare_at_price: string | null; available: boolean; featured_image?: { src: string } | null };
type ShopifyImage = { src: string; variant_ids: number[]; position: number };
type ShopifyProduct = {
  id: number; title: string; handle: string; vendor: string; product_type: string;
  tags: string[]; body_html: string | null; images: ShopifyImage[]; variants: ShopifyVariant[];
};

function plainText(html: string | null, max = 280): string {
  if (!html) return "";
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + "…" : text;
}

function imageFor(p: ShopifyProduct, v: ShopifyVariant): string | null {
  if (v.featured_image?.src) return v.featured_image.src;
  const tagged = p.images?.find((im) => im.variant_ids?.includes(v.id));
  if (tagged) return tagged.src;
  const primary = p.images?.slice().sort((a, b) => a.position - b.position)[0];
  return primary?.src ?? null;
}

let cache: { items: CatalogItem[]; at: number } | null = null;
const TTL_MS = 30 * 60 * 1000;

export async function getCatalog(): Promise<CatalogItem[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.items;
  const items: CatalogItem[] = [];
  for (let page = 1; page <= 6; page++) {
    const res = await fetch(`https://${STORE_DOMAIN}/products.json?limit=250&page=${page}`, {
      headers: { accept: "application/json" }, next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`protin products.json page ${page} -> ${res.status}`);
    const products = ((await res.json()) as { products: ShopifyProduct[] }).products ?? [];
    if (products.length === 0) break;
    for (const p of products) {
      const goals = TYPE_GOALS[p.product_type] ?? [];
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
          category: p.product_type || "Annað",
          tags: p.tags,
          priceISK: Math.round(price),
          compareAtISK: Number.isFinite(compare) && compare > price ? Math.round(compare) : null,
          available: v.available,
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

// Build a goal-/budget-scoped candidate pool, spread across price points per type.
export async function gatherCandidates(goal: GoalKey, budgetISK: number, perType = 6): Promise<CatalogItem[]> {
  const items = await getCatalog();
  const noLimit = !budgetISK || budgetISK <= 0;
  const out: CatalogItem[] = [];
  const seenProducts = new Set<number>();
  for (const type of GOAL_TYPE_PRIORITY[goal] ?? GOAL_TYPE_PRIORITY.almenn_heilsa) {
    const inType = items
      .filter((it) => it.productType === type && it.available && (noLimit || it.priceISK <= budgetISK))
      .sort((a, b) => a.priceISK - b.priceISK);
    const step = Math.max(1, Math.floor(inType.length / perType));
    let picked = 0;
    for (let i = 0; i < inType.length && picked < perType; i += step) {
      const it = inType[i];
      if (seenProducts.has(it.productId)) continue;
      seenProducts.add(it.productId);
      out.push(it);
      picked++;
    }
  }
  return out;
}

export async function getVariants(variantIds: number[]): Promise<CatalogItem[]> {
  const items = await getCatalog();
  const byId = new Map(items.map((it) => [it.variantId, it]));
  return variantIds.map((id) => byId.get(id)).filter((x): x is CatalogItem => Boolean(x));
}

// Shopify cart permalink — pre-loads the customer's real cart, then checkout.
export function buildCartPermalink(lines: { variantId: number; quantity: number }[]): string {
  const segs = lines.filter((l) => l.quantity > 0).map((l) => `${l.variantId}:${l.quantity}`).join(",");
  return `https://${STORE_DOMAIN}/cart/${segs}?storefront=true`;
}
