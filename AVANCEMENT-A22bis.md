# Avancement · ligne A22 bis (transfert de la dépréciation d'un en-cours à la mise en service)

Branche de sauvegarde · `travail/a22bis`. Décision de Manasse du 2026-10-04 ·
à la mise en service, la dépréciation du 29x9 est reprise et dotée de nouveau
au 29 du bien achevé.

## Textes lus (avant d'écrire)
- AUDCIF Titre VII, fiches 29, 69, 79 ; Titre VII ch. 2 (28 et 29 suivent la
  classe 2) ; Titre VIII ch. 12 § 2.1, § 2.4.1, § 2.4.2, § 2.5.
- SYCEBNL Partie 2 ch. 3, fiches 29, 69, 79 ; Partie 2 ch. 2 (293, 2931, 2939).
- Tension écrite (non bloquante, décision prise sur le relevé d'A22) · les
  fiches 29 placent dotations et reprises « à la clôture de l'exercice ».

## Fait
- `transfert-depreciation-en-cours.ts` (règles pures) et son spec, chiffres de main.
- Schéma · `NatureMouvementDepreciation` (CLOTURE, TRANSFERT_REPRISE,
  TRANSFERT_DOTATION), clé `[immobilisationId, exerciceId, nature]`, migration
  `20270137000000_transfert_depreciation_mise_en_service`.
- Mise en service · trois écritures (virement du brut, reprise, dotation),
  deux mouvements dans la transaction de la fiche ; refus jumeau (mise en
  service avant une dépréciation du bien en cours).
- `GET/POST /immobilisations/:id/transfert-depreciation` (aperçu ; transfert
  d'un bien déjà mis en service).
- Sortie et reclassement lisent le compte qui PORTE le cumul
  (`porteurDeLaDepreciation`), plus le dernier mouvement.

- Écran · aperçu dans la fenêtre de mise en service (`ApercuTransfertDepreciation`),
  bouton « Transférer la dépréciation » pour un bien déjà mis en service.
- Rejeu sur vraie base (API compilée, PostgreSQL 16 jetable, N, N+1, N+2, N+3,
  clôtures comprises), SYSCOHADA et SYCEBNL · 0 écart (script
  `a22bis.mjs` du bloc-notes de session). Défaut trouvé et corrigé · un second
  transfert lisait le premier comme une dépréciation postérieure (seuls les
  tests de CLÔTURE sont datés de la fin d'exercice).

## Reste
- Bloc § 3 complet, intégration sur `main` (hors de cette ligne).

## Vérification
`npx jest src/modules/immobilisations --maxWorkers=2`
