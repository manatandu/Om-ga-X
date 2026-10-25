-- Logiciels (tuiles) attribués par utilisateur · affichage seulement, jamais un droit.
-- Faux et liste vide par défaut : les utilisateurs existants gardent toutes les tuiles.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "logicielsAutorises" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "restreindreLogiciels" BOOLEAN NOT NULL DEFAULT false;
