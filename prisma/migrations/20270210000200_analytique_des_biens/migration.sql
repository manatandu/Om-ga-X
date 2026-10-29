-- Ligne immos, fonction n° 70 · la section analytique de la dotation d'un
-- bien, sur sa fiche ou sur sa famille. RESTRICT · une section qui la porte
-- ne se supprime pas en dénouant le lien.
ALTER TABLE "immobilisations" ADD COLUMN "sectionAnalytiqueId" TEXT;
ALTER TABLE "familles_immobilisation" ADD COLUMN "sectionAnalytiqueId" TEXT;
ALTER TABLE "immobilisations" ADD CONSTRAINT "immobilisations_sectionAnalytiqueId_fkey" FOREIGN KEY ("sectionAnalytiqueId") REFERENCES "sections_analytiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "familles_immobilisation" ADD CONSTRAINT "familles_immobilisation_sectionAnalytiqueId_fkey" FOREIGN KEY ("sectionAnalytiqueId") REFERENCES "sections_analytiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
