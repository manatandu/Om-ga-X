# Ligne sage-l4 · immobilisations

Copie `/home/user/wt-sage-l4`, branche de sauvegarde `travail/sage-l4`.
Fonctions de `docs/comparaison-sage/15-absents-a-trier.md`, dans l'ordre ·
n° 67, 66, 68, 73, 18.

## Fait

### N° 67 · annuler une dotation ou un traitement (commit « Immobilisations · annuler une dotation ou un traitement »)

- Natures annulables · dotation, dépréciation (et reprise), révision du plan,
  dérogatoire (et solde), réévaluation, reprise de subvention, reprise de la
  provision spéciale. Route `POST /immobilisations/traitements/annulation`
  (`@Roles` admin et comptable, `@ReserveAuComptable`), lectures
  `GET /immobilisations/:id/traitements` et
  `GET /immobilisations/annulations-traitements` (bornée à 200, `total`,
  `tronque`).
- Au brouillard l'écriture est retirée (`deleteMany` filtré sur le statut,
  une ligne et une seule, sinon 409) ; validée elle est inscrite en négatif
  (`inscrireEnNegatifPourAnnulation`, art. 22, 4° pour une période close).
  L'acte quitte sa table (la fiche ne le porte plus), son instantané reste
  dans `AnnulationTraitementImmobilisation` (journal d'audit, motif, origine
  et négatif RETENUS, `detenteurs-ecriture.ts`).
- Refus · exercice clôturé ; acte postérieur du même bien qui a lu le
  résultat (table `DEPENDANTS` de `annulation-traitement.ts`, « annuler à
  partir du plus récent ») ; acte postérieur qui ne s'annule pas dans OmegaX
  (sortie, reclassement, transfert de dépréciation, remplacement imprévu,
  réduction de subvention) nommé avec l'issue, écriture en négatif à la main ;
  ligne lettrée ou pointée ; transfert de mise en service ; révision posée par
  une réévaluation (elle part avec elle).
- La fiche est RENDUE · révision (durée d'avant, état du plan relu sur les
  révisions qui restent, reprise rétroactive retirée), réévaluation (brut
  d'avant, valeur résiduelle d'avant gardée sur la ligne,
  `LigneReevaluationBilan.valeurResiduelleAvant`, hausse du cumul retirée,
  révision de la méthode 2 retirée), dépréciation imputée sur l'écart
  (rendue à la dernière ligne entamée d'abord), reprise de la provision
  spéciale (rendue ligne à ligne).
- Contrôle 15 bis · l'écriture d'origine d'un traitement annulé n'est plus
  un « amortissement hors module » (trouvé sur vraie base).
- Écran · bouton « Fiche » sur chaque bien, fenêtre en `PortailModale`,
  onglet Traitements (liste servie par le serveur, motif de refus dit, bouton
  sous `peutValider`), historique des annulations.

## Reste

- N° 66 · modifier, supprimer ou dupliquer une fiche.
- N° 68 · créer les biens à partir des écritures déjà passées.
- N° 73 · fusion, renumérotation, maintenance.
- N° 18 · assistant de création d'un bien.

## Décisions prises, avec leur article

- L'annulation suit l'AUDCIF art. 20, al. 2 (« exclusivement par inscription
  en négatif ») et art. 22, 2° (rien ne se supprime après validation) · au
  brouillard, la pièce n'est pas au livre-journal et se retire.
- Exercice clôturé · refus, l'erreur relève du report à nouveau et des Notes
  annexes (art. 20, al. 3).
- L'acte annulé QUITTE sa table plutôt que d'y être marqué · dotations et
  dépréciations sont lues par plus de cinquante lecteurs, et un filtre oublié
  compterait deux fois (CLAUDE.md § 10 bis). L'instantané garde tout.

## Questions pour Manasse

- Aucune pour la n° 67 · le corpus tranche.

## Scénarios sur vraie base

- `scenario-67.mjs` (SYSCOHADA, N 2026 puis N+1 2027) · dotation de
  3 000 000 annulée au brouillard puis validée (négatif, 681 et 2845 nets à
  zéro, contrôle 15 bis muet), dépréciation qui bloque la dotation, clôture
  de N qui refuse l'annulation, révision prospective de N+1 (dotation
  1 500 000 sur six ans restants) annulée dans l'ordre et fiche revenue à
  quatre ans (dotation 3 000 000), 2845 de N+1 = report 3 000 000.
