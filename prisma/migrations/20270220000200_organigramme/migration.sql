-- Ligne paie-suite · départements et directions · l'organigramme en arbre libre et
-- le rattachement daté du salarié (personnel/organigramme.ts). Une saisie fausse
-- s'annule (annuleLe), l'unité qui porte un rattachement se met en sommeil.
CREATE TABLE "unites_organisation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "intitule" VARCHAR(120) NOT NULL,
    "niveau" VARCHAR(40),
    "parentId" TEXT,
    "sectionAnalytiqueId" TEXT,
    "estActive" BOOLEAN NOT NULL DEFAULT true,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unites_organisation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rattachements_unite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "uniteId" TEXT NOT NULL,
    "dateEffet" DATE NOT NULL,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" TEXT,

    CONSTRAINT "rattachements_unite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "unites_organisation_tenantId_parentId_idx" ON "unites_organisation"("tenantId", "parentId");

CREATE UNIQUE INDEX "unites_organisation_tenantId_code_key" ON "unites_organisation"("tenantId", "code");

CREATE INDEX "rattachements_unite_tenantId_salarieId_dateEffet_idx" ON "rattachements_unite"("tenantId", "salarieId", "dateEffet");

CREATE INDEX "rattachements_unite_tenantId_uniteId_idx" ON "rattachements_unite"("tenantId", "uniteId");

ALTER TABLE "unites_organisation" ADD CONSTRAINT "unites_organisation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "unites_organisation" ADD CONSTRAINT "unites_organisation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "unites_organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "unites_organisation" ADD CONSTRAINT "unites_organisation_sectionAnalytiqueId_fkey" FOREIGN KEY ("sectionAnalytiqueId") REFERENCES "sections_analytiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rattachements_unite" ADD CONSTRAINT "rattachements_unite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rattachements_unite" ADD CONSTRAINT "rattachements_unite_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rattachements_unite" ADD CONSTRAINT "rattachements_unite_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "unites_organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

