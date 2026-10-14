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

### N° 68 · créer les biens depuis les écritures déjà passées (commit « Immobilisations · créer les biens depuis les écritures »)

- `GET /immobilisations/ecritures-a-transformer` · les lignes au DÉBIT d'un
  compte de bien (21 à 24, et 20 au SYCEBNL, `estCompteDeBien`), d'écritures
  VALIDÉES d'un exercice OUVERT, hors clôture et hors à-nouveau provisoire,
  qu'aucune fiche ne porte, les plus récentes d'abord, bornées à 200 avec
  `total` et `tronque` ; chaque ligne dit ce qui la refuse
  (`motifRefusLigneACreer`).
- `POST /immobilisations/depuis-ecriture` (`@Roles` admin et comptable,
  comme la création) · la fiche naît par `ImmobilisationService.creer`
  (mêmes contrôles, `preparerFiche`), compte, valeur, date et journal lus sur
  la ligne, AUCUNE écriture passée (`interne.ecritureExistante`) ; la fiche
  RETIENT l'écriture (`ecritureAcquisitionId`, devenu non unique · une pièce
  de plusieurs biens fait plusieurs fiches) et sa LIGNE
  (`Immobilisation.ligneAcquisitionId`, unique, RESTRICT, migration
  `20270174010000_biens_depuis_les_ecritures`). Désignation reprise du
  libellé, mise en service jamais posée d'office (l'écran propose la date de
  la pièce), réserve de propriété déduite d'une dette au 4816 de la pièce.
- Refus nommés · ligne déjà rattachée (une ligne, un bien ; l'unicité
  tranche une course en 409), brouillard, exercice clôturé ou à-nouveau
  (renvoi au bien repris), crédit, compte hors des comptes de bien, en-cours
  (2x9), écriture que le module a passée ou qu'un autre module tient, pièce
  de PLUSIEURS biens qui crédite un FONDS (la reprise du fonds lit les lignes
  de l'écriture d'acquisition et ne se répartirait pas · issue nommée,
  corriger la pièce en une pièce par bien).
- Avec le n° 66 · la fiche née d'une écriture déjà passée ne retouche ni
  valeur, ni compte, ni date (motif avec l'issue · la retirer et la recréer
  depuis la ligne tant que rien ne l'a lue, sinon révision du plan ou
  reclassement) ; elle SE RETIRE sans toucher l'écriture, validée et même
  lettrée, tant qu'aucun usage, aucune écriture du module et aucun exercice
  clôturé ne la retient · la ligne revient à la liste.
- La correction d'une écriture dont une fiche est née nomme l'issue
  (retirer la fiche, corriger, recréer depuis la ligne exacte).
- Écran · « Créer depuis les écritures » à côté de « Nouvelle
  immobilisation » (`peutEcrire`), fenêtre en `PortailModale`
  (`CreationDepuisEcritures.tsx`, `lib/creation-depuis-ecritures.ts`),
  motif de chaque ligne refusée, formulaire désignation, inventaire, mise en
  service, durée, mode ; la fiche dit « Née de l'écriture déjà passée » et
  offre « Retirer la fiche ».
