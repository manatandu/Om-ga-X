import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClasseCompte, TypeCompteDetailTotal } from '@prisma/client';
import { EtatsFinanciersService } from './etats-financiers.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ExerciceService } from '../exercice/exercice.service';
import {
  ecartAuCentime,
  lireCodeDeNote,
  lireColonneOrigine,
  lireEtatZoomable,
  lireRefPoste,
  origineParFormule,
  type ColonneOrigine,
  type OrigineDuMontant,
} from './origine-des-montants';

/**
 * D'OÙ VIENT CE CHIFFRE, SYCEBNL (ligne origine-des-montants) · le zoom de
 * Sage 100 sur le bilan, le compte de résultat et le tableau des flux du jeu
 * « associations et ordres professionnels ».
 *
 * Même propriété que le spec du SYSCOHADA · TOUS les postes de chaque état,
 * toutes leurs colonnes, sur un jeu d'essai à trois exercices, et pour chacun
 * la somme des contributions (ou des composants d'un total) égale au centime
 * le montant que l'état sert. Les cinq lignes calculées du compte de résultat
 * (XA à XE) sont lues par `SOLDES_COMPTE_RESULTAT` · c'est ce spec qui la
 * confronte au calcul du service.
 */

function ligne(numero: string, mouvementDebit: number, mouvementCredit: number, reportDebit: number, reportCredit: number) {
  const totalDebit = reportDebit + mouvementDebit;
  const totalCredit = reportCredit + mouvementCredit;
  return {
    compteId: `id-${numero}`,
    numero,
    intitule: `Compte ${numero}`,
    classe: (`CLASSE_${numero[0]}` as ClasseCompte),
    typeCompte: TypeCompteDetailTotal.DETAIL,
    totalDebit,
    totalCredit,
    reportDebit,
    reportCredit,
    mouvementDebit,
    mouvementCredit,
    solde: totalDebit - totalCredit,
  };
}
type Ligne = ReturnType<typeof ligne>;

/** Numéros du plan SYCEBNL semé · report débit, report crédit, mouvement débit, mouvement crédit. */
const COMPTES: Array<[string, number, number, number, number]> = [
  ['10100000', 0, 4_000_000, 0, 500_000],
  ['10600000', 0, 0, 0, 200_000],
  ['11100000', 0, 300_000, 0, 50_000],
  ['12100000', 0, 150_000, 0, 0],
  ['13100000', 0, 700_000, 0, 0],
  ['14100000', 0, 500_000, 100_000, 0],
  ['16200000', 0, 800_000, 300_000, 450_000],
  ['18100000', 0, 600_000, 150_000, 200_000],
  ['19100000', 0, 50_000, 0, 30_000],
  ['20100000', 120_000, 0, 30_000, 0],
  ['21100000', 250_000, 0, 40_000, 0],
  ['22100000', 1_000_000, 0, 0, 0],
  ['23100000', 1_800_000, 0, 400_000, 0],
  ['24410000', 700_000, 0, 200_000, 80_000],
  ['27500000', 40_000, 0, 10_000, 0],
  ['28310000', 0, 400_000, 0, 90_000],
  ['28440000', 0, 250_000, 50_000, 70_000],
  ['31100000', 200_000, 0, 60_000, 0],
  ['39100000', 0, 15_000, 0, 4_000],
  ['40110000', 0, 500_000, 1_600_000, 1_800_000],
  ['40910000', 30_000, 0, 20_000, 0],
  ['41100000', 300_000, 0, 900_000, 700_000],
  ['41200000', 400_000, 0, 1_200_000, 1_100_000],
  ['41900000', 0, 25_000, 0, 10_000],
  ['42200000', 0, 90_000, 600_000, 620_000],
  ['43100000', 0, 40_000, 150_000, 160_000],
  ['44310000', 0, 70_000, 200_000, 230_000],
  ['44510000', 60_000, 0, 180_000, 160_000],
  ['47100000', 12_000, 0, 3_000, 0],
  ['49100000', 0, 30_000, 0, 8_000],
  ['50100000', 90_000, 0, 30_000, 0],
  ['52100000', 900_000, 0, 3_000_000, 2_800_000],
  ['52200000', 0, 150_000, 80_000, 260_000],
  ['56100000', 0, 0, 0, 60_000],
  ['57100000', 50_000, 0, 400_000, 380_000],
  ['60100000', 0, 0, 900_000, 10_000],
  ['60200000', 0, 0, 300_000, 0],
  ['60310000', 0, 0, 0, 60_000],
  ['60400000', 0, 0, 120_000, 0],
  ['61000000', 0, 0, 45_000, 0],
  ['62200000', 0, 0, 130_000, 0],
  ['63100000', 0, 0, 25_000, 0],
  ['64100000', 0, 0, 35_000, 0],
  ['65800000', 0, 0, 8_000, 0],
  ['66100000', 0, 0, 600_000, 0],
  ['67100000', 0, 0, 70_000, 0],
  ['68100000', 0, 0, 160_000, 0],
  ['69100000', 0, 0, 20_000, 0],
  ['70100000', 0, 0, 0, 1_100_000],
  ['70400000', 0, 0, 0, 700_000],
  ['70510000', 0, 0, 20_000, 400_000],
  ['71100000', 0, 0, 0, 300_000],
  ['75800000', 0, 0, 0, 12_000],
  ['77100000', 0, 0, 0, 18_000],
  ['78100000', 0, 0, 0, 9_000],
  ['79100000', 0, 0, 0, 15_000],
  ['81200000', 0, 0, 40_000, 0],
  ['82200000', 0, 0, 0, 60_000],
  ['83100000', 0, 0, 7_000, 0],
  ['84100000', 0, 0, 0, 9_000],
  ['85100000', 0, 0, 14_000, 0],
  ['86100000', 0, 0, 0, 11_000],
  ['87100000', 0, 0, 6_000, 0],
];

