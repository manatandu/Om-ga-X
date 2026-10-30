-- Ligne commercial-l8 · la ligne de facture nomme l'article qui l'a proposée et
-- porte la remise consentie, qui doit figurer sur la facture pour sortir de la
-- base de la taxe (O.-L. n° 10/001, art. 29). Les lignes existantes restent sans
-- article ni remise · leur montant hors taxes est celui qui figure.

-- AlterTable
ALTER TABLE "lignes_facture" ADD COLUMN     "articleId" TEXT,
ADD COLUMN     "remisePourcent" DECIMAL(5,2);

-- CreateIndex
CREATE INDEX "lignes_facture_articleId_idx" ON "lignes_facture"("articleId");

-- AddForeignKey
ALTER TABLE "lignes_facture" ADD CONSTRAINT "lignes_facture_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles_commerciaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

