-- LA COMMANDE ACCEPTÉE AVEC LES CONDITIONS (ligne pages-legales, second tour
-- de relecture, M-a ; Code du numérique, art. 55, al. 1er) · l'abonnement
-- que l'administrateur a vérifié, figé à l'acte et recopié dans l'accusé.
-- Nullable, sans défaut · aucune acceptation antérieure ne l'a gardé.
ALTER TABLE "tenants" ADD COLUMN "conditionsLicenceCommande" JSONB;
