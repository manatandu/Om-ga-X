# Avancement · ligne comptes-personnalises

Décision de Manasse du 2026-10-09 (gel levé, `docs/plan-version-1.md` § 8),
points 1 et 2 de la note « numéros personnalisés ».

## Fait

1. Saisie sur les comptes du dossier · `comptes/subdivisions-du-plan.ts`
   (racine officielle d'un compte semé, la plus profonde ; 490 et 590 gelés,
   4478, 831, 841 du SYCEBNL gelés), `EcritureService.verifierComptesCollectifs`
   étendu · un compte semé qu'un sous-compte ACTIF du dossier subdivise refuse
   la ligne saisie, refus nommé ; mêmes issues que le collectif (modification,
   416 tenu, pièce de report), plus le compte d'un journal de trésorerie,
   toujours ouvert. Specs · `subdivisions-du-plan.spec.ts`,
   `compte-collectif-saisie.spec.ts`.

## Reste

2. Journal de banque ou de caisse · « Ouvrir son compte » à la création,
   numéro proposé (premier libre sous la racine du compte semé choisi),
   modifiable, refus nommés.
3. Écran Journaux, e2e sur vraie base à travers une clôture, relectures
   (silent-failure-hunter, typescript-reviewer, react-reviewer), CLAUDE.md
   § 6 point 13, plan § 8, intégration, déploiement vérifié.

## Décisions

- La racine d'un compte semé est le plus court préfixe, au moins aussi long
  que le numéro dépouillé de ses zéros, qui n'est pas un TOTAL semé (un même
  numéro n'est pas à la fois total et compte d'imputation).
- Les sous-comptes en sommeil ne ferment pas le compte du plan (issue pour
  revenir sur une subdivision).

## Vérification

    npx jest src/modules/comptes/subdivisions-du-plan.spec.ts src/modules/comptabilite/compte-collectif-saisie.spec.ts
    npx tsc --noEmit
