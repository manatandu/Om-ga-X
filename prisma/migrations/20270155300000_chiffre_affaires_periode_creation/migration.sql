-- Relecture du 2026-10-07, mineur C09 · le chiffre d'affaires de la période de
-- création se DÉCLARE avec son bénéfice (loi n° 23/053, art. 12, al. 3 ;
-- art. 57) · null, il se lit au livre-journal au 31 décembre, et
-- l'observation le dit.
ALTER TABLE "dossiers_fiscaux_exercice" ADD COLUMN "chiffreAffairesPeriodeCreationSaisi" DECIMAL(18,2);
