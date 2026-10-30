import { ConflictException } from '@nestjs/common';
import { prendreLeVerrouDuDossierBorne } from '../../common/transaction-de-saisie';
import { Prisma, StatutEcriture } from '@prisma/client';
import type { LecteurDesPieces, ObjetLu, RegleDesPieces } from '../../common/pieces-jointes/table-des-pieces';
import { acteurCourant } from '../../common/audit/contexte-audit';
import { journalHorsPerimetre } from '../../common/perimetre/extension-perimetre-journaux';

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
 * JOINDRE OU RETIRER LA PIÈCE D'UNE ÉCRITURE EST UNE SAISIE SUR SON JOURNAL
 * (relecture « échecs silencieux » de la ligne sage-l6, mineur 6, décision
 * de la ligne) · le profil de fonctions range déjà le contrôleur des pièces
 * d'écriture en SAISIE (`fonctions-metier.ts`), et les journaux autorisés
 * restreignent la saisie, jamais la lecture (`extension-perimetre-journaux.ts`)
 * · le caissier qui ne tient que la caisse ne joint ni ne retire la facture
 * d'un achat. La consultation et le téléchargement restent ouverts ; le
 * commentaire, annotation d'OmegaX, aussi. Null quand l'acteur n'a aucune
 * restriction (l'administrateur, ou la liste non posée).
 */
export function motifHorsPerimetreEcriture(journal: { id: string | null; code: string | null }): string | null {
  const autorises = acteurCourant()?.journauxAutorises;
  if (!journalHorsPerimetre(journal.id, autorises)) return null;
  const ou = journal.code ? `au journal ${journal.code}` : 'à une écriture retirée depuis (pièce détachée)';
  return (
    `Cette pièce est jointe ${ou}, hors de votre périmètre de saisie · joindre ou retirer la pièce d'une écriture est ` +
    "une saisie sur son journal. La consultation et le téléchargement restent ouverts ; l'administrateur du dossier " +
    'règle les journaux autorisés dans la fenêtre Utilisateurs.'
  );
}

/**
 * L'écriture désignée par son identifiant, dans le dossier · toute écriture
 * (brouillard, validée, situation) peut recevoir sa pièce, et c'est la règle
 * ci-dessus qui juge ce qu'elle permet.
 */
export async function lireEcritureDesPieces(db: LecteurDesPieces, tenantId: string, ecritureId: string): Promise<ObjetLu | null> {
  const e = await db.ecriture.findFirst({
    where: { id: ecritureId, tenantId },
    select: {
      statut: true,
      estANouveauProvisoire: true,
      numeroPiece: true,
      date: true,
      libelle: true,
      journalId: true,
      journal: { select: { code: true } },
    },
  });
  if (!e) return null;
  return {
    description: descriptionDeLEcriture(e),
    motifRefusDepot: motifRefusDepotEcriture(e),
    motifRefusRetrait: motifRefusRetraitEcriture(e),
    motifHorsPerimetre: motifHorsPerimetreEcriture({ id: e.journalId, code: e.journal.code }),
  };
}

/**
 * LE VERROU DE L'ÉCRITURE, TOUJOURS PRIS AVANT SES PIÈCES · une validation
 * entre la lecture du statut et le retrait ferait partir la pièce d'une
 * écriture entrée au livre-journal. La ligne de l'écriture est verrouillée en
 * tête de la transaction · la validation, qui la met à jour, attend la fin du
 * geste, et le statut lu ensuite est celui que la pièce emporte. Le dépôt
 * concurrent attend aussi (sa clé étrangère prend un verrou partagé sur la
 * même ligne) · il ne se glisse plus entre le report des pièces et la
 * suppression de l'écriture. UN SEUL ORDRE, écriture puis pièces, pour le
 * retrait, le report et la suppression (second tour de relecture, MAJEUR) ·
 * deux ordres inverses s'interbloquaient.
 */
export async function verrouillerEcriture(db: LecteurDesPieces, tenantId: string, ecritureId: string): Promise<void> {
  // Le dossier avant la ligne · un seul ordre de verrous (saisie-serialisable, point 1).
  await prendreLeVerrouDuDossierBorne(db as Prisma.TransactionClient, tenantId);
  await db.$queryRaw`SELECT "id", "statut" FROM "ecritures" WHERE "id" = ${ecritureId} AND "tenantId" = ${tenantId} FOR UPDATE`;
}

export const REGLE_PIECES_ECRITURE: RegleDesPieces = {
  objet: 'ECRITURE',
  designation: 'cette écriture',
  lireObjet: lireEcritureDesPieces,
  verrouiller: verrouillerEcriture,
  // La pièce détachée n'a plus de journal · seul un utilisateur sans
  // restriction la retire (une écriture sans journal ne se saisit pas).
  motifHorsPerimetreDetachee: () => motifHorsPerimetreEcriture({ id: null, code: null }),
};

/** Combien de pièces une même lecture retouche au plus · les lots se suivent jusqu'au bout. */
const LOT_PIECES = 200;

/** Ce qu'une mise à jour de pièce rend · jamais `contenu` (5 Mo par pièce). */
const SANS_BINAIRE = { id: true, ecritureId: true, ecritureDecrite: true } as const;

/**
 * L'ÉCRITURE QUI EN REMPLACE UNE AUTRE EMPORTE SES PIÈCES (relecture « échecs
 * silencieux » de la ligne sage-l6, M1). Un module qui REMPLACE sa pièce au
 * brouillard par une neuve (la fiche d'un bien dont la date d'acquisition
 * change de mois dans un journal numéroté par mois, ou d'exercice) supprimait
 * l'ancienne · la clé `SET NULL` détachait EN SILENCE la facture jointe, la
 * neuve partait sans justificatif (AUDCIF art. 17, 3° ; art. 22, 7°), et la
 * pièce détachée devenait retirable par quiconque. Appelée DANS la
 * transaction qui retire l'ancienne, AVANT sa suppression · une mise à jour
 * UNITAIRE par pièce (le journal d'audit garde chacune avant et après), la
 * description refaite sur la neuve. Rend le nombre de pièces reportées.
 */
export async function reporterLesPieces(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ancienneId: string,
  nouvelleId: string,
): Promise<number> {
  // L'ancienne d'abord, avant toute lecture de ses pièces (voir `verrouillerEcriture`).
  await verrouillerEcriture(tx, tenantId, ancienneId);
  const nouvelle = await lireEcritureDesPieces(tx, tenantId, nouvelleId);
  if (!nouvelle) {
    throw new ConflictException("L'écriture qui remplace la pièce a été retirée pendant le geste · rien n'est modifié.");
  }
  let reportees = 0;
  // Chaque pièce reportée sort du filtre · la boucle s'arrête au premier lot vide.
  for (;;) {
    const lot = await tx.pieceJointeEcriture.findMany({
      where: { tenantId, ecritureId: ancienneId },
      orderBy: { id: 'asc' },
      take: LOT_PIECES,
      select: { id: true, nomFichier: true },
    });
    if (lot.length === 0) return reportees;
    for (const p of lot) {
      try {
        // Jamais le binaire en retour · le journal d'audit lit l'écriture et la description.
        await tx.pieceJointeEcriture.update({
          where: { id: p.id },
          data: { ecritureId: nouvelleId, ecritureDecrite: nouvelle.description },
          select: SANS_BINAIRE,
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException(
            `La pièce « ${p.nomFichier} » est déjà jointe à l'écriture qui remplace (même contenu) · rien n'est modifié. ` +
              "Retirez l'un des deux exemplaires, puis relancez.",
          );
        }
        throw e;
      }
      reportees++;
    }
  }
}

/**
 * LA DESCRIPTION SUIT L'ÉCRITURE (relecture « échecs silencieux », mineur 2) ·
 * figée au dépôt, elle disait encore l'ancien journal, l'ancien numéro ou
 * l'ancienne date d'une écriture modifiée ou transférée au brouillard, et
 * c'est elle que lit la pièce détachée. Refaite DANS la transaction qui
 * change l'écriture, une pièce à la fois (journal d'audit), seulement celles
 * dont elle a changé. Rend le nombre de pièces retouchées.
 */
export async function retoucherDescriptionDesPieces(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ecritureId: string,
): Promise<number> {
  // La plupart des écritures n'ont aucune pièce · un décompte, et rien d'autre.
  const nombre = await tx.pieceJointeEcriture.count({ where: { tenantId, ecritureId } });
  return nombre === 0 ? 0 : refaireLesDescriptions(tx, tenantId, ecritureId);
}

async function refaireLesDescriptions(tx: Prisma.TransactionClient, tenantId: string, ecritureId: string): Promise<number> {
  const e = await lireEcritureDesPieces(tx, tenantId, ecritureId);
  if (!e) return 0;
  let retouchees = 0;
  for (;;) {
    const lot = await tx.pieceJointeEcriture.findMany({
      where: { tenantId, ecritureId, NOT: { ecritureDecrite: e.description } },
      orderBy: { id: 'asc' },
      take: LOT_PIECES,
      select: { id: true },
    });
    if (lot.length === 0) return retouchees;
    for (const p of lot) {
      await tx.pieceJointeEcriture.update({ where: { id: p.id }, data: { ecritureDecrite: e.description }, select: SANS_BINAIRE });
      retouchees++;
    }
  }
}

/**
 * LES PIÈCES QUE LA SUPPRESSION D'UNE ÉCRITURE AU BROUILLARD VA DÉTACHER
 * (relecture « échecs silencieux », mineur 1) · comptées dans la transaction
 * qui la retire, leur description refaite une dernière fois, pour que le
 * geste le DISE et que la pièce détachée dise ce qu'elle justifiait.
 */
export async function preparerLesPiecesADetacher(tx: Prisma.TransactionClient, tenantId: string, ecritureId: string): Promise<number> {
  // L'écriture d'abord · un dépôt concurrent attend la suppression, puis
  // tombe sur l'écriture partie (409), au lieu d'être détaché sans compte.
  await verrouillerEcriture(tx, tenantId, ecritureId);
  const nombre = await tx.pieceJointeEcriture.count({ where: { tenantId, ecritureId } });
  if (nombre > 0) await refaireLesDescriptions(tx, tenantId, ecritureId);
  return nombre;
}
