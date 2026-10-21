"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const compte_service_1 = require("./compte.service");
const routage_tva_1 = require("../tva/routage-tva");
const COMPTES = [
    { id: 'c521', tenantId: 't1', numero: '52110000', estRetenu: false },
    { id: 'c601', tenantId: 't1', numero: '60100000', estRetenu: false },
    { id: 'c411', tenantId: 't1', numero: '41110000', estRetenu: true },
    { id: 'c445', tenantId: 't1', numero: '44520000', estRetenu: false },
    { id: 'c622', tenantId: 't1', numero: '62200000', estRetenu: false },
];
const REFERENCES = {
    journal: [{ compteTresorerieId: 'c521' }],
    ligneEcriture: [{ compteId: 'c601' }, { compteId: 'c601' }],
    tauxTva: [{ compteDeductibleId: 'c445' }],
};
function prisma() {
    const handler = {
        get(cible, nom) {
            if (nom in cible)
                return cible[nom];
            return {
                groupBy: jest.fn(async ({ where, by }) => {
                    const champ = by[0];
                    const lignes = (REFERENCES[nom] ?? []).filter((l) => l[champ] && where[champ].in.includes(l[champ]));
                    return [...new Map(lignes.map((l) => [l[champ], { [champ]: l[champ] }])).values()];
                }),
            };
        },
    };
    return new Proxy({
        compte: { findMany: jest.fn(async ({ where }) => COMPTES.filter((c) => c.tenantId === where.tenantId)) },
        natureCompte: { findMany: jest.fn(async () => []), createMany: jest.fn(async () => ({ count: 0 })), count: jest.fn(async () => 7) },
        tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYSCOHADA' })) },
        journal: {
            findMany: jest.fn(async () => [{ compteTresorerieId: 'c521' }]),
            groupBy: jest.fn(async ({ where }) => (REFERENCES.journal ?? []).filter((l) => where.compteTresorerieId.in.includes(l.compteTresorerieId))),
        },
    }, handler);
}
describe('comptes retenus', () => {
    it('une liste de choix rend les retenus et les utilisés, jamais un compte ni retenu ni utilisé', async () => {
        const r = await new compte_service_1.CompteService(prisma()).lister('t1', { retenus: true });
        expect(r.map((c) => c.numero).sort()).toEqual(['41110000', '44520000', '52110000', '60100000']);
    });
    it('sans le filtre, tout le plan est rendu, et l’usage se dit sur demande', async () => {
        const r = await new compte_service_1.CompteService(prisma()).lister('t1', { usage: true });
        expect(r).toHaveLength(5);
        expect(r.find((c) => c.numero === '62200000')).toMatchObject({ utilise: false });
        expect(r.find((c) => c.numero === '52110000')).toMatchObject({ utilise: true });
    });
    it('le plan semé part non retenu, sauf les sous-comptes de taxe routés au SYSCOHADA ; un compte créé naît retenu', async () => {
        const semer = async (referentiel) => {
            const createMany = jest.fn(async () => ({ count: 0 }));
            const client = {
                compte: {
                    createMany,
                    findUnique: jest.fn(async () => ({ lettrable: true, modeReportANouveau: 'SOLDE' })),
                    findMany: jest.fn(async () => []),
                    create: jest.fn(async ({ data }) => ({ id: data.numero, ...data })),
                },
                compteVirementFonds: { findMany: jest.fn(async () => []), create: jest.fn(async () => ({})) },
                tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel, longueurCompte: 8 })) },
            };
            await new compte_service_1.CompteService({}).seedPlan('t1', referentiel, client);
            return createMany.mock.calls[0][0].data;
        };
        expect((await semer('SYCEBNL')).filter((c) => c.estRetenu)).toEqual([]);
        const retenusSyscohada = (await semer('SYSCOHADA')).filter((c) => c.estRetenu).map((c) => c.numero).sort();
        expect(retenusSyscohada).toEqual([...routage_tva_1.COMPTES_DE_TAXE_ROUTES_SYSCOHADA].sort());
        const schema = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../prisma/schema.prisma'), 'utf8');
        expect(schema).toMatch(/estRetenu\s+Boolean\s+@default\(true\)/);
    });
});
//# sourceMappingURL=comptes-retenus.spec.js.map