"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plateforme_service_1 = require("./plateforme.service");
const groupe_service_1 = require("../groupe/groupe.service");
const licence_de_cellule_1 = require("../licence/licence-de-cellule");
const fin = (j) => new Date(`${j}T23:59:59Z`);
function parc(licences) {
    const prisma = {
        licence: {
            findUnique: async ({ where }) => licences.find((l) => l.tenantId === where.tenantId) ?? null,
            create: jest.fn(async () => ({})),
            update: jest.fn(async ({ where, data }) => {
                Object.assign(licences.find((l) => l.tenantId === where.tenantId), data);
                return {};
            }),
            updateMany: jest.fn(async ({ where, data }) => {
                const visees = licences.filter((l) => l.mere === where.tenant.dossierMereId && l.type !== where.type.not);
                visees.forEach((l) => Object.assign(l, data));
                return { count: visees.length };
            }),
        },
    };
    return { s: new plateforme_service_1.PlateformeService(prisma, { get: () => undefined }, undefined), licences };
}
describe('F46 · le paiement de la mère prolonge ses cellules', () => {
    it('chaque cellule prend l’échéance retenue de la mère, et aucun autre dossier ne bouge', async () => {
        const { s, licences } = parc([
            { tenantId: 'mere', mere: null, type: 'ABONNEMENT', statut: 'ACTIVE', dateExpiration: fin('2026-11-15') },
            { tenantId: 'c1', mere: 'mere', type: 'ABONNEMENT', statut: 'ACTIVE', dateExpiration: fin('2026-11-15') },
            { tenantId: 'c2', mere: 'mere', type: 'ABONNEMENT', statut: 'SUSPENDUE', dateExpiration: null },
            { tenantId: 'autre', mere: 'ailleurs', type: 'ABONNEMENT', statut: 'ACTIVE', dateExpiration: fin('2026-11-15') },
        ]);
        await expect(s.echeanceAbonnement('mere', '2026-12-15')).resolves.toBe('2026-12-15');
        const par = Object.fromEntries(licences.map((l) => [l.tenantId, l]));
        expect(par.c1.dateExpiration).toEqual(fin('2026-12-15'));
        expect(par.c2.dateExpiration).toEqual(fin('2026-12-15'));
        expect(par.c2.statut).toBe('SUSPENDUE');
        expect(par.autre.dateExpiration).toEqual(fin('2026-11-15'));
    });
    it('un paiement tardif ne recule pas la mère, et les cellules la rejoignent quand même', async () => {
        const { s, licences } = parc([
            { tenantId: 'mere', mere: null, type: 'ABONNEMENT', statut: 'ACTIVE', dateExpiration: fin('2027-01-01') },
            { tenantId: 'c1', mere: 'mere', type: 'ABONNEMENT', statut: 'ACTIVE', dateExpiration: fin('2026-11-15') },
        ]);
        await expect(s.echeanceAbonnement('mere', '2026-12-15')).resolves.toBe('2027-01-01');
        expect(licences[1].dateExpiration).toEqual(fin('2027-01-01'));
    });
});
describe('F46 · le reflet', () => {
    it('recopie type, statut et échéance, une échéance nulle comprise', () => {
        expect((0, licence_de_cellule_1.licenceDeCellule)({ type: 'PERPETUEL_SAAS', statut: 'SUSPENDUE', dateExpiration: null })).toEqual({
            type: 'PERPETUEL_SAAS',
            statut: 'SUSPENDUE',
            dateExpiration: null,
        });
    });
    it('refuse la licence de l’éditeur · chaque cellule deviendrait incoupable', () => {
        expect(() => (0, licence_de_cellule_1.licenceDeCellule)({ type: 'PROPRIETAIRE', statut: 'ACTIVE', dateExpiration: null })).toThrow(/éditeur/);
    });
});
describe('F46 · la cellule créée par le siège', () => {
    const creer = (licence) => {
        const traces = { register: [], licence: [] };
        const s = new groupe_service_1.GroupeService({
            tenant: {
                findUnique: async () => ({
                    id: 'mere',
                    dossierMereId: null,
                    plafondCellules: 5,
                    referentiel: 'SYCEBNL',
                    licence,
                    _count: { cellules: 0 },
                }),
                update: async () => ({}),
            },
            licence: { update: async (a) => void traces.licence.push(a) },
            user: { update: async () => ({}) },
        }, undefined, {
            register: async (dto) => {
                traces.register.push(dto);
                return { tenant: { id: 'cellule', nom: 'C' } };
            },
        }, undefined);
        return { s, traces };
    };
    it('prend le statut et l’échéance de la mère, échéance nulle comprise', async () => {
        const { s, traces } = creer({ type: 'PERPETUEL_SAAS', statut: 'SUSPENDUE', dateExpiration: null });
        await s.creerCellule('mere', { nom: 'C', emailAdmin: 'c@c.cd' });
        expect(traces.register).toEqual([expect.objectContaining({ typeLicence: 'PERPETUEL_SAAS' })]);
        expect(traces.licence).toEqual([{ where: { tenantId: 'cellule' }, data: { statut: 'SUSPENDUE', dateExpiration: null } }]);
    });
    it('sous le dossier de l’éditeur, refusée avant toute création', async () => {
        const { s, traces } = creer({ type: 'PROPRIETAIRE', statut: 'ACTIVE', dateExpiration: null });
        await expect(s.creerCellule('mere', { nom: 'C', emailAdmin: 'c@c.cd' })).rejects.toThrow(/éditeur/);
        expect(traces.register).toEqual([]);
    });
});
describe('F46 · le dossier rattaché par la console', () => {
    const rattacher = (fille, mere) => {
        const traces = { tenant: [], licence: [] };
        const prisma = {
            tenant: {
                findUnique: async ({ where }) => where.id === 'fille'
                    ? { id: 'fille', referentiel: 'SYCEBNL', licence: fille, _count: { cellules: 0 } }
                    : { id: 'mere', dossierMereId: null, referentiel: 'SYCEBNL', licence: mere },
                update: async (a) => void traces.tenant.push(a),
            },
            licence: { update: async (a) => void traces.licence.push(a) },
        };
        return { s: new plateforme_service_1.PlateformeService(prisma, { get: () => undefined }, undefined), traces };
    };
    it('prend la licence de sa mère au rattachement', async () => {
        const { s, traces } = rattacher({ type: 'ABONNEMENT' }, { type: 'ABONNEMENT', statut: 'ACTIVE', dateExpiration: fin('2027-03-31') });
        await s.modifierGroupe('fille', { dossierMereId: 'mere' });
        expect(traces.tenant).toEqual([{ where: { id: 'fille' }, data: { dossierMereId: 'mere' } }]);
        expect(traces.licence).toEqual([
            { where: { tenantId: 'fille' }, data: { type: 'ABONNEMENT', statut: 'ACTIVE', dateExpiration: fin('2027-03-31') } },
        ]);
    });
    it('refuse le dossier de l’éditeur comme cellule, et une mère qui porte sa licence, sans rien écrire', async () => {
        const a = rattacher({ type: 'PROPRIETAIRE' }, { type: 'ABONNEMENT', statut: 'ACTIVE', dateExpiration: null });
        await expect(a.s.modifierGroupe('fille', { dossierMereId: 'mere' })).rejects.toThrow(/éditeur/);
        expect(a.traces).toEqual({ tenant: [], licence: [] });
        const b = rattacher({ type: 'ABONNEMENT' }, { type: 'PROPRIETAIRE', statut: 'ACTIVE', dateExpiration: null });
        await expect(b.s.modifierGroupe('fille', { dossierMereId: 'mere' })).rejects.toThrow(/éditeur/);
        expect(b.traces).toEqual({ tenant: [], licence: [] });
    });
});
//# sourceMappingURL=licence-cellules-f46.spec.js.map