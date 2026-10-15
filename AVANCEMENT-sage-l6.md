# Avancement · ligne sage-l6 · pièces jointes et analytique

Branche de sauvegarde · `travail/sage-l6`. Fiche retirée à l'intégration.

## Fait

- **n° 22, serveur (étape 1).** Mécanisme commun `src/common/pieces-jointes/`
  (règles de la pièce, réception multer en mémoire, refus en français,
  téléchargement `attachment` + `nosniff`, service commun, une `RegleDesPieces`
  par objet). Quatre tables (`PieceJointeEcriture`, `PieceJointeSection`,
  `PieceJointeImmobilisation`, `PieceJointeSalarie`), migration
  `20270181000100_pieces_jointes`, cloisonnées, auditées sans binaire (le
  salarié sans nom de fichier ni commentaire), restituées dans
  `pieces-jointes/<objet>/`, manifeste et page Restitution réécrits (« une
  garantie négative vieillit »). Les documents des tiers et les pièces des
  virements gardent leurs routes et leurs tests (fonctions pures réexportées).
  Contrôleurs chez chaque objet · `comptabilite/`, `analytique/`,
  `immobilisations/`, `personnel/` (rôles cantonnés du registre).

- **n° 22, écrans (étape 2).** `client/src/components/PiecesJointes.tsx`
  (volet commun, boîte d'une écriture, boîte des pièces détachées, bouton
  « PJ n »), `client/src/lib/pieces-jointes.ts` (adresses de chaque objet,
  relues contre les contrôleurs par `pieces-jointes.spec.ts`). Saisie et
  journal (colonne PJ sur la première ligne de chaque écriture, décompte de
  l'exercice, « Pièces détachées… » au journal), fiche de la section (plans
  analytiques), onglet « Documents » de la fiche du bien, fiche du salarié
  (registre du personnel).

- **n° 50 (étape 3).** `PlanAnalytique.longueurSections` (null = libre),
  migration `20270181000200_longueur_sections` (contrainte de 2 à 13),
  `analytique/longueur-sections.ts` (un seul prédicat pour l'aperçu, la pose
  et la création), pose et création sous le verrou du plan, relevé par
  tranches, aperçu `GET /analytique/plans/:id/longueur-sections`. Écran ·
  champ « Longueur des codes de section » de l'axe, refus du serveur montré,
  longueur suggérée par les sections, frappe du code bornée.

- **Tests navigateur et vraie base (étape 4).** `e2e/tests/sage-l6-pieces-ecriture.e2e.ts`
  (au journal · dépôt, refus d'un faux PDF, téléchargement, retrait au
  brouillard ; écriture retirée, pièce détachée ; validée, retrait fermé aux
  deux bouts ; à-nouveau provisoire refusé ; clôture de N, pièce relue au même
  octet, toujours non retirable, dépôt encore admis), `sage-l6-documents.e2e.ts`
  (section, bien, salarié · joints, lus, retirés, suppression refusée et
  nommée, audit sans le nom du document), `sage-l6-longueur-sections.e2e.ts`.
  Vert sous Chromium sur base jetable (`l6_e2e`, serveur 8306, relais 4306).
  Trouvé en route et corrigé · le document d'un bien comptait comme un
  traitement et figeait la valeur de la fiche (`fiche-immobilisation.service.ts`,
  il ne retient plus que la suppression) ; le libellé du champ de longueur
  activait la bulle d'aide à chaque clic.

- **Bloc du § 3 (étape 5), sur 29b2967.** `npx tsc --noEmit` des deux côtés ;
  serveur en six tranches l'une après l'autre (`--maxWorkers=1
  --workerIdleMemoryLimit=800MB`) · 148 + 148 + 148 + 148 + 147 + 147 suites,
  1786 + 2073 + 2014 + 2633 + 1960 + 2357 tests verts ; douze suites de la
  tranche 6 tuées par le système (SIGKILL, mémoire prise par les suites des
  autres lignes lancées en même temps), relancées seules · vertes ; client
  `npm test` 2103 tests, `npm run build` des deux côtés (racine sous
  `--max-old-space-size=3072`). Migrations confrontées au schéma sur
  `l6_ombre` · aucune différence.

