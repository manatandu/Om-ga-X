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

(rien encore)

## Reste

- #37 · `donneurDuJournal` rend la devise du RIB au lieu de refuser ;
  `preparerSalaries` garde le refus (la paie est en francs, L5) ; règle
  pure dans `tiers/ribs-tiers.ts` · chaque ligne réglée dans la devise du
  RIB, sinon refus nommé avant la première pièce ; `OrdreVirement.devise`,
  `totalDevise`, `LigneOrdreVirement.montantDevise` (migration) ;
  `LigneAOrdonner.montantDevise` et `devise` posés aux trois points de
  construction de `reglements.service.ts` ; écran de l'ordre (montant en
  devise et contre-valeur en francs), spec l. 100 réécrit, test navigateur,
  scénario sur vraie base à travers une clôture ; CLAUDE.md § 6, règle (3)
  des ordres de virement réécrite.
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
```
