-- Ligne restes-immos-budgets, point 2 · la quantité du bien recopiée sur la
-- fiche de comptage de l'inventaire physique. Nullable, sans défaut · une
-- fiche existante n'a rien de recopié tant que le geste qui engendre les
-- fiches ne repasse pas (la campagne encore ouverte), et une fiche saisie à la
-- main ne porte aucun bien.

-- AlterTable
ALTER TABLE "fiches_inventaire" ADD COLUMN "quantiteAttendue" INTEGER;
