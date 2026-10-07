import { estEchue, imputerPaiements, motifRefusDeclaration, type DetteImputable, type LigneDeTiersLue } from './imputation-paiements';

/**
 * CODE CIVIL, LIVRE III, ART. 151 À 154 (décision par la loi du 2026-10-07,
 * point 4) · chaque cas est calculé à la main dans son titre.
 */
const jour = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dette = (id: string, facture: string, montant: number, echeance: string | null = null): DetteImputable => ({
  id,
  dateFacture: jour(facture),
  dateEcheance: echeance ? jour(echeance) : null,
  montant,
});
const parts = (r: ReturnType<typeof imputerPaiements>, id: string) =>
  (r.parDette.get(id) ?? []).map((p) => [p.date.toISOString().slice(0, 10), p.montant, p.fondement]);

describe('imputation des paiements · art. 154, l’ordre légal', () => {
  it('la plus ancienne d’abord · 580 000 (10 janvier) puis 1 160 000 (15 janvier), 1 000 000 versés · 580 000 et 420 000', () => {
    const r = imputerPaiements([dette('G', '2026-01-10', 580_000), dette('S', '2026-01-15', 1_160_000)], [
      { id: 'R', date: jour('2026-03-12'), montant: 1_000_000 },
    ]);
    expect(parts(r, 'G')).toEqual([['2026-03-12', 580_000, 'LEGALE']]);
    expect(parts(r, 'S')).toEqual([['2026-03-12', 420_000, 'LEGALE']]);
    expect(r.nonImpute).toEqual([]);
  });

  it('l’échue avant la non échue, même plus récente · F1 (1er mars, échéance 30 juin), F2 (1er avril, échue au 1er avril) · 500 000 le 15 mai vont à F2', () => {
    const r = imputerPaiements(
      [dette('F1', '2026-03-01', 1_000_000, '2026-06-30'), dette('F2', '2026-04-01', 400_000, '2026-04-01')],
      [{ id: 'R', date: jour('2026-05-15'), montant: 500_000 }],
    );
    expect(parts(r, 'F2')).toEqual([['2026-05-15', 400_000, 'LEGALE']]);
    expect(parts(r, 'F1')).toEqual([['2026-05-15', 100_000, 'LEGALE']]);
  });

  it('à date égale, au prorata, au centime, la somme vaut le paiement · 100 000 sur 1 160 000 et 580 000', () => {
    const r = imputerPaiements([dette('A', '2026-02-01', 1_160_000), dette('B', '2026-02-01', 580_000)], [
      { id: 'R', date: jour('2026-03-01'), montant: 100_000 },
    ]);
    // 100 000 × 1 160 000 / 1 740 000 = 66 666,67 ; 100 000 × 580 000 / 1 740 000 = 33 333,33.
    expect(parts(r, 'A')).toEqual([['2026-03-01', 66_666.67, 'LEGALE']]);
    expect(parts(r, 'B')).toEqual([['2026-03-01', 33_333.33, 'LEGALE']]);
  });

  it('un paiement ne va pas à une dette née après lui tant qu’une dette née avant reste ouverte · A payée le 10 février, B (5 mars) entrée ensuite', () => {
    const r = imputerPaiements([dette('A', '2026-01-15', 1_160_000), dette('B', '2026-03-05', 1_160_000)], [
      { id: 'RA', date: jour('2026-02-10'), montant: 1_160_000 },
    ]);
    expect(parts(r, 'A')).toEqual([['2026-02-10', 1_160_000, 'LEGALE']]);
    expect(parts(r, 'B')).toEqual([]);
  });

  it('une avance antérieure à toute dette s’impute sur la première qui naît, à la date de l’avance', () => {
    const r = imputerPaiements([dette('A', '2026-03-01', 500_000), dette('B', '2026-04-01', 500_000)], [
      { id: 'AV', date: jour('2026-02-15'), montant: 600_000 },
    ]);
    expect(parts(r, 'A')).toEqual([['2026-02-15', 500_000, 'LEGALE']]);
    expect(parts(r, 'B')).toEqual([['2026-02-15', 100_000, 'LEGALE']]);
  });

  it('paiements successifs, dans l’ordre de leurs dates · le second reprend où le premier s’arrête', () => {
    const r = imputerPaiements([dette('A', '2026-01-10', 600_000), dette('B', '2026-01-20', 600_000)], [
      { id: 'R2', date: jour('2026-03-01'), montant: 500_000 },
      { id: 'R1', date: jour('2026-02-01'), montant: 400_000 },
    ]);
    expect(parts(r, 'A')).toEqual([
      ['2026-02-01', 400_000, 'LEGALE'],
      ['2026-03-01', 200_000, 'LEGALE'],
    ]);
    expect(parts(r, 'B')).toEqual([['2026-03-01', 300_000, 'LEGALE']]);
  });

  it('un trop-perçu se dit, jamais imputé au-delà des dettes', () => {
    const r = imputerPaiements([dette('A', '2026-01-10', 100_000)], [{ id: 'R', date: jour('2026-02-01'), montant: 150_000 }]);
    expect(parts(r, 'A')).toEqual([['2026-02-01', 100_000, 'LEGALE']]);
    expect(r.nonImpute).toEqual([{ paiementId: 'R', montant: 50_000 }]);
  });

  it('une dette sans échéance est échue dès sa facture', () => {
    expect(estEchue(dette('A', '2026-01-10', 1), jour('2026-01-10'))).toBe(true);
    expect(estEchue(dette('A', '2026-01-10', 1, '2026-02-10'), jour('2026-01-31'))).toBe(false);
  });
});

describe('imputation des paiements · art. 151 et 153, la déclaration prime', () => {
  it('le client désigne la plus récente · elle reçoit ce qu’il déclare, le reste suit l’art. 154', () => {
    const r = imputerPaiements(
      [dette('A', '2026-01-10', 600_000), dette('B', '2026-01-20', 600_000)],
      [{ id: 'R', date: jour('2026-03-01'), montant: 700_000 }],
      [{ paiementId: 'R', detteId: 'B', montant: 600_000 }],
    );
    expect(parts(r, 'B')).toEqual([['2026-03-01', 600_000, 'DECLAREE']]);
    expect(parts(r, 'A')).toEqual([['2026-03-01', 100_000, 'LEGALE']]);
  });

  it('une déclaration au-delà du reste de la dette est ramenée, et dite', () => {
    const r = imputerPaiements(
      [dette('A', '2026-01-10', 600_000), dette('B', '2026-01-20', 300_000)],
      [{ id: 'R', date: jour('2026-03-01'), montant: 500_000 }],
      [{ paiementId: 'R', detteId: 'B', montant: 450_000 }],
    );
    expect(parts(r, 'B')).toEqual([['2026-03-01', 300_000, 'DECLAREE']]);
    expect(parts(r, 'A')).toEqual([['2026-03-01', 200_000, 'LEGALE']]);
    expect(r.declareesRamenees).toEqual([{ paiementId: 'R', detteId: 'B', declare: 450_000, retenu: 300_000 }]);
  });

  it('une déclaration sur une facture sortie du groupe ne reçoit rien · elle est dite non retenue, le paiement suit l’art. 154', () => {
    const r = imputerPaiements(
      [dette('A', '2026-01-10', 600_000)],
      [{ id: 'R', date: jour('2026-03-01'), montant: 200_000 }],
      [{ paiementId: 'R', detteId: 'PARTIE', montant: 200_000 }],
    );
    expect(parts(r, 'A')).toEqual([['2026-03-01', 200_000, 'LEGALE']]);
    expect(r.declareesRamenees).toEqual([{ paiementId: 'R', detteId: 'PARTIE', declare: 200_000, retenu: 0 }]);
  });
});

/**
 * LA DÉCLARATION SE REFUSE PAR UN MOTIF NOMMÉ · paiement R de 700 000 au
 * crédit du client 41110101, factures A (600 000) et B (600 000) au débit,
 * toutes trois validées et lettrées dans le groupe G.
 */
