import { DevisesService } from './devises.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';

/**
 * La distinction que le SYCEBNL prend soin de poser, et qu'un logiciel
 * généraliste écrase : une CRÉANCE en devise donne à la clôture un écart
 * LATENT (478/479), une DISPONIBILITÉ en devise donne un écart RÉALISÉ
 * (676/776). Le texte le dit mot pour mot : « Le compte 676 ne doit pas être
 * confondu avec le compte 478 qui n'enregistre que les pertes probables de
 * change », et « les écarts de conversion négatifs constatés à la clôture sur
 * les disponibilités en devises sont considérés comme étant des pertes de
 * change supportées ».
 *
 * S'y ajoute la prudence : la perte probable est provisionnée, le gain
 * probable ne l'est jamais.
 */

type Faux = Record<string, unknown>;

interface LigneTest {
  compteNumero: string;
  deviseCode: string;
  debit: number;
  credit: number;
  montantDevise: number;
}

function service(lignes: LigneTest[], coursCloture: number | null) {
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
    exercice: {
      // Aucun exercice antérieur ouvert · l'ordre des réévaluations ne bloque rien (A5).
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'ex1',
        dateDebut: new Date('2026-01-01'),
        dateFin: new Date('2026-12-31'),
        statut: 'OUVERT',
      }),
    },
    ligneEcriture: {
      aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 } }),
      findMany: jest.fn().mockResolvedValue(
        lignes.map((l, i) => ({
          compteId: `c-${l.compteNumero}`,
          deviseId: `d-${l.deviseCode}`,
          debit: l.debit,
          credit: l.credit,
          montantDevise: l.montantDevise,
          compte: { id: `c-${l.compteNumero}`, numero: l.compteNumero, intitule: `Compte ${i}` },
          devise: { id: `d-${l.deviseCode}`, code: l.deviseCode },
        })),
      ),
    },
    reevaluation: { findMany: jest.fn().mockResolvedValue([]), },
    provisionChangeOuverture: { findMany: jest.fn().mockResolvedValue([]) },
    // Le verrou des gestes de provision (A5) · une ligne par dossier.
    verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
    // Un à-nouveau validé existe, sans ligne sur les comptes de provision (A5).
    ecriture: { count: jest.fn().mockResolvedValue(1) },
    coursDevise: {
      findFirst: jest.fn().mockResolvedValue(coursCloture === null ? null : { cours: coursCloture }),
    },
  } as Faux;
  return new DevisesService(prisma as unknown as PrismaService, {} as EcritureService);
}

