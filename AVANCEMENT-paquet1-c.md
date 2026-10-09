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
`associeUniquePersonneMorale`, il permettrait de servir l'observation à la
SARL et à la SA à associé unique personne physique, que le dossier ne sait
pas dire aujourd'hui (elle ne leur est donc jamais servie). Décision de
Manasse (ajout d'un champ, hors gel).

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

## Reste

- Rejeu APRÈS complet (C3, C4, C1, C2), compte rendu final.

## Décisions

- C3 · aucune question de fond · un identifiant que le dossier ne porte pas
  est introuvable (404), comme `MOTIF_EXERCICE_INTROUVABLE` (F222) et le
  justificatif de solde le disaient déjà. Le message ne dit pas « d'un autre
  dossier » (ne pas apprendre au client qu'un exercice existe ailleurs).

## Relevés (non codés, hors périmètre)

- **R1 · données croisées déjà en production ?** Sur `main`, `POST
  /provisions/:exerciceId` avec l'exercice d'un autre dossier CRÉAIT une
  provision dans le dossier de la session, rattachée à l'exercice du voisin
  (clé étrangère sans dossier). Requête à passer en production avant
  l'intégration, sur l'endpoint DIRECT · `SELECT count(*) FROM
  provisions_risques_charges p JOIN exercices e ON e.id = p."exerciceId" WHERE
  e."tenantId" <> p."tenantId"` (rend 2 sur la base AVANT, 0 APRÈS). Les cinq
  autres routes d'écriture porteuses refusaient déjà par leur service.
- **R2 · les corps (DTO) ne passent pas par les porteurs.** Un `exerciceId`
  de corps d'un autre dossier rend 400 « Exercice introuvable pour ce tenant »
  (`EcritureService` · contrôles d'entrée, imputation d'ouverture), refusé,
  rien écrit · statut 400 et non 404, non changé (le même contrôle sert les
  lignes d'import). Les autres corps n'ont pas été recensés.
- **R3 · autres `compteId` non éprouvés.** Lettrage (`/lettrage/:compteId/*`,
  déjà 404 « Compte introuvable pour ce tenant »), rapprochement
  (`/rapprochements?compteId=`), inventaire (`?compteId=`), tiers
  (`/tiers/:id/comptes/:compteId`), relances (`?compteId=` de l'historique) ·
  non joués avec un compte d'un autre dossier.
- **R4 · réponse instable sur main** · `GET /creances-douteuses/:id/revue`
  (exercice de B, créance aléatoire) a rendu 400 « Exercice introuvable » au
  premier rejeu et 404 au second (deux lectures concurrentes, la première qui
  échoue fait la réponse). Le porteur juge l'exercice avant le service, la
  réponse est désormais toujours 404 « Exercice introuvable dans ce dossier. ».
- **R5 · coût** · une lecture `exercice.findFirst` par clé primaire de plus par
  requête porteuse (et `journal.findFirst` quand un journal est filtré).

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
```
