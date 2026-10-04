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

- F1 · groupe de lettrage à plusieurs factures (`groupeAPlusieursFactures`,
  `facturesDuGroupe`, `fractionsDuGroupe`, `repartirLibresEntreLignes`,
  passe de fin `resoudreGroupes` dans `declaration`). Même composition ·
  tranche par encaissement, taxe du groupe répartie dans le temps comme un
  tout (figé et ancien moteur respectés). Composition différente · règle de
  `main` gardée, groupe NOMMÉ (`groupesImputationIndeterminee`,
  `tvaEnAttenteImputationIndeterminee`, phrase de `mentionExigibilite`).
  Écran · « pas encore exigible », plus « pas encore encaissée ».
  `tva-groupes-comme-main.spec.ts` mis à jour cas par cas (`RENDU_ATTENDU`).

## Reste

- F1 · groupe à plusieurs factures.
- Sept hypothèses tues (TU 1 à 7).
- Vocabulaire (`FAIT_GENERATEUR`, « pas due », aide du paramètre).
- Bloc § 3, rejeu sur vraie base à travers la clôture 2026.

## Décisions

- F1 · O.-L. n° 10/001, art. 25, 2° ; décret n° 011/42, art. 57 (« la
  perception des sommes à quelque titre que ce soit »). Même composition ·
  toute imputation rend la même taxe à chaque encaissement, donc rien n'est
  choisi.

## Questions que le corpus ne tranche pas

- IMPUTATION DES PAIEMENTS · quelle facture une somme partielle paie.
  Cherché dans tout le corpus (fiscalite-rdc TVA et code général 2026,
  AUDCG livres 1 à 9, AUS, droit-foncier-rdc, ouvrages bancaires) · aucune
  règle du droit congolais. Seules occurrences · AUS (sommes reçues au
  titre d'une sûreté imputées sur la créance garantie), un ouvrage bancaire
  français citant le Code civil français (art. 1343-1), hors champ. Le Code
  civil congolais des obligations (livre III) n'est pas au corpus. Aucune
  règle choisie · le cas « même composition » ne dépend d'aucune imputation,
  les autres groupes sont nommés.

## Vérification

```bash
npx tsc --noEmit && npx jest --maxWorkers=2 src/modules/tva
(cd client && npx tsc --noEmit && npm test)
```
