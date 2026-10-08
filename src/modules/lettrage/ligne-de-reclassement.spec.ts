import { OrigineLettrage } from '@prisma/client';
import { LettrageService, MOTIF_DELETTRAGE_MODULE } from './lettrage.service';
import { PrismaService } from '../../common/prisma.service';
import {
  MOTIF_LETTRAGE_PERTE_AVEC_TVA,
  MOTIF_LETTRAGE_RECLASSEMENT,
  lignesDeLaPerteAvecTva,
  lignesDuCompteClientReclasse,
  lignesReclasseesDuCompte,
  refuserLignesDuCompteClientReclasse,
} from './ligne-de-reclassement';

/**
 * LIGNE A7 TER, B3 · le lettrage par montant appariait la facture de
 * 1 160 000 et le crédit du compte client par son reclassement au 416, de même
 * montant · groupe soldé `AUTOMATIQUE_MONTANT`, et la TVA d'une prestation
 * devenait exigible au reclassement (décret n° 011/42, art. 57 ; O.-L.
 * n° 10/001, art. 25, 2°). La doublure HONORE le filtre de liaison
 * (`ecriture.creanceDouteuseReclassement.is`), sans quoi le test dirait vrai
 * d'une requête qui ne filtre rien.
 */
interface Ligne {
  id: string;
  compteId: string;
  debit: number;
  credit: number;
  lettre: string | null;
  lettrageId: string | null;
  deviseId: null;
  montantDevise: null;
  libelle: null;
  ecriture: {
    tenantId: string;
    date: Date;
    reference: string | null;
    journalId: string;
    journal: { code: string };
    exercice: { statut: 'OUVERT' | 'CLOTURE' };
    creanceDouteuseReclassement: { compteCreanceId: string; annuleeLe: Date | null } | null;
    /** Mineur 6 · les comptes des lignes de l'écriture (une TVA facturée au 443). */
    lignes: Array<{ compte: { numero: string } }>;
  };
}

const ligne = (
  id: string,
  compteId: string,
  debit: number,
  credit: number,
  reclassement: Ligne['ecriture']['creanceDouteuseReclassement'] = null,
  comptesDeLaPiece: string[] = [],
  date = '2026-11-15',
  statut: 'OUVERT' | 'CLOTURE' = 'OUVERT',
): Ligne => ({
  id,
  compteId,
  debit,
  credit,
  lettre: null,
  lettrageId: null,
  deviseId: null,
  montantDevise: null,
  libelle: null,
  ecriture: {
    tenantId: 't1',
    date: new Date(date),
    reference: null,
    journalId: 'jOD',
    journal: { code: 'OD' },
    exercice: { statut },
    creanceDouteuseReclassement: reclassement,
    lignes: comptesDeLaPiece.map((numero) => ({ compte: { numero } })),
  },
});

