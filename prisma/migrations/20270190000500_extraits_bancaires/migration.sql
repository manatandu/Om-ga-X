-- Ligne sage-l3, fonction 45 · édition chaînée des extraits bancaires.
-- L'instant de l'import du relevé et le nom du fichier reçu, imprimés en tête
-- de l'extrait reconstitué. Nuls pour les relevés importés avant la fonction.
ALTER TABLE "rapprochements_bancaires" ADD COLUMN "releveImporteLe" TIMESTAMP(3);
ALTER TABLE "rapprochements_bancaires" ADD COLUMN "releveNomFichier" VARCHAR(200);
