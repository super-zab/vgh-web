/* GET /api/history?from=…&to=…&gh=gh1&resolution=auto&token=…
 *
 * Renvoie la télémétrie sur une plage de temps.
 * Au-delà de 3 jours, bascule automatiquement sur les moyennes horaires
 * (vue telemetry_hourly) pour ne pas transférer 100 000 lignes au
 * navigateur. Forçable via resolution=raw | hourly.                     */

import { sql, denied, range } from './_db.js';

export default async function handler(req, res) {
  try {
    if (denied(req, res)) return;

    const { q, from, to, gh, hours } = range(req);
    const asked = q.get('resolution') || 'auto';
    const hourly = asked === 'hourly' || (asked === 'auto' && hours > 72);

    if (hourly) {
      const rows = await sql`
        SELECT hour AS ts, n, temp_c, temp_min_c, temp_max_c, humidity,
               vpd_kpa, vpd_max_kpa, leaf_temp_c, leaf_delta_c, dew_point_c,
               lux, lux_max, uv_index, amg_max_c, fan_pct, fan_max_pct,
               valve_open_pct, water_budget_min_pct
        FROM telemetry_hourly
        WHERE gh = ${gh} AND hour >= ${from.toISOString()} AND hour <= ${to.toISOString()}
        ORDER BY hour`;
      return res.status(200).json({ resolution: 'hourly', count: rows.length, rows });
    }

    const rows = await sql`
      SELECT ts, temp_c, humidity, leaf_temp_c, leaf_delta_c, dew_point_c,
             vpd_kpa, lux, uv_index, amg_max_c, amg_avg_c, fan_pct, fan_pwm,
             valve, valve_reason, day_mode, condensation_risk, season,
             sys_mode, severity, water_budget_pct, record_type, changed_fields
      FROM telemetry
      WHERE gh = ${gh} AND ts >= ${from.toISOString()} AND ts <= ${to.toISOString()}
      ORDER BY ts
      LIMIT 20000`;
    res.status(200).json({ resolution: 'raw', count: rows.length, rows });

  } catch (e) {
    console.error('history:', e);
    res.status(500).json({ error: e.message });
  }
}
