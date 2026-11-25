/* Session par serre.
 *
 * Chaque serre a UN mot de passe. La page d'accueil l'envoie à /api/login,
 * qui pose un cookie signé (HttpOnly) valable 30 jours : toutes les pages et
 * toutes les routes /api/* le reconnaissent ensuite, sans rien ressaisir.
 * Les identifiants MQTT restent sur le serveur et ne sont remis au navigateur
 * (via /api/session) qu'une fois la session ouverte.
 *
 * Configuration — variable d'environnement VGH_GREENHOUSES (JSON) :
 *   { "gh1": { "name": "Serre prototype", "password": "…",
 *              "mqttHost": "xxxx.s1.eu.hivemq.cloud",
 *              "mqttUser": "vgh-web", "mqttPass": "…", "base": "vgh/gh1" },
 *     "gh2": { … } }
 * La clé (gh1, gh2…) est le device_id de la serre dans la base.
 *
 * Tant que VGH_GREENHOUSES n'est pas définie, le site reste utilisable :
 * VGH_API_TOKEN sert de mot de passe à gh1, et les pages demandent le mot de
 * passe MQTT comme avant.                                                  */

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE = 'vgh_session';
const MAX_AGE_S = 30 * 24 * 3600;

export function greenhouses() {
  const raw = (process.env.VGH_GREENHOUSES || '').trim();
  if (raw) {
    try { return JSON.parse(raw); }
    catch (e) { throw new Error('VGH_GREENHOUSES : JSON invalide — ' + e.message); }
  }
  const legacy = process.env.VGH_API_TOKEN;
  return legacy ? { gh1: { name: 'Serre VGH', password: legacy } } : {};
}

const sha = (s) => createHash('sha256').update(String(s)).digest();
export const same = (a, b) => timingSafeEqual(sha(a), sha(b));
const b64 = (buf) => Buffer.from(buf).toString('base64url');

/* La clé de signature dépend du mot de passe de la serre : le changer
 * invalide d'un coup toutes les sessions ouvertes sur cette serre. */
const keyOf = (cfg) => sha((process.env.VGH_SESSION_SECRET || 'vgh-session') + '|' + cfg.password);
const sign = (payload, cfg) => b64(createHmac('sha256', keyOf(cfg)).update(payload).digest());

function cookieHeader(req, value, maxAge) {
  const https = (req.headers['x-forwarded-proto'] || 'https') === 'https';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${https ? '; Secure' : ''}`;
}

export function openSession(req, res, gh, cfg) {
  const payload = b64(JSON.stringify({ gh, exp: Date.now() + MAX_AGE_S * 1000 }));
  res.setHeader('Set-Cookie', cookieHeader(req, `${payload}.${sign(payload, cfg)}`, MAX_AGE_S));
}
export function closeSession(req, res) {
  res.setHeader('Set-Cookie', cookieHeader(req, '', 0));
}

/** Session portée par le cookie : { gh, cfg } ou null. */
export function session(req) {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch (_) { return null; }
  const all = greenhouses();
  const cfg = Object.prototype.hasOwnProperty.call(all, data.gh) ? all[data.gh] : null;
  if (!cfg || !cfg.password) return null;
  if (!same(sig, sign(payload, cfg))) return null;
  if (!(data.exp > Date.now())) return null;
  return { gh: data.gh, cfg };
}

/** Garde des routes /api/*. Renvoie { gh, cfg }, ou null après avoir répondu
 *  401. La serre vient TOUJOURS de la session, jamais de l'URL : une session
 *  ouverte sur gh1 ne peut pas lire gh2.
 *  Le jeton VGH_API_TOKEN reste accepté (en-tête x-vgh-token ou ?token=) pour
 *  les scripts et appels directs ; lui seul peut choisir la serre via ?gh=. */
export function auth(req, res) {
  try {
    const s = session(req);
    if (s) return s;
    const url = new URL(req.url, 'http://x');
    const token = process.env.VGH_API_TOKEN;
    const given = req.headers['x-vgh-token'] || url.searchParams.get('token');
    if (token && given && same(given, token)) {
      const gh = url.searchParams.get('gh') || 'gh1';
      return { gh, cfg: greenhouses()[gh] || {} };
    }
    res.status(401).json({ error: 'Session expirée — reconnecte-toi.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
  return null;
}