describe('réévaluation · créances et dettes contre disponibilités', () => {
  it('une créance en USD qui se déprécie donne une PERTE LATENTE, provisionnée', async () => {
    // Créance de 1 000 USD inscrite à 2 800 000 (cours 2 800), cours de
    // clôture 2 500 : la créance ne vaut plus que 2 500 000.
    const r = await service(
      [{ compteNumero: '41200000', deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }],
      2500,
    ).calculer('t1', { exerciceId: 'ex1' });

    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].ecart).toBe(-300_000);
    expect(r.perteLatente).toBe(300_000);
    expect(r.perteRealisee).toBe(0);
    // Prudence : la perte probable est provisionnée.
    expect(r.provision).toBe(300_000);
  });

  it('une créance qui s’apprécie donne un GAIN LATENT, jamais provisionné', async () => {
    const r = await service(
      [{ compteNumero: '41200000', deviseCode: 'USD', debit: 2_500_000, credit: 0, montantDevise: 1000 }],
      2800,
    ).calculer('t1', { exerciceId: 'ex1' });

    expect(r.gainLatent).toBe(300_000);
    expect(r.perteLatente).toBe(0);
    expect(r.provision).toBe(0);
  });

  it('une disponibilité en devise donne un écart RÉALISÉ, sans provision', async () => {
    // Compte 52 : banque en devises. L'écart va au résultat, pas au 478.
    const r = await service(
      [{ compteNumero: '52120000', deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }],
      2500,
    ).calculer('t1', { exerciceId: 'ex1' });

    expect(r.positions[0].estTresorerie).toBe(true);
    expect(r.perteRealisee).toBe(300_000);
    expect(r.perteLatente).toBe(0);
    // Un écart réalisé n'appelle aucune provision : il est déjà au résultat.
    expect(r.provision).toBe(0);
  });

  it('une dette en devise se réévalue comme une position nette créditrice', async () => {
    // Dette de 1 000 USD inscrite à 2 500 000 ; cours de clôture 2 800 : la
    // dette coûte désormais 2 800 000, l'entité y perd 300 000.
    const r = await service(
      [{ compteNumero: '40110000', deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }],
      2800,
    ).calculer('t1', { exerciceId: 'ex1' });

    expect(r.positions[0].montantDevise).toBe(-1000);
    expect(r.positions[0].valeurComptable).toBe(-2_500_000);
    expect(r.positions[0].valeurReevaluee).toBe(-2_800_000);
    expect(r.perteLatente).toBe(300_000);
  });

  it('agrège les lignes d’un même compte et d’une même devise', async () => {
    const r = await service(
      [
        { compteNumero: '41200000', deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 },
        { compteNumero: '41200000', deviseCode: 'USD', debit: 0, credit: 1_400_000, montantDevise: 500 },
      ],
      2500,
    ).calculer('t1', { exerciceId: 'ex1' });

    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].montantDevise).toBe(500);
    expect(r.positions[0].valeurComptable).toBe(1_400_000);
    expect(r.positions[0].ecart).toBe(-150_000);
  });

  /**
   * AUDIT FINAL F1 · une dette en devise corrigée par inscription en
   * négatif porte un CRÉDIT négatif, montant en devise sans signe. Lire le
   * sens sur « débit positif » comptait la correction dans le sens de
   * l'erreur, et la dette annulée apparaissait deux fois.
   */
  it('une ligne de crédit inscrite en négatif annule la position qu’elle corrige', async () => {
    const r = await service(
      [
        { compteNumero: '40100000', deviseCode: 'USD', debit: 0, credit: 2_800_000, montantDevise: 1000 },
        { compteNumero: '40100000', deviseCode: 'USD', debit: 0, credit: -2_800_000, montantDevise: 1000 },
      ],
      2500,
    ).calculer('t1', { exerciceId: 'ex1' });
    expect(r.positions).toHaveLength(0);
  });

  it('signale la devise sans cours coté plutôt que de réévaluer à l’aveugle', async () => {
    const r = await service(
      [{ compteNumero: '41200000', deviseCode: 'EUR', debit: 3_000_000, credit: 0, montantDevise: 1000 }],
      null,
    ).calculer('t1', { exerciceId: 'ex1' });

    expect(r.positions).toHaveLength(0);
    expect(r.coursManquants).toEqual(['EUR']);
  });

  it('ignore une position soldée', async () => {
    const r = await service(
      [
        { compteNumero: '41200000', deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 },
        { compteNumero: '41200000', deviseCode: 'USD', debit: 0, credit: 2_800_000, montantDevise: 1000 },
      ],
      2500,
    ).calculer('t1', { exerciceId: 'ex1' });

    expect(r.positions).toHaveLength(0);
  });
});

/**
 * IMPUTATION DES ÉCRITURES · le trou par lequel le défaut est passé.
 *
 * Les tests ci-dessus vérifient tous `calculer`, c'est-à-dire le RAPPORT :
 * combien vaut l'écart, quelle part est latente, quelle part se provisionne.
 * Aucun ne vérifiait `reevaluer`, c'est-à-dire l'ÉCRITURE : sur quels comptes
 * l'écart et la provision s'imputent. Le calcul était juste et l'imputation
 * fausse, et rien ne regardait l'imputation.
 *
 * Deux défauts en découlaient pour un dossier SYSCOHADA, l'un et l'autre
 * muets · aucune erreur, aucun déséquilibre, aucun total du compte de
 * résultat déplacé :
 *
 *  · la résolution par racine à trois chiffres rendait toujours le premier
 *    compte trouvé sous 478 et sous 479, soit 4781 « diminution des créances
 *    d'exploitation » et 4791 « augmentation des créances d'exploitation ».
 *    Une DETTE fournisseur en devise s'imputait donc sur la subdivision des
 *    CRÉANCES ;
 *  · la provision partait toujours en 6971 / 194, réservés par l'AUDCIF aux
 *    risques financiers à long terme, y compris sur une créance client · le
 *    résultat financier gonflait au détriment du résultat d'exploitation.
 *
 * Les comptes attendus sont ceux du plan SYSCOHADA (compte 47) et de l'AUDCIF
 * Titre VIII ch. 22 § 2.3, lus à la source, jamais de mémoire.
 */
