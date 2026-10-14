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

### N° 66 · modifier, supprimer ou dupliquer une fiche (commit « Immobilisations · modifier, supprimer ou dupliquer une fiche »)

- `PATCH /immobilisations/:id`, `DELETE /immobilisations/:id`,
  `GET /immobilisations/:id/modification` (ce que la fiche admet, motifs
  servis), `GET /immobilisations/:id/duplication` (la copie proposée).
- Champs LIBRES (désignation, numéro d'inventaire, nature au barème) · à
  tout moment, bien sorti compris, mise à jour unitaire au journal d'audit.
- Champs À EFFET (compte, financement, dates, valeur, valeur résiduelle,
  durée, mode, unités, amortissement antérieur d'un repris) · seulement si
  l'écriture d'acquisition est au brouillard (ou absente, bien repris),
  l'exercice ouvert, aucun traitement n'a lu la fiche (usages lus dans le
  schéma, hors annulations), aucune autre écriture du bien, aucune origine
  particulière (legs, prix global, location-acquisition, prix aléatoire).
  Les contrôles sont ceux de la création · `creer` est scindé en
  `preparerFiche` (contrôles, sans écrire) et l'écriture, et la modification
  rejoue `preparerFiche` sur la fiche entière. L'écriture d'acquisition du
  brouillard est REMPLACÉE (nouvelle pièce au brouillard, l'ancienne retirée
  filtrée sur le statut, 409 si validée entre-temps, la nouvelle retirée en
  cas d'échec).
- Suppression · même condition sans écriture retenue · la fiche part avec son
  écriture du brouillard et ses annulations sans écriture ; refusée si une
  annulation garde son négatif, si un usage la retient, si l'écriture est
  validée (la sortie du bien nommée).
- Duplication · la copie (désignation « (copie) », compte, nature, lieu,
  valeur, durée, mode) remplit le formulaire de création, que le cabinet
  confirme · rien n'est écrit avant.
- Écran · onglet Général de la fiche (champs à effet figés avec le motif du
  serveur, boutons Dupliquer, Supprimer la fiche, Enregistrer sous
  `peutEcrire`), corps limité aux champs CHANGÉS (`lib/fiche-immobilisation.ts`).

## Reste

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
- N° 66 · décision D7 appliquée telle quelle (AUDCIF art. 20 et 22, 2°) ·
  une écriture d'acquisition VALIDÉE fige valeur, compte, dates et plan ; le
  compte se change alors par le reclassement, la durée et le mode par la
  révision du plan. Une annulation de traitement (n° 67) ne bloque pas la
  modification (origine et négatif se neutralisent) mais retient la fiche à
  la suppression (art. 22, 2°). Rôles · ceux de la création (administrateur,
  comptable).

## Questions pour Manasse

- Aucune pour la n° 67 · le corpus tranche.
- N° 66 · une valeur d'acquisition VALIDÉE fausse ne se corrige par aucun
  geste d'OmegaX (D7 renvoie au reclassement et à la révision du plan, qui ne
  touchent pas la valeur) · faut-il ouvrir « Corriger l'entrée » (écriture
  d'acquisition inscrite en négatif puis exacte, AUDCIF art. 20, al. 2, tant
  qu'aucun traitement n'a lu la fiche) ? Aujourd'hui, la fiche le dit et rien
  n'est corrigé.

## Relevés hors de la ligne

- La création d'une fiche admet une valeur résiduelle SUPÉRIEURE à la valeur
  d'origine (base amortissable ramenée à zéro, aucune dotation, « Aucun
  montant à doter ») · vu sur vraie base pendant le scénario n° 66. La
  modification rejoue les contrôles de la création, elle hérite donc de ce
  manque ; la règle (valeur résiduelle au plus égale à la valeur d'origine)
  est à poser dans `preparerFiche`, hors de cette ligne.

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
- `scenario-66.mjs` · bien à 12 000 000 au brouillard porté à 15 000 000 sur
  cinq ans (2451 et 5211 à 15 000 000, une seule pièce, au brouillard), date
  de mise en service antérieure refusée sans rien changer, dotation qui fige
  la valeur puis annulée (n° 67) qui la rouvre, suppression (2451 et 681
  vides, annulation sans écriture partie), validation qui fige et refuse la
  suppression, duplication confirmée par la création, clôture de N, bien
  repris de N+1 modifié avant dotation (dotation 2 000 000 sur le cumul
  modifié), 2451 de N+1 = 24 000 000.

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

- N° 66 · serveur `tsc` 0 erreur, `nest build` vert ; jest ciblé (22
  suites de structure et de la ligne, 518 tests) et toutes les specs de
  `src/modules/immobilisations` après la scission de `creer` (55 suites, 854
  tests) ; client `tsc` 0 erreur, vitest 254 fichiers et 2021 tests (dont
  `regle-par.spec.ts`, qui lit désormais la garde de la contrepartie dans
  `preparerFiche`), `vite build` vert ; e2e `sage-l4-fiche`, `sage-l4-annulation` et les 29 parcours
  de `immobilisations.e2e.ts` verts sous Chromium (la création scindée ne
  change rien sur vraie base).

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

**Modifier, supprimer ou dupliquer la fiche d'un bien (ligne sage-l4, n° 66,
décision D7).** AUDCIF art. 20 et 22, 2° (`immobilisations/fiche-immobilisation.ts`,
`FicheImmobilisationService`) · désignation, numéro d'inventaire et nature se
modifient à tout moment ; compte, financement, dates, valeur, plan seulement
si l'écriture d'acquisition est au brouillard (ou absente, repris), l'exercice
ouvert, aucun traitement n'a lu la fiche (usages lus dans le schéma, hors
annulations du n° 67) et aucune origine particulière (legs, prix global,
location-acquisition, prix aléatoire) ; sinon reclassement ou révision du
plan, motif servi par le serveur. LES CONTRÔLES SONT CEUX DE LA CRÉATION ·
`creer` scindé en `preparerFiche` (contrôles seuls) et l'écriture, rejoué sur
la fiche entière ; l'écriture d'acquisition du brouillard est REMPLACÉE
(l'ancienne retirée filtrée sur le statut, 409 si validée entre-temps, la
nouvelle retirée en cas d'échec), jamais une fiche à une valeur et un journal
à une autre. Suppression sans écriture retenue · la fiche part avec son
écriture du brouillard et ses annulations sans écriture. Duplication · la
copie servie (`GET :id/duplication`) remplit le formulaire de création, rien
n'est écrit avant la confirmation. L'écran n'envoie que les champs CHANGÉS
(`lib/fiche-immobilisation.ts`).

## Pour build-log.md

- n° 67 · 2026-10-14 · fait · rien ne manque au périmètre ; plus dur que
  prévu · les dépendances entre actes d'un même bien (qui a lu quoi), et le
  contrôle 15 bis qui disait « hors module » l'origine annulée, vu sur vraie
  base seulement.
- n° 66 · 2026-10-14 · fait · manque la correction d'une valeur
  d'acquisition déjà VALIDÉE (question posée) ; plus dur que prévu · ne
  réécrire aucun contrôle de la création, d'où la scission de `creer` en
  `preparerFiche`.
