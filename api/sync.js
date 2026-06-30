const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  await sql`CREATE TABLE IF NOT EXISTS app_data (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    const rows = await sql`SELECT key, value FROM app_data`;
    const data = {};
    rows.forEach(r => data[r.key] = r.value);
    return res.json(data);
  }

  if (req.method === 'POST') {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'missing key' });
    if (!value) {
      await sql`DELETE FROM app_data WHERE key = ${key}`;
    } else {
      await sql`
        INSERT INTO app_data (key, value, updated_at)
        VALUES (${key}, ${value}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
      `;
    }
    return res.json({ ok: true });
  }

  res.status(405).end();
};
