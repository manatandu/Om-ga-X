import { Prisma, Referentiel } from '@prisma/client';
import { ValidationPipe } from '@nestjs/common';
import { JournalService } from './journal.service';
import { CreerJournalDto } from './dto/journal.dto';
import { motifRefusNumeroDuJournal } from './compte-propre-du-journal';

/**
 * LE COMPTE PROPRE D'UN JOURNAL DE BANQUE OU DE CAISSE, OUVERT AVEC LUI
 * (décision de Manasse du 2026-10-09, point 2) · proposé sous le compte du
 * plan choisi, modifiable, refusé hors de sa racine, et né dans la même
 * transaction que le journal.
 */

describe('le numéro du compte propre d’un journal', () => {
  const s = Referentiel.SYSCOHADA;
  it('admet une subdivision du compte du plan, à la longueur du dossier', () => {
    expect(motifRefusNumeroDuJournal('52110003', '52110000', '5211', 8, s)).toBeNull();
  });

  it('refuse lettres, autre racine, autre longueur et zéros seuls, en le disant', () => {
    expect(motifRefusNumeroDuJournal('5211BCDC', '52110000', '5211', 8, s)).toMatch(/que des chiffres · .*AUDCIF art\. 18/);
    expect(motifRefusNumeroDuJournal('5211BCDC', '52110000', '5211', 8, Referentiel.SYCEBNL)).toMatch(/SYCEBNL, Partie 2 ch\. 2/);
    expect(motifRefusNumeroDuJournal('52120001', '52110000', '5211', 8, s)).toMatch(/ne commence pas par 5211/);
    expect(motifRefusNumeroDuJournal('521100001', '52110000', '5211', 8, s)).toMatch(/compte 9 chiffres/);
    expect(motifRefusNumeroDuJournal('52110000', '52110000', '5211', 8, s)).toMatch(/ne se distingue pas du compte 52110000/);
  });

  it('refuse un numéro qu’un sous-compte semé plus profond prendrait', () => {
    // 831 du SYCEBNL · 8311 et 8315 y sont semés (Partie 2 ch. 2).
    expect(motifRefusNumeroDuJournal('83110001', '83100000', '831', 8, Referentiel.SYCEBNL)).toMatch(
      /se range sous le compte 83110000 du plan, pas sous le 83100000/,
    );
  });
});

type CompteDouble = {
  id: string;
  tenantId: string;
  numero: string;
  intitule: string;
  classe: string;
  typeCompte: 'DETAIL' | 'TOTAL';
  estActif: boolean;
  modeReportANouveau: string;
  lettrable: boolean;
};

function compte(id: string, numero: string, autres: Partial<CompteDouble> = {}): CompteDouble {
  return {
    id,
    tenantId: 't1',
    numero,
    intitule: `Compte ${numero}`,
    classe: 'CLASSE_5',
    typeCompte: 'DETAIL',
    estActif: true,
    modeReportANouveau: 'SOLDE',
    lettrable: true,
    ...autres,
  };
}

function monde(comptes: CompteDouble[], opts: { conflitNumero?: boolean } = {}) {
  const crees: CompteDouble[] = [];
  const journaux: Record<string, unknown>[] = [];
  const prisma: Record<string, unknown> = {
    tenant: {
      findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYSCOHADA', longueurCompte: 8 })),
    },
    journal: {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        journaux.push(data);
        return { id: 'j-neuf', ...data };
      }),
    },
    compte: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        comptes.find((c) => c.id === where.id && c.tenantId === where.tenantId) ?? null,
      ),
      // La doublure honore dossier, préfixe, liste de numéros et activité demandés.
      findMany: jest.fn(
        async ({ where }: { where: { tenantId: string; numero: { startsWith?: string; in?: string[] }; estActif?: boolean } }) =>
          comptes.filter(
            (c) =>
              c.tenantId === where.tenantId &&
              (!where.numero.startsWith || c.numero.startsWith(where.numero.startsWith)) &&
              (!where.numero.in || where.numero.in.includes(c.numero)) &&
              (where.estActif === undefined || c.estActif === where.estActif),
          ),
      ),
      create: jest.fn(async ({ data }: { data: CompteDouble }) => {
        if (opts.conflitNumero) {
          throw new Prisma.PrismaClientKnownRequestError('unique', {
            code: 'P2002',
            clientVersion: 'x',
            meta: { target: ['tenantId', 'numero'] },
          });
        }
        const c = { ...data, id: `c-${data.numero}` };
        crees.push(c);
        return { id: c.id };
      }),
    },
  };
  prisma.$transaction = (f: (tx: unknown) => unknown) => f(prisma);
  return { svc: new JournalService(prisma as never), crees, journaux, prisma };
}

