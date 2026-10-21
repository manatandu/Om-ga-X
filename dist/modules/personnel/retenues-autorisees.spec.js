"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const retenues_autorisees_1 = require("./retenues-autorisees");
describe("Les sept retenues de l'article 112, recopiées", () => {
    it('en porte exactement sept, de a) à g), sans trou', () => {
        expect(retenues_autorisees_1.RETENUES_ARTICLE_112).toHaveLength(7);
        expect(retenues_autorisees_1.RETENUES_ARTICLE_112.map((r) => r.littera)).toEqual([
            'a',
            'b',
            'c',
            'd',
            'e',
            'f',
            'g',
        ]);
    });
    it('ne nomme NULLE PART la cotisation syndicale', () => {
        for (const r of retenues_autorisees_1.RETENUES_ARTICLE_112) {
            expect(r.libelle.toLowerCase()).not.toContain('syndic');
            expect((r.equivalentActuel ?? '').toLowerCase()).not.toContain('syndic');
        }
    });
    it("porte l'équivalent actuel des deux seuls litterae datés", () => {
        const parLittera = Object.fromEntries(retenues_autorisees_1.RETENUES_ARTICLE_112.map((r) => [r.littera, r]));
        expect(parLittera.a.libelle).toContain('taxe professionnelle');
        expect(parLittera.a.equivalentActuel).toContain('119');
        expect(parLittera.b.libelle).toContain('Institut National de Sécurité Sociale');
        expect(parLittera.b.equivalentActuel).toContain('CNSS');
        const avecEquivalent = retenues_autorisees_1.RETENUES_ARTICLE_112.filter((r) => r.equivalentActuel !== null);
        expect(avecEquivalent.map((r) => r.littera)).toEqual(['a', 'b']);
    });
    it("borne la souplesse de l'équivalence", () => {
        expect(retenues_autorisees_1.RESERVE_LITTERAE_DATEES).toMatch(/CNSS pour le b/);
        expect(retenues_autorisees_1.RESERVE_LITTERAE_DATEES).toMatch(/JAMAIS pour une retenue que la liste n'a jamais prévue/i);
    });
});
describe('Le rattachement est un acte de qualification, pas une devinette', () => {
    it('accepte les sept litterae', () => {
        for (const l of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
            expect((0, retenues_autorisees_1.retenueAutorisee)(l).autorisee).toBe(true);
        }
    });
    it("refuse l'absence de litera, et le refus porte la sanction", () => {
        const v = (0, retenues_autorisees_1.retenueAutorisee)(null);
        expect(v.autorisee).toBe(false);
        expect(v.retenue).toBeNull();
        expect(v.refus).toMatch(/AUTANT DE FOIS QU'IL Y A DES TRAVAILLEURS CONCERNÉS/);
    });
    it("refuse un litera inventé, et le cite pour qu'on voie l'erreur", () => {
        const v = (0, retenues_autorisees_1.retenueAutorisee)('h');
        expect(v.autorisee).toBe(false);
        expect(v.refus).toContain('« h »');
    });
    it("ne s'ouvre PAS sur un litera en capitale ou avec parenthèse", () => {
        expect((0, retenues_autorisees_1.retenueAutorisee)('A').autorisee).toBe(false);
        expect((0, retenues_autorisees_1.retenueAutorisee)('a)').autorisee).toBe(false);
    });
});
describe("La cotisation syndicale · six passes pour lire le bon article", () => {
    it("répond NON à la retenue, et dit d'où vient la réponse", () => {
        expect(retenues_autorisees_1.REPONSE_COTISATION_SYNDICALE).toMatch(/NE SE RETIENT PAS SUR LA PAIE/);
        expect(retenues_autorisees_1.REPONSE_COTISATION_SYNDICALE).toContain('279');
        expect(retenues_autorisees_1.REPONSE_COTISATION_SYNDICALE).toMatch(/PAR LES TRAVAILLEURS/);
        expect(retenues_autorisees_1.REPONSE_COTISATION_SYNDICALE).toMatch(/LE SUJET DU VERBE EST LE TRAVAILLEUR/);
    });
    it('ferme la porte de la convention collective par les deux verrous', () => {
        expect(retenues_autorisees_1.REPONSE_COTISATION_SYNDICALE).toContain('274');
        expect(retenues_autorisees_1.REPONSE_COTISATION_SYNDICALE).toContain('112');
        expect(retenues_autorisees_1.REPONSE_COTISATION_SYNDICALE).toMatch(/nullité de plein droit/i);
        expect(retenues_autorisees_1.REPONSE_COTISATION_SYNDICALE).toMatch(/pénalement sanctionné/i);
        expect(retenues_autorisees_1.REPONSE_COTISATION_SYNDICALE).toMatch(/aucune liste pénale/i);
    });
    it("nomme la voie qui reste, et AVOUE que c'est une lecture", () => {
        expect(retenues_autorisees_1.RESERVE_CESSION_SYNDICALE).toMatch(/UNE CESSION, PAS UNE RETENUE/);
        expect(retenues_autorisees_1.RESERVE_CESSION_SYNDICALE).toContain('114');
        expect(retenues_autorisees_1.RESERVE_CESSION_SYNDICALE).toMatch(/LECTURE D'ÉDITEUR/);
        expect(retenues_autorisees_1.RESERVE_CESSION_SYNDICALE).toContain('205');
        expect(retenues_autorisees_1.RESERVE_CESSION_SYNDICALE).toMatch(/greffe/i);
        expect(retenues_autorisees_1.RESERVE_CESSION_SYNDICALE).toContain('207');
        expect(retenues_autorisees_1.RESERVE_CESSION_SYNDICALE).toContain('212');
        expect(retenues_autorisees_1.RESERVE_CESSION_SYNDICALE).toMatch(/n'est pas une cession et relève de l'article 112/);
    });
    it('dit les deux conséquences de cette voie avant de la proposer', () => {
        expect(retenues_autorisees_1.RESERVE_CESSION_SYNDICALE).toMatch(/CONSOMME LA QUOTITÉ CESSIBLE/);
        expect(retenues_autorisees_1.RESERVE_CESSION_SYNDICALE).toMatch(/EN PERSONNE AU GREFFE/);
        expect(retenues_autorisees_1.RESERVE_CESSION_SYNDICALE).toMatch(/jamais une clause qui vaudrait pour tous/i);
    });
    it('chiffre la sanction et son multiplicateur', () => {
        expect(retenues_autorisees_1.SANCTION_ARTICLE_112).toContain('321');
        expect(retenues_autorisees_1.SANCTION_ARTICLE_112).toContain('328');
        expect(retenues_autorisees_1.SANCTION_ARTICLE_112).toContain('20 000');
        expect(retenues_autorisees_1.SANCTION_ARTICLE_112).toMatch(/cinquante fois/);
    });
    it('multiplie par TRAVAILLEUR concerné, jamais par bulletin (art. 328 b)', () => {
        expect(retenues_autorisees_1.SANCTION_ARTICLE_112).toMatch(/bulletins de cent travailleurs est donc cent amendes/);
    });
});
//# sourceMappingURL=retenues-autorisees.spec.js.map