- **Relecture « échecs silencieux », premier tour (étape 6).** Aucun
  BLOQUANT, un MAJEUR, huit MINEURS, tous corrigés, chacun avec son test.
  M1 · la fiche d'un bien qui change de mois (journal mensuel) ou
  d'exercice REMPLACE son écriture d'acquisition · ses pièces suivent la
  neuve (`reporterLesPieces`, unitaire, avant la suppression), prouvé aussi
  sur vraie base. Mineur 1 · la suppression au brouillard compte les pièces
  qu'elle détache (`piecesDetachees`), le brouillard le dit avec l'endroit
  (Journal > Pièces détachées). Mineur 2 · la description suit l'écriture
  (modifier, transfert, pièce du module retouchée, suppression). Mineur 3 ·
  décompte illisible dit au journal et à la saisie. Mineur 4 · P2003 et
  P2025 en 409 nommés (suppression d'un plan, d'une section, d'une fiche,
  commentaire et retrait d'une pièce). Mineur 5 · le refus de supprimer un
  plan nomme les sections qui portent un document. Mineur 6 · journaux
  autorisés jugés au dépôt et au retrait (403). Mineur 7 · restitution,
  dossier de la pièce non restituée. Mineur 8 · devises et affectation,
  suppression filtrée sur le brouillard, 409 sinon.

## Jumeaux cherchés (M1)

- Seul chemin qui REMPLACE en un geste une écriture du brouillard par une
  neuve · la modification de la fiche d'un bien (corrigé). Non jumeaux,
  vérifiés · la comptabilisation des factures ne supprime aucune écriture ;
  la paie défait sa passation (annulation, puis nouvelle passation, deux
  gestes) ; l'à-nouveau provisoire relancé ou remplacé à la clôture ne porte
  jamais de pièce (dépôt refusé) ; le dossier de combinaison du groupe,
  régénéré à chaque appel, n'a aucun utilisateur, donc aucun dépôt ; les
  compensations (écriture que la requête vient de créer) n'ont pas encore de
  pièce.
- Suppressions au brouillard qui détachent des pièces SANS le dire à l'écran
  (le retour de `EcritureService.supprimer` porte le nombre, les écrans de
  module ne le lisent pas encore) · annulation de la passation de la paie,
  annulation d'une liquidation de TVA, retraits de la créance douteuse (par
  `EcritureService.supprimer`) ; annulation du constat d'impôt, d'un
  virement de fonds, d'une réévaluation des devises et de sa
  contre-passation, d'un traitement d'immobilisation, d'un paiement de
  salaires, d'une créance douteuse, retrait des actes de la période à la
  dissolution, suppression d'une fiche de bien (et fiche devenue reprise),
  suppression d'une affectation (requêtes directes). Les pièces ne se
  perdent pas · elles se lisent dans Journal > Pièces détachées.

## Reste
- WebKit non éprouvé ici (absent de la machine) · le job `tests-navigateur.yml`
  le jouera.
- Relectures `silent-failure-hunter`, `typescript-reviewer` et
  `react-reviewer` non faites par cette session (aucun agent à disposition) ·
  à lancer avant l'intégration.

## Décisions par la loi

1. **Pièce d'une écriture · déposer toujours, retirer au brouillard seulement.**
   AUDCIF art. 17, 3° (« pièces datées, conservées, classées […] portant les
   références de leur enregistrement ») ; art. 22, 1° (origine, contenu,
   imputation), 2° (irréversibilité de l'enregistrement validé), 6° (chemin de
   révision), 7° (« chaque enregistrement s'appuie sur une pièce justificative
   fiable et conservée ») ; art. 24 (dix ans). Non exclus par l'art. 3 du
   SYCEBNL. Joindre la copie d'une pièce ne touche pas l'enregistrement · une
   écriture validée, d'un exercice clôturé compris, la reçoit. Validée, la
   pièce ne se retire plus (données personnelles comprises · ordonnance-loi
   n° 23/10 du 13 mars 2023, art. 216, l'obligation légale prime). Situation
   et brouillard · retrait libre. À-nouveau provisoire · aucun dépôt (il se
   recalcule et disparaît).
2. **Écriture retirée au brouillard · sa pièce est DÉTACHÉE, jamais perdue**
   (clé `SET NULL`, description figée au dépôt `ecritureDecrite`,
   `detenteurs-ecriture.ts` · laissée partir). Retenir l'écriture aurait
   enfermé chacun des chemins de modules qui suppriment un brouillard.
3. **Document d'une section ou d'un bien · libre** · ce n'est pas la pièce
   justificative d'un enregistrement (art. 17, 3° vise les écritures). Une
   section ou une fiche qui porte un document ne se supprime pas sans le dire
   (`references.ts`, refus nommé).
4. **Document d'un salarié · se retire toujours** (Code du numérique, art. 215
   et 216 · effacement sous trente jours) ; ce que la loi oblige à tenir (livre
   de paie, Code du travail art. 213 à 215 ; arrêté du 8 août 2008) vit dans
   le registre et les bulletins. Aux droits du registre · fermé à
   l'aide-comptable, ouvert au gestionnaire de paie ; nom et commentaire hors
   du journal d'audit.
