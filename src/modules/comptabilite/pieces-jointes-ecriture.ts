import { StatutEcriture } from '@prisma/client';
import type { LecteurDesPieces, ObjetLu, RegleDesPieces } from '../../common/pieces-jointes/table-des-pieces';

/**
 * LA PIÈCE JUSTIFICATIVE JOINTE À UNE ÉCRITURE (ligne sage-l6, fonction
 * n° 22 · Sage, F_ECRITURECMEDIA, ouverte depuis la saisie).
 *
 * DÉCISION PAR LA LOI (AUDCIF art. 17, 3° et 5° ; art. 22, 2° et 7° ; art. 24,
 * non exclus par l'art. 3 du SYCEBNL, qui ne vise que les art. 5, 8, 10 à 13,
 * 17 al. 7 et 8, 18, 19 quatrième tiret, 21, 25 à 34, 49, 69 à 71, 73 à 113).
 *
 *  1. DÉPOSER, TOUJOURS · l'art. 17, 3° veut les écritures justifiées « par des
 *     pièces datées, conservées, classées […] portant les références de leur
 *     enregistrement en comptabilité ». Joindre la copie d'une pièce ne touche
 *     ni l'origine, ni le contenu, ni l'imputation de l'enregistrement
 *     (art. 22, 1°), et l'irréversibilité de l'art. 22, 2° vise
 *     l'enregistrement validé, non le classement de sa pièce · une écriture
 *     validée, d'un exercice clôturé compris, reçoit donc sa pièce. Seul
 *     l'à-nouveau PROVISOIRE la refuse · il se recalcule et disparaît, et ne
 *     justifie aucune opération.
 *  2. RETIRER, TANT QUE L'ÉCRITURE EST AU BROUILLARD · elle-même s'y modifie
 *     et s'y supprime (art. 22, 2°). VALIDÉE, elle est entrée au
 *     livre-journal · « chaque enregistrement s'appuie sur une pièce
 *     justificative fiable et conservée » (art. 22, 7°), conservée DIX ANS
 *     (art. 24), et le chemin de révision doit pouvoir se reconstituer
 *     (art. 22, 6°) · la pièce jointe ne se retire plus, données personnelles
 *     comprises · le droit à l'effacement cède à « une obligation légale qui
 *     requiert le traitement » (ordonnance-loi n° 23/10 du 13 mars 2023,
 *     art. 216). L'écriture de
 *     SITUATION n'entre jamais au livre-journal (ligne sage-l1, fonction 12) ·
 *     sa pièce se retire comme celle d'un brouillard.
 *  3. L'ÉCRITURE RETIRÉE AU BROUILLARD LAISSE SA PIÈCE DÉTACHÉE, jamais
 *     perdue (clé SET NULL, `detenteurs-ecriture.ts`) · elle se lit dans les
 *     pièces détachées, avec ce qu'elle justifiait au dépôt.
 *
 * Le commentaire de la pièce est une annotation d'OmegaX, ni la pièce ni
 * l'écriture · il se retouche à tout moment, au journal d'audit.
 */

export interface EcritureDesPieces {
  statut: StatutEcriture;
  estANouveauProvisoire: boolean;
  numeroPiece: number | null;
  date: Date;
  libelle: string;
  journal: { code: string };
}

/** Ce que la pièce justifie, dit en une ligne · figé au dépôt (`ecritureDecrite`). */
export function descriptionDeLEcriture(e: EcritureDesPieces): string {
  const date = e.date.toISOString().slice(0, 10).split('-').reverse().join('/');
  const texte = `${e.journal.code} n° ${e.numeroPiece ?? 'sans numéro'} du ${date} · ${e.libelle}`;
  return Array.from(texte).slice(0, 190).join('');
}

export function motifRefusDepotEcriture(e: EcritureDesPieces): string | null {
  if (e.estANouveauProvisoire) {
    return (
      "L'à-nouveau provisoire se recalcule à chaque relance et disparaît à la clôture · une pièce ne s'y joint pas. " +
      "Joignez-la à l'écriture d'ouverture qui fait foi (report de clôture ou bilan d'ouverture importé)."
    );
  }
  return null;
}

export function motifRefusRetraitEcriture(e: EcritureDesPieces): string | null {
  if (e.statut !== StatutEcriture.VALIDEE) return null;
  return (
    `Cette pièce justifie l'écriture ${e.journal.code} n° ${e.numeroPiece ?? 'sans numéro'}, validée · elle se conserve ` +
    "avec elle et ne se retire plus (AUDCIF art. 22, 2° et 7° ; art. 24). Une erreur de pièce se corrige en joignant la " +
    'bonne, dont le commentaire dit laquelle elle remplace.'
  );
}

/**
 * L'écriture désignée par son identifiant, dans le dossier · toute écriture
 * (brouillard, validée, situation) peut recevoir sa pièce, et c'est la règle
 * ci-dessus qui juge ce qu'elle permet.
 */
async function lireEcritureDesPieces(db: LecteurDesPieces, tenantId: string, ecritureId: string): Promise<ObjetLu | null> {
  const e = await db.ecriture.findFirst({
    where: { id: ecritureId, tenantId },
    select: {
      statut: true,
      estANouveauProvisoire: true,
      numeroPiece: true,
      date: true,
      libelle: true,
      journal: { select: { code: true } },
    },
  });
  if (!e) return null;
  return {
    description: descriptionDeLEcriture(e),
    motifRefusDepot: motifRefusDepotEcriture(e),
    motifRefusRetrait: motifRefusRetraitEcriture(e),
  };
}

/**
 * LE VERROU DU RETRAIT · une validation entre la lecture du statut et le
 * retrait ferait partir la pièce d'une écriture entrée au livre-journal.
 * La ligne de l'écriture est verrouillée en tête de la transaction · la
 * validation, qui la met à jour, attend la fin du retrait, et le statut lu
 * ensuite est celui que la pièce emporte.
 */
async function verrouillerEcriture(db: LecteurDesPieces, tenantId: string, ecritureId: string): Promise<void> {
  await db.$queryRaw`SELECT "id", "statut" FROM "ecritures" WHERE "id" = ${ecritureId} AND "tenantId" = ${tenantId} FOR UPDATE`;
}

export const REGLE_PIECES_ECRITURE: RegleDesPieces = {
  objet: 'ECRITURE',
  designation: 'cette écriture',
  lireObjet: lireEcritureDesPieces,
  verrouiller: verrouillerEcriture,
};
