-- Ligne gl-saisie, fonction 64 · la revue d'une écriture par le cabinet.
--
-- Une marque à côté de l'écriture validée (auteur, date, commentaire), une
-- par écriture, jamais dans l'écriture elle-même (AUDCIF art. 22, 1° et 2°).

-- CreateTable
CREATE TABLE "revues_ecritures" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ecritureId" TEXT NOT NULL,
    "revuePar" TEXT NOT NULL,
    "revueLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentaire" TEXT,

    CONSTRAINT "revues_ecritures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "revues_ecritures_ecritureId_key" ON "revues_ecritures"("ecritureId");

-- CreateIndex
CREATE INDEX "revues_ecritures_tenantId_revueLe_idx" ON "revues_ecritures"("tenantId", "revueLe");

-- AddForeignKey
ALTER TABLE "revues_ecritures" ADD CONSTRAINT "revues_ecritures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revues_ecritures" ADD CONSTRAINT "revues_ecritures_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
