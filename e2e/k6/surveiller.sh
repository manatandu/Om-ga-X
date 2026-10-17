#!/bin/bash
# SURVEILLANCE DU SERVEUR PENDANT UN ESSAI k6 · un échantillon toutes les 2 s en CSV.
#
# usage : surveiller.sh <pid du serveur node> <fichier.csv> [intervalle en secondes]
# Colonnes : instant, mémoire résidente (Mo), pic de mémoire résidente (Mo),
# connexions ouvertes sur la base, dont actives, charge moyenne (1 min).
# La base se lit par les variables PGHOST, PGPORT, PGUSER, PGDATABASE (celles de
# psql) · JAMAIS la base de production. S'arrête quand le serveur disparaît ou
# sur Ctrl-C ; ne modifie rien.
set -u
PID="$1"; SORTIE="$2"; PAS="${3:-2}"
echo "instant,rss_mo,pic_rss_mo,connexions_base,connexions_actives,charge_1min" > "$SORTIE"
while kill -0 "$PID" 2>/dev/null; do
  RSS=$(awk '/VmRSS/ {printf "%d", $2/1024}' /proc/"$PID"/status 2>/dev/null)
  PIC=$(awk '/VmHWM/ {printf "%d", $2/1024}' /proc/"$PID"/status 2>/dev/null)
  CONN=$(psql -qtAX -c "select count(*), count(*) filter (where state='active') from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()" 2>/dev/null | tr '|' ',')
  CHARGE=$(cut -d' ' -f1 /proc/loadavg)
  echo "$(date +%H:%M:%S),${RSS:-},${PIC:-},${CONN:-,},${CHARGE}" >> "$SORTIE"
  sleep "$PAS"
done
