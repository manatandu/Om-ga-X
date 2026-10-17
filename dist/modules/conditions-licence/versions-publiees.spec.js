"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const conditions_de_licence_1 = require("./conditions-de-licence");
const empreinte_1 = require("./empreinte");
const versions_publiees_1 = require("./versions-publiees");
const delais_article_34_1 = require("./delais-article-34");
const EMPREINTES_GELEES = {
    1: '1a878fe68d79ec76fa40173395750ab68cbf8a1a581c91397e45b30815dac75d',
};
describe('l’empreinte SHA-256, écrite pour les deux côtés', () => {
    it('rend les vecteurs de la norme (FIPS 180-2, annexe B)', () => {
        expect((0, empreinte_1.sha256Hex)('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        expect((0, empreinte_1.sha256Hex)('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
        expect((0, empreinte_1.sha256Hex)('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    });
    it('rend ce que rend Node, sur des caractères accentués et sur le contrat entier', () => {
        for (const t of ['é’·', '😀 OmegaX', 'x'.repeat(64), 'x'.repeat(65), (0, conditions_de_licence_1.texteBrutDesConditions)()]) {
            expect((0, empreinte_1.sha256Hex)(t)).toBe((0, crypto_1.createHash)('sha256').update(t, 'utf8').digest('hex'));
        }
    });
});
describe('chaque version publiée garde son texte et son empreinte', () => {
    it('l’empreinte de chaque version archivée est celle de son texte, et elle est gelée ici', () => {
        expect(versions_publiees_1.VERSIONS_PUBLIEES.map((v) => v.numero)).toEqual(Object.keys(EMPREINTES_GELEES).map(Number));
        for (const v of versions_publiees_1.VERSIONS_PUBLIEES) {
            expect([v.numero, (0, empreinte_1.sha256Hex)(v.texte)]).toEqual([v.numero, v.empreinte]);
            expect([v.numero, v.empreinte]).toEqual([v.numero, EMPREINTES_GELEES[v.numero]]);
        }
    });
    it('les versions se suivent sans trou, dans l’ordre des dates', () => {
        versions_publiees_1.VERSIONS_PUBLIEES.forEach((v, i) => {
            expect(v.numero).toBe(i + 1);
            if (i > 0)
                expect(v.date >= versions_publiees_1.VERSIONS_PUBLIEES[i - 1].date).toBe(true);
        });
    });
    it('la version en vigueur est la dernière publiée, et le générateur rend EXACTEMENT son texte archivé', () => {
        const derniere = versions_publiees_1.VERSIONS_PUBLIEES[versions_publiees_1.VERSIONS_PUBLIEES.length - 1];
        expect(derniere.numero).toBe(conditions_de_licence_1.VERSION_CONDITIONS_LICENCE.numero);
        expect(derniere.date).toBe(conditions_de_licence_1.VERSION_CONDITIONS_LICENCE.date);
        expect(derniere.dateLisible).toBe(conditions_de_licence_1.VERSION_CONDITIONS_LICENCE.dateLisible);
        expect((0, conditions_de_licence_1.texteBrutDesConditions)()).toBe(derniere.texte);
        expect((0, versions_publiees_1.empreinteEnVigueur)()).toBe(derniere.empreinte);
    });
    it('une version se retrouve par son numéro, et un numéro inconnu n’a pas de texte', () => {
        expect((0, versions_publiees_1.versionPubliee)(1)?.texte).toBe(versions_publiees_1.VERSIONS_PUBLIEES[0].texte);
        expect((0, versions_publiees_1.versionPubliee)(99)).toBeNull();
    });
});
describe('les délais de l’art. 34 (Code du numérique), comptés au plus long pour l’utilisateur', () => {
    it('trente jours ouvrables pleins, du lundi au vendredi, entre la communication et l’entrée en vigueur', () => {
        expect((0, delais_article_34_1.nIemeJourOuvrableApres)('2026-10-15', 30)).toBe('2026-11-26');
        expect((0, delais_article_34_1.entreeEnVigueurAuPlusTot)('2026-10-15')).toBe('2026-11-27');
    });
    it('les jours fériés de l’ordonnance n° 23-042 ne comptent pas', () => {
        expect((0, delais_article_34_1.nIemeJourOuvrableApres)('2026-12-20', 30)).toBe('2027-02-03');
    });
    it('la modification ne prend effet qu’au lendemain du soixantième jour ouvrable après l’entrée en vigueur', () => {
        expect((0, delais_article_34_1.finDuDelaiDeResiliation)('2026-11-27')).toBe('2027-02-24');
        expect((0, delais_article_34_1.priseDEffet)('2026-11-27')).toBe('2027-02-25');
    });
    it('chaque version publiée respecte le délai, et la première, offre initiale, n’en porte aucun', () => {
        for (const v of versions_publiees_1.VERSIONS_PUBLIEES)
            expect([v.numero, (0, delais_article_34_1.motifDelaiArticle34)(v)]).toEqual([v.numero, null]);
        expect((0, delais_article_34_1.motifDelaiArticle34)({ numero: 2, communiqueeLe: null, enVigueurLe: '2027-01-01' })).toContain('date de communication');
        expect((0, delais_article_34_1.motifDelaiArticle34)({ numero: 2, communiqueeLe: '2026-10-15', enVigueurLe: '2026-11-26' })).toContain('ne peut entrer en vigueur avant le 2026-11-27');
        expect((0, delais_article_34_1.motifDelaiArticle34)({ numero: 2, communiqueeLe: '2026-10-15', enVigueurLe: '2026-11-27' })).toBeNull();
    });
    it('UNE SEULE VERSION tant que la bascule de N à N+1 n’est pas servie', () => {
        expect(versions_publiees_1.VERSIONS_PUBLIEES).toHaveLength(1);
    });
});
//# sourceMappingURL=versions-publiees.spec.js.map