function serviceEcritures(lignes: LigneTest[], coursCloture: number, referentiel: 'SYCEBNL' | 'SYSCOHADA') {
  const ecrites: { libelle: string; lignes: { numero: string; debit?: number; credit?: number }[] }[] = [];
  const prisma = {
    exercice: {
      // Aucun exercice antérieur ouvert · l'ordre des réévaluations ne bloque rien (A5).
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'ex1',
        dateDebut: new Date('2026-01-01'),
        dateFin: new Date('2026-12-31'),
        statut: 'OUVERT',
      }),
    },
    ligneEcriture: {
      aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 } }),
      findMany: jest.fn().mockResolvedValue(
        lignes.map((l, i) => ({
          compteId: `c-${l.compteNumero}`,
          deviseId: `d-${l.deviseCode}`,
          debit: l.debit,
          credit: l.credit,
          montantDevise: l.montantDevise,
          compte: { id: `c-${l.compteNumero}`, numero: l.compteNumero, intitule: `Compte ${i}` },
          devise: { id: `d-${l.deviseCode}`, code: l.deviseCode },
        })),
      ),
    },
    coursDevise: { findFirst: jest.fn().mockResolvedValue({ cours: coursCloture }) },
    tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel }) },
    journal: { findFirst: jest.fn().mockResolvedValue({ id: 'j-od', code: 'OD' }) },
    // Le plan du dossier rend, pour toute racine demandée, un compte complété
    // à huit chiffres · comme le semis réel (CLAUDE.md §7). L'identifiant
    // reprend la RACINE demandée : c'est ce qui permet au test de dire quel
    // compte le service a réclamé.
    compte: {
      findFirst: jest.fn(({ where }: { where: { numero: { startsWith: string } } }) => {
        const racine = where.numero.startsWith;
        return Promise.resolve({ id: `c-${racine}`, numero: racine.padEnd(8, '0') });
      }),
    },
    provisionChangeOuverture: { findMany: jest.fn().mockResolvedValue([]) },
    // Le verrou des gestes de provision (A5) · une ligne par dossier.
    verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
    // Un à-nouveau validé existe, sans ligne sur les comptes de provision (A5).
    ecriture: { count: jest.fn().mockResolvedValue(1) },
    reevaluation: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'r1' }),
    },
  } as Faux;
  const ecritureService = {
    creer: jest.fn((_t: string, _u: string, dto: { libelle: string; lignes: { compteId: string; debit?: number; credit?: number }[] }) => {
      ecrites.push({
        libelle: dto.libelle,
        lignes: dto.lignes.map((l) => ({ numero: l.compteId.replace(/^c-/, ''), debit: l.debit, credit: l.credit })),
      });
      return Promise.resolve({ id: `e-${ecrites.length}` });
    }),
  } as unknown as EcritureService;
  const svc = new DevisesService(prisma as unknown as PrismaService, ecritureService);
  return { svc, ecrites };
}

const CLIENT = '41200000';
const FOURNISSEUR = '40100000';
const EMPRUNT = '16200000';

