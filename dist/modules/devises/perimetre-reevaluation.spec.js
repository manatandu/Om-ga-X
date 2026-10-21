"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const devises_service_1 = require("./devises.service");
const perimetre_reevaluation_1 = require("./perimetre-reevaluation");
function service(referentiel, numero, lignes = [{ debit: 2_800_000, credit: 0, montantDevise: 1000 }]) {
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel }) },
        exercice: {
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
            findMany: jest.fn().mockResolvedValue(lignes.map((l) => ({
                compteId: 'c1',
                deviseId: 'd1',
                ...l,
                compte: { id: 'c1', numero, intitule: 'Compte' },
                devise: { id: 'd1', code: 'USD' },
            }))),
        },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]), },
        provisionChangeOuverture: { findMany: jest.fn().mockResolvedValue([]) },
        verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
        ecriture: { count: jest.fn().mockResolvedValue(1) },
        coursDevise: { findFirst: jest.fn().mockResolvedValue({ cours: 2500 }) },
    };
    return new devises_service_1.DevisesService(prisma, {});
}
describe('réévaluation · le périmètre du ch. 22', () => {
    it.each([
        ['24410000', '§ 1.1'],
        ['21300000', '§ 1.1'],
        ['25100000', '§ 1.2'],
        ['26100000', '§ 1.3'],
        ['27410000', '§ 1.3'],
        ['27480000', '§ 1.3'],
        ['50220000', '§ 1.3'],
        ['50330000', '§ 1.3'],
    ])('un %s en USD ne reçoit aucun écart, et le motif le dit (%s)', async (numero, paragraphe) => {
        for (const ref of [client_1.Referentiel.SYSCOHADA, client_1.Referentiel.SYCEBNL]) {
            const r = await service(ref, numero).calculer('t1', { exerciceId: 'ex1' });
            expect(r.positions).toHaveLength(0);
            expect(r.perteLatente).toBe(0);
            expect(r.provision).toBe(0);
            expect(r.positionsNonReevaluees).toEqual([
                expect.objectContaining({ numero, deviseCode: 'USD', montantDevise: 1000, motif: expect.stringContaining(paragraphe) }),
            ]);
        }
    });
    it('A5 ter, second tour · le 508 sort avec les titres, part « créances assimilées » comprise, et le motif dit la lecture d’OmegaX', () => {
        for (const ref of [client_1.Referentiel.SYSCOHADA, client_1.Referentiel.SYCEBNL]) {
            expect((0, perimetre_reevaluation_1.seReevalueALaCloture)('50800000', ref)).toBe(false);
            expect((0, perimetre_reevaluation_1.motifHorsReevaluation)('50800000', ref)).toMatch(/part « créances assimilées » comprise[\s\S]*§ 1\.3\) · lecture d'OmegaX/);
        }
    });
    it('A5 ter · les intérêts courus des titres (506, 276) restent réévalués · ce sont des créances de revenus', () => {
        for (const ref of [client_1.Referentiel.SYSCOHADA, client_1.Referentiel.SYCEBNL]) {
            expect((0, perimetre_reevaluation_1.seReevalueALaCloture)('50630000', ref)).toBe(true);
            expect((0, perimetre_reevaluation_1.seReevalueALaCloture)('27640000', ref)).toBe(true);
            expect((0, perimetre_reevaluation_1.seReevalueALaCloture)('50220000', ref)).toBe(false);
            expect((0, perimetre_reevaluation_1.seReevalueALaCloture)('27410000', ref)).toBe(false);
        }
    });
    it('un prêt (27) reste réévalué aux deux référentiels · c’est une créance', async () => {
        for (const ref of [client_1.Referentiel.SYSCOHADA, client_1.Referentiel.SYCEBNL]) {
            const r = await service(ref, '27100000').calculer('t1', { exerciceId: 'ex1' });
            expect(r.positions[0].ecart).toBe(-300_000);
            expect(r.positionsNonReevaluees).toEqual([]);
            expect(r.coursUtilises).toEqual({ d1: 2500 });
        }
    });
    it('un numéro, deux sens · le 16 est un emprunt au SYSCOHADA, un fonds affecté au SYCEBNL', async () => {
        const syscohada = await service(client_1.Referentiel.SYSCOHADA, '16100000').calculer('t1', { exerciceId: 'ex1' });
        expect(syscohada.positions).toHaveLength(1);
        const sycebnl = await service(client_1.Referentiel.SYCEBNL, '16100000').calculer('t1', { exerciceId: 'ex1' });
        expect(sycebnl.positions).toHaveLength(0);
        expect(sycebnl.positionsNonReevaluees[0].motif).toContain('fonds propres');
        const emprunt = await service(client_1.Referentiel.SYCEBNL, '18100000').calculer('t1', { exerciceId: 'ex1' });
        expect(emprunt.positions).toHaveLength(1);
    });
    it('stocks et gestion restent hors réévaluation, créances et trésorerie dedans', () => {
        for (const ref of [client_1.Referentiel.SYSCOHADA, client_1.Referentiel.SYCEBNL]) {
            expect((0, perimetre_reevaluation_1.motifHorsReevaluation)('31100000', ref)).toContain('§ 1.4');
            expect((0, perimetre_reevaluation_1.seReevalueALaCloture)('60100000', ref)).toBe(false);
            expect((0, perimetre_reevaluation_1.seReevalueALaCloture)('70100000', ref)).toBe(false);
            expect((0, perimetre_reevaluation_1.seReevalueALaCloture)('41100000', ref)).toBe(true);
            expect((0, perimetre_reevaluation_1.seReevalueALaCloture)('40100000', ref)).toBe(true);
            expect((0, perimetre_reevaluation_1.seReevalueALaCloture)('52100000', ref)).toBe(true);
        }
        expect((0, perimetre_reevaluation_1.seReevalueALaCloture)('17100000', client_1.Referentiel.SYSCOHADA)).toBe(true);
        expect((0, perimetre_reevaluation_1.seReevalueALaCloture)('17100000', client_1.Referentiel.SYCEBNL)).toBe(false);
    });
});
describe('réévaluation · une position dénouée dans sa devise', () => {
    const regleeSansEcart = [
        { debit: 0, credit: 1_948_800, montantDevise: 1160 },
        { debit: 2_088_000, credit: 0, montantDevise: 1160 },
    ];
    it('soldée en devise, reste en francs · hors réévaluation, motif « réalisé » nommé, aux deux référentiels', async () => {
        for (const ref of [client_1.Referentiel.SYSCOHADA, client_1.Referentiel.SYCEBNL]) {
            const r = await service(ref, '40110000', regleeSansEcart).calculer('t1', { exerciceId: 'ex1' });
            expect(r.positions).toHaveLength(0);
            expect(r.perteLatente).toBe(0);
            expect(r.gainLatent).toBe(0);
            expect(r.provision).toBe(0);
            expect(r.positionsNonReevaluees).toEqual([
                expect.objectContaining({ numero: '40110000', montantDevise: 0, motif: expect.stringContaining('139200.00') }),
            ]);
            expect(r.positionsNonReevaluees[0].motif).toMatch(/RÉALISÉ.*art\. 55/);
        }
    });
    it('réglée au coût historique (A6) · rien ne reste, rien n’est dit', async () => {
        const r = await service(client_1.Referentiel.SYSCOHADA, '40110000', [
            { debit: 0, credit: 1_948_800, montantDevise: 1160 },
            { debit: 1_948_800, credit: 0, montantDevise: 1160 },
        ]).calculer('t1', { exerciceId: 'ex1' });
        expect(r.positions).toHaveLength(0);
        expect(r.positionsNonReevaluees).toEqual([]);
    });
    it('réglée en partie au coût historique (A6) · le reste se réévalue sur sa seule valeur d’origine', async () => {
        const r = await service(client_1.Referentiel.SYSCOHADA, '40110000', [
            { debit: 0, credit: 1_948_800, montantDevise: 1160 },
            { debit: 1_008_000, credit: 0, montantDevise: 600 },
        ]).calculer('t1', { exerciceId: 'ex1' });
        expect(r.positions).toHaveLength(1);
        expect(r.positions[0].montantDevise).toBe(-560);
        expect(r.positions[0].valeurComptable).toBe(-940_800);
        expect(r.positions[0].ecart).toBe(-(560 * 2500 - 940_800));
    });
    it('une disponibilité soldée en devise garde sa conversion (art. 57), déjà réalisée', async () => {
        const r = await service(client_1.Referentiel.SYSCOHADA, '52110000', [
            { debit: 1_680_000, credit: 0, montantDevise: 1000 },
            { debit: 0, credit: 1_800_000, montantDevise: 1000 },
        ]).calculer('t1', { exerciceId: 'ex1' });
        expect(r.positionsNonReevaluees).toEqual([]);
        expect(r.positions).toHaveLength(1);
        expect(r.positions[0].estTresorerie).toBe(true);
    });
});
describe('réévaluation · un groupe partiel dénoué sur un compte qui porte d’autres positions', () => {
    const ligne = (debit, credit, montantDevise, lettrageId) => ({
        compteId: 'c401',
        deviseId: 'd1',
        debit,
        credit,
        montantDevise,
        lettrageId,
        compte: { id: 'c401', numero: '40110000', intitule: 'NZUZI' },
        devise: { id: 'd1', code: 'USD' },
        ecriture: { exerciceId: 'ex1', date: new Date('2026-06-01') },
    });
    const lignes = [
        ligne(0, 1_948_800, 1160, 'L'),
        ligne(1_008_000, 0, 600, 'L'),
        ligne(1_064_000, 0, 560, 'L'),
        ligne(0, 850_000, 500, null),
    ];
    function monter() {
        const findMany = jest.fn(async ({ where }) => where.lettrageId
            ? lignes
                .filter((l) => l.lettrageId && where.lettrageId.in.includes(l.lettrageId))
                .map((l) => ({ ...l, lettrage: { code: 'A' } }))
            : lignes);
        const prisma = {
            tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }) },
            exercice: {
                findMany: jest.fn().mockResolvedValue([]),
                findFirst: jest.fn().mockResolvedValue({ id: 'ex1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: 'OUVERT' }),
            },
            ligneEcriture: { aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 } }), findMany },
            reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
            provisionChangeOuverture: { findMany: jest.fn().mockResolvedValue([]) },
            verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
            ecriture: { count: jest.fn().mockResolvedValue(1) },
            coursDevise: { findFirst: jest.fn().mockResolvedValue({ cours: 1850 }) },
        };
        return new devises_service_1.DevisesService(prisma, {});
    }
    it('seule la facture B se réévalue · 75 000 de perte latente, pas 198 200', async () => {
        const r = await monter().calculer('t1', { exerciceId: 'ex1' });
        expect(r.positions).toHaveLength(1);
        expect(r.positions[0]).toMatchObject({ montantDevise: -500, valeurComptable: -850_000, ecart: -75_000 });
        expect(r.perteLatente).toBe(75_000);
    });
    it('le groupe dénoué est NOMMÉ, avec son réalisé à passer', async () => {
        const r = await monter().calculer('t1', { exerciceId: 'ex1' });
        expect(r.positionsNonReevaluees).toEqual([
            expect.objectContaining({ numero: '40110000', deviseCode: 'USD', montantDevise: 0, motif: expect.stringMatching(/^lettrage a · position dénouée.*123200\.00/) }),
        ]);
    });
});
describe('réévaluation · un groupe à cheval sur deux exercices', () => {
    const toutes = [
        { exercice: 'N', debit: 0, credit: 1_948_800, montantDevise: 1160, lettrageId: 'L' },
        { exercice: 'N', debit: 1_008_000, credit: 0, montantDevise: 600, lettrageId: 'L' },
        { exercice: 'N1', debit: 0, credit: 940_800, montantDevise: 560, lettrageId: null },
        { exercice: 'N1', debit: 1_064_000, credit: 0, montantDevise: 560, lettrageId: 'L' },
    ];
    const habiller = (l) => ({
        compteId: 'c401',
        deviseId: 'd1',
        debit: l.debit,
        credit: l.credit,
        montantDevise: l.montantDevise,
        lettrageId: l.lettrageId,
        lettrage: { code: 'A' },
        compte: { id: 'c401', numero: '40110000', intitule: 'NZUZI' },
        devise: { id: 'd1', code: 'USD' },
        ecriture: { exerciceId: l.exercice, date: new Date(l.exercice === 'N' ? '2026-06-01' : '2027-06-01') },
    });
    it('à cheval, dénoué par-dessus l’ouverture · la position soldée en devise ne se réévalue pas, le groupe est nommé', async () => {
        const findMany = jest.fn(async ({ where }) => toutes
            .filter((l) => (where.ecriture.exerciceId === undefined || l.exercice === where.ecriture.exerciceId))
            .filter((l) => (where.lettrageId ? l.lettrageId !== null && where.lettrageId.in.includes(l.lettrageId) : true))
            .map(habiller));
        const prisma = {
            tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }) },
            exercice: {
                findMany: jest.fn().mockResolvedValue([]),
                findFirst: jest.fn().mockResolvedValue({ id: 'N1', dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31'), statut: 'OUVERT' }),
            },
            ligneEcriture: { aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 } }), findMany },
            reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
            provisionChangeOuverture: { findMany: jest.fn().mockResolvedValue([]) },
            verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
            ecriture: { count: jest.fn().mockResolvedValue(1) },
            coursDevise: { findFirst: jest.fn().mockResolvedValue({ cours: 1850 }) },
        };
        const r = await new devises_service_1.DevisesService(prisma, {}).calculer('t1', { exerciceId: 'N1' });
        expect(findMany.mock.calls.some(([a]) => a.where.lettrageId && a.where.ecriture.exerciceId === undefined)).toBe(true);
        expect(r.positions).toHaveLength(0);
        expect(r.positionsNonReevaluees).toEqual([
            expect.objectContaining({ numero: '40110000', montantDevise: 0, motif: expect.stringMatching(/^lettrage a · position dénouée.*123200\.00/) }),
        ]);
    });
});
describe('réévaluation · à la date de clôture seulement', () => {
    function monterD1(reevaluations = []) {
        const prisma = {
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: 'OUVERT' }) },
            reevaluation: { findMany: jest.fn().mockResolvedValue(reevaluations), findFirst: jest.fn().mockResolvedValue(null) },
        };
        return new devises_service_1.DevisesService(prisma, {});
    }
    it('une date autre que la fin de l’exercice · 400 nommé, simulation comprise, avant tout calcul', async () => {
        await expect(monterD1().reevaluer('t1', 'u1', { exerciceId: 'ex1', dateReevaluation: '2026-09-30' })).rejects.toThrow(/se fait à la date de CLÔTURE, le 2026-12-31 · le 2026-09-30 n'en est pas une.*art\. 54/);
        await expect(monterD1().reevaluer('t1', 'u1', { exerciceId: 'ex1', dateReevaluation: '2026-09-30', simulation: true })).rejects.toThrow(/date de CLÔTURE/);
    });
    it('la règle pure · la fin de l’exercice passe, au jour près', () => {
        expect((0, perimetre_reevaluation_1.motifDateReevaluation)('2026-12-31', new Date('2026-12-31'))).toBeNull();
        expect((0, perimetre_reevaluation_1.motifDateReevaluation)('2026-12-30', new Date('2026-12-31'))).toMatch(/CLÔTURE/);
    });
    it('une réévaluation déjà passée à une autre date n’est pas retouchée · elle est SIGNALÉE', async () => {
        const r = await monterD1([
            { id: 'a', dateReevaluation: new Date('2026-09-30') },
            { id: 'b', dateReevaluation: new Date('2026-12-31') },
        ]).listerReevaluations('t1', 'ex1');
        expect(r.find((x) => x.id === 'a')?.horsCloture).toMatch(/CLÔTURE/);
        expect(r.find((x) => x.id === 'b')?.horsCloture).toBeNull();
    });
});
//# sourceMappingURL=perimetre-reevaluation.spec.js.map