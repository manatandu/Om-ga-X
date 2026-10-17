"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fichier_en_memoire_1 = require("./fichier-en-memoire");
describe('produireEnMemoire · tout ou rien', () => {
    it('rend le fichier écrit et fermé par le moteur, sous le nom qu’il a donné', async () => {
        const r = await (0, fichier_en_memoire_1.produireEnMemoire)(async (ouvrir) => {
            const s = ouvrir('livre.xlsx');
            s.write(Buffer.from('abc'));
            s.end(Buffer.from('def'));
        });
        expect(r).toEqual({ nomFichier: 'livre.xlsx', contenu: Buffer.from('abcdef') });
    });
    it('un moteur qui rend la main sans fermer son fichier est une PANNE, jamais une archive rangée (m1)', async () => {
        await expect((0, fichier_en_memoire_1.produireEnMemoire)(async (ouvrir) => {
            ouvrir('livre.xlsx').write(Buffer.from('moitié de classeur'));
        })).rejects.toThrow(/sans terminer son fichier · rien n'est rangé/);
    });
    it('un tuyau en erreur et un moteur qui lève · l’erreur du moteur remonte, aucun rejet non traité (m2)', async () => {
        const rejets = [];
        const ecouter = (r) => rejets.push(r);
        process.on('unhandledRejection', ecouter);
        try {
            await expect((0, fichier_en_memoire_1.produireEnMemoire)(async (ouvrir) => {
                const s = ouvrir('livre.xlsx');
                s.destroy(new Error('tuyau rompu'));
                throw new Error('moteur tombé');
            })).rejects.toThrow('moteur tombé');
            await new Promise((r) => setTimeout(r, 20));
            expect(rejets).toEqual([]);
        }
        finally {
            process.off('unhandledRejection', ecouter);
        }
    });
    it('un tuyau qui tombe PENDANT que le moteur écrit encore ne laisse aucun rejet non traité (mineur 2)', async () => {
        const rejets = [];
        const ecouter = (r) => rejets.push(r);
        process.on('unhandledRejection', ecouter);
        try {
            await expect((0, fichier_en_memoire_1.produireEnMemoire)(async (ouvrir) => {
                ouvrir('livre.xlsx').destroy(new Error('tuyau rompu'));
                await new Promise((r) => setTimeout(r, 30));
                throw new Error('moteur tombé');
            })).rejects.toThrow('moteur tombé');
            await new Promise((r) => setTimeout(r, 20));
            expect(rejets).toEqual([]);
        }
        finally {
            process.off('unhandledRejection', ecouter);
        }
    });
    it('un tuyau en erreur et un moteur qui rend la main · la panne du tuyau remonte, jamais un fichier rangé', async () => {
        await expect((0, fichier_en_memoire_1.produireEnMemoire)(async (ouvrir) => {
            const s = ouvrir('livre.xlsx');
            s.end(Buffer.from('abc'));
            s.destroy(new Error('tuyau rompu'));
            await new Promise((r) => setTimeout(r, 10));
        })).rejects.toThrow(/tuyau rompu|sans terminer son fichier/);
    });
    it('un moteur qui n’ouvre aucun fichier n’a rien produit', async () => {
        await expect((0, fichier_en_memoire_1.produireEnMemoire)(async () => undefined)).rejects.toThrow(/sans terminer son fichier|aucun fichier/);
    });
});
//# sourceMappingURL=fichier-en-memoire.spec.js.map