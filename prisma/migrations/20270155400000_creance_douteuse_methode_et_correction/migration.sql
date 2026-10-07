-- Relecture du 2026-10-07, M8 · la méthode des cotisations AU JOUR DU
-- RECLASSEMENT, figée au geste (SYCEBNL, cadre conceptuel § 5.4.2.1). Nulle
-- pour les créances déjà passées · reconstituée sur le journal d'audit, ou
-- dite inconnue, jamais inventée.
CREATE TYPE "MethodeCotisationsAuReclassement" AS ENUM ('APPEL', 'ENCAISSEMENT', 'NON_DECLAREE');
ALTER TABLE "creances_douteuses" ADD COLUMN "methodeCotisationsReclassement" "MethodeCotisationsAuReclassement";

-- M9 · un impayé d'adhérent reclassé dans un exercice clôturé se corrige par
-- le résultat de l'exercice en cours (cadre conceptuel § 3.3.1.2.4) · la
-- créance désigne l'écriture du cabinet, RESTRICT, avec son motif.
ALTER TABLE "creances_douteuses" ADD COLUMN "corrigeeParResultatLe" TIMESTAMP(3);
ALTER TABLE "creances_douteuses" ADD COLUMN "corrigeeParResultatPar" TEXT;
ALTER TABLE "creances_douteuses" ADD COLUMN "motifCorrectionResultat" TEXT;
ALTER TABLE "creances_douteuses" ADD COLUMN "ecritureCorrectionResultatId" TEXT;
CREATE UNIQUE INDEX "creances_douteuses_ecritureCorrectionResultatId_key" ON "creances_douteuses"("ecritureCorrectionResultatId");
ALTER TABLE "creances_douteuses" ADD CONSTRAINT "creances_douteuses_ecritureCorrectionResultatId_fkey" FOREIGN KEY ("ecritureCorrectionResultatId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
