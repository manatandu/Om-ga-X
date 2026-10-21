"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma_retry_util_1 = require("./prisma-retry.util");
const contexte_audit_1 = require("./audit/contexte-audit");
const extension_audit_1 = require("./audit/extension-audit");
describe('transaction sérialisable et journal d’audit', () => {
    it('le corps de l’acte voit SA transaction comme celle du journal', async () => {
        const tx = { marque: 'tx-1' };
        const prisma = { $transaction: jest.fn(async (f) => f(tx)) };
        let vue;
        await (0, prisma_retry_util_1.avecRetrySerialisable)(prisma, async () => {
            vue = (0, contexte_audit_1.transactionAuditee)();
            return null;
        }, 'conflit');
        expect(vue).toBe(tx);
    });
    it('chaque reprise après conflit voit sa propre transaction, pas la précédente', async () => {
        const vues = [];
        let n = 0;
        const prisma = {
            $transaction: jest.fn(async (f) => {
                n += 1;
                const tx = { tentative: n };
                const r = await f(tx);
                if (n === 1)
                    throw new client_1.Prisma.PrismaClientKnownRequestError('conflit', { code: 'P2034', clientVersion: 'x' });
                return r;
            }),
        };
        await (0, prisma_retry_util_1.avecRetrySerialisable)(prisma, async () => {
            vues.push((0, contexte_audit_1.transactionAuditee)());
            return null;
        }, 'conflit');
        expect(vues).toEqual([{ tentative: 1 }, { tentative: 2 }]);
    });
    it('hors de la transaction, rien n’est déclaré', async () => {
        const prisma = { $transaction: jest.fn(async (f) => f({})) };
        await (0, prisma_retry_util_1.avecRetrySerialisable)(prisma, async () => null, 'conflit');
        expect((0, contexte_audit_1.transactionAuditee)()).toBeUndefined();
    });
    it('un conflit de sérialisation du MAILLON (40001 en requête brute, enveloppé) est rejoué, pas rendu en 500', async () => {
        let n = 0;
        const prisma = {
            $transaction: jest.fn(async (f) => {
                n += 1;
                if (n === 1) {
                    const brut = new client_1.Prisma.PrismaClientKnownRequestError('could not serialize access', {
                        code: 'P2010',
                        clientVersion: 'x',
                        meta: { code: '40001' },
                    });
                    throw new extension_audit_1.ErreurMaillonDansTransaction('Ecriture', 'create', brut);
                }
                return f({});
            }),
        };
        await expect((0, prisma_retry_util_1.avecRetrySerialisable)(prisma, async () => 'ok', 'conflit')).resolves.toBe('ok');
        expect(n).toBe(2);
    });
    it('une autre erreur brute n’est pas prise pour un conflit', () => {
        const autre = new client_1.Prisma.PrismaClientKnownRequestError('x', { code: 'P2010', clientVersion: 'x', meta: { code: '23505' } });
        expect((0, prisma_retry_util_1.estConflitDeSerialisation)(Object.assign(new Error('e'), { cause: autre }))).toBe(false);
    });
});
//# sourceMappingURL=prisma-retry-audit.spec.js.map