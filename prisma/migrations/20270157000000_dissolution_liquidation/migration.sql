-- Dissolution suivie de liquidation (docs/decisions-par-la-loi-2026-10-07.md,
-- point 2 ; docs/decisions-par-la-loi-2026-10-07-quater.md, points 1 à 7) ·
-- date de clôture de la liquidation et dates de dépôt des deux déclarations de
-- cotisation spéciale (loi n° 23/053, art. 13 ; LPF art. 16), faits déclarés,
-- nullables sans défaut. Les colonnes de l'entreprise minière du portefeuille,
-- que la branche portait sous le même numéro, sont sur main
-- (20270154000000_portefeuille_secteur_minier_dividende) et ne se répètent pas.
ALTER TABLE "tenants"
  ADD COLUMN "dateClotureLiquidation" TIMESTAMP(3),
  ADD COLUMN "dateDeclarationCotisationActivite" TIMESTAMP(3),
  ADD COLUMN "dateDeclarationCotisationLiquidation" TIMESTAMP(3);
