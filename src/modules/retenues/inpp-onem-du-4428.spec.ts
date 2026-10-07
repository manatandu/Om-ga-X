import { RetenuesService } from './retenues.service';
import { PrismaService } from '../../common/prisma.service';
import { partagerLe4428, RACINES_CHARGE_INPP_ONEM } from './inpp-onem-du-4428';
import { NOMENCLATURE_PAIE } from '../personnel/passation-paie';

/**
 * RELECTURE M1 (2026-10-07) · LA NATURE `inppOnem` NE LIT DU 4428 QUE CE QUI
 * EST VRAIMENT DE L'INPP OU DE L'ONEM, par la structure de l'écriture · paie
 * du mois (un bulletin la porte), charge 6413 / 6415 dans la même écriture,
 * lettrage avec une telle ligne. Toute autre taxe du 4428 était annoncée comme
 * INPP ou ONEM dû le 15, et pouvait sortir « en retard » · un contrôle qui
 * fabrique une anomalie (CLAUDE.md, § 10 bis).
 */

type Structure = { paie?: boolean; charge?: boolean; lettrage?: string };
function ligne(numero: string, date: string, montant: { debit?: number; credit?: number }, s: Structure = {}) {
  return {
    debit: montant.debit ?? 0,
    credit: montant.credit ?? 0,
    dateVersement: null,
    lettrageId: s.lettrage ?? null,
    compte: { numero, intitule: `Compte ${numero}` },
    ecriture: {
      date: new Date(date),
      libelle: 'Écriture',
      reference: null,
      estGenereeParCloture: false,
      estSoldeDesComptesDeGestion: false,
      bulletinsPaie: s.paie ? [{ id: 'b1' }] : [],
      bulletinsPaieRepris: [],
      lignes: s.charge ? [{ id: 'l6415' }] : [],
    },
  };
}

function service(lignes: ReturnType<typeof ligne>[]) {
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
    ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
    exercice: { findFirst: jest.fn().mockResolvedValue(null) },
    mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  return new RetenuesService(prisma);
}

type NatureLue = {
  cle: string;
  retenu: number;
  reverse: number;
  solde: number;
  moisEnRetard: number;
  mention4428: string | null;
  retardIndetermine: boolean;
};
const inppOnem = (r: { natures: Array<{ cle: string }> }) => r.natures.find((n) => n.cle === 'inppOnem') as unknown as NatureLue;

describe('M1 · le 4428 se partage par sa structure, jamais par son numéro', () => {
  it('les charges qui rattachent sont celles que la passation de la paie donne à l’INPP et à l’ONEM', () => {
    // Le critère et la passation ne divergent pas · 6415 l'INPP, 6413 l'ONEM,
    // aux deux plans.
    for (const role of ['FORMATION_PROFESSIONNELLE_CONTINUE', 'TAXES_SUR_SALAIRES'] as const) {
      for (const c of [NOMENCLATURE_PAIE[role].SYSCOHADA, NOMENCLATURE_PAIE[role].SYCEBNL]) {
        expect(RACINES_CHARGE_INPP_ONEM.some((r) => c.startsWith(r))).toBe(true);
      }
    }
  });

  it('une taxe étrangère au 4428 n’apparaît pas dans l’INPP et l’ONEM, ni en retard · elle est nommée', async () => {
    // Juin · INPP et ONEM de la paie, 37 000. Mars · une autre taxe, 50 000,
    // jamais reversée · avant la relecture, « INPP ou ONEM dû le 15 avril »,
    // en retard au 30 juin.
    const r = await service([
      ligne('44280000', '2026-06-30', { credit: 37_000 }, { paie: true }),
      ligne('44280000', '2026-03-10', { credit: 50_000 }),
    ]).registre('t1', { exerciceId: 'e1', dateReference: '2026-06-30' });
    const n = inppOnem(r);
    expect(n.retenu).toBe(37_000);
    expect(n.moisEnRetard).toBe(0);
    expect(n.mention4428).toContain('50000.00 FC crédités cet exercice ne viennent ni de la paie');
    expect(r.avertissements).toContain(n.mention4428);
  });

  it('la charge 6415 ou 6413 dans la même écriture rattache aussi · une saisie manuelle de l’INPP compte', async () => {
    const r = await service([
      ligne('44280000', '2026-02-27', { credit: 12_000 }, { charge: true }),
      ligne('44280000', '2026-02-27', { credit: 8_000 }),
    ]).registre('t1', { exerciceId: 'e1', dateReference: '2026-06-30' });
    const n = inppOnem(r);
    expect(n.retenu).toBe(12_000);
    // Février non reversé, échu le 15 mars · c'est un vrai retard, aucun
    // reversement non rattaché ne le met en doute.
    expect(n.moisEnRetard).toBe(1);
    expect(n.retardIndetermine).toBe(false);
  });

  it('un reversement lettré avec la dette de la paie l’éteint ; un reversement non rattaché suspend l’affirmation du retard', async () => {
    const lettre = await service([
      ligne('44280000', '2026-02-27', { credit: 12_000 }, { paie: true, lettrage: 'g1' }),
      ligne('44280000', '2026-03-14', { debit: 12_000 }, { lettrage: 'g1' }),
      ligne('44280000', '2026-02-27', { credit: 8_000 }),
    ]).registre('t1', { exerciceId: 'e1', dateReference: '2026-06-30' });
    expect(inppOnem(lettre).reverse).toBe(12_000);
    expect(inppOnem(lettre).solde).toBe(0);
    expect(inppOnem(lettre).moisEnRetard).toBe(0);

    const nonRattache = await service([
      ligne('44280000', '2026-02-27', { credit: 12_000 }, { paie: true }),
      ligne('44280000', '2026-03-14', { debit: 8_000 }),
      ligne('44280000', '2026-02-27', { credit: 8_000 }),
    ]).registre('t1', { exerciceId: 'e1', dateReference: '2026-06-30' });
    const n = inppOnem(nonRattache);
    expect(n.retenu).toBe(12_000);
    expect(n.reverse).toBe(0);
    expect(n.retardIndetermine).toBe(true);
    expect(n.moisEnRetard).toBe(0);
    expect(n.mention4428).toContain('8000.00 FC de reversements au 4428 ne sont rattachés à aucune dette');
  });

  it('un 4428 PUR (rien que la paie) se lit en entier, reversements non lettrés compris, comme avant', async () => {
    const r = await service([
      ligne('44280000', '2026-02-27', { credit: 12_000 }, { paie: true }),
      ligne('44280000', '2026-03-14', { debit: 12_000 }),
    ]).registre('t1', { exerciceId: 'e1', dateReference: '2026-06-30' });
    const n = inppOnem(r);
    expect(n.retenu).toBe(12_000);
    expect(n.reverse).toBe(12_000);
    expect(n.mention4428).toBeNull();
    expect(n.moisEnRetard).toBe(0);
  });

  it('les 4334 et 4335 d’un dossier ancien restent lus en entier · leur intitulé est leur structure', () => {
    const p = partagerLe4428([
      { debit: 0, credit: 1_000, compte: { numero: '43340000' }, ecriture: {} },
      { debit: 0, credit: 2_000, compte: { numero: '44280000' }, ecriture: {} },
    ]);
    // Le partage ne regarde que le 4428 · le 4334 n'y figure pas, la nature le lit par son compte.
    expect(p.pur).toBe(false);
    expect(p.lues.size).toBe(0);
    expect(p.creditsEtrangersFc).toBe(2_000);
  });
});
