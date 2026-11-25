/* POST /api/login   { "password": "…" }
 *
 * Le mot de passe désigne la serre : on ouvre la session de celle dont le
 * mot de passe correspond. Aucune requête Neon.                          */

import { greenhouses, same, openSession } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST uniquement' }); return; }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    const password = String((body && body.password) || '');

    const all = greenhouses();
    if (!Object.keys(all).length) {
      res.status(500).json({ error: 'Aucune serre configurée sur Vercel (VGH_GREENHOUSES).' });
      return;
    }
    // Toutes les serres sont comparées, sans sortie anticipée.
    let found = null;
    for (const [gh, cfg] of Object.entries(all)) {
      if (password && cfg && cfg.password && same(password, cfg.password) && !found) found = [gh, cfg];
    }
    if (!found) {
      await new Promise((r) => setTimeout(r, 600));     // freine les essais en rafale
      res.status(401).json({ error: 'Mot de passe incorrect.' });
      return;
    }
    const [gh, cfg] = found;
    openSession(req, res, gh, cfg);
    res.status(200).json({ ok: true, gh, name: cfg.name || gh });
  } catch (e) {
    console.error('login:', e);
    res.status(500).json({ error: e.message });
  }
}
