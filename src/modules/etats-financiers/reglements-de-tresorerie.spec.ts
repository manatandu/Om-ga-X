import {
  MOTIF_A_NOUVEAU_SANS_FACTURE,
  MOTIF_GROUPE_A_PLUSIEURS_FACTURES,
  MOTIF_PART_HORS_RESULTAT,
  MOTIF_REGLEMENT_NON_LETTRE,
  depensesRattachees,
  estDetteFournisseurRattachee,
  naturesDesReglementsFournisseurs,
} from './reglements-de-tresorerie';

/**
 * CONSTATS N3 ET N4 DES CAS CHIFFRÉS DE LA CLÔTURE (2026-10-07) · le
 * règlement d'une dette fournisseur prend la ligne de la facture qu'il règle,
 * lue par son lettrage, la facture d'un exercice précédent retrouvée par sa
 * ligne d'à-nouveau. Rien n'est deviné · non lettré, groupe à plusieurs
 * factures, à-nouveau sans facture unique restent nommés.
 *
 * LA DOUBLURE HONORE LES QUATRE LECTURES du module (par identifiant, par
 * groupe, par écriture, et l'appariement de l'à-nouveau) et tombe sur toute
 * autre forme · une doublure qui rendrait tout validerait un code faux.
 */

type Ecr = {
  id: string;
  tenantId: string;
  date: Date;
  libelle: string;
  estANouveauProvisoire: boolean;
  estGenereeParCloture: boolean;
  estSoldeDesComptesDeGestion: boolean;
};
type Lgn = {
  id: string;
  ecritureId: string;
  lettrageId: string | null;
  compteId: string;
  numero: string;
  intitule: string;
  debit: number;
  credit: number;
  libelle: string | null;
  dateEcheance: Date | null;
};

function base(ecritures: Ecr[], lignes: Lgn[]) {
  const ecr = new Map(ecritures.map((e) => [e.id, e]));
  const projeter = (l: Lgn) => ({
    id: l.id,
    lettrageId: l.lettrageId,
    compteId: l.compteId,
    ecritureId: l.ecritureId,
    debit: l.debit,
    credit: l.credit,
    libelle: l.libelle,
    dateEcheance: l.dateEcheance,
    compte: { numero: l.numero, intitule: l.intitule },
    ecriture: ecr.get(l.ecritureId)!,
  });
  const findMany = jest.fn(async ({ where }: { where: Record<string, any> }) => {
    const cles = Object.keys(where).sort().join(',');
    const duDossier = (l: Lgn) => ecr.get(l.ecritureId)!.tenantId === where.ecriture.tenantId;
    if (cles === 'ecriture,id') return lignes.filter((l) => where.id.in.includes(l.id) && duDossier(l)).map(projeter);
    if (cles === 'ecriture,lettrageId') return lignes.filter((l) => l.lettrageId && where.lettrageId.in.includes(l.lettrageId) && duDossier(l)).map(projeter);
    if (cles === 'ecriture,ecritureId') return lignes.filter((l) => where.ecritureId.in.includes(l.ecritureId) && duDossier(l)).map(projeter);
    if (cles === 'compteId,credit,dateEcheance,debit,ecriture') {
      return lignes
        .filter(
          (l) =>
            l.compteId === where.compteId &&
            l.debit === where.debit &&
            l.credit === where.credit &&
            (l.dateEcheance?.getTime() ?? null) === (where.dateEcheance?.getTime() ?? null) &&
            duDossier(l) &&
            ecr.get(l.ecritureId)!.date < where.ecriture.date.lt,
        )
        .map(projeter);
    }
    throw new Error(`doublure : lecture non honorée (${cles})`);
  });
  return { ligneEcriture: { findMany } };
}

const ecriture = (id: string, date: string, libelle: string, x: Partial<Ecr> = {}): Ecr => ({
  id,
  tenantId: 't',
  date: new Date(date),
  libelle,
  estANouveauProvisoire: false,
  estGenereeParCloture: false,
  estSoldeDesComptesDeGestion: false,
  ...x,
});
const ligne = (id: string, ecritureId: string, numero: string, debit: number, credit: number, x: Partial<Lgn> = {}): Lgn => ({
  id,
  ecritureId,
  lettrageId: null,
  compteId: `c-${numero}`,
  numero,
  intitule: `Compte ${numero}`,
  debit,
  credit,
  libelle: null,
  dateEcheance: null,
  ...x,
});

