"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const import_service_1 = require("./import.service");
const import_dto_1 = require("./dto/import.dto");
const PIECES = 300;
function service() {
    const tx = {
        ecriture: {
            aggregate: jest.fn().mockImplementation(({ where }) => Promise.resolve({ _max: { numeroPiece: where.journalId === 'j-ach' ? 10 : 4 } })),
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        ligneEcriture: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't', longueurCompte: 8, referentiel: 'SYSCOHADA' }) },
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                statut: 'OUVERT',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
        },
        journal: {
            findMany: jest.fn().mockResolvedValue([
                { id: 'j-od', code: 'OD', type: 'GENERAL', numerotation: client_1.NumerotationPiece.CONTINUE_FICHIER },
                { id: 'j-ach', code: 'ACH', type: 'ACHATS', numerotation: client_1.NumerotationPiece.CONTINUE_JOURNAL },
            ]),
        },
        compte: {
            findMany: jest.fn().mockResolvedValue([
                { id: 'c601', numero: '60110000', typeCompte: 'DETAIL' },
                { id: 'c401', numero: '40110000', typeCompte: 'DETAIL' },
            ]),
        },
        $transaction: jest.fn().mockImplementation((f) => f(tx)),
    };
    const ecritureService = { controlesDEntree: jest.fn().mockResolvedValue({}) };
    return { svc: new import_service_1.ImportService(prisma, ecritureService), tx, prisma };
}
function fichier() {
    const lignes = ['Date;Journal;Piece;Compte;Libelle;Debit;Credit'];
    for (let i = 1; i <= PIECES; i++) {
        const journal = i % 3 === 0 ? 'ACH' : 'OD';
        lignes.push(`2026-03-15;${journal};P${i};60110000;Pièce ${i};${i}00;0`);
        lignes.push(`2026-03-15;${journal};P${i};40110000;Pièce ${i};0;${i}00`);
    }
    return Buffer.from(lignes.join('\n'), 'utf8').toString('base64');
}
const MAPPING = {
    date: 'Date',
    journal: 'Journal',
    piece: 'Piece',
    numero: 'Compte',
    libelle: 'Libelle',
    debit: 'Debit',
    credit: 'Credit',
};
describe('Import d’écritures · insertions groupées', () => {
    it('lit le maximum UNE fois par série, et numérote la suite sans trou', async () => {
        const { svc, tx } = service();
        const r = await svc.executer('t', 'u', {
            type: import_dto_1.TypeImport.ECRITURES,
            nomFichier: 'journal.csv',
            contenuBase64: fichier(),
            mapping: MAPPING,
        });
        const tetes = tx.ecriture.createMany.mock.calls.flatMap((c) => c[0].data);
        const numeros = (journal) => tetes.filter((t) => t.journalId === journal).map((t) => t.numeroPiece);
        expect({
            lectures: tx.ecriture.aggregate.mock.calls.length,
            creees: r.ecrituresCreees,
            od: numeros('j-od').slice(0, 3),
            ach: numeros('j-ach').slice(0, 3),
            odContinu: numeros('j-od').every((n, i, t) => i === 0 || n === t[i - 1] + 1),
        }).toEqual({ lectures: 2, creees: PIECES, od: [5, 6, 7], ach: [11, 12, 13], odContinu: true });
    });
    it('insère têtes et lignes en tranches, rattache chaque ligne à sa tête, et pose un délai', async () => {
        const { svc, tx, prisma } = service();
        await svc.executer('t', 'u', {
            type: import_dto_1.TypeImport.ECRITURES,
            nomFichier: 'journal.csv',
            contenuBase64: fichier(),
            mapping: MAPPING,
        });
        const ids = new Set(tx.ecriture.createMany.mock.calls.flatMap((c) => c[0].data.map((t) => t.id)));
        const lignes = tx.ligneEcriture.createMany.mock.calls.flatMap((c) => c[0].data);
        const options = prisma.$transaction.mock.calls[0][1];
        expect({
            appelsTetes: tx.ecriture.createMany.mock.calls.length,
            appelsLignes: tx.ligneEcriture.createMany.mock.calls.length,
            lignes: lignes.length,
            rattachees: lignes.every((l) => ids.has(l.ecritureId)),
            delai: options?.timeout > 5_000,
        }).toEqual({ appelsTetes: 1, appelsLignes: 1, lignes: PIECES * 2, rattachees: true, delai: true });
    });
});
//# sourceMappingURL=import-ecritures-groupe.spec.js.map