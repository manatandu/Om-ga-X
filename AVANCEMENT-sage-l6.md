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

## Reste
- Bloc du § 3 complet (six tranches du serveur, client, constructions).
- WebKit non éprouvé ici (absent de la machine).

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
l'exercice, inconnu jamais « aucune »), volet nommé par son objet.

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
npx jest src/common/pieces-jointes src/common/audit src/common/cloisonnement \
  src/common/guards src/modules/comptabilite/lectures-hors-situation.spec.ts \
  src/modules/exports/restitution src/modules/tiers src/modules/virements-fonds --maxWorkers=1
DATABASE_URL=postgresql://jetable:jetable@localhost:5432/l6_ombre npx prisma migrate diff \
  --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://jetable:jetable@localhost:5432/l6_ombre" --exit-code
```
