-- Ligne sage-l1, fonction 14 · créer un compte pendant la saisie.
--
-- Une option du dossier, fermée par défaut · ouverte, la grille de saisie
-- offre d'ouvrir le numéro tapé inconnu comme sous-compte d'un compte
-- d'imputation du plan (comptes/compte-en-saisie.ts).

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "creationCompteEnSaisie" BOOLEAN NOT NULL DEFAULT false;
