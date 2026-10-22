# Ligne sage-l3 · banque et trésorerie

Copie `/home/user/wt-sage-l3`, branche de sauvegarde `travail/sage-l3`.
Migrations `20270190000100_…` et suivantes, bases jetables `l3_ombre`
(ombre), `l3_e2e` (tests navigateur), `l3_scenario` (scénario sur vraie
base) ; serveur 8303, client 4303, tests navigateur `e2e/tests/sage-l3-*.e2e.ts`.

Fonctions (numéros de `docs/comparaison-sage/15-absents-a-trier.md`), dans
l'ordre · #37 virement depuis un compte en devise, #40 remises de chèques et
de cartes, #39 effets de commerce (circuit comptable seul, décision D11),
#45 édition chaînée des extraits, #46 conditions bancaires par RIB,
autorisations de financement, unions de comptes, #47 taux de référence,
financements, placements.

## Fait

- #37 · serveur (15ff6c1) · `deviseDuDonneur`, `motifRefusLignesHorsDeviseDonneur`
  (`tiers/ribs-tiers.ts`), `donneurDuJournal` rend la devise du RIB,
  `refuserLignesHorsDevise` avant la première pièce, `OrdreVirement.devise`,
  `totalDevise`, `LigneOrdreVirement.montantDevise` (migration
  `20270190000100_ordre_de_virement_en_devise`), la devise de chaque ligne posée
  aux trois points de `reglements.service.ts`, avis de règlement en devise avec
  sa contrevaleur ; les salaires restent en francs.
- #37 · écran de l'ordre (liste en devise, colonnes « Montant USD » et
  « Contrevaleur CDF », mention imprimée), test navigateur
  `e2e/tests/sage-l3-virement-devise.e2e.ts` PASSÉ sur vraie base le
  2026-10-22 (Postgres jetable 55803, serveur 8303, client 4303) · refus sans
  devise au RIB, ordre de 1 000 USD pour 1 680 000 CDF, refus d'une facture en
  francs sur un RIB en USD, clôture de N, second ordre de N+1 numéroté à la
  suite, avis « 500,00 USD (contrevaleur comptable 840 000,00 CDF) ».
- #37 · docs · `features.csv` (37 en yes), tables 05 (M5-42) et 13 (M13-72),
  `build-log.md`, `test-plan.md` (F37-H1, N1, N2, N3), CLAUDE.md § 6 règle (3)
  des ordres de virement réécrite.
- Bloc § 3 du 2026-10-22 · serveur tsc, Jest 950 suites et 13 829 tests, build ;
  client tsc, 2 408 tests, build.
- #37 · premier tour de relecture (silent-failure-hunter, typescript-reviewer,
  react-reviewer) · aucun BLOQUANT ni MAJEUR, sept MINEURS corrigés · l'avis
  d'un ordre en devise refuse une ligne sans montant en devise au lieu
  d'imprimer la contrevaleur ; l'avis servi porte `montantDevise` et la devise
  de l'ordre, la carte de l'écran les affiche avec l'unité ; le libellé du
  refus sans devise au RIB couvre « CDF » écrit en toutes lettres ; la devise
  d'une ligne se lit comme celle du RIB (majuscules, franc = aucune) ; le
  refus de garde de `creerDans` nomme le bénéficiaire ; `totalDevise` somme
  les lignes ARRONDIES (deux demi-centimes, cas gelé) ; la liste montre
  « · USD » quand le total en devise manque, jamais la contrevaleur sans
  unité. Non repris · la ligne de la liste ouverte à la souris seule
  (préexistant, relevé en attente), le RIB lu deux fois (refus nommé dans les
  deux sens, pas une faute).
- #37 · second tour de relecture (mêmes trois agents) · aucun BLOQUANT, un
  MAJEUR et quatre MINEURS corrigés · `creerDans` lisait la devise deux fois
  (porte puis garde) et pouvait admettre une ligne sans montant en devise ·
  une seule lecture (`deviseDuDonneur`), chaque ligne d'un ordre en devise
  doit porter un montant en devise fini, sinon refus nommé avant toute
  pièce ; le total en francs est la somme des lignes ARRONDIES comme
  `totalDevise` ; l'avis d'un ordre en devise lève un 409 nommé sur une
  ligne sans montant en devise (jamais une contrevaleur muette) ; le code
  d'une devise est trois LETTRES à la porte (`CreerDeviseDto`, `@Matches`,
  « US » suivi d'un blanc passait la longueur) et le service le range
  débarrassé des blancs ; spec `code-devise-dto.spec.ts`. Rejoué · tsc,
  specs des règlements, des RIB et des devises (507 tests), test navigateur
  sur vraie base.

