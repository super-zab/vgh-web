# VGH Remote — site en ligne

Interface de contrôle à distance de la serre Virtual Greenhouse.

## Pages

- `/` — pilotage temps réel via MQTT (HiveMQ) + OTA
- `/historique` — historique de télémétrie et journal d'activité (Neon Postgres)

## Déploiement (Vercel)

Framework preset : **Other**. Root Directory : racine du repo.

Variables d'environnement à définir dans Vercel (Production + Preview) :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | chaîne de connexion Neon Postgres |
| `VGH_API_TOKEN` | jeton partagé protégeant `/api/*` |

## API

- `GET /api/history?from&to&gh&resolution&token`
- `GET /api/events?from&to&gh&token`
- `GET /api/export?from&to&gh&what=telemetry|events&token`
