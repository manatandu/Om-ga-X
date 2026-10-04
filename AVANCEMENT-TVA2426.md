# Ligne TVA 24-26 · fiche d'avancement

Branche de sauvegarde `travail/tva2426`, partie de `main` (8f6f003).
Rapport de départ · reconfrontation du moteur aux art. 24 à 26 de l'O.-L.
n° 10/001 et aux art. 51 à 63 du décret n° 011/42 (lecture seule du
2026-10-04).

## Textes lus (compétence `fiscalite-rdc`)

- `tva/references/03-territorialite-fait-generateur-exigibilite.md` ·
  art. 24 (fait générateur), 25 (exigibilité), 26 (débits).
- `tva/references/12-decret-011-42-fait-generateur-exigibilite.md` ·
  art. 51 à 63 (dont 52 transfert du pouvoir de disposer, 53 et 54
  conditions, 57 encaissement, 61 et 62 débits).
- Imputation des paiements · recherche dans tout le corpus (voir plus bas).

## Fait

(rempli à chaque étape)

## Reste

- F1 · groupe à plusieurs factures.
- Sept hypothèses tues (TU 1 à 7).
- Vocabulaire (`FAIT_GENERATEUR`, « pas due », aide du paramètre).
- Bloc § 3, rejeu sur vraie base à travers la clôture 2026.

## Décisions

(rempli à chaque étape, avec l'article)

## Questions que le corpus ne tranche pas

(rempli à chaque étape)

## Vérification

```bash
npx tsc --noEmit && npx jest --maxWorkers=2 src/modules/tva
(cd client && npx tsc --noEmit && npm test)
```
