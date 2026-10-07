-- Entreprise relevant du portefeuille de l'État (O.-L. n° 13/003, art. 112 et
-- 113 ; décision par la loi du 2026-10-04, point 1) · fait déclaré du dossier,
-- null = pas encore dit, et deux dates déclarées par exercice.
ALTER TABLE "tenants" ADD COLUMN "entreprisePortefeuilleEtat" BOOLEAN;

ALTER TABLE "exercices"
  ADD COLUMN "dateAssembleeGenerale" TIMESTAMP(3),
  ADD COLUMN "dateDepotEtatsPortefeuille" TIMESTAMP(3);
