import { JeuEtatsFinanciersSycebnl, MethodeCotisations, Referentiel } from '@prisma/client';
import { ControlesService } from './controles.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * D7 (décision par la loi du 2026-10-07, point 5) · sous la méthode des
 * cotisations à l'ENCAISSEMENT, un impayé d'adhérent (4131, 4133) n'est pas
 * une créance (cadre conceptuel § 5.4.2.1 ; fiches SYCEBNL des comptes 41 et
 * 51). Le module refuse désormais de le reclasser ; ce qu'il admettait avant
 * avec un avertissement est SIGNALÉ en information, jamais défait d'office.
 *
 * LA DOUBLURE HONORE LA REQUÊTE · elle filtre sur le compte d'origine, la
 * date, l'annulation et le curseur, sans quoi le test validerait un `where`
 * qui ne borne rien (CLAUDE.md, passe F4b).
 */

interface CreanceDoublure {
  id: string;
  numero: string;
  dateReclassement: Date;
  montant: number;
  annuleeLe?: Date | null;
  mouvements?: Array<{ montant: number; annuleeLe?: Date | null }>;
  /** M8 · la méthode figée au reclassement · absente, reconstituée sur le journal d'audit (vide ici · inconnue). */
  methode?: 'APPEL' | 'ENCAISSEMENT' | 'NON_DECLAREE' | null;
}

function service(methodeCotisations: MethodeCotisations | null, creances: CreanceDoublure[], referentiel: Referentiel = Referentiel.SYCEBNL) {
  const findMany = jest.fn().mockImplementation(({ where, take, cursor }: any) => {
    const racines: string[] = where.compteCreance.OR.map((o: any) => o.numero.startsWith);
    const retenues = creances
      .filter(
        (c) =>
          where.tenantId === 't' &&
          (where.annuleeLe !== null || !c.annuleeLe) &&
          c.dateReclassement <= where.dateReclassement.lte &&
          racines.some((r) => c.numero.startsWith(r)),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const depart = cursor ? retenues.findIndex((c) => c.id === cursor.id) + 1 : 0;
    return Promise.resolve(
      retenues.slice(depart, depart + take).map((c) => ({
        id: c.id,
        dateReclassement: c.dateReclassement,
        montant: c.montant,
        declareeOuverture: false,
        createdAt: c.dateReclassement,
        methodeCotisationsReclassement: c.methode ?? null,
        compteCreance: { numero: c.numero, intitule: `Adhérent ${c.id}` },
        compte416: { numero: '41610000' },
        mouvements: (c.mouvements ?? []).filter((m) => !m.annuleeLe).map((m) => ({ montant: m.montant })),
      })),
    );
  });
  const prisma = {
    exercice: {
      findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }),
    },
    tenant: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 't',
        referentiel,
        jeuEtatsFinanciersSycebnl: JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
        methodeCotisations,
      }),
    },
    ecriture: { findMany: jest.fn().mockResolvedValue([]) },
    compte: { findMany: jest.fn().mockResolvedValue([]) },
    ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
    dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
    depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
    reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
    amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
    clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
    immobilisation: { findMany: jest.fn().mockResolvedValue([]) },
    exoneration: { findMany: jest.fn().mockResolvedValue([]) },
    manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
    conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
    mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
    reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
    rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
    cloture: { findMany: jest.fn().mockResolvedValue([]) },
    creanceDouteuse: { findMany },
    // M8 · le journal d'audit du dossier, vide · une méthode non figée y est INCONNUE.
    evenementAudit: { findFirst: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;
  return { svc: new ControlesService(prisma), findMany };
}

const constat = async (svc: ControlesService) =>
  (await svc.analyser('t', 'ex')).anomalies.find((a) => a.code === 'CREANCE_ADHERENT_RECLASSEE_SOUS_ENCAISSEMENT');