function lignesDe(f: number): Ligne[] {
  return COMPTES.map(([n, rd, rc, md, mc]) =>
    ligne(n, Math.round(md * f), Math.round(mc * f), Math.round(rd * f), Math.round(rc * f)),
  );
}

const EXERCICES = [
  { id: 'e0', dateDebut: new Date('2024-01-01T00:00:00Z') },
  { id: 'e1', dateDebut: new Date('2025-01-01T00:00:00Z') },
  { id: 'e2', dateDebut: new Date('2026-01-01T00:00:00Z') },
];

function service(lignesParExercice: Record<string, Ligne[]> = { e0: lignesDe(0.7), e1: lignesDe(1), e2: lignesDe(1.29) }) {
  const ecritureService = {
    balance: jest.fn().mockImplementation((_t: string, exerciceId: string) =>
      Promise.resolve({ lignes: lignesParExercice[exerciceId] ?? [], totaux: { debit: 0, credit: 0 } }),
    ),
    virementsDeMiseEnService: jest.fn().mockResolvedValue(new Map()),
    ouverturePasseeAuPremierJour: jest.fn().mockResolvedValue(null),
    positionDOuvertureAuPremierJour: jest.fn().mockResolvedValue({ etat: 'AUCUNE' }),
    nombreAuBrouillard: jest.fn().mockResolvedValue(0),
    mouvementsDeReevaluation: jest.fn().mockResolvedValue(new Map()),
    mouvementsDeCoutsEmpruntIncorpores: jest.fn().mockResolvedValue(new Map()),
    positionsOuvertureEnOdParCompte: jest.fn().mockResolvedValue(new Map()),
  } as unknown as EcritureService;
  const exerciceService = {
    lister: jest.fn().mockResolvedValue([...EXERCICES].sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime())),
  } as unknown as ExerciceService;
  return new EtatsFinanciersService(ecritureService, exerciceService);
}

function verifier(o: OrigineDuMontant, contexte: string) {
  if (o.montant === null) {
    expect({ contexte, nature: o.nature }).toEqual({ contexte, nature: 'HORS_BALANCE' });
    return;
  }
  if (o.nature === 'HORS_BALANCE') return;
  expect({ contexte, ecart: o.ecart }).toEqual({ contexte, ecart: 0 });
  expect({ contexte, total: Math.round((o.total as number) * 100) }).toEqual({ contexte, total: Math.round(o.montant * 100) });
  if (o.nature === 'COMPTES') {
    const somme = o.groupes.reduce((s, g) => s + g.comptes.reduce((t, c) => t + c.montant, 0), 0);
    expect(Math.round(somme * 100)).toBe(Math.round(o.montant * 100));
  }
}

