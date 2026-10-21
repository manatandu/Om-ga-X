"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const compte_seed_1 = require("./compte-seed");
const compte_seed_syscohada_1 = require("./compte-seed-syscohada");
const natures_compte_1 = require("./natures-compte");
const natures_compte_service_1 = require("./natures-compte.service");
const compte_service_1 = require("./compte.service");
describe('fourchettes', () => {
    it('« de 342 à 342ZZZZ » · un numéro est dans la fourchette par sa racine', () => {
        expect((0, natures_compte_1.dansFourchette)('40110000', { du: '40', au: '40' })).toBe(true);
        expect((0, natures_compte_1.dansFourchette)('41110000', { du: '40', au: '40' })).toBe(false);
        expect((0, natures_compte_1.dansFourchette)('31200000', { du: '311', au: '315' })).toBe(true);
        expect((0, natures_compte_1.dansFourchette)('31600000', { du: '311', au: '315' })).toBe(false);
        expect((0, natures_compte_1.dansFourchette)('31100000', { du: '311', au: '315' })).toBe(true);
    });
    it('les défauts rangent chaque famille à sa place', () => {
        const nom = (n) => (0, natures_compte_1.natureDe)(n, natures_compte_1.NATURES_PAR_DEFAUT)?.nature ?? null;
        expect(nom('40110000')).toBe(client_1.NatureCompteType.FOURNISSEUR);
        expect(nom('41120000')).toBe(client_1.NatureCompteType.CLIENT);
        expect(nom('52110000')).toBe(client_1.NatureCompteType.BANQUE);
        expect(nom('57110000')).toBe(client_1.NatureCompteType.CAISSE);
        expect(nom('60110000')).toBe(client_1.NatureCompteType.CHARGE);
        expect(nom('70110000')).toBe(client_1.NatureCompteType.PRODUIT);
        expect(nom('31100000')).toBe(client_1.NatureCompteType.STOCK);
        expect(nom('42200000')).toBeNull();
    });
    it('refuse un chevauchement entre natures, des lettres, et un début après la fin', () => {
        expect((0, natures_compte_1.motifRefusFourchettes)(client_1.NatureCompteType.CLIENT, [{ du: '40', au: '41' }], natures_compte_1.NATURES_PAR_DEFAUT)).toMatch(/chevauche.*Fournisseurs/);
        expect((0, natures_compte_1.motifRefusFourchettes)(client_1.NatureCompteType.CLIENT, [{ du: '41', au: '4Z' }], natures_compte_1.NATURES_PAR_DEFAUT)).toMatch(/chiffres/);
        expect((0, natures_compte_1.motifRefusFourchettes)(client_1.NatureCompteType.STOCK, [{ du: '35', au: '31' }], natures_compte_1.NATURES_PAR_DEFAUT)).toMatch(/dépasse la fin/);
        expect((0, natures_compte_1.motifRefusFourchettes)(client_1.NatureCompteType.CLIENT, [], natures_compte_1.NATURES_PAR_DEFAUT)).toMatch(/au moins une/);
        expect((0, natures_compte_1.motifRefusFourchettes)(client_1.NatureCompteType.CLIENT, [{ du: '41', au: '41' }, { du: '46', au: '46' }], natures_compte_1.NATURES_PAR_DEFAUT)).toBeNull();
    });
});
describe('les défauts sont ceux des deux plans semés', () => {
    for (const [nom, plan] of [['SYCEBNL', compte_seed_1.PLAN_COMPTES_SYCEBNL], ['SYSCOHADA', compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA]]) {
        it(`${nom} · aucun compte semé ne contredit sa nature`, () => {
            const comptes = plan.map((c) => ({
                numero: c.numero,
                typeCompte: c.typeCompte ?? 'DETAIL',
                modeReportANouveau: c.modeReportANouveau,
            }));
            expect((0, natures_compte_1.incoherencesDeReport)(comptes, natures_compte_1.NATURES_PAR_DEFAUT)).toEqual([]);
        });
    }
});
describe('cohérence du report à-nouveau', () => {
    it('signale un compte de détail qui contredit sa nature, jamais un compte Total ni un compte hors nature', () => {
        const r = (0, natures_compte_1.incoherencesDeReport)([
            { numero: '40110001', typeCompte: 'DETAIL', modeReportANouveau: client_1.ModeReportANouveau.SOLDE },
            { numero: '401', typeCompte: 'TOTAL', modeReportANouveau: client_1.ModeReportANouveau.SOLDE },
            { numero: '42200000', typeCompte: 'DETAIL', modeReportANouveau: client_1.ModeReportANouveau.AUCUN },
            { numero: '52110000', typeCompte: 'DETAIL', modeReportANouveau: client_1.ModeReportANouveau.SOLDE },
        ], natures_compte_1.NATURES_PAR_DEFAUT);
        expect(r).toEqual([expect.objectContaining({ numero: '40110001', nature: client_1.NatureCompteType.FOURNISSEUR, modeAttendu: client_1.ModeReportANouveau.DETAIL })]);
    });
});
function doublure(comptes = []) {
    let natures = [];
    const creesCompte = [];
    const miseAJour = [];
    const p = {
        natureCompte: {
            findMany: jest.fn(async () => natures),
            createMany: jest.fn(async ({ data }) => {
                natures = [...natures, ...data];
            }),
            update: jest.fn(async ({ where, data }) => {
                const n = natures.find((x) => x.nature === where.tenantId_nature.nature);
                Object.assign(n, data);
            }),
        },
        compte: {
            findMany: jest.fn(async () => comptes),
            findUnique: jest.fn(async () => null),
            create: jest.fn(async ({ data }) => {
                creesCompte.push(data);
                return data;
            }),
            update: jest.fn(async (a) => {
                miseAJour.push(a);
                return a;
            }),
        },
        tenant: { findUniqueOrThrow: jest.fn(async () => ({ longueurCompte: 8 })) },
    };
    return { p, creesCompte, miseAJour, natures: () => natures };
}
describe('câblage', () => {
    it('un dossier sans natures les reçoit à la première lecture, une seule fois', async () => {
        const { p } = doublure();
        await (0, natures_compte_service_1.naturesDuDossier)(p, 't1');
        await (0, natures_compte_service_1.naturesDuDossier)(p, 't1');
        expect(p.natureCompte.createMany).toHaveBeenCalledTimes(1);
        expect(p.natureCompte.createMany.mock.calls[0][0].data).toHaveLength(7);
    });
    it('un compte créé prend le mode de report et le lettrage de sa nature, le DTO restant maître', async () => {
        const { p, creesCompte } = doublure();
        const s = new compte_service_1.CompteService(p);
        await s.creer('t1', { numero: '52180000', intitule: 'Banque X', classe: 'CLASSE_5' });
        expect(creesCompte[0]).toMatchObject({ modeReportANouveau: client_1.ModeReportANouveau.SOLDE, lettrable: false });
        await s.creer('t1', { numero: '40180000', intitule: 'Fournisseur Y', classe: 'CLASSE_4' });
        expect(creesCompte[1]).toMatchObject({ modeReportANouveau: client_1.ModeReportANouveau.DETAIL, lettrable: true });
        await s.creer('t1', { numero: '40190000', intitule: 'Z', classe: 'CLASSE_4', modeReportANouveau: client_1.ModeReportANouveau.SOLDE });
        expect(creesCompte[2]).toMatchObject({ modeReportANouveau: client_1.ModeReportANouveau.SOLDE });
    });
    it('une fourchette déplacée change le défaut des comptes créés ENSUITE', async () => {
        const { p, creesCompte } = doublure();
        const natures = new natures_compte_service_1.NaturesCompteService(p);
        await natures.modifier('t1', client_1.NatureCompteType.CAISSE, { fourchettes: [{ du: '57', au: '58' }], lettrable: true });
        const s = new compte_service_1.CompteService(p);
        await s.creer('t1', { numero: '58500000', intitule: 'Virements internes', classe: 'CLASSE_5' });
        expect(creesCompte[0]).toMatchObject({ modeReportANouveau: client_1.ModeReportANouveau.SOLDE, lettrable: true });
    });
    it('le lettrage vient de la NATURE, pas de la règle d’avant · un client déclaré non lettrable le reste', async () => {
        const { p, creesCompte } = doublure();
        await new natures_compte_service_1.NaturesCompteService(p).modifier('t1', client_1.NatureCompteType.CLIENT, { lettrable: false });
        await new compte_service_1.CompteService(p).creer('t1', { numero: '41190000', intitule: 'Client', classe: 'CLASSE_4' });
        expect(creesCompte[0]).toMatchObject({ lettrable: false });
    });
    it('aligner avec une sélection ne touche que les comptes choisis', async () => {
        const { p, miseAJour } = doublure([
            { id: 'a', numero: '40110001', typeCompte: 'DETAIL', modeReportANouveau: client_1.ModeReportANouveau.SOLDE },
            { id: 'c', numero: '41110001', typeCompte: 'DETAIL', modeReportANouveau: client_1.ModeReportANouveau.AUCUN },
        ]);
        const r = await new natures_compte_service_1.NaturesCompteService(p).aligner('t1', ['c']);
        expect(r.alignes).toBe(1);
        expect(miseAJour).toEqual([{ where: { id: 'c' }, data: { modeReportANouveau: client_1.ModeReportANouveau.DETAIL } }]);
    });
    it('refuse une fourchette qui chevauche une autre nature, sans rien écrire', async () => {
        const { p } = doublure();
        const natures = new natures_compte_service_1.NaturesCompteService(p);
        await expect(natures.modifier('t1', client_1.NatureCompteType.BANQUE, { fourchettes: [{ du: '5', au: '5' }] })).rejects.toThrow(/chevauche/);
        expect(p.natureCompte.update).not.toHaveBeenCalled();
    });
    it('aligner rétablit le mode de la nature sur les seuls comptes qui la contredisent', async () => {
        const { p, miseAJour } = doublure([
            { id: 'a', numero: '40110001', typeCompte: 'DETAIL', modeReportANouveau: client_1.ModeReportANouveau.SOLDE },
            { id: 'b', numero: '40110002', typeCompte: 'DETAIL', modeReportANouveau: client_1.ModeReportANouveau.DETAIL },
        ]);
        const r = await new natures_compte_service_1.NaturesCompteService(p).aligner('t1');
        expect(r.alignes).toBe(1);
        expect(miseAJour).toEqual([{ where: { id: 'a' }, data: { modeReportANouveau: client_1.ModeReportANouveau.DETAIL } }]);
    });
});
//# sourceMappingURL=natures-compte.spec.js.map