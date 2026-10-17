#!/bin/bash
# SURVEILLANCE DU SERVEUR PENDANT UN ESSAI k6 · un échantillon toutes les 2 s en CSV.
#
# usage : surveiller.sh <pid du serveur node> <fichier.csv> [intervalle en secondes]
# Colonnes : instant, mémoire résidente du serveur (Mo), pic de mémoire
# résidente (Mo), connexions ouvertes sur la base, dont actives, charge moyenne
# de la machine (1 min), part du cœur utilisée par le serveur (cpu_serveur, 100 =
# un cœur plein) et par PostgreSQL (cpu_base, tous processus confondus).
# La base se lit par les variables PGHOST, PGPORT, PGUSER, PGDATABASE (celles de
# psql) · JAMAIS la base de production. S'arrête quand le serveur disparaît ou
# sur Ctrl-C ; ne modifie rien.
set -u
PID="$1"; SORTIE="$2"; PAS="${3:-2}"
HZ=$(getconf CLK_TCK)
echo "instant,rss_mo,pic_rss_mo,connexions_base,connexions_actives,charge_1min,cpu_serveur,cpu_base" > "$SORTIE"
ticks_serveur() { awk '{print $14+$15}' /proc/"$PID"/stat 2>/dev/null; }
secondes_base() { ps -C postgres -o cputimes= 2>/dev/null | awk '{s+=$1} END {print s+0}'; }
T0=$(date +%s.%N); S0=$(ticks_serveur); B0=$(secondes_base)
while kill -0 "$PID" 2>/dev/null; do
  sleep "$PAS"
  T1=$(date +%s.%N); S1=$(ticks_serveur); B1=$(secondes_base)
  [ -z "$S1" ] && break
  CPUS=$(echo "scale=0; ($S1-$S0)*100/$HZ/($T1-$T0)" | bc)
  CPUB=$(echo "scale=0; ($B1-$B0)*100/($T1-$T0)" | bc)
  T0=$T1; S0=$S1; B0=$B1
  RSS=$(awk '/VmRSS/ {printf "%d", $2/1024}' /proc/"$PID"/status 2>/dev/null)
  PIC=$(awk '/VmHWM/ {printf "%d", $2/1024}' /proc/"$PID"/status 2>/dev/null)
  CONN=$(psql -qtAX -c "select count(*), count(*) filter (where state='active') from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()" 2>/dev/null | tr '|' ',')
  CHARGE=$(cut -d' ' -f1 /proc/loadavg)
  echo "$(date +%H:%M:%S),${RSS:-},${PIC:-},${CONN:-,},${CHARGE},${CPUS:-},${CPUB:-}" >> "$SORTIE"
done
