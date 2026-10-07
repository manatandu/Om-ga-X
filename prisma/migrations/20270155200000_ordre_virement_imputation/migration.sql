-- Relecture du 2026-10-07, M6 · l'ordre de virement IMPRIME l'imputation que
-- le dossier déclare en payant son fournisseur (Code civil, Livre III,
-- art. 151 · « lorsqu'il paye ») · les factures et la part de chacune,
-- recopiées à la création de l'ordre. Nulle pour un règlement sans parts.
ALTER TABLE "lignes_ordre_virement" ADD COLUMN "imputationDeclaree" TEXT;
