-- Relevé H D1 de la simulation du 2026-10-08 · le verrou du garnissage d'une
-- vitrine, posé au marquage du dossier de démonstration et retiré à la fin du
-- garnissage. Nullable sans défaut · aucun dossier existant n'est en cours.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "garnissageDemonstrationDepuis" TIMESTAMP(3);
