module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'missing query' });

  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=product_name,product_name_he,nutriments,serving_size&tagtype_0=countries&tag_contains_0=contains&tag_0=israel`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await r.json();

    const foods = (data.products || [])
      .filter(p => p.product_name_he || p.product_name)
      .map(p => {
        const n = p.nutriments || {};
        return {
          n: p.product_name_he || p.product_name,
          c: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
          p: Math.round((n['proteins_100g'] || 0) * 10) / 10,
          k: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
          f: Math.round((n['fat_100g'] || 0) * 10) / 10,
          per: p.serving_size || '100g'
        };
      })
      .filter(f => f.c > 0);

    res.json({ foods });
  } catch (e) {
    res.json({ foods: [] });
  }
};
