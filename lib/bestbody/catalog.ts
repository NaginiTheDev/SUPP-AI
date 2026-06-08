// Catalog layer for bestbodycr.com — a Costa Rican Shopify supplement store
// (CRC, Spanish). Same mechanism as the Protein House build (public
// /products.json + Shopify cart permalinks for real auto-cart), with two
// store-specific differences:
//   1. CRC pricing (Costa Rican colón, whole numbers — no cents shown).
//   2. product_type IS populated here (Spanish: Protein, Creatina, aminoacidos,
//      Pre-Entreno, carbohidratos, Vitaminas y minerales, Booster …), so
//      categorisation is product_type-driven (like the root PH / protin builds).
//      Gym accessories (Shaker, Cinturón, Guantes, Vendajes) and flavour drops
//      (Saborizante) carry no goals, so they never enter a recommendation pool.
//
// Note: the apex bestbodycr.com 301-redirects to www, so we hit www directly to
// keep products.json and the cart permalink on a single, final host.

export const STORE_DOMAIN = "www.bestbodycr.com";
export const CURRENCY = "CRC";

// Format a CRC amount for display ("₡13 000"). Colón prices are whole numbers.
export function formatCRC(n: number): string {
  try {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: "CRC",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₡${Math.round(n).toLocaleString("es-CR")}`;
  }
}

export type GoalKey =
  | "musculo"
  | "perdida_grasa"
  | "fuerza"
  | "resistencia"
  | "salud_general";

export type CatalogItem = {
  productId: number;
  variantId: number;
  title: string;
  handle: string;
  url: string;
  vendor: string;
  productType: string;
  category: string; // Spanish display label for the card
  tags: string[];
  priceCRC: number;
  compareAtCRC: number | null;
  available: boolean;
  goals: GoalKey[];
  image: string | null;
  description: string;
};

// bestbodycr.com product_type values (exact, case-sensitive) → which goals they
// serve. Accessory/flavour types are intentionally absent so they get no goals
// and are excluded from every candidate pool.
const TYPE_GOALS: Record<string, GoalKey[]> = {
  Protein: ["musculo", "perdida_grasa", "fuerza", "resistencia", "salud_general"],
  Creatina: ["fuerza", "musculo"],
  aminoacidos: ["musculo", "resistencia", "fuerza", "perdida_grasa"],
  "Pre-Entreno": ["fuerza", "resistencia"],
  carbohidratos: ["resistencia", "musculo"],
  Booster: ["fuerza", "salud_general"],
  "Vitaminas y minerales": ["salud_general", "musculo", "perdida_grasa", "resistencia"],
};

// Nicer Spanish display label per raw product_type (shown on the result cards).
const TYPE_LABEL: Record<string, string> = {
  Protein: "Proteína",
  Creatina: "Creatina",
  aminoacidos: "Aminoácidos",
  "Pre-Entreno": "Pre-entreno",
  carbohidratos: "Carbohidratos",
  Booster: "Booster",
  "Vitaminas y minerales": "Vitaminas y minerales",
};

// Display label per goal (for the result subtitle).
export const GOAL_LABELS: Record<GoalKey, string> = {
  musculo: "Aumento muscular",
  perdida_grasa: "Pérdida de grasa",
  fuerza: "Fuerza y potencia",
  resistencia: "Resistencia",
  salud_general: "Salud general",
};

// Per-goal ordered category priority (by product_type), foundational first.
export const GOAL_TYPE_PRIORITY: Record<GoalKey, string[]> = {
  musculo: ["Protein", "Creatina", "aminoacidos", "carbohidratos", "Vitaminas y minerales", "Booster"],
  perdida_grasa: ["Protein", "aminoacidos", "Vitaminas y minerales"],
  fuerza: ["Creatina", "Pre-Entreno", "Protein", "aminoacidos", "Booster", "Vitaminas y minerales"],
  resistencia: ["carbohidratos", "aminoacidos", "Pre-Entreno", "Protein", "Vitaminas y minerales"],
  salud_general: ["Vitaminas y minerales", "Protein", "aminoacidos", "Booster"],
};

// Goal-specific professional guidance (used in the AI system prompt, in Spanish).
export const GOAL_GUIDANCE: Record<GoalKey, string> = {
  musculo:
    "Para el aumento muscular la proteína es casi siempre la base (tier=foundational) — elige proteína primero salvo que la dieta/notas lo impidan, luego suma creatina y, si el presupuesto alcanza, aminoácidos o carbohidratos.",
  perdida_grasa:
    "Para la pérdida de grasa la proteína es la base para conservar músculo en déficit calórico; añade luego aminoácidos para la recuperación y un multivitamínico/omega-3 según el plan. (Esta tienda no maneja termogénicos, así que no inventes ninguno.)",
  fuerza:
    "Para fuerza y potencia la creatina es la base; añade luego pre-entreno y proteína según lo permita el presupuesto.",
  resistencia:
    "Para la resistencia los carbohidratos y los aminoácidos son la base; añade luego pre-entreno o creatina y proteína para la recuperación.",
  salud_general:
    "Para la salud general un buen multivitamínico u omega-3 es la base; añade luego proteína y/o minerales (magnesio) según las necesidades.",
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
    if (!res.ok) throw new Error(`bestbody products.json page ${page} -> ${res.status}`);
    const products = ((await res.json()) as { products: ShopifyProduct[] }).products ?? [];
    if (products.length === 0) break;
    for (const p of products) {
      const goals = TYPE_GOALS[p.product_type] ?? [];
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
          category: TYPE_LABEL[p.product_type] || p.product_type || "Otro",
          tags: p.tags,
          priceCRC: Math.round(price),
          compareAtCRC: Number.isFinite(compare) && compare > price ? Math.round(compare) : null,
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

// Build a goal-/budget-scoped candidate pool, spread across price points per
// product_type, available items only. The AI picks the final stack strictly
// from this pool, so it can never invent a product or price.
export async function gatherCandidates(goal: GoalKey, budgetCRC: number, perType = 6): Promise<CatalogItem[]> {
  const items = await getCatalog();
  const noLimit = !budgetCRC || budgetCRC <= 0;
  const out: CatalogItem[] = [];
  const seenProducts = new Set<number>();
  for (const type of GOAL_TYPE_PRIORITY[goal] ?? GOAL_TYPE_PRIORITY.salud_general) {
    const inType = items
      .filter((it) => it.productType === type && it.available && (noLimit || it.priceCRC <= budgetCRC))
      .sort((a, b) => a.priceCRC - b.priceCRC);
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
