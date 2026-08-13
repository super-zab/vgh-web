/* GET /api/events?from=…&to=…&gh=gh1&token=…
 *
 * Journal des consignes envoyées, commandes, changements de setpoints et
 * connexions/déconnexions de la serre, sur une même ligne de temps.      */

import { sql, denied, range } from './_db.js';

export default async function handler(req, res) {
  try {
    if (denied(req, res)) return;

    const { from, to, gh } = range(req);

    const [activity, setpoints] = await Promise.all([
      sql`
        SELECT ts, type, label, detail
        FROM activity_log
        WHERE gh = ${gh} AND ts >= ${from.toISOString()} AND ts <= ${to.toISOString()}
        ORDER BY ts DESC
        LIMIT 2000`,
      // Jeu de consignes en vigueur au début de la plage : donne le
      // contexte des modifications listées ci-dessus.
      sql`
        SELECT ts, season, values
        FROM setpoints_log
        WHERE gh = ${gh} AND ts <= ${from.toISOString()}
        ORDER BY ts DESC
        LIMIT 1`,
    ]);

    res.status(200).json({
      count: activity.length,
      activity,
      baseline: setpoints[0] || null,
    });

  } catch (e) {
    console.error('events:', e);
    res.status(500).json({ error: e.message });
  }
}