describe('imputation des écritures de réévaluation · SYSCOHADA', () => {
  it('une CRÉANCE qui se déprécie va en 4781, jamais en 478 au hasard', async () => {
    const { svc, ecrites } = serviceEcritures(
      [{ compteNumero: CLIENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }],
      2500,
      'SYSCOHADA',
    );
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    const ecarts = ecrites[0].lignes.map((l) => l.numero);
    // 4781 « Diminution des créances d'exploitation » · c'est bien ce qui
    // arrive à une créance client dont la devise se déprécie.
    expect(ecarts).toContain('4781');
    expect(ecarts).not.toContain('4783');
  });

  it('une DETTE qui s’alourdit va en 4783, et surtout PAS sur les créances', async () => {
    const { svc, ecrites } = serviceEcritures(
      [{ compteNumero: FOURNISSEUR, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }],
      2800,
      'SYSCOHADA',
    );
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    const ecarts = ecrites[0].lignes.map((l) => l.numero);
    // 4783 « Augmentation des dettes d'exploitation ». C'EST LE DÉFAUT
    // D'ORIGINE : la racine « 478 » rendait 4781, la subdivision des
    // créances, pour une dette fournisseur.
    expect(ecarts).toContain('4783');
    expect(ecarts).not.toContain('4781');
  });

  it('une dette FINANCIÈRE va en 4784, pas en 4783', async () => {
    const { svc, ecrites } = serviceEcritures(
      [{ compteNumero: EMPRUNT, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }],
      2800,
      'SYSCOHADA',
    );
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    expect(ecrites[0].lignes.map((l) => l.numero)).toContain('4784');
  });

  it('un GAIN sur créance va en 4791, un gain sur dette en 4793', async () => {
    const { svc, ecrites } = serviceEcritures(
      // Les deux positions doivent gagner AU MÊME cours de clôture : la
      // créance a été inscrite plus bas (2 300), la dette plus haut (2 800),
      // et la clôture à 2 500 apprécie l'une pendant qu'elle allège l'autre.
      [
        { compteNumero: CLIENT, deviseCode: 'USD', debit: 2_300_000, credit: 0, montantDevise: 1000 },
        { compteNumero: FOURNISSEUR, deviseCode: 'USD', debit: 0, credit: 2_800_000, montantDevise: 1000 },
      ],
      2500,
      'SYSCOHADA',
    );
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    const ecarts = ecrites[0].lignes.map((l) => l.numero);
    expect(ecarts).toContain('4791'); // créance qui s'apprécie
    expect(ecarts).toContain('4793'); // dette qui s'allège
  });

  it('la provision sur une CRÉANCE COMMERCIALE est une charge d’EXPLOITATION · 6591 par 4991', async () => {
    const { svc, ecrites } = serviceEcritures(
      [{ compteNumero: CLIENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }],
      2500,
      'SYSCOHADA',
    );
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    const provision = ecrites.find((e) => e.libelle.startsWith('Provision'));
    const numeros = provision!.lignes.map((l) => l.numero);
    // AUDCIF Titre VIII ch. 22 § 2.3 : « S'agissant d'une créance de nature
    // commerciale, la provision […] s'analyse comme une charge d'exploitation :
    // débit du 6591 […] par le crédit du 4991 ».
    expect(numeros).toEqual(['6591', '4991']);
    // 6971/194 sont réservés aux risques FINANCIERS à long terme · les servir
    // ici gonfle le résultat financier au détriment de l'exploitation.
    expect(numeros).not.toContain('6971');
  });

  it('la provision sur un EMPRUNT reste financière · 6971 par 194', async () => {
    const { svc, ecrites } = serviceEcritures(
      [{ compteNumero: EMPRUNT, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }],
      2800,
      'SYSCOHADA',
    );
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    const provision = ecrites.find((e) => e.libelle.startsWith('Provision'));
    expect(provision!.lignes.map((l) => l.numero)).toEqual(['6971', '194']);
  });

  it('une perte sur créance ET une perte sur emprunt donnent DEUX couples, pas un seul', async () => {
    const { svc, ecrites } = serviceEcritures(
      [
        { compteNumero: CLIENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 },
        { compteNumero: EMPRUNT, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1100 },
      ],
      2500,
      'SYSCOHADA',
    );
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    const provision = ecrites.find((e) => e.libelle.startsWith('Provision'))!;
    const numeros = provision.lignes.map((l) => l.numero);
    expect(numeros).toContain('6591');
    expect(numeros).toContain('6971');
    // L'écriture reste équilibrée quel que soit le nombre de couples.
    const debits = provision.lignes.reduce((s, l) => s + (l.debit ?? 0), 0);
    const credits = provision.lignes.reduce((s, l) => s + (l.credit ?? 0), 0);
    expect(Math.round(debits * 100)).toBe(Math.round(credits * 100));
  });
});

