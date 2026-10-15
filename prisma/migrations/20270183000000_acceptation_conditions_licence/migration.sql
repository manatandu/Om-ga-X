-- L'ACCEPTATION DES CONDITIONS DE LICENCE D'OMEGAX (ligne pages-legales,
-- 2026-10-15).
--
-- Code du numérique (ordonnance-loi n° 23/10 du 13 mars 2023), art. 55 · le
-- contrat conclu par voie électronique l'est valablement « si le client
-- accepte l'offre, après avoir eu, au préalable, la possibilité de vérifier
-- et de réagir aux détails de sa commande », et l'auteur de l'offre en
-- accuse réception par voie électronique. La dernière version acceptée pour
-- le dossier, sa date et son auteur (courriel recopié au jour de l'acte).
--
-- NULLABLE ET SANS DÉFAUT · aucun dossier existant n'a accepté quoi que ce
-- soit en ligne, et `null` est son état vrai. Un défaut à 1 ferait passer
-- tous les cabinets pour avoir accepté un texte qu'ils n'ont jamais lu.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "conditionsLicenceVersion" INTEGER,
ADD COLUMN     "conditionsLicenceAccepteesLe" TIMESTAMP(3),
ADD COLUMN     "conditionsLicenceAccepteesPar" TEXT;
