-- Ligne lettrage-cloture. Un lettrage PARTIEL de N est reconduit par la
-- clôture sur ses lignes d'à-nouveau de N+1 (AUDCIF art. 34 · fiches des
-- comptes 40 et 41, « crédité des avances et acomptes ainsi que des
-- règlements reçus des clients »). Deux ajouts, aucune ligne réécrite.
--
-- (1) L'origine CLOTURE · le groupe de N+1 dit qu'il vient de la clôture,
-- pas d'un lettrage manuel ni d'une présomption du logiciel.
ALTER TYPE "OrigineLettrage" ADD VALUE 'CLOTURE';

-- (2) Le groupe de N qu'il reconduit · c'est ce lien qui fait dire qu'un
-- groupe partiel d'un exercice clôturé n'a pas été reconduit. RESTRICT
-- voulu, et déclaré au schéma (une relation facultative recevrait SET NULL).
ALTER TABLE "lettrages" ADD COLUMN "lettrageReconduitId" TEXT;
CREATE INDEX "lettrages_tenantId_lettrageReconduitId_idx" ON "lettrages"("tenantId", "lettrageReconduitId");
ALTER TABLE "lettrages" ADD CONSTRAINT "lettrages_lettrageReconduitId_fkey" FOREIGN KEY ("lettrageReconduitId") REFERENCES "lettrages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
