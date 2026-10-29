# Avancement · ligne paie-suite

Gel levé par Manasse le 2026-10-29 (`docs/plan-gel-leve-2026-10-29.md`,
§ 1 à 4). Branche de sauvegarde `travail/paie-suite`, partie d'`origin/main`
(92c8b5810). Fiche retirée à l'intégration.

## Périmètre

76 (compte individuel du salarié sous le 422), 81 (alertes datées · fin
d'essai, fin de CDD, plafond de l'art. 41), 82 (import du personnel depuis
Excel), 87 (rappel de salaires), 89 (fiche individuelle et cumuls annuels,
Excel), départements et directions, visa d'un plan d'étalement.

## Fait

- [x] Visa d'un plan d'étalement · `personnel/visa-plan-etalement.ts`,
      option `Tenant.visaPlansEtalement` (défaut faux), traces
      `AvanceSalaire.planSaisiPar/Le`, `planVisePar/Le`, route
      `POST /personnel/avances/:id/viser-plan` (réservée au comptable),
      la simulation dit le plan non visé et ne le propose pas.

## Reste

- [x] 81 · plafond de l'art. 41 (al. 1er) dans l'échéancier des contrats, de date à date (`plafondDureeCdd`, partagé avec le contrôle). Fin d'essai et fin de CDD y étaient déjà (microfina-m3).
- [x] Départements et directions · `personnel/organigramme.ts`, tables `UniteOrganisation` (arbre libre, niveau nommé par le dossier, section analytique proposée, sommeil) et `RattachementUnite` (daté, annulable avec motif), onglet Organigramme, section de l'unité préremplie dans la répartition analytique.
- [x] 89 · fiche individuelle et cumuls annuels par rubrique · `personnel/fiche-individuelle.ts` (moteur pur), `fiche-individuelle-excel.ts` (deux feuilles), routes `GET /personnel/salaries/:id/fiche-individuelle[/excel]?annee=`, onglet Fiche individuelle. Bulletins émis seuls, au mois de paie, rubrique du cabinet sinon nature, francs figés.
- [ ] 82 · import du personnel.
- [ ] 87 · rappel de salaires.
- [ ] 76 · compte individuel du salarié.
- [ ] Rejeu sur vraie base à travers une clôture, relecture en deux tours.

## Décisions prises, avec leur fondement

- Visa du plan · OPTION du dossier, désactivée par défaut, comme le visa des
  RIB · aucun texte lu ne l'impose (Code du travail, art. 112, qui ne fixe
  ni durée ni échéance ; AUDCIF art. 69 ; SYCEBNL art. 16, 2)). Le visa ne
  joue qu'à la PROPOSITION de la retenue au bulletin, jamais un refus · la
  retenue saisie à la main reste celle que la saisie porte
  (avances-salaire.ts, « proposée, jamais substituée »).
- Organigramme · aucun texte ne fixe l'organisation interne (Code du travail,
  art. 212, ne demande au contrat que la nature du travail et ses lieux
  d'exécution ; le plan du 2026-10-29 écrivait « l'emploi occupé », corrigé
  au texte). La section d'une unité doit être une section Détail active d'un
  plan qui ventile la classe 6 · sinon la répartition de la paie la
  refuserait au moment où on suit la proposition.

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
bash <scratchpad>/paie-suite/diff.sh   # prisma migrate diff, base jetable
```