describe("EtatsFinanciersService.origine · d'où vient ce chiffre (SYCEBNL, associations)", () => {
  const s = service();

  it('BILAN · tout poste, toute colonne, refait au centime', async () => {
    const bilan = await s.bilan('t', 'e2');
    let chiffres = 0;
    for (const l of bilan.actif) {
      for (const colonne of ['N', 'N1', 'BRUT', 'AMORTISSEMENT'] as ColonneOrigine[]) {
        const o = await s.origine('t', 'e2', 'bilan', l.ref, colonne);
        verifier(o, `${l.ref} ${colonne}`);
        if (o.montant && Math.abs(o.montant) > 0.005) chiffres++;
      }
    }
    for (const l of bilan.passif) {
      for (const colonne of ['N', 'N1'] as ColonneOrigine[]) {
        const o = await s.origine('t', 'e2', 'bilan', l.ref, colonne);
        verifier(o, `${l.ref} ${colonne}`);
        if (o.montant && Math.abs(o.montant) > 0.005) chiffres++;
      }
    }
    expect(chiffres).toBeGreaterThan(50);
    await expect(s.origine('t', 'e2', 'bilan', 'CA', 'AMORTISSEMENT')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('COMPTE DE RÉSULTAT · tout poste et les cinq lignes calculées XA à XE, N et N-1', async () => {
    const cr = await s.compteDeResultat('t', 'e2');
    const refs = [...cr.produits, ...cr.charges, cr.produitsHao, cr.chargesHao].map((p) => p.ref).concat(['XA', 'XB', 'XC', 'XD', 'XE']);
    let chiffres = 0;
    for (const ref of refs) {
      for (const colonne of ['N', 'N1'] as ColonneOrigine[]) {
        const o = await s.origine('t', 'e2', 'compte-de-resultat', ref, colonne);
        verifier(o, `${ref} ${colonne}`);
        if (o.montant && Math.abs(o.montant) > 0.005) chiffres++;
      }
    }
    expect(chiffres).toBeGreaterThan(30);
    const xe = await s.origine('t', 'e2', 'compte-de-resultat', 'XE', 'N');
    expect(xe.montant).toBe(cr.resultatNet);
    expect(xe.composants.map((c) => c.ref)).toEqual(['XC', 'XD']);
  });

  it('TABLEAU DES FLUX · tout poste, flux et créances ou dettes de contrepartie, N et N-1', async () => {
    const tft = await s.tableauFluxTresorerie('t', 'e2');
    let chiffres = 0;
    for (const l of tft.lignes) {
      if (!('ref' in l)) continue;
      for (const colonne of ['N', 'N1'] as ColonneOrigine[]) {
        const o = await s.origine('t', 'e2', 'tableau-flux-tresorerie', l.ref, colonne);
        verifier(o, `${l.ref || '(ligne sans code)'} ${colonne}`);
        if (o.montant && Math.abs(o.montant) > 0.005) chiffres++;
      }
    }
    expect(chiffres).toBeGreaterThan(15);
    // ZA lit la trésorerie de clôture N-1 · son grand livre est celui de N-1.
    const za = await s.origine('t', 'e2', 'tableau-flux-tresorerie', 'ZA', 'N');
    expect(za.exerciceDesComptesId).toBe('e1');
    expect(za.groupes.map((g) => g.titre)).toEqual(['Trésorerie actif (BX)', 'Trésorerie passif (DX)']);
  });

  it('un poste inconnu est introuvable, pas une cellule à zéro', async () => {
    await expect(s.origine('t', 'e2', 'compte-de-resultat', 'ZZ', 'N')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('origine-des-montants · aides', () => {
  it('lit état, colonne et code, refuse en 400 nommé le reste', () => {
    expect(lireEtatZoomable('bilan')).toBe('bilan');
    expect(() => lireEtatZoomable('liasse')).toThrow(BadRequestException);
    expect(lireColonneOrigine(undefined)).toBe('N');
    expect(lireColonneOrigine('N1')).toBe('N1');
    expect(() => lireColonneOrigine('N2')).toThrow(BadRequestException);
    expect(lireRefPoste('RQP')).toBe('RQP');
    expect(lireRefPoste('')).toBe('');
    expect(() => lireRefPoste("AD'; --")).toThrow(BadRequestException);
    // Le code d'une note garde l'espace du texte (« 16B bis »), refusé jusqu'au rejeu sur vraie base.
    expect(lireCodeDeNote('16B bis')).toBe('16B bis');
    expect(lireCodeDeNote('5A')).toBe('5A');
    expect(() => lireCodeDeNote(' 5A')).toThrow(BadRequestException);
  });

  it("l'écart se dit au centime, un reste de flottant n'en est pas un", () => {
    expect(ecartAuCentime(0.3, 0.1 + 0.2)).toBe(0);
    expect(ecartAuCentime(100, 99.99)).toBe(0.01);
  });

  it("un composant vide rend le total incalculable · jamais un zéro qui ferait passer l'écart pour nul", () => {
    const o = origineParFormule({ etat: 'bilan', ref: 'X', libelle: 'X', colonne: 'N', montant: 10, exerciceDesComptesId: null }, [
      { ref: 'A', libelle: 'A', signe: 1, montant: 10 },
      { ref: 'B', libelle: 'B', signe: 1, montant: null },
    ]);
    expect(o.total).toBeNull();
    expect(o.ecart).toBeNull();
  });
});
