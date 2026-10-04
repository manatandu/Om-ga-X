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
- TU 1 à 7 (`tva-24-26-hypotheses.spec.ts`) · TU 1 livraison datée à sa
  facture, TU 4 livraison à soi-même, TU 5 location-vente (commentaire
  corrigé), TU 2 acompte imputé sans sa date · NOMMÉS avec montant dans
  `mentionExigibilite` ; TU 2 corrigé quand le 419 est lettré (la taxe prend
  la date de l'acompte, testé), sinon nommé avec l'issue ; TU 3 chèque,
  virement, affacturage et TU 6 conditions suspensive et résolutoire dans la
  mention générale (et le hors-scope) ; TU 7 commentaire du repli corrigé.
- Vocabulaire · `FAIT_GENERATEUR` devient `DATE_ECRITURE` (commentaire art.
  24, 25, 26) ; « due » devient « exigible » dans `DeclarationTvaPage.tsx` et
  `ParametresDossierPage.tsx` ; aide du paramètre corrigée (au SYSCOHADA la
  nature lue à la contrepartie commande, repli seulement) ; gelé par
  `client/src/pages/vocabulaire-exigibilite-tva.spec.ts`.
- Bloc § 3 passé (serveur · tsc, jest 756 suites et 10 791 tests, build ;
  client · tsc, vitest 223 fichiers et 1 813 tests, build).
- Rejeu sur VRAIE base (`scratchpad/tva2426-rejeu.mjs`, grappe 55439, base
  `tva2426_1`, serveur compilé sur 8117), SYSCOHADA et SYCEBNL (ce dernier
  aux encaissements), à travers la clôture de 2026 · novembre 160 000
  (acompte lettré), décembre 68 965,52 (F1), attente 251 034,48, report au
  443 de -251 034,48, janvier 2027 331 034,48 (solde F1 F2 251 034,48 +
  acompte non lettré 80 000, nommé), 443 soldé, décembre relu 68 965,52.
  DÉFAUT TROUVÉ ET CORRIGÉ · le groupe partiel de 2026 ne voyait pas le
  solde de 2027, lettré avec les lignes d'à-nouveau (janvier rendait 80 000)
  · `prolongerParLesANouveaux`, gelé dans `tva-groupes-comme-main.spec.ts`.

## Reste

- Relecture (silent-failure-hunter, typescript-reviewer, react-reviewer).

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
