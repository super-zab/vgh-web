/* GET /api/verify — 200 si la session (ou le jeton) est valide. Aucune requête Neon. */

import { auth } from './_auth.js';

export default async function handler(req, res) {
  if (!auth(req, res)) return;
  res.status(200).json({ ok: true });
}
