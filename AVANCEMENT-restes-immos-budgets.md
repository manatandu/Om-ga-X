# Avancement · ligne restes-immos-budgets

Gel levé expressément par Manasse le 2026-10-30 pour ces restes (CLAUDE.md § 5).
Branche de sauvegarde `travail/restes-immos-budgets`, partie de `origin/main`.

## Fait

1. **Report des budgets par compte** (`analytique/budget-compte.ts`,
   `planDuReportBudgetsComptes` ; `BudgetsComptesService.reporter` ;
   `GET` et `POST /analytique/budgets-comptes/report?exerciceId=` ; écran
   Budgets des comptes, onglet Dotation). Convention d'OmegaX, au modèle du
   report des budgets des sections (Sage i7) · un compte déjà doté en N+1
   n'est jamais écrasé ni complété (jugé ENTIER) ; rien n'est proratisé, deux
   exercices aux mois différents ne se reportent pas (AUDCIF art. 7) ; compte
   en sommeil ou subdivisé nommé et sauté (`motifCompteHorsSaisie`) ;
   exercice suivant contigu (AUDCIF art. 34 ; SYCEBNL art. 16, 4°) et ouvert.
   Rejoué sur vraie base à travers la clôture de 2025.

## Reste

2. Quantité du bien sur la fiche de comptage.
3. Annulation d'une sortie d'immobilisation.
4. Cas refusés de la sortie partielle, tranchés par la loi.

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
(cd client && npx tsc --noEmit && npm test && npm run build)
DATABASE_URL=postgresql://<base jetable> node scripts/rejouer-restes-immos-budgets.cjs
```
