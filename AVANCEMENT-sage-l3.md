# Ligne sage-l3 · banque et trésorerie

Copie `/home/user/wt-sage-l3`, branche de sauvegarde `travail/sage-l3`.
Migrations `20270190000100_…` et suivantes, bases jetables `l3_ombre`
(ombre), `l3_e2e` (tests navigateur), `l3_scenario` (scénario sur vraie
base) ; serveur 8303, client 4303, tests navigateur `e2e/tests/sage-l3-*.e2e.ts`.

Fonctions (numéros de `docs/comparaison-sage/15-absents-a-trier.md`), dans
l'ordre · #37 virement depuis un compte en devise, #40 remises de chèques et
de cartes, #39 effets de commerce (circuit comptable seul, décision D11),
#45 édition chaînée des extraits, #46 conditions bancaires par RIB,
autorisations de financement, unions de comptes, #47 taux de référence,
financements, placements.

## Fait

- #37 · serveur (15ff6c1) · `deviseDuDonneur`, `motifRefusLignesHorsDeviseDonneur`
  (`tiers/ribs-tiers.ts`), `donneurDuJournal` rend la devise du RIB,
  `refuserLignesHorsDevise` avant la première pièce, `OrdreVirement.devise`,
  `totalDevise`, `LigneOrdreVirement.montantDevise` (migration
  `20270190000100_ordre_de_virement_en_devise`), la devise de chaque ligne posée
  aux trois points de `reglements.service.ts`, avis de règlement en devise avec
  sa contrevaleur ; les salaires restent en francs.
- #37 · écran de l'ordre (liste en devise, colonnes « Montant USD » et
  « Contrevaleur CDF », mention imprimée), test navigateur
  `e2e/tests/sage-l3-virement-devise.e2e.ts` PASSÉ sur vraie base le
  2026-10-22 (Postgres jetable 55803, serveur 8303, client 4303) · refus sans
  devise au RIB, ordre de 1 000 USD pour 1 680 000 CDF, refus d'une facture en
  francs sur un RIB en USD, clôture de N, second ordre de N+1 numéroté à la
  suite, avis « 500,00 USD (contrevaleur comptable 840 000,00 CDF) ».
- #37 · docs · `features.csv` (37 en yes), tables 05 (M5-42) et 13 (M13-72),
  `build-log.md`, `test-plan.md` (F37-H1, N1, N2, N3), CLAUDE.md § 6 règle (3)
  des ordres de virement réécrite.
- Bloc § 3 du 2026-10-22 · serveur tsc, Jest 950 suites et 13 829 tests, build ;
  client tsc, 2 408 tests, build.
- #37 · premier tour de relecture (silent-failure-hunter, typescript-reviewer,
  react-reviewer) · aucun BLOQUANT ni MAJEUR, sept MINEURS corrigés · l'avis
  d'un ordre en devise refuse une ligne sans montant en devise au lieu
  d'imprimer la contrevaleur ; l'avis servi porte `montantDevise` et la devise
  de l'ordre, la carte de l'écran les affiche avec l'unité ; le libellé du
  refus sans devise au RIB couvre « CDF » écrit en toutes lettres ; la devise
  d'une ligne se lit comme celle du RIB (majuscules, franc = aucune) ; le
  refus de garde de `creerDans` nomme le bénéficiaire ; `totalDevise` somme
  les lignes ARRONDIES (deux demi-centimes, cas gelé) ; la liste montre
  « · USD » quand le total en devise manque, jamais la contrevaleur sans
  unité. Non repris · la ligne de la liste ouverte à la souris seule
  (préexistant, relevé en attente), le RIB lu deux fois (refus nommé dans les
  deux sens, pas une faute).

## Reste

- #37 · deux tours de relecture (silent-failure-hunter, typescript-reviewer,
  react-reviewer), puis parité recomptée à l'intégration.
- #40 · module `remises/` (bordereau de remise de chèques ou de cartes,
  types de remise, modèle de bordereau imprimé, écriture par le 51x).
- #39 · module `effets/` (portefeuille, remise à l'encaissement ou à
  l'escompte, échéance, impayé, bon à payer) · lire la fiche du 67 (675) et
  le décret n° 011/42, art. 57 al. 2, avant de coder.
- #45 · liste et édition chaînée des extraits (`rapprochement/`).
- #46 · conditions bancaires par RIB, autorisations de financement, unions
  de comptes (`banques/`).
- #47 · taux de référence, financements, placements (`tresorerie/`) ; les
  OPCVM se tranchent par la loi avant de coder.
- Docs · `features.csv` (colonne clone des lignes 37, 39, 40, 45, 46, 47),
  `build-log.md`, `test-plan.md`, `parity.md`, tables 05, 13, 14, 06 de la
  comparaison ; paragraphe de la ligne au § 6 de CLAUDE.md.
- Bloc du § 3 complet des deux côtés, tests navigateur, deux tours de
  relecture, intégration sur `main`, déploiement relu, fiche retirée.

## Décisions par la loi

- **D1 (architecture.md) · le virement part d'un compte en devise.** Loi
  n° 23/053, art. 141, 1° · « Cette comptabilité est exprimée en Franc
  congolais » · le texte vise la comptabilité, pas la monnaie du compte
  bancaire. Les pièces de règlement restent en francs ; l'ordre porte, en
  plus, le montant en devise de chaque ligne (F49, `ligne-en-devise.ts`),
  et ce montant est celui que la banque exécute. Une ligne réglée en francs
  ou dans une autre devise que celle du RIB est refusée avant la première
  pièce, en nommant la ligne et l'issue (régler dans la devise du RIB, ou
  choisir un journal dont le RIB est tenu dans la monnaie du règlement).
- **D11 (architecture.md)** · LCR, BOR, CFONB, ETEBAC, SEPA non reproduits.

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
# test navigateur sur vraie base · script du bac à sable l3-e2e.sh (Postgres 55803, serveur 8303, client 4303)
cd e2e && npx tsc --noEmit -p . && npx playwright test tests/sage-l3-virement-devise.e2e.ts
```
