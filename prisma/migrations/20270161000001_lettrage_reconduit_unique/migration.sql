-- Ligne lettrage-cloture, relecture TypeScript (m3) · un groupe partiel de N
-- n'est reconduit qu'une fois · la base le garantit, en plus du code.
CREATE UNIQUE INDEX "lettrages_lettrageReconduitId_key" ON "lettrages"("lettrageReconduitId");
