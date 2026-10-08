import { ClasseCompte, TypeJournal } from '@prisma/client';
import { filtreOuverturePasseeAuPremierJour, lignesDeContrePassationDeclaree } from './ouverture-passee';

/**
 * LE PÉRIMÈTRE DE L'OUVERTURE PASSÉE AU PREMIER JOUR, ÉVALUÉ (paquet 1, A8).
 *
 * Reproduit sur vraie base le 2026-10-08 · une réévaluation des devises de N
 * contre-passée par le module au 01/01 de N+1, N encore ouvert (A5 ter), était
 * lue par la clôture de N comme une ouverture DIVERGENTE ; la seule issue,
 * « Rectifier », l'inscrivait en négatif · client à 2 900 000 au lieu de
 * 2 800 000 en N+1, 479 à -100 000 au lieu de zéro, balance bouclée.
 *
 * Le filtre est écrit une fois et lu par quatre lecteurs (clôture et aperçu
 * AU2, états sans exercice précédent, 585 du groupe, candidates de la
 * reconduction du lettrage). Ce spec ÉVALUE la requête sur des écritures en
 * mémoire, avec un évaluateur qui honore chaque opérateur qu'elle pose et lève
 * sur tout autre · ce qui dépend de ce qu'une requête ramène se teste sur la
 * requête (CLAUDE.md, F4b).
 */
type Rangee = Record<string, unknown>;

function champ(v: unknown, f: unknown): boolean {
  if (f === null || typeof f !== 'object' || f instanceof Date) {
    return f instanceof Date ? v instanceof Date && v.getTime() === f.getTime() : (v ?? null) === f;
  }
  return Object.entries(f as Rangee).every(([op, x]) => {
    if (op === 'in') return (x as unknown[]).includes(v);
    throw new Error(`évaluateur : opérateur « ${op} » non honoré`);
  });
}

/** Une relation à un (`is`, `isNot`) · absente, elle vaut `null`. */
function relation(x: Rangee | null | undefined, f: Rangee): boolean {
  if ('is' in f) return f.is === null ? !x : !!x && evaluer(x, f.is);
  if ('isNot' in f) return f.isNot === null ? !!x : !x || !evaluer(x, f.isNot);
  return !!x && evaluer(x, f);
}

function evaluer(r: Rangee, where: unknown): boolean {
  return Object.entries((where ?? {}) as Rangee).every(([cle, f]) => {
    if (cle === 'AND') return (f as unknown[]).every((w) => evaluer(r, w));
    if (cle === 'OR') return (f as unknown[]).some((w) => evaluer(r, w));
    if (cle === 'journal' || cle === 'corrigeEcriture' || cle === 'reevaluationExtourne' || cle === 'compte') {
      return relation(r[cle] as Rangee | null | undefined, f as Rangee);
    }
    if (cle === 'lignes') {
      const { none, ...reste } = f as { none?: unknown };
      if (Object.keys(reste).length > 0 || none === undefined) throw new Error('évaluateur : filtre de lignes non honoré');
      return !((r.lignes as Rangee[] | undefined) ?? []).some((l) => evaluer(l, none));
    }
    if (cle === 'classe') return champ(r.classe, f);
    return champ(r[cle], f);
  });
}

const N1 = { id: 'n1', dateDebut: new Date('2027-01-01') };
const filtre = filtreOuverturePasseeAuPremierJour('t', N1);
const OD = { type: TypeJournal.GENERAL };
const BQ = { type: TypeJournal.TRESORERIE };
const bilan = (numero: string) => ({ compte: { classe: ClasseCompte.CLASSE_4, numero } });
const ecriture = (x: Rangee): Rangee => ({
  tenantId: 't',
  exerciceId: 'n1',
  date: N1.dateDebut,
  dateValeur: null,
  estANouveauProvisoire: false,
  estSoldeDesComptesDeGestion: false,
  estGenereeParCloture: false,
  journal: OD,
  corrigeEcriture: null,
  corrigeEcritureId: null,
  reevaluationExtourne: null,
  lignes: [bilan('41110001'), bilan('47910000')],
  ...x,
});