5. **Longueur fixe des codes de section · option du plan, sans défaut.**
   Aucun texte ne fixe la codification analytique (SYCEBNL Partie 2 ch. 3,
   classe 9, sous-section 2 ; Partie 4 ch. 3, section 2). Elle vise les
   sections DÉTAIL (exactement N caractères), les rubriques (Total) étant
   strictement plus courtes ; posée seulement si toutes les sections
   existantes la respectent, refus nommé sinon ; aucun code n'est renuméroté
   (le code d'une section ne se modifie pas, ventilations et budgets le
   citent). Bornes de 2 à 13, convention d'OmegaX.

6. **Joindre ou retirer la pièce d'une écriture est une SAISIE sur son
   journal** (décision de la relecture, mineur 6) · le profil de fonctions
   range déjà ce contrôleur en saisie, et les journaux autorisés restreignent
   la saisie, jamais la lecture (CLAUDE.md, priorité 5) · 403 nommé au dépôt
   et au retrait, la liste ferme les deux gestes ; consultation,
   téléchargement et commentaire (annotation d'OmegaX) restent ouverts ; une
   pièce détachée n'a plus de journal, seul un utilisateur sans restriction
   la retire.

## Questions à Manasse

1. **Longueur des codes de section, par plan ou par dossier ?** Aucun texte
   ne la régit (SYCEBNL Partie 2 ch. 3, classe 9, sous-section 2 · découpage
   « à la convenance » de l'entité ; Partie 4 ch. 3, section 2 · « nomenclature
   budgétaire du projet »). Sage la pose au DOSSIER (P_DOSSIER) ; OmegaX la
   pose au PLAN, parce que les codes et les rubriques vivent dans un plan et
   qu'un axe Bailleurs n'a pas à prendre la longueur de l'axe Projets. Choix
   d'organisation, donc le sien · à confirmer ou à renverser.

## Pour CLAUDE.md

**Pièces jointes des écritures, sections, biens et salariés (ligne sage-l6,
fonction n° 22).** Un mécanisme, `common/pieces-jointes/` (type lu dans les
octets, 5 Mo, SHA-256 contre le doublon par objet, `attachment` et `nosniff`,
nom borné en points de code, 413 en français), employé CHEZ CHAQUE OBJET par
une `RegleDesPieces` · `comptabilite/`, `analytique/`, `immobilisations/`,
`personnel/` ; documents des tiers et pièces des virements inchangés
(réexport). Une table par objet, cloisonnée, auditée sans `contenu`, restituée
dans `pieces-jointes/<objet>/` (le manifeste ne dit plus qu'OmegaX ne tient
aucune pièce d'écriture · une garantie négative vieillit). DÉCISION PAR LA LOI
· la pièce d'une écriture se DÉPOSE toujours, validée et exercice clôturé
compris (AUDCIF art. 17, 3° ; joindre ne touche ni origine, ni contenu, ni
imputation, art. 22, 1°), sauf sur l'à-nouveau provisoire ; elle se RETIRE au
brouillard et en situation seulement · validée, elle se conserve (art. 22, 2°,
6° et 7° ; art. 24 ; ordonnance-loi n° 23/10 du 13 mars 2023, art. 216),
jugé sous le verrou de l'écriture (`SELECT … FOR UPDATE`). L'écriture retirée
au brouillard laisse sa pièce DÉTACHÉE (`SET NULL`, `ecritureDecrite` figée au
dépôt, laissée partir dans `detenteurs-ecriture.ts`), lue dans « Pièces
détachées » du journal. Section et bien · documents libres, qui retiennent la
SUPPRESSION (refus nommé) et jamais la modification · un document n'est pas un
traitement. Salarié · aux droits du registre (rôles cantonnés), se retire
toujours (Code du numérique, art. 215 et 216), nom et commentaire hors du
journal d'audit. Écran · colonne PJ de la saisie et du journal (décompte de
l'exercice, inconnu jamais « aucune », illisible DIT), volet nommé par son
objet. LA PIÈCE SUIT SON ÉCRITURE (relecture « échecs silencieux ») · une
écriture du brouillard REMPLACÉE par une neuve (fiche d'un bien qui change
de mois ou d'exercice) lui passe ses pièces avant de partir
(`reporterLesPieces`, unitaire) ; la description refaite à chaque
modification, transfert ou retouche en place, et à la suppression, qui
compte ce qu'elle détache (`piecesDetachees`, dit au brouillard). Joindre ou
retirer la pièce d'une écriture est une SAISIE sur son journal · journaux
autorisés jugés (403), la lecture reste ouverte. Une suppression de module
au brouillard filtre sur le statut DANS sa transaction (devises,
affectation, règle M1 d'A7).

**Longueur fixe des codes de section (ligne sage-l6, fonction n° 50).**
`PlanAnalytique.longueurSections`, null = libre, OPTION du plan sans défaut
(SYCEBNL Partie 2 ch. 3, classe 9, sous-section 2 · découpage « à sa
convenance » ; Partie 4 ch. 3, section 2 · « nomenclature budgétaire du
projet »). Les sections DÉTAIL font exactement N caractères (points de code),
les rubriques TOTAL strictement moins · la rubrique « 1 » n'absorbe plus en
silence une feuille « 10 » d'une autre longueur. Posée seulement si toutes les
sections la respectent (refus qui en nomme vingt et dit le total), JAMAIS par
renumérotation ; pose et création sous le verrou du plan, relevé par tranches,
un seul prédicat (`longueur-sections.ts`) pour l'aperçu
(`GET /analytique/plans/:id/longueur-sections`), la pose et la création.
Bornes 2 à 13, convention d'OmegaX, tenues aussi par la base.

## Pour build-log.md

| 22 | 2026-10-15 | L6 | fait | WebKit non éprouvé localement | la règle de retrait de l'écriture, tranchée par la loi et jugée sous verrou ; la pièce d'une écriture retirée au brouillard, détachée plutôt que retenue ; le document du bien qui figeait la fiche, vu sur vraie base seulement |
| 50 | 2026-10-15 | L6 | fait | le choix plan ou dossier (question posée) | une longueur qui ne casse pas les rubriques emboîtées (feuilles exactes, rubriques plus courtes) ; jamais de renumérotation, d'où le refus nommé |

## Pour features.csv

- 22 → yes · « mécanisme commun `common/pieces-jointes/`, écriture (saisie, journal, pièces détachées), section, bien, salarié ; retrait fermé à l'écriture validée (AUDCIF art. 22, 24) »
- 50 → yes · « par plan analytique, option sans défaut ; feuilles exactes, rubriques plus courtes, jamais renuméroté »

## Commandes de vérification

```bash
npx tsc --noEmit
# Relecture « échecs silencieux » (étape 6) · specs touchées
npx jest src/common/pieces-jointes src/modules/comptabilite/brouillard.spec.ts \
  src/modules/comptabilite/casse-en-silence.spec.ts src/modules/comptabilite/transfert-situation.spec.ts \
  src/modules/immobilisations/fiche-immobilisation.service.spec.ts src/modules/analytique/suppression-et-exercice-clos.spec.ts \
  src/modules/devises/annulation-reevaluation.spec.ts src/modules/affectation/affectation.spec.ts \
  src/modules/exports/restitution/restitution.spec.ts --maxWorkers=1
(cd client && npx vitest run src/lib/pieces-jointes.spec.ts)
npx jest src/common/pieces-jointes src/common/audit src/common/cloisonnement \
  src/common/guards src/modules/comptabilite/lectures-hors-situation.spec.ts \
  src/modules/exports/restitution src/modules/tiers src/modules/virements-fonds --maxWorkers=1
DATABASE_URL=postgresql://jetable:jetable@localhost:5432/l6_ombre npx prisma migrate diff \
  --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://jetable:jetable@localhost:5432/l6_ombre" --exit-code
```
