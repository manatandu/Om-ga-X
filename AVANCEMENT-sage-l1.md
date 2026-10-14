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

### #11 · Masquer les totaux de la saisie (M1-82 p. 19)

Préférence DU POSTE (architecture, ligne 11), jamais une donnée du dossier ·
case « Masquer les totaux » dans l'en-tête du journal ouvert (Traitement >
Saisie des journaux), retenue sous `try/catch` (`client/src/lib/totaux-saisie.ts`,
clé `omegax.saisie.masquerTotaux`). Cochée, les lignes « Totaux journal » et
« Totaux pièce » se cachent ; l'état d'équilibre de la pièce (« Pièce
équilibrée », solde à débiter ou à créditer) reste TOUJOURS affiché, le
bouton d'enregistrement reste refusé à une pièce déséquilibrée, et le serveur
refuse toute écriture dont les débits ne valent pas les crédits. Aucune
écriture touchée · pas de scénario sur base. Choix assumé · Sage pose
l'option sur le code journal ; la ligne 11 de l'architecture la range en
préférence du poste, c'est elle qui est suivie. Tests ·
`client/src/lib/totaux-saisie.spec.ts`, e2e `sage-l1-totaux`.

### #60 · Journal marqué « imprimé » et refus de clôturer un journal non imprimé (M2-67, M3-29)

DÉCISION PAR LA LOI (D-L1-60, 2026-10-14, AUDCIF art. 22 lu dans la
compétence) · le 3° impose une clôture informatique « au moins
trimestrielle » et ne la subordonne à AUCUNE impression ; le 1° veut des
données qui « puissent être restituées sur papier ou sous une forme
directement intelligible » ; le 7° veut des « états périodiques fournis »
« numérotés et datés ». D'où · (1) l'impression du journal est ENREGISTRÉE
par le serveur, numérotée (suite continue par dossier, sous verrou du
dossier) et datée, avec son auteur, l'exercice, le journal (ou tous), la
période couverte et le nombre de pièces qu'il compte lui-même ; (2) le
refus de clôturer un journal non imprimé est une OPTION du dossier,
désactivée par défaut (`Tenant.refusClotureJournalNonImprime`, Paramètres du
dossier, administrateur seul), parce que l'imposer ferait d'une préférence
d'organisation une condition que la loi ne pose pas ; l'issue est immédiate,
imprimer le journal ; (3) une écriture VALIDÉE APRÈS l'impression rend sa
période non imprimée (dernière validation du jour contre l'heure de
l'impression qui le couvre). Une recherche (compte, montant, libellé, pièce,
référence) n'est pas le journal · ni imprimée ni enregistrée. Le journal de
situation (fonction 12) n'a rien à imprimer.

CODÉ ·
- `ImpressionJournal` (fin du schéma, `// Ligne sage-l1`), migration
  `20270171010000_impressions_journaux` (table, énumération
  `FormeImpressionJournal` IMPRESSION / EXPORT, colonne du dossier), au
  journal d'audit, cloisonnée, index du dossier, liens RESTRICT ;
- `journaux/impressions-journal.ts` · `moisNonImprimes` (regroupement en
  base par journal et jour, `_max.valideeAt`), `motifClotureNonImprimee`
  (mois nommés, vingt-quatre au plus et le total dit), `periodeCouverte`,
  `enregistrerImpression`, `estUneRecherche` ;
