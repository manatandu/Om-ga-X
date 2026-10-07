-- Liquidation d'une société commerciale (AUSCGIE art. 201, 203, 223, 228,
-- 266 ; décision par la loi du 2026-10-04, point 4) · faits déclarés à côté
-- de la date de dissolution, nullables sans défaut.
CREATE TYPE "RegimeLiquidation" AS ENUM ('AMIABLE_STATUTAIRE', 'ARTICLE_223_1', 'ARTICLE_223_2_JUDICIAIRE', 'PROCEDURE_COLLECTIVE');

ALTER TABLE "tenants"
  ADD COLUMN "dateNominationLiquidateur" TIMESTAMP(3),
  ADD COLUMN "regimeLiquidation" "RegimeLiquidation",
  ADD COLUMN "associeUniquePersonneMorale" BOOLEAN;