function monter(lignes: Ligne[]) {
  const groupes: Array<Record<string, unknown> & { id: string }> = [];
  let seq = 0;
  const filtrer = (where: any) =>
    lignes.filter((l) => {
      if (where?.id?.in && !where.id.in.includes(l.id)) return false;
      if (where?.compteId && l.compteId !== where.compteId) return false;
      if (where?.lettrageId === null && l.lettrageId !== null) return false;
      if (typeof where?.lettrageId === 'string' && l.lettrageId !== where.lettrageId) return false;
      if (where?.lettre === null && l.lettre !== null) return false;
      if (where?.lettre?.not === null && l.lettre === null) return false;
      if (where?.ecriture?.tenantId && l.ecriture.tenantId !== where.ecriture.tenantId) return false;
      // Mineur 6 · la doublure honore « l'écriture porte une ligne du 443 ».
      const prefixe = where?.ecriture?.lignes?.some?.compte?.numero?.startsWith;
      if (prefixe && !l.ecriture.lignes.some((x) => x.compte.numero.startsWith(prefixe))) return false;
      const lien = where?.ecriture?.creanceDouteuseReclassement?.is;
      if (lien) {
        const r = l.ecriture.creanceDouteuseReclassement;
        if (!r) return false;
        if (lien.annuleeLe === null && r.annuleeLe !== null) return false;
        if (lien.compteCreanceId && r.compteCreanceId !== lien.compteCreanceId) return false;
      }
      return true;
    });
  const prisma: any = {
    $transaction: (fn: (tx: unknown) => unknown) => fn(prisma),
    cloture: { findMany: jest.fn().mockResolvedValue([]) },
    compte: { findFirst: jest.fn().mockResolvedValue({ id: '411', tenantId: 't1', numero: '41110001', intitule: 'Client Kasa', lettrable: true }) },
    ligneEcriture: {
      findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(filtrer(where))),
      count: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(filtrer(where).length)),
      updateMany: jest.fn().mockImplementation(({ where, data }: any) => {
        const cibles = filtrer(where);
        for (const l of cibles) Object.assign(l, data);
        return Promise.resolve({ count: cibles.length });
      }),
    },
    lettrage: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(groupes.find((g) => g.id === where.id) ?? null)),
      create: jest.fn().mockImplementation(({ data }: any) => {
        const g = { id: `g${++seq}`, ...data };
        groupes.push(g);
        return Promise.resolve(g);
      }),
      update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve(Object.assign(groupes.find((g) => g.id === where.id)!, data))),
      delete: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(groupes.splice(groupes.findIndex((g) => g.id === where.id), 1)[0])),
    },
  };
  return { service: new LettrageService(prisma as PrismaService), prisma, groupes, lignes };
}

// La facture (D 411, avec sa TVA facturée au 44310000), le reclassement (C 411
// de la créance en vigueur), et un autre règlement de même montant, ordinaire.
const facture = () => ligne('fac', '411', 1_160_000, 0, null, ['41110001', '70610000', '44310000']);
// La facture d'une association exonérée, sans TVA facturée.
const factureSansTva = () => ligne('fac', '411', 1_160_000, 0, null, ['41110001', '70610000']);
const reclassement = (annuleeLe: Date | null = null) => ligne('rcl', '411', 0, 1_160_000, { compteCreanceId: '411', annuleeLe });