- `POST /impressions-journal` (impression de la fenêtre, refusée sur une
  recherche ou au-delà du plafond de la fenêtre, l'export rendant tout),
  `GET /impressions-journal` (liste bornée à 200, total, `tronque`) ;
- l'export Excel du journal entier s'enregistre en forme EXPORT après le
  dernier octet (un échec d'enregistrement est consigné, jamais l'export
  défait) ;
- clôtures partielle, totale, de période et annuelle refusent, sous
  l'option, tant qu'un jour validé n'est couvert par aucune impression
  postérieure ;
- état des journaux de saisie · case `NON_IMPRIME` (« N »), entre le
  brouillard et le validé imprimé ; « Non imprimé » n'est plus « non servi » ;
- écran · bouton « Imprimer le journal » (enregistre puis ouvre la boîte),
  option dans Paramètres du dossier avec sa bulle, légende de l'état.

Tests · `journaux/impressions-journal.spec.ts`, `etat-journaux-saisie.spec.ts`,
`client/src/lib/etat-journal-saisie.spec.ts` (six états), e2e
`sage-l1-impression`.

Scénario sur vraie base (2026-10-14, `l1-s60.mjs`, serveur compilé, port
8081), 0 écart · option posée ; février validé « N » ; clôture de période
refusée en nommant « OD 02/2026 » ; impression n° 1 (une pièce) → « J »,
clôture admise ; export du journal enregistré n° 2 EXPORT (deux pièces),
export d'une recherche non enregistré ; période à l'envers refusée ; mai
validé après l'export → « N » ; clôture annuelle refusée en nommant
« OD 05/2026 » ; impression n° 3 de l'exercice (trois pièces) → clôture
annuelle admise ; report N+1 banque 600 000 ; en N+1, clôture de période
refusée puis admise après impression ; option retirée, la clôture n'attend
plus.

### #16 · Changer à la main la prochaine lettre de lettrage (M3-19, p. 36)

Aucun texte ne régit le repère du lettrage · le CPCC (ch. 6) n'exige qu'« un
seul repère » par groupe, et c'est la seule règle tenue (`@@unique([compteId,
code])`, refusée en la nommant avant la base). Traitement > Interrogation et
lettrage · le champ « Lettre » à côté de « Lettrer la sélection » montre la
lettre proposée (la suivante du compte, servie par `GET
/comptes/:id/lettrage`, `prochaineLettre`) ; tapée, une autre lettre est
posée sur le lettrage manuel (`LettrerDto.lettre`). Une à quatre lettres
(la suite automatique n'en atteint une quatrième qu'au-delà de 18 278
groupes), rangée en majuscules (la minuscule n'est que l'affichage d'un
groupe partiel). Refus nommé · lettre déjà employée sur le compte, par un
groupe (soldé ou partiel) ou par des lignes lettrées sans groupe (dossiers
repris), avec la lettre proposée ; relue dans la transaction sérialisable.
La suite automatique repart après la plus haute lettre du compte · une
lettre libre plus basse (un trou) reste admise. Le lettrage automatique, le
pré-lettrage et les modules gardent la lettre proposée.

Code · `lettrage/lettre-choisie.ts`, `LettrageService.lettrerManuel`
(`refuserLettreEmployee`), `lister` (`prochaineLettre`), écran
`LettragePage`. Tests · `lettre-choisie.spec.ts` (forme, DTO, motif),
`lettrage.service.spec.ts` (six cas), `lettrage-fenetre-bornee.spec.ts`
(doublure qui honore le filtre des lignes lettrées), e2e `sage-l1-lettre`.

Scénario sur vraie base (2026-10-14, `l1-s16.mjs`), 0 écart · lettre
proposée A ; lettrage F1 en « k » → K soldé ; proposée L ; K refusée en
nommant le compte 40110001 et la lettre proposée ; « K2 » refusée (forme) ;
F2 sans choix → L ; clôture de N ; en N+1, la facture F3 par l'à-nouveau et
son avoir · K refusée (employée en N), B (trou) admise, proposée M ; compte
du tiers soldé.

### #14 · Créer un compte pendant la saisie (M10-17, p. 31)

Aucun texte ne régit le geste · l'AUDCIF art. 18, al. 3 (« peut ouvrir
toutes subdivisions nécessaires ») et, au SYCEBNL dont l'art. 3 écarte
l'art. 18, la Partie 2 ch. 2, section 1 laissent l'entité subdiviser. Règle
d'organisation d'OmegaX, la même que « Personnaliser » au Plan comptable
(décision de Manasse du 2026-10-09) · une OPTION du dossier, fermée par
défaut (`Tenant.creationCompteEnSaisie`, migration
`20270171020000_creation_compte_en_saisie`, Paramètres du dossier,
administrateur). Ouverte, un numéro tapé dans la grille et inconnu du
dossier offre « Créer le compte » ; la boîte (`ModaleCompteEnSaisie`) lit le
jugement du serveur (`GET /comptes/en-saisie/proposition`) · le compte du
plan qu'il subdivise et son intitulé repris, ou le motif. `POST
/comptes/en-saisie` (administrateur et comptable, l'aide-comptable par
héritage) rejuge et crée par `CompteService.creer` (longueur du dossier,
classe, réglages repris du compte du plan), DÉTAIL, né personnalisé ; la
grille le prend aussitôt, le cache de /comptes se vide (famille /comptes).
Refus nommés (`comptes/compte-en-saisie.ts`) · option fermée (403), numéro
existant, trop long, ne subdivisant aucun compte d'imputation du plan, compte
du plan absent, total ou en sommeil, et SOUS UN COLLECTIF DE TIERS (toute
panoplie, convention d'OmegaX · le compte d'un tiers naît avec sa fiche).
Ouvert, il subdivise le compte du plan, que la saisie refuse ensuite
(règle des comptes personnalisés, dite dans la bulle).

Tests · `comptes/compte-en-saisie.spec.ts` (motifs aux deux référentiels,
toutes les panoplies, service), `listes-de-comptes.ts` (route rangée), e2e
`sage-l1-compte-en-saisie`.

Scénario sur vraie base (2026-10-14, `l1-s14.mjs`), 0 écart · option fermée
→ 403 et proposition qui le dit ; ouverte, 60510005 proposé sous 60510000
« Fournitures non stockables - Eau » ; 40110009 refusé (collectif
fournisseurs) ; existant et trop long refusés ; créé DÉTAIL, personnalisé,
classe 6, proposé à la saisie ; 120 000 passés dessus en N, le 60510000
subdivisé refusé à la saisie ; clôture · banque reportée −120 000, charge non
reportée ; 30 000 passés en N+1 ; option refermée → 403.

### #18 · Assistant de création d'un compte et d'un code journal (M2-8, M3-5, M14-13)

Sage 100 i7 · « Fenêtre > Mode assistant » guide la création d'un compte
(numéro et intitulé, puis valider ou continuer) et d'un code journal (type,
code de six caractères, intitulé, numérotation), et « valider ce compte pour
en créer un nouveau » enchaîne les créations. Aucun texte ne régit le geste.
Reproduit sans toucher au serveur · même route, même corps, même jugement
(`POST /comptes`, `POST /journaux`). Le mode assistant est une PRÉFÉRENCE DU
POSTE (`lib/assistant-creation.ts`, clé `omegax.creation.modeAssistant`,
sous `try/catch`), case « Mode assistant » dans la barre des deux boîtes ·
cochée, les mêmes champs une étape à la fois (compte · numéro et intitulé,
type, récapitulatif ; journal · type, code et intitulé, numérotation, compte
du journal pour la trésorerie seule, récapitulatif), « Précédent » et
« Suivant », Entrée avance d'une étape après le jugement du navigateur.
« Créer et continuer », offert avec ou sans assistant, crée puis garde la
boîte ouverte, vidée, à la première étape, le message dit ce qui est créé ;
pour un journal de trésorerie, le compte du plan reste choisi et le numéro
proposé se relit. Ordre de la liste suivi sauf ici · #18 fait avant #19,
pendant la suite complète (#19 touche le serveur).

Tests · `client/src/lib/assistant-creation.spec.ts`, e2e `sage-l1-assistant`
(un compte en trois étapes puis en formulaire, deux journaux enchaînés, la
préférence relue après rechargement). Aucune écriture touchée · pas de
scénario sur base.

### #19 · Séquences de saisie (M6-142, Sage P_SEQUENCE)

LECTURE (relue dans « Structure des fichiers », p. 558, 559, 565 et 594, le
2026-10-14) · P_SEQUENCE est une page de paramètres de la Paie Maestria ·
dix intitulés de séquence (SQ_Sequence01 à 10, 35 caractères), et chaque
élément à saisir porte la sienne (N_Sequence, 0 = aucune · F_RUBRIQUE et les
rubriques variables du salarié, index par séquence) · la saisie se fait par
séquence. Ce n'est PAS un choix de colonnes. La lecture la plus fidèle que la
ligne puisse tenir, à la place que l'architecture lui donne (Structure >
Paramètres de saisie, `modeles-saisie/`) · dix séquences nommées par dossier
(`SequenceSaisie`, rang 1 à 10, intitulé de 35 caractères au plus, unique),
chaque MODÈLE DE SAISIE dans une séquence ou aucune
(`ModeleSaisie.sequenceSaisieId`, RESTRICT déclaré), et la barre « Appeler un
modèle » de la saisie propose les modèles d'une séquence (« Toutes », une
séquence, « Sans séquence »). Les modèles sont à la saisie des journaux ce
que les rubriques sont au bulletin. LES RUBRIQUES DE PAIE NE SONT PAS
RANGÉES · elles vivent dans `personnel/`, tenu par la ligne L5 ; les y ranger
par séquence est une question pour l'intégration (ci-dessous).

Code · migration `20270171030000_sequences_saisie`,
`modeles-saisie/sequences-saisie.ts` (règles), `.service.ts`,
`.controller.ts` (`/sequences-saisie`, administrateur et comptable comme les
modèles), création au premier rang libre sous verrou du dossier, onzième
refusée, intitulé pris refusé (409 nommé), retrait refusé tant qu'un modèle
est rangé (409 qui les compte) ; au journal d'audit, cloisonnée, fonction
STRUCTURE. Écran · `SequencesSaisiePage` (Structure > Paramètres de saisie >
Séquences de saisie), colonne et choix de la séquence dans Modèles de
saisie, choix de la séquence dans la saisie.

Tests · `modeles-saisie/sequences-saisie.spec.ts`, `chrome-etroit.spec.ts`
(17 commandes sous Structure), `lecture-bornee.spec.ts` (158 modèles), e2e
`sage-l1-sequences`. Aucune écriture touchée · essai de l'API sur vraie base
(`l1-s19.mjs`), 0 écart · rangs 1 et 2, intitulé pris et de 36 caractères
refusés, onzième refusée, modèle rangé et lu, séquence occupée refusée au
retrait, retirée du modèle puis retirée, rang 1 repris, renommée.

## Reste

- Rien des sept fonctions. Les sept parcours navigateur passent sous Chromium
  (`sage-l1-situation`, `-totaux`, `-impression`, `-lettre`,
  `-compte-en-saisie`, `-assistant`, `-sequences`), et les parcours voisins
  rejoués sans régression (`ecrans` aux deux référentiels, `saisie-par-piece`,
  `lettrage-cloture`, `comptes-personnalises`, `comptes`, `parcours`,
  `cloture`). WebKit n'est pas installé sur la machine · il tourne en CI.
- Largeurs · fenêtres nouvelles ou touchées relevées à 390 et 1440 px
  (séquences, assistant du compte et du journal, lettrage, paramètres,
  journal, bulle et boîte du compte créé en saisie), aucun débord de page ;
  à 390 px la bulle « Créer le compte » vit dans la grille de saisie, qui
  défile déjà en largeur.
- À l'intégration · deux fichiers de la ligne L4 touchés pour une lecture
  chacune (`immobilisations/immobilisation.service.ts`,
  `immobilisations/subvention-rattachee.service.ts`, `...HORS_SITUATION`) ;
  `lecture-bornee.spec.ts` compte 158 modèles avec `SequenceSaisie` et
  `ImpressionJournal` (à rejouer si une autre ligne ajoute des tables) ;
  `chrome-etroit.spec.ts` compte 17 commandes sous Structure.

## Bloc du § 3 (2026-10-14, après la dernière fonction)

- Serveur · `tsc --noEmit` sans erreur ; jest en six tranches successives,
  12 414 tests (1 711, 1 968, 1 959, 2 503, 1 951, 2 322). Six specs tombées,
  toutes parce qu'elles gelaient une requête ou une doublure d'avant la
  fonction 12 (le filtre `statut: { not: 'SITUATION' }`) · corrigées, chacune
  rejouée verte, et les doublures COMPLÉTÉES (opérateur `not`, statut), jamais
  contournées, avec une simulation ajoutée aux jeux d'essai du groupe et du
  contrôle des cumuls pour prouver qu'elle n'est pas lue ; `nest build` passe ;
  migrations sans écart avec le schéma.
- Client · `tsc --noEmit` sans erreur, vitest 2 023 tests (255 fichiers),
  `vite build` passe.

## Questions pour Manasse

Aucune ne bloque · le corpus ne régit aucun de ces choix, qui sont
d'organisation ou de produit.

1. #19 · Sage range aussi les RUBRIQUES DE PAIE par séquence (P_SEQUENCE est
   une page de la Paie). Faut-il les ranger de même dans OmegaX
   (`personnel/`, ligne L5), sur les mêmes séquences ou sur des séquences
   propres à la paie ?
2. #12 · Sage peut inclure les journaux de situation dans une balance ou un
   grand livre de SIMULATION. D-L1-12 les tient hors de tout livre et état ;
   elles se lisent dans leur journal. Faut-il une balance de simulation à
   part, dite sans valeur légale (comme le second jeu en monnaie
   fonctionnelle) ?
3. #14 · Sous l'option, le comptable et l'aide-comptable (par héritage)
   créent le compte en saisie, alors que « Nouveau compte » au Plan
   comptable reste à l'administrateur. L'option est ouverte par
   l'administrateur, qui délègue ainsi. Faut-il réserver le geste au
   comptable (`@ReserveAuComptable()`), ou à l'administrateur seul ?

## Décisions

- D-L1-12 (ci-dessus), par la loi · AUDCIF art. 16 al. 2, 17 3°, 19, 22 2° et 3°.
- D-L1-60 (ci-dessus), par la loi · AUDCIF art. 22, 1°, 3° et 7°.
- #16 · seule règle lue, le CPCC (ch. 6, « un seul repère ») · tenue par
  l'unicité de la lettre sur le compte, refus nommé.
- #14 · aucun texte ne régit le geste (AUDCIF art. 18, al. 3 ; SYCEBNL
  Partie 2 ch. 2, section 1, l'art. 18 étant écarté par son art. 3) · règle
  d'organisation d'OmegaX, celle des comptes personnalisés, en option fermée
  par défaut.
- #11, #18 · préférences du poste (architecture, lignes 11 et 18), aucune
  donnée du dossier.
- #19 · lecture de P_SEQUENCE (Structure des fichiers de Sage, p. 558, 559,
  565, 594) transposée aux modèles de saisie, à leur place
  (`modeles-saisie/`).

## Commandes de vérification

```bash
NODE_OPTIONS=--max-old-space-size=3072 npx tsc --noEmit
for s in 1 2 3 4 5 6; do npx jest --shard=$s/6 --maxWorkers=1 --workerIdleMemoryLimit=800MB; done
NODE_OPTIONS=--max-old-space-size=2048 npm run build
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://jetable:jetable@localhost:5432/omegax_sage_l1_ombre --exit-code
(cd client && npx tsc --noEmit && npm test && NODE_OPTIONS=--max-old-space-size=2048 npm run build)
# Navigateur · serveur compilé sur 8081 (base omegax_sage_l1), client servi sur 4181 (relais /api)
(cd e2e && OMEGAX_APP=http://localhost:4181 OMEGAX_API=http://localhost:4181/api \
  PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test tests/sage-l1-*.e2e.ts)
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

