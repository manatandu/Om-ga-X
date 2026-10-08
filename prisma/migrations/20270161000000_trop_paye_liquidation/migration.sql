-- EXERCICE DE LIQUIDATION · le trop-payé de la première cotisation spéciale
-- (loi n° 23/053, art. 12, al. 4, et 13) constaté au débit du 441 par le
-- crédit du 8994 (AUDCIF, Titre VII, fiches des comptes 44 et 89), figé sur
-- le constat de l'impôt de l'exercice (décision de Manasse du 2026-10-08).
ALTER TABLE "constats_impot_resultat" ADD COLUMN "tropPayeLiquidation" DECIMAL(18,2) NOT NULL DEFAULT 0;
