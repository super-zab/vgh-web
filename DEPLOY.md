# Déploiement VGH Remote sur Vercel

## Pourquoi le 404

Le repo `super-zab/vgh-web` ne contenait que `vgh-remote.html` et `README.md`.
Vercel sert la racine `/` en cherchant **`index.html`** : absent → 404.
`vgh-remote.html` était bien déployé, mais uniquement accessible à
`https://…vercel.app/vgh-remote.html`.

Le dossier est maintenant réorganisé avec la version complète du site :

```
index.html          ← page de pilotage (ex-vgh-remote.html, version à jour)
historique.html     ← page Historique
vercel.json         ← cleanUrls
package.json        ← dépendance @neondatabase/serverless
api/_db.js          ← connexion Neon + contrôle du jeton
api/history.js      ← GET /api/history
api/events.js       ← GET /api/events
api/export.js       ← GET /api/export (CSV)
```

## 1. Débloquer git puis pousser

Des fichiers `.lock` traînent dans `.git` (à supprimer depuis le Terminal) :

```bash
cd ~/Documents/Claude/Projects/Virtual\ Greenhouse\ project/VGH\ Remote\ V2/Site\ en\ ligne
rm -f .git/index.lock .git/HEAD.lock .git/objects/maintenance.lock
find .git/objects -name 'tmp_obj_*' -delete
git add -A
git commit -m "Site complet : index + historique + API Neon"
git push origin main
```

## 2. Configurer le projet Vercel

Dans **Settings → General** :

| Réglage | Valeur |
|---|---|
| Framework Preset | **Other** |
| Root Directory | *(vide — racine du repo)* |
| Build Command | *(vide)* |
| Output Directory | *(vide)* |

Vercel détecte automatiquement `api/*.js` comme Serverless Functions et
installe `@neondatabase/serverless` depuis `package.json`.

## 3. Variables d'environnement

**Settings → Environment Variables**, cocher Production **et** Preview :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | chaîne de connexion Neon (`postgresql://…?sslmode=require`) |
| `VGH_API_TOKEN` | jeton de ton choix, protège `/api/*` |

Ajouter une variable **ne redéploie pas** le site : relancer un deploy
depuis l'onglet Deployments (⋯ → Redeploy) après les avoir saisies.

## 4. Vérifier

| URL | Attendu |
|---|---|
| `/` | page de pilotage MQTT |
| `/historique` | page Historique (saisir le jeton dans le champ *Jeton d'accès*) |
| `/api/history?token=LEJETON` | JSON `{resolution, count, rows}` |
| `/api/history` sans token | `401 {"error":"Jeton invalide"}` |

## Si ça échoue encore

- **404 sur `/`** → Root Directory mal réglé dans Vercel : le vérifier, il
  doit être vide, pas `VGH Remote V2/Site en ligne`.
- **500 sur `/api/*`** → `DATABASE_URL` absente, ou les tables ne sont pas
  créées : appliquer `deploy/schema.sql` sur Neon.
- **401 systématique** → `VGH_API_TOKEN` non identique entre Vercel et le
  champ saisi dans la page Historique.
- Logs des fonctions : onglet **Logs** du projet Vercel (runtime), pas
  l'onglet Build.
