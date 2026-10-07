import { ClasseCompte, Prisma, TypeJournal } from '@prisma/client';

/**
 * LE PÉRIMÈTRE DE LA POSITION D'OUVERTURE PASSÉE AU PREMIER JOUR (AU2), écrit
 * une fois. La clôture le confronte au report (`ouvertureDejaPassee`,
 * exercice.service.ts) ; les états financiers le lisent pour ne pas prendre
 * pour des flux de l'exercice une ouverture saisie en OD (cas chiffrés de la
 * clôture, relecture du 2026-10-07, bloquant 2). Voir le commentaire de
 * `ouvertureDejaPassee` pour le pourquoi de chaque borne.
 */
const ESTUNE_OUVERTURE: Prisma.EcritureWhereInput = { OR: [{ estGenereeParCloture: true }, { journal: { type: TypeJournal.GENERAL } }] };

export function filtreOuverturePasseeAuPremierJour(tenantId: string, exercice: { id: string; dateDebut: Date }): Prisma.EcritureWhereInput {
  return {
    tenantId,
    exerciceId: exercice.id,
    estANouveauProvisoire: false,
    estSoldeDesComptesDeGestion: false,
    AND: [
      { OR: [{ date: exercice.dateDebut }, { dateValeur: exercice.dateDebut }] },
      // Une ouverture de bilan ne passe JAMAIS par un journal d'achats, de
      // ventes ou de trésorerie (décision du coordinateur, troisième tour) ·
      // une écriture de ces journaux au premier jour est une opération de
      // l'exercice, que RECTIFIER ne doit jamais inscrire en négatif. Restent
      // l'à-nouveau (quel que soit son journal), le journal d'opérations
      // diverses (type général), et ce qui corrige l'un d'eux (lien
      // `corrigeEcritureId`).
      { OR: [ESTUNE_OUVERTURE, { corrigeEcriture: { is: ESTUNE_OUVERTURE } }] },
    ],
    lignes: { none: { compte: { classe: { in: [ClasseCompte.CLASSE_6, ClasseCompte.CLASSE_7, ClasseCompte.CLASSE_8] } } } },
  };
}
