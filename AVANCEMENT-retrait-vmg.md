# Ligne retrait-vmg · OmegaX sans VMG Consulting

Demande de Manasse du 2026-10-28 · « retirer tout ce qui concerne VMG
Consulting », « OmegaX seul » comme éditeur affiché, « même logiciel, autre
marque », sites du cabinet et domaine `omegax.vmgconsulting.net` « tout
retirer ». Une demande expresse vaut levée du gel pour elle seule (§ 5).

## Décisions, avec leur article

- L'éditeur n'est plus nommé · « l'éditeur » ou « l'éditeur d'OmegaX » là où
  le texte parle de la personne, « OmegaX » là où il parle du logiciel.
- Code du numérique (ordonnance-loi n° 23/10 du 13 mars 2023), art. 52 ·
  l'offre en ligne doit donner le nom ou la dénomination de la personne qui
  vend. « OmegaX » est un logiciel, pas une personne · la dénomination de
  l'éditeur est `null`, le contrat le dit « à arrêter par l'éditeur », et
  l'acceptation en ligne reste FERMÉE (art. 54, al. 2) tant qu'une entité
  n'est pas nommée. Dit à Manasse avant de coder.
- Contrat · la version 1 reste archivée mot pour mot (art. 53, 9°). La
  version 2, sans VMG, se publie. La bascule de l'art. 34 n'est pas due · la
  version 1 n'a jamais pu être acceptée (offre incomplète, acceptation
  fermée depuis sa publication), personne n'est lié par elle.
- Questionnaire · les codes `VMG-…` deviennent `EDI-…` (question de
  l'éditeur), réponses déjà saisies migrées par une migration nouvelle.
- Ne bougent pas · migrations appliquées (empreinte Prisma), historique git,
  données en base (dossier de l'éditeur, adresse de connexion de
  l'opérateur, qui se change par Fichier > Mon compte), sources amont de
  `.claude/amont/` (tiers, faux positifs).
- Domaine · `omegax.vmgconsulting.net` retiré du CORS, de la surveillance,
  de l'aiguillage du site ; `vmgconsulting.net` retiré de la surveillance ;
  site du cabinet (`docs/site-vitrine/cabinet/`) supprimé. Reste
  `oomega.web.app`, la page publique sous `/vitrine/`.

## Fait

- Serveur, client, e2e, docs, workflows, installateur, CLAUDE.md · plus
  aucune mention hors préfixe ancien des factures, migrations et amont.
- Vérifié · `npx tsc --noEmit` et `npm run build` (serveur), `npx jest`
  969 suites et 14 171 tests verts (deux suites tuées par la mémoire,
  relancées vertes) ; client tsc, 2 476 tests, build verts.

## Reste

- Accord de Manasse pour intégrer sur `main` · le retrait du domaine du
  CORS coupe l'API à qui ouvrirait encore le site sous ce domaine.
- Tests navigateur et déploiement relus après l'intégration.

## Vérification

```bash
git grep -il vmg -- . ':!prisma/migrations' ':!.claude/amont'
npx tsc --noEmit && npx jest
cd client && npx tsc --noEmit && npm test && npm run build
```
