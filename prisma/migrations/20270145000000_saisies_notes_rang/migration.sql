-- Lignes répétables des notes SYSCOHADA 4, 13, 32 et 33 (AUDCIF Titre IX
-- ch. 6 § 1.2 ; décision par la loi du 2026-10-04, point 2) · un rang de
-- LIGNE dans la cellule saisie. Toute saisie existante est au rang 0 · les
-- ancres (code de note, clé de rubrique, rang de colonne) sont gardées.
ALTER TABLE "saisies_notes" ADD COLUMN "rang" INTEGER NOT NULL DEFAULT 0;

-- L'unicité est recréée avec le rang (le nom tronqué par PostgreSQL à
-- 63 caractères est le même avant et après).
DROP INDEX "saisies_notes_tenantId_exerciceId_jeu_codeNote_cleRubrique__key";
CREATE UNIQUE INDEX "saisies_notes_tenantId_exerciceId_jeu_codeNote_cleRubrique__key"
  ON "saisies_notes"("tenantId", "exerciceId", "jeu", "codeNote", "cleRubrique", "rang", "colonne");
