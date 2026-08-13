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
          WHERE gh = ${gh} AND ts >= ${from.toISOString()} AND ts <= ${to.toISOString()}
          ORDER BY ts`
      : await sql`
          SELECT ts, temp_c, humidity, leaf_temp_c, leaf_delta_c, dew_point_c,
                 vpd_kpa, lux, uv_index, amg_max_c, amg_avg_c, fan_pct, fan_pwm,
                 valve, valve_reason, day_mode, condensation_risk, season,
                 sys_mode, severity, water_budget_pct, valve_run_ms, fan_run_ms,
                 uptime_ms, free_heap, record_type
          FROM telemetry
          WHERE gh = ${gh} AND ts >= ${from.toISOString()} AND ts <= ${to.toISOString()}
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