- #40 · serveur · module `src/modules/remises/` · `remise-en-banque.ts`
  (règles pures · comptes du 51 par nature, 513 chèques, 514 transit,
  515 cartes jusqu'à l'avis de crédit, commission 6315, impayé au 413 de la
  fiche du 41 par référentiel, modèle de bordereau à jetons, lignes des
  quatre écritures, refus nommés), `remises.service.ts` (types, réception
  lettrée avec les lignes ouvertes du tiers, bordereau numéroté sous verrou,
  impression comptée, avis de crédit D 52 / D 6315 / C 514 ou 515 dans
  l'exercice de SA date, impayé D 413 / C 514, 515 ou 52, annulations au
  brouillard supprimées et validées en négatif, écritures retenues),
  contrôleur, DTO, module ; schéma `TypeRemise`, `ValeurRecue`,
  `RemiseEnBanque` (migration `20270190000200_remises_en_banque`, dérive
  nulle contre `l3_ombre`) ; listes de structure (modèles audités et
  cloisonnés, huit colonnes qui retiennent, libellés d'audit, bornes de la
  restitution, lectures hors situation, fonctions métier, listes de
  comptes). Specs `remise-en-banque.spec.ts`, `remises.service.spec.ts`
  (le total du bordereau est la somme des lignes ARRONDIES, comme
  l'écriture · 20,01 contre 20,02 trouvé par le spec).
- #40 · écran `client/src/pages/RemisesPage.tsx` (Traitement > Tiers et
  trésorerie > Remises en banque · valeurs reçues, bordereaux, et
  Structure > Paramètres de saisie > Types de remise), `AppShell.tsx`,
  `registre-fenetres.tsx`, décomptes de `chrome-etroit.spec.ts` (20 et 23).
- #40 · test navigateur `e2e/tests/sage-l3-remises.e2e.ts` PASSÉ sur vraie
  base le 2026-10-22 · type CHQ, refus d'un transit sur les cartes, deux
  chèques reçus (l'un lettré avec sa facture), 513 à 1 660 000, bordereau
  n° 1 imprimé, avis avec commission de 5 000 (514 soldé, 6315 à 5 000, 52
  à 1 655 000), annulation du bordereau refusée après l'avis, chèque de
  décembre remis en N et crédité en JANVIER de N+1 à travers la clôture
  (514 reporté 300 000 puis soldé), impayé au 41310000 et son annulation.
  Trouvé sur vraie base · les champs `unknown` des DTO tombaient sous le
  pipe global (« property montant should not exist ») · `@Allow()`.

- #40 · premier tour de relecture (silent-failure-hunter, typescript-reviewer,
  react-reviewer) · DEUX BLOQUANTS, CINQ MAJEURS, une vingtaine de MINEURS,
  tous corrigés sauf ceux relevés ci-dessous · (B1) l'avis de crédit
  créditait le TOTAL figé du bordereau quand une valeur en était déjà sortie
  par un impayé (52 majoré, 514 créditeur, balance bouclée) · refus nommé
  tant qu'un impayé tient, compte des valeurs créditées vérifié (409) ;
  (B2) l'annulation de l'avis était jugée sur l'exercice du BORDEREAU · un
  avis de janvier sur un bordereau de décembre était enfermé une fois N
  clôturé, et la pièce retenue ne se corrigeait pas non plus au journal ·
  seule la pièce de l'avis borne (`pieceAnnulable`) ; (M1) les candidates au
  bordereau venaient de la liste de l'exercice courant · un chèque reçu en
  décembre, non remis, n'apparaissait plus en N+1 et le 513 le gardait ·
  route `GET /remises/valeurs/a-remettre?typeRemiseId=` sans borne
  d'exercice, exercice d'origine dit ; (M2) un échec de lecture des lignes
  ouvertes du tiers s'affichait « aucune ligne ouverte » · état d'erreur
  propre, réception fermée tant que la lecture n'a pas abouti ; (M3) la date
  d'un bordereau de CARTES n'était pas jugée dans son exercice (aucune
  écriture) · refus nommé, `estUnJour` ; (M4) un 5xx ou une réponse perdue
  sur une écriture était annoncé « impossible » (doublon au reclic) ·
  `messageDuRefus`, liste relue ; (M5) impression du bordereau depuis la
  modale (voile et fenêtre sur le papier) · bordereau rendu dans la page
  sous `impression-seul`, voile en `ecran-seul` ; aucune garde de
  fermeture et onglets démontés (saisie perdue) · `useGardeFermeture`,
  onglets gardés montés. MINEURS · plus que le dû refusé avant la pièce ;
  `delettrer` mort retiré ; référence du bordereau posée dans la
  transaction ; filtre de statut par `Object.keys` ; compte de trésorerie
  absent refusé nommé ; première impression posée par `updateMany` ;
  bordereau annulé non imprimé ; compte des valeurs rendues vérifié à
  l'annulation de l'avis ; impayé jamais daté avant la remise ni l'avis ;
  lectures par identifiant bornées ; liste des comptes dit son total ;
  chèque de même référence averti ; présélection des choix uniques ;
  lectures réservées à qui écrit ; `aria-label` et `scope` ; dates bornées
  à l'exercice ; valeurs sorties de la liste élaguées ; textes de
  l'écran en `title` ; focus de la boîte du bordereau ; commission
  illisible dite. Test navigateur ÉTENDU et PASSÉ sur vraie base · impayé
  avant l'avis refusé (B1), chèque de décembre non remis remis en janvier
  par la liste sans borne (M1), avis de janvier annulé puis repassé après la
  clôture de N (B2). Rejoué · tsc, specs du module (30), client (2 409).
  Relevés en attente · (m5 TS) le numéro du bordereau de chèques est pris
  sous verrou APRÈS l'instantané sérialisable de `creerAvec` · l'index
  unique ferme le doublon, mais un conflit sorti en 23505 ferait un 500 au
  lieu d'un rejeu · à prouver par deux bordereaux simultanés sur vraie base,
  ou numéroter par une ligne compteur `FOR UPDATE` ; (11 React) les
  échéances de TOUS les clients sont lues pour n'en garder qu'un (la route
  n'a pas de filtre par compte) ; flèches gauche et droite des onglets.
- #40 · second tour de relecture (mêmes trois agents) · UN BLOQUANT (même
  racine à deux endroits), tous les MINEURS corrigés · (B1) un avis de
  crédit ou un impayé VALIDÉ puis annulé gardait son lien d'origine sur la
  remise ou la valeur (une seule paire de colonnes), et le geste suivant,
  qui exige le lien vide, était refusé pour toujours (409 « a changé
  d'état ») · le 514 reporté restait ouvert, le chèque réellement impayé ne
  revenait jamais au 413, et l'issue nommée par B1 du premier tour
  (« annulez l'impayé, passez l'avis, redéclarez ») était fermée dès que la
  pièce était validée · table d'historique `AnnulationActeRemise` (nature,
  remise ou valeur, traitement, origine et négatif RETENUS, motif, auteur ·
  migration `20270190000300_annulations_actes_remise`, dérive nulle contre
  `l3_ombre`, les deux colonnes de négatif retirées et leurs paires
  recopiées), l'annulation y range sa paire et libère le lien, le geste se
  repasse, une seconde annulation fait une seconde ligne ; l'écran dit
  « avis annulé le … · négatif n° … » et « impayé annulé … ». MINEURS ·
  une ligne cochée déjà lettrée, pointée, de situation ou d'à-nouveau
  provisoire est refusée AVANT la pièce de réception (elle ne l'était que
  par le lettrage, après) ; identifiants dédoublonnés passés au lettrage ;
  l'impression du bordereau se compte sous le statut (annulé entre la
  lecture et l'écriture · 409) ; l'exercice d'un bordereau de CARTES est
  relu dans la transaction ; « annulez d'abord l'impayé, puis le
  bordereau » dans l'ordre que `annulerRemise` impose ; listes de comptes
  tronquées dites à l'écran (m3) ; une seule `useGardeFermeture` par
  fenêtre, chaque onglet remonte son motif (M1 React · deux appels se
  remplaçaient) ; cases du bordereau vidées au seul changement de type ;
  « Lecture… » tu sans exercice ; `onRefus` par référence ; `banques` et
  `operations` mémorisés ; `scope="col"` et `aria-label` nommant le type ;
  un type disparu quitte le choix. Specs · validée-annulée-redéclarée
  (impayé et avis), ligne tenue refusée avant la pièce, doublon averti,
  tiers hors classe 4 refusé, impression d'une remise annulée, branche
  `dateCredit` de `motifRefusImpaye` ; doublure `delettrer` retirée.
  Test navigateur ÉTENDU et PASSÉ sur vraie base · avis VALIDÉ (validation
  par période) annulé en négatif puis repassé (514 à 420 000 puis 120 000),
  historique servi sur le bordereau de N ; impayé VALIDÉ annulé en négatif,
  REDÉCLARÉ (4131 de nouveau à 300 000), annulé au brouillard · trois
  annulations gardées, aucun impayé en cours. Rejoué · tsc des deux côtés,
  Jest entier (13 892, deux chutes corrigées · inventaire de la restitution
  à 188 modèles, doublure), vitest (2 409), construction, test navigateur.
  Non repris (hors périmètre du second tour, au relevé) · le message « compte
  de transit introuvable » quand un type de chèques est créé par l'API sans
  `compteTransitId` (l'écran l'exige) ; le relevé du premier tour inchangé.

