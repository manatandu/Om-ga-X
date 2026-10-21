"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const mentions_facture_1 = require("./mentions-facture");
const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'mentions-facture.ts'), 'utf8');
function documentationDe(declaration) {
    const i = source.indexOf(declaration);
    expect(i).toBeGreaterThan(0);
    const avant = source.slice(0, i);
    const fin = avant.lastIndexOf('*/');
    expect(avant.slice(fin + 2).trim()).toBe('');
    return avant
        .slice(avant.lastIndexOf('/**', fin) + 3, fin)
        .replace(/\n\s*\*\s?/g, ' ')
        .replace(/\s+/g, ' ');
}
const MOTS = ['ZÉRO', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF', 'DIX', 'ONZE', 'DOUZE'];
const mot = (n) => MOTS[n];
const facture = (sur = {}) => ({
    emetteurNom: 'VMG Consulting',
    emetteurAdresse: '12, avenue de la Justice, Kinshasa/Gombe',
    emetteurNumeroImpot: 'A1234567X',
    contrepartieNom: 'Client SARL',
    contrepartieAdresse: '4, boulevard du 30 Juin, Kinshasa',
    contrepartieNumeroImpot: 'B7654321Y',
    dateFacture: new Date('2026-09-10'),
    mentionTvaDebits: false,
    numeroSerie: 'FV-2026-0001',
    autresImpotsEtTaxes: 0,
    lignes: [],
    ...sur,
});
describe('F229 · le commentaire du tableau dit ce que le tableau porte', () => {
    it('il annonce les groupes de l’art. 26 et ceux qui sont dus, au nombre exact', () => {
        const doc = documentationDe('export const MENTIONS_ARTICLE_26');
        expect(doc).toContain(`LES ${mot(mentions_facture_1.MENTIONS_ARTICLE_26.length)} GROUPES DE L'ART. 26`);
        expect(doc).toContain(`DONT ${mot(mentions_facture_1.MENTIONS_DOCUMENT_EN_TENANT_LIEU.length)} SONT DUS`);
    });
    it('il compte les groupes qu’une pièce sans lignes manque, sur les groupes dus', () => {
        const manquent = (0, mentions_facture_1.verifierMentions)(facture({ lignes: [] }), true).manquantes.length;
        const doc = documentationDe('export const MENTIONS_ARTICLE_26');
        expect(doc).toContain(`manque donc ${mot(manquent)} groupes sur les ${mot(mentions_facture_1.MENTIONS_DOCUMENT_EN_TENANT_LIEU.length).toLowerCase()} dus`);
    });
    it('il renvoie au choix du texte par la date de la pièce, et nomme les neuf de l’art. 100', () => {
        const doc = documentationDe('export const MENTIONS_ARTICLE_26');
        expect(doc).toContain('`texteApplicable`');
        expect(doc).toContain(`les ${mot(mentions_facture_1.MENTIONS_ARTICLE_100.length).toLowerCase()} de l'art. 100 avant le 3 mars 2023`);
    });
});
describe('F229 · `verifierMentions` dit la liste qu’il applique', () => {
    it('sa documentation renvoie au texte en vigueur à la date de la pièce', () => {
        const doc = documentationDe('export function verifierMentions(');
        expect(doc).toContain('`texteApplicable`');
        expect(doc).toContain(`les ${mot(mentions_facture_1.MENTIONS_DOCUMENT_EN_TENANT_LIEU.length).toLowerCase()} groupes dus de l'art. 26`);
    });
    it('le commentaire de la mention de l’art. 60 rend l’art. 100 à son décret', () => {
        const corps = source.slice(source.indexOf('export function verifierMentions('));
        expect(corps.replace(/\s+/g, ' ')).toContain("Elle ne vient ni de l'art. 26 du décret n° 23/10 ni de l'art. 100 du décret n° 011/42");
    });
});
describe('F229 · la réserve de l’amende nomme les deux textes', () => {
    it('l’unité de l’omission se cherche dans le texte applicable à la pièce, art. 26 ou art. 100', () => {
        expect(mentions_facture_1.AMENDE_PAR_OMISSION.reserve).toContain('décret n° 23/10, art. 26');
        expect(mentions_facture_1.AMENDE_PAR_OMISSION.reserve).toContain('décret n° 011/42, art. 100, avant le 3 mars 2023');
        expect(mentions_facture_1.AMENDE_PAR_OMISSION.reserve).toContain('ne se déduit donc pas du nombre de groupes manquants');
    });
});
//# sourceMappingURL=mentions-facture-f229.spec.js.map