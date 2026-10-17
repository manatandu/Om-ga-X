"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const contexte_audit_1 = require("./contexte-audit");
const transaction_journalisee_1 = require("./transaction-journalisee");
const RACINE = (0, path_1.join)(__dirname, '..', '..');
function sources(dossier) {
    return (0, fs_1.readdirSync)(dossier).flatMap((nom) => {
        const chemin = (0, path_1.join)(dossier, nom);
        if ((0, fs_1.statSync)(chemin).isDirectory())
            return sources(chemin);
        return nom.endsWith('.ts') && !nom.endsWith('.spec.ts') ? [chemin] : [];
    });
}
function sansCommentaires(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}
const EXCEPTIONS = new Set(['common/audit/transaction-journalisee.ts', 'common/audit/extension-audit.ts']);
describe('F159 · une seule porte pour une transaction', () => {
    const fichiers = sources(RACINE);
    it('le recensement trouve encore des transactions · un garde-fou qui ne trouve rien ne vérifie rien', () => {
        const appelants = fichiers.filter((f) => /transactionJournalisee\(/.test(sansCommentaires((0, fs_1.readFileSync)(f, 'utf8'))));
        expect(appelants.length).toBeGreaterThan(15);
    });
    it('aucun fichier du serveur n’ouvre une transaction ailleurs que par transactionJournalisee', () => {
        const fautifs = fichiers
            .map((f) => (0, path_1.relative)(RACINE, f).split('\\').join('/'))
            .filter((r) => !EXCEPTIONS.has(r))
            .filter((r) => /\.\$transaction\s*\(/.test(sansCommentaires((0, fs_1.readFileSync)((0, path_1.join)(RACINE, r), 'utf8'))));
        expect(fautifs).toEqual([]);
    });
    it('la transaction ouverte est celle que le journal d’audit voit', async () => {
        const tx = { marque: 'tx' };
        let vue;
        const prisma = { $transaction: jest.fn(async (fn) => fn(tx)) };
        const rendu = await (0, transaction_journalisee_1.transactionJournalisee)(prisma, async (recu) => {
            vue = (0, contexte_audit_1.transactionAuditee)();
            return recu;
        });
        expect(vue).toBe(tx);
        expect(rendu).toBe(tx);
        expect((0, contexte_audit_1.transactionAuditee)()).toBeUndefined();
    });
    it('les options passent telles quelles, et leur absence ne passe pas un second argument', async () => {
        const prisma = { $transaction: jest.fn(async (fn, _options) => fn({})) };
        await (0, transaction_journalisee_1.transactionJournalisee)(prisma, async () => 1, { maxWait: 10_000, timeout: 30_000 });
        await (0, transaction_journalisee_1.transactionJournalisee)(prisma, async () => 2);
        expect(prisma.$transaction.mock.calls[0][1]).toEqual({ maxWait: 10_000, timeout: 30_000 });
        expect(prisma.$transaction.mock.calls[1]).toHaveLength(1);
    });
    it('le retrait des commentaires ne retire pas le code', () => {
        expect(sansCommentaires("await this.prisma.$transaction([a]); // $transaction(")).toContain('this.prisma.$transaction([a]);');
        expect(sansCommentaires('/* this.prisma.$transaction( */ x')).not.toContain('$transaction');
        expect(sansCommentaires("const u = 'https://exemple.cd'; this.prisma.$transaction(f)")).toContain('$transaction(f)');
    });
});
//# sourceMappingURL=transaction-journalisee.spec.js.map