- #39 · serveur (4bc3000) · module `src/modules/effets/` · `effet-commerce.ts`
  (rôles de compte par référentiel et sens, actes admis par statut,
  `statutApresActes`, lignes des neuf actes, refus du décompte), `effets.service.ts`
  (acceptation lettrée par `creerAvec` avec l'échéance posée sur la pièce,
  remise, escompte, décompte, encaissement, dénouement, impayé avec reprise de
  banque, bon à payer sans pièce, paiement, annulation à rebours qui retire ou
  inscrit en négatif), contrôleur `/effets`, tables `EffetCommerce` et `ActeEffet`
  (migration `20270190000400_effets_de_commerce`, `Ecriture.dateEncaissementEffet`),
  `dateDuReglement` dans `taux-tva.service.ts` sur chaque lecture du groupe,
  registres (cloisonnement, audit, détenteurs, fonctions métier, listes de
  comptes, lectures hors situation), 29 tests (`effet-commerce.spec`,
  `effets.service.spec`, `tva-echeance-effet.spec`).
- #39 · écran `client/src/pages/EffetsPage.tsx` (Traitement > Tiers et
  trésorerie > Effets de commerce · deux onglets, le SYCEBNL n'offrant que
  « À payer » ; acceptation avec lignes ouvertes à lettrer ; un bouton par acte
  admis ; annulation du dernier acte sous `peutValider` ; détail des actes),
  registre des fenêtres, menu, `chrome-etroit.spec` (24).