describe('A7 ter, B3 · la ligne du compte client d’un reclassement hors du lettrage, TOUJOURS (règle d’A7)', () => {
  it('le lettrage automatique n’apparie plus la facture et le reclassement de même montant', async () => {
    const { service, groupes } = monter([facture(), reclassement()]);
    const r = await service.lettrageAutomatique('t1', '411', 'u1');
    expect(r.groupes).toBe(0);
    expect(groupes).toHaveLength(0);
  });

  it('le pré-lettrage ne le propose pas', async () => {
    const { service } = monter([facture(), reclassement()]);
    const p = await service.preLettrage('t1', '411');
    expect(p.propositions).toHaveLength(0);
  });

  it('la facture que le reclassement aurait prise reste OUVERTE · jamais donnée au règlement qui suit', async () => {
    // Facture du 15/03, reclassement, puis un règlement de même montant · la
    // facture est appariée au reclassement, groupe écarté · elle reste ouverte,
    // le règlement aussi (une présomption que le cabinet tranche à la main).
    const { service, groupes, lignes } = monter([facture(), reclassement(), ligne('reg', '411', 0, 1_160_000)]);
    const r = await service.lettrageAutomatique('t1', '411', 'u1');
    expect(r.groupes).toBe(0);
    expect(groupes).toHaveLength(0);
    expect(lignes.every((l) => l.lettrageId === null)).toBe(true);
    // A7 QUATER, (B) · un reclassement ouvert suspend toutes les passes par
    // montant · rien n'est posé, le règlement reste ouvert.
    const avant = monter([facture(), ligne('reg', '411', 0, 1_160_000), reclassement()]);
    const r2 = await avant.service.lettrageAutomatique('t1', '411', 'u1');
    expect(avant.groupes).toHaveLength(0);
    expect(r2).toMatchObject({ ecarteesReclassement: 3, passesParMontantSuspendues: true });
  });

  it('le lettrage MANUEL, le complément et la confirmation d’un pré-lettrage sont refusés par le motif nommé', async () => {
    const { service, groupes } = monter([facture(), reclassement(), ligne('acp', '411', 0, 100_000)]);
    await expect(service.lettrerManuel('t1', '411', ['fac', 'rcl'], 'u1')).rejects.toThrow(MOTIF_LETTRAGE_RECLASSEMENT);
    await service.lettrerManuel('t1', '411', ['fac', 'acp'], 'u1', { autoriserPartiel: true });
    await expect(service.completer('t1', groupes[0].id, ['rcl'])).rejects.toThrow(/Ne lettrez pas la facture avec le reclassement/);
    const { service: s2 } = monter([facture(), reclassement()]);
    await expect(
      s2.confirmerPreLettrage('t1', '411', 'u1', [{ ligneIds: ['fac', 'rcl'], origine: OrigineLettrage.AUTOMATIQUE_MONTANT }]),
    ).rejects.toThrow(/se déclare par le cabinet/);
  });

  // B-2 (second tour) · LA RÈGLE D'A7 RÉTABLIE · le mineur 6 laissait lettrer
  // une facture SANS TVA avec son reclassement · figé par une clôture de
  // période, ce groupe enfermait la créance (annulation du reclassement et
  // délettrage refusés, scénario c2 sur base réelle). Refusé, toujours.
  it('B-2 · sans TVA facturée aussi, la facture et son reclassement ne se lettrent pas, ni à la main ni en automatique', async () => {
    const auto = monter([factureSansTva(), reclassement()]);
    const r = await auto.service.lettrageAutomatique('t1', '411', 'u1');
    expect(r.groupes).toBe(0);
    expect(auto.groupes).toHaveLength(0);
    const manuel = monter([factureSansTva(), reclassement()]);
    await expect(manuel.service.lettrerManuel('t1', '411', ['fac', 'rcl'], 'u1')).rejects.toThrow(MOTIF_LETTRAGE_RECLASSEMENT);
    expect(manuel.groupes).toHaveLength(0);
  });

  it('B-2 · avec n’importe quelle autre pièce · un groupe partiel qui porte le reclassement ne se complète pas', async () => {
    const { service, groupes } = monter([facture(), reclassement(), ligne('avr', '411', 1_160_000, 0)]);
    await expect(service.lettrerManuel('t1', '411', ['avr', 'rcl'], 'u1')).rejects.toThrow(MOTIF_LETTRAGE_RECLASSEMENT);
    expect(groupes).toHaveLength(0);
  });

  // LIGNE A7 QUATER, (B) · relecture d'intégration d'A7 ter. U (la facture
  // reclassée, 10/02), T (service taxé, 01/05), P (le règlement de T, 20/05),
  // R (le reclassement de U, 15/06), tous de 1 160 000. Appariée AVEC R puis
  // écartée (A7 ter), la facture U prenait P, antérieur à R · [U,P] posé, T
  // laissée ouverte, la TVA de T datée au mauvais encaissement. U et T sont
  // toutes deux antérieures à R et de même montant · rien ne dit laquelle R a
  // reclassée, les passes par montant s'abstiennent.
  const lignesB = () => [
    ligne('U', '411', 1_160_000, 0, null, ['41110001', '70110000'], '2026-02-10'),
    ligne('T', '411', 1_160_000, 0, null, ['41110001', '70610000', '44320000'], '2026-05-01'),
    ligne('P', '411', 0, 1_160_000, null, ['52110000', '41110001'], '2026-05-20'),
    ligne('R', '411', 0, 1_160_000, { compteCreanceId: '411', annuleeLe: null }, [], '2026-06-15'),
  ];
  const lettrees = (lignes: Array<{ id: string; lettrageId: string | null }>) => lignes.filter((l) => l.lettrageId !== null).map((l) => l.id).sort();

  it('(B) · U, T, P, R · aucune paire par montant, ni [U,P] ni [T,P], et le nombre de lignes laissées ouvertes est dit', async () => {
    const { service, groupes, lignes } = monter(lignesB());
    const r = await service.lettrageAutomatique('t1', '411', 'u1');
    expect(r.groupes).toBe(0);
    expect(groupes).toHaveLength(0);
    expect(lettrees(lignes)).toEqual([]);
    // U, T, P et R laissées hors des passes par montant, toutes ouvertes.
    expect(r).toMatchObject({ passesParMontantSuspendues: true, ecarteesReclassement: 4 });
    expect(r.miseDeCote).toMatch(/aucun rapprochement par montant n'est fait \(4 ligne\(s\)/);
  });

  it('(B) · le pré-lettrage, qui partage le calcul, ne propose rien non plus et le dit', async () => {
    const { service } = monter(lignesB());
    const p = await service.preLettrage('t1', '411');
    expect(p.propositions).toHaveLength(0);
    expect(p).toMatchObject({ passesParMontantSuspendues: true, ecarteesReclassement: 4 });
  });

  it('(B) · la passe par référence de pièce, saisie par un humain, joue encore', async () => {
    const lignes = lignesB();
    lignes[1].ecriture.reference = 'FV-0042';
    lignes[2].ecriture.reference = 'FV-0042';
    const { service, groupes } = monter(lignes);
    const r = await service.lettrageAutomatique('t1', '411', 'u1');
    expect(r).toMatchObject({ parPiece: 1, parMontant: 0 });
    expect(groupes[0].origine).toBe(OrigineLettrage.AUTOMATIQUE_PIECE);
    expect(lettrees(lignes)).toEqual(['P', 'T']);
  });

  // SECOND TOUR · LA « CANDIDATE UNIQUE » ÉTAIT ENCORE UNE DEVINETTE · le
  // montant de R peut couvrir plusieurs factures, ou une partie d'une seule.
  // Plus aucune exception · tout reclassement ouvert suspend les passes.
  it('(B) · aucune exception · U seule antérieure à R, T (01/07) et son règlement P (20/07) restent aussi au lettrage manuel', async () => {
    const { service, groupes } = monter([
      ligne('U', '411', 1_160_000, 0, null, ['41110001', '70110000'], '2026-02-10'),
      ligne('R', '411', 0, 1_160_000, { compteCreanceId: '411', annuleeLe: null }, [], '2026-06-15'),
      ligne('T', '411', 1_160_000, 0, null, ['41110001', '70610000'], '2026-07-01'),
      ligne('P', '411', 0, 1_160_000, null, ['52110000', '41110001'], '2026-07-20'),
    ]);
    const r = await service.lettrageAutomatique('t1', '411', 'u1');
    expect(groupes).toHaveLength(0);
    expect(r).toMatchObject({ passesParMontantSuspendues: true, ecarteesReclassement: 4, parMontant: 0 });
    expect(r.miseDeCote).toMatch(/rien ne dit quelles factures il a reclassées/);
  });

  it('(B) · second tour, cas 1 · R reclasse X + Y, P paie V · ni [P,X,Y] ni rien par montant', async () => {
    const scene = () => [
      ligne('V', '411', 500_000, 0, null, [], '2026-02-01'),
      ligne('X', '411', 300_000, 0, null, [], '2026-03-01'),
      ligne('Y', '411', 200_000, 0, null, [], '2026-04-01'),
      ligne('R', '411', 0, 500_000, { compteCreanceId: '411', annuleeLe: null }, [], '2026-05-15'),
      ligne('P', '411', 0, 500_000, null, [], '2026-05-20'),
    ];
    const { service, groupes, lignes } = monter(scene());
    const r = await service.lettrageAutomatique('t1', '411', 'u1');
    expect(groupes).toHaveLength(0);
    expect(lettrees(lignes)).toEqual([]);
    expect(r).toMatchObject({ parMontant: 0, passesParMontantSuspendues: true, ecarteesReclassement: 5 });
    expect((await monter(scene()).service.preLettrage('t1', '411')).propositions).toHaveLength(0);
  });

  it('(B) · second tour, cas 2 · R reclasse le reste de U payée en partie par P1, W payée par Q · ni [U,P1,Q] ni rien par montant', async () => {
    const scene = () => [
      ligne('U', '411', 1_000_000, 0, null, [], '2026-02-01'),
      ligne('P1', '411', 0, 600_000, null, [], '2026-03-01'),
      ligne('W', '411', 400_000, 0, null, [], '2026-04-01'),
      ligne('Q', '411', 0, 400_000, null, [], '2026-04-20'),
      ligne('R', '411', 0, 400_000, { compteCreanceId: '411', annuleeLe: null }, [], '2026-05-15'),
    ];
    const { service, groupes, lignes } = monter(scene());
    const r = await service.lettrageAutomatique('t1', '411', 'u1');
    expect(groupes).toHaveLength(0);
    expect(lettrees(lignes)).toEqual([]);
    expect(r).toMatchObject({ parMontant: 0, passesParMontantSuspendues: true });
    expect((await monter(scene()).service.preLettrage('t1', '411')).propositions).toHaveLength(0);
  });

  it('(B) · U figée par une clôture et T antérieures à R, abstention', async () => {
    const { service, groupes } = monter([
      ligne('U', '411', 1_160_000, 0, null, [], '2025-02-10', 'CLOTURE'),
      ligne('T', '411', 1_160_000, 0, null, [], '2026-05-01'),
      ligne('P', '411', 0, 1_160_000, null, [], '2026-05-20'),
      ligne('R', '411', 0, 1_160_000, { compteCreanceId: '411', annuleeLe: null }, [], '2026-06-15'),
    ]);
    const r = await service.lettrageAutomatique('t1', '411', 'u1');
    expect(groupes).toHaveLength(0);
    expect(r.passesParMontantSuspendues).toBe(true);
  });

  it('(B) · N+1 · les à-nouveaux de U et de R, sans liaison, ne s’apparient pas · R de N reste ouverte et les suspend', async () => {
    // N clôturé · U, R de N figées. L'à-nouveau en détail reporte U et R
    // (non lettrées) au 01/01/2027, la ligne de R sans liaison au reclassement.
    const scene = () => [
      ligne('U', '411', 1_160_000, 0, null, [], '2026-02-10', 'CLOTURE'),
      ligne('R', '411', 0, 1_160_000, { compteCreanceId: '411', annuleeLe: null }, [], '2026-06-15', 'CLOTURE'),
      ligne('U-AN', '411', 1_160_000, 0, null, [], '2027-01-01'),
      ligne('R-AN', '411', 0, 1_160_000, null, [], '2027-01-01'),
    ];
    const { service, groupes } = monter(scene());
    const r = await service.lettrageAutomatique('t1', '411', 'u1');
    expect(groupes).toHaveLength(0);
    expect(r).toMatchObject({ passesParMontantSuspendues: true, ecarteesReclassement: 2 });
    expect((await monter(scene()).service.preLettrage('t1', '411')).propositions).toHaveLength(0);
  });

  it('un reclassement ANNULÉ ne retient plus rien · sa ligne se lettre comme une autre', async () => {
    const { service, groupes } = monter([facture(), reclassement(new Date('2026-12-01'))]);
    await service.lettrerManuel('t1', '411', ['fac', 'rcl'], 'u1');
    expect(groupes).toHaveLength(1);
  });

  it('seule la ligne du compte d’ORIGINE est retenue · la ligne 416 du même reclassement reste lettrable', async () => {
    const { prisma } = monter([ligne('d416', '416', 1_160_000, 0, { compteCreanceId: '411', annuleeLe: null }), reclassement()]);
    const tenues = await lignesDuCompteClientReclasse(prisma, 't1', ['d416', 'rcl']);
    expect([...tenues]).toEqual(['rcl']);
    // La requête porte le dossier et la liaison, jamais un libellé.
    expect(prisma.ligneEcriture.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ['d416', 'rcl'] },
      ecriture: { tenantId: 't1', creanceDouteuseReclassement: { is: { annuleeLe: null } } },
    });
  });
});

