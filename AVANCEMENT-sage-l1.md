# Ligne sage-l1 · journaux et saisie

Copie `/home/user/wt-sage-l1`, branche de sauvegarde `travail/sage-l1`.
Migrations `20270171hhmmss_…`, base jetable `omegax_sage_l1` (ombre
`omegax_sage_l1_ombre`), serveur 8081, client 4181, tests navigateur
`e2e/tests/sage-l1-*.e2e.ts`.

Fonctions, dans l'ordre (numéros de `docs/comparaison-sage/15-absents-a-trier.md`) ·
#12, #11, #60, #16, #14, #19, #18.

## Fait

### #12 · Journal de situation ni clôturable ni compactable (M1-77 p. 19, M2-70 p. 56)

CONSTAT AVANT CORRECTION · défaut silencieux. Une écriture saisie dans un
journal de type Situation naissait au BROUILLARD, comme toute autre · elle
entrait à la balance de travail, au grand livre, au journal, et surtout
(1) elle bloquait la clôture annuelle (brouillard refusé) ou (2), validée,
entrait au livre-journal, aux états financiers et au report à-nouveau de N+1,
balance bouclée. Le journal se clôturait comme les autres, et prenait la
numérotation continue du fichier.

DÉCISION PAR LA LOI (D-L1-12, 2026-10-14) · AUDCIF art. 19 (le livre-journal
reçoit les mouvements de l'exercice ; grand-livre et balance en sont tirés),
art. 16 al. 2 et art. 17, 3° (opération par opération, pièce justificative),
art. 22, 2° (la validation fait entrer la donnée au livre-journal, de façon
irréversible) et 3° (la clôture informatique porte sur la chronologie des
opérations). Une écriture de situation n'enregistre AUCUNE opération · elle
n'est pas un mouvement de l'exercice et n'entre jamais au livre-journal.
Donc · elle ne se valide pas, n'est pas un brouillard, aucun livre ni état ne
la lit, son journal ne se clôture pas (partielle et totale refusées, la
clôture de période ne le fige pas). OmegaX ne compacte rien. Elle se lit dans
SON journal (journal filtré sur lui) · le choix « inclure les journaux de
situation » d'une édition Sage n'est pas repris.

CODÉ ·
- statut `SITUATION` (`StatutEcriture`), migrations
  `20270171000000_ecritures_de_situation` (valeur d'énumération) et
  `20270171000001_ecritures_de_situation_reprises` (le brouillard déjà saisi
  dans un journal de situation y passe ; le VALIDÉ hérité n'est jamais
  retouché, il est nommé) ;
- `comptabilite/ecritures-de-situation.ts` · décision, `HORS_SITUATION`,
  `filtreDuStatut`, `statutDeNaissance`, `libelleDuStatut`, messages ;
- `common/journal-de-situation/extension-journal-de-situation.ts` ·
  l'invariant « statut SITUATION si et seulement si journal de situation »
  tenu sur le client Prisma (entre périmètre des journaux et audit) · un
  module qui passerait une écriture dans un journal de situation est refusé ;
- la saisie seule (POST /ecritures, `creer(…, { saisie: true })`) écrit dans
  un journal de situation ; `valider` refuse en nommant la pièce ;
  `corrigerParInscriptionEnNegatif` refuse ; `reimputer` la change en place ;
  `supprimer` la retire comme un brouillard ;
- lectures · balance (trois colonnes), balance cumulée, grand livre (écran,
  complet, exports à plat et FPM), journal (sauf filtré sur son journal),
  justificatif, échéancier, balance âgée, évolution des soldes, palmarès,
  lettrage (refusé), pointage (refusé), contrôles, test des écritures de
  journal, monnaie fonctionnelle, règlements, analytique, groupe,
  réévaluation des devises, déclaration des à-nouveaux en devise, créances
  douteuses, coûts d'emprunt, rente, subvention rattachée ;
- clôture annuelle et aperçu de l'ouverture suivante · report lu
  `...HORS_SITUATION` ; le décompte du brouillard ne compte que BROUILLARD ;
- clôtures partielle et totale refusées ; gel de période ignoré pour ce
  journal (`motifLigneFigee`, `lignesFigees`) ;
- numérotation · `modeEffectif` (un journal de situation en continu fichier
  numérote sur lui seul), la séquence du fichier ne lit jamais son maximum,
  `CONTINUE_FICHIER` refusé à la création et à la modification ;
- état des journaux de saisie · case `SITUATION` (« S ») ; contrôle
  `JOURNAL_DE_SITUATION_AU_LIVRE_JOURNAL` (avertissement, hérité validé,
  relevé pendant le parcours des écritures, sans seconde lecture) ; A13 ne
  réclame aucune clôture de période à ce journal ;
- écran · statut `SITUATION` côté client, marque « S » en saisie, « Situation »
  au journal (sans bouton Corriger), légende de l'état des journaux, bulle des
  Codes journaux, refus dit de la numérotation du fichier.

Test qui gèle la règle · `src/modules/comptabilite/ecritures-de-situation.spec.ts`
(et `report-periode-close.spec.ts`, la période ne vise pas ce journal).

Fichiers d'autres lignes touchés au strict nécessaire (une lecture chacun,
`...HORS_SITUATION`) · `immobilisations/immobilisation.service.ts` (coûts
d'emprunt, rente), `immobilisations/subvention-rattachee.service.ts` (L4) ·
à surveiller à l'intégration.

Scénario sur vraie base (2026-10-14, serveur compilé, port 8081, base
`omegax_sage_l1`), SYSCOHADA et SYCEBNL, 0 écart · journal SIT en
numérotation du fichier refusé ; simulation de 300 000 née SITUATION ; banque
1 000 000 à la balance de travail et au livre-journal (la simulation exclue),
605 à 0, grand livre de la banque à une ligne, journal sans filtre sans elle,
filtré sur SIT avec elle ; valider refusé, valider-jusqu'à la laisse
SITUATION ; correction en négatif, clôtures partielle et totale refusées ;
période close au 30 juin · saisie de mai admise dans SIT, refusée dans OD ;
grille · avril et mai « SITUATION » ; aucun avertissement ; CLÔTURE de N ·
report de N+1 banque 1 000 000, 605 à 0, 13 à 1 000 000 créditeur ;
simulation de N+1 née SITUATION, balance inchangée ; modification d'une
simulation de l'exercice clos refusée ; suppression admise. Hérité · une
écriture validée dans SIT (posée en base) est nommée en AVERTISSEMENT, reste
au livre-journal, sa correction en négatif est refusée (elle se saisit dans
un journal ordinaire).

## Reste

- #12 · e2e `sage-l1-situation` écrit, à jouer avec le montage local.
- #11, #60, #16, #14, #19, #18.
- Bloc du § 3 des deux côtés ; specs de structure.

## Décisions

- D-L1-12 (ci-dessus), par la loi.

## Commandes de vérification

```bash
NODE_OPTIONS=--max-old-space-size=3072 npx tsc --noEmit
for s in 1 2 3 4 5 6; do npx jest --shard=$s/6 --maxWorkers=1 --workerIdleMemoryLimit=800MB; done
NODE_OPTIONS=--max-old-space-size=2048 npm run build
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://jetable:jetable@localhost:5432/omegax_sage_l1_ombre --exit-code
(cd client && npx tsc --noEmit && npm test && NODE_OPTIONS=--max-old-space-size=2048 npm run build)
```

## Pour CLAUDE.md

À intégrer au § 6 après « Journaux de saisie et historique des rappels » ·

**Journal de situation (ligne sage-l1, fonction 12, décision par la loi du
2026-10-14).** AUDCIF art. 19, 16 al. 2, 17 3°, 22 2° et 3° · une écriture de
situation n'enregistre aucune opération · statut `SITUATION`, ni brouillard ni
validée, jamais au livre-journal, à la balance, au grand livre, aux états, à la
clôture ni au report (`HORS_SITUATION`, `filtreDuStatut`). L'invariant « statut
SITUATION si et seulement si journal de situation » est tenu sur le client
Prisma (`extension-journal-de-situation.ts`) · seule la saisie y écrit.
Valider et corriger en négatif refusés ; journal non clôturable, non figé par
une clôture de période, hors de la numérotation du fichier (`modeEffectif`).
Le validé hérité n'est pas retouché, il est nommé
(`JOURNAL_DE_SITUATION_AU_LIVRE_JOURNAL`).

## Pour build-log.md

- 2026-10-14 · sage-l1 #12 · journal de situation · statut SITUATION, garde
  Prisma, lectures écartées, clôture et numérotation.
