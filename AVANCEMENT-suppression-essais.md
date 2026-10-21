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

- Corrections des deux relectures (2026-10-21), un commit chacune ·
  (1) licence `FOR UPDATE` avant la lecture du calendrier dans `supprimer` ;
  (2) l'adresse du client ne remonte jamais · catégorie d'échec seule
  (`cause-echec-envoi.ts`) dans la liste, le retour des rappels et le journal ;
  (3) un rappel par dossier ET par terme (migration non appliquée en production
  adaptée, diff Prisma sans écart), rappel d'un autre terme ignoré, refus de
  supprimer sur lui ; (4) preuve d'inscription aussi sur l'origine = un
  utilisateur du dossier (renvoi) ; (5) candidats lus par pages, par la clé,
  non concernés écartés en SQL, comptes sur tous, bouton réglé sur le compte du
  serveur ; (6) préavis de trente jours PLEINS (D + 31) ; (7) date d'envoi
  affichée au jour de Kinshasa ; (8) date annoncée dite un minimum ;
  (9) cinquante rappels par appel, `restants` dit ; (10)
  `RELATIONS_ENTRE_DOSSIERS` gelées contre le schéma ; (11) politique datée du
  21 octobre 2026.
- Rejeu sur vraie base rejoué après les corrections (PostgreSQL 16 local, base
  jetable, serveur compilé) · TOUT EST PROUVÉ, 39 vérifications, dont le
  scénario nouveau « essai redonné » (terme nouveau, rappel ancien ignoré, refus
  de supprimer, nouveau rappel parti, deux lignes en table). Il a trouvé un
  défaut, corrigé et gelé · le message du rappel d'un AUTRE terme était adopté
  pour « parti » quand la fenêtre du terme nouveau s'ouvrait avant lui ; un
  message tenu par une autre ligne de suivi n'est plus jamais adopté.

## Reste
- Intégration sur `main` par la session principale (cette fiche est retirée alors).
- La date de la politique est passée au 21 octobre 2026 (le fond a changé) · le
  bandeau de consentement se rouvre une fois, c'est voulu.

## Décisions prises
- Suppression par l'opérateur, jamais planifiée (Cloud Run sans ordonnanceur).
- Cent quatre-vingts JOURS (terme + 180 inclus, supprimable le lendemain), pas six
  mois calendaires ; préavis de trente jours PLEINS après le jour de l'ENVOI du
  rappel (supprimable à D + 31), même règle que la conservation.
- Un rappel par terme d'essai · le rappel d'un essai redonné ne vaut pas préavis.
- Cinquante rappels par appel, convention d'OmegaX (délai d'une requête).
- Un dossier abonné (`AbonnementCabinet`), groupé, de démonstration ou non né de
  l'inscription en libre-service n'est jamais concerné (doute = non concerné).
- La liste de la console ne rend que des identifiants, dates, états et nombres.

## Vérifier
- `npx tsc --noEmit && npx jest` (serveur), `cd client && npx tsc --noEmit && npx vitest run`.
- `DATABASE_URL=<base jetable migrée> OMEGAX_DIST=<dossier compilé> node scripts/rejouer-suppression-essais.cjs`
