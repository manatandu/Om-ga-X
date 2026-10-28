-- Ligne microfina-m3, idée 6 · le plan d'étalement d'une avance ou d'un prêt
-- (Code du travail, art. 112, c) et f)). Deux colonnes facultatives · aucune
-- avance existante n'en reçoit, la retenue mensuelle reste une indication.
ALTER TABLE "avances_salaire" ADD COLUMN "premierMoisRetenue" VARCHAR(7);
ALTER TABLE "avances_salaire" ADD COLUMN "nombreEcheances" INTEGER;
