# AVANCEMENT · paquet 1, ligne C (C1, C2, C3, C4)

Copie `/home/user/wt-p1c`, branche `travail/paquet1-c` (partie de `main`
e31f4de). Points · `docs/plan-version-1.md`, § 7, ligne C. Ordre suivi · C3,
C4, C1, C2. Scénario sur vraie base ·
`/home/user/wt-passe/scripts/passe-v1/scenario-paquet1-c.mjs` (non committé ici,
le coordinateur le fera).

## Fait

### C3 · l'identifiant d'un autre dossier est introuvable (404)

**Reproduit AVANT** (main e31f4de, `p1c-avant.json`, 537 contrôles, 118
écarts dont 102 pour C3 ; rejeu C3 seul `p1c-avant-c3b.json`, 513 contrôles,
101 écarts). Deux dossiers A et B par référentiel (SYSCOHADA normal, SYCEBNL
associations), A lit avec les identifiants de B. Réponses lues AVANT ·

| Réponse de main | Nombre | Exemples |
|---|---|---|
| 200 vide (exercice de B) | 54 | `GET /ecritures/balance`, `/circularisation`, `/analytique/od`, `/controles`, `/provisions`, `/retenues/registre` |
| 400 « Exercice introuvable pour ce dossier » | 19 | `/analytique/etats/*`, `/creances-douteuses*` |
| 400 « Compte introuvable pour ce tenant » | 8 | `/ecritures/grand-livre/:compteId`, `/exports/grand-livre/:compteId` (exercice de B · 4, compte de B · 4) |
| 404 « Ce compte n'a rien de dû sur cet exercice. » | 4 | `/relances/releve/:compteId` (exercice de B · 2, compte de B · 2) |
| **201, une provision CRÉÉE** | 2 | `POST /provisions/:exerciceId` · dans le dossier A, rattachée à l'exercice de B (vérifié en base, voir relevé R1) |
| autres 400 et 404 de service | 5 | monnaie fonctionnelle (2), effet de change, plan sans budget, impôt à annuler |
| 200 sur le journal de B en filtre | 8, puis 2 | `/ecritures` (avec et sans exercice), `/ecritures/brouillard`, `/exports/journal` ; `/modeles-saisie` (ajouté au rejeu `p1c-avant-c3b`) |
| 404 « Cette cellule n'appartient pas à ce groupe » | 2 | `/groupe/cellules/:celluleId/balance` · réponse JUSTE (cellule aléatoire), le contrôle du scénario a été corrigé (cette route lit l'exercice d'une cellule) |

`POST /ecritures/valider-jusqua` (exercice ou journal de B) rendait DÉJÀ 404
(commit 6386c7d) · non reproduit, le scénario le garde. Les justificatifs de
solde (compte de B) rendaient déjà 404.

**Cause commune.** Tous ces paramètres passaient par le porteur
`EXERCICE_REQUIS` / `EXERCICE_FACULTATIF` (`src/common/exercice-requis.ts`,
F234), qui ne vérifiait que la FORME. Un identifiant bien formé d'un autre
dossier passait, et chaque service en faisait ce qu'il voulait. La garde de
cloisonnement n'y peut rien et n'a pas été touchée · la requête
`{ tenantId: session, exerciceId: B }` est bornée, son résultat vide.

