/* GET /api/history?from=…&to=…&gh=gh1&resolution=auto&token=…
 *
 * Renvoie la télémétrie sur une plage de temps (firmware V5 — table
 * `readings`). Au-delà de 3 jours, bascule automatiquement sur les
 * moyennes horaires (vue readings_hourly) pour ne pas transférer des
 * dizaines de milliers de lignes au navigateur. Forçable via
 * resolution=raw | hourly.                                              */

import { sql, denied, range } from './_db.js';

export default async function handler(req, res) {
  try {
    if (denied(req, res)) return;

    const { q, from, to, gh, hours } = range(req);
    const asked = q.get('resolution') || 'auto';
    const hourly = asked === 'hourly' || (asked === 'auto' && hours > 72);

    if (hourly) {
      const rows = await sql`
        SELECT hour AS ts, n, temp_in, temp_min_in, temp_max_in, rh_in,
               vpd, vpd_max, leaf_air_delta_c, dew_point_c,
               lux_in, lux_max, uv_in, leaf_amg_max_c,
               fan_on_pct, mist_on_pct, power_w, energy_wh_today
        FROM readings_hourly
        WHERE device_id = ${gh} AND hour >= ${from.toISOString()} AND hour <= ${to.toISOString()}
        ORDER BY hour`;
      return res.status(200).json({ resolution: 'hourly', count: rows.length, rows });
    }

    /* ts vient du RTC embarqué : NULL tant qu'il ne répond pas (cas courant
     * sur ce prototype, voir README §4.2). On filtre et trie alors sur
     * received_at (horodatage serveur, toujours renseigné) — sinon ces
     * lignes disparaissent silencieusement de toute plage de dates. */
    const rows = await sql`
      SELECT ts, received_at, mode, is_day, delta_t, vpd,
             temp_in, rh_in, temp_out, rh_out, dew_point_c,
             co2_in, co2_out, lux_in, lux_out, uv_in, uv_out,
             leaf_amg_max_c, leaf_amg_avg_c, leaf_probe_c, witness_c, leaf_air_delta_c,
             fan, fan_reason, mist, mist_reason,
             period_s, fan_on_s, mist_on_s, fan_run_s, valve_run_s,
             rpm1, rpm2, power_w, energy_wh_today, energy_wh_total,
             severity, reason, uptime_s
      FROM readings
      WHERE device_id = ${gh}
        AND COALESCE(ts, received_at) >= ${from.toISOString()}
        AND COALESCE(ts, received_at) <= ${to.toISOString()}
      ORDER BY COALESCE(ts, received_at)
      LIMIT 20000`;
    res.status(200).json({ resolution: 'raw', count: rows.length, rows });

  } catch (e) {
    console.error('history:', e);
    res.status(500).json({ error: e.message });
  }
}
