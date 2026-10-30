-- Ligne paie-suite, fonction 76 · le compte individuel du salarié sous le 422,
-- option du dossier désactivée par défaut (personnel/compte-salarie.ts).
ALTER TABLE "salaries" ADD COLUMN     "compteId" TEXT;

ALTER TABLE "tenants" ADD COLUMN     "comptesIndividuelsSalaries" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "salaries_compteId_key" ON "salaries"("compteId");

ALTER TABLE "salaries" ADD CONSTRAINT "salaries_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

