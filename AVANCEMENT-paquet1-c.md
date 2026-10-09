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

## Reste

- C4 · observation « société unipersonnelle » conditionnée au fait déclaré.
- C1 · plafond de l'art. 69, 1 au centime.
- C2 · message d'abstention des allocations familiales sans nom interne.
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
npm run build
PAQUET1_C_POINTS=C3 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1c p1c_apres_c3 8783 paquet1-c /tmp/claude-0/sim/p1c-apres-c3.json
```
