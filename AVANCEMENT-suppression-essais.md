# AVANCEMENT · ligne suppression-essais

Décision de Manasse du 2026-10-17 · un dossier d'essai non souscrit est conservé
180 jours après son terme en lecture seule, un rappel part au moins 30 jours
avant, puis il est SUPPRIMÉ par l'opérateur depuis la console (aucune tâche
planifiée : Cloud Run n'a pas d'ordonnanceur dans ce dépôt).

## Fait
- Calendrier pur `essais-echus.ts` (états, jours de Kinshasa) et son spec.
- Moteur de purge `purger-dossier.ts` lu dans le schéma (DMMF), son spec.
- Tables `RappelSuppressionEssai` et `DossierEssaiSupprime`, migration
  `20270188000100_suppression_des_essais_echus` (diff Prisma sans écart).
- Service, contrôleur (`GET /plateforme/essais-echus`, `POST .../rappels`,
  `POST .../:tenantId/supprimer`), courriel de rappel, `CourrierService.retenter`.
- Écran de console (`EssaisEchusConsole`, dans `PlateformePage`) et ses specs.
- Politique de confidentialité (180 jours, rappel 30 jours, suppression par VMG
  depuis sa console, sauvegardes chiffrées) et son spec.
- Paragraphe du règlement (CLAUDE.md, « Dossiers d'essai échus »).
- Rejeu sur vraie base · `scripts/rejouer-suppression-essais.cjs`.
- Relecture à la main (les agents de relecture ne sont pas disponibles dans cette
  session) · le rappel dit désormais la tranche qu'il n'a pas examinée.

## Reste
- Intégration sur `main` par la session principale (cette fiche est retirée alors).
- Décision à prendre au moment de publier : la date de la politique reste le
  17 octobre 2026 ; la changer rouvre le bandeau de consentement.

## Décisions prises
- Suppression par l'opérateur, jamais planifiée (Cloud Run sans ordonnanceur).
- Cent quatre-vingts JOURS (terme + 180 inclus, supprimable le lendemain), pas six
  mois calendaires ; préavis de trente jours compté du jour de l'ENVOI du rappel.
- Un dossier abonné (`AbonnementCabinet`), groupé, de démonstration ou non né de
  l'inscription en libre-service n'est jamais concerné (doute = non concerné).
- La liste de la console ne rend que des identifiants, dates, états et nombres.

## Vérifier
- `npx tsc --noEmit && npx jest` (serveur), `cd client && npx tsc --noEmit && npx vitest run`.
- `DATABASE_URL=<base jetable migrée> OMEGAX_DIST=<dossier compilé> node scripts/rejouer-suppression-essais.cjs`
