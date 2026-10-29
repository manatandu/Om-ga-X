-- Le bilan social de l'ONEM, saisi par exercice (Code du travail, art. 218 ;
-- arrêté du 24 février 2023, art. 3).
CREATE TABLE "bilans_sociaux" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exercice" INTEGER NOT NULL,
    "lignes" JSONB NOT NULL,
    "commentaire" VARCHAR(4000),
    "enregistrePar" TEXT NOT NULL,
    "enregistreLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bilans_sociaux_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bilans_sociaux_tenantId_exercice_key" ON "bilans_sociaux"("tenantId", "exercice");
ALTER TABLE "bilans_sociaux" ADD CONSTRAINT "bilans_sociaux_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