- `scenario-67-reevaluation.mjs` · réévaluation légale k' = 1,4 (2411 + 400,
  2841 − 160, 1061 − 240) annulée au brouillard puis validée, fiche rendue à
  1 000, réévaluation repassée, clôture, dotation de N+1 de 140 sur la valeur
  réévaluée.

## Bloc § 3

- N° 67 · serveur `tsc` 0 erreur, `nest build` vert ; jest ciblé sur l'arbre
  du commit (36 suites, dont `casse-en-silence`, `cloisonnement`,
  `lecture-bornee`, `ecritures-reservees`, `fonctions-metier`, `cadratins`,
  `reglement-interieur`, `index-du-dossier`, `titres-formels`,
  `modales-dans-l-ecran`, `ecriture-masquee`, `comptes-retenus-ecrans`,
  `montants`, et les specs de la ligne) tout vert ; client `tsc` 0 erreur,
  vitest 253 fichiers et 2014 tests verts, `vite build` vert ; e2e
  `sage-l4-annulation` vert sous Chromium. La suite complète en six tranches
  (une heure par tranche sur la machine partagée) tourne en arrière-plan ;
  son total est reporté ici à la fin de la ligne.

## Commandes de vérification

```bash
npx tsc --noEmit
for s in 1 2 3 4 5 6; do npx jest --shard=$s/6 --maxWorkers=1 --workerIdleMemoryLimit=800MB; done
npm run build
cd client && npx tsc --noEmit && npm test && npm run build
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$OMBRE" --exit-code
cd e2e && npx playwright test tests/sage-l4-annulation.e2e.ts
```

## Pour CLAUDE.md

**Annuler un traitement d'immobilisation (ligne sage-l4, n° 67).** AUDCIF
art. 20, al. 2 et 3, art. 22, 2° et 4° (`immobilisations/annulation-traitement.ts`,
`AnnulationTraitementService`) · dotation, dépréciation, révision du plan,
dérogatoire, réévaluation, reprises de subvention et de provision spéciale
s'annulent avec motif, depuis la fiche du bien (`POST
/immobilisations/traitements/annulation`, `@ReserveAuComptable`, `peutValider`).
Au brouillard l'écriture est retirée (`deleteMany` filtré sur le statut, une
ligne, sinon 409), validée elle est inscrite en négatif · l'ACTE QUITTE SA
TABLE (la fiche ne le porte plus, aucun des lecteurs n'a de filtre à oublier)
et son instantané reste dans `AnnulationTraitementImmobilisation` (journal
d'audit, origine et négatif RETENUS). Refus · exercice clôturé (report à
nouveau, al. 3), acte postérieur du même bien qui l'a lu (`DEPENDANTS`,
« annuler à partir du plus récent »), acte postérieur non annulable dans
OmegaX nommé avec son issue, ligne lettrée ou pointée, transfert de mise en
service, révision posée par une réévaluation. La fiche est RENDUE · durée et
état du plan relus sur les révisions qui restent, brut et valeur résiduelle
d'avant la réévaluation (`valeurResiduelleAvant`, gardée depuis cette ligne ;
une ancienne réévaluation sans elle et à valeur résiduelle non nulle refuse),
écart imputé rendu à la dernière ligne entamée, provision spéciale rendue
ligne à ligne. Le contrôle 15 bis écarte l'origine d'un traitement annulé.

## Pour build-log.md

- n° 67 · 2026-10-14 · fait · rien ne manque au périmètre ; plus dur que
  prévu · les dépendances entre actes d'un même bien (qui a lu quoi), et le
  contrôle 15 bis qui disait « hors module » l'origine annulée, vu sur vraie
  base seulement.
