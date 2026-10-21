"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const exercice_service_1 = require("../exercice/exercice.service");
const ecarts_non_constates_1 = require("./ecarts-non-constates");
let n = 0;
const ligne = (lettrageId, code, numero, debit, credit, montantDevise, ecriture = { exerciceId: 'n', date: new Date('2026-06-30') }) => ({
    id: `l${String(++n).padStart(4, '0')}`,
    lettrageId,
    debit,
    credit,
    deviseId: montantDevise === null ? null : 'usd',
    montantDevise,
    ecriture,
    lettrage: { code, compte: { numero } },
});
const groupeEnSouffrance = [
    ligne('L', 'A', '40110000', 0, 1_948_800, 1160),
    ligne('L', 'A', '40110000', 1_008_000, 0, 600),
    ligne('L', 'A', '40110000', 1_064_000, 0, 560),
];
const partielOuvert = [ligne('M', 'B', '41110000', 1_948_800, 0, 1160), ligne('M', 'B', '41110000', 0, 1_050_000, 600)];
describe('les écarts de change réalisés non constatés d’un exercice', () => {
    it('le groupe soldé en devise et non en francs est nommé · le partiel encore ouvert ne l’est pas', async () => {
        const findMany = jest.fn().mockResolvedValueOnce([...groupeEnSouffrance, ...partielOuvert]).mockResolvedValue([]);
        const r = await (0, ecarts_non_constates_1.ecartsRealisesNonConstates)({ ligneEcriture: { findMany } }, { tenantId: 't', exerciceId: 'n' });
        expect(r).toEqual({
            ecarts: [{ lettrageId: 'L', code: 'a', compteNumero: '40110000', ecart: 123_200, aCheval: false, denouement: new Date('2026-06-30') }],
        });
        expect(findMany.mock.calls[0][0].where).toEqual({
            lettrageId: { not: null },
            lettre: null,
            lettrage: { statut: 'PARTIEL', lignes: { some: { ecriture: { tenantId: 't', exerciceId: 'n' } } } },
            ecriture: { tenantId: 't' },
        });
        expect(findMany.mock.calls[0][0].take).toBeGreaterThan(0);
    });
    it('par tranches · un groupe coupé entre deux tranches se recompose, le curseur avance', async () => {
        const [a, b, c] = groupeEnSouffrance;
        const findMany = jest
            .fn()
            .mockImplementationOnce(async ({ take }) => [a, ...Array.from({ length: take - 1 }, (_, i) => ligne(`X${i}`, 'Z', '40110000', 0, 1, null))])
            .mockResolvedValueOnce([b, c])
            .mockResolvedValue([]);
        const r = await (0, ecarts_non_constates_1.ecartsRealisesNonConstates)({ ligneEcriture: { findMany } }, { tenantId: 't', exerciceId: 'n' });
        expect(r.ecarts).toEqual([
            { lettrageId: 'L', code: 'a', compteNumero: '40110000', ecart: 123_200, aCheval: false, denouement: new Date('2026-06-30') },
        ]);
        expect(findMany).toHaveBeenCalledTimes(2);
        expect(findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: expect.any(String) }, skip: 1 });
    });
    describe('le groupe à cheval de deux exercices', () => {
        const N = { exerciceId: 'n', date: new Date('2026-11-15') };
        const N1 = { exerciceId: 'n1', date: new Date('2027-02-10') };
        const table = [
            { ...ligne('C', 'C', '41110000', 2_800_000, 0, 1000, N), statut: 'PARTIEL', tenantId: 't' },
            { ...ligne('C', 'C', '41110000', 0, 2_750_000, 1000, N1), statut: 'PARTIEL', tenantId: 't' },
            { ...ligne('Z', 'Z', '41110000', 1_000, 0, 1, N1), statut: 'PARTIEL', tenantId: 'autre' },
        ];
        const honore = (where) => table.filter((l) => l.tenantId === where.ecriture.tenantId &&
            (where.ecriture.exerciceId === undefined || l.ecriture.exerciceId === where.ecriture.exerciceId) &&
            l.statut === where.lettrage.statut &&
            table.some((m) => m.lettrageId === l.lettrageId &&
                m.tenantId === where.lettrage.lignes.some.ecriture.tenantId &&
                m.ecriture.exerciceId === where.lettrage.lignes.some.ecriture.exerciceId));
        const prisma = () => {
            let rendu = false;
            return {
                ligneEcriture: {
                    findMany: jest.fn().mockImplementation(async ({ where }) => {
                        if (rendu)
                            return [];
                        rendu = true;
                        return honore(where);
                    }),
                },
            };
        };
        it('dénoué en N+1 · compté à la clôture de N+1, avec son dénouement', async () => {
            const r = await (0, ecarts_non_constates_1.ecartsRealisesNonConstates)(prisma(), { tenantId: 't', exerciceId: 'n1' });
            expect(r.ecarts).toEqual([
                { lettrageId: 'C', code: 'c', compteNumero: '41110000', ecart: 50_000, aCheval: true, denouement: new Date('2027-02-10') },
            ]);
            const motif = (0, ecarts_non_constates_1.motifClotureEcartsNonConstates)(r);
            expect(motif).toContain('41110000 lettrage c · perte de 50 000,00, à cheval de deux exercices, dénoué le 2027-02-10');
            expect(motif).toContain('reçoit son écart même figé');
            expect(motif).toContain('AUDCIF art. 22, 4°');
            expect(motif).toContain('Ne délettrez pas le groupe');
        });
        it('non compté à la clôture de N · son dénouement est dans N+1', async () => {
            const r = await (0, ecarts_non_constates_1.ecartsRealisesNonConstates)(prisma(), { tenantId: 't', exerciceId: 'n' });
            expect(r.ecarts).toEqual([]);
        });
    });
    it('le refus nomme le compte, le groupe, le montant, l’article et l’issue', () => {
        const motif = (0, ecarts_non_constates_1.motifClotureEcartsNonConstates)({ ecarts: [{ lettrageId: 'L', code: 'a', compteNumero: '40110000', ecart: 123_200 }] });
        expect(motif).toMatch(/1 lettrage\(s\) dénoué\(s\).*40110000 lettrage a · perte de 123 200,00.*art\. 55.*« Écart de change »/);
        expect(motif).toMatch(/UNE seule issue/);
        expect(motif).toMatch(/DÉJÀ été passé à la main, lettrez sa ligne du tiers dans ce groupe, sans le repasser/);
        expect(motif).toContain("si le geste est refusé (réévaluation qui a lu le groupe, cours corrigé), suivez le motif du refus : annulez la réévaluation, passez l'écart, puis réévaluez. Ne délettrez pas le groupe, sans quoi l'écart ne serait plus constaté.");
        expect(motif).not.toMatch(/à cheval/);
        expect((0, ecarts_non_constates_1.motifClotureEcartsNonConstates)({ ecarts: [] })).toBeNull();
    });
});
describe('la clôture refuse un écart réalisé non passé', () => {
    const N = { id: 'n', tenantId: 't', statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
    function monter(lignes) {
        const prisma = {
            exercice: {
                findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.dateFin || where.dateDebut ? null : N)),
            },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
            ecriture: { count: jest.fn().mockResolvedValue(0) },
            ligneEcriture: { findMany: jest.fn().mockResolvedValueOnce(lignes).mockResolvedValue([]) },
            $transaction: jest.fn(),
        };
        return { s: new exercice_service_1.ExerciceService(prisma, {}), prisma };
    }
    it('un lettrage dénoué en souffrance · refus nommé, rien n’est écrit', async () => {
        const { s, prisma } = monter(groupeEnSouffrance);
        await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/40110000 lettrage a · perte de 123 200,00/);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=ecarts-non-constates.spec.js.map