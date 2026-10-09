# Avancement · ligne tiers-panoplie

Décision de Manasse du 2026-10-09 · « Lève le gel pour la fonction de chaque
tiers et numéro personnalisée, et corrige ». Réponses · bouton « Compléter »,
refus nommé sur le collectif, salarié « pas pour l'instant ».

## Fait
- Panoplie par type et référentiel (`tiers/collectifs-tiers.ts`), numéros lus
  dans les deux semis, gelés par `collectifs-tiers.spec.ts`.
- Création du tiers avec sa panoplie ; `POST /tiers/:id/panoplie`,
  `POST /tiers/panoplies` (tranches de cent), administrateur seul.
- Refus nommé de la saisie sur un collectif (`verifierComptesCollectifs`).
- Un compte de trésorerie par journal (`JournalService`).
- Écran Tiers · « Compléter ses comptes », « Compléter les comptes des tiers ».
- Scénario sur vraie base · `e2e/tests/tiers-panoplie.e2e.ts` (clôture N, N+1).
- Test navigateur de « Rester connecté » · `e2e/tests/rester-connecte.e2e.ts`.

## Reste
- Relectures (échecs silencieux, TypeScript), bloc § 3, e2e complet, main,
  déploiement vérifié.

## Vérification
- `npx jest src/modules/tiers src/modules/comptabilite/compte-collectif-saisie.spec.ts src/modules/journaux`
- `cd e2e && npx playwright test tests/tiers-panoplie.e2e.ts tests/rester-connecte.e2e.ts --project=chromium`
