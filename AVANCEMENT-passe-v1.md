# Avancement · passe V1 (banc rejouable des trois dossiers types)

Branche de sauvegarde · `travail/passe-v1`. Plan · `docs/plan-version-1.md`.
Gel des nouveautés · AUCUN code de production touché (src/, client/, prisma/).

## Fait
- `scripts/passe-v1/` · `lib.mjs` (client, contrôles, lectures), `passe.mjs`
  (lanceur, bilan, JSON), `lancer.sh` (migre, construit, démarre, joue,
  arrête par PID), `README.md` (lancement, scénarios, attendus calculés).
- Scénarios ASSOCIATION, PROJET, SARL sur 2026 et 2027, clôtures comprises,
  livres exportés et restitution.
- Passage d'essai sur `origin/main` (2af9371) · voir le rapport de la passe.

## Constats du logiciel (passage d'essai)
- P1 BLOQUANT · bilan du projet · CC lit le seul compte 13 · tout résultat non
  nul avant clôture (intérêts, frais bancaires) déséquilibre le bilan et la
  clôture est refusée (`etats-financiers-projet.service.ts`, `calculerCC`).
- A1 MAJEUR · TFT des associations, premier exercice repris par bilan
  d'ouverture importé · ouverture ignorée (ZA 0, flux du fournisseur repris
  perdus), `controle.coherent` faux (`etats-financiers.service.ts`,
  `tableauFluxTresorerie`, sans `comparatifDuBilan`).
- B1 MAJEUR · bilan de N+1 avant l'affectation, opérations de N+1 passées ·
  le résultat de N encore au 13 disparaît (une source OU l'autre), bilan
  déséquilibré du résultat non affecté, aux DEUX référentiels (`calculerCH`,
  `calculerCJ`), `equilibre` faux et `doubleComptageProbable` vrai.
- Attendus des deux lignes en cours · lettrage partiel non reconduit
  (lettrage-cloture), négatif de facture et perte avec duplicata
  (tva-decisions, points A et D).

## Première passe (2026-10-08, main 8f49df3)
- Lignes `lettrage-cloture` et `tva-decisions` intégrées, P1, A1, B1 corrigés.
- `lancer.sh` sur base PostgreSQL 16 NEUVE · 368 contrôles, 368 concordances,
  0 écart, 0 erreur HTTP, une note (achat A4 de 2027 saisi au journal, date
  de réception à venir).

## Reste
- Deuxième passe (critère de sortie · deux passes de suite sans BLOQUANT ni
  MAJEUR, docs/plan-version-1.md § 4).

## Commandes
- `PASSE_DATABASE_URL=<base jetable> scripts/passe-v1/lancer.sh /tmp/passe.json`
- `OMEGAX_API=http://localhost:8745 node scripts/passe-v1/passe.mjs /tmp/passe.json`
