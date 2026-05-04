export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'DELETE') return res.status(405).end()

  const { id, password } = req.body ?? {}
  if (!password || password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Unauthorized' })
  if (!id)
    return res.status(400).json({ error: 'Missing id' })

  const resp = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/visitor_cards?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: {
        apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  )
  return resp.ok
    ? res.status(200).json({ ok: true })
    : res.status(500).json({ error: 'Delete failed' })
}
