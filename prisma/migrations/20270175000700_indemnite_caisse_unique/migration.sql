-- Relecture de la ligne sage-l5 (premier tour), mineur 3 · une indemnité
-- de la Caisse NON ANNULÉE par arrêt et par mois. La lecture préalable du
-- service laissait passer deux déclarations simultanées ; l'index le tient
-- en base. NULLS NOT DISTINCT · deux lignes non annulées (annuleLe nul) se
-- heurtent, les annulées, datées, s'ajoutent sans le rompre (comme les
-- lignes de paiement des salaires).
CREATE UNIQUE INDEX "indemnites_caisse_absences_absenceId_mois_annuleLe_key"
  ON "indemnites_caisse_absences"("absenceId", "mois", "annuleLe") NULLS NOT DISTINCT;
