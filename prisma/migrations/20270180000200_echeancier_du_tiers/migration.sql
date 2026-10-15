-- Ligne sage-l2, fonction 3 · l'échéancier du modèle de règlement appliqué
-- d'office à la ligne de facture en saisie. Le tiers dit si la fenêtre des
-- échéances se présente (faux, par défaut) ou si la ligne se découpe sans
-- elle (Sage, « validation automatique des règlements »). Aucun tiers
-- existant ne change de comportement · faux pour tous.

-- AlterTable
ALTER TABLE "tiers" ADD COLUMN     "validationAutomatiqueEcheances" BOOLEAN NOT NULL DEFAULT false;