describe('A8 · la contre-passation d’une réévaluation n’est pas une ouverture', () => {
  it('une ouverture saisie en OD au premier jour reste dans le périmètre (AU2 inchangé)', () => {
    expect(evaluer(ecriture({}), filtre)).toBe(true);
  });

  it('la contre-passation du MODULE, reconnue par sa liaison, en sort', () => {
    expect(evaluer(ecriture({ reevaluationExtourne: { id: 'r26' } }), filtre)).toBe(false);
  });

  it('le négatif de cette contre-passation (annulation de la réévaluation, D6, liaison gardée) en sort avec elle', () => {
    const extourne = { journal: OD, estGenereeParCloture: false, reevaluationExtourne: { id: 'r26' } };
    expect(evaluer(ecriture({ corrigeEcritureId: 'x', corrigeEcriture: extourne }), filtre)).toBe(false);
  });

  it('une contre-passation ANNULÉE seule (déliée) et son négatif restent, et se soldent', () => {
    const extourneDeliee = { journal: OD, estGenereeParCloture: false, reevaluationExtourne: null };
    expect(evaluer(ecriture({}), filtre)).toBe(true);
    expect(evaluer(ecriture({ corrigeEcritureId: 'x', corrigeEcriture: extourneDeliee }), filtre)).toBe(true);
  });

  it('les autres bornes tiennent · journal de trésorerie, compte de gestion, provisoire, lendemain', () => {
    expect(evaluer(ecriture({ journal: BQ }), filtre)).toBe(false);
    expect(evaluer(ecriture({ lignes: [bilan('41110001'), { compte: { classe: ClasseCompte.CLASSE_7, numero: '77610000' } }] }), filtre)).toBe(false);
    expect(evaluer(ecriture({ estANouveauProvisoire: true }), filtre)).toBe(false);
    expect(evaluer(ecriture({ date: new Date('2027-01-02') }), filtre)).toBe(false);
    expect(evaluer(ecriture({ date: new Date('2027-01-02'), dateValeur: N1.dateDebut }), filtre)).toBe(true);
  });

  it('l’exclusion est DANS le AND · le lecteur qui ne reprend que `AND` et `lignes` (reconduction du lettrage) l’a aussi', () => {
    const { AND, lignes } = filtre as { AND: unknown; lignes: unknown };
    expect(evaluer(ecriture({ reevaluationExtourne: { id: 'r26' } }), { AND, lignes })).toBe(false);
    expect(evaluer(ecriture({}), { AND, lignes })).toBe(true);
  });
});

describe('A8 · la contre-passation faite à la main et DÉCLARÉE · ses seules lignes de l’écart', () => {
  // L'écriture des écarts de la réévaluation de N · client +100 000 (gain
  // latent, 479), fournisseur +50 000 (perte latente, 478), banque +30 000
  // (réalisé, 776, jamais contre-passé · AUDCIF art. 57).
  const ecarts = {
    lignes: [
      { compteId: 'c411', debit: 100_000, credit: 0, compte: { numero: '41110001' } },
      { compteId: 'c4791', debit: 0, credit: 100_000, compte: { numero: '47910000' } },
      { compteId: 'c4783', debit: 50_000, credit: 0, compte: { numero: '47830000' } },
      { compteId: 'c401', debit: 0, credit: 50_000, compte: { numero: '40110001' } },
      { compteId: 'c521', debit: 30_000, credit: 0, compte: { numero: '52110000' } },
      { compteId: 'c776', debit: 0, credit: 30_000, compte: { numero: '77610000' } },
    ],
  };

  it('écarte, par écriture, les comptes de l’écart de conversion (tiers, 478, 479), jamais la banque', () => {
    const r = lignesDeContrePassationDeclaree([{ id: 'od', reevaluationContrePassationDeclaree: { annuleeLe: null, ecritureEcarts: ecarts } }]);
    expect([...(r.get('od') ?? [])].sort()).toEqual(['c401', 'c411', 'c4783', 'c4791']);
  });

  it('une écriture sans déclaration, ou déclarée pour une réévaluation ANNULÉE, n’écarte rien', () => {
    expect(lignesDeContrePassationDeclaree([{ id: 'od' }, { id: 'od2', reevaluationContrePassationDeclaree: null }]).size).toBe(0);
    expect(
      lignesDeContrePassationDeclaree([{ id: 'od', reevaluationContrePassationDeclaree: { annuleeLe: new Date('2027-02-01'), ecritureEcarts: ecarts } }]).size,
    ).toBe(0);
  });
});