**Correction.**
- `src/common/exercice-requis.ts` · les deux porteurs deviennent des pipes
  INJECTABLES (`ExerciceRequisDuDossier`, `ExerciceFacultatifDuDossier`, mêmes
  noms exportés `EXERCICE_REQUIS`, `EXERCICE_FACULTATIF`) · format inchangé
  (ParseUUIDPipe, 400 nommés d'avant), PUIS appartenance au dossier de la
  SESSION (`acteurCourant().tenantId`, le contexte que pose l'intercepteur
  d'audit, le même que la garde de cloisonnement), 404
  `MESSAGE_EXERCICE_HORS_DOSSIER` (« Exercice introuvable dans ce dossier. »),
  le même texte pour un identifiant inconnu partout et celui d'un voisin.
  Sans contexte de session · panne (500), jamais un passage silencieux.
  Troisième porteur, `EXERCICE_D_UNE_CELLULE`, format seul, pour la SEULE
  route où l'exercice n'est pas celui de la session (`GET
  /groupe/cellules/:celluleId/balance`, exercice de la cellule ;
  `GroupeService.balanceCellule` juge cellule puis exercice, 404 nommés).
- `src/common/journal-du-dossier.ts` · `JOURNAL_FACULTATIF`, même mécanique
  pour le `journalId` en filtre (liste des écritures, brouillard, export du
  journal, modèles de saisie) · absent reste absent, illisible 400 nommé,
  d'un autre dossier 404 « Journal introuvable dans ce dossier. ».
- `EcritureService.grandLivre` · compte hors dossier en 404
  (`MOTIF_COMPTE_INTROUVABLE_GRAND_LIVRE`) au lieu de 400, comme le
  justificatif de solde.
- `RelancesService.releve` · le compte est jugé AVANT les positions, 404
  `MOTIF_COMPTE_INTROUVABLE_RELEVE` au lieu de « rien de dû ».
- `CLAUDE.md` § 6, paragraphe F234 · la règle nouvelle, une phrase.

**Tests ajoutés ou étendus.** `src/common/exercice-requis.spec.ts` (porteurs
instanciés comme Nest les instancie, doublure Prisma qui honore `id` ET
`tenantId`, joués dans une session · chaque route rend 404 nommé pour
l'exercice d'un autre dossier ; liste fermée du format seul ; toute route
porteuse derrière `JwtAuthGuard` ; requête bornée au dossier de la session ;
panne sans session ; toute route qui lit `journalId` en requête porte
`JOURNAL_FACULTATIF`, jouée 400 / 404 / passage). Adaptés sans rien
retirer · `exercice-requis-routes.spec.ts` (404 du voisin en plus),
`consolidation/perimetre.service.spec.ts`, `ifrs/ifrs.service.spec.ts`,
`exports/grand-livre-complet-en-flux.spec.ts` (le porteur est présent ET sa
forme est un ParseUUIDPipe, au lieu de « une instance ParseUUIDPipe » que la
classe injectable n'est plus), `comptabilite/grand-livre.spec.ts` (404 au lieu
du message 400). Nouveau · `relances/releve-compte-introuvable.spec.ts`.

**Rejoué APRÈS** (`p1c-apres-c3.json`, serveur compilé de la copie, base
`p1c_apres_c3`) · 513 contrôles, 513 concordances, 0 écart, 0 erreur HTTP ;
les 151 routes porteuses (144 requises, 6 facultatives, 1 au format seul)
jouées chacune dans au moins un référentiel (aucune route refusée en 403 dans
les deux), plus compte (5 routes), journal (4 routes, dont les modèles de saisie, + sans exercice),
validation par lot. Requête de contrôle en base (relevé R1) · 2 provisions
croisées sur la base AVANT, 0 APRÈS.

**À travers une clôture** (ajouté au scénario après coup, CLAUDE.md § 10 ·
`p1c-apres.json`) · dans chaque référentiel, un dossier C (apport validé),
2026 clôturé puis 2027 ouvert par la clôture · aucune des lectures du tableau
(107 au SYSCOHADA, 118 au SYCEBNL, hors 403) ne dit introuvable ni l'exercice
CLÔTURÉ ni celui qui naît, et le grand livre de la banque rend 1 000 000 des
deux côtés (l'apport, puis son à-nouveau). Le porteur juge l'appartenance au
dossier, jamais le statut.

#### Routes couvertes (relues sur le `dist` compilé, `routes-c3.txt`)

Porteur REQUIS (144) · DELETE /ifrs/effet-change/:exerciceId ;
GET /affectation-resultat/exercice/:exerciceId ; GET /analytique/engagements ;
GET /analytique/engagements/ecritures-rattachables ; et les 140 autres GET,
POST et PATCH relevés dans le tableau `ROUTES_EXERCICE` du scénario (les 151
routes du tableau sont exactement celles du `dist`, comparées le 2026-10-09).
Routes d'ÉCRITURE porteuses · POST /fiscalite/exercices/:exerciceId/retraitements,
POST /fiscalite/exercices/:exerciceId/ecriture-impot,
POST /fiscalite/exercices/:exerciceId/ecriture-impot/annuler,
PATCH /fiscalite/exercices/:exerciceId/dossier, DELETE
/ifrs/effet-change/:exerciceId, POST /provisions/:exerciceId.
Porteur FACULTATIF (6) · GET /ecritures, GET /exports/journal, GET
/questionnaire-revision, GET /inventaire, GET /faiblesses, GET /circularisation.
Format seul (1) · GET /groupe/cellules/:celluleId/balance.
Journal en filtre (4) · GET /ecritures, GET /ecritures/brouillard, GET
/exports/journal, GET /modeles-saisie.
Compte dans l'adresse (service) · GET /ecritures/grand-livre/:compteId, GET
/exports/grand-livre/:compteId, GET /relances/releve/:compteId (les deux
justificatifs de solde rendaient déjà 404).

### C4 · l'observation « société unipersonnelle » sur les faits déclarés

**Reproduit AVANT** (`p1c-avant.json`, 6 écarts) · l'observation de
l'art. 63, al. 2, 1° était servie à TOUTE SA, SARL ou SAS, sur la seule
forme (`regimeSelonForme`) · lu AVANT « servie » (`true`) pour · SARL sans
fait ; SARL à associé unique personne morale ; SA sans fait ; SAS dont
l'unicité n'est pas dite ; SAS déclarée pluripersonnelle ; SASU à associé
personne morale. Le test `fiscalite.spec.ts` gelait le défaut (« signale à
une SARL l'anomalie de l'art. 63 »).

**Texte lu** (`fiscalite-rdc`, `code-general-2026`, loi n° 23/053) · art. 3
(SA, SARL, SAS imposables à l'IS « même unipersonnelles ») ; art. 63, al. 2,
1° (« l'associé unique d'une société à responsabilité limitée ou [...]
l'actionnaire unique d'une société anonyme ou d'une société par action
simplifiée, lorsque cet associé ou cet actionnaire est une personne
physique »). AUSCGIE (`auscgie-acte-uniforme`) · art. 853-2, al. 2 (la SAS qui
« ne comprend qu'un associé », SASU) ; art. 309, al. 2 (SARL « instituée par
une personne physique ou morale ») ; art. 385, al. 2 (« La société anonyme
peut ne comprendre qu'un seul actionnaire »).

**Décision par la loi.** L'art. 63 pose DEUX faits, l'unicité et la personne
physique. Le dossier en déclare deux, pour la SAS seulement ·
`associeUniqueSas` (art. 853-2) et `associeUniquePersonneMorale` (art. 201,
al. 4). Servie · SASU déclarée dont l'associé est déclaré non personne morale
(donc personne physique) ; SASU dont la nature n'est pas déclarée, AVEC la
condition dite (`COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE`). Jamais servie ·
SARL, SA (aucun fait ne dit l'unicité à associé personne physique), SAS non
déclarée unipersonnelle (« pas encore dit » n'est pas « oui »), SASU à associé
personne morale (l'art. 63 vise la personne physique). Aucun fait créé.

**Correction.** `src/modules/fiscalite/fiscalite.service.ts` ·
`unipersonnaliteDeLArticle63` (règle pure), `regimeSelonForme` reçoit les deux
faits du dossier, `resultatFiscal` les passe.

**Tests.** `fiscalite.spec.ts` · le test qui gelait le défaut est remplacé par
la table complète (dix cas, régime IS gardé, SNC sans observation) et la règle
pure est jouée seule (neuf cas).

**Rejoué APRÈS** (`p1c-apres-c4.json`) · 10 contrôles, 10 concordances (les
six écarts d'AVANT, plus la condition dite ou non).

**Proposition (non codée).** Un fait pour la SARL et la SA unipersonnelles
(AUSCGIE art. 309, al. 2 ; art. 385, al. 2), par exemple « associé ou
actionnaire unique » OUI / NON / PAS_ENCORE_DIT, sans défaut · avec
`associeUniquePersonneMorale`, il permettrait de servir l'observation SANS
condition à la SARL et à la SA à associé unique personne physique, et de la
retirer à la société déclarée pluripersonnelle. Décision de Manasse (ajout
d'un champ, hors gel).

**Revu au premier tour de relecture (constat 2, point S2).** La règle
« jamais servie » de la SARL, de la SA et de la SAS non déclarée lisait un
silence comme un « non » · voir S2 ci-dessous ; elle se sert désormais sous
condition dite.

### C1 · le plafond de l'art. 69, 1 se juge au centime

**Reproduit AVANT** (`p1c-avant.json`, 10 contrôles, 6 écarts) · dossier
SYSCOHADA, simulation de mars 2026, salaire 1 000 000, trois enfants
bénéficiaires, taux légal calculé (annexe 2 du décret n° 25/22, colonne 19,
796,30 × 26 × 3) ·
- allocation 62 111,40 · imposable lu `7.275957614183426e-12` (attendu 0),
  motif sans « entièrement immunisée », motif « Seul l'excédent de 0.00 FC
  est imposable » ;
- allocation 62 111,45 · imposable lu `0.05000000000291038` (attendu 0,05) ;
- deux lignes 20 000,10 + 42 111,30 · imposables lus `[0, 7.275957614183426e-12]`,
  motif « excédent de 0.00 FC ».
Les bases fiscales brutes concordaient déjà (1 000 000 et 1 000 000,05) · le
bruit restait sous le centime de la base, il se voyait au motif et à la ligne.

**Cause.** Le taux légal est un produit de flottants (796,3 × 26 × 3 =
62 111,399999999994) et la consommation ligne à ligne du plafond en ajoute
(62 111,40 − 20 000,10 = 42 111,299999999996).

**Correction.** `src/modules/personnel/au-centime.ts` (nouveau, sans import) ·
le porteur `auCentime` de la paie y descend depuis `decompte-final-emis.ts`,
qui le réexporte (l'importer de là depuis les assiettes aurait noué un cycle
assiettes → décompte émis → passation → assiettes). `assiettes-paie.ts` ·
plafond restant, part immunisée, reste et excédent ramenés au centime ; la
règle du plafond (« dans la mesure où elles ne dépassent pas les taux
légaux », seul l'excédent repris) n'est pas touchée. `personnel.service.ts` ·
le taux légal calculé est rendu au centime (la colonne 19 est au centime,
transcrite ou tirée de la grille du cabinet par `arrondiAnnexe` ; enfants et
jours sont entiers, le produit exact a deux décimales). Un taux SAISI par le
cabinet reste tel quel (les assiettes le ramènent au centime). Écran · rien à
changer, `PersonnelPage.tsx` écrit déjà ces montants par `lib/montants.ts`.

**Tests.** `assiettes-paie.spec.ts` · bloc « C1 · le plafond de l'article 69,
1 se juge au centime », joué sur le taux tel que le flottant le rend (témoin
qui le vérifie), quatre cas · égal au taux (imposable 0, « entièrement
immunisée », base 1 000 000), cinq centimes au-delà (0,05, motif, base
1 000 000,05), deux lignes ([0, 0], base 1 000 000), excédent entier repris
(37 888,60). `simulation-paie.spec.ts` · le service rend 62 111,40 exactement
et l'allocation de ce montant est entièrement immunisée. Sans la correction,
cinq de ces tests tombent (vérifié en retirant les deux fichiers corrigés).

**Rejoué APRÈS** (`p1c-apres-c1.json`) · 10 contrôles, 10 concordances.

### C2 · l'abstention des allocations familiales dit ce qui manque, en français

**Reproduit AVANT** (`p1c-avant.json`, 8 contrôles, 4 écarts) · simulation
SYSCOHADA, salaire 1 000 000 et allocations 50 000 ·
- mars 2026, enfants non renseignés · l'explication contient
  `RESOLUTION_TAUX_LEGAL_ALLOCATIONS` (nom de constante, affiché tel quel dans
  l'encadré « La simulation s'abstient plutôt que de supposer » de l'écran
  Personnel) et ne dit pas quoi faire (« renseignez » absent) ;
- mars 2019 (aucune grille du SMIG), deux enfants renseignés · même nom
  interne, et rien sur la saisie du taux légal du mois.

**Correction.** `assiettes-paie.ts` · `explicationTauxLegalNonChiffre`
(exportée) bâtit le message · la règle (art. 69, 1 de la loi n° 23/053, relu
dans `fiscalite-rdc`, `code-general-2026/references/05-loi23-053-titre3-irpp.md`,
et la colonne 19 de la grille du SMIG du mois, décret n° 25/22), puis la cause
et son geste · ENFANTS non renseignés → « Renseignez le nombre d'enfants
bénéficiaires des allocations familiales (il ne se confond pas avec les
personnes à charge de l'impôt) » ; MOIS sans grille → la raison telle que la
grille la rend (`annexeApplicable`) puis « Saisissez le taux légal du mois » ;
cause inconnue → les deux. Nouveau paramètre facultatif
`tauxLegalAllocationsNonCalcule` (type `TauxLegalNonCalcule`) · aucun fait
nouveau du dossier, seulement ce que le service sait déjà.
`personnel.service.ts` · `tauxLegalNonCalcule` lit la cause sur les mêmes faits
que le calcul du taux, LA GRILLE D'ABORD (un mois sans grille ne se règle pas
en renseignant les enfants), et la passe aux deux appels des assiettes. La
constante `RESOLUTION_TAUX_LEGAL_ALLOCATIONS` reste dans le code, inchangée.
Le motif (`TAUX_LEGAL_ALLOCATIONS_FAMILIALES_NON_FOURNI`) n'est pas affiché à
l'écran (seuls libellé, montant et explication le sont), il n'est pas touché.

**Tests.** `assiettes-paie.spec.ts` · bloc « C2 », six tests (témoin de la
grille de mars 2019, chaque cause avec son geste et sans celui de l'autre,
cause inconnue, règle et colonne 19 dans chaque variante, aucun identifiant du
code). `simulation-paie.spec.ts` · le service passe la bonne cause (mars 2026
sans enfants, mars 2019 avec et sans enfants, taux saisi qui lève
l'abstention). Sans la correction, le spec des assiettes ne compile plus et le
test de simulation tombe. L'ancien test d'abstention (sans cause) garde ses
attentes (« 25/22 », « colonne 19 »).

**Rejoué APRÈS** (`p1c-apres-c2.json`) · 8 contrôles, 8 concordances.

### Rejeu APRÈS complet

`p1c-apres.json` (base `p1c_apres`, serveur compilé de la copie au commit de
C2, horloge 2028-02-15) · les quatre points sur une base neuve · 551
contrôles, 551 concordances, 0 écart, 0 erreur HTTP, 2 notes (routes sautées
en 403 dans un référentiel, jouées dans l'autre). AVANT (`p1c-avant.json`,
`main` e31f4de) · 537 contrôles, 118 écarts (le scénario a gagné depuis les
contrôles « condition dite » de C4 et la traversée de clôture de C3).

## Premier tour de relecture (échecs silencieux) · sept constats

Points `S1` à `S7` du scénario (`PAQUET1_C_POINTS=S1`…), un commit par
constat, chacun reproduit contre `main` (base `p1c_avant`, port 8781) puis
rejoué sur la copie (base `p1c_apres`, port 8782).

### S1 · constat 1 (BLOQUANT) · les seuils de la paie au centime

Loi n° 23/053, art. 69, 8, a) relu dans la compétence `fiscalite-rdc`
(code-general-2026, titre 3) · « pour autant que · a) l'indemnité de logement
ne dépasse 30 % de la rémunération » · à 30 % EXACTEMENT, la condition est
remplie. `assiettes-paie.ts` comparait le total du logement au produit
flottant · 131 072,30 × 30 / 100 = 39 321,689999999995, et un logement de
39 321,69 FC (30 % pile) était imposé EN ENTIER.

Les autres comparaisons de seuil de la paie, relues une à une ·
- **plancher de la CNSS** (`cotisations-paie.ts`, décret n° 18/041, art. 8 ;
  loi n° 16/009, art. 13, « en aucun cas ») · MÊME DÉFAUT · cinq lignes de
  559 000 FC en tout s'additionnent à 558 999,9999999999, « sous le plancher »,
  CNSS, impôt et net non chiffrés · CORRIGÉ ;
- **minimum de la classe** (`regles-contrat-travail.ts`, décret n° 25/22 ;
  Code du travail, art. 88, al. 2) · MÊME DÉFAUT avec une grille du cabinet aux
  centimes · 104 920,05 × 26 = 2 727 921,3000000003, un contrat au minimum
  exact dit « en deçà » (manque 4,7e-10 FC) · CORRIGÉ ;
- **plafond de 30 % de l'art. 118** (`bareme-irpp.ts`) · PAS DE DÉFAUT ·
  l'assiette est arrondie au millier (art. 118), son produit par 30 / 100 est
  exact, et l'égalité impôt du barème = 30 % ne tombe qu'à 77 932 800 FC, qui
  n'est pas un multiple de mille ; même si elle tombait, le montant retenu est
  le même des deux côtés (seule une réserve en dépendrait) ;
- **art. 116, 1 (« dans la limite de 5 % »)** · non calculé par le moteur
  (cité au commentaire de tête des assiettes, comme exemple de plafond) · rien
  à corriger ;
- **net négatif** (`personnel.service.ts`, retenues d'avance) · NON CORRIGÉ,
  consigné (relevé R6 ci-dessous) · le net porte des fractions de centime
  (cotisations non arrondies), le seuil n'y a pas de bord exact au centime.

Correction · `au-centime.ts` porte `enCentimes` (centimes ENTIERS, même règle
que le registre des avances `avances-salaire.ts`) ; logement · total × 100 ≤
rémunération × 30 sur des entiers, et le plafond se dit au millième quand il
en porte un (30 % de 131 072,33 = 39 321,699, qui s'affichait « 39321.70 » à
côté d'un total de 39 321,70 dit au-dessus) ; plancher · centimes de
l'assiette contre centimes du plancher ; minimum · arrondi au centime,
conformité et manque en centimes. Tests · `assiettes-paie.spec.ts` (bord exact,
deux lignes, millième, témoin du flottant), `cotisations-paie.spec.ts` (cinq
lignes, grille du cabinet), `regles-contrat-travail.spec.ts` (minimum exact et
un centime dessous) · 5 tombent sans la correction.

**AVANT** (`p1c-s1-avant.json`, `main`) · 11 contrôles, 9 écarts · logement
30 % pile imposable 39 321,69 et base brute 170 393,99 ; plafond affiché
« 39321.70 » ; CNSS « ASSIETTE SOUS LE PLANCHER · 558999.9999999999 FC contre
559000 FC », quote-part non chiffrée ; MBOMBO au minimum exact
`[false, 4.656612873077393e-10]`, LIKOFO `[false, 0.01000000024214387]`.
**APRÈS** (`p1c-s1-apres.json`) · 11 contrôles, 11 concordances.

### S2 · constat 2 (MAJEUR) · l'unicité non déclarée n'est pas un « non »

Texte relu · loi n° 23/053, art. 63, al. 2, 1° (`fiscalite-rdc`,
code-general-2026, titre 3) · « de l'associé unique d'une société à
responsabilité limitée ou de l'actionnaire unique d'une société anonyme ou
d'une société par action simplifiée, lorsque cet associé ou cet actionnaire
est une personne physique » ; AUSCGIE (`auscgie-acte-uniforme`) art. 309,
al. 2 (SARL « instituée par une personne physique ou morale »), art. 385,
al. 2 (SA « ne comprendre qu'un seul actionnaire »), art. 853-2, al. 2 (SASU).
Le constat est EXACT · C4 ne servait rien à la SARL et à la SA (aucun champ ne
déclare leur unicité) ni à la SAS dont l'unicité n'est pas dite, si bien que la
SARL à associé unique personne physique, que l'article nomme le PREMIER,
perdait l'observation sans un mot (faux négatif silencieux).

**Décision par la loi.** Un silence n'est pas un « non » · l'observation se
sert avec sa condition (« ne vaut que si la société n'a qu'un associé ou
actionnaire, personne physique ») partout où le dossier ne tranche pas · SARL
et SA (`COMPLEMENT_UNICITE_NON_DECLARABLE`, art. 309 et 385 cités), SAS à
unicité non dite (`COMPLEMENT_UNICITE_NON_DECLAREE`, qui nomme le champ
« Associé unique (SASU) » de Paramètres du dossier, section Immatriculation).
Rien seulement sur un fait DÉCLARÉ qui l'écarte · SAS déclarée « non », ou
associé unique déclaré personne morale (toute forme). SASU déclarée · comme C4
(sans condition si l'associé est déclaré non personne morale, condition de
nature sinon). Aucun fait créé (la proposition de C4 reste à Manasse).

**Correction.** `fiscalite.service.ts` · `unipersonnaliteDeLArticle63` rend
quatre issues (`UNICITE_NON_DECLAREE`, `UNICITE_NON_DECLARABLE` en plus),
`observationArticle63` en tire la phrase. **Tests.** `fiscalite.spec.ts` · la
table de C4 gelait le faux négatif · réécrite sur douze cas (SA et SAS à
associé personne morale ajoutés), la règle pure sur douze cas, et les deux
conditions vérifiées sur leur phrase commune.

**Scénario modifié** (`scenario-paquet1-c.mjs`, non committé) · point S2
ajouté ; dans C4, trois contrôles renversés (SARL, SA, SAS non dite · « servie
sous la condition d'unicité » au lieu de « non servie ») et `conditionDite`
lit « ne vaut que s'il est une personne physique ».

**AVANT, `main`** (`p1c-s2-avant.json`, S2 et C4) · 18 contrôles, 14 écarts ·
`main` sert l'observation sans condition à toute SA, SARL et SAS (`[true,
false]`), y compris déclarée pluripersonnelle ou à associé personne morale.
**AVANT, copie au commit 0ff7342** (`p1c-s2-copie-avant.json`, S2) · 8
contrôles, 4 écarts · SARL sans fait, SARL « non personne morale », SA sans
fait, SAS non dite lues `[false, false]` (rien servi). **APRÈS**
(`p1c-s2-apres.json`, S2 et C4) · 18 contrôles, 18 concordances.

### S3 · constat 3 (MINEUR) · un montant de paie est au centime

Constat EXACT · `ElementPaieDto.montantFc` n'avait aucune borne de décimales
(les autres montants de la paie en ont deux, la base garde des Decimal 18,2) ;
une allocation de 50 000,005 FC sous un taux légal de 62 111,40 FC rendait,
depuis l'arrondi de C1, une part immunisée de 50 000,01 et une part imposable
de −0,01 FC. Aucune question de fond.

**Correction.** `dto/personnel.dto.ts` · `@IsNumber({ maxDecimalPlaces: 2 })`
avec un refus nommé en français (`MOTIF_MONTANT_AU_CENTIME`) ;
`assiettes-paie.ts` · l'immunité ne dépasse jamais le montant
(`Math.min(element.montantFc, auCentime(…))`), pour un appelant interne.
L'écran n'est pas touché (le refus du serveur s'y affiche). **Tests.**
`dto-passe-d2.spec.ts` (50 000,005 refusé avec le motif, 50 000,01 admis),
`assiettes-paie.spec.ts` (millième · imposable 0, base 1 000 000) · 2 tombent
sans la correction.

**AVANT, `main`** (`p1c-s3-avant.json`) · 3 contrôles, 2 écarts · 50 000,005
admis (`[201, 0]`), aucun refus. **AVANT, copie au commit 93eddc6**
(`p1c-s3-apres-avantcorr.json`) · admis, imposable `-0.01`. **APRÈS**
(`p1c-s3-apres.json`) · 3 contrôles, 3 concordances ; S1 et C1 rejoués avec,
23 concordances.

### S4 · constat 4 (MINEUR) · le compte en filtre d'un autre dossier est introuvable

Constat EXACT · `GET /rapprochements?compteId=` (`rapprochement.service.ts`,
`lister`) et `GET /relances/historique?compteId=` (`relances.service.ts`,
`historique`) filtraient sur un `compteId` lu nu · le compte d'un autre
dossier, ou « abc », rendait 200 et une liste vide. Même règle que l'exercice
et le journal de C3.

**Correction.** `src/common/compte-du-dossier.ts` · `COMPTE_FACULTATIF`
(`CompteFacultatifDuDossier`), porteur injectable sur le modèle de
`JOURNAL_FACULTATIF` · absent reste absent, illisible 400 nommé
(`MESSAGE_COMPTE_ILLISIBLE`), d'un autre dossier 404 « Compte introuvable dans
ce dossier. », lu dans le dossier de la SESSION. Posé sur les deux routes.
**Tests.** `exercice-requis.spec.ts` relit désormais aussi les `compteId` des
contrôleurs (métadonnées) · toute route qui lit `compteId` en requête porte le
porteur, ou figure avec son motif dans une liste fermée (la caisse de
`apercuPvCaisse`, requise et déjà jugée par le service) ; chaque porteur est
joué (absent, illisible, voisin, du dossier) et la doublure honore le `where`
· 2 tombent sans la correction.

**AVANT, `main`** (`p1c-s4-avant.json`) · 9 contrôles, 4 écarts · compte de B
`statut 200 · []` et `{"relances":[],"total":0,…}`, « abc » 200. **APRÈS**
(`p1c-s4-apres.json`) · 9 contrôles, 9 concordances (404 et 400 nommés, le
témoin rend le rapprochement de A).

### S5 · constat 5 (MINEUR) · le garde-fou voit l'identifiant porté par un DTO de requête

Constat EXACT · `exercice-requis.spec.ts` ne lisait que les paramètres NOMMÉS
(`@Query('exerciceId')`) ; un `@Query()` entier lu par un DTO lui échappait.
Recensés · sept DTO de requête (`FiltreJournalAuditDto`, `FiltreRegistreDto`,
`ListerDevisDto`, `ListerExonerationsDto`, `ListerFacturesDto`,
`ListerFileDto`, `ListerOrdresDto`), un seul porte un identifiant à porteur ·
`FiltreRegistreDto.exerciceId` (`GET /registre-donateurs`). La route, elle, est
déjà juste (`@IsUUID('4')` 400, `DonationService.lister` 404 « Exercice
introuvable pour ce dossier. ») · le défaut est l'aveuglement du garde-fou.

**Correction.** `exercice-requis.spec.ts` lit le type du paramètre
(`design:paramtypes`) de chaque `@Query()` entier et les champs que le DTO
admet (métadonnées de class-validator · le ValidationPipe global refuse tout
autre champ) ; un DTO qui déclare `exerciceId`, `journalId` ou `compteId` fait
tomber le test, sauf à figurer avec la preuve de son jugement au service dans
une liste FERMÉE (`IDENTIFIANTS_DANS_UN_DTO_DE_REQUETE`, une ligne · le
registre des donateurs). Le recensement vérifie qu'il trouve des DTO et leurs
champs (retirer la ligne fait tomber le test sur
`FiltreRegistreDto exerciceId`, éprouvé).

**Sur vraie base** (`p1c-s5-avant.json`, `p1c-s5-apres.json`) · 3 contrôles,
3 concordances des deux côtés (404, 400, témoin 200) · aucun changement de
comportement, comme attendu.

### S6 · constat 6 (MINEUR) · l'exercice d'un CORPS, et la purge du relevé R1

Constat EXACT, et CONSIGNÉ, non aligné. Un `exerciceId` de corps d'un autre
dossier rend 400 « Exercice introuvable pour ce tenant » là où une route rend
404. Ce n'est pas une règle unique, commune et sûre · le refus « Exercice
introuvable » en 400 est écrit en TRENTE-TROIS endroits de douze services
(`ecriture.service.ts` 3, `immobilisation.service.ts` 13, `devises.service.ts`
4, `regularisation.service.ts` 3, `demantelement.service.ts` 3, analytique 2,
reprise de subvention, location-acquisition, contrôles, paie, créances
douteuses 1 chacun), sept lectures rattrapent `instanceof BadRequestException`
pour en faire un motif (IFRS 4, états consolidés, courrier, abonnements · un
404 y traverserait la page au lieu d'être dit), et l'import d'écritures
rattrape tout refus de `controlesDEntree` en anomalie de ligne. Changer le type
dans ces services changerait ce que ces lectures montrent ; le refus, lui, est
juste et nommé (rien n'est écrit, prouvé en base ci-dessous). Relevé R2 tenu à
jour.

**Sur vraie base** (`p1c-s6-avant.json`, `p1c-s6-apres.json`, point S6 du
scénario) · (a) `POST /ecritures` et `POST /ecritures/imputation-ouverture`
avec l'exercice de B dans le corps · 400 « Exercice introuvable pour ce
tenant » des deux côtés, aucune écriture de plus dans A ni rattachée à
l'exercice de B (comptées EN BASE, la balance de A ne verrait pas une écriture
de A posée sur l'exercice de B), témoin 201. (b) Relevé R1 · AVANT, la
provision de A sur l'exercice 2027 (vide) de B est créée (201), la requête
de contrôle rend 1, et l'arrêt à la dissolution sans liquidation de B (AUSCGIE
art. 201 al. 4, qui retire l'exercice postérieur vide,
`exercice.service.ts:1381`) tombe en 500 (`Foreign key constraint violated:
provisions_risques_charges_exerciceId_fkey`, journal du serveur) · B est
ENFERMÉ par une ligne qu'il ne voit pas. La purge préparée (ci-dessous, relevé
R1), jouée sur la base JETABLE, ramène la requête à 0, et le second arrêt passe
(2026 finit le 30/09/2026, 2027 retiré). APRÈS · 404 à la création, 0 en base,
l'arrêt passe du premier coup · 11 contrôles, 11 concordances (AVANT 3 écarts,
les trois de R1).

### S7 · constat 7 (MINEUR) · le champ de l'associé unique, nommé où il est

Constat EXACT · `COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE` renvoyait à
« identité du dossier, “associé unique personne morale” », qu'aucun écran ne
porte ; le champ vit dans Paramètres du dossier, section Immatriculation,
« Associé unique personne morale », sous « Régime de la liquidation »
(`ParametresDossierPage.tsx`), et son infobulle ne parlait que de la
dissolution (AUSCGIE art. 201 al. 4). Vérifié · la ligne s'affiche pour toute
société commerciale (`faitsDeLaForme(...).liquidation` et `associeUniquePm`,
aucune date de dissolution), part dans le corps sans elle
(`faitsDeLaFormeAEnvoyer`), et le serveur la reçoit sans elle
(`TenantService`, refus seulement hors société commerciale).

**Correction.** Le complément nomme le champ et dit que la réponse vaut hors
de toute dissolution (la phrase de condition, relue par le banc, est gardée) ;
l'infobulle dit l'art. 201 al. 4 ET que la réponse se donne aussi hors
dissolution, l'observation fiscale de l'associé personne physique en dépendant
(loi n° 23/053, art. 63, al. 2, 1°). **Test.**
`client/src/pages/associe-unique-hors-dissolution.spec.ts` relit les deux
compléments du SERVEUR et l'écran · chaque libellé cité après « section
Immatriculation » est une `<Ligne>` de cette section, la ligne n'est soumise à
aucune date de dissolution, le corps part sans elle (SARL et SAS), l'infobulle
le dit · 3 tests sur 5 tombent sur les textes d'avant (éprouvé).

**AVANT, `main`** (`p1c-s7-avant.json`, point S7, SASU sans dissolution) ·
5 contrôles, 2 écarts (le complément ne nomme pas le champ, ne dit rien de la
dissolution ; `main` sert d'ailleurs l'observation sans condition, voir S2).
**APRÈS** (`p1c-s7-apres.json`) · 5 concordances · « non » reçu sans
dissolution, la dissolution reste vide, la condition tombe. S2 et C4 rejoués
après le changement de texte · 18 concordances (`p1c-s7-s2c4-apres.json`).

## Reste (au coordinateur, à l'intégration)

- Committer le scénario `/home/user/wt-passe/scripts/passe-v1/scenario-paquet1-c.mjs`.
- Relectures du § 11 (échecs silencieux, serveur), bloc du § 3 complet des
  deux côtés (`npx jest` entier non lancé ici, consigne), tests navigateur.
- Relevé R1 · la requête en production AVANT l'intégration, par Manasse, et la
  purge préparée s'il rend des lignes (étapes 1 à 4 du relevé).
- Retirer cette fiche et la branche `travail/paquet1-c` à l'intégration.

## Décisions

- C4 · par la loi (art. 3 et art. 63, al. 2, 1° de la loi n° 23/053 ; AUSCGIE
  art. 853-2, al. 2, 309, al. 2, 385, al. 2) · l'observation ne se sert jamais
  sur la forme seule ; aucun fait créé, la proposition pour la SARL et la SA
  est à Manasse. Revu au constat 2 (S2) · servie SOUS CONDITION DITE quand
  l'unicité n'est pas déclarée ou pas déclarable, retirée seulement sur un
  fait déclaré qui l'écarte.
- C1 · aucune question de fond · la règle du plafond (art. 69, 1, « dans la
  mesure où elles ne dépassent pas les taux légaux ») est inchangée ; seul
  l'arrondi au centime, celui des montants gardés en base (Decimal 18,2) et de
  la colonne 19, est posé.
- C2 · le message suit la cause que le service connaît, LA GRILLE D'ABORD ·
  un mois sans grille du SMIG ne se règle pas en renseignant les enfants (le
  taux saisi seul lève l'abstention, il prime déjà dans le service). La
  constante de résolution reste la référence du code.
- C3 · aucune question de fond · un identifiant que le dossier ne porte pas
  est introuvable (404), comme `MOTIF_EXERCICE_INTROUVABLE` (F222) et le
  justificatif de solde le disaient déjà. Le message ne dit pas « d'un autre
  dossier » (ne pas apprendre au client qu'un exercice existe ailleurs).

## Relevés (non codés, hors périmètre)

- **R1 · données croisées déjà en production ?** Sur `main`, `POST
  /provisions/:exerciceId` avec l'exercice d'un autre dossier CRÉAIT une
  provision dans le dossier de la session, rattachée à l'exercice du voisin
  (clé étrangère sans dossier). Les cinq autres routes d'écriture porteuses
  refusaient déjà par leur service. CONSÉQUENCE PROUVÉE en base (S6) · la clé
  étrangère (RESTRICT) ENFERME le voisin · l'arrêt à la dissolution sans
  liquidation, qui retire son exercice postérieur vide
  (`exercice.service.ts:1381`), tombe en 500. Aucune table ne référence
  `provisions_risques_charges` (aucune ligne dépendante à retirer). La session
  NE TOUCHE PAS à la production · à passer par Manasse, sur l'endpoint DIRECT
  (`API_DATABASE_URL`, jamais affiché), AVANT l'intégration :
  1. Contrôle · `SELECT count(*) FROM provisions_risques_charges p JOIN
     exercices e ON e.id = p."exerciceId" WHERE e."tenantId" <> p."tenantId";`
     (rend 1 sur la base AVANT du point S6, 0 APRÈS). Zéro · rien à faire.
  2. S'il rend des lignes, les LIRE et les garder (copie au suivi) avant toute
     retouche · `SELECT p.id, p."tenantId", p."exerciceId", e."tenantId" AS
     "tenantIdDeLExercice", p.objet, p.nature, p.statut, p."compteId",
     p."montantOuverture", p."dotationsExercice", p."createdAt", p."createdBy"
     FROM provisions_risques_charges p JOIN exercices e ON e.id =
     p."exerciceId" WHERE e."tenantId" <> p."tenantId";` · aucune page ne les
     montre (le dossier qui les porte ne lit que ses exercices, le voisin que
     ses lignes) ; une ligne qui porte un travail réel (montants non nuls,
     `statut` COMPTABILISEE) se montre à Manasse avant la purge, son dossier
     la ressaisira sur son propre exercice.
  3. Purge, en UNE transaction · `BEGIN; DELETE FROM provisions_risques_charges
     p USING exercices e WHERE e.id = p."exerciceId" AND e."tenantId" <>
     p."tenantId";` puis la requête 1, qui doit rendre 0, et `COMMIT` si le
     nombre supprimé (`DELETE n`) est celui de l'étape 2, sinon `ROLLBACK`.
     Jouée telle quelle sur la base jetable du banc (point S6, `PURGE_R1`) ·
     0 restante, l'arrêt du voisin passe.
  4. Le journal d'audit n'est pas retouché · la création y reste (maillon du
     dossier de la session, chaîne intacte, aucune ligne d'événement n'est
     modifiée) ; la purge, faite hors du serveur, n'y écrit rien et se
     consigne au suivi avec la copie de l'étape 2.
- **R2 · les corps (DTO) ne passent pas par les porteurs.** Un `exerciceId`
  de corps d'un autre dossier rend 400 « Exercice introuvable pour ce tenant »
  (`EcritureService` · contrôles d'entrée, relecture dans la transaction,
  imputation d'ouverture), refusé, rien écrit (prouvé en base, S6) · statut
  400 et non 404, NON ALIGNÉ (constat 6) · trente-trois refus en 400 dans
  douze services, sept lectures qui rattrapent `instanceof
  BadRequestException` pour en faire un motif, l'import qui rattrape tout
  refus en anomalie de ligne ; aucune règle unique et sûre. Les autres corps
  n'ont pas été recensés.
- **R3 · autres `compteId` non éprouvés.** Lettrage (`/lettrage/:compteId/*`,
  déjà 404 « Compte introuvable pour ce tenant »), inventaire (`?compteId=`,
  404 du service), tiers (`/tiers/:id/comptes/:compteId`) · non joués avec un
  compte d'un autre dossier. Rapprochement et historique des rappels · traités
  au constat 4 (S4).
- **R4 · réponse instable sur main** · `GET /creances-douteuses/:id/revue`
  (exercice de B, créance aléatoire) a rendu 400 « Exercice introuvable » au
  premier rejeu et 404 au second (deux lectures concurrentes, la première qui
  échoue fait la réponse). Le porteur juge l'exercice avant le service, la
  réponse est désormais toujours 404 « Exercice introuvable dans ce dossier. ».
- **R5 · coût** · une lecture `exercice.findFirst` par clé primaire de plus par
  requête porteuse (et `journal.findFirst` quand un journal est filtré).
- **R6 · le net négatif se juge sur un net à fractions de centime**
  (`personnel.service.ts`, « les retenues d'avance […] dépassent ce qui reste
  dû ») · les cotisations ne sont pas arrondies (`cotisations-paie.ts`,
  `montantFc: base × taux / 100`), le net non plus ; une retenue égale au net
  AFFICHÉ (au centime) peut le dépasser d'une fraction et être refusée. Hors
  du défaut du constat 1 (aucun bord exact au centime), non codé.

## Commandes

```bash
cd /home/user/wt-p1c
npx tsc --noEmit
npx jest src/common/exercice-requis.spec.ts src/common/exercice-requis-routes.spec.ts \
  src/modules/consolidation/perimetre.service.spec.ts src/modules/comptabilite/grand-livre.spec.ts \
  src/modules/relances/releve-compte-introuvable.spec.ts src/modules/ifrs/ifrs.service.spec.ts \
  src/modules/exports/grand-livre-complet-en-flux.spec.ts
npx jest src/common src/modules/groupe src/modules/relances src/modules/modeles-saisie \
  src/modules/comptabilite src/modules/provisions src/modules/analytique src/modules/controles
npx jest src/modules/fiscalite
npx jest src/modules/personnel
npm run build
PAQUET1_C_POINTS=C2 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres_c2 8787 paquet1-c /tmp/claude-0/sim/p1c-apres-c2.json
PAQUET1_C_POINTS=C1 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres_c1 8786 paquet1-c /tmp/claude-0/sim/p1c-apres-c1.json
PAQUET1_C_POINTS=C4 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres_c4 8785 paquet1-c /tmp/claude-0/sim/p1c-apres-c4.json
PAQUET1_C_POINTS=C3 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres_c3 8783 paquet1-c /tmp/claude-0/sim/p1c-apres-c3.json
# Premier tour de relecture, un point par constat (S1 à S7), AVANT puis APRÈS
PAQUET1_C_POINTS=S1 /tmp/claude-0/sim/verifier-ligne.sh /home/user/Comptaflow p1c_avant 8781 paquet1-c /tmp/claude-0/sim/p1c-s1-avant.json
PAQUET1_C_POINTS=S1 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres 8782 paquet1-c /tmp/claude-0/sim/p1c-s1-apres.json
npx jest src/modules/personnel/assiettes-paie.spec.ts src/modules/personnel/cotisations-paie.spec.ts src/modules/personnel/regles-contrat-travail.spec.ts
PAQUET1_C_POINTS=S2,C4 /tmp/claude-0/sim/verifier-ligne.sh /home/user/Comptaflow p1c_avant 8781 paquet1-c /tmp/claude-0/sim/p1c-s2-avant.json
PAQUET1_C_POINTS=S2,C4 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres 8782 paquet1-c /tmp/claude-0/sim/p1c-s2-apres.json
npx jest src/modules/fiscalite
PAQUET1_C_POINTS=S3 /tmp/claude-0/sim/verifier-ligne.sh /home/user/Comptaflow p1c_avant 8781 paquet1-c /tmp/claude-0/sim/p1c-s3-avant.json
PAQUET1_C_POINTS=S3 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres 8782 paquet1-c /tmp/claude-0/sim/p1c-s3-apres.json
npx jest src/modules/personnel/dto-passe-d2.spec.ts src/modules/personnel/assiettes-paie.spec.ts
PAQUET1_C_POINTS=S4 /tmp/claude-0/sim/verifier-ligne.sh /home/user/Comptaflow p1c_avant 8781 paquet1-c /tmp/claude-0/sim/p1c-s4-avant.json
PAQUET1_C_POINTS=S4 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres 8782 paquet1-c /tmp/claude-0/sim/p1c-s4-apres.json
npx jest src/common/exercice-requis.spec.ts src/modules/rapprochement src/modules/relances
PAQUET1_C_POINTS=S5 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres 8782 paquet1-c /tmp/claude-0/sim/p1c-s5-apres.json
PAQUET1_C_POINTS=S6 /tmp/claude-0/sim/verifier-ligne.sh /home/user/Comptaflow p1c_avant 8781 paquet1-c /tmp/claude-0/sim/p1c-s6-avant.json
PAQUET1_C_POINTS=S6 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres 8782 paquet1-c /tmp/claude-0/sim/p1c-s6-apres.json
(cd client && npx vitest run src/pages/associe-unique-hors-dissolution.spec.ts)
PAQUET1_C_POINTS=S7 /tmp/claude-0/sim/verifier-ligne.sh /home/user/Comptaflow p1c_avant 8781 paquet1-c /tmp/claude-0/sim/p1c-s7-avant.json
PAQUET1_C_POINTS=S7 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres 8782 paquet1-c /tmp/claude-0/sim/p1c-s7-apres.json
# Rejeu complet (les quatre points), et AVANT sur main
/tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres 8788 paquet1-c /tmp/claude-0/sim/p1c-apres.json
/tmp/claude-0/sim/verifier-ligne.sh /home/user/Comptaflow p1c_avant 8781 paquet1-c /tmp/claude-0/sim/p1c-avant.json
# Relevé R1, en production (endpoint DIRECT, jamais affiché)
# SELECT count(*) FROM provisions_risques_charges p JOIN exercices e ON e.id = p."exerciceId" WHERE e."tenantId" <> p."tenantId";
# S'il rend des lignes · lecture, purge en une transaction et contrôle, relevé R1, étapes 2 à 4 (Manasse, jamais la session)
```
