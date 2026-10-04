-- PREMIER EXERCICE LONG · loi n° 23/053, art. 12, al. 3 (cas chiffré C09).
-- Bénéfice fiscal de la période de création, déclaré d'après les comptes
-- intermédiaires arrêtés au 31 décembre de l'année de création. Nullable ·
-- null, OmegaX lit le résultat comptable de la période sur le livre-journal.
ALTER TABLE "dossiers_fiscaux_exercice" ADD COLUMN "resultatPeriodeCreationSaisi" DECIMAL(18,2);

-- Suppléments de l'Administration sur l'impôt de la période de création
-- (LPF art. 57 bis) · base des acomptes de l'année qui suit la création.
ALTER TABLE "dossiers_fiscaux_exercice" ADD COLUMN "supplementsPeriodeCreation" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- Origine du déficit saisi à l'ouverture (B2, P1) · la date de clôture de
-- chaque exercice déficitaire, qui donne sa fenêtre de l'art. 51. Null =
-- origine non dite, bornée par prudence.
ALTER TABLE "dossiers_fiscaux_exercice" ADD COLUMN "deficitAnterieurOrigines" JSONB;
