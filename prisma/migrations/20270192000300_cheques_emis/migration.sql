-- Ligne microfina-m2, idée 9 · le registre des chèques émis · le chéquier
-- reçu de la banque (plage de numéros par RIB du dossier), le numéro émis ou
-- annulé. CPCC, ch. 1 § 1.1.1 (« souches ou talons de chéquiers ») ; Guide
-- SYSCOHADA, Partie 1 ch. 4 § 2.2 (enregistré « dès l'émission », chèques en
-- circulation). L'encaissement n'est pas stocké · il se lit au rapprochement.

-- CreateEnum
CREATE TYPE "EtatChequeEmis" AS ENUM ('EMIS', 'ANNULE');

-- CreateTable
CREATE TABLE "chequiers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ribId" TEXT NOT NULL,
    "numeroDebut" INTEGER NOT NULL,
    "numeroFin" INTEGER NOT NULL,
    "largeur" INTEGER NOT NULL,
    "barre" BOOLEAN NOT NULL DEFAULT true,
    "dateReception" DATE NOT NULL,
    "commentaire" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "chequiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheques_emis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chequierId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "etat" "EtatChequeEmis" NOT NULL,
    "dateEmission" DATE,
    "beneficiaire" VARCHAR(150),
    "montant" DECIMAL(18,2),
    "ecritureId" TEXT,
    "pieceDecrite" VARCHAR(200),
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "cheques_emis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chequiers_tenantId_ribId_idx" ON "chequiers"("tenantId", "ribId");

-- CreateIndex
CREATE UNIQUE INDEX "cheques_emis_ecritureId_key" ON "cheques_emis"("ecritureId");

-- CreateIndex
CREATE INDEX "cheques_emis_tenantId_chequierId_idx" ON "cheques_emis"("tenantId", "chequierId");

-- CreateIndex
CREATE UNIQUE INDEX "cheques_emis_chequierId_numero_key" ON "cheques_emis"("chequierId", "numero");

-- AddForeignKey
ALTER TABLE "chequiers" ADD CONSTRAINT "chequiers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chequiers" ADD CONSTRAINT "chequiers_ribId_fkey" FOREIGN KEY ("ribId") REFERENCES "ribs_banque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques_emis" ADD CONSTRAINT "cheques_emis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques_emis" ADD CONSTRAINT "cheques_emis_chequierId_fkey" FOREIGN KEY ("chequierId") REFERENCES "chequiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques_emis" ADD CONSTRAINT "cheques_emis_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- LA BASE TIENT CE QUE LE SERVICE DIT · une plage croissante et positive ; un
-- chèque émis porte sa date, son bénéficiaire et un montant positif ; un
-- chèque annulé porte son motif et son instant. Il peut garder sa pièce quand
-- elle est corrigée par son négatif (relecture M3 et m9 · la pièce ne paie
-- plus rien, et le lien date l'annulation au journal pour le total en
-- circulation à une date passée) · le service seul en décide.
ALTER TABLE "chequiers" ADD CONSTRAINT "chequiers_plage"
  CHECK ("numeroDebut" > 0 AND "numeroFin" >= "numeroDebut" AND "largeur" BETWEEN 1 AND 12);
ALTER TABLE "cheques_emis" ADD CONSTRAINT "cheques_emis_etat"
  CHECK (
    ("etat" = 'EMIS' AND "dateEmission" IS NOT NULL AND "beneficiaire" IS NOT NULL AND "montant" > 0 AND "annuleLe" IS NULL)
    OR ("etat" = 'ANNULE' AND "annuleLe" IS NOT NULL AND "motifAnnulation" IS NOT NULL AND length(btrim("motifAnnulation")) > 0)
  );
