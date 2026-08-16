/* GET /api/export?from=…&to=…&gh=gh1&what=telemetry|events&token=…
 *
 * Export CSV, ouvrable directement dans Excel ou LibreOffice.
 * Séparateur point-virgule et BOM UTF-8 : Excel en français reconnaît
 * les colonnes et les accents sans manipulation.                        */

import { sql, denied, range } from './_db.js';

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [
    cols.join(';'),
    ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(';')),
  ].join('\r\n');
}

/* Vercel refuse toute réponse de fonction dépassant 4,5 Mo : au-delà, on
 * répond une erreur explicite plutôt que de laisser la plateforme couper. */
const MAX_BYTES = 4_000_000;

export default async function handler(req, res) {
  try {
    if (denied(req, res)) return;

    const { q, from, to, gh } = range(req);
    const what = q.get('what') || 'telemetry';

    const rows = what === 'events'
      ? await sql`
          SELECT ts, type, label, detail
          FROM activity_log
          WHERE device_id = ${gh} AND ts >= ${from.toISOString()} AND ts <= ${to.toISOString()}
          ORDER BY ts`
      : await sql`
          SELECT ts, mode, is_day, delta_t, vpd,
                 temp_in, rh_in, temp_out, rh_out, dew_point_c,
                 co2_in, co2_out, lux_in, lux_out, uv_in, uv_out,
                 leaf_amg_max_c, leaf_amg_avg_c, leaf_probe_c, witness_c, leaf_air_delta_c,
                 fan, fan_reason, mist, mist_reason,
                 period_s, fan_on_s, mist_on_s, fan_run_s, valve_run_s,
                 rpm1, rpm2, power_w, energy_wh_today, energy_wh_total,
                 severity, reason, uptime_s
          FROM readings
          WHERE device_id = ${gh} AND ts >= ${from.toISOString()} AND ts <= ${to.toISOString()}
          ORDER BY ts
          LIMIT 100000`;

    const body = '﻿' + toCsv(rows);            // BOM pour Excel
    const bytes = Buffer.byteLength(body);
    if (bytes > MAX_BYTES) {
      return res.status(413).json({
        error: `CSV trop volumineux pour Vercel : ${(bytes / 1e6).toFixed(1)} Mo `
             + `pour ${rows.length} lignes (limite 4,5 Mo). Réduis la plage de dates.`,
      });
    }

    const stamp = from.toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',
      `attachment; filename="vgh-${gh}-${what}-${stamp}.csv"`);
    res.status(200).send(body);

  } catch (e) {
    console.error('export:', e);              // visible dans l'onglet Logs de Vercel
    res.status(500).json({ error: e.message });
  }
}
