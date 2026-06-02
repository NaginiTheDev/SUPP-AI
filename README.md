# Protein House — AI Coach

A guided **AI Coach** panel for [proteinhouse.mu](https://proteinhouse.mu). It walks a customer
through a short, interactive intake (goal, body stats, training, lifestyle, budget), then designs a
tailored supplement **stack** from the store's live catalogue and loads it straight into their
**Shopify cart** with one tap. Not a chatbot — a step-by-step UI.

## How it works

```
Intake wizard ──profile──▶ /api/coach ──▶ gatherCandidates (real, in-budget products)
                                       └▶ Claude selects a stack (structured output)
                                       └▶ budget guard + server-recomputed total
                                       └▶ Shopify cart permalink ──▶ checkout
```

- **`lib/catalog.ts`** — fetches the public `products.json` feed (no auth needed), flattens it to
  buyable variants, classifies each into a supplement category + fitness goals, caches it for 30 min,
  gathers a goal-/budget-scoped candidate pool, and builds Shopify cart permalinks.
- **`lib/profile.ts`** — the structured intake type + the option lists the wizard renders.
- **`app/api/coach/route.ts`** — Claude (`claude-sonnet-4-6`) selects the final stack as **structured
  output**, choosing only from real candidate products. Variant IDs are validated, a **hard budget
  guard** trims to fit, and the **total is recomputed server-side** — so the cart is always correct.
- **`components/CoachPanel.tsx`** — the multi-step interactive wizard (selectable cards, segmented
  controls, steppers, sliders, chips) + loading/result states.
- **`components/StackResult.tsx`** — the result panel with per-item rationale and the
  **Add all to cart** button.
- **`app/widget`** — a bare, iframe-embeddable version of the panel.
- **`public/embed.js`** — a one-line `<script>` snippet to drop the panel into the Shopify theme.

## Run locally

```bash
cp .env.example .env.local      # add your ANTHROPIC_API_KEY
npm run dev                     # http://localhost:3000
```

The landing page has a floating **“Build my stack”** button in the corner.

## Embed into the Shopify store

Deploy this app (e.g. to Vercel), then in Shopify admin → **Online Store → Themes → Edit code →
`theme.liquid`**, add before `</body>`:

```html
<script async src="https://YOUR-ADVISOR.vercel.app/embed.js"
        data-host="https://YOUR-ADVISOR.vercel.app"></script>
```

That injects the launcher on every storefront page. The **Add all to cart** button opens the real
Protein House cart, pre-loaded and ready to check out.

## Notes & next steps

- Currently reads **public** Shopify endpoints only — gives price + availability but not live stock
  counts or rich descriptions. Granting a Storefront API token would unlock those + a native
  (in-page) add-to-cart instead of the new-tab cart link.
- Tag data in the store is inconsistent; classification lives in `lib/catalog.ts` (`CATEGORY_RULES`)
  and is easy to tune as the catalogue grows.
- The model is the direct Anthropic provider. To add failover/cost tracking, swap
  `anthropic("claude-sonnet-4-6")` for the Vercel AI Gateway equivalent.
