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

## Reste

- n° 22 · tests navigateur, scénario sur vraie base à travers une clôture.
- n° 50 · longueur fixe des codes de section (schéma, migration
  `20270181000200`, service, écran, tests).
- Bloc du § 3 complet, tests navigateur `e2e/tests/sage-l6-*.e2e.ts`.

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

## Questions à Manasse

(aucune pour l'instant)

## Pour CLAUDE.md

(à écrire à la fin de la ligne)

## Pour build-log.md

(à écrire à la fin de la ligne)

## Pour features.csv

(à écrire à la fin de la ligne)

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
