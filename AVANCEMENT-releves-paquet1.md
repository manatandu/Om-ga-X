# AVANCEMENT · releves-paquet1

Gel levé par Manasse le 2026-11-01 (« Enchaîne le point 3 ») pour les
« Relevés en attente » de `docs/suivi-immobilisations-verrouille.md`. Périmètre
de cette ligne · PAQUET 1, LIGNE A ; LIGNE C ; LIGNE B. Le suivi n'est pas
retouché ici (l'intégrateur le fera depuis le rapport).

## Fait

- **B · MAJEUR B7 incomplet** · une ligne de bilan d'ouverture importé
  (`reference === 'IMPORT'`, `estGenereeParCloture`) arrête la chaîne des
  reports et EST l'origine, à la date de son écriture, même quand l'exercice
  a un précédent (`estImportDOuverture`, `date-origine-des-reports.ts`, trois
  appelants). Test · `date-origine-des-reports.spec.ts`, bloc B7.

## Reste

Voir le rapport final (relevés par relevé).

## Commandes de vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```
