"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const magasin_dto_1 = require("./dto/magasin.dto");
const magasin_service_1 = require("./magasin.service");
const MOUVEMENTS = [
    { ordre: 1, date: '2026-01-05', sens: client_1.SensMouvementStock.ENTREE, quantite: 100, cout: 1200 },
    { ordre: 2, date: '2026-02-10', sens: client_1.SensMouvementStock.ENTREE, quantite: 200, cout: 3000 },
    { ordre: 3, date: '2026-03-15', sens: client_1.SensMouvementStock.SORTIE, quantite: 50, cout: null },
    { ordre: 4, date: '2026-12-20', sens: client_1.SensMouvementStock.SORTIE, quantite: 100, cout: null },
];
function harnais(options = {}) {
    const requetes = [];
    const crees = [];
    const supprimees = [];
    const postees = [];
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: client_1.Referentiel.SYSCOHADA,
                methodeInventaireStocks: client_1.MethodeInventaireStocks.PERMANENT,
            }),
        },
        articleStock: {
            findMany: jest.fn().mockImplementation(({ where, include }) => {
                const lte = include.mouvements.where?.date?.lte;
                requetes.push({ lte });
                if (where.tenantId !== 't1' || !where.id.in.includes('a1'))
                    return Promise.resolve([]);
                return Promise.resolve([
                    {
                        id: 'a1',
                        code: 'ART-001',
                        designation: 'Ciment 50 kg',
                        uniteMesure: 'sac',
                        methodeValorisation: 'CMPACE',
                        compte: { numero: '33100000', intitule: 'Autres approvisionnements' },
                        mouvements: MOUVEMENTS.filter((m) => !lte || new Date(m.date) <= lte).map((m) => ({
                            ...m,
                            date: new Date(m.date),
                        })),
                    },
                ]);
            }),
        },
        journal: { findFirst: jest.fn().mockResolvedValue({ id: 'j1' }) },
        compte: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.numero.in.filter((n) => n.length === 8).map((n) => ({ id: `c${n}`, numero: n })))),
        },
        mouvementStock: {
            aggregate: jest.fn().mockResolvedValue({ _max: { ordre: 4 } }),
            create: jest.fn().mockImplementation(({ data }) => {
                if (options.echecInscription)
                    return Promise.reject(new Error('contrainte'));
                crees.push(data);
                return Promise.resolve(data);
            }),
        },
        ligneEcriture: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        ecriture: {
            delete: jest.fn().mockImplementation(({ where }) => {
                supprimees.push(where.id);
                return Promise.resolve({});
            }),
        },
    };
    prisma.$transaction = jest.fn().mockImplementation((fn) => fn(prisma));
    const ecritures = {
        creer: jest.fn().mockImplementation((_t, _u, dto) => {
            postees.push({ date: dto.date, lignes: dto.lignes });
            return Promise.resolve({ id: 'eReg', numeroPiece: 'OD-1' });
        }),
    };
    return {
        svc: new magasin_service_1.MagasinService(prisma, ecritures),
        requetes,
        crees,
        supprimees,
        postees,
    };
}
const regularisation = (quantitePhysique) => ({
    dateComptage: '2026-06-30',
    comptages: [{ articleId: 'a1', quantitePhysique }],
    exerciceId: 'ex1',
    journalId: 'j1',
    date: '2026-12-31',
});
describe('F36 · le magasin se confronte au jour du comptage', () => {
    it('la sortie saisie après le comptage n’entre pas dans l’écart · mali de 10, et non boni de 90', async () => {
        const { svc } = harnais();
        const r = await svc.confronter('t1', [{ articleId: 'a1', quantitePhysique: 240 }], '2026-06-30');
        const [d] = r.confrontation.differences;
        expect(d).toMatchObject({ sens: 'MALI', quantiteComptable: 250, ecartQuantite: -10, montant: 140 });
    });
    it('la requête elle-même porte la borne du comptage', async () => {
        const { svc, requetes } = harnais();
        await svc.confronter('t1', [{ articleId: 'a1', quantitePhysique: 240 }], '2026-06-30');
        expect(requetes).toEqual([{ lte: new Date('2026-06-30') }]);
    });
    it('les mouvements du jour même sont compris', async () => {
        const { svc } = harnais();
        const r = await svc.confronter('t1', [{ articleId: 'a1', quantitePhysique: 150 }], '2026-12-20');
        expect(r.confrontation.sansDifference).toEqual([{ articleId: 'a1', code: 'ART-001', quantite: 150 }]);
    });
});
describe('F35 · la différence entre au magasin avec son écriture', () => {
    it('un mali entre en SORTIE, à la date du comptage, sans coût, lié à l’écriture', async () => {
        const { svc, crees, postees } = harnais();
        await svc.enregistrerRegularisation('t1', 'u1', regularisation(240));
        expect(postees).toHaveLength(1);
        expect(crees).toEqual([
            expect.objectContaining({
                articleId: 'a1',
                sens: client_1.SensMouvementStock.SORTIE,
                quantite: 10,
                cout: null,
                date: new Date('2026-06-30'),
                ordre: 5,
                ecritureId: 'eReg',
            }),
        ]);
    });
    it('un boni entre en ENTRÉE, au coût total porté au compte', async () => {
        const { svc, crees, postees } = harnais();
        await svc.enregistrerRegularisation('t1', 'u1', regularisation(260));
        const debitStock = postees[0].lignes.find((l) => (l.debit ?? 0) > 0).debit;
        expect(crees).toEqual([
            expect.objectContaining({ sens: client_1.SensMouvementStock.ENTREE, quantite: 10, cout: 140, ecritureId: 'eReg' }),
        ]);
        expect(debitStock).toBe(140);
    });
    it('une inscription refusée retire l’écriture · les deux vont ensemble', async () => {
        const { svc, supprimees } = harnais({ echecInscription: true });
        await expect(svc.enregistrerRegularisation('t1', 'u1', regularisation(240))).rejects.toThrow(/contrainte/);
        expect(supprimees).toEqual(['eReg']);
    });
});
describe('F36 · la porte exige la date du comptage', () => {
    it('une confrontation sans date est refusée à la validation', async () => {
        const sans = (0, class_transformer_1.plainToInstance)(magasin_dto_1.ConfronterInventaireDto, { comptages: [] });
        const avec = (0, class_transformer_1.plainToInstance)(magasin_dto_1.ConfronterInventaireDto, { comptages: [], dateComptage: '2026-06-30' });
        expect((await (0, class_validator_1.validate)(sans)).map((e) => e.property)).toEqual(['dateComptage']);
        expect(await (0, class_validator_1.validate)(avec)).toEqual([]);
    });
});
//# sourceMappingURL=magasin-regularisation-f35-f36.spec.js.map