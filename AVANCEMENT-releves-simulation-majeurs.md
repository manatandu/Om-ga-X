# Avancement · releves-simulation-majeurs

Périmètre · `docs/suivi-immobilisations-verrouille.md`, « Relevés en attente »,
entrée « SIMULATION DU LOGICIEL COMPLET (2026-10-08) », points MAJEUR seulement
(G2, SMT D2, F D2 K1, F D3, MAG-LIEN, H D1, PA1, J1, J2) et le MAJEUR relevé
après le second tour de G1 (585 du groupe, et le point « À VÉRIFIER » sur AU2).
Gel levé par Manasse le 2026-11-01 (« Enchaîne le point 3 »).

## Fait

- PA1 · liste du prévisionnel ramenée aux onze pièces de la note circulaire
  n° 003/2013, section B.II, dans l'ordre du texte (test du même commit).

- J1 · le cumul de consolidation lit le 13 par la règle des états individuels
  (`resultatDeLExerciceAuxClassesDeGestion`) · un résultat antérieur non
  affecté y est des capitaux propres (lu sous 130), plus le résultat.

## Reste

G2, D2, F D2 K1, F D3, MAG-LIEN, H D1, J2, 585 du groupe et AU2.

## Commandes de vérification

- `npx tsc --noEmit`, `npx jest`, `npm run build` (racine et `client/`).