- #39 · test navigateur `e2e/tests/sage-l3-effets.e2e.ts` sur vraie base
  (Postgres jetable 55803) · SYSCOHADA · prestation lettrée par une traite,
  déclaration de TVA vide au mois de l'acceptation et pleine au mois de
  l'échéance, remise et encaissement avec commission, escompte de novembre,
  décompte, clôture de N, dénouement en janvier de N+1 (415 et 565 reportés
  puis soldés), annulation hors ordre refusée, dénouement validé inscrit en
  négatif, impayé au 4132 avec reprise de la banque, impayé au brouillard
  retiré ; SYCEBNL · effet à recevoir refusé avec son motif, effet à payer
  lettré, bon à payer, paiement, annulations à rebours. Premier passage · 500
  sur l'annulation au brouillard (clé étrangère `actes_effet_ecritureId_fkey`,
  l'acte retenait la pièce retirée) · lien dénoué avant le retrait, gelé par
  le spec du service (ordre des appels).
- #39 · docs · `features.csv` (39 en yes), `build-log.md`, `architecture.md`
  (D13), tables 05 (M5-24, M5-47), 13 (M13-6, M13-12, M13-67), 14 (M14-19),
  06 (M6-38, M6-128) ; paragraphe « Effets de commerce » au § 6 de CLAUDE.md.
- #39 · premier tour de relecture (trois relecteurs, aucun BLOQUANT) ·
  serveur · liste bornée aux effets EN COURS ou nés dans l'exercice (M3, un
  escompté né en N se lit en N+1 après la clôture, gelé par le scénario
  navigateur) ; décompte, annulation et bon à payer sous `SELECT … FOR
  UPDATE` de l'effet, actes relus, 409 nommé si un autre geste est passé
  (M1) ; la banque du décompte, de l'encaissement et de l'impayé est un
  journal de trésorerie sur un 52, la caisse refusée (M2) ; une facture datée
  APRÈS l'acceptation refusée (un effet règle une facture antérieure), lignes
  figées refusées par `refuserSiLignesFigees`, lignes au brouillard comptées
  et dites (m5) ; le rôle TIERS n'offre jamais un collectif (M2 bis), et au
  SYCEBNL son motif est celui du portefeuille (m6) ; bon à payer daté dans un
  exercice ouvert, référence blanche refusée (m6 bis) ; un lettrage manqué
  rend un 400 nommé, jamais un effet accepté sans que l'écran le sache ;
  l'imputation des paiements date aussi par `dateDuReglement` (TVA à
  l'échéance, gelé par `tva-echeance-effet.spec.ts`). Écran · les lignes
  ouvertes se lisent sous les noms que `/reglements/echeances` sert
  (`montant`, `echeance` · lues sous d'autres noms, le montant s'affichait
  « · », même défaut corrigé sur `RemisesPage`) ; lignes illisibles,
  l'effet s'accepte SANS lettrage et l'écran le dit ; « Codes journaux »,
  « Plan des tiers » nommés ; factures au brouillard dites à l'acceptation.
  `casse-en-silence.spec.ts` · `effetCommerce` retiré des détenteurs (c'est
  `acteEffet` qui retient). Scénario navigateur rejoué vert (deux tests).