**Journal marqué imprimé (ligne sage-l1, fonction 60, décision par la loi du
2026-10-14).** AUDCIF art. 22, 1° (restitution sur papier), 3° (la clôture
informatique n'attend aucune impression) et 7° (états périodiques numérotés
et datés) · l'impression ou l'export du journal entier s'ENREGISTRE
(`ImpressionJournal`, numéro continu par dossier, auteur, période, pièces) ;
le refus de clôturer un journal non imprimé est une OPTION du dossier,
fausse par défaut (`refusClotureJournalNonImprime`) ; une écriture validée
après l'impression rend son jour non imprimé (`moisNonImprimes`) ; une
recherche n'est pas le journal. Case « N » de l'état des journaux de saisie.

**Lettre de lettrage choisie (ligne sage-l1, fonction 16, 2026-10-14).** Le
lettrage manuel prend la lettre que le comptable tape (`LettrerDto.lettre`,
une à quatre lettres, rangée en majuscules), sinon la proposée
(`prochaineLettre`, la suivante du compte) ; une lettre déjà employée sur le
compte (groupe ou lignes reprises) est refusée en la nommant (CPCC, ch. 6,
« un seul repère »), relue dans la transaction.

**Compte créé pendant la saisie (ligne sage-l1, fonction 14, 2026-10-14).**
Option du dossier, fermée par défaut (`creationCompteEnSaisie`) · un numéro
inconnu tapé en saisie s'ouvre, sur confirmation, en SOUS-COMPTE d'un compte
d'imputation du plan, par `CompteService.creer`, né personnalisé
(`POST /comptes/en-saisie`, administrateur et comptable). Jamais hors plan,
jamais sous un collectif de tiers (`comptes/compte-en-saisie.ts`).

