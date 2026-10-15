-- Ligne sage-l7, fonction 99 · relecture TypeScript, second tour (mineur 1).
--
-- L'inventaire de l'export des modifications relit le registre statut par
-- statut (le brouillard seul, hors export complet), dans l'ordre de la clé
-- de l'entrée · l'index (dossier, suppression, statut) laissait trier chaque
-- tranche, l'index qui finit par l'identifiant la sert dans l'ordre. Il
-- remplace l'ancien, dont il est le prolongement.

-- DropIndex
DROP INDEX "ecritures_exportees_tenantId_supprimeeAuNumero_statutExport_idx";

-- CreateIndex
CREATE INDEX "ecritures_exportees_a_relire_idx" ON "ecritures_exportees"("tenantId", "supprimeeAuNumero", "statutExporte", "id");
