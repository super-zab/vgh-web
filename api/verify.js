/* GET /api/verify?token=…
 *
 * Vérifie uniquement le jeton VGH_API_TOKEN — aucune requête Neon.
 * Sert de porte d'entrée pour la page Pilotage, qui n'a rien à voir avec
 * la base de données télémétrie : elle publie des commandes en direct sur
 * MQTT, elle n'a pas besoin d'ouvrir de connexion Neon pour ça.           */

import { denied } from './_db.js';

export default async function handler(req, res) {
  if (denied(req, res)) return;
  res.status(200).json({ ok: true });
}
