-- Relecture du 2026-10-07, M3 · l'imputation déclarée d'un paiement porte la
-- DATE de sa pièce (Code civil, Livre III, art. 151 · le débiteur déclare
-- « lorsqu'il paye ») et, pour une quittance, la PREUVE de son acceptation
-- (art. 153 · « a accepté une quittance »). La table naît dans la même ligne
-- (20270155000000) et n'a jamais porté de déclaration hors de bases jetables ·
-- aucune date n'est inventée pour une ligne existante.
ALTER TABLE "imputations_paiements" ALTER COLUMN "pieceDate" SET NOT NULL;
ALTER TABLE "imputations_paiements" ADD COLUMN "preuveAcceptation" TEXT;