**Mode assistant de création (ligne sage-l1, fonction 18, 2026-10-14).**
Préférence du poste (`lib/assistant-creation.ts`) · la création d'un compte
et d'un code journal par étapes, les mêmes champs et la même route ; « Créer
et continuer » garde la boîte ouverte pour le suivant.

**Séquences de saisie (ligne sage-l1, fonction 19, 2026-10-14).** Sage,
P_SEQUENCE · dix séquences nommées par dossier (`SequenceSaisie`, 35
caractères), chaque modèle de saisie dans une séquence ou aucune (RESTRICT),
la barre « Appeler un modèle » de la saisie les propose par séquence ; une
séquence qui range un modèle ne se retire pas. Les rubriques de paie, que
Sage range aussi par séquence, ne le sont pas encore.

## Pour build-log.md

- 2026-10-14 · sage-l1 #12 · fait · journal de situation · statut SITUATION, garde
  Prisma, lectures écartées, clôture et numérotation · plus dur que prévu ·
  une centaine de lectures du brouillard à relire une à une, et les doublures
  des contrôles (le constat relevé pendant le parcours, sans seconde requête).
- 2026-10-14 · sage-l1 #11 · fait · masquer les totaux, préférence du poste,
  l'équilibre toujours montré.
- 2026-10-14 · sage-l1 #60 · fait · journal imprimé enregistré, refus de clôture en
  option, case « Non imprimé » · comme prévu.
- 2026-10-14 · sage-l1 #16 · fait · lettre de lettrage choisie, refus nommé d'une lettre
  déjà employée · comme prévu.
- 2026-10-14 · sage-l1 #14 · fait · compte créé en saisie sous option, sous-compte du
  plan, jamais sous un collectif de tiers · comme prévu.
- 2026-10-14 · sage-l1 #18 · fait · assistant de création d'un compte et d'un journal,
  création enchaînée, préférence du poste · comme prévu.
- 2026-10-14 · sage-l1 #19 · fait · séquences de saisie sur les modèles, saisie par
  séquence · lecture de P_SEQUENCE (paie) transposée aux modèles, rubriques de paie laissées à L5.
