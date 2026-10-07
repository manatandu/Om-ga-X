-- C2 (2026-10-07) · l'écriture qui reprend en négatif un bulletin annulé après
-- passation (AUDCIF art. 20, al. 2 à 4 ; art. 22, 4°). RESTRICT, déclaré au
-- schéma · sur une relation facultative, Prisma poserait SET NULL, et le
-- bulletin se reprendrait une seconde fois.
ALTER TABLE "bulletins_paie" ADD COLUMN "ecritureNegatifId" TEXT;

-- CreateIndex
CREATE INDEX "bulletins_paie_tenantId_ecritureNegatifId_idx" ON "bulletins_paie"("tenantId", "ecritureNegatifId");

-- AddForeignKey
ALTER TABLE "bulletins_paie" ADD CONSTRAINT "bulletins_paie_ecritureNegatifId_fkey" FOREIGN KEY ("ecritureNegatifId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
