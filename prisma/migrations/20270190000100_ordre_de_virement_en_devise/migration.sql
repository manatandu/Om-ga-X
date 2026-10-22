-- Ligne sage-l3, fonction 37 · l'ordre de virement part d'un compte en devise
-- (décision D1 · loi n° 23/053, art. 141, 1°, vise la comptabilité, pas la
-- monnaie du compte bancaire). L'ordre porte la monnaie que la banque exécute
-- et, ligne à ligne, le montant en devise ; la contrevaleur en francs reste.
-- Les ordres existants sont en francs · colonnes nulles, rien à reprendre.
ALTER TABLE "ordres_virement"
  ADD COLUMN "devise" TEXT,
  ADD COLUMN "totalDevise" DECIMAL(18,2);

ALTER TABLE "lignes_ordre_virement"
  ADD COLUMN "montantDevise" DECIMAL(18,2);