describe('D7 · impayé d’adhérent reclassé au 4161 sous l’encaissement · signalé, jamais défait', () => {
  it('signale en INFORMATION un 4131 reclassé, avec le texte et l’issue · rien n’est écrit', async () => {
    const { svc } = service(MethodeCotisations.ENCAISSEMENT, [
      { id: 'c1', numero: '41310003', dateReclassement: new Date('2026-06-10'), montant: 50_000 },
    ]);
    const a = await constat(svc);
    expect(a?.gravite).toBe('INFORMATION');
    expect(a?.consequence).toMatch(/§ 5\.4\.2\.1.*fiche SYCEBNL du compte 51/);
    expect(a?.action).toMatch(/annulez.*la revue.*puis le reclassement ; soldez ensuite l’impayé/);
    // M9 · l'exercice clôturé a désormais son geste ; M8 · déclarer l'APPEL ne lève plus rien.
    expect(a?.action).toMatch(/« Corriger par le résultat » la désigne et sort la créance du module/);
    expect(a?.action).toMatch(/déclarer l’APPEL aujourd’hui ne change rien/);
    expect(a?.occurrences).toEqual([
      expect.objectContaining({ reference: '41310003 Adhérent c1', date: '2026-06-10', montant: 50_000 }),
    ]);
    expect(a?.occurrences[0].detail).toMatch(/Reclassée au 41610000 · reste au 416 après tous ses mouvements 50000\.00/);
    expect(a?.occurrences[0].detail).toMatch(/méthode au reclassement inconnue \(reclassement antérieur au journal d’audit du dossier\)/);
  });

  it('borne au périmètre · 4131 et 4133 seulement, non annulés, reclassés au plus tard à la clôture', async () => {
    const { svc, findMany } = service(MethodeCotisations.ENCAISSEMENT, [
      { id: 'a', numero: '41330001', dateReclassement: new Date('2026-03-01'), montant: 10_000 },
      { id: 'b', numero: '41100002', dateReclassement: new Date('2026-03-01'), montant: 20_000 },
      { id: 'c', numero: '41320001', dateReclassement: new Date('2026-03-01'), montant: 30_000 },
      { id: 'd', numero: '41310001', dateReclassement: new Date('2026-03-01'), montant: 40_000, annuleeLe: new Date('2026-04-01') },
      { id: 'e', numero: '41310002', dateReclassement: new Date('2027-01-05'), montant: 50_000 },
    ]);
    const a = await constat(svc);
    expect(a?.occurrences.map((o) => o.reference)).toEqual(['41330001 Adhérent a']);
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: 't',
      annuleeLe: null,
      compteCreance: { tenantId: 't' },
      // M9 · une créance corrigée par le résultat au plus tard à la clôture est sortie du module.
      NOT: { ecritureCorrectionResultat: { is: { date: { lte: new Date('2026-12-31') } } } },
    });
  });

  it('une créance d’un exercice antérieur soldée par ses mouvements se tait ; née dans l’exercice, elle parle même soldée', async () => {
    const { svc } = service(MethodeCotisations.ENCAISSEMENT, [
      { id: 'a', numero: '41310001', dateReclassement: new Date('2025-06-10'), montant: 30_000, mouvements: [{ montant: 30_000 }] },
      { id: 'b', numero: '41310002', dateReclassement: new Date('2025-06-10'), montant: 30_000, mouvements: [{ montant: 30_000, annuleeLe: new Date('2026-02-01') }] },
      { id: 'c', numero: '41310003', dateReclassement: new Date('2026-02-10'), montant: 30_000, mouvements: [{ montant: 30_000 }] },
    ]);
    const a = await constat(svc);
    expect(a?.occurrences.map((o) => o.reference)).toEqual(['41310002 Adhérent b', '41310003 Adhérent c']);
  });

  it('se tait sous l’APPEL, sans méthode et au SYSCOHADA · aucune lecture (limite écrite, la perte et la dotation refusent au geste)', async () => {
    for (const [methode, referentiel] of [
      [MethodeCotisations.APPEL, Referentiel.SYCEBNL],
      [null, Referentiel.SYCEBNL],
      [MethodeCotisations.ENCAISSEMENT, Referentiel.SYSCOHADA],
    ] as const) {
      const { svc, findMany } = service(methode, [
        { id: 'c1', numero: '41310003', dateReclassement: new Date('2026-06-10'), montant: 50_000, methode: 'ENCAISSEMENT' },
      ], referentiel);
      expect(await constat(svc)).toBeUndefined();
      expect(findMany).not.toHaveBeenCalled();
    }
  });

  it('M8 · la méthode du jour du RECLASSEMENT juge · figée APPEL, rien ; figée ENCAISSEMENT ou sans méthode, signalée', async () => {
    const { svc: neeSousAppel } = service(MethodeCotisations.ENCAISSEMENT, [
      { id: 'c1', numero: '41310003', dateReclassement: new Date('2026-06-10'), montant: 50_000, methode: 'APPEL' },
    ]);
    expect(await constat(neeSousAppel)).toBeUndefined();
    const { svc: neeSousEncaissement } = service(MethodeCotisations.ENCAISSEMENT, [
      { id: 'c1', numero: '41310003', dateReclassement: new Date('2026-06-10'), montant: 50_000, methode: 'ENCAISSEMENT' },
    ]);
    const a = await constat(neeSousEncaissement);
    expect(a?.occurrences[0].detail).toMatch(/reclassée sous l’encaissement$/);
    const { svc: sansMethode } = service(MethodeCotisations.ENCAISSEMENT, [
      { id: 'c1', numero: '41310003', dateReclassement: new Date('2026-06-10'), montant: 50_000, methode: 'NON_DECLAREE' },
    ]);
    expect((await constat(sansMethode))?.occurrences[0].detail).toMatch(/aucune méthode déclarée au reclassement$/);
  });

  it('la liste bornée dit son total au-delà de deux cents, lue par tranches sans doublon', async () => {
    const creances = Array.from({ length: 5_210 }, (_, i) => ({
      id: `c${String(i).padStart(5, '0')}`,
      numero: '41310003',
      dateReclassement: new Date('2026-06-10'),
      montant: 1_000,
    }));
    const { svc, findMany } = service(MethodeCotisations.ENCAISSEMENT, creances);
    const a = await constat(svc);
    expect(a?.occurrences).toHaveLength(200);
    expect(a?.nombre).toBe(5_210);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: 'c04999' }, skip: 1 });
  });
});