describe('déclarer une imputation · les refus', () => {
  const ligne = (id: string, sens: number, autre: Partial<LigneDeTiersLue> = {}): LigneDeTiersLue => ({
    id,
    compteId: 'c411',
    numero: '41110101',
    sens,
    validee: true,
    lettrageId: 'G',
    ...autre,
  });
  const R = ligne('R', -700_000, { date: new Date('2026-02-15') });
  const A = ligne('A', 600_000);
  const B = ligne('B', 600_000);
  const demande = (
    factures: Array<{ ligne: LigneDeTiersLue | null; montant: number; dejaDeclare?: number }>,
    reglement: LigneDeTiersLue | null = R,
    autre: {
      dejaActive?: boolean;
      pieceReference?: string;
      fondement?: 'DECLARATION_DU_DEBITEUR' | 'QUITTANCE_ACCEPTEE';
      pieceDate?: Date | null;
      preuveAcceptation?: string;
      consommePar?: string[];
    } = {},
  ) =>
    motifRefusDeclaration({
      reglement,
      factures: factures.map((f, i) => ({
        ligne: f.ligne,
        idDemande: f.ligne?.id ?? `x${i}`,
        montant: f.montant,
        dejaDeclare: f.dejaDeclare ?? 0,
        consommePar: autre.consommePar,
      })),
      dejaActive: autre.dejaActive ?? false,
      pieceReference: autre.pieceReference ?? 'OV 2026-031',
      fondement: autre.fondement ?? 'DECLARATION_DU_DEBITEUR',
      pieceDate: autre.pieceDate === undefined ? new Date('2026-02-15') : autre.pieceDate,
      preuveAcceptation: autre.preuveAcceptation,
    });

  it('une déclaration juste passe · 600 000 sur B, 100 000 sur A', () => {
    expect(demande([{ ligne: B, montant: 600_000 }, { ligne: A, montant: 100_000 }])).toBeNull();
  });

  it('le paiement introuvable, au brouillard, hors d’un compte 40 ou 41, ou dans le sens d’une facture', () => {
    expect(demande([{ ligne: A, montant: 1 }], null)).toContain('introuvable');
    expect(demande([{ ligne: A, montant: 1 }], { ...R, validee: false })).toContain('brouillard');
    expect(demande([{ ligne: A, montant: 1 }], { ...R, numero: '44320000' })).toContain('ni un compte client (41) ni un compte fournisseur (40)');
    expect(demande([{ ligne: A, montant: 1 }], { ...R, sens: 700_000 })).toContain('le sens d’une facture');
    // Au fournisseur, le paiement est au DÉBIT.
    expect(demande([{ ligne: { ...A, numero: '40110101', sens: -600_000 }, montant: 1 }], { ...R, numero: '40110101', sens: 700_000 })).toBeNull();
    expect(demande([{ ligne: A, montant: 1 }], { ...R, numero: '40110101' })).toContain('le sens d’une facture');
  });

  it('un paiement non lettré, ou déjà déclaré, ou sans pièce', () => {
    expect(demande([{ ligne: A, montant: 1 }], { ...R, lettrageId: null })).toContain('Lettrez-les d’abord');
    expect(demande([{ ligne: A, montant: 1 }], R, { dejaActive: true })).toContain('retirez-la');
    expect(demande([{ ligne: A, montant: 1 }], R, { pieceReference: '  ' })).toContain('La pièce est exigée');
  });

  it('une facture d’un autre compte, au brouillard, du sens du paiement, hors du groupe, ou deux fois', () => {
    expect(demande([{ ligne: { ...A, compteId: 'c412', numero: '41120000' }, montant: 1 }])).toContain('un paiement ne paie que les dettes de son tiers');
    expect(demande([{ ligne: { ...A, validee: false }, montant: 1 }])).toContain('au brouillard');
    expect(demande([{ ligne: { ...A, sens: -1 }, montant: 1 }])).toContain('dans le sens du paiement');
    expect(demande([{ ligne: { ...A, lettrageId: 'H' }, montant: 1 }])).toContain('pas dans le groupe de lettrage du paiement');
    expect(demande([{ ligne: A, montant: 1 }, { ligne: A, montant: 1 }])).toContain('deux fois');
    expect(demande([{ ligne: R, montant: 1 }])).toContain('sur lui-même');
  });

  it('une part au-delà du reste de la facture (déclarations d’autres paiements déduites), ou un total au-delà du paiement', () => {
    expect(demande([{ ligne: A, montant: 600_000.01 }])).toContain('dépasse ce qui reste de la facture (600000.00)');
    expect(demande([{ ligne: A, montant: 500_000, dejaDeclare: 200_000 }], R, { consommePar: ['pièce BQ12 du 10/02/2026'] })).toContain(
      'après 200000.00 déjà imputés ou déclarés sur d’autres paiements (pièce BQ12 du 10/02/2026)',
    );
    expect(demande([{ ligne: A, montant: 600_000 }, { ligne: B, montant: 100_001 }])).toContain('dépassent le paiement (700000.00)');
  });

  it('M3 · la pièce est datée ; la déclaration du débiteur ne suit pas le paiement ; la quittance acceptée a sa preuve', () => {
    expect(demande([{ ligne: A, montant: 1 }], R, { pieceDate: null })).toContain('La date de la pièce est exigée');
    // Art. 151 · « lorsqu'il paye » · le jour même passe, le lendemain non.
    expect(demande([{ ligne: A, montant: 1 }], R, { pieceDate: new Date('2026-02-15') })).toBeNull();
    expect(demande([{ ligne: A, montant: 1 }], R, { pieceDate: new Date('2026-02-16') })).toContain(
      'La pièce du 16/02/2026 est postérieure au paiement du 15/02/2026',
    );
    // Art. 153 · une quittance postérieure passe avec sa preuve d'acceptation.
    const q = { fondement: 'QUITTANCE_ACCEPTEE' as const, pieceDate: new Date('2026-02-20') };
    expect(demande([{ ligne: A, montant: 1 }], R, q)).toContain('La preuve de l’acceptation est exigée');
    expect(demande([{ ligne: A, montant: 1 }], R, { ...q, preuveAcceptation: 'Contreseing du client, lettre du 22/02' })).toBeNull();
    expect(demande([{ ligne: A, montant: 1 }], R, { ...q, pieceDate: new Date('2026-02-14'), preuveAcceptation: 'Contreseing' })).toContain(
      'antérieure au paiement',
    );
  });
});
