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

## Second tour (BLOQUANT levé)
- Mise en service d'un bien testé au 29x9 à une clôture postérieure à sa date
  (tests 2026 et 2027, achevé le 2027-06-01) · ADMISE à sa vraie date (AUDCIF
  art. 45), aucun transfert automatique, message nommé
  (`motifTransfertDiffere`). « Transférer la dépréciation » le passe au premier
  jour d'un exercice ouvert qui commence après le dernier test (art. 22, 4°),
  pour tout ce que porte le 29x9 (`dernierTestDeClotureDepuis`, tests au 29x9
  seuls). L'aperçu le dit (`differe`, `auPlusTotApres`, date saisie lue).
- Rejeu sur vraie base, deux référentiels · mise en service admise, dotation
  2027 de 277 083,33 (9 500 000 / 20 × 7/12), transfert au 2028-01-01 de
  600 000 (2939 = 0, 2931 = -600 000, 7914 et 6914 à 600 000), bilan 2028 du
  poste Bâtiments brut 10 000 000, amort. et dép. 1 333 229,16 · 0 écart.

## Relevés en attente (non traités dans cette ligne)
- Les chiffres BRUTS des 69 et 79 (6914 / 7914, ou 853 / 863) apparaissent
  dans la NOTE 28 (SYSCOHADA), la note 5F (associations) et le compte de
  résultat · conséquence de la décision (reprise et dotation, résultat net
  inchangé), à expliquer à Manasse.
- Faux signal préexistant de `DEPRECIATION_IMMO_HORS_MODULE` sur l'à-nouveau
  (soldes d'ouverture du 29 lus contre les seuls mouvements du module de
  l'exercice).
- Le ré-étalement après dépréciation compte les années écoulées en années
  entières (`anneesEcoulees`) · dotation 2028 du cas du vérificateur
  9 122 916,67 / 20 = 456 145,83, et non sur les 233 mois restant à courir.
- `reclasser` réécrit `compteDepreciationId` de TOUS les mouvements du bien,
  transferts compris · l'historique ne dit plus le 29x9 d'origine.

## Reste
- Bloc § 3 complet, intégration sur `main` (hors de cette ligne).

## Vérification
`npx jest src/modules/immobilisations --maxWorkers=2`
