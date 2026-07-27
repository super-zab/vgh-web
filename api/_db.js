/* Utilitaires partagés par les routes API Vercel :
 * connexion Neon + contrôle du jeton d'accès.                        */

import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);

/** Le site est public sur Vercel : les routes de données sont protégées
 *  par un jeton partagé (variable d'environnement VGH_API_TOKEN).
 *  Retourne true si la requête a été refusée (réponse déjà envoyée). */
export function denied(req, res) {
  const expected = process.env.VGH_API_TOKEN;
  if (!expected) {
    res.status(500).json({ error: 'VGH_API_TOKEN non configuré sur Vercel' });
    return true;
  }
  const given = req.headers['x-vgh-token']
    || new URL(req.url, 'http://x').searchParams.get('token');
  if (given !== expected) {
    res.status(401).json({ error: 'Jeton invalide' });
    return true;
  }
  return false;
}

/** Lit et normalise les paramètres de plage temporelle communs. */
export function range(req) {
  const q = new URL(req.url, 'http://x').searchParams;
  const to   = q.get('to')   ? new Date(q.get('to'))   : new Date();
  const from = q.get('from') ? new Date(q.get('from'))
                             : new Date(to.getTime() - 24 * 3600e3);   // 24 h par défaut
  const gh   = q.get('gh') || 'gh1';
  const hours = (to - from) / 3600e3;
  return { q, from, to, gh, hours };
}
