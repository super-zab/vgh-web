/* POST /api/logout — efface le cookie de session. */

import { closeSession } from './_auth.js';

export default async function handler(req, res) {
  closeSession(req, res);
  res.status(200).json({ ok: true });
}
