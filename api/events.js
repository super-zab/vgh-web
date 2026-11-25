/* GET /api/events?from=…&to=…
 *
 * Journal des commandes, changements de configuration et connexions/
 * déconnexions de la serre, sur une même ligne de temps (firmware V5).   */

import { sql, range } from './_db.js';
import { auth } from './_auth.js';

export default async function handler(req, res) {
  try {
    const who = auth(req, res);
    if (!who) return;
    const { gh } = who;

    const { from, to } = range(req);

    const [activity, config] = await Promise.all([
      sql`
        SELECT ts, type, label, detail
        FROM activity_log
        WHERE device_id = ${gh} AND ts >= ${from.toISOString()} AND ts <= ${to.toISOString()}
        ORDER BY ts DESC
        LIMIT 2000`,
      // Configuration en vigueur au début de la plage : donne le contexte
      // des modifications listées ci-dessus.
      sql`
        SELECT ts, values
        FROM config_log
        WHERE device_id = ${gh} AND ts <= ${from.toISOString()}
        ORDER BY ts DESC
        LIMIT 1`,
    ]);

    res.status(200).json({
      count: activity.length,
      activity,
      baseline: config[0] || null,
    });

  } catch (e) {
    console.error('events:', e);
    res.status(500).json({ error: e.message });
  }
}