describe('A7 ter, B2 (b) · le lettrage qu’un module pose sur ses propres lignes', () => {
  // Les lignes 416 d'une créance éteinte · reclassement 1 160 000, recouvrement 760 000, perte 400 000.
  const lignes416 = () => [ligne('r', '416', 1_160_000, 0), ligne('m1', '416', 0, 760_000), ligne('m2', '416', 0, 400_000)];

  it('pose un groupe SOLDÉ, d’origine MODULE (lui seul le défait), lettre servie sur chaque ligne', async () => {
    const { service, groupes, lignes } = monter(lignes416());
    const r = await service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1');
    expect(r).toEqual({ code: 'A' });
    expect(groupes[0]).toMatchObject({ statut: 'SOLDE', origine: OrigineLettrage.MODULE, compteId: '416' });
    expect(lignes.map((l) => l.lettre)).toEqual(['A', 'A', 'A']);
  });

  it('rend un MOTIF, jamais une exception, quand rien ne se pose · solde non nul, ligne déjà lettrée, compte non lettrable', async () => {
    const { service, groupes } = monter(lignes416());
    expect(await service.lettrerLignesDuModule('t1', '416', ['r', 'm1'], 'u1')).toEqual({ motif: expect.stringMatching(/ne soldent pas/) });
    const deja = monter(lignes416());
    deja.lignes[1].lettrageId = 'g-x';
    expect(await deja.service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1')).toEqual({ motif: expect.stringMatching(/déjà lettrée/) });
    const ferme = monter(lignes416());
    ferme.prisma.compte.findFirst.mockResolvedValue({ id: '416', tenantId: 't1', numero: '41610000', lettrable: false });
    expect(await ferme.service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1')).toEqual({ motif: expect.stringMatching(/pas déclaré lettrable/) });
    expect(groupes).toHaveLength(0);
  });

  it('défait le groupe dans la transaction de l’appelant · lignes libérées, groupe supprimé ; un groupe verrouillé refuse', async () => {
    const { service, groupes, lignes, prisma } = monter(lignes416());
    await service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1');
    await service.defaireLettrageDuModule(prisma, 't1', groupes[0].id);
    expect(groupes).toHaveLength(0);
    expect(lignes.every((l) => l.lettre === null && l.lettrageId === null)).toBe(true);
    const v = monter(lignes416());
    await v.service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1');
    v.groupes[0].verrouille = true;
    await expect(v.service.defaireLettrageDuModule(v.prisma, 't1', v.groupes[0].id)).rejects.toThrow(/verrouillé/);
    // Mineur 7 · un groupe d'une autre origine n'est jamais défait par le module.
    const manuel = monter(lignes416());
    await manuel.service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1');
    manuel.groupes[0].origine = OrigineLettrage.MANUEL;
    await expect(manuel.service.defaireLettrageDuModule(manuel.prisma, 't1', manuel.groupes[0].id)).rejects.toThrow(/n'a pas été posé par le module/);
    expect(manuel.groupes).toHaveLength(1);
  });

  // A7 QUATER, m5 · le schéma disait « lui seul le défait » et `delettrer`
  // défaisait le groupe · désormais refusé, avec l'issue nommée.
  it('m5 · le délettrage refuse un groupe d’origine MODULE, et nomme l’issue · les lignes restent lettrées', async () => {
    const { service, groupes, lignes, prisma } = monter(lignes416());
    prisma.lettrage.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(groupes.find((g) => g.id === where.id || g.code === where.code) ?? null),
    );
    await service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1');
    await expect(service.delettrer('t1', '416', 'A')).rejects.toThrow(MOTIF_DELETTRAGE_MODULE('A'));
    expect(groupes).toHaveLength(1);
    expect(lignes.every((l) => l.lettre === 'A')).toBe(true);
    // Un groupe d'une autre origine se délettre comme avant.
    groupes[0].origine = OrigineLettrage.MANUEL;
    await expect(service.delettrer('t1', '416', 'A')).resolves.toEqual({ lettre: 'A', nombreLignes: 3 });
  });
});

/*
  LIGNE TVA-DECISIONS, RELECTURE DU POINT D, MAJEUR 2 · les lignes du compte
  d'origine de la perte qui récupère la TVA (retour, perte, négatifs de leur
  annulation) ne se lettrent jamais avec une facture · le moteur de TVA lirait
  le rapprochement comme un encaissement (décret n° 011/42, art. 57).
*/
describe('la perte qui récupère la TVA · ses lignes du compte d’origine ne se lettrent pas avec la facture', () => {
  const creance = { compteCreanceId: 'cli' };
  const servies = [
    // Le retour · son mouvement porte une perte.
    { id: 'retour', compteId: 'cli', ecriture: { mouvementCreanceDouteuse: { ecriturePerteId: 'e-perte', creance }, mouvementCreanceDouteusePerte: null, corrigeEcriture: null } },
    // La perte.
    { id: 'perte', compteId: 'cli', ecriture: { mouvementCreanceDouteuse: null, mouvementCreanceDouteusePerte: { creance }, corrigeEcriture: null } },
    // Le négatif de la perte, après annulation.
    { id: 'negatif', compteId: 'cli', ecriture: { mouvementCreanceDouteuse: null, mouvementCreanceDouteusePerte: null, corrigeEcriture: { mouvementCreanceDouteuse: null, mouvementCreanceDouteusePerte: { creance } } } },
    // La ligne 416 du retour · pas le compte d'origine.
    { id: 'l416', compteId: 'c416', ecriture: { mouvementCreanceDouteuse: { ecriturePerteId: 'e-perte', creance }, mouvementCreanceDouteusePerte: null, corrigeEcriture: null } },
    // Une perte au TTC (sans seconde pièce) · hors de la règle.
    { id: 'ttc', compteId: 'cli', ecriture: { mouvementCreanceDouteuse: { ecriturePerteId: null, creance }, mouvementCreanceDouteusePerte: null, corrigeEcriture: null } },
  ];
  const db = {
    ligneEcriture: {
      findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where?.id?.in ? servies.filter((l) => where.id.in.includes(l.id)) : [])),
    },
  };

  it('reconnaît le retour, la perte et le négatif par leur liaison, la seule ligne du compte d’origine', async () => {
    const lues = await lignesDeLaPerteAvecTva(db as any, 't1', ['retour', 'perte', 'negatif', 'l416', 'ttc', 'facture']);
    expect([...lues].sort()).toEqual(['negatif', 'perte', 'retour']);
  });

  it('le refus est nommé, au lettrage manuel comme au complément', async () => {
    await expect(refuserLignesDuCompteClientReclasse(db as any, 't1', ['facture', 'perte'])).rejects.toThrow(MOTIF_LETTRAGE_PERTE_AVEC_TVA);
    await expect(refuserLignesDuCompteClientReclasse(db as any, 't1', ['facture'], ['retour'])).rejects.toThrow(MOTIF_LETTRAGE_PERTE_AVEC_TVA);
    await expect(refuserLignesDuCompteClientReclasse(db as any, 't1', ['facture', 'ttc'])).resolves.toBeUndefined();
  });
});

