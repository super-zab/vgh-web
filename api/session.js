/* GET /api/session
 *
 * Dit au navigateur sur quelle serre il est connecté et lui remet de quoi
 * ouvrir la liaison MQTT en direct. 401 si aucune session : les pages
 * renvoient alors vers l'accueil. Aucune requête Neon.                   */

import { session } from './_auth.js';

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const s = session(req);
    if (!s) { res.status(401).json({ error: 'Non connecté' }); return; }
    const { gh, cfg } = s;
    const base = cfg.base || `vgh/${gh}`;
    res.status(200).json({
      gh,
      name: cfg.name || gh,
      base,
      // null tant que les identifiants MQTT ne sont pas dans VGH_GREENHOUSES :
      // les pages affichent alors le formulaire de connexion au broker.
      mqtt: cfg.mqttHost && cfg.mqttPass
        ? { host: cfg.mqttHost, user: cfg.mqttUser || 'vgh-web', pass: cfg.mqttPass, base }
        : null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
