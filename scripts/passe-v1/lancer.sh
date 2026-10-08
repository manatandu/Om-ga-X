#!/usr/bin/env bash
# LANCEUR DE LA PASSE V1 · migre une base PostgreSQL JETABLE, construit et
# démarre le serveur compilé, joue le banc, puis arrête CE serveur par son
# seul PID (d'autres serveurs peuvent tourner sur la machine).
#
# La chaîne de connexion se passe par PASSE_DATABASE_URL et n'est JAMAIS
# affichée (CLAUDE.md § 4) · jamais celle de production.
#
#   PASSE_DATABASE_URL=… scripts/passe-v1/lancer.sh [sortie.json]
#
# Variables · PASSE_PORT (8745), PASSE_SANS_BUILD=1 (garde dist/ tel quel),
# PASSE_SCENARIOS (association,projet,sarl,cloisonnement),
# PASSE_PROJET_SANS_INTERETS=1, PASSE_HORLOGE (« 2028-02-15 09:00:00 »).
#
# L'HORLOGE DU SERVEUR · le banc clôture 2026 et 2027 · un cabinet le fait en
# 2028. Le serveur tourne donc sous libfaketime au 15 février 2028 (paquet
# `faketime`), date à laquelle les contrôles qui ne parlent qu'au lendemain de
# la clôture parlent, la caisse du 31/12/2027 se compte et une facture de
# janvier 2028 est échue. Seul le processus du serveur est décalé (la base et
# le banc gardent leur heure), et le banc lit la même date (PASSE_HORLOGE).
# PASSE_HORLOGE=aucune garde l'horloge réelle · les parcours qui en dépendent
# le disent en note.
set -euo pipefail

RACINE="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${PASSE_PORT:-8745}"
SORTIE="${1:-$RACINE/scripts/passe-v1/resultats/passe-$(date +%Y%m%d-%H%M%S).json}"
JOURNAL="$(mktemp -t passe-v1-serveur.XXXXXX.log)"

if [ -z "${PASSE_DATABASE_URL:-}" ]; then
  echo "PASSE_DATABASE_URL manque · une base PostgreSQL JETABLE, jamais celle de production." >&2
  exit 2
fi

cd "$RACINE"
echo "Migrations de la base jetable…"
DATABASE_URL="$PASSE_DATABASE_URL" npx prisma migrate deploy > "$JOURNAL.migrate" 2>&1 || {
  echo "Échec des migrations · voir $JOURNAL.migrate" >&2; exit 1; }

if [ "${PASSE_SANS_BUILD:-}" != "1" ]; then
  echo "Construction du serveur…"
  npm run build > "$JOURNAL.build" 2>&1 || { echo "Échec de la construction · voir $JOURNAL.build" >&2; exit 1; }
fi

HORLOGE="${PASSE_HORLOGE:-2028-02-15 09:00:00}"
FAKETIME_LIB="/usr/lib/x86_64-linux-gnu/faketime/libfaketimeMT.so.1"
if [ "$HORLOGE" != "aucune" ] && [ -f "$FAKETIME_LIB" ]; then
  export PASSE_HORLOGE="$HORLOGE"
  PRECHARGE="$FAKETIME_LIB"
  echo "Horloge du serveur · $HORLOGE (libfaketime)"
else
  unset PASSE_HORLOGE
  PRECHARGE=""
  echo "Horloge du serveur · réelle (libfaketime absent ou PASSE_HORLOGE=aucune)"
fi

echo "Démarrage du serveur sur le port $PORT…"
# LD_PRELOAD posé sur node lui-même · $! est bien le PID de node, que le trap arrête.
LD_PRELOAD="$PRECHARGE" FAKETIME="@$HORLOGE" FAKETIME_DONT_FAKE_MONOTONIC=1 TZ=UTC \
  DATABASE_URL="$PASSE_DATABASE_URL" PORT="$PORT" INSCRIPTION_PUBLIQUE=true \
  JWT_SECRET="passe-v1-jetable-$RANDOM-$RANDOM" JWT_EXPIRES_IN=8h NODE_ENV=production \
  node dist/main.js > "$JOURNAL" 2>&1 &
PID=$!
arreter() { kill "$PID" 2>/dev/null || true; }
trap arreter EXIT

for _ in $(seq 1 90); do
  if curl -fsS "http://localhost:$PORT/health" > /dev/null 2>&1; then break; fi
  if ! kill -0 "$PID" 2>/dev/null; then echo "Le serveur s'est arrêté · voir $JOURNAL" >&2; exit 1; fi
  sleep 1
done

OMEGAX_API="http://localhost:$PORT" node scripts/passe-v1/passe.mjs "$SORTIE"