- Le test navigateur du n° 66 visait le second bien par son rang · deux biens
  acquis le même jour n'ont pas d'ordre garanti (tri par date
  d'acquisition), il le vise désormais par sa désignation.

### N° 73 · renumérotation et maintenance du registre (commit « Immobilisations · renumérotation et maintenance du registre »)

- RENUMÉROTATION · `GET /immobilisations/renumerotation` (aperçu, rien
  d'écrit, 200 changements servis avec `tronque`) et `POST` (administrateur
  seul, geste de structure) · préfixe, premier numéro, largeur, ordre
  (acquisition, ou compte puis acquisition, la saisie départageant deux biens
  du même jour), périmètre (biens en service sans numéro, ou tous les biens en
  service). Le plan est REJOUÉ sous un verrou par dossier
  (`pg_advisory_xact_lock`), jamais reçu de l'écran ; une mise à jour
  UNITAIRE par fiche (journal d'audit), aucune pour une fiche déjà à son
  numéro. Un bien SORTI garde son numéro (il figure sous lui aux états des
  exercices qui l'ont vu) et ce numéro compte pour l'unicité · un numéro
  nouveau déjà porté hors du périmètre est REFUSÉ, nommé, jamais contourné
  en sautant un rang. Refus nommés · largeur trop courte, préfixe illisible,
  périmètre vide, plus de 5 000 biens d'un geste.
- MAINTENANCE · `GET /immobilisations/maintenance?exerciceId=` · le registre
  (relu par `tableauAmortissements`, le calcul de l'état et de la dotation,
  jamais un second) face à la balance de l'exercice (brouillard compris),
  compte par compte · comptes de biens (au compte où le bien est inscrit à la
  clôture) et comptes d'amortissement (cumul COMPTABILISÉ · la dotation de
  l'exercice pas encore passée est dite à part, jamais lue comme un écart).
  Un bien sorti dans l'exercice a quitté ses comptes. Chaque compte de bien
  dit ses lignes au débit sans fiche dans l'exercice (le filtre même du
  n° 68). Nommés aussi · les biens reclassés après la clôture (le tableau les
  range sous leur compte actuel), les numéros d'inventaire en double, les
  biens en service sans numéro. Rien n'est corrigé.
- Écran · onglet Opérations de la fenêtre Immobilisations (le registre
  entier, jamais un bien) · tableau « Registre et balance », formulaire
  « Renumérotation des biens » (aperçu puis « Renuméroter », `estAdmin`).
- FUSION NON LIVRÉE, PAR LA LOI · voir les décisions.

### N° 18 · assistant de création d'un bien (commit « Immobilisations · assistant de création d'un bien »)

- Bouton « Assistant » de l'onglet Biens (`peutEcrire`), fenêtre en
  `PortailModale` (`AssistantCreationBien.tsx`) · huit étapes
  (Désignation, Compte, Origine, Dates, Valeur, Financement, Amortissement,
  Récapitulatif), le financement sauté pour un bien repris. Chaque étape ne
  dit que ce qui lui MANQUE pour avancer (`manqueDeLEtape`) ; on revient sur
  une étape franchie, on n'en saute aucune.
- AUCUNE ROUTE NI RÈGLE À LUI · le corps est celui du formulaire
  (`corpsCreationBien`, `lib/assistant-bien.ts`), envoyé à
  `POST /immobilisations`, jugé par les mêmes contrôles (`preparerFiche`) ;
  le refus du serveur se dit au récapitulatif. Les listes sont celles du
  formulaire (comptes du bien personnalisés, financements admis par le
  compte, journaux, lieux, barème avec l'avertissement d'écart).
- Création enchaînée · « Créer un autre bien » repart de la première étape en
  gardant compte, nature, lieu, dates, financement et plan, et vide
  désignation, numéro et valeurs (convention d'OmegaX, dite dans l'aide).
- Les cas qui demandent plus qu'une fiche ordinaire (composant,
  location-acquisition, incorporel à durée non limitée, frais de
  développement, bien inscrit en cours) restent au formulaire complet, et
  l'aide le dit.

### Relecture des échecs silencieux de la ligne (commit « Immobilisations · un échec de lecture n'est pas une liste vide »)

- Onglet Général de la fiche (n° 66) · un échec de lecture des financements
  admis vidait la liste, qui disait alors « aucun compte de financement
  personnalisé » à côté de l'erreur ; elle reste désormais NON LUE (`null`).
  Le barème fiscal illisible le dit sous la liste des natures, au lieu de
  rendre une liste vide sans un mot (CLAUDE.md § 9 ter, « null n'est pas
  vide »). Même règle posée dans l'assistant (n° 18).

## Reste

- Rien de la liste. La fusion des fiches d'un autre dossier du groupe (n° 73)
  attend la réponse de Manasse (voir les questions).

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

- N° 68 · une ligne, une fiche (décision de la ligne) · `ligneAcquisitionId`
  porte UNE ligne ; un bien dont le coût est réparti sur plusieurs lignes du
  même compte se corrige d'abord au journal (AUDCIF art. 20, al. 2), dit dans
  l'aide. Lecture de D7 pour la fiche née d'une écriture déjà passée · D7
  interdit la suppression d'une fiche qui retient une écriture parce que
  l'écriture lui DOIT son existence ; ici elle était au journal avant la
  fiche et y reste intacte, le retrait ne défait que le lien (rien n'est
  écrit ni retiré du livre-journal, art. 22, 2°). Sans ce retrait, une ligne
  choisie par erreur enfermait le bien. Un exercice clôturé, un usage ou une
  écriture du module le refusent comme pour toute fiche.

- N° 73 · LA FUSION DES FICHES D'UN AUTRE DOSSIER DU GROUPE N'EST PAS
  LIVRÉE. Le siège et l'établissement sont une seule entité tenue en
  plusieurs comptabilités · « toutes les opérations réalisées entre le siège
  et l'établissement y sont enregistrées comme s'il s'agissait d'un tiers
  […] de manière symétrique, dans la même période comptable et sur la base
  des mêmes pièces justificatives : les comptes de liaison sont égaux et de
  sens contraire dans les deux comptabilités » (AUDCIF, Titre VII, fiche du
  compte 18). Reprendre les fiches d'un autre dossier « en biens repris sans
  écriture » mettrait au registre du dossier qui reçoit des biens absents de
  sa balance (un bien repris est, par définition, au bilan d'ouverture, audit
  final F32) et les laisserait au dossier qui cède · deux registres pour un
  bien, aucune écriture de liaison. Au SYCEBNL, le 58 ne porte que les
  virements de trésorerie (fiche du compte 58, « mouvements de virement
  entre les comptes de trésorerie »), et aucun texte lu ne régit le
  transfert d'un bien entre deux dossiers d'une même association. Le
  transfert propre est une opération nouvelle (sortie chez l'un, entrée chez
  l'autre, par le compte de liaison des deux côtés), remontée en question.
- N° 73 · l'unicité des numéros d'inventaire est une convention d'OmegaX
  (code d'immobilisation de Sage) · aucun texte ne fixe la forme d'un
  numéro (AUDCIF art. 42 impose le recensement). Elle est tenue par la
  renumérotation et NOMMÉE par la maintenance, sans contrainte en base · une
  contrainte unique ferait échouer la migration d'un dossier qui porte déjà
  des doublons.

## Questions pour Manasse

- Aucune pour la n° 67 · le corpus tranche.
- N° 66 · une valeur d'acquisition VALIDÉE fausse ne se corrige par aucun
  geste d'OmegaX (D7 renvoie au reclassement et à la révision du plan, qui ne
  touchent pas la valeur) · faut-il ouvrir « Corriger l'entrée » (écriture
  d'acquisition inscrite en négatif puis exacte, AUDCIF art. 20, al. 2, tant
  qu'aucun traitement n'a lu la fiche) ? Aujourd'hui, la fiche le dit et rien
  n'est corrigé.

- N° 68 · lecture de D7 à confirmer · la fiche née d'une écriture déjà
  passée se RETIRE (l'écriture reste au journal), alors que D7 dit
  « suppression seulement sans écriture retenue ». Retenue, mais pas écrite
  par elle · voir les décisions.

- N° 73 · faut-il un TRANSFERT D'UN BIEN ENTRE DEUX DOSSIERS DU GROUPE
  (sortie chez le cédant, entrée chez le cessionnaire, par le compte de
  liaison des deux côtés, AUDCIF Titre VII, fiche du compte 18) ? C'est ce
  que serait une « fusion » propre ; au SYCEBNL aucun texte lu ne le régit.
  Non codé.

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

- `scenario-68.mjs` (SYSCOHADA, N 2026 puis N+1 2027) · trois pièces
  passées à la main (E1 camion 12 000 000 et ordinateurs 3 000 000 contre le
  4812, E2 remorque au brouillard, E3 deux biens contre le 1411), liste
  (E2 absente, E3 refusée « plusieurs biens et un fonds »), deux fiches nées
  de E1 sans écriture (nombre de pièces et 2451 à 15 000 000 inchangés),
  second geste sur la même ligne refusé, correction de E1 refusée avec
  l'issue, valeur figée et désignation libre, retrait des ordinateurs (E1
  intacte, la ligne revient), dotation de N 2 250 000 (9/12), fiche lue
  refusée au retrait, contrôles 15, 15 bis et réévaluation muets, clôture,
  ligne de N refusée (bien repris), dotation de N+1 3 000 000, 2451 de N+1 =
  14 000 000, 2845 = 5 250 000 créditeur.
- `scenario-68-fonds.mjs` (SYCEBNL) · ordinateurs reçus d'un organisme
  international (D 2442 / C 1417 3 000 000), fiche née de la ligne, dotation
  1 000 000, reprise du 14 proposée et passée à 1 000 000 en N puis en N+1
  (la subvention lue sur l'écriture dont la fiche est née), 1417 à
  1 000 000 créditeur et 2442 à 3 000 000 en N+1.

- `scenario-73.mjs` (SYSCOHADA, N 2026 puis N+1 2027) · trois biens par le
  module (camion 12 000 000, ordinateur 3 000 000 numéroté IMM-0001, moto
  800 000) et une remorque passée à la main (1 000 000) · maintenance de N
  (2451 au registre 12 800 000, à la balance 13 800 000, écart 1 000 000
  nommé par sa ligne sans fiche, 2441 concordant, trois dotations à passer
  pour 3 916 666,67 dites à part), dotation de l'ordinateur (2844
  concordant à 1 000 000), renumérotation « sans numéro » refusée sur
  IMM-0001 (porté par l'ordinateur) sans rien écrire, puis à partir de 2
  (camion IMM-0002), puis tout le parc en V-001 à V-003 dans l'ordre
  d'acquisition (au journal d'audit), doublon V-001 posé à la main et
  nommé sans correction, clôture, maintenance de N+1 (2451 reporté à
  13 800 000 contre 12 800 000, la ligne sans fiche restée dans N,
  amortissements concordants, trois dotations de N+1 à passer).

- `scenario-18.mjs` (SYCEBNL) · le corps de l'assistant pour un bien acquis
  (serveur 4 800 000, 2442 porté par l'écriture du module, dotation de N
  900 000 à 9/12), clôture, puis un bien repris en N+1 (aucune écriture,
  dotation 500 000 sur le reste de 1 000 000), 2442 reporté à 4 800 000.
  Le test navigateur `sage-l4-assistant` parcourt les huit étapes, crée le
  bien (2451 à 8 000 000), enchaîne un second en « repris » acquis dans
  l'exercice, que le serveur refuse au récapitulatif sans rien créer.

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

- N° 68 · serveur `tsc` 0 erreur, `nest build` vert, `prisma migrate diff`
  sans écart ; jest ciblé sur l'arbre du commit (99 suites, 1856 tests ·
  `src/modules/immobilisations`, les specs touchées de `comptabilite` et
  `lettrage`, `cloisonnement`, `fonctions`, `audit`, `suppression`,
  `exploitation`, `cadratins`, `ecritures-reservees`, `exercice-requis`,
  `fichiers-sans-appelant`, `lecture-bornee`, et les specs de structure du
  client) tout vert ; client `tsc` 0 erreur, vitest 255 fichiers et 2027
  tests, `vite build` vert ; e2e
  `sage-l4-depuis-ecritures`, `sage-l4-fiche`, `sage-l4-annulation` et les
  29 parcours de `immobilisations.e2e.ts` verts sous Chromium.

