-- Ligne immos, fonction n° 71 · le numéro de série du bien, sur sa fiche et
-- sur la fiche de comptage de l'inventaire physique (AUDCIF art. 42).
ALTER TABLE "immobilisations" ADD COLUMN "numeroSerie" VARCHAR(100);
ALTER TABLE "fiches_inventaire" ADD COLUMN "numeroSerie" VARCHAR(100);
