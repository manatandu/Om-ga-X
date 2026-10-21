-- Pièces justificatives proposées selon la trésorerie et l'opération
-- (demande de Manasse du 2026-10-16) · bon de sortie ou d'entrée de caisse,
-- avis de débit ou de crédit, extrait de compte, bordereau de remise de
-- chèque. Les natures BON_CAISSE et AVIS_DEBIT_CREDIT restent dans le type,
-- lisibles sur les virements déjà passés, et ne sont plus proposées.
ALTER TYPE "NaturePieceVirement" ADD VALUE 'BON_SORTIE_CAISSE';
ALTER TYPE "NaturePieceVirement" ADD VALUE 'BON_ENTREE_CAISSE';
ALTER TYPE "NaturePieceVirement" ADD VALUE 'AVIS_DEBIT';
ALTER TYPE "NaturePieceVirement" ADD VALUE 'AVIS_CREDIT';
ALTER TYPE "NaturePieceVirement" ADD VALUE 'EXTRAIT_COMPTE';
ALTER TYPE "NaturePieceVirement" ADD VALUE 'BORDEREAU_REMISE_CHEQUE';
