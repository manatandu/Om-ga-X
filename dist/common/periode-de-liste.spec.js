"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const periode_de_liste_1 = require("./periode-de-liste");
describe('lirePeriodeDeListe', () => {
    it('sans période, aucune borne · la liste reste celle du dossier entier', () => {
        expect((0, periode_de_liste_1.lirePeriodeDeListe)({})).toEqual({ du: null, au: null, bornes: undefined });
        expect((0, periode_de_liste_1.lirePeriodeDeListe)()).toEqual({ du: null, au: null, bornes: undefined });
    });
    it('une chaîne vide vaut absence de borne · un champ effacé n’est pas une date', () => {
        expect((0, periode_de_liste_1.lirePeriodeDeListe)({ du: '', au: '' }).bornes).toBeUndefined();
    });
    it('les deux jours sont compris · la borne haute est exclue au LENDEMAIN de « au »', () => {
        const p = (0, periode_de_liste_1.lirePeriodeDeListe)({ du: '2026-01-01', au: '2026-12-31' });
        expect(p.du).toBe('2026-01-01');
        expect(p.au).toBe('2026-12-31');
        expect(p.bornes).toEqual({ gte: new Date('2026-01-01T00:00:00.000Z'), lt: new Date('2027-01-01T00:00:00.000Z') });
    });
    it('une seule borne suffit, et l’autre reste ouverte', () => {
        expect((0, periode_de_liste_1.lirePeriodeDeListe)({ du: '2025-09-28' }).bornes).toEqual({ gte: new Date('2025-09-28T00:00:00.000Z') });
        expect((0, periode_de_liste_1.lirePeriodeDeListe)({ au: '2026-02-28' }).bornes).toEqual({ lt: new Date('2026-03-01T00:00:00.000Z') });
    });
    it('un jour hors calendrier est refusé · new Date le ferait glisser au mois suivant sans rien dire', () => {
        expect(() => (0, periode_de_liste_1.lirePeriodeDeListe)({ du: '2026-02-30' })).toThrow(common_1.BadRequestException);
        expect(() => (0, periode_de_liste_1.lirePeriodeDeListe)({ au: '2026-13-01' })).toThrow(/« au » illisible/);
        expect(() => (0, periode_de_liste_1.lirePeriodeDeListe)({ du: '2026-04-31' })).toThrow(/AAAA-MM-JJ attendu/);
    });
    it('une forme autre que AAAA-MM-JJ est refusée, heure comprise', () => {
        expect(() => (0, periode_de_liste_1.lirePeriodeDeListe)({ du: 'hier' })).toThrow(/« du » illisible/);
        expect(() => (0, periode_de_liste_1.lirePeriodeDeListe)({ du: '2026-09-01T00:00:00Z' })).toThrow(common_1.BadRequestException);
        expect(() => (0, periode_de_liste_1.lirePeriodeDeListe)({ du: '01/09/2026' })).toThrow(common_1.BadRequestException);
    });
    it('le 29 février n’existe que les années bissextiles', () => {
        expect((0, periode_de_liste_1.lirePeriodeDeListe)({ du: '2028-02-29' }).du).toBe('2028-02-29');
        expect(() => (0, periode_de_liste_1.lirePeriodeDeListe)({ du: '2026-02-29' })).toThrow(common_1.BadRequestException);
    });
    it('une année de moins de cent ne se lit pas au vingtième siècle', () => {
        expect(() => (0, periode_de_liste_1.lirePeriodeDeListe)({ du: '0050-01-01' })).toThrow(common_1.BadRequestException);
    });
    it('un début après la fin est refusé, un seul jour est admis', () => {
        expect(() => (0, periode_de_liste_1.lirePeriodeDeListe)({ du: '2026-10-01', au: '2026-09-30' })).toThrow(/dépasse sa date de fin/);
        expect((0, periode_de_liste_1.lirePeriodeDeListe)({ du: '2026-09-30', au: '2026-09-30' }).bornes).toEqual({
            gte: new Date('2026-09-30T00:00:00.000Z'),
            lt: new Date('2026-10-01T00:00:00.000Z'),
        });
    });
});
//# sourceMappingURL=periode-de-liste.spec.js.map