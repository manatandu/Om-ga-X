-- LA PERTE QUI RÉCUPÈRE LA TVA (point D, décision de Manasse du 2026-10-08) ·
-- deux pièces sur duplicata surchargé (O.-L. n° 10/001, art. 52 ; décret
-- n° 011/42, art. 126 et 127) · le retour D compte d'origine / C 416 (TTC),
-- puis la perte D 651 (HT) / D 443 (taxe) / C compte d'origine. Le montant de
-- taxe récupérée, celui de la taxe à l'encaissement annulée, et le détail
-- figé facture par facture.
ALTER TABLE "mouvements_creances_douteuses" ADD COLUMN "montantTva" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "mouvements_creances_douteuses" ADD COLUMN "montantTvaAnnulee" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "mouvements_creances_douteuses" ADD COLUMN "detailTva" JSONB;

-- La perte qui récupère la TVA s'écrit en deux pièces (décision de Manasse du
-- 2026-10-08) · le retour de la créance au compte d'origine (`ecritureId`) et
-- la perte sur ce compte (`ecriturePerteId`), RESTRICT comme la première.
ALTER TABLE "mouvements_creances_douteuses" ADD COLUMN "ecriturePerteId" TEXT;
CREATE UNIQUE INDEX "mouvements_creances_douteuses_ecriturePerteId_key" ON "mouvements_creances_douteuses"("ecriturePerteId");
ALTER TABLE "mouvements_creances_douteuses" ADD CONSTRAINT "mouvements_creances_douteuses_ecriturePerteId_fkey" FOREIGN KEY ("ecriturePerteId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
