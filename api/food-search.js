module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'missing query' });

  const apiKey = process.env.USDA_API_KEY;
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=25&dataType=SR%20Legacy,Survey%20(FNDDS)&api_key=${apiKey}`;

  const r = await fetch(url);
  const data = await r.json();

  const foods = (data.foods || []).map(f => {
    const get = (name) => {
      const n = f.foodNutrients?.find(x => x.nutrientName === name);
      return n ? Math.round(n.value) : 0;
    };
    return {
      n: f.description,
      c: get('Energy'),
      p: get('Protein'),
      k: get('Carbohydrate, by difference'),
      f: get('Total lipid (fat)'),
      per: f.servingSize ? `${f.servingSize}${f.servingSizeUnit || 'g'}` : '100g'
    };
  });

  res.json({ foods });
};