- N° 73 · serveur `tsc` 0 erreur, `nest build` vert ; jest ciblé sur
  l'arbre du commit (125 suites, 2090 tests · `src/modules/immobilisations`,
  `src/common`, `src/modules/comptes`, `casse-en-silence`, `ecriture-masquee`,
  `maintenance-immobilisations`) · une suite tombée, `comptes-proposes`, la
  route de maintenance lisant des comptes sans être rangée ; rangée parmi les
  routes qui ne servent pas de liste (`listes-de-comptes.ts`), puis
  `comptes-proposes` et `comptes-retenus-ecrans` relancés verts ; client
  `tsc` 0 erreur, vitest des specs de structure et de la ligne verts,
  `vite build` vert ; e2e `sage-l4-maintenance` vert sous Chromium.

- N° 18 · client `tsc` 0 erreur, vitest complet 257 fichiers et 2037 tests (dont
  `assistant-bien.spec.ts`, `ecriture-masquee`, `modales-dans-l-ecran`,
  `titres-formels`), `vite build` vert ; les cinq e2e de la ligne
  (`sage-l4-annulation`, `-fiche`, `-depuis-ecritures`, `-maintenance`,
  `-assistant`) verts sous Chromium sur le client construit de l'arbre final.
  Aucun code serveur. Un échec de lecture des financements admis se dit à
  côté de la liste, qui reste « non lue » (jamais « aucun financement
  admis »).