- #39 · second tour de relecture (mêmes trois agents) · UN BLOQUANT à
  l'écran (la liste des tiers servie par tranche de 200 laissait le 201e
  client sans issue) · `GET /effets/comptes?numero=` (début du numéro, chiffres
  seuls) et champ « Numéro commence par » sous le sélecteur du tiers ;
  MAJEURS · le nettoyage manqué après un lettrage refusé rend un 409 qui
  NOMME l'effet et sa pièce restés en base (« n'a pas été accepté » faisait
  réaccepter la même traite) ; `updateMany` sur les modèles AUDITÉS
  (`EffetCommerce`, `ActeEffet`) remplacés par des mises à jour UNITAIRES
  (motif d'annulation dans la chaîne d'audit), P2025 rendu en 409 nommé
  (`prendre`) ; une ligne EN DEVISE cochée est refusée avant la pièce (une
  facture en devise se règle dans sa devise, A6) et la case est fermée à
  l'écran avec le motif ; les lignes d'à-nouveau provisoire écartées et la
  créance reclassée sont DITES sous les lignes ouvertes (« null n'est pas
  vide ») ; une lecture de comptes qui échoue dans la modale d'acte le dit
  dans le sélecteur et ferme le bouton avec l'issue ; réponse perdue ou 409
  · la liste se relit et la modale se ferme ; « accepté sans lettrage » dit
  avec son issue ; liste vide dite « en cours, ni arrivé à terme ».
  Relevés en attente (ni BLOQUANT ni MAJEUR, pas de troisième tour) · (TS 3)
  un effet à TERME n'est listé que sous l'exercice de sa création (encaissé
  en janvier, absent sous N+1 avec le filtre « Encaissé ») ; (TS 4) `banque()`
  ne lit pas `estActif` du 52 ; (TS 5) `motifRefusDeclaration` de
  l'imputation des paiements juge « jamais postérieure au paiement » sur la
  date de la pièce d'acceptation quand le moteur date à l'échéance · à
  trancher par la loi (art. 151, « lorsqu'il paye ») ; (TS 6) le retrait au
  brouillard passe par `deleteMany` hors `EcritureService.supprimer` (pièces
  jointes détachées sans description refaite) ; (TS 7, commun à devises,
  remises, créances douteuses, virements) le numéro de pièce du négatif est
  pris sans verrou sous une transaction non sérialisable ; (TS 8) l'acte dont
  la pièce est dans un exercice clôturé refuse l'annulation sans dire
  l'issue ; (TS 9) le lettrage reste une seconde transaction après le
  commit de l'effet (à poser dans la `suite` de `creerAvec`) ; (silent 2)
  `retirerCompensation` supprime sans relire le statut ; (silent 7) l'issue
  proposée pour une facture d'un lettrage partiel (« délettrez ») est la
  mauvaise · accepter sans la cocher puis compléter le groupe ; (silent 8)
  le négatif d'une acceptation validée ne porte pas `dateEncaissementEffet`
  · un lettrage facture + acceptation annulée sans le négatif ferait lire un
  règlement à l'échéance ; (silent 9) l'imputation nomme le paiement à la
  date de sa pièce quand elle le range à l'échéance ; (React 6) changer
  d'onglet jette une acceptation en cours de saisie sans confirmation ;
  (React 7, 8) `manque()` laisse au serveur l'échéance antérieure à la
  création, le centime, les frais qui atteignent le nominal, les `min` de
  date des actes ; (React 9) « Lecture… » sous un bandeau d'erreur ;
  (React 10) flèches de la tablist, piège et retour du focus des modales,
  `aria-label` de la table ; (React 11) `/reglements/echeances` lu pour tous
  les tiers puis filtré (pas de filtre par compte sur la route, commun aux
  remises).
- #45 · décision par la loi D14 (architecture.md) · le relevé reçu est la
  pièce (AUDCIF art. 22, 7° ; art. 24), l'édition une reconstitution datée,
  non numérotée. Serveur (2407f47) · `rapprochement/extraits-bancaires.ts`
  (règles pures · soldes progressifs au sens de la banque, noms de feuille
  bornés à 31, sélection, ordre compte puis date, totaux, bornes),
  `extraits-bancaires.service.ts` (liste par compte bornée à 200, agrégats,
  solde de départ par `depart` ; édition chaînée FPM en flux, sommaire puis
  une feuille par extrait, refus avant le premier octet), `GET
  /rapprochements/extraits` (`COMPTE_FACULTATIF`) et `/extraits/edition`
  déclarées avant `:id` ; `RapprochementBancaire.releveImporteLe`,
  `releveNomFichier` (migration `20270190000500_extraits_bancaires`, `prisma
  migrate diff` sans écart sur `l3_ombre`) ; specs purs (21) et de service
  (6, classeur relu par ExcelJS) ; `cloisonnement.spec` (borne écrite dans
  chaque appel) et `exercice-requis.spec` (`listerExtraits` dans la liste
  fermée) tenus. Écran · `ExtraitsBancairesPage.tsx`, Traitement > Tiers et
  trésorerie > Extraits bancaires (registre, menu, `chrome-etroit` à 25),
  liste par compte avec cases, bornes du/au, bouton d'édition par
  `telechargerOuSignaler`, chaque extrait ouvre son rapprochement. Scénario
  navigateur `e2e/tests/sage-l3-extraits.e2e.ts` PASSÉ sur vraie base ·
  rapprochement de N clos (départ déclaré, deux lignes rapprochées), N
  clôturé, second relevé en N+1 ancré sur le solde imprimé du premier, liste,
  classeur à trois feuilles relu (ZIP), bornes, refus 400 et 404.
- #45 · docs · `features.csv` (45 en yes), `build-log.md`, `test-plan.md`
  (F45-H1 à N1), `architecture.md` (D14, place de la fonction), tables 05
  (M5-30) et 13 (M13-10) ; paragraphe « Extraits bancaires » au § 6 de
  CLAUDE.md.
- #45 · premier tour de relecture (silent-failure-hunter, typescript-reviewer,
  react-reviewer, 2026-10-22) · UN BLOQUANT, partagé par les trois, corrigé ·
  l'édition chaînée jugeait la troncature sur le DOSSIER ENTIER avant
  d'appliquer la sélection (au-delà de 200 relevés, plus aucune édition, pas
  même un compte sur un mois, et le refus nommait une issue qui ne levait
  rien) · comptes choisis et bornes de dates écrites DANS la requête
  (`listerExtraits(tenantId, selection)`, `compteId in`, `dateReleve gte / lt
  lendemain`), troncature jugée sur la sélection, spec B1 (dossier à 201,
  édition d'un compte sur un mois PASSE). MAJEURS corrigés · (M1) l'écran ne
  servait jamais `compteId` et les comptes au-delà de la tranche étaient
  invisibles sans issue · le serveur sert à part les comptes à extrait
  (`comptes`, `groupBy`, 500 au plus, dit), l'écran les offre en sélecteur
  et relit par compte, le message de troncature nomme l'issue ; (M2 / M3) la
  période du cartouche et le nom du fichier prenaient le premier et le
  dernier de l'ordre compte-puis-date (« du 31/01 au 31/01 » pour un classeur
  qui contenait février, gelé par le spec) · `periodeDesExtraits`, min et
  max ; (M4) `depart` appelé deux fois par extrait en boucle (400
  allers-retours) · UNE règle `departParmiLesClos` (rapprochement.service),
  `depart` lit les clos du compte en une lecture, la liste ceux des comptes
  de la tranche, spec de la règle (ouvert, clos, jamais lui-même, zéro
  déclaré) ; (M, comptes-proposes.spec) la route `/rapprochements/extraits`
  lit des comptes · rangée dans `ROUTES_QUI_NE_SONT_PAS_DES_LISTES` avec son
  motif, et `lister` renommée `listerExtraits` (le détecteur résout une
  méthode par son NOM dans le dossier du module, `/rapprochements` passait
  pour une liste de comptes). MINEURS corrigés · lignes relues par lots de
  500 (`apresLaCle` rang puis id) avec le solde progressif incrémental
  (`soldeApres`) et la période de la feuille par agrégat (min, max) ; un
  relevé qui change entre la liste et sa feuille ARRÊTE le flux (décompte
  confronté, spec) ; un zéro est une cellule vide partout sauf le solde de
  départ déclaré (`montantFpm`) ; `retirerReleve` dans une transaction ;
  nom du fichier importé borné en points de code, `@MaxLength` ; `du`, `au`
  et `compteIds` bornés, plus de 200 comptes refusé ; bornes jugées sur le
  JOUR (`jourIso`, un relevé daté à dix heures entrait dans « au ») ; un
  « 2026-02-31 » refusé ; nom de feuille nettoyé des caractères qu'Excel
  refuse ; `Math.min(...)` remplacé par des boucles ; `comptesSansExtrait`
  servis en objets ; `'ANNULE'` retiré du type ; écran · refus 4xx avec son
  motif, panne ou téléchargement interrompu dits « aucun classeur produit »,
  relecture de la liste sur 404, `finally`, `min` / `max` croisés des dates,
  `aria-label`, `title` du fichier tronqué, rôles de tableau ; scénario
  navigateur étendu (comptes servis, montants de la feuille, sélecteur).
  Non repris (relevés en attente) · `IDENTIFIANTS_DANS_UN_DTO_DE_REQUETE`
  ne détecte que `compteId` au singulier (la preuve du 404 est au service
  et au scénario, élargir la détection est un changement du spec) ;
  l'horodatage de l'import garde `toLocaleString` (l'heure compte, et
  `common/echeance.ts` ne rend que le jour) ; aucun spec unitaire d'`importerReleve`
  (couvert par le scénario navigateur) ; le cas à 201 relevés n'est pas
  rejoué au navigateur (spec unitaire). Rejoué · tsc des deux côtés, 195
  tests des suites touchées, scénario navigateur sur vraie base.
