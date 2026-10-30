-- Ligne gl-saisie, fonction 2 · l'échéance obligatoire sur la ligne d'une
-- facture de tiers.
--
-- Une option du dossier, fausse par défaut · vraie, la saisie refuse la ligne
-- d'une facture sur un compte 40 ou 41 sans date d'échéance
-- (comptabilite/echeance-obligatoire.ts).

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "echeanceObligatoireTiers" BOOLEAN NOT NULL DEFAULT false;
