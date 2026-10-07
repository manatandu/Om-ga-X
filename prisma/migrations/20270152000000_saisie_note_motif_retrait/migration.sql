-- Retrait d'une saisie conservée au format à huit colonnes des notes 20B et
-- 29B · le motif est écrit sur la ligne (mise à jour unitaire, au journal
-- d'audit) juste avant sa suppression par identifiant.
ALTER TABLE "saisies_notes" ADD COLUMN "motifRetrait" TEXT;
