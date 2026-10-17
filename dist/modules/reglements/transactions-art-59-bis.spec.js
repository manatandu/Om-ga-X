"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reports = require("../relances/date-origine-des-reports");
const transactions_art_59_bis_1 = require("./transactions-art-59-bis");
const ecriture = (x = {}) => ({ date: new Date('2026-12-10'), numeroPiece: 7, libelle: 'Facture', ...x });
const ligne = (id, ecritureId, credit, e = ecriture(), dateEcheance = null) => ({
    id,
    ecritureId,
    compteId: 'c401',
    debit: 0,
    credit,
    libelle: 'Facture',
    dateEcheance,
    compte: { numero: '40110001' },
    ecriture: e,
});
function doublure(lignesDeLaBase) {
    return {
        exercice: { findFirst: jest.fn(async () => ({ dateDebut: new Date('2027-01-01') })) },
        ligneEcriture: {
            findMany: jest.fn(async ({ where }) => lignesDeLaBase.filter((l) => where.id.in.includes(l.id))),
            groupBy: jest.fn(async ({ where }) => {
                const parCle = new Map();
                for (const l of lignesDeLaBase.filter((x) => where.ecritureId.in.includes(x.ecritureId))) {
                    const cle = `${l.ecritureId}:${l.compteId}`;
                    const g = parCle.get(cle) ?? { ecritureId: l.ecritureId, compteId: l.compteId, _sum: { debit: 0, credit: 0 } };
                    g._sum.debit += l.debit;
                    g._sum.credit += l.credit;
                    parCle.set(cle, g);
                }
                return [...parCle.values()];
            }),
        },
    };
}
afterEach(() => jest.restoreAllMocks());
describe('la transaction d’une ligne réglée', () => {
    it('deux échéances d’une même facture · la pièce entière, une seule clé', async () => {
        const base = [
            { id: 'a', ecritureId: 'eF', compteId: 'c401', debit: 0, credit: 580_000, ecriture: {} },
            { id: 'b', ecritureId: 'eF', compteId: 'c401', debit: 0, credit: 580_000, ecriture: {} },
            { id: 'x', ecritureId: 'eF', compteId: 'c601', debit: 1_160_000, credit: 0, ecriture: {} },
        ];
        const r = await (0, transactions_art_59_bis_1.transactionsDesLignes)(doublure(base), {
            tenantId: 't',
            exerciceId: 'N',
            lignes: [ligne('a', 'eF', 580_000), ligne('b', 'eF', 580_000)],
        });
        expect(r.get('a')).toEqual({ cle: 'eF:c401', reference: 'pièce 7', ligne: 580_000, piece: 1_160_000, origineRetrouvee: true });
        expect(r.get('b')?.cle).toBe('eF:c401');
    });
    it('une ligne d’à-nouveau · lue sur SA pièce d’origine en N', async () => {
        const report = ecriture({ date: new Date('2027-01-01'), numeroPiece: 1, libelle: 'À-nouveaux', estGenereeParCloture: true, estSoldeDesComptesDeGestion: false });
        jest.spyOn(reports, 'originesDesReports').mockResolvedValue({ origines: new Map([['an1', { id: 'o1', date: new Date('2026-12-10') }]]), introuvables: [] });
        const base = [
            { id: 'o1', ecritureId: 'eN', compteId: 'c401', debit: 0, credit: 580_000, ecriture: { numeroPiece: 12, libelle: 'Facture N' } },
            { id: 'o2', ecritureId: 'eN', compteId: 'c401', debit: 0, credit: 580_000, ecriture: { numeroPiece: 12, libelle: 'Facture N' } },
        ];
        const r = await (0, transactions_art_59_bis_1.transactionsDesLignes)(doublure(base), {
            tenantId: 't',
            exerciceId: 'N1',
            lignes: [ligne('an1', 'eAN', 580_000, report, new Date('2027-02-08'))],
        });
        expect(r.get('an1')).toEqual({ cle: 'eN:c401', reference: 'pièce 12', ligne: 580_000, piece: 1_160_000, origineRetrouvee: true });
    });
    it('une ligne d’à-nouveau sans origine retrouvée · NON JUGÉE, aucune transaction affirmée', async () => {
        const report = ecriture({ numeroPiece: 1, estGenereeParCloture: true });
        jest.spyOn(reports, 'originesDesReports').mockResolvedValue({ origines: new Map(), introuvables: ['an1'] });
        const r = await (0, transactions_art_59_bis_1.transactionsDesLignes)(doublure([]), {
            tenantId: 't',
            exerciceId: 'N1',
            lignes: [ligne('an1', 'eAN', 3_000_000, report)],
        });
        expect(r.get('an1')).toEqual({ cle: 'an1', reference: 'pièce 1', ligne: 3_000_000, piece: 3_000_000, origineRetrouvee: false });
        expect((0, transactions_art_59_bis_1.classerTransactions)(r.values(), 1_000_000)).toEqual({
            jugees: [],
            sousCondition: [],
            nonJugees: [{ reference: 'pièce 1', montant: 3_000_000 }],
        });
    });
    it('une origine qui est elle-même un à-nouveau (bilan d’ouverture du premier exercice) · non jugée aussi', async () => {
        const report = ecriture({ numeroPiece: 1, estGenereeParCloture: true });
        jest.spyOn(reports, 'originesDesReports').mockResolvedValue({ origines: new Map([['an1', { id: 'o1', date: new Date('2026-01-01') }]]), introuvables: [] });
        const base = [
            { id: 'o1', ecritureId: 'eBO', compteId: 'c401', debit: 0, credit: 3_000_000, ecriture: { numeroPiece: 1, libelle: 'Bilan d’ouverture', estGenereeParCloture: true } },
        ];
        const r = await (0, transactions_art_59_bis_1.transactionsDesLignes)(doublure(base), {
            tenantId: 't',
            exerciceId: 'N1',
            lignes: [ligne('an1', 'eAN', 3_000_000, report)],
        });
        expect(r.get('an1')?.origineRetrouvee).toBe(false);
    });
    it('la facture se lit dans SON sens · un avoir passé dans la même pièce ne la réduit pas', async () => {
        const base = [
            { id: 'a', ecritureId: 'eF', compteId: 'c401', debit: 0, credit: 1_200_000, ecriture: {} },
            { id: 'av', ecritureId: 'eF', compteId: 'c401', debit: 300_000, credit: 0, ecriture: {} },
        ];
        const r = await (0, transactions_art_59_bis_1.transactionsDesLignes)(doublure(base), { tenantId: 't', exerciceId: 'N', lignes: [ligne('a', 'eF', 1_200_000)] });
        expect(r.get('a')).toEqual(expect.objectContaining({ ligne: 1_200_000, piece: 1_200_000 }));
    });
});
describe('le classement des transactions d’un règlement (M3)', () => {
    const t = (cle, ligne, piece, origineRetrouvee = true) => ({ cle, reference: `pièce ${cle}`, ligne, piece, origineRetrouvee });
    it('la ligne au seuil est jugée seule ; sous le seuil, la pièce ne compte que SOUS CONDITION', () => {
        const c = (0, transactions_art_59_bis_1.classerTransactions)([t('7', 1_500_000, 1_500_000), t('8', 600_000, 1_200_000), t('9', 400_000, 400_000)], 1_000_000);
        expect(c.jugees).toEqual([
            { reference: 'pièce 7', montant: 1_500_000 },
            { reference: 'pièce 9', montant: 400_000 },
        ]);
        expect(c.sousCondition).toEqual([{ reference: 'pièce 8', montant: 1_200_000 }]);
        expect(c.nonJugees).toEqual([]);
    });
    it('deux échéances d’une même pièce · une seule clé, nommée une fois', () => {
        const c = (0, transactions_art_59_bis_1.classerTransactions)([t('8', 600_000, 1_200_000), t('8', 600_000, 1_200_000)], 1_000_000);
        expect(c.sousCondition).toHaveLength(1);
    });
    it('une échéance au seuil l’emporte sur la condition de sa pièce', () => {
        const c = (0, transactions_art_59_bis_1.classerTransactions)([t('8', 1_100_000, 1_500_000), t('8', 400_000, 1_500_000)], 1_000_000);
        expect(c.jugees).toEqual([{ reference: 'pièce 8', montant: 1_100_000 }]);
        expect(c.sousCondition).toEqual([]);
    });
});
//# sourceMappingURL=transactions-art-59-bis.spec.js.map