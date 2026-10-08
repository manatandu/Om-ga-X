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

## Deuxième passe (2026-10-08, main 8f49df3 inchangé)
- Ajouts au banc · horloge du serveur au 2028-02-15 (libfaketime, `lancer.sh`),
  `parcours.mjs` (rapprochement sur relevé CSV, contrôles de clôture, liasse
  relue et formules calculées, import d'écritures par le modèle de fichier,
  modèle de saisie), restitution relue (`lib.mjs`), PV et écart de caisse
  (association 2027), modèle de saisie, import, pré-lettrage, lettrage
  automatique et relance (SARL 2028), scénario CLOISONNEMENT (A, B, C).
- `lancer.sh` sur base PostgreSQL 16 NEUVE · 845 contrôles, 830
  concordances, 15 écarts (tous des constats du logiciel ci-dessous), 0
  erreur HTTP.
- Défauts du banc corrigés en route · attendu du 4431 de 2028 (à-nouveau
  oublié), numérotation MENSUELLE de la banque, montants de B qui pouvaient
  naître d'une somme de A (47 centimes), classeur fouillé dézippé, validation
  avant les clôtures simultanées, fenêtre de dates envoyée comme l'écran,
  évaluateur étendu (IF, comparaisons, &, TEXT), ligne XC du projet confrontée
  à son résultat.

## Constats du logiciel (deuxième passe)
- R1 MAJEUR · restitution · `controles.txt` dit « 0 » ligne écrite pour CHAQUE
  table et « N table(s) en écart » alors que les CSV sont complets (SARL ·
  Ecriture 71 annoncées, 71 dans `tables/ecriture.csv`, « Ecriture;71;0;ECART »,
  45 tables en écart). archiver 7 (`archiver-utils`, `normalizeInputSource`)
  fait passer chaque source par un PassThrough DÈS `append` · le générateur des
  contrôles, ajouté en dernier, s'exécute aussitôt, avant la lecture des
  tables. Une archive amputée ne se distinguerait plus d'une complète
  (`src/modules/exports/restitution/restitution.service.ts`, `controles`, l. 342).
- C1 MINEUR · CHARGE_SANS_TIERS se lève sur l'écriture de redressement d'un
  manquant de caisse (D 658 / C 571 5 000) que le module d'inventaire demande
  et retient (`EcartInventaire.ecritureId`) · anomalie fabriquée
  (`controles.service.ts`, l. 1646 à 1668).
- C2 MINEUR · GET `/rapprochements/:id/propositions` sans `fenetreJours` ·
  400 « numeric string is expected », le paramètre est déclaré facultatif
  (`ParseIntPipe({ optional: true })`, l'écran envoie toujours 15).
- C3 MINEUR · cloisonnement · aucune fuite, mais des identifiants de B
  refusés en 400 au lieu de 404 (grand livre d'un compte de B, contrôles d'un
  exercice de B) ou ACCEPTÉS en 200 vides (liste et balance d'un exercice de
  B, export du journal d'un exercice de B · classeur de A vide).

## Reste
- Troisième passe après correction de R1 (critère de sortie · deux passes de
  suite sans BLOQUANT ni MAJEUR, docs/plan-version-1.md § 4).

## Commandes
- `PASSE_DATABASE_URL=<base jetable> scripts/passe-v1/lancer.sh /tmp/passe.json`
  (paquet système `faketime` pour l'horloge ; `PASSE_HORLOGE=aucune` sinon)
- `OMEGAX_API=http://localhost:8745 node scripts/passe-v1/passe.mjs /tmp/passe.json`
