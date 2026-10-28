-- Ligne microfina-m3, idée 3 · ordres de mission et frais de mission.
CREATE TYPE "ElementFraisMission" AS ENUM ('HEBERGEMENT', 'RESTAURATION', 'TRANSPORT', 'DIVERS');
CREATE TYPE "QualificationFraisMission" AS ENUM ('JUSTIFIE', 'FORFAIT', 'REGLE_PAR_ENTITE');

CREATE TABLE "missions_salarie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "objet" TEXT NOT NULL,
    "lieuDepart" TEXT,
    "destination" TEXT NOT NULL,
    "dateDepart" DATE NOT NULL,
    "dateRetour" DATE NOT NULL,
    "moyenTransport" TEXT,
    "accomplieLe" DATE,
    "annuleLe" TIMESTAMP(3),
    "motifAnnulation" TEXT,
    "bulletinId" TEXT,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "missions_salarie_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "missions_salarie_tenantId_numero_key" ON "missions_salarie"("tenantId", "numero");
CREATE INDEX "missions_salarie_tenantId_salarieId_idx" ON "missions_salarie"("tenantId", "salarieId");
CREATE INDEX "missions_salarie_tenantId_bulletinId_idx" ON "missions_salarie"("tenantId", "bulletinId");
ALTER TABLE "missions_salarie" ADD CONSTRAINT "missions_salarie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "missions_salarie" ADD CONSTRAINT "missions_salarie_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "missions_salarie" ADD CONSTRAINT "missions_salarie_bulletinId_fkey" FOREIGN KEY ("bulletinId") REFERENCES "bulletins_paie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "frais_mission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "element" "ElementFraisMission" NOT NULL,
    "qualification" "QualificationFraisMission" NOT NULL,
    "montantFc" DECIMAL(18,2) NOT NULL,
    "piece" TEXT,
    "libelle" TEXT,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "frais_mission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "frais_mission_tenantId_missionId_idx" ON "frais_mission"("tenantId", "missionId");
ALTER TABLE "frais_mission" ADD CONSTRAINT "frais_mission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "frais_mission" ADD CONSTRAINT "frais_mission_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions_salarie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
