"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const valorisation_stocks_1 = require("./valorisation-stocks");
let n = 0;
const entree = (date, quantite, cout) => ({
    ordre: n++,
    date,
    sens: 'ENTREE',
    quantite,
    cout,
});
const sortie = (date, quantite, cout = null) => ({
    ordre: n++,
    date,
    sens: 'SORTIE',
    quantite,
    cout,
});
beforeEach(() => {
    n = 0;
});
describe('Valorisation · les trois méthodes admises, et les deux qui ne le sont pas', () => {
    it('la liste porte EXACTEMENT les trois noms du glossaire', () => {
        expect([...valorisation_stocks_1.METHODES_ADMISES]).toEqual(['PEPS', 'CMPACE', 'CMP_PERIODE_STOCKAGE']);
    });
    it('LE COÛT MOYEN ANNUEL ET LE D.E.P.S. N’Y SONT PAS, et la source le dit', () => {
        const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'valorisation-stocks.ts'), 'utf8');
        expect(source).toContain('EN ACCEPTE\n * TROIS');
        expect(source).toContain('coût moyen pondéré ANNUEL');
        expect(source).toContain('D.E.P.S.');
        expect(valorisation_stocks_1.METHODES_ADMISES).toHaveLength(3);
    });
    it('chaque méthode est appariée à UN mode de tenue, et le texte les apparie', () => {
        expect((0, valorisation_stocks_1.methodeCompatible)('PEPS', 'PERMANENT')).toBe(true);
        expect((0, valorisation_stocks_1.methodeCompatible)('CMPACE', 'PERMANENT')).toBe(true);
        expect((0, valorisation_stocks_1.methodeCompatible)('CMP_PERIODE_STOCKAGE', 'PERMANENT')).toBe(false);
        expect((0, valorisation_stocks_1.methodeCompatible)('CMP_PERIODE_STOCKAGE', 'INTERMITTENT')).toBe(true);
        expect((0, valorisation_stocks_1.methodeCompatible)('PEPS', 'INTERMITTENT')).toBe(false);
    });
    it('le CMP de période de stockage est DÉCLARÉ non calculé, avec sa définition', () => {
        const v = (0, valorisation_stocks_1.valoriser)([entree('2026-01-10', 10, 1_000)], 'CMP_PERIODE_STOCKAGE');
        expect(v.refus[0].motif).toBe('METHODE_NON_IMPLEMENTEE');
        expect(v.refus[0].explication).toContain("DATE D'ENTRÉE MOYENNE");
        expect(v.refus[0].explication).toContain('Notes annexes');
    });
});
describe('Valorisation · P.E.P.S., « au prix d’entrée des articles les plus anciens »', () => {
    it('consomme les couches dans leur ordre d’arrivée', () => {
        const v = (0, valorisation_stocks_1.valoriser)([entree('2026-01-10', 10, 1_000), entree('2026-02-10', 10, 1_500), sortie('2026-03-10', 15)], 'PEPS');
        expect(v.mouvements[2].valeur).toBe(1_750);
        expect(v.quantiteFinale).toBe(5);
        expect(v.valeurFinale).toBe(750);
    });
    it('le stock final est évalué « à des prix récents »', () => {
        const v = (0, valorisation_stocks_1.valoriser)([entree('2026-01-10', 10, 1_000), entree('2026-02-10', 10, 1_500), sortie('2026-03-10', 15)], 'PEPS');
        expect(v.valeurFinale / v.quantiteFinale).toBe(150);
    });
    it('l’ordre CHRONOLOGIQUE l’emporte sur l’ordre de saisie', () => {
        const tardive = { ordre: 9, date: '2026-01-05', sens: 'ENTREE', quantite: 10, cout: 500 };
        const v = (0, valorisation_stocks_1.valoriser)([entree('2026-02-10', 10, 1_500), tardive, sortie('2026-03-10', 10)], 'PEPS');
        expect(v.mouvements[0].date).toBe('2026-01-05');
        expect(v.mouvements[2].valeur).toBe(500);
    });
});
describe('Valorisation · C.M.P.A.C.E., « au coût moyen du stock détenu à la date de la sortie »', () => {
    it('recalcule la moyenne à CHAQUE entrée', () => {
        const v = (0, valorisation_stocks_1.valoriser)([entree('2026-01-10', 10, 1_000), entree('2026-02-10', 10, 1_500), sortie('2026-03-10', 15)], 'CMPACE');
        expect(v.mouvements[2].valeur).toBe(1_875);
        expect(v.valeurFinale).toBe(625);
        expect(v.valeurFinale / v.quantiteFinale).toBe(125);
    });
    it('LES DEUX MÉTHODES NE DONNENT PAS LE MÊME CHIFFRE, et c’est le propos', () => {
        const mouvements = () => [
            entree('2026-01-10', 10, 1_000),
            entree('2026-02-10', 10, 1_500),
            sortie('2026-03-10', 15),
        ];
        n = 0;
        const peps = (0, valorisation_stocks_1.valoriser)(mouvements(), 'PEPS');
        n = 0;
        const cmpace = (0, valorisation_stocks_1.valoriser)(mouvements(), 'CMPACE');
        expect(peps.mouvements[2].valeur).not.toEqual(cmpace.mouvements[2].valeur);
    });
});
describe('Valorisation · L’AXIOME DU GLOSSAIRE, vérifié sur les deux méthodes', () => {
    const jeuQuiSeVide = () => [
        entree('2026-01-10', 7, 1_000),
        entree('2026-02-10', 11, 2_000),
        sortie('2026-03-10', 5),
        entree('2026-04-10', 13, 900),
        sortie('2026-05-10', 9),
        sortie('2026-06-10', 17),
    ];
    it.each(['PEPS', 'CMPACE'])('tout ce qui est entré ressort pour la même valeur · %s', (methode) => {
        n = 0;
        const v = (0, valorisation_stocks_1.valoriser)(jeuQuiSeVide(), methode);
        expect(v.refus).toEqual([]);
        expect(v.quantiteFinale).toBe(0);
        expect(v.valeurFinale).toBe(0);
        expect(v.totalSorties).toBeCloseTo(v.totalEntrees, 10);
        expect(v.totalEntrees).toBe(3_900);
    });
    it.each(['PEPS', 'CMPACE'])('le magasin ne porte jamais une valeur sans quantité · %s', (methode) => {
        n = 0;
        const v = (0, valorisation_stocks_1.valoriser)(jeuQuiSeVide(), methode);
        for (const m of v.mouvements) {
            if (m.quantiteApres === 0)
                expect(m.valeurApres).toBe(0);
        }
    });
    it.each(['PEPS', 'CMPACE'])('AUCUN RÉSIDU D’ARRONDI quand la division ne tombe pas juste · %s', (methode) => {
        n = 0;
        const v = (0, valorisation_stocks_1.valoriser)([entree('2026-01-10', 7, 29), sortie('2026-02-10', 7)], methode);
        expect(v.quantiteFinale).toBe(0);
        expect(v.valeurFinale).toBe(0);
        expect(v.totalSorties).toBe(29);
        expect(v.totalSorties).toBe(v.totalEntrees);
    });
});
describe('Valorisation · les refus, et ce qu’ils empêchent', () => {
    it('UNE SORTIE NE PORTE JAMAIS SON COÛT', () => {
        const v = (0, valorisation_stocks_1.valoriser)([entree('2026-01-10', 10, 1_000), sortie('2026-02-10', 5, 900)], 'PEPS');
        expect(v.refus[0].motif).toBe('SORTIE_AVEC_COUT_IMPOSE');
        expect(v.refus[0].explication).toContain('raccordement');
        expect(v.quantiteFinale).toBe(10);
    });
    it('une entrée SANS coût est refusée', () => {
        const v = (0, valorisation_stocks_1.valoriser)([{ ordre: 0, date: '2026-01-10', sens: 'ENTREE', quantite: 10, cout: null }], 'PEPS');
        expect(v.refus[0].motif).toBe('ENTREE_SANS_COUT');
    });
    it('un coût NÉGATIF est refusé · une remise se déduit, elle ne s’entre pas', () => {
        const v = (0, valorisation_stocks_1.valoriser)([entree('2026-01-10', 10, -500)], 'PEPS');
        expect(v.refus[0].motif).toBe('ENTREE_COUT_NEGATIF');
        expect(v.refus[0].explication).toContain('DÉDUISENT');
    });
    it('UN STOCK NE DESCEND PAS SOUS ZÉRO', () => {
        const v = (0, valorisation_stocks_1.valoriser)([entree('2026-01-10', 10, 1_000), sortie('2026-02-10', 15)], 'PEPS');
        expect(v.refus[0].motif).toBe('SORTIE_SUPERIEURE_AU_STOCK');
        expect(v.refus[0].explication).toContain('10');
        expect(v.quantiteFinale).toBe(10);
    });
    it('une quantité nulle ou négative est refusée · le SENS dit déjà la direction', () => {
        const v = (0, valorisation_stocks_1.valoriser)([entree('2026-01-10', 0, 0), sortie('2026-02-10', -3)], 'PEPS');
        expect(v.refus.map((r) => r.motif)).toEqual([
            'QUANTITE_NON_POSITIVE',
            'QUANTITE_NON_POSITIVE',
        ]);
    });
    it('UN REFUS N’EMPORTE PAS LES AUTRES MOUVEMENTS', () => {
        const v = (0, valorisation_stocks_1.valoriser)([entree('2026-01-10', 10, 1_000), sortie('2026-02-10', 99), sortie('2026-03-10', 4)], 'PEPS');
        expect(v.refus).toHaveLength(1);
        expect(v.quantiteFinale).toBe(6);
        expect(v.valeurFinale).toBe(600);
    });
});
//# sourceMappingURL=valorisation-stocks.spec.js.map