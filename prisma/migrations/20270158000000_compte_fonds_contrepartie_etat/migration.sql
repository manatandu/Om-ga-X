-- Cas chiffrés de la clôture, question Q2 (2026-10-07) · le compte de
-- trésorerie qui porte les fonds de contrepartie de l'État au tableau
-- emplois-ressources d'un projet (FV, FY) se DÉCLARE · convention d'OmegaX,
-- aucun texte ne le désigne (SYCEBNL, Application 21). Faux par défaut ·
-- c'est le comportement d'avant, dit par l'état.
ALTER TABLE "comptes" ADD COLUMN "porteFondsContrepartieEtat" BOOLEAN NOT NULL DEFAULT false;