/**
 * LIGNE A5 TER · LE SYCEBNL SUBDIVISE LE 478 ET LE 479. Son plan des comptes
 * (Partie 2 ch. 2, compte 47) · « 4781 diminution des créances d'exploitation
 * et HAO [47811, 47818], 4782 diminution des créances financières, 4783
 * augmentation des dettes d'exploitation et HAO [47831, 47838], 4784
 * augmentation des dettes financières » et « 479 (4791 à 4798, symétrique du
 * 478) ». La racine générique « 478 » rendait 47811000 pour toute perte · une
 * dette fournisseur s'imputait sur la diminution des CRÉANCES.
 */
describe('imputation des écritures de réévaluation · SYCEBNL, subdivisions du 478 et du 479 (A5 ter)', () => {
  const ecartDe = async (compteNumero: string, debit: number, credit: number, cours: number) => {
    const { svc, ecrites } = serviceEcritures([{ compteNumero, deviseCode: 'USD', debit, credit, montantDevise: 1000 }], cours, 'SYCEBNL');
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    return ecrites[0].lignes.map((l) => l.numero).filter((n) => n.startsWith('47'));
  };

  it('dette fournisseur qui s’alourdit · 47831, augmentation des dettes d’exploitation', async () => {
    expect(await ecartDe(FOURNISSEUR, 0, 2_500_000, 2800)).toEqual(['47831']);
  });
  it('créance client qui baisse · 47811 ; qui monte · 47911', async () => {
    expect(await ecartDe(CLIENT, 2_800_000, 0, 2500)).toEqual(['47811']);
    expect(await ecartDe(CLIENT, 2_500_000, 0, 2800)).toEqual(['47911']);
  });
  it('dette fournisseur qui s’allège · 47931', async () => {
    expect(await ecartDe(FOURNISSEUR, 0, 2_800_000, 2500)).toEqual(['47931']);
  });
  it('autre dette H.A.O. (484) · 47838 et 47938', async () => {
    expect(await ecartDe('48400000', 0, 2_500_000, 2800)).toEqual(['47838']);
    expect(await ecartDe('48400000', 0, 2_800_000, 2500)).toEqual(['47938']);
  });
  it('second tour · fournisseur d’investissements (481) · dette FINANCIÈRE, 4784 et 4794 (§ 1.1, comme le réalisé d’A6)', async () => {
    expect(await ecartDe('48120000', 0, 2_500_000, 2800)).toEqual(['4784']);
    expect(await ecartDe('48120000', 0, 2_800_000, 2500)).toEqual(['4794']);
  });
  it('second tour · intérêts courus (186, 276) · 4784 et 4782, financiers', async () => {
    expect(await ecartDe('18620000', 0, 2_500_000, 2800)).toEqual(['4784']);
    expect(await ecartDe('27610000', 2_800_000, 0, 2500)).toEqual(['4782']);
  });
  it('emprunt (18) et crédit de trésorerie (56) · 4784 et 4794, dettes FINANCIÈRES', async () => {
    expect(await ecartDe('18100000', 0, 2_500_000, 2800)).toEqual(['4784']);
    expect(await ecartDe('56100000', 0, 2_800_000, 2500)).toEqual(['4794']);
  });
  it('prêt (27) · 4782 et 4792, créances FINANCIÈRES', async () => {
    expect(await ecartDe('27100000', 2_800_000, 0, 2500)).toEqual(['4782']);
    expect(await ecartDe('27100000', 2_500_000, 0, 2800)).toEqual(['4792']);
  });

  it('créance client · provision au 4991 par le 6591, jamais le 194 (fiche du compte 19, exclusions)', async () => {
    const { svc, ecrites } = serviceEcritures(
      [{ compteNumero: CLIENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }],
      2500,
      'SYCEBNL',
    );
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    const provision = ecrites.find((e) => e.libelle.startsWith('Provision'));
    expect(provision!.lignes.map((l) => l.numero)).toEqual(['6591', '4991']);
  });

  it('chaque subdivision servie est ouverte en DÉTAIL au semis SYCEBNL', () => {
    const { PLAN_COMPTES_SYCEBNL } = jest.requireActual('../comptes/compte-seed') as { PLAN_COMPTES_SYCEBNL: { numero: string; typeCompte?: string }[] };
    for (const r of ['47811', '47818', '4782', '47831', '47838', '4784', '47911', '47918', '4792', '47931', '47938', '4794']) {
      expect([r, PLAN_COMPTES_SYCEBNL.some((c) => c.numero === r.padEnd(8, '0') && c.typeCompte !== 'TOTAL')]).toEqual([r, true]);
    }
  });
});

