module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'missing query' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    // Search OpenFoodFacts — try Hebrew query first, then English
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=40&fields=product_name,product_name_he,nutriments,serving_size&lc=he`;

    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await r.json();

    const seen = new Set();
    const foods = (data.products || [])
      .map(p => {
        const name = p.product_name_he || p.product_name || '';
        if (!name.trim()) return null;
        const n = p.nutriments || {};
        const kcal = Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || (n['energy_100g'] || 0) / 4.184 || 0);
        if (kcal === 0) return null;
        if (seen.has(name)) return null;
        seen.add(name);
        return {
          n: name.trim(),
          c: kcal,
          p: Math.round((n['proteins_100g'] || 0) * 10) / 10,
          k: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
          f: Math.round((n['fat_100g'] || 0) * 10) / 10,
          cat: 'R',
          _src: 'api'
        };
      })
      .filter(Boolean)
      .slice(0, 20);

    res.json({ foods });
  } catch (e) {
    clearTimeout(timeout);
    res.json({ foods: [] });
  }
};
