const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const sql = neon(process.env.DATABASE_URL);

  await sql`CREATE TABLE IF NOT EXISTS app_data (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  const data = req.body;
  const entries = Object.entries(data);
  if (!entries.length) return res.json({ ok: true });

  for (const [key, value] of entries) {
    await sql`
      INSERT INTO app_data (key, value, updated_at)
      VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
    `;
  }

  return res.json({ ok: true, saved: entries.length });
};
