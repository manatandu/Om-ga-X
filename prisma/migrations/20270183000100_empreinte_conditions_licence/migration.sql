-- L'EMPREINTE DU TEXTE ACCEPTÉ (ligne pages-legales, relecture M2) · le
-- numéro de version seul ne dit pas quel texte a été accepté. SHA-256 en
-- hexadécimal, posée avec la version, la date et l'auteur.
ALTER TABLE "tenants" ADD COLUMN "conditionsLicenceEmpreinte" TEXT;
