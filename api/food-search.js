module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'missing query' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    // Search OpenFoodFacts with two parallel queries:
    // 1. Global search (finds Hebrew product names)
    // 2. Israel-specific search (country=il) for local brands
    const base = 'https://world.openfoodfacts.org/cgi/search.pl';
    const fields = 'product_name,product_name_he,brands,nutriments';
    const commonParams = `search_simple=1&action=process&json=1&page_size=30&fields=${fields}`;

    const [r1, r2] = await Promise.all([
      fetch(`${base}?search_terms=${encodeURIComponent(q)}&${commonParams}&lc=he`, { signal: controller.signal }),
      fetch(`${base}?search_terms=${encodeURIComponent(q)}&${commonParams}&tagtype_0=countries&tag_contains_0=contains&tag_0=il`, { signal: controller.signal })
    ]);
    clearTimeout(timeout);

    const [d1, d2] = await Promise.all([r1.json(), r2.json()]);

    const seen = new Set();
    const parseProduct = (p) => {
      // Prefer Hebrew name, then brand+name combo
      let name = p.product_name_he || p.product_name || '';
      if (!name.trim()) return null;
      name = name.trim();
      // Skip names that are just barcodes or too short
      if (name.length < 2 || /^\d+$/.test(name)) return null;
      if (seen.has(name.toLowerCase())) return null;
      seen.add(name.toLowerCase());

      const n = p.nutriments || {};
      const kcal = Math.round(
        n['energy-kcal_100g'] ||
        n['energy-kcal'] ||
        (n['energy_100g'] || 0) / 4.184 ||
        0
      );
      if (kcal === 0) return null;

      return {
        n: name,
        c: kcal,
        p: Math.round((n['proteins_100g'] || 0) * 10) / 10,
        k: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
        f: Math.round((n['fat_100g'] || 0) * 10) / 10,
        cat: 'R',
        _src: 'api'
      };
    };

    // Israel results first, then global
    const ilProducts = (d2.products || []).map(parseProduct).filter(Boolean);
    const globalProducts = (d1.products || []).map(parseProduct).filter(Boolean);
    const foods = [...ilProducts, ...globalProducts].slice(0, 25);

    res.json({ foods });
  } catch (e) {
    clearTimeout(timeout);
    res.json({ foods: [] });
  }
};
