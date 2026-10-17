# AVANCEMENT · ligne suppression-essais

Décision de Manasse du 2026-10-17 · un dossier d'essai non souscrit est conservé
180 jours après son terme en lecture seule, un rappel part au moins 30 jours
avant, puis il est SUPPRIMÉ par l'opérateur depuis la console (aucune tâche
planifiée).

## Fait
- Calendrier pur `essais-echus.ts` (états, jours de Kinshasa) et son spec.
- Moteur de purge `purger-dossier.ts` lu dans le schéma (DMMF), son spec.
- Tables `RappelSuppressionEssai` et `DossierEssaiSupprime`, migration
  `20270188000100_suppression_des_essais_echus` (diff Prisma sans écart).
- Service, contrôleur (`GET /plateforme/essais-echus`, `POST .../rappels`,
  `POST .../:tenantId/supprimer`), courriel de rappel.
- Rejeu sur vraie base · `scripts/rejouer-suppression-essais.cjs`.

## Reste
- Écran de console, politique de confidentialité, paragraphe du règlement,
  relecture (silent-failure-hunter, typescript-reviewer), bloc du § 3.

## Vérifier
- `DATABASE_URL=<base jetable migrée> node scripts/rejouer-suppression-essais.cjs`
- `npx tsc --noEmit && npx jest`
