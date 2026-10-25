# Ligne date-arrete · le signal de la date d'arrêté suit l'art. 23

Branche de sauvegarde `travail/date-arrete`, partie de `main` (1274d93).

## Décision par la loi (2026-10-25)

AUDCIF art. 23, lu dans la compétence `audcif-acte-uniforme` · « Les états
financiers annuels sont arrêtés au plus tard dans les quatre mois qui suivent la
date de clôture de l'exercice. La date d'arrêté doit être mentionnée dans toute
transmission des états financiers. » Non exclu par l'art. 3 du SYCEBNL. Manasse
a confirmé la lecture (« on arrête les comptes avant le 30/04 »).

`DATE_ARRETE_NON_RENSEIGNEE` avertissait aussi pendant l'exercice · une anomalie
fabriquée (§ 10 bis), qu'on ne levait qu'en saisissant une date fausse.

## Fait

- `controles.service.ts`, contrôle 20 · rien avant la clôture ; INFORMATION de
  la clôture au dernier jour du délai (date limite dite) ; AVERTISSEMENT le
  lendemain, au jour de Kinshasa. Jamais BLOQUANT.
- `date-arrete-comptes.spec.ts` · horloge fixée, cinq cas par référentiel
  (pendant l'exercice, dans le délai, dernier jour, lendemain à Kinshasa,
  date renseignée).
- `CLAUDE.md` · paragraphe « Date d'arrêté des comptes » complété.

## Reste

- Bloc § 3 des deux côtés (la machine manquait de mémoire, deux suites d'agents
  tournaient en même temps), commit signé, intégration sur `main`, déploiement
  relu, suppression de cette fiche et de la branche.

## Vérification

```bash
npx jest -i src/modules/exercice/date-arrete-comptes.spec.ts
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```