/**
 * LIGNE A5 TER · LE 54 VA AU 4786 ET AU 4797. AUDCIF Titre VIII ch. 22 § 3.2.2 ·
 * « Les comptes 4786 Différences d'évaluation sur instruments de trésorerie –
 * ACTIF et 4797 Différences d'évaluation sur instruments de trésorerie –
 * PASSIF enregistrent les différences d'évaluation en contrepartie du compte
 * 54 » ; art. 58-2, « à l'actif pour une perte latente, au passif pour un gain
 * latent ».
 */
describe('SYSCOHADA · un instrument de trésorerie (54) en devise · 4786 / 4797 (A5 ter)', () => {
  const ecartDe = async (debit: number, credit: number, cours: number) => {
    const { svc, ecrites } = serviceEcritures(
      [{ compteNumero: '54200000', deviseCode: 'USD', debit, credit, montantDevise: 1000 }],
      cours,
      'SYSCOHADA',
    );
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    return ecrites;
  };
  it('perte latente · 4786, jamais 4782', async () => {
    const ecrites = await ecartDe(2_800_000, 0, 2500);
    expect(ecrites[0].lignes.map((l) => l.numero)).toEqual(['4786', '54200000']);
    // La provision de la perte · court terme financier (art. 58-2, « provision financière » ; § 2.3).
    expect(ecrites.find((e) => e.libelle.startsWith('Provision'))!.lignes.map((l) => l.numero)).toEqual(['6791', '4997']);
  });
  it('gain latent · 4797, jamais 4792', async () => {
    const ecrites = await ecartDe(2_500_000, 0, 2800);
    expect(ecrites[0].lignes.map((l) => l.numero)).toEqual(['54200000', '4797']);
  });
});

/**
 * QU'EST-CE QU'UNE DISPONIBILITÉ ?
 *
 * La question décide de tout : une disponibilité en devise donne un écart
 * RÉALISÉ, qui va droit au résultat financier ; une créance ou une dette
 * donne un écart LATENT, qui passe par les écarts de conversion et appelle
 * une provision.
 *
 * Le test portait sur la classe ENTIÈRE (`numero.startsWith('5')`), ce qui
 * rangeait en disponibilités trois familles qui n'en sont pas · 50 titres de
 * placement, 54 instruments de trésorerie, et surtout 56 « Banques, crédits
 * de trésorerie et d'escompte », qui est une DETTE bancaire. Un découvert en
 * devise passait donc directement en 676, sans écart de conversion et sans
 * provision : le résultat financier portait une perte que l'AUDCIF veut
 * latente.
 */
const DECOUVERT = '56100000';
const PLACEMENT = '50100000';
const BANQUE = '52100000';

