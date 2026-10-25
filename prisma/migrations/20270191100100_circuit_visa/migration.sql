-- Ligne microfina-m1, idée 1 · circuit de visa avant validation et auteur du
-- dernier contenu d'une écriture. Une option du dossier, fausse par défaut ·
-- aucun texte n'impose le visa (AUDCIF art. 22, 2° et 69 ; SYCEBNL art. 16, 2)).
-- Les colonnes nouvelles sont nulles pour l'existant · un contenu jamais réécrit
-- depuis sa création a pour auteur `createdBy`, une facture d'avant la règle a un
-- auteur inconnu, rien n'est visé d'office.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "circuitVisa" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ecritures" ADD COLUMN     "contenuLe" TIMESTAMP(3),
ADD COLUMN     "contenuPar" TEXT,
ADD COLUMN     "viseeEmpreinte" TEXT,
ADD COLUMN     "viseeLe" TIMESTAMP(3),
ADD COLUMN     "viseePar" TEXT;

-- AlterTable
ALTER TABLE "factures" ADD COLUMN     "saisiePar" TEXT,
ADD COLUMN     "viseeLe" TIMESTAMP(3),
ADD COLUMN     "viseePar" TEXT;
