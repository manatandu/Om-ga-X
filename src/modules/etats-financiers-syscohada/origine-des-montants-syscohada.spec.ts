import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClasseCompte, TypeCompteDetailTotal } from '@prisma/client';
import { EtatsFinanciersSyscohadaService } from './etats-financiers-syscohada.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ExerciceService } from '../exercice/exercice.service';
import type { ColonneOrigine, OrigineDuMontant } from '../etats-financiers/origine-des-montants';

/**
 * D'OÙ VIENT CE CHIFFRE, SYSCOHADA (ligne origine-des-montants) · le zoom de
 * Sage 100 sur le bilan, le compte de résultat et le tableau des flux du
 * Système normal.
 *
 * Ce qui casserait EN SILENCE · une remontée dont les comptes ne refont pas le
 * montant cliqué. Le cabinet lirait une justification fausse d'un chiffre
 * juste (ou juste d'un chiffre faux), et rien ne le dirait. Le spec parcourt
 * donc TOUS les postes de chaque état, toutes leurs colonnes, sur un jeu
 * d'essai à trois exercices qui chiffre la plupart d'entre eux, et exige pour
 * chacun que la somme des contributions (ou des composants d'un total) égale
 * le montant de l'état au centime · jamais un échantillon.
 */

function ligne(
  numero: string,
  classe: ClasseCompte,
  mouvementDebit: number,
  mouvementCredit: number,
  report: { debit?: number; credit?: number } = {},
) {
  const reportDebit = report.debit ?? 0;
  const reportCredit = report.credit ?? 0;
  const totalDebit = reportDebit + mouvementDebit;
  const totalCredit = reportCredit + mouvementCredit;
  return {
    compteId: `id-${numero}`,
    numero,
    intitule: `Compte ${numero}`,
    classe,
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

const CLASSE: Record<string, ClasseCompte> = {
  '1': ClasseCompte.CLASSE_1,
  '2': ClasseCompte.CLASSE_2,
  '3': ClasseCompte.CLASSE_3,
  '4': ClasseCompte.CLASSE_4,
  '5': ClasseCompte.CLASSE_5,
  '6': ClasseCompte.CLASSE_6,
  '7': ClasseCompte.CLASSE_7,
  '8': ClasseCompte.CLASSE_8,
};

/**
 * Comptes du jeu d'essai, numéros du plan SYSCOHADA semé · un par famille
 * que lisent les postes, débiteurs et créditeurs mêlés, un découvert (52
 * créditeur) et le résultat précédent encore au 13. Les montants changent
 * d'un exercice à l'autre (facteur), pour que N, N-1 et les variations du
 * tableau des flux soient tous non nuls.
 */
const COMPTES: Array<[string, number, number, number, number]> = [
  // numero, report débit, report crédit, mouvement débit, mouvement crédit
  ['10110000', 0, 5_000_000, 0, 1_000_000],
  ['10610000', 0, 0, 0, 300_000],
  ['11110000', 0, 400_000, 0, 120_000],
  ['12110000', 0, 250_000, 0, 0],
  ['13100000', 0, 900_000, 0, 0],
  ['14100000', 0, 600_000, 150_000, 0],
  ['15100000', 0, 80_000, 0, 20_000],
  ['16210000', 0, 2_000_000, 400_000, 1_000_000],
  ['19110000', 0, 100_000, 0, 50_000],
  ['21100000', 300_000, 0, 50_000, 0],
  ['22100000', 1_200_000, 0, 0, 0],
  ['23110000', 2_500_000, 0, 600_000, 0],
  ['24410000', 900_000, 0, 250_000, 100_000],
  ['27500000', 70_000, 0, 10_000, 0],
  ['28310000', 0, 500_000, 0, 125_000],
  ['28440000', 0, 300_000, 60_000, 90_000],
  ['31100000', 400_000, 0, 150_000, 0],
  ['39110000', 0, 20_000, 0, 5_000],
  ['40110000', 0, 700_000, 2_100_000, 2_400_000],
  ['40910000', 50_000, 0, 30_000, 0],
  ['41110000', 900_000, 0, 3_000_000, 2_600_000],
  ['41910000', 0, 40_000, 0, 15_000],
  ['42210000', 0, 120_000, 800_000, 820_000],
  ['43110000', 0, 60_000, 200_000, 210_000],
  ['44110000', 0, 90_000, 60_000, 75_000],
  ['44310000', 0, 110_000, 300_000, 340_000],
  ['44520000', 80_000, 0, 260_000, 230_000],
  ['47100000', 15_000, 0, 5_000, 0],
  ['48120000', 0, 0, 100_000, 250_000],
  ['49110000', 0, 45_000, 0, 10_000],
  ['50100000', 150_000, 0, 50_000, 0],
  ['52110000', 1_100_000, 0, 4_000_000, 3_700_000],
  ['52120000', 0, 200_000, 100_000, 350_000],
  ['56100000', 0, 0, 0, 80_000],
  ['57110000', 60_000, 0, 500_000, 480_000],
  ['60110000', 0, 0, 1_500_000, 20_000],
  ['60310000', 0, 0, 0, 150_000],
  ['60410000', 0, 0, 200_000, 0],
  ['62200000', 0, 0, 180_000, 0],
  ['63100000', 0, 0, 40_000, 0],
  ['64110000', 0, 0, 55_000, 0],
  ['65200000', 0, 0, 12_000, 0],
  ['65800000', 0, 0, 9_000, 0],
  ['66110000', 0, 0, 800_000, 0],
  ['67110000', 0, 0, 95_000, 0],
  ['68130000', 0, 0, 215_000, 0],
  ['69110000', 0, 0, 30_000, 0],
  ['70110000', 0, 0, 30_000, 3_200_000],
  ['70610000', 0, 0, 0, 450_000],
  ['71100000', 0, 0, 0, 100_000],
  ['75200000', 0, 0, 0, 7_000],
  ['75800000', 0, 0, 0, 14_000],
  ['77100000', 0, 0, 0, 25_000],
  ['78100000', 0, 0, 0, 18_000],
  ['79110000', 0, 0, 0, 22_000],
  ['81200000', 0, 0, 60_000, 0],
  ['82200000', 0, 0, 0, 90_000],
  ['83100000', 0, 0, 11_000, 0],
  ['84100000', 0, 0, 0, 13_000],
  ['85100000', 0, 0, 20_000, 0],
  ['86100000', 0, 0, 0, 16_000],
  ['89100000', 0, 0, 120_000, 0],
];

function lignesDe(facteur: number): Ligne[] {
  return COMPTES.map(([numero, rd, rc, md, mc]) =>
    ligne(numero, CLASSE[numero[0]], Math.round(md * facteur), Math.round(mc * facteur), {
      debit: Math.round(rd * facteur),
      credit: Math.round(rc * facteur),
    }),
  );
}

const EXERCICES = [
  { id: 'e0', dateDebut: new Date('2024-01-01T00:00:00Z'), dateFin: new Date('2024-12-31T00:00:00Z') },
  { id: 'e1', dateDebut: new Date('2025-01-01T00:00:00Z'), dateFin: new Date('2025-12-31T00:00:00Z') },
  { id: 'e2', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') },
];

function service(lignesParExercice: Record<string, Ligne[]> = { e0: lignesDe(0.8), e1: lignesDe(1), e2: lignesDe(1.37) }) {
  const ecritureService = {
    balance: jest.fn().mockImplementation((_t: string, exerciceId: string) => {
      const lignes = lignesParExercice[exerciceId] ?? [];
      return Promise.resolve({ lignes, totaux: { debit: 0, credit: 0 } });
    }),
    ouverturePasseeAuPremierJour: jest.fn().mockResolvedValue(null),
    positionDOuvertureAuPremierJour: jest.fn().mockResolvedValue({ etat: 'AUCUNE' }),
    nombreAuBrouillard: jest.fn().mockResolvedValue(0),
    mouvementsDeReevaluation: jest.fn().mockResolvedValue(new Map()),
    mouvementsDeTransfertGroupe: jest.fn().mockResolvedValue(new Map()),
    mouvementsDeRevisionPlan: jest.fn().mockResolvedValue(new Map()),
    positionsOuvertureEnOdParCompte: jest.fn().mockResolvedValue(new Map()),
  } as unknown as EcritureService;
  const exerciceService = {
    lister: jest.fn().mockResolvedValue([...EXERCICES].sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime())),
  } as unknown as ExerciceService;
  return new EtatsFinanciersSyscohadaService(ecritureService, exerciceService);
}

/** La propriété · le total refait le montant au centime, et une cellule vide ne prétend rien. */
function verifier(o: OrigineDuMontant, contexte: string) {
  if (o.montant === null) {
    expect({ contexte, nature: o.nature }).toEqual({ contexte, nature: 'HORS_BALANCE' });
    return;
  }
  if (o.nature === 'HORS_BALANCE') return;
  expect({ contexte, ecart: o.ecart }).toEqual({ contexte, ecart: 0 });
  expect({ contexte, total: Math.round((o.total as number) * 100) }).toEqual({ contexte, total: Math.round(o.montant * 100) });
  // Les sous-totaux refont le total · un groupe ne se perd pas en route.
  if (o.nature === 'COMPTES') {
    const somme = o.groupes.reduce((s, g) => s + g.comptes.reduce((t, c) => t + c.montant, 0), 0);
    expect(Math.round(somme * 100)).toBe(Math.round(o.montant * 100));
  }
}

describe("EtatsFinanciersSyscohadaService.origine · d'où vient ce chiffre", () => {
  const s = service();

  it('BILAN · tout poste, toute colonne, refait au centime (actif N, N-1, brut, amortissements ; passif N, N-1)', async () => {
    const bilan = await s.bilan('t', 'e2');
    let chiffres = 0;
    for (const l of bilan.actif) {
      for (const colonne of ['N', 'N1', 'BRUT', 'AMORTISSEMENT'] as ColonneOrigine[]) {
        const o = await s.origine('t', 'e2', 'bilan', l.ref, colonne);
        verifier(o, `${l.ref} ${colonne}`);
        if (o.montant && Math.abs(o.montant) > 0.005) chiffres++;
      }
      // La valeur rendue est celle de la cellule servie, et non une autre lecture.
      expect((await s.origine('t', 'e2', 'bilan', l.ref, 'N')).montant).toBe(l.montant);
      expect((await s.origine('t', 'e2', 'bilan', l.ref, 'N1')).montant).toBe(l.montantN1 ?? null);
    }
    for (const l of bilan.passif) {
      for (const colonne of ['N', 'N1'] as ColonneOrigine[]) {
        const o = await s.origine('t', 'e2', 'bilan', l.ref, colonne);
        verifier(o, `${l.ref} ${colonne}`);
        if (o.montant && Math.abs(o.montant) > 0.005) chiffres++;
      }
    }
    // Le jeu d'essai chiffre réellement l'état · un spec vert sur des zéros ne prouverait rien.
    expect(chiffres).toBeGreaterThan(60);
  });

  it('BILAN · un total se lit par ses postes, un poste par ses comptes, et le passif refuse la colonne Brut', async () => {
    const bz = await s.origine('t', 'e2', 'bilan', 'BZ', 'N');
    expect(bz.nature).toBe('FORMULE');
    expect(bz.composants.map((c) => c.ref)).toEqual(['AZ', 'BK', 'BT', 'BU']);
    const aj = await s.origine('t', 'e2', 'bilan', 'AJ', 'N');
    expect(aj.nature).toBe('COMPTES');
    expect(aj.exerciceDesComptesId).toBe('e2');
    expect((await s.origine('t', 'e2', 'bilan', 'AJ', 'N1')).exerciceDesComptesId).toBe('e1');
    await expect(s.origine('t', 'e2', 'bilan', 'CA', 'BRUT')).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.origine('t', 'e2', 'bilan', 'ZZ', 'N')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('BILAN · le découvert (52 créditeur) sort de BS et entre en DR, chacun le dit', async () => {
    const dr = await s.origine('t', 'e2', 'bilan', 'DR', 'N');
    expect(dr.groupes.flatMap((g) => g.comptes.map((c) => c.numero))).toContain('52120000');
    const bs = await s.origine('t', 'e2', 'bilan', 'BS', 'N');
    expect(bs.groupes.flatMap((g) => g.comptes.map((c) => c.numero))).not.toContain('52120000');
  });

  it('COMPTE DE RÉSULTAT · tout poste et tout solde, N et N-1, refait au centime', async () => {
    const cr = await s.compteDeResultat('t', 'e2');
    let chiffres = 0;
    for (const l of cr.lignes) {
      for (const colonne of ['N', 'N1'] as ColonneOrigine[]) {
        const o = await s.origine('t', 'e2', 'compte-de-resultat', l.ref, colonne);
        verifier(o, `${l.ref} ${colonne}`);
        if (o.montant && Math.abs(o.montant) > 0.005) chiffres++;
      }
    }
    expect(chiffres).toBeGreaterThan(40);
    const xi = await s.origine('t', 'e2', 'compte-de-resultat', 'XI', 'N');
    expect(xi.formule).toBe('XG + XH + RQ + RS');
    await expect(s.origine('t', 'e2', 'compte-de-resultat', 'TA', 'BRUT')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('TABLEAU DES FLUX · tout poste et tout total, N et N-1, refait au centime terme à terme', async () => {
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
    expect(chiffres).toBeGreaterThan(20);
    // FA part de l'EBE · le premier terme est le poste XD du compte de résultat, motif de la table repris.
    const fa = await s.origine('t', 'e2', 'tableau-flux-tresorerie', 'FA', 'N');
    expect(fa.groupes[0].titre).toBe('+ XD du compte de résultat');
    expect(fa.groupes[0].motif).toMatch(/EBE/);
  });

  it('RQP et TQP nuls, retirés de l’état servi · comptés dans XE, jamais offerts comme un poste à ouvrir', async () => {
    const sansQuotesParts = (f: number) => lignesDe(f).filter((l) => !l.numero.startsWith('652') && !l.numero.startsWith('752'));
    const s2 = service({ e0: sansQuotesParts(0.8), e1: sansQuotesParts(1), e2: sansQuotesParts(1.37) });
    const cr = await s2.compteDeResultat('t', 'e2');
    expect(cr.lignes.some((l) => l.ref === 'RQP')).toBe(false);
    const xe = await s2.origine('t', 'e2', 'compte-de-resultat', 'XE', 'N');
    const rqp = xe.composants.find((c) => c.ref === 'RQP')!;
    expect([rqp.montant, Boolean(rqp.nonOuvrable)]).toEqual([0, true]);
    expect(xe.composants.find((c) => c.ref === 'XD')!.nonOuvrable).toBeUndefined();
    expect(xe.ecart).toBe(0);
  });

  it("PREMIER EXERCICE · la colonne N-1 est vide et le dit, jamais des comptes à zéro", async () => {
    const seul = service({ e2: lignesDe(1) });
    // Le dossier ne connaît que e2 ici · la doublure liste toujours les trois, d'où un N-1 sans lignes.
    const o = await seul.origine('t', 'e0', 'compte-de-resultat', 'TA', 'N1');
    expect(o.montant).toBeNull();
    expect(o.nature).toBe('HORS_BALANCE');
    expect(o.source).toBeTruthy();
  });
});
