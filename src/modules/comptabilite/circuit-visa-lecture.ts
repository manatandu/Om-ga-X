import { Prisma } from '@prisma/client';
import type { ContenuDeLEcriture } from './circuit-visa';

/**
 * CE QUE L'EMPREINTE DU VISA LIT, EN UNE SEULE SÉLECTION (`circuit-visa.ts`,
 * règle 1) · le brouillard qui l'affiche, le visa qui la pose et la
 * validation qui la rejoue lisent les MÊMES champs. Deux sélections écrites à
 * part finiraient par diverger, et un visa juste tomberait à la validation
 * sans que rien du contenu n'ait bougé.
 */
export const SELECT_CONTENU_VISE = {
  date: true,
  dateValeur: true,
  journalId: true,
  numeroPiece: true,
  reference: true,
  libelle: true,
  lignes: {
    select: {
      compteId: true,
      libelle: true,
      debit: true,
      credit: true,
      deviseId: true,
      montantDevise: true,
      coursApplique: true,
      dateEcheance: true,
      tauxTvaId: true,
      modeReglementId: true,
      ventilations: { select: { sectionId: true, planId: true, debit: true, credit: true } },
    },
  },
} satisfies Prisma.EcritureSelect;

/** Les traces de l'auteur et du visa, lues avec le contenu. */
export const SELECT_TRACES_VISA = {
  createdBy: true,
  contenuPar: true,
  contenuLe: true,
  viseePar: true,
  viseeLe: true,
  viseeEmpreinte: true,
} satisfies Prisma.EcritureSelect;

export type EcritureContenuLu = Prisma.EcritureGetPayload<{ select: typeof SELECT_CONTENU_VISE }>;

/** Le contenu lu en base, dans la forme que l'empreinte lit. */
export function contenuLu(e: EcritureContenuLu): ContenuDeLEcriture {
  return {
    date: e.date,
    dateValeur: e.dateValeur,
    journalId: e.journalId,
    numeroPiece: e.numeroPiece,
    reference: e.reference,
    libelle: e.libelle,
    lignes: e.lignes.map((l) => ({
      compteId: l.compteId,
      libelle: l.libelle,
      debit: l.debit,
      credit: l.credit,
      deviseId: l.deviseId,
      montantDevise: l.montantDevise,
      coursApplique: l.coursApplique,
      dateEcheance: l.dateEcheance,
      tauxTvaId: l.tauxTvaId,
      modeReglementId: l.modeReglementId,
      ventilations: l.ventilations.map((v) => ({ sectionId: v.sectionId, planId: v.planId, debit: v.debit, credit: v.credit })),
    })),
  };
}
