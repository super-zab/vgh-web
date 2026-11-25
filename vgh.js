/* Session partagée par les pages de la serre (Direct, Historique, Pilotage).
 *
 * Chargé dans le <head> de chaque page : demande à /api/session sur quelle
 * serre on est connecté. Pas de session → retour à l'accueil. Sinon la page
 * s'affiche, avec le nom de la serre et un bouton de déconnexion dans la
 * barre de navigation. Les pages attendent VGH.ready avant de se connecter. */
(function () {
  'use strict';
  const toLogin = () => {
    location.replace('/?next=' + encodeURIComponent(location.pathname + location.search));
    return new Promise(() => {});                    // la page va être quittée
  };
  const show = () => document.documentElement.classList.remove('pending');
  const onDom = (fn) => document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn) : fn();

  const VGH = window.VGH = { session: null, expired: toLogin };

  VGH.logout = async () => {
    try { await fetch('/api/logout', { method: 'POST' }); } catch (_) {}
    location.replace('/');
  };

  VGH.ready = fetch('/api/session', { cache: 'no-store' }).then(async (r) => {
    if (r.status === 401) return toLogin();
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur ' + r.status);
    const s = VGH.session = await r.json();
    await new Promise(onDom);
    document.querySelectorAll('[data-gh-name]').forEach((e) => { e.textContent = s.name; });
    const nav = document.querySelector('.pagenav');
    if (nav) {
      const out = document.createElement('button');
      out.type = 'button';
      out.className = 'pagenav-out';
      out.title = 'Quitter ' + s.name;
      out.setAttribute('aria-label', 'Se déconnecter de ' + s.name);
      out.textContent = 'Quitter';
      out.addEventListener('click', VGH.logout);
      nav.appendChild(out);
    }
    show();
    return s;
  });

  // Serveur injoignable : on affiche quand même la page, avec la raison.
  VGH.ready.catch((e) => onDom(() => {
    const b = document.createElement('div');
    b.className = 'vgh-err';
    b.textContent = 'Impossible de vérifier la session : ' + e.message;
    document.body.prepend(b);
    show();
  }));
})();