- ARBRE FINAL (commit « Immobilisations · un échec de lecture n'est pas une
  liste vide ») · serveur `tsc` 0 erreur, `nest build` vert, `prisma migrate
  diff` sans écart ; SUITE COMPLÈTE en six tranches · 850 suites, 12 460
  tests, tous verts (142 / 1 707, 142 / 1 978, 142 / 1 967, 142 / 2 526,
  141 / 1 945, 141 / 2 337) ; client `tsc` 0 erreur, vitest 257 fichiers et
  2 037 tests, `vite build` vert ; les cinq e2e de la ligne verts sous
  Chromium.

## Commandes de vérification

```bash
npx tsc --noEmit
for s in 1 2 3 4 5 6; do npx jest --shard=$s/6 --maxWorkers=1 --workerIdleMemoryLimit=800MB; done
npm run build
cd client && npx tsc --noEmit && npm test && npm run build
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$OMBRE" --exit-code
cd e2e && npx playwright test tests/sage-l4-annulation.e2e.ts tests/sage-l4-fiche.e2e.ts tests/sage-l4-depuis-ecritures.e2e.ts tests/sage-l4-maintenance.e2e.ts tests/sage-l4-assistant.e2e.ts
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

**Créer les biens depuis les écritures déjà passées (ligne sage-l4, n° 68).**
AUDCIF art. 20, 22, 2° et 35 (`immobilisations/creation-depuis-ecritures.ts`,
`CreationDepuisEcrituresService`) · la liste sert les lignes au débit d'un
compte de bien (21 à 24, et 20 au SYCEBNL), VALIDÉES, d'un exercice ouvert,
qu'aucune fiche ne porte, bornée avec `total` et `tronque`, chacune avec son
refus. La fiche naît par `ImmobilisationService.creer` (mêmes contrôles),
compte, valeur, date et journal lus sur la LIGNE, SANS ÉCRITURE NOUVELLE
(une seconde doublerait le brut sur une balance bouclée) · elle retient
l'écriture (`ecritureAcquisitionId`, non unique, une pièce de plusieurs
biens fait plusieurs fiches) et sa ligne (`ligneAcquisitionId`, unique,
RESTRICT). Une ligne, un bien ; refus · brouillard, exercice clôturé ou
à-nouveau (bien repris), crédit, compte hors bien, en-cours, écriture du
module ou tenue par un autre module, pièce de plusieurs biens qui crédite un
FONDS (reprise non répartissable). Mise en service jamais posée d'office.
Une telle fiche ne retouche ni valeur, ni compte, ni date, et SE RETIRE sans
toucher l'écriture tant que rien ne la lit (lecture de D7) ; la correction de
l'écriture nomme cette issue.

**Renumérotation et maintenance du registre (ligne sage-l4, n° 73).**
`immobilisations/maintenance-immobilisations.ts`, `MaintenanceImmobilisationsService`
· la renumérotation n'écrit que des numéros d'inventaire (aperçu, puis
confirmation par l'administrateur), plan REJOUÉ sous un verrou par dossier,
une mise à jour unitaire par fiche (journal d'audit) ; un bien SORTI garde
son numéro et le compte pour l'unicité, une collision est refusée et
nommée. Unicité · convention d'OmegaX, tenue par la renumérotation et nommée
par la maintenance, aucune contrainte en base. La maintenance LIT ·
registre relu par `tableauAmortissements` contre la balance de l'exercice,
compte par compte, brut au compte inscrit à la clôture, amortissement au
cumul COMPTABILISÉ (dotation non passée dite à part), lignes sans fiche par
le filtre du n° 68, reclassés après la clôture, doublons et biens sans
numéro nommés · rien n'est corrigé. LA FUSION D'UN AUTRE DOSSIER DU GROUPE
N'EST PAS SERVIE (AUDCIF, fiche du compte 18 · opérations symétriques par
les comptes de liaison ; un bien « repris sans écriture » chez l'un resterait
chez l'autre).

**Assistant de création d'un bien (ligne sage-l4, n° 18).**
`client/src/lib/assistant-bien.ts`, `AssistantCreationBien.tsx` · huit
étapes sur le CORPS DU FORMULAIRE, envoyé à `POST /immobilisations` · aucune
route ni règle à lui, le refus du serveur dit au récapitulatif. Une étape ne
dit que ce qui lui manque ; un bien repris saute le financement. Création
enchaînée · la série garde compte, nature, lieu, dates, financement et plan,
vide désignation, numéro et valeurs. Composant, location-acquisition,
incorporel non limité, frais de développement et bien en cours restent au
formulaire complet.

## Pour build-log.md

- n° 67 · 2026-10-14 · fait · rien ne manque au périmètre ; plus dur que
  prévu · les dépendances entre actes d'un même bien (qui a lu quoi), et le
  contrôle 15 bis qui disait « hors module » l'origine annulée, vu sur vraie
  base seulement.
- n° 66 · 2026-10-14 · fait · manque la correction d'une valeur
  d'acquisition déjà VALIDÉE (question posée) ; plus dur que prévu · ne
  réécrire aucun contrôle de la création, d'où la scission de `creer` en
  `preparerFiche`.
- n° 68 · 2026-10-14 · fait · manque un bien réparti sur plusieurs lignes
  (une ligne, une fiche · corriger la pièce) ; plus dur que prévu · le lien
  d'acquisition était UNIQUE (une pièce, un bien), et la fiche née d'une
  écriture déjà passée devait se retirer sans la toucher.
- n° 73 · 2026-10-14 · partiel · renumérotation et maintenance faites ; la
  fusion des fiches d'un autre dossier du groupe n'est pas servie (la loi
  la veut symétrique par les comptes de liaison, question posée) ; plus dur
  que prévu · lire un écart sans en fabriquer (dotation non passée, bien
  sorti, reclassement postérieur).
- n° 18 · 2026-10-14 · fait · rien ne manque au périmètre (les cas
  particuliers restent au formulaire, dit) ; plus dur que prévu · ne rien
  dupliquer du formulaire, d'où le corps sorti dans `lib/assistant-bien.ts`.
