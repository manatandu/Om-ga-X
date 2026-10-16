# Avancement · immo-formulaire (demande de Manasse du 2026-10-16)

## Fait
- Un seul classeur « Tableaux des immobilisations », trois feuilles · Immobilisations,
  Amortissements, Réévaluations (`ExportService.tableauxImmobilisationsExcel`,
  `GET /exports/tableaux-immobilisations`). Spec · `formules-excel.spec.ts`.
- Formulaire de création · la nature du barème vient AVANT le compte du bien ; compte
  proposé non personnalisé · « Le personnaliser et le choisir » (administrateur).
- Lieu vide · le message dit quoi faire, bouton vers l'onglet Lieux.
- Journal de l'écriture d'acquisition choisi à l'écran (AUDCIF art. 22, 2°).
- SYSCOHADA · « Amortissement fiscal » (dégressif fiscal ou exceptionnel) choisi à la
  création, ouvre la fiche fiscale après l'enregistrement (fiche du compte 68 ; loi
  n° 23/053, art. 31 à 38). Le mode comptable reste linéaire ou unités d'œuvre.

## Reste
- Relecture react-reviewer et silent-failure-hunter, scénario sur vraie base, intégration.

## Vérification
- `npx tsc --noEmit` des deux côtés, `npx jest src/modules/exports`, `npx vitest run src/pages`.