/*
  LIGNE TVA-DECISIONS, RELECTURE « ÉCHECS SILENCIEUX », M4 · le REPORT au
  détail de la ligne d'un reclassement, en N+1, ne porte aucune liaison · le
  lettrage automatique l'appariait au report de la facture, et le moteur de
  TVA y lisait un encaissement au 1er janvier. Reconnu par la clé que le report
  recopie, à toute profondeur. La doublure honore chaque filtre.
*/
describe('le report du reclassement à l’exercice suivant ne se lettre pas non plus', () => {
  type L = {
    id: string;
    compteId: string;
    debit: number;
    credit: number;
    dateEcheance: Date | null;
    libelle: string | null;
    lettrageId: string | null;
    ecriture: { libelle: string; creanceDouteuseReclassement: { compteCreanceId: string } | null };
  };
  const servies: L[] = [
    // N · le reclassement R, C 411.
    { id: 'R', compteId: 'cli', debit: 0, credit: 1_160_000, dateEcheance: null, libelle: null, lettrageId: null, ecriture: { libelle: 'Reclassement 41110000', creanceDouteuseReclassement: { compteCreanceId: 'cli' } } },
    // N+1 · son report, puis N+2 · le report du report.
    { id: 'R1', compteId: 'cli', debit: 0, credit: 1_160_000, dateEcheance: null, libelle: 'RAN détail 41110000 · Reclassement 41110000', lettrageId: null, ecriture: { libelle: 'À-nouveau', creanceDouteuseReclassement: null } },
    { id: 'R2', compteId: 'cli', debit: 0, credit: 1_160_000, dateEcheance: null, libelle: 'RAN détail 41110000 · RAN détail 41110000 · Reclassement 41110000', lettrageId: null, ecriture: { libelle: 'À-nouveau', creanceDouteuseReclassement: null } },
    // N+1 · le report de la FACTURE, et celui d'un règlement de même montant.
    { id: 'U1', compteId: 'cli', debit: 1_160_000, credit: 0, dateEcheance: null, libelle: 'RAN détail 41110000 · Facture 12', lettrageId: null, ecriture: { libelle: 'À-nouveau', creanceDouteuseReclassement: null } },
    { id: 'P1', compteId: 'cli', debit: 0, credit: 1_160_000, dateEcheance: null, libelle: 'RAN détail 41110000 · Règlement', lettrageId: null, ecriture: { libelle: 'À-nouveau', creanceDouteuseReclassement: null } },
  ];
  const honore = (l: L, where: any): boolean => {
    if (where.id?.in && !where.id.in.includes(l.id)) return false;
    if (typeof where.compteId === 'string' && l.compteId !== where.compteId) return false;
    if (where.compteId?.in && !where.compteId.in.includes(l.compteId)) return false;
    if (where.lettrageId === null && l.lettrageId !== null) return false;
    if (where.libelle?.startsWith && !(l.libelle ?? '').startsWith(where.libelle.startsWith)) return false;
    const rel = where.ecriture?.creanceDouteuseReclassement?.is;
    if (rel && (!l.ecriture.creanceDouteuseReclassement || (rel.compteCreanceId && rel.compteCreanceId !== l.ecriture.creanceDouteuseReclassement.compteCreanceId))) return false;
    // Les pièces d'une perte (filtre `OR`) · aucune ici.
    if (where.ecriture?.OR) return false;
    return true;
  };
  const db = { ligneEcriture: { findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(servies.filter((l) => honore(l, where ?? {})))) } };

  it('le lettrage manuel du report de la facture avec celui du reclassement est refusé, à toute profondeur', async () => {
    await expect(refuserLignesDuCompteClientReclasse(db as any, 't1', ['U1', 'R1'])).rejects.toThrow(MOTIF_LETTRAGE_RECLASSEMENT);
    await expect(refuserLignesDuCompteClientReclasse(db as any, 't1', ['U1', 'R2'])).rejects.toThrow(MOTIF_LETTRAGE_RECLASSEMENT);
    // Un règlement reporté, sans lien avec le reclassement, se lettre.
    await expect(refuserLignesDuCompteClientReclasse(db as any, 't1', ['U1', 'P1'])).resolves.toBeUndefined();
  });

  it('les passes par montant le mettent de côté · il est compté parmi les lignes reclassées du compte', async () => {
    const reclassees = await lignesReclasseesDuCompte(db as any, 't1', 'cli');
    expect([...reclassees].sort()).toEqual(['R', 'R1', 'R2']);
  });
});
