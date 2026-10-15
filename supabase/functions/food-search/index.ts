// "Search online" for the Food tab. A thin proxy to USDA FoodData
// Central: the app's code is public on GitHub, so the API key lives
// here as the USDA_API_KEY secret instead. Callers need a signed-in
// session (the app's anonymous one) - checked below, because the
// gateway's verify_jwt also lets the public publishable key through.
// Anonymous sign-up is open, so this is light gating, not real access
// control; the worst case is someone spending the free USDA quota.
//
// Two searches run in parallel, both requiring every query word:
// generic foods first (Foundation / SR Legacy / FNDDS - "chicken
// breast", "big mac"), then branded products ("quest bar"). Mixed into
// one search, generic foods drown out brand-name queries. Results are
// slimmed to nutrients per 100 g keyed by the app's names; the
// per-serving math happens in the app (food-core.js usdaToFood), where
// it's unit-tested.

const USDA_KEY = Deno.env.get("USDA_API_KEY");
const USDA_SEARCH = "https://api.nal.usda.gov/fdc/v1/foods/search";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GENERIC = { dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"], pageSize: 8 };
const BRANDED = { dataType: ["Branded"], pageSize: 17 };

// USDA nutrient ids -> the app's nutrient keys. Foundation foods report
// energy as Atwater factors (2047/2048) instead of 1008.
const NUTRIENTS: Record<number, string> = {
  1008: "kcal", 1003: "protein", 1005: "carbs", 1004: "fat", 1079: "fiber",
  2000: "sugar", 1235: "addedSugar", 1093: "sodium", 1018: "alcohol",
};
const ENERGY_FALLBACKS = [2047, 2048];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UsdaFood = {
  fdcId: number;
  dataType: string;
  description: string;
  brandName?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  ingredients?: string;
  foodNutrients: { nutrientId: number; value?: number; unitName?: string }[];
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function slim(food: UsdaFood) {
  const byId = new Map(food.foodNutrients.map((n) => [n.nutrientId, n]));
  const per100: Record<string, number> = {};
  for (const [id, key] of Object.entries(NUTRIENTS)) {
    const value = byId.get(Number(id))?.value;
    if (typeof value === "number") per100[key] = value;
  }
  if (per100.kcal === undefined) {
    const energy = ENERGY_FALLBACKS.map((id) => byId.get(id)).find((n) => n?.unitName === "KCAL" && typeof n.value === "number");
    if (energy) per100.kcal = energy.value!;
  }
  return {
    fdcId: food.fdcId,
    dataType: food.dataType,
    name: food.description,
    brand: food.brandName || food.brandOwner || null,
    servingSize: food.servingSize ?? null,
    servingSizeUnit: food.servingSizeUnit ?? null,
    household: food.householdServingFullText || null,
    // Branded only; the app tags processing from it (classifyProcessing).
    ingredients: food.ingredients || null,
    per100,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!USDA_KEY) return json({ error: "USDA_API_KEY not set" }, 500);

  const user = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: req.headers.get("Authorization") ?? "" },
  });
  if (!user.ok) return json({ error: "sign in first" }, 401);

  const body = await req.json().catch(() => ({}));
  const query = typeof body.q === "string" ? body.q.trim().slice(0, 100) : "";
  if (!query) return json({ error: "missing q" }, 400);

  const search = async (opts: { dataType: string[]; pageSize: number }) => {
    const res = await fetch(`${USDA_SEARCH}?api_key=${USDA_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, requireAllWords: true, ...opts }),
    });
    if (!res.ok) throw new Error(`USDA ${res.status}`);
    return ((await res.json()).foods ?? []) as UsdaFood[];
  };
  try {
    const [generic, branded] = await Promise.all([search(GENERIC), search(BRANDED)]);
    const foods = [...generic, ...branded].map(slim).filter((f) => f.per100.kcal !== undefined);
    return json({ foods });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
});