const BANQUES = [
  compte('b5211', '52110000', { intitule: 'Banques locales' }),
  compte('bq1', '52110001', { intitule: 'BCDC' }),
  compte('autre', '52120000'),
  compte('voisin', '52110000', { tenantId: 't2' }),
  compte('dossier', '52110002', { intitule: 'Compte du dossier' }),
];

describe('ouvrir le compte propre d’un journal de trésorerie', () => {
  const journal = (autres: Record<string, unknown>) =>
    ({ code: 'BQ2', intitule: 'Rawbank', type: 'TRESORERIE', ...autres }) as never;

  it('propose le premier numéro libre sous le compte du plan choisi', async () => {
    const { svc } = monde(BANQUES);
    await expect(svc.compteDuJournalPropose('t1', 'b5211')).resolves.toMatchObject({
      numero: '52110003',
      racine: '5211',
      compteDuPlan: { numero: '52110000' },
      motif: null,
    });
  });

  it('ouvre le compte proposé et le journal dans la même transaction, réglages du compte du plan repris', async () => {
    const { svc, crees, journaux, prisma } = monde(BANQUES);
    await svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211' }));
    expect(crees).toEqual([
      expect.objectContaining({
        numero: '52110003',
        intitule: 'Rawbank',
        classe: 'CLASSE_5',
        typeCompte: 'DETAIL',
        modeReportANouveau: 'SOLDE',
        lettrable: true,
        estRetenu: true,
      }),
    ]);
    expect(journaux).toEqual([expect.objectContaining({ code: 'BQ2', compteTresorerieId: 'c-52110003' })]);
    expect((prisma.compte as { create: jest.Mock }).create).toHaveBeenCalledTimes(1);
  });

  it('garde le numéro choisi par le cabinet, et refuse celui qui sort de la racine', async () => {
    const { svc, crees } = monde(BANQUES);
    await svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211', numeroCompte: '52110025' }));
    expect(crees[0].numero).toBe('52110025');
    await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211', numeroCompte: '52120025' }))).rejects.toThrow(
      /ne commence pas par 5211/,
    );
  });

  it('un numéro déjà pris est refusé et nommé, jamais remplacé par le suivant', async () => {
    const { svc, journaux } = monde(BANQUES, { conflitNumero: true });
    await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211', numeroCompte: '52110001' }))).rejects.toThrow(
      /Le compte 52110001 existe déjà dans ce dossier/,
    );
    expect(journaux).toEqual([]);
  });

  it('refuse un compte qui n’est pas un compte du plan de trésorerie, ni d’un autre dossier, ni en sommeil', async () => {
    const comptes = [...BANQUES, compte('charge', '60110000', { classe: 'CLASSE_6' }), compte('dort', '52150000', { estActif: false })];
    const { svc } = monde(comptes);
    await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'dossier' }))).rejects.toThrow(
      /52110002 n'est pas un compte du plan de trésorerie/,
    );
    await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'charge' }))).rejects.toThrow(/n'est pas un compte du plan de trésorerie/);
    await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'voisin' }))).rejects.toThrow(/introuvable pour ce dossier/);
    await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'dort' }))).rejects.toThrow(/est en sommeil/);
  });

  it('un compte existant OU un compte ouvert, jamais les deux, et seulement pour la trésorerie', async () => {
    const { svc } = monde(BANQUES);
    await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211', compteTresorerieId: 'bq1' }))).rejects.toThrow(
      /pas les deux/,
    );
    await expect(
      svc.creer('t1', { code: 'ACH2', intitule: 'Achats', type: 'ACHATS', ouvrirCompteSousId: 'b5211' } as never),
    ).rejects.toThrow(/Seul un journal de trésorerie/);
    await expect(svc.creer('t1', journal({ numeroCompte: '52110009', compteTresorerieId: 'bq1' }))).rejects.toThrow(
      /qu'avec le compte du plan/,
    );
  });

  it('la liste des comptes du plan se lit par les numéros semés de la classe 5, actifs, du dossier', async () => {
    const { svc } = monde(BANQUES);
    const liste = await svc.comptesDuPlanPourJournal('t1');
    expect(liste.map((c: { numero: string }) => c.numero)).toEqual(['52110000']);
  });
});

describe('les champs du compte ouvert à la porte', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const valider = (corps: unknown) => pipe.transform(corps, { type: 'body', metatype: CreerJournalDto });

  it('refuse null au lieu de l’absence, et un numéro vide', async () => {
    const base = { code: 'BQ2', intitule: 'Rawbank', type: 'TRESORERIE' };
    await expect(valider({ ...base, ouvrirCompteSousId: null })).rejects.toBeDefined();
    await expect(valider({ ...base, ouvrirCompteSousId: '11111111-1111-4111-8111-111111111111', numeroCompte: '' })).rejects.toBeDefined();
    await expect(valider({ ...base, ouvrirCompteSousId: '11111111-1111-4111-8111-111111111111' })).resolves.toBeDefined();
  });
});
