"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("./ecriture.service");
function service(clotures = []) {
    const prisma = {
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                statut: client_1.StatutExercice.OUVERT,
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
        },
        compte: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id.in.map((id) => ({ id, numero: id, typeCompte: client_1.TypeCompteDetailTotal.DETAIL })))),
        },
    };
    const journal = { trouver: jest.fn().mockResolvedValue({ id: 'j', code: 'OD', estActif: true }) };
    const exercice = {
        cloturesApplicables: jest.fn().mockResolvedValue(clotures),
        verifierEcritureAutorisee: jest.fn(),
    };
    const s = new ecriture_service_1.EcritureService(prisma, journal, exercice, {});
    return { s, prisma, journal, exercice };
}
const piece = (jour, a, b) => ({
    exerciceId: 'ex',
    journalId: 'j',
    date: new Date(`2026-${jour}`),
    lignes: [
        { compteId: a, debit: 100, credit: 0 },
        { compteId: b, debit: 0, credit: 100 },
    ],
    exigerVentilationObligatoire: false,
});
describe('Contrôles d’entrée · la mémoire d’un lot', () => {
    it('lit une fois exercice, journal et clôtures, et seulement les comptes jamais vus', async () => {
        const { s, prisma, journal, exercice } = service();
        const memoire = new Map();
        await s.controlesDEntree('t', piece('03-10', 'c601', 'c401'), undefined, memoire);
        await s.controlesDEntree('t', piece('03-11', 'c601', 'c401'), undefined, memoire);
        await s.controlesDEntree('t', piece('03-12', 'c601', 'c521'), undefined, memoire);
        expect({
            exercices: prisma.exercice.findFirst.mock.calls.length,
            journaux: journal.trouver.mock.calls.length,
            clotures: exercice.cloturesApplicables.mock.calls.length,
            comptes: prisma.compte.findMany.mock.calls.map((c) => c[0].where.id.in),
        }).toEqual({ exercices: 1, journaux: 1, clotures: 1, comptes: [['c601', 'c401'], ['c521']] });
    });
    it('refuse, avec la mémoire, la pièce datée d’une période close, comme à l’unité', async () => {
        const { s } = service([{ granularite: client_1.GranulariteCloture.PERIODE, journalId: null, dateLimite: new Date('2026-03-31') }]);
        const memoire = new Map();
        await expect(s.controlesDEntree('t', piece('03-10', 'c601', 'c401'), undefined, memoire)).rejects.toThrow(/clôturée/);
        await expect(s.controlesDEntree('t', piece('04-02', 'c601', 'c401'), undefined, memoire)).resolves.toBeDefined();
    });
    it('refuse, avec la mémoire, un compte d’un autre dossier que le lot a déjà cherché', async () => {
        const { s, prisma } = service();
        prisma.compte.findMany.mockResolvedValue([{ id: 'c601', numero: 'c601', typeCompte: client_1.TypeCompteDetailTotal.DETAIL }]);
        const memoire = new Map();
        await expect(s.controlesDEntree('t', piece('03-10', 'c601', 'etranger'), undefined, memoire)).rejects.toThrow(/introuvables/);
        await expect(s.controlesDEntree('t', piece('03-11', 'c601', 'etranger'), undefined, memoire)).rejects.toThrow(/introuvables/);
    });
});
//# sourceMappingURL=controles-entree-memoire.spec.js.map