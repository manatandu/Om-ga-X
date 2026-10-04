-- PREMIER EXERCICE LONG · loi n° 23/053, art. 12, al. 3 (cas chiffré C09).
-- Bénéfice fiscal de la période de création, déclaré d'après les comptes
-- intermédiaires arrêtés au 31 décembre de l'année de création. Nullable ·
-- null, OmegaX lit le résultat comptable de la période sur le livre-journal.
ALTER TABLE "dossiers_fiscaux_exercice" ADD COLUMN "resultatPeriodeCreationSaisi" DECIMAL(18,2);
