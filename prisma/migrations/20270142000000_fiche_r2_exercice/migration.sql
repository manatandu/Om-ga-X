-- Fiche R2 de l'AUDCIF (Titre IX ch. 2), cases ZN à ZS · faits déclarés par
-- exercice, nullables sans défaut (décision par la loi du 2026-10-04, point 5).
CREATE TYPE "ControleEntreprise" AS ENUM ('PUBLIC', 'PRIVE_NATIONAL', 'PRIVE_ETRANGER');

ALTER TABLE "exercices"
  ADD COLUMN "nombreEtablissementsPays" INTEGER,
  ADD COLUMN "nombreEtablissementsHorsPays" INTEGER,
  ADD COLUMN "premiereAnneeExercicePays" INTEGER,
  ADD COLUMN "controleEntreprise" "ControleEntreprise";
