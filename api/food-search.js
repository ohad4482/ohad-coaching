module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'missing query' });

  // Search Israeli products first, then global
  const ilUrl = `https://il.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,product_name_he,nutriments,serving_size`;
  const globalUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,product_name_he,nutriments,serving_size`;

  const [ilRes, globalRes] = await Promise.all([fetch(ilUrl), fetch(globalUrl)]);
  const [ilData, globalData] = await Promise.all([ilRes.json(), globalRes.json()]);

  const parse = (products) => (products || [])
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

  const ilFoods = parse(ilData.products);
  const globalFoods = parse(globalData.products);

  // Merge, Israeli products first, deduplicate by name
  const seen = new Set();
  const foods = [...ilFoods, ...globalFoods].filter(f => {
    if (seen.has(f.n)) return false;
    seen.add(f.n);
    return true;
  });

  res.json({ foods });
};
