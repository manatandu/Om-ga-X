-- Ligne sage-l2, fonction 24 · la qualité du tiers, libellé descriptif de la
-- fiche (35 caractères). Elle ne décide rien · nulle pour tous les tiers
-- existants.

-- AlterTable
ALTER TABLE "tiers" ADD COLUMN     "qualite" VARCHAR(35);
