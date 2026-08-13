/* Utilitaires partagés par les routes API Vercel :
 * connexion Neon + contrôle du jeton d'accès.                        */

import { neon } from '@neondatabase/serverless';

/** Connexion Neon ouverte à la première requête, et non au chargement du
 *  module : si DATABASE_URL est absente ou mal collée, neon() lève une
 *  exception. Au chargement elle ferait planter la fonction avant même
 *  le handler (Vercel : FUNCTION_INVOCATION_FAILED, aucun message utile) ;
 *  ici elle est rattrapée par le try/catch de la route.
 *  On tolère la forme « psql 'postgresql://…' » copiée du tableau de bord
 *  Neon, qui n'est pas une URL valide telle quelle.                     */
let _sql;
export function sql(...args) {
  if (!_sql) {
    const url = (
        process.env.DATABASEVGH_DATABASE_URL
        || process.env.DATABASE_URL
        || process.env.DATABASEVGH_POSTGRES_URL
        || ''
      )
      .trim()
      .replace(/^psql\s+/, '')
      .replace(/^['"]|['"]$/g, '');
    if (!url) {
      throw new Error(
        'DATABASEVGH_DATABASE_URL (ou DATABASE_URL) non configurée sur Vercel');
    }
    _sql = neon(url);
  }
  return _sql(...args);
}

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
  if (isNaN(from) || isNaN(to)) throw new Error('Paramètres from/to invalides');
  const gh   = q.get('gh') || 'gh1';
  const hours = (to - from) / 3600e3;
  return { q, from, to, gh, hours };
}
