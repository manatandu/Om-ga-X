"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const recherche_ecritures_1 = require("./recherche-ecritures");
const ecriture_service_1 = require("./ecriture.service");
describe("Recherche d'écritures multicritère", () => {
    it('cherche le compte et le montant sur la MÊME ligne, un seul `some`', () => {
        const f = (0, recherche_ecritures_1.filtreRecherche)({ compte: '401', montantMin: 116000 });
        expect(f.AND).toHaveLength(1);
        expect(f.AND[0].lignes.some.compte).toEqual({ numero: { startsWith: '401' } });
        expect(f.AND[0].lignes.some.OR).toEqual([
            { debit: { gte: 116000, lte: 116000 } },
            { credit: { gte: 116000, lte: 116000 } },
        ]);
    });
    it('un montant seul est EXACT, au débit ou au crédit ; une borne haute en fait une fourchette', () => {
        const exact = (0, recherche_ecritures_1.filtreRecherche)({ montantMin: 500 });
        expect(exact.AND[0].lignes.some.OR[0].debit).toEqual({ gte: 500, lte: 500 });
        const plage = (0, recherche_ecritures_1.filtreRecherche)({ montantMin: 500, montantMax: 900 });
        expect(plage.AND[0].lignes.some.OR[1].credit).toEqual({ gte: 500, lte: 900 });
    });
    it("cherche le libellé de l'écriture ET de ses lignes, la pièce et la référence", () => {
        const f = (0, recherche_ecritures_1.filtreRecherche)({ recherche: 'loyer', numeroPiece: 12, reference: 'FA-1' });
        expect(f.AND[0].OR[1]).toEqual({ lignes: { some: { libelle: { contains: 'loyer', mode: 'insensitive' } } } });
        expect(f.AND).toContainEqual({ numeroPiece: 12 });
        expect(f.AND).toContainEqual({ reference: { contains: 'FA-1', mode: 'insensitive' } });
        expect((0, recherche_ecritures_1.filtreRecherche)({})).toEqual({});
    });
    it('refuse un critère illisible au lieu de l’ignorer', () => {
        expect((0, recherche_ecritures_1.lireCriteres)({ compte: '401A' })).toEqual({ motif: expect.stringMatching(/chiffres/) });
        expect((0, recherche_ecritures_1.lireCriteres)({ montant: 'abc' })).toEqual({ motif: 'Montant illisible.' });
        expect((0, recherche_ecritures_1.lireCriteres)({ montantMax: '10' })).toEqual({ motif: expect.stringMatching(/commence par le montant minimal/) });
        expect((0, recherche_ecritures_1.lireCriteres)({ montant: '10', montantMax: '5' })).toEqual({ motif: expect.stringMatching(/inférieur/) });
        expect((0, recherche_ecritures_1.lireCriteres)({ numeroPiece: '1.5' })).toEqual({ motif: expect.stringMatching(/entier positif/) });
        expect((0, recherche_ecritures_1.lireCriteres)({ compte: ' 401 ', montant: '116 000,50' })).toEqual({
            criteres: { compte: '401', montantMin: 116000.5 },
        });
    });
    it('le périmètre du journal porte les critères, pour la fenêtre comme pour son export', () => {
        const w = (0, ecriture_service_1.perimetreJournal)('t1', { exerciceId: 'e1', compte: '52' });
        expect(w.tenantId).toBe('t1');
        expect(w.AND[0].lignes.some.compte).toEqual({ numero: { startsWith: '52' } });
        const racine = (0, path_1.join)(__dirname, '..');
        expect((0, fs_1.readFileSync)((0, path_1.join)(racine, 'comptabilite', 'ecriture.controller.ts'), 'utf8')).toMatch(/criteresOuRefus\(\{ compte, montant, montantMax, numeroPiece, reference \}\)/);
        expect((0, fs_1.readFileSync)((0, path_1.join)(racine, 'exports', 'export.controller.ts'), 'utf8')).toMatch(/criteresOuRefus\(\{ compte, montant, montantMax, numeroPiece, reference \}\)/);
    });
});
//# sourceMappingURL=recherche-ecritures.spec.js.map