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
- [x] 82 · import du personnel · `personnel/import-personnel.ts` (lecture des colonnes par leur nom, valeurs illisibles refusées, « 500.000 » ambigu), `import-personnel.service.ts` (chaque ligne jugée par `SalarieDto`, `ContratTravailDto`, la monnaie exigée et le matricule unique ; simulation, puis import tout ou rien rejouant la simulation), modèle Excel, onglet Import. Les colonnes écrites sont celles de la saisie (`champsDuSalarie`, `champsDuContrat`, extraits de `personnel.service.ts`).
- [x] 87 · rappel de salaires · `personnel/rappel-salaire.ts` (calcul proportionnel au salaire figé, exclusions nommées), `rappels-salaire.service.ts`, table `RappelSalaire` (calcul figé, porteur RESTRICT), routes de simulation, déclaration, annulation et « à payer » ; le bulletin d'un mois postérieur PORTE le rappel (`rappelsPortes`), un élément « Salaire ou traitement » par mois rappelé, lié à l'émission sous verrou. Onglet Rappels de salaire, bloc « Rappels de salaire à payer » de la simulation.
- [x] compte individuel du salarié sous le 422 (option du dossier, passation éclatée, paiement et reprise sur le compte où le net a été inscrit, ouverture au geste ou à la création)
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
- Rappel (87) · DÉCISION PAR LA LOI · les arriérés se paient sur le bulletin du
  mois où ils sont versés (Code du travail, art. 213, « à chaque paie » ;
  arrêté du 8 août 2008, mention 13, et arrêté n° 142/2018, art. 12,
  « arriérés de rémunération portés sous la rubrique divers ») · jamais un
  second bulletin d'un mois payé, que l'art. 119 de la loi n° 23/053
  annualiserait une seconde fois. Le « bulletin complémentaire » demandé
  devient un rappel calculé, porté par le bulletin du paiement. Calcul
  proportionnel (convention d'OmegaX, dite) · salaire figé × (nouvelle base −
  base figée) ÷ base figée. Baisse refusée (art. 112, liste fermée). Mois en
  dollars, mois sans bulletin, mois déjà rappelés · exclus et nommés.
Option désactivée par défaut · la fiche du compte 42 ne dit pas si le 422 se tient par salarié (subdivision admise, AUDCIF art. 18 al. 3 ; SYCEBNL Partie 2 ch. 2) ; le compte individuel met au journal le nom et le net de chacun. Reprise et paiement sur le compte de la passation (AUDCIF art. 20, al. 2).

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
bash <scratchpad>/paie-suite/diff.sh   # prisma migrate diff, base jetable
```
