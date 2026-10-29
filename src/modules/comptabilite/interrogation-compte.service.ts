import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutEcriture } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

/**
 * INTERROGER LE COMPTE DEPUIS LA SAISIE (ligne gl-saisie, fonction 13 · Sage
 * i7, double-clic sur le compte de la ligne). Le comptable qui passe une
 * pièce veut savoir, sans quitter la grille, ce que le compte porte déjà · un
 * client déjà soldé, une caisse presque vide, une facture déjà saisie.
 *
 * UNE LECTURE, RIEN N'EST ÉCRIT. Elle ne remplace ni le grand livre (le livre
 * obligatoire, AUDCIF art. 19 et 22, 6°) ni la balance · elle en donne un
 * aperçu borné, et le dit.
 *
 * TROIS SOMMES, JAMAIS FONDUES SANS LE DIRE.
 *  · le LIVRE-JOURNAL, les seules écritures validées (art. 22, 2°) ;
 *  · le BROUILLARD, saisi et non validé, à-nouveau provisoire mis à part ;
 *  · l'À-NOUVEAU PROVISOIRE, que la relance du report réécrit et que la
 *    clôture remplace (`Ecriture.estANouveauProvisoire`).
 * Le « solde à ce jour » additionne les trois, et l'écran nomme chacune.
 * Les écritures de SITUATION (simulations, ligne sage-l1) n'entrent dans
 * aucune · elles n'enregistrent aucune opération. L'écriture qui SOLDE les
 * comptes de gestion à la clôture n'entre pas non plus · sans quoi un compte
 * de charge d'un exercice clos se lirait à zéro (balance à trois colonnes,
 * F4 à F6).
 *
 * BORNÉE · les `DERNIERES_LIGNES` lignes les plus récentes, le nombre total
 * toujours dit. Sommes demandées à la base (`aggregate`), jamais à une boucle.
 */
export const DERNIERES_LIGNES = 15;

const LECTURE_DU_COMPTE: Prisma.EcritureWhereInput = {
  statut: { not: StatutEcriture.SITUATION },
  estSoldeDesComptesDeGestion: false,
};

export interface LigneInterrogee {
  id: string;
  date: string;
  journal: string;
  numeroPiece: number | null;
  reference: string | null;
  libelle: string;
  debit: number;
  credit: number;
  statut: 'VALIDEE' | 'BROUILLARD';
  aNouveauProvisoire: boolean;
  lettre: string | null;
  /** Rattachée à un groupe de lettrage partiel (sans lettre servie). */
  lettragePartiel: boolean;
  dateEcheance: string | null;
}

export interface Somme {
  debit: number;
  credit: number;
  solde: number;
}

const centimes = (x: number) => Math.round(x * 100) / 100;
function somme(debit: Prisma.Decimal | null, credit: Prisma.Decimal | null): Somme {
  const d = centimes(Number(debit ?? 0));
  const c = centimes(Number(credit ?? 0));
  return { debit: d, credit: c, solde: centimes(d - c) };
}

@Injectable()
export class InterrogationCompteService {
  constructor(private readonly prisma: PrismaService) {}

  async interroger(tenantId: string, compteId: string, exerciceId: string) {
    // L'exercice est jugé au dossier par son porteur (`EXERCICE_REQUIS`) avant
    // d'arriver ici · le compte l'est ici, introuvable hors du dossier.
    const compte = await this.prisma.compte.findFirst({
      where: { id: compteId, tenantId },
      select: { id: true, numero: true, intitule: true, typeCompte: true, estActif: true },
    });
    if (!compte) throw new NotFoundException('Compte introuvable pour ce dossier');
    const base = { ecriture: { tenantId, exerciceId, ...LECTURE_DU_COMPTE }, compteId: compte.id } satisfies Prisma.LigneEcritureWhereInput;
    const valide = { ...base, ecriture: { ...base.ecriture, statut: StatutEcriture.VALIDEE } } satisfies Prisma.LigneEcritureWhereInput;
    const brouillard = {
      ...base,
      ecriture: { ...base.ecriture, statut: StatutEcriture.BROUILLARD, estANouveauProvisoire: false },
    } satisfies Prisma.LigneEcritureWhereInput;
    const provisoire = {
      ...base,
      ecriture: { ...base.ecriture, statut: StatutEcriture.BROUILLARD, estANouveauProvisoire: true },
    } satisfies Prisma.LigneEcritureWhereInput;
    const [sValide, sBrouillard, sProvisoire, nombre, dernieres] = await Promise.all([
      this.prisma.ligneEcriture.aggregate({ where: valide, _sum: { debit: true, credit: true } }),
      this.prisma.ligneEcriture.aggregate({ where: brouillard, _sum: { debit: true, credit: true } }),
      this.prisma.ligneEcriture.aggregate({ where: provisoire, _sum: { debit: true, credit: true } }),
      this.prisma.ligneEcriture.count({ where: base }),
      this.prisma.ligneEcriture.findMany({
        where: base,
        orderBy: [{ ecriture: { date: 'desc' } }, { ecriture: { createdAt: 'desc' } }, { id: 'desc' }],
        take: DERNIERES_LIGNES,
        select: {
          id: true,
          libelle: true,
          debit: true,
          credit: true,
          lettre: true,
          lettrageId: true,
          dateEcheance: true,
          ecriture: {
            select: {
              date: true,
              numeroPiece: true,
              reference: true,
              libelle: true,
              statut: true,
              estANouveauProvisoire: true,
              journal: { select: { code: true } },
            },
          },
        },
      }),
    ]);
    const livreJournal = somme(sValide._sum.debit, sValide._sum.credit);
    const auBrouillard = somme(sBrouillard._sum.debit, sBrouillard._sum.credit);
    const aNouveauProvisoire = somme(sProvisoire._sum.debit, sProvisoire._sum.credit);
    const lignes: LigneInterrogee[] = dernieres.map((l) => ({
      id: l.id,
      date: l.ecriture.date.toISOString().slice(0, 10),
      journal: l.ecriture.journal.code,
      numeroPiece: l.ecriture.numeroPiece,
      reference: l.ecriture.reference,
      libelle: l.libelle ?? l.ecriture.libelle,
      debit: centimes(Number(l.debit)),
      credit: centimes(Number(l.credit)),
      statut: l.ecriture.statut === StatutEcriture.VALIDEE ? 'VALIDEE' : 'BROUILLARD',
      aNouveauProvisoire: l.ecriture.estANouveauProvisoire === true,
      lettre: l.lettre,
      lettragePartiel: l.lettre === null && l.lettrageId !== null,
      dateEcheance: l.dateEcheance ? l.dateEcheance.toISOString().slice(0, 10) : null,
    }));
    return {
      compte: { id: compte.id, numero: compte.numero, intitule: compte.intitule, typeCompte: compte.typeCompte, estActif: compte.estActif },
      exercice: { id: exerciceId },
      livreJournal,
      brouillard: auBrouillard,
      aNouveauProvisoire,
      soldeAuJour: centimes(livreJournal.solde + auBrouillard.solde + aNouveauProvisoire.solde),
      nombreLignes: nombre,
      lignes,
      tronque: nombre > lignes.length,
    };
  }
}