describe('disponibilités contre trésorerie financière', () => {
  it('un DÉCOUVERT bancaire en devise donne un écart LATENT, pas une perte réalisée', async () => {
    // Découvert de 1 000 USD inscrit à 2 500 000, clôture à 2 800 : la dette
    // s'alourdit de 300 000. Perte PROBABLE, pas supportée.
    const r = await service(
      [{ compteNumero: DECOUVERT, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }],
      2800,
    ).calculer('t1', { exerciceId: 'ex1' });
    expect(r.perteLatente).toBe(300_000);
    expect(r.perteRealisee).toBe(0);
    // Et la prudence s'applique : la perte probable se provisionne.
    expect(r.provision).toBe(300_000);
  });

  it('un TITRE DE PLACEMENT en devise n’est ni une disponibilité ni une créance · aucun écart (§ 1.3, A5 ter)', async () => {
    const r = await service(
      [{ compteNumero: PLACEMENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }],
      2500,
    ).calculer('t1', { exerciceId: 'ex1' });
    expect(r.perteLatente).toBe(0);
    expect(r.perteRealisee).toBe(0);
    expect(r.positionsNonReevaluees).toEqual([expect.objectContaining({ numero: PLACEMENT, motif: expect.stringContaining('§ 1.3') })]);
  });

  it('une BANQUE, elle, reste une disponibilité · écart réalisé, aucune provision', async () => {
    const r = await service(
      [{ compteNumero: BANQUE, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }],
      2500,
    ).calculer('t1', { exerciceId: 'ex1' });
    expect(r.perteRealisee).toBe(300_000);
    expect(r.perteLatente).toBe(0);
    expect(r.provision).toBe(0);
  });
});

describe('les TROIS couples de provision du texte sont servis', () => {
  it('un découvert bancaire est un risque financier à COURT terme · 6791 par 4997', async () => {
    const { svc, ecrites } = serviceEcritures(
      [{ compteNumero: DECOUVERT, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }],
      2800,
      'SYSCOHADA',
    );
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    const provision = ecrites.find((e) => e.libelle.startsWith('Provision'))!;
    // AUDCIF Titre VIII ch. 22 § 2.3 : « risques à court terme : débit 6791
    // Charges pour provisions sur risques financiers · crédit 4997 ».
    expect(provision.lignes.map((l) => l.numero)).toEqual(['6791', '4997']);
  });

  it('son écart va en 4784 · augmentation d’une dette FINANCIÈRE', async () => {
    const { svc, ecrites } = serviceEcritures(
      [{ compteNumero: DECOUVERT, deviseCode: 'USD', debit: 0, credit: 2_500_000, montantDevise: 1000 }],
      2800,
      'SYSCOHADA',
    );
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    expect(ecrites[0].lignes.map((l) => l.numero)).toContain('4784');
  });

  it('exploitation, court terme et long terme cohabitent dans UNE écriture équilibrée', async () => {
    const { svc, ecrites } = serviceEcritures(
      [
        { compteNumero: CLIENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 },
        { compteNumero: DECOUVERT, deviseCode: 'USD', debit: 0, credit: 2_400_000, montantDevise: 1000 },
        { compteNumero: EMPRUNT, deviseCode: 'USD', debit: 0, credit: 2_400_000, montantDevise: 1000 },
      ],
      2500,
      'SYSCOHADA',
    );
    await svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' });
    const provision = ecrites.find((e) => e.libelle.startsWith('Provision'))!;
    const numeros = provision.lignes.map((l) => l.numero);
    expect(numeros).toContain('6591'); // créance client · exploitation
    expect(numeros).toContain('6791'); // découvert · financier court terme
    expect(numeros).toContain('6971'); // emprunt · financier long terme
    const debits = provision.lignes.reduce((s, l) => s + (l.debit ?? 0), 0);
    const credits = provision.lignes.reduce((s, l) => s + (l.credit ?? 0), 0);
    expect(Math.round(debits * 100)).toBe(Math.round(credits * 100));
  });
});

describe('A5 ter, second tour · un dossier introuvable ne prend jamais le SYSCOHADA par défaut', () => {
  it('reevaluer · refus nommé, aucune écriture', async () => {
    const { svc, ecrites } = serviceEcritures(
      [{ compteNumero: CLIENT, deviseCode: 'USD', debit: 2_800_000, credit: 0, montantDevise: 1000 }],
      2500,
      'SYCEBNL',
    );
    (svc as unknown as { prisma: { tenant: { findUnique: jest.Mock } } }).prisma.tenant.findUnique.mockResolvedValue(null);
    await expect(svc.reevaluer('t1', 'u1', { exerciceId: 'ex1' })).rejects.toThrow(/Dossier introuvable/);
    expect(ecrites).toEqual([]);
  });
});
