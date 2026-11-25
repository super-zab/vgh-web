# VGH Remote — site en ligne

Interface de contrôle à distance de la serre Virtual Greenhouse.

## Pages

- `/` — accueil : un mot de passe par serre, il désigne la serre ouverte
- `/direct` — suivi temps réel via MQTT (HiveMQ)
- `/historique` — historique de télémétrie, journal d'activité, export CSV (Neon Postgres)
- `/pilotage` — commandes, configuration, OTA

Une fois la serre ouverte, un cookie de session (30 jours) donne accès aux
trois pages et à `/api/*` sans rien ressaisir. Voir `api/_auth.js`.

## Déploiement (Vercel)

Framework preset : **Other**. Root Directory : racine du repo. Un push sur
`main` déclenche le déploiement.

Variables d'environnement (Production + Preview) :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | chaîne de connexion Neon Postgres |
| `VGH_GREENHOUSES` | les serres, en JSON (ci-dessous) |
| `VGH_API_TOKEN` | optionnel : jeton pour appeler `/api/*` hors navigateur |
| `VGH_SESSION_SECRET` | optionnel : sel de signature des cookies |

```json
{
  "gh1": {
    "name": "Serre prototype",
    "password": "mot de passe de la serre",
    "mqttHost": "xxxxxxxx.s1.eu.hivemq.cloud",
    "mqttUser": "vgh-web",
    "mqttPass": "mot de passe MQTT",
    "base": "vgh/gh1"
  }
}
```

La clé (`gh1`) est le `device_id` de la serre dans la base. Ajouter une serre =
ajouter une entrée `gh2` avec son propre mot de passe, puis redéployer.
Sans `VGH_GREENHOUSES`, `VGH_API_TOKEN` sert de mot de passe à `gh1` et les
pages demandent le mot de passe MQTT.

## API

Authentifiées par le cookie de session (la serre vient de la session), ou par
`?token=VGH_API_TOKEN&gh=gh1` pour un appel direct.

- `POST /api/login` `{password}` · `POST /api/logout` · `GET /api/session`
- `GET /api/history?from&to&resolution`
- `GET /api/events?from&to`
- `GET /api/export?from&to&what=telemetry|events`