- #45 · second tour de relecture (mêmes trois agents) · aucun BLOQUANT, deux
  MAJEURS corrigés. (M1) un relevé qui change pendant l'édition lève un
  409 NOMMÉ (`ConflictException`), relayé par `envoyerXlsxEnFlux` tant que
  rien n'est parti, jamais une `Error` simple devenue 500 anonyme ; le
  message distingue lignes, lignes rapprochées (un pointage entre-temps),
  montants et relevé réimporté. (M2) la tête du rapprochement se RELIT
  avant sa feuille (instant de l'import, solde imprimé) et les sommes des
  débits et crédits relus se confrontent au centime à celles de la liste
  (`totalDebit`, `totalCredit` servis dans `TeteExtrait`) ; l'écart imprimé
  se calcule sur les lignes imprimées, et se dit « non calculé (solde de
  départ inconnu) » sans départ. Écran · « Relire » par un compteur ;
  comptes gardés d'une lecture à l'autre ; compte retiré (404) vidé du
  choix ; cases vidées au changement de compte ; la ligne reste un
  `role="row"`, sa première cellule porte un vrai bouton nommé ; le titre
  du groupe hors du tableau, avec « n montrés sur m » ; édition refusée à
  l'écran sur liste tronquée sans compte ; erreur d'édition vidée au départ ;
  chemin « Traitement › Tiers et trésorerie › Rapprochement bancaire » ;
  les bornes filtrent AUSSI la liste (`GET /rapprochements/extraits?du&au`,
  mêmes refus que l'édition). MINEURS corrigés · année bornée de 1900 à
  9998 (`ANNEE_MIN_SELECTION`, `ANNEE_MAX_SELECTION`) ; `retirerReleve`
  relit statut et correspondances DANS sa transaction (ne retire que les
  lignes libres, 409 s'il en reste) ; branche morte `?? clos[0]` retirée et
  limite du clos sans date écrite ; en-tête daté de la période des extraits
  (jamais « Toutes périodes ») ; sous-titre en UTC ; `jourIso` réemployé ;
  `compteIds` (et les pluriels) dans la liste fermée
  d'`exercice-requis.spec.ts` ; doublures qui honorent les DEUX branches de
  `apresLaCle`, relevé de 501 lignes dont deux de même rang, tête relue,
  montant changé. Relevés en attente · (m4) `depart` lit tous les clos du
  compte sans `take` (un par mois, négligeable) ; (m8) au-delà de 500
  comptes la tranche servie suit l'ordre des identifiants ; le solde de
  départ lui-même n'est pas relu pendant l'édition (réouverture concurrente
  du clos précédent). Rejoué · tsc des deux côtés, suites serveur touchées,
  2 410 tests client, scénario navigateur sur vraie base (liste bornée,
  9999 refusé, boutons de ligne).

- #46 · conditions bancaires, autorisations de financement, unions de comptes
  (`banques/conditions-bancaires.ts`, `conditions-bancaires.service.ts`,
  contrôleur `conditions-bancaires`, migration
  `20270190000600_conditions_bancaires`, quatre tables auditées et
  cloisonnées) · décision D15 (fiches des comptes 52, 56, 9011 et 9018 ;
  classe 9 des deux plans). Conditions recopiées et versionnées, aucun agio ;
  autorisation par RIB, utilisation lue sur le solde créditeur du compte à
  la date (remontée des exercices ouverts sans ouverture), dépassement dit,
  hors bilan proposé au SYSCOHADA seul ; unions d'une même monnaie, position
  « non calculée » dès qu'un solde manque ; RIB et banque retenus (409
  nommé). Fenêtre Structure › Paramètres de saisie › Conditions bancaires
  (administrateur seul, `ecriture-masquee.spec.ts`). Rejoué · tsc des deux
  côtés, 21 tests unitaires, gardes du dépôt, scénario navigateur
  `sage-l3-conditions` sur vraie base à travers une clôture (N+1 ouvert
  avant et après la clôture de N, même découvert utilisé).
  Premier tour (échecs silencieux, serveur, écran · aucun BLOQUANT), corrigé ·
  (M1 serveur) le solde se lit jusqu'au LENDEMAIN exclu, une correction
  horodatée l'après-midi échappait à minuit, l'exercice précédent sans borne
  de date ; (M4 des trois) plusieurs découverts ou facilités en cours sur le
  même compte se lisent sur leur TOTAL (`situationSurLeTotal`, ligne du RIB),
  chacune contre le solde entier fabriquait deux dépassements ; (M2) un RIB
  qui porte des déclarations garde sa devise et son journal (`modifierRib`,
  409) ; (M3) un compte tenu en devise par la racine du plan ou une ligne en
  devise n'est pas lu en francs, et une union refuse le RIB qui le tait ;
  (M4 union) deux RIB sur le même compte refusés, position « non calculée »
  pour l'existant ; formes illisibles (type de palier, paliers, membres
  d'union) refusées par leur nom avant la base ; montant borné à la colonne ;
  hors bilan proposé aux seules autorisations en cours ; déclarations des
  seuls RIB servis, les plus récentes d'abord, total compté, version en
  vigueur tue sur liste tronquée ; conflits P2025, P2003 et P2002 nommés ;
  `fusionEchelles` booléen, inchangé quand absent ; remontée épuisée « non
  calculée » ; somme en décimal exact ; soldes lus par paquets de quatre.
  Écran · (M1) saisie lue par `lib/conditions-bancaires-saisie.ts`, illisible
  refusé avec son nom, jamais envoyé en `null` (test Vitest) ; (M2) la
  lecture se range avec sa date (`lueePour`), lue à la sortie du champ ;
  (M3) un geste à la fois, boutons désactivés ; refus au bloc qui l'a
  demandé (`role="alert"`), succès en `role="status"` ; colonne hors bilan
  retirée au SYCEBNL, motif dans l'aide ; en-têtes d'action nommés, zones de
  défilement focalisables, membre d'union non lu avec son motif. Écarté ·
  (m9 écran) la page est dans `ADMIN_SEULEMENT`, pas dans les exemptions.
  Rejoué · tsc des deux côtés, specs du module, Vitest, scénario
  `sage-l3-conditions` étendu (facilité de caisse en janvier lue sur le
  total, échue en avril sans hors bilan, devise du RIB retenu refusée, taux
  illisible refusé à l'écran). Reste · second tour.

## Reste

- #37 · parité recomptée à l'intégration (les deux tours de relecture sont
  faits).
- #46 · second tour de relecture.
- #47 · taux de référence, financements, placements (`tresorerie/`) ; les
  OPCVM se tranchent par la loi avant de coder.
- Docs · `features.csv` (colonne clone de la ligne 47),
  `build-log.md`, `test-plan.md`, `parity.md`, tables 05, 13, 14, 06 de la
  comparaison ; paragraphe de la ligne au § 6 de CLAUDE.md.
- Bloc du § 3 complet des deux côtés, tests navigateur, deux tours de
  relecture, intégration sur `main`, déploiement relu, fiche retirée.

## Décisions par la loi

- **D1 (architecture.md) · le virement part d'un compte en devise.** Loi
  n° 23/053, art. 141, 1° · « Cette comptabilité est exprimée en Franc
  congolais » · le texte vise la comptabilité, pas la monnaie du compte
  bancaire. Les pièces de règlement restent en francs ; l'ordre porte, en
  plus, le montant en devise de chaque ligne (F49, `ligne-en-devise.ts`),
  et ce montant est celui que la banque exécute. Une ligne réglée en francs
  ou dans une autre devise que celle du RIB est refusée avant la première
  pièce, en nommant la ligne et l'issue (régler dans la devise du RIB, ou
  choisir un journal dont le RIB est tenu dans la monnaie du règlement).
- **D12 (architecture.md) · remises de chèques et de cartes par le 51,
  impayé au 413.** Fiche du compte 51 des deux plans (AUDCIF Titre VII ;
  SYCEBNL Partie 2 ch. 3) · 513 « chèques à encaisser » reçus non remis,
  514 « chèques à l'encaissement » remis non crédités, 515 cartes
  « jusqu'à l'avis de crédit », « débité lors de la réception, par le crédit
  des comptes de tiers concernés », « crédité pour solde, par le débit des
  comptes de trésorerie concernés » ; « en cours d'exercice, les entités ne
  sont pas tenues d'utiliser le compte 51 », obligatoire à la clôture · le
  module le tient toujours, jamais un repli. Les cartes n'ont aucun transit
  (515 jusqu'à l'avis), un type de carte à compte de transit est refusé.
  Commission « en services bancaires » · fiche du 63, 6315 « commissions sur
  cartes de crédit », 63150000 semé aux deux. Impayé · fiche du 41 des deux
  plans, « les chèques, effets à payer et autres valeurs revenus impayés
  doivent être enregistrés au compte 413 » · un numéro, deux sens · au
  SYSCOHADA par NATURE (4131 chèques, 4133 cartes), au SYCEBNL par DÉBITEUR
  et nature (4131 adhérents chèques, 4132 clients-usagers chèques, 4133
  adhérents autres valeurs, 4138 clients-usagers autres valeurs), racine
  déduite du compte du tiers (`racineImpaye`), tout autre compte refusé.
- **D13 (écrite dans architecture.md le 2026-10-22, avec le n° 39) · effets de
  commerce, lu le 2026-10-22 avant de coder.** AUDCIF Titre VII · fiche du 41 · 412
  « Clients, effets à recevoir en portefeuille » (4121), 415 « Clients,
  effets escomptés non échus », 413 « 4132 effets impayés » ; fiche du 40 ·
  402 « Fournisseurs, effets à payer » (4021, 4023) ; fiche du 51 · 511
  « effets à encaisser » (AUTRES que ceux des clients, qui restent au 412),
  512 « effets à l'encaissement » (transmis à la banque), « débité lors de
  la réception de l'effet, par le crédit des comptes de tiers concernés »,
  « crédité du montant des effets, pour solde, par le débit des comptes de
  trésorerie », exclusions · effets à payer à plus d'un an → 16, effets
  remis à l'escompte → 56 ; fiche du 56 · 565 « escompte de crédits
  ordinaires », 564 « crédits de campagne », « la créance ne disparaît pas
  du bilan » ; trois temps · (1) remise à l'escompte D 415 / C 412, (2)
  décompte D 52 net + D 675 frais et intérêts / C 565 nominal, (3) après
  l'échéance dénouée D 565 / C 415 ; fiche du 67 · 675 « escomptes des
  effets de commerce », « après la remise au banquier de l'effet à
  l'escompte, lors de la réception du bordereau d'escompte, le montant
  indiqué sur le décompte bancaire au titre des frais prélevés », les
  commissions de service → 631. UN NUMÉRO, DEUX PLANS · le SYCEBNL n'ouvre
  NI 412 effets (son 412 est « Clients-usagers »), NI 415, NI 511, NI 512,
  NI 564, NI 675 ; il ouvre 402 (4021, 4023) et 565, et sa fiche du 56 ne
  décrit AUCUN escompte · au SYCEBNL seuls les EFFETS À PAYER sont servis
  (402), les effets à recevoir et l'escompte sont SYSCOHADA seuls, refus
  nommé. TVA · décret n° 011/42, art. 57 · l'encaissement intervient « à la
  date d'échéance de la traite, même escomptée, en paiement par effet de
  commerce » ; art. 96 · le droit à déduction naît quand la taxe devient
  exigible chez le fournisseur · le moteur date aujourd'hui tout règlement
  lettré par la DATE DE SON ÉCRITURE (`reglementsDuGroupe`,
  `dateDernierReglement`) · l'acceptation D 412 / C 411 lettrée avec la
  facture ferait exigible la taxe au jour de l'effet, et non lettrée la
  laisserait en attente pour toujours · le n° 39 doit faire lire par le
  moteur l'ÉCHÉANCE de l'effet (ligne du 412 ou du 402 datée de la traite)
  comme date du règlement, aux deux sens.
- **D11 (architecture.md)** · LCR, BOR, CFONB, ETEBAC, SEPA non reproduits.

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
# test navigateur sur vraie base · script du bac à sable l3-e2e.sh (Postgres 55803, serveur 8303, client 4303)
cd e2e && npx tsc --noEmit -p . && npx playwright test tests/sage-l3-virement-devise.e2e.ts tests/sage-l3-remises.e2e.ts tests/sage-l3-effets.e2e.ts
```