describe('Le règlement d’une dette fournisseur prend la ligne de sa facture (N3, N4)', () => {
  it('ne rattache que les dettes d’exploitation · ni 404, ni 408, ni 409, ni 481', () => {
    expect(['40110000', '40210000', '40410000', '40810000', '40910000', '48120000'].map(estDetteFournisseurRattachee)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it('facture de l’exercice lettrée avec son règlement · la part de chaque compte de la facture', async () => {
    const db = base(
      [ecriture('f', '2027-02-01', 'Facture'), ecriture('r', '2027-03-01', 'Règlement')],
      [
        ligne('f1', 'f', '60110000', 1000, 0),
        ligne('f2', 'f', '44520000', 160, 0),
        ligne('f3', 'f', '40110000', 0, 1160, { lettrageId: 'g' }),
        ligne('r1', 'r', '40110000', 580, 0, { lettrageId: 'g' }),
        ligne('r2', 'r', '52110000', 0, 580),
      ],
    );
    const n = await naturesDesReglementsFournisseurs(db, 't', [{ ligneId: 'r1', numero: '40110000', montant: 580 }]);
    // La part de la taxe n'entre pas au résultat · elle reste au 40, nommée
    // (majeur 3 de la relecture du 2026-10-07).
    expect(n.nonRattaches).toEqual([{ numero: '40110000', montant: 80, motif: MOTIF_PART_HORS_RESULTAT }]);
    expect(n.parLigne.get('r1')).toEqual([{ numero: '60110000', intitule: 'Compte 60110000', montant: 500 }]);
  });

  it('facture d’immobilisation (D 2441 / C 401) · le règlement suit le 2441, flux hors exploitation, rien de nommé', async () => {
    // Relecture du 2026-10-07, majeur 3 et sa suite · le règlement va au
    // compte de l'immobilisation, comme celui d'un 481, et la dette du 401
    // qui en est née sort de VC par la même règle
    // (`dettesFournisseursNeesDImmobilisations`).
    const db = base(
      [ecriture('f', '2027-02-01', 'Mobilier'), ecriture('r', '2027-03-01', 'Règlement du mobilier')],
      [
        ligne('f1', 'f', '24410000', 600_000, 0),
        ligne('f9', 'f', '40110000', 0, 600_000, { lettrageId: 'g' }),
        ligne('r1', 'r', '40110000', 600_000, 0, { lettrageId: 'g' }),
        ligne('r2', 'r', '52110000', 0, 600_000),
      ],
    );
    const reglements = [{ ligneId: 'r1', numero: '40110000', montant: 600_000 }];
    const n = await naturesDesReglementsFournisseurs(db, 't', reglements);
    expect(n.nonRattaches).toEqual([]);
    expect(n.parLigne.get('r1')).toEqual([{ numero: '24410000', intitule: 'Compte 24410000', montant: 600_000 }]);
    const depenses = new Map([['40110000', { numero: '40110000', intitule: 'Fournisseurs', montant: 600_000 }]]);
    const r = depensesRattachees(depenses, reglements, n);
    expect([r.get('40110000')!.montant, r.get('24410000')!.montant]).toEqual([0, 600_000]);
  });

  it('dette de N réglée en N+1 · retrouvée par sa ligne d’à-nouveau, une seule candidate', async () => {
    // Cas C11 · achats de 200 000 dus au 31 décembre 2026, réglés en 2027.
    const db = base(
      [
        ecriture('f', '2026-11-30', 'Achats de biens liés à l’activité'),
        ecriture('an', '2027-01-01', 'Report', { estGenereeParCloture: true }),
        ecriture('r', '2027-01-20', 'Règlement'),
      ],
      [
        ligne('f1', 'f', '60110000', 200_000, 0),
        ligne('f2', 'f', '40110000', 0, 200_000),
        ligne('an1', 'an', '40110000', 0, 200_000, {
          lettrageId: 'g',
          libelle: 'RAN détail 40110000 · Achats de biens liés à l’activité',
        }),
        ligne('r1', 'r', '40110000', 200_000, 0, { lettrageId: 'g' }),
        ligne('r2', 'r', '57100000', 0, 200_000),
      ],
    );
    const n = await naturesDesReglementsFournisseurs(db, 't', [{ ligneId: 'r1', numero: '40110000', montant: 200_000 }]);
    expect(n.parLigne.get('r1')).toEqual([{ numero: '60110000', intitule: 'Compte 60110000', montant: 200_000 }]);
  });

  it('nomme sans deviner · non lettré, groupe à plusieurs factures, à-nouveau à deux candidates', async () => {
    const db = base(
      [
        ecriture('f', '2026-11-30', 'Achat'),
        ecriture('f2', '2026-11-30', 'Achat'),
        ecriture('an', '2027-01-01', 'Report', { estGenereeParCloture: true }),
        ecriture('r', '2027-01-20', 'Règlement'),
        ecriture('h', '2027-02-01', 'Facture H'),
        ecriture('k', '2027-02-02', 'Facture K'),
      ],
      [
        // Deux factures identiques de 2026 · l'à-nouveau ne désigne aucune des deux.
        ligne('f1', 'f', '60110000', 100, 0),
        ligne('f9', 'f', '40110000', 0, 100),
        ligne('g1', 'f2', '61810000', 100, 0),
        ligne('g9', 'f2', '40110000', 0, 100),
        ligne('an1', 'an', '40110000', 0, 100, { lettrageId: 'ga', libelle: 'RAN détail 40110000 · Achat' }),
        ligne('ra', 'r', '40110000', 100, 0, { lettrageId: 'ga' }),
        // Deux factures dans le même groupe.
        ligne('h1', 'h', '60110000', 50, 0),
        ligne('h9', 'h', '40110000', 0, 50, { lettrageId: 'gb' }),
        ligne('k1', 'k', '62220000', 50, 0),
        ligne('k9', 'k', '40110000', 0, 50, { lettrageId: 'gb' }),
        ligne('rb', 'r', '40110000', 100, 0, { lettrageId: 'gb' }),
        // Non lettré.
        ligne('rc', 'r', '40110000', 30, 0),
        ligne('rt', 'r', '52110000', 0, 230),
      ],
    );
    const n = await naturesDesReglementsFournisseurs(db, 't', [
      { ligneId: 'ra', numero: '40110000', montant: 100 },
      { ligneId: 'rb', numero: '40110000', montant: 100 },
      { ligneId: 'rc', numero: '40110000', montant: 30 },
    ]);
    expect(n.parLigne.size).toBe(0);
    expect(n.nonRattaches.map((x) => [x.montant, x.motif])).toEqual([
      [100, MOTIF_A_NOUVEAU_SANS_FACTURE],
      [100, MOTIF_GROUPE_A_PLUSIEURS_FACTURES],
      [30, MOTIF_REGLEMENT_NON_LETTRE],
    ]);
  });

  it('déplace la part rattachée du 40 vers les comptes de la facture, sans changer le total', () => {
    const depenses = new Map([
      ['40110000', { numero: '40110000', intitule: 'Fournisseurs', montant: 300 }],
      ['60110000', { numero: '60110000', intitule: 'Achats', montant: 1000 }],
    ]);
    const r = depensesRattachees(
      depenses,
      [
        { ligneId: 'r1', numero: '40110000', montant: 200 },
        { ligneId: 'r2', numero: '40110000', montant: 100 },
      ],
      { parLigne: new Map([['r1', [{ numero: '60110000', intitule: 'Achats', montant: 200 }]]]), nonRattaches: [] },
    );
    expect(r.get('40110000')!.montant).toBe(100);
    expect(r.get('60110000')!.montant).toBe(1200);
    expect([...r.values()].reduce((s, c) => s + c.montant, 0)).toBe(1300);
    // Une part hors résultat reste au 40 · seule la part rattachée en sort.
    const partiel = depensesRattachees(
      new Map([['40110000', { numero: '40110000', intitule: 'Fournisseurs', montant: 580 }]]),
      [{ ligneId: 'r1', numero: '40110000', montant: 580 }],
      { parLigne: new Map([['r1', [{ numero: '60110000', intitule: 'Achats', montant: 500 }]]]), nonRattaches: [] },
    );
    expect([partiel.get('40110000')!.montant, partiel.get('60110000')!.montant]).toEqual([80, 500]);
    // L'original n'est pas touché.
    expect(depenses.get('40110000')!.montant).toBe(300);
  });
});
