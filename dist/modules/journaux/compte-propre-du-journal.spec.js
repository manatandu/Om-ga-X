"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
const journal_service_1 = require("./journal.service");
const journal_dto_1 = require("./dto/journal.dto");
const compte_propre_du_journal_1 = require("./compte-propre-du-journal");
const compte_seed_1 = require("../comptes/compte-seed");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const subdivisions_du_plan_1 = require("../comptes/subdivisions-du-plan");
describe('le numéro du compte propre d’un journal', () => {
    const s = client_1.Referentiel.SYSCOHADA;
    it('admet une subdivision du compte du plan, à la longueur du dossier', () => {
        expect((0, compte_propre_du_journal_1.motifRefusNumeroDuJournal)('52110003', '52110000', '5211', 8, s)).toBeNull();
    });
    it('refuse lettres, autre racine, autre longueur et zéros seuls, en le disant', () => {
        expect((0, compte_propre_du_journal_1.motifRefusNumeroDuJournal)('5211BCDC', '52110000', '5211', 8, s)).toMatch(/que des chiffres · .*AUDCIF art\. 18/);
        expect((0, compte_propre_du_journal_1.motifRefusNumeroDuJournal)('5211BCDC', '52110000', '5211', 8, client_1.Referentiel.SYCEBNL)).toMatch(/SYCEBNL, Partie 2 ch\. 2/);
        expect((0, compte_propre_du_journal_1.motifRefusNumeroDuJournal)('52120001', '52110000', '5211', 8, s)).toMatch(/ne commence pas par 5211/);
        expect((0, compte_propre_du_journal_1.motifRefusNumeroDuJournal)('521100001', '52110000', '5211', 8, s)).toMatch(/compte 9 chiffres/);
        expect((0, compte_propre_du_journal_1.motifRefusNumeroDuJournal)('52110000', '52110000', '5211', 8, s)).toMatch(/ne se distingue pas du compte 52110000/);
    });
    it('refuse un numéro qu’un sous-compte semé plus profond prendrait', () => {
        expect((0, compte_propre_du_journal_1.motifRefusNumeroDuJournal)('83110001', '83100000', '831', 8, client_1.Referentiel.SYCEBNL)).toMatch(/se range sous le compte 83110000 du plan, pas sous le 83100000/);
    });
});
describe('le compte d’une banque ou d’une caisse (fiches des comptes de la classe 5 des deux plans)', () => {
    const plans = [
        [client_1.Referentiel.SYCEBNL, compte_seed_1.PLAN_COMPTES_SYCEBNL],
        [client_1.Referentiel.SYSCOHADA, compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA],
    ];
    it.each(plans)('%s · les comptes admis tiennent des fonds, relus à leur intitulé semé', (referentiel, plan) => {
        const intitules = new Map(plan.map((c) => [c.numero, c.intitule]));
        const admis = (0, subdivisions_du_plan_1.comptesDImputationSemes)(referentiel, '5').filter((n) => (0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)(n, referentiel) === null);
        expect(admis.length).toBeGreaterThan(8);
        for (const n of admis) {
            expect([n, intitules.get(n)]).toEqual([
                n,
                expect.stringMatching(/Banque|postaux|postales|Trésor|gestion et d.intermédiation|organismes financiers|onnaie électronique|onnaies électroniques|Porte-monnaie|Caisse|En monnaie nationale|En devises|Régies|Accréditifs/),
            ]);
            expect(intitules.get(n)).not.toMatch(/intérêts courus|Dépréciation|Virement/i);
        }
        expect(admis).toEqual(expect.arrayContaining(['52110000', '52150000', '53200000', '55200000']));
    });
    it.each(plans)('%s · titres, valeurs à encaisser, crédits, intérêts courus, virements et dépréciations sont refusés, chacun par sa fiche', (r) => {
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('50220000', r)).toMatch(/titres de placement \(fiche du compte 50\)/);
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('51300000', r)).toMatch(/valeurs à encaisser/);
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('52610000', r)).toMatch(/intérêts courus.*fiche du compte 52/);
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('56100000', r)).toMatch(/par le débit du compte 52/);
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('58500000', r)).toMatch(/comptes de passage/);
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('58800000', r)).toMatch(/comptes de passage/);
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('59000000', r)).toMatch(/dépréciations et provisions \(fiche du compte 59\)/);
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('60110000', r)).toMatch(/n'est pas un compte de banque ou de caisse/);
    });
    it('un numéro, deux sens · le 58 du SYSCOHADA ouvre les régies d’avance et les accréditifs, celui du SYCEBNL les seuls virements', () => {
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('58100000', client_1.Referentiel.SYSCOHADA)).toBeNull();
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('58200000', client_1.Referentiel.SYSCOHADA)).toBeNull();
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('58100001', client_1.Referentiel.SYCEBNL)).toMatch(/divisions 52, 53, 55 ou 57\./);
        expect((0, subdivisions_du_plan_1.comptesDImputationSemes)(client_1.Referentiel.SYCEBNL, '58')).toEqual(['58500000', '58800000']);
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('54100000', client_1.Referentiel.SYSCOHADA)).toMatch(/instruments de trésorerie/);
        expect((0, subdivisions_du_plan_1.comptesDImputationSemes)(client_1.Referentiel.SYCEBNL, '54')).toEqual([]);
    });
    it('les caisses des deux plans sont admises, sous-comptes du dossier compris', () => {
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('57100000', client_1.Referentiel.SYCEBNL)).toBeNull();
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('57110000', client_1.Referentiel.SYSCOHADA)).toBeNull();
        expect((0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)('57110003', client_1.Referentiel.SYSCOHADA)).toBeNull();
    });
});
function compte(id, numero, autres = {}) {
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
function monde(comptes, opts = {}) {
    const crees = [];
    const journaux = [];
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYSCOHADA', longueurCompte: 8 })),
        },
        journal: {
            findUnique: jest.fn(async () => null),
            findFirst: jest.fn(async () => null),
            create: jest.fn(async ({ data }) => {
                journaux.push(data);
                return { id: 'j-neuf', ...data };
            }),
        },
        compte: {
            findFirst: jest.fn(async ({ where }) => comptes.find((c) => c.id === where.id && c.tenantId === where.tenantId) ?? null),
            findMany: jest.fn(async ({ where }) => comptes.filter((c) => c.tenantId === where.tenantId &&
                (!where.numero.startsWith || c.numero.startsWith(where.numero.startsWith)) &&
                (!where.numero.in || where.numero.in.includes(c.numero)) &&
                (where.estActif === undefined || c.estActif === where.estActif))),
            create: jest.fn(async ({ data }) => {
                if (opts.conflitNumero) {
                    throw new client_1.Prisma.PrismaClientKnownRequestError('unique', {
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
    prisma.$transaction = (f) => f(prisma);
    prisma.$executeRaw = jest.fn(async () => 0);
    return { svc: new journal_service_1.JournalService(prisma), crees, journaux, prisma };
}
const BANQUES = [
    compte('b5211', '52110000', { intitule: 'Banques locales' }),
    compte('bq1', '52110001', { intitule: 'BCDC' }),
    compte('autre', '52120000'),
    compte('voisin', '52110000', { tenantId: 't2' }),
    compte('dossier', '52110002', { intitule: 'Compte du dossier' }),
];
describe('ouvrir le compte propre d’un journal de trésorerie', () => {
    const journal = (autres) => ({ code: 'BQ2', intitule: 'Rawbank', type: 'TRESORERIE', ...autres });
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
        expect(prisma.compte.create).toHaveBeenCalledTimes(1);
        const verrou = prisma.$executeRaw.mock.calls[0];
        expect(verrou[0].join('?')).toMatch(/pg_advisory_xact_lock\(hashtext\(\?\)\)/);
        expect(verrou[1]).toBe('panoplie:t1');
    });
    it('le numéro proposé est relu sous le verrou · un numéro pris entre-temps cède au suivant', async () => {
        const comptes = [...BANQUES];
        const { svc, crees, prisma } = monde(comptes);
        prisma.$executeRaw.mockImplementationOnce(async () => {
            comptes.push(compte('pris', '52110003'));
            return 0;
        });
        await svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211' }));
        expect(crees[0].numero).toBe('52110004');
    });
    it('un conflit d’unicité se dit selon sa clé · numéro non choisi, code du journal, autre clé relancée', async () => {
        const conflit = (target) => new client_1.Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x', meta: { target } });
        const { svc, prisma } = monde(BANQUES);
        const create = prisma.compte.create;
        create.mockRejectedValueOnce(conflit(['tenantId', 'numero']));
        await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211' }))).rejects.toThrow(/52110003 vient d'être ouvert par une autre saisie/);
        create.mockRejectedValueOnce(conflit(['tenantId', 'code']));
        await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211' }))).rejects.toThrow(/Le journal BQ2 vient d'être créé/);
        create.mockRejectedValueOnce(conflit(['tenantId', 'numerotation']));
        await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211' }))).rejects.toThrow(/^unique$/);
    });
    it('garde le numéro choisi par le cabinet, et refuse celui qui sort de la racine', async () => {
        const { svc, crees } = monde(BANQUES);
        await svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211', numeroCompte: '52110025' }));
        expect(crees[0].numero).toBe('52110025');
        await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211', numeroCompte: '52120025' }))).rejects.toThrow(/ne commence pas par 5211/);
    });
    it('un numéro déjà pris est refusé et nommé, jamais remplacé par le suivant', async () => {
        const { svc, journaux } = monde(BANQUES, { conflitNumero: true });
        await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211', numeroCompte: '52110001' }))).rejects.toThrow(/Le compte 52110001 existe déjà dans ce dossier/);
        expect(journaux).toEqual([]);
    });
    it('refuse un compte qui n’est pas un compte du plan de trésorerie, ni d’un autre dossier, ni en sommeil', async () => {
        const comptes = [
            ...BANQUES,
            compte('charge', '60110000', { classe: 'CLASSE_6' }),
            compte('dort', '52150000', { estActif: false }),
            compte('depreciation', '59000000'),
            compte('virement', '58500000'),
            compte('total', '52', { typeCompte: 'TOTAL' }),
        ];
        const { svc } = monde(comptes);
        await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'dossier' }))).rejects.toThrow(/52110002 n'est pas un compte d'imputation du plan/);
        await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'total' }))).rejects.toThrow(/52 n'est pas un compte d'imputation/);
        await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'charge' }))).rejects.toThrow(/n'est pas un compte de banque ou de caisse/);
        await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'depreciation' }))).rejects.toThrow(/fiche du compte 59/);
        await expect(svc.compteDuJournalPropose('t1', 'virement')).rejects.toThrow(/comptes de passage/);
        await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'voisin' }))).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'dort' }))).rejects.toThrow(/est en sommeil/);
    });
    it('un compte existant OU un compte ouvert, jamais les deux, et seulement pour la trésorerie', async () => {
        const { svc } = monde(BANQUES);
        await expect(svc.creer('t1', journal({ ouvrirCompteSousId: 'b5211', compteTresorerieId: 'bq1' }))).rejects.toThrow(/pas les deux/);
        await expect(svc.creer('t1', { code: 'ACH2', intitule: 'Achats', type: 'ACHATS', ouvrirCompteSousId: 'b5211' })).rejects.toThrow(/Seul un journal de trésorerie/);
        await expect(svc.creer('t1', journal({ numeroCompte: '52110009', compteTresorerieId: 'bq1' }))).rejects.toThrow(/qu'avec le compte du plan/);
    });
    it('la liste des comptes du plan se lit par les numéros semés qui tiennent des fonds, actifs, du dossier', async () => {
        const { svc } = monde([
            ...BANQUES,
            compte('caisse', '57110000'),
            compte('regie', '58100000'),
            compte('depreciation', '59000000'),
            compte('virement', '58500000'),
            compte('interets', '52610000'),
        ]);
        const liste = await svc.comptesDuPlanPourJournal('t1');
        expect(liste.map((c) => c.numero).sort()).toEqual(['52110000', '57110000', '58100000']);
    });
});
describe('les champs du compte ouvert à la porte', () => {
    const pipe = new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const valider = (corps) => pipe.transform(corps, { type: 'body', metatype: journal_dto_1.CreerJournalDto });
    it('refuse null au lieu de l’absence, et un numéro vide', async () => {
        const base = { code: 'BQ2', intitule: 'Rawbank', type: 'TRESORERIE' };
        await expect(valider({ ...base, ouvrirCompteSousId: null })).rejects.toBeDefined();
        await expect(valider({ ...base, ouvrirCompteSousId: '11111111-1111-4111-8111-111111111111', numeroCompte: '' })).rejects.toBeDefined();
        await expect(valider({ ...base, ouvrirCompteSousId: '11111111-1111-4111-8111-111111111111' })).resolves.toBeDefined();
    });
});
//# sourceMappingURL=compte-propre-du-journal.spec.js.map