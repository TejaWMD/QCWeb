// One Recipe Master record per unique recipe name. Products that share a recipe
// link to the same record, so a recipe change lands in one place.
import { base44 } from "@/api/base44Client";
import { actingUserName } from "@/lib/permissions";

const upper = (value) => (value || "").toString().trim().toUpperCase();
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

export const loadRecipes = async () => {
  const rows = await base44.entities.Recipe.list("-created_date", 1000).catch(() => []);
  return Array.isArray(rows) ? rows : [];
};

// products: [{ id, recipe_name, cooking_time_hr, batch_output_kg, product_code, product_name }]
export const ensureRecipeLinks = async ({ products = [], recipes = [], user }) => {
  const byName = new Map(recipes.filter((row) => row.recipe_name).map((row) => [upper(row.recipe_name), row]));
  const groups = new Map();
  products.forEach((product) => {
    const name = (product.recipe_name || "").toString().trim();
    if (!name) return;
    const group = groups.get(upper(name)) || {
      name,
      ids: [],
      cooking: 0,
      output: 0,
      code: product.product_code || "",
      description: product.product_name || "",
    };
    group.ids.push(product.id);
    group.cooking = group.cooking || num(product.cooking_time_hr);
    group.output = group.output || num(product.batch_output_kg);
    groups.set(upper(name), group);
  });

  const created = [];
  const links = new Map();
  for (const [key, group] of groups) {
    const existing = byName.get(key);
    const payload = {
      recipe_name: group.name,
      product_ids: group.ids,
      product_id: group.ids[0],
      product_code: group.code,
      product_name: group.description,
      cooking_time_hr: group.cooking,
      batch_output_kg: group.output,
    };
    if (existing) {
      await base44.entities.Recipe.update(existing.id, payload);
      links.set(key, existing.id);
    } else {
      const row = await base44.entities.Recipe.create({
        ...payload,
        version: 1,
        status: "Active",
        effective_date: new Date().toISOString().slice(0, 10),
        created_by: actingUserName(user),
        created_by_id: user?.id || "",
      });
      links.set(key, row.id);
      created.push(group.name);
      byName.set(key, { ...payload, id: row.id });
    }
  }

  const linkPayloads = products
    .filter((product) => links.get(upper(product.recipe_name)))
    .map((product) => ({ id: product.id, recipe_id: links.get(upper(product.recipe_name)) }));
  for (let i = 0; i < linkPayloads.length; i += 100) {
    await base44.entities.Product.bulkUpdate(linkPayloads.slice(i, i + 100));
  }

  return { created, links };
};

// ---- reading a product's recipe ---------------------------------------------
// Products that share a recipe name share one Recipe record (product.recipe_id),
// so a product resolves through that link first, then by recipe name, then by the
// older per-product link. A plain product id is accepted too, for screens that
// only hold the id.
const familyKey = (recipe) => upper(recipe?.recipe_name) || `product:${recipe?.product_id || recipe?.id || ""}`;

export const recipeVersionsFor = (recipes = [], product = null) => {
  const record = typeof product === "string" ? { id: product } : product || {};
  const all = recipes || [];
  const pointed = record.recipe_id ? all.find((row) => row.id === record.recipe_id) : null;
  const name = upper(pointed?.recipe_name || record.recipe_name);
  let family = name ? all.filter((row) => upper(row.recipe_name) === name) : [];
  if (!family.length && record.id) {
    family = all.filter((row) => (row.product_ids || []).includes(record.id) || row.product_id === record.id);
  }
  return family.sort((a, b) => num(b.version) - num(a.version));
};

export const activeRecipeFor = (recipes = [], product = null) => {
  const family = recipeVersionsFor(recipes, product);
  return family.find((row) => row.status === "Active") || family[0] || null;
};

// One row per recipe, carrying every product that uses it.
export const recipeFamilies = (recipes = [], products = []) => {
  const map = new Map();
  (recipes || []).forEach((row) => {
    const key = familyKey(row);
    const entry = map.get(key) || { key, name: row.recipe_name || "", versions: [] };
    entry.versions.push(row);
    map.set(key, entry);
  });
  return [...map.values()]
    .map((entry) => {
      entry.versions.sort((a, b) => num(b.version) - num(a.version));
      const active = entry.versions.find((row) => row.status === "Active") || entry.versions[0];
      const ids = new Set();
      entry.versions.forEach((row) => {
        (row.product_ids || []).forEach((id) => ids.add(id));
        if (row.product_id) ids.add(row.product_id);
      });
      const linked = (products || []).filter(
        (p) => ids.has(p.id) || p.recipe_id === active?.id || (entry.name && upper(p.recipe_name) === upper(entry.name))
      );
      return { ...entry, active, products: linked };
    })
    .filter((entry) => entry.products.length > 0);
};

// A save never overwrites a version: it becomes the next Active version, the older
// ones are kept as Superseded, and every linked product points at the new record.
export const saveRecipeVersion = async ({ versions = [], products = [], recipeName, form, user }) => {
  const name = (recipeName || "").trim();
  const linked = products.filter(Boolean);
  const version = (versions || []).reduce((max, row) => Math.max(max, num(row.version)), 0) + 1;
  const created = await base44.entities.Recipe.create({
    recipe_name: name,
    product_ids: linked.map((p) => p.id),
    product_id: linked[0]?.id || "",
    product_code: linked[0]?.product_code || "",
    product_name: linked[0]?.product_name || "",
    cooking_time_hr: num(form.cooking_time_hr),
    batch_output_kg: num(form.batch_output_kg),
    version,
    status: "Active",
    batch_cartons: num(form.batch_cartons),
    standard_yield_pct: num(form.standard_yield_pct),
    ingredients: form.ingredients || [],
    effective_date: form.effective_date || new Date().toISOString().slice(0, 10),
    created_by: actingUserName(user),
    created_by_id: user?.id || "",
    notes: form.notes || "",
  });
  for (const old of (versions || []).filter((row) => row.status === "Active")) {
    await base44.entities.Recipe.update(old.id, { status: "Superseded", superseded_by_version: version });
  }
  const links = linked
    .filter((p) => p.recipe_id !== created.id || upper(p.recipe_name) !== upper(name))
    .map((p) => ({ id: p.id, recipe_id: created.id, recipe_name: name }));
  for (let i = 0; i < links.length; i += 100) {
    await base44.entities.Product.bulkUpdate(links.slice(i, i + 100));
  }
  return { recipe: created, version };
};