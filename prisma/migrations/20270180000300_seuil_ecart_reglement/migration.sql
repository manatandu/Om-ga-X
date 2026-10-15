-- Ligne sage-l2, fonction 36 · le seuil sous lequel un règlement peut passer
-- l'écart en charge en soldant le tiers. Aucun texte n'en fixe · la colonne
-- naît vide pour tous les dossiers, et sans elle aucun écart ne se passe.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "seuilEcartReglement" DECIMAL(18,2);
