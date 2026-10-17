"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_compte_resultat_1 = require("./correspondance-compte-resultat");
describe('correspondance compte de résultat (SYCEBNL, Partie 4 ch. 2)', () => {
    describe('rattachement des comptes aux postes officiels', () => {
        it.each([
            ['70100000', 'RA'],
            ['70300000', 'RB'],
            ['70410000', 'RC'],
            ['70510000', 'RD'],
            ['70520000', 'RE'],
            ['70530000', 'RE'],
            ['71100000', 'RF'],
            ['70600000', 'RG'],
            ['79000000', 'RH'],
            ['60100000', 'TA'],
            ['60310000', 'TB'],
            ['60200000', 'TC'],
            ['60400000', 'TD'],
            ['60320000', 'TE'],
            ['61200000', 'TF'],
            ['62200000', 'TG'],
            ['64000000', 'TH'],
            ['65000000', 'TI'],
            ['66100000', 'TJ'],
            ['67000000', 'TK'],
            ['68000000', 'TL'],
            ['82200000', 'TM'],
            ['81200000', 'TN'],
        ])('le compte %s alimente le poste %s', (numero, refAttendu) => {
            expect((0, correspondance_compte_resultat_1.posteDuCompte)(numero)?.ref).toBe(refAttendu);
        });
        it('distingue 6031 (TB) de 6032-6035 (TE) · le préfixe le plus long l’emporte', () => {
            expect((0, correspondance_compte_resultat_1.posteDuCompte)('60310000')?.ref).toBe('TB');
            expect((0, correspondance_compte_resultat_1.posteDuCompte)('60320000')?.ref).toBe('TE');
            expect((0, correspondance_compte_resultat_1.posteDuCompte)('60330000')?.ref).toBe('TE');
            expect((0, correspondance_compte_resultat_1.posteDuCompte)('60350000')?.ref).toBe('TE');
        });
        it('distingue 7051 (RD, marchandises) de 7052/7053 (RE, services et produits finis)', () => {
            expect((0, correspondance_compte_resultat_1.posteDuCompte)('70510000')?.ref).toBe('RD');
            expect((0, correspondance_compte_resultat_1.posteDuCompte)('70520000')?.ref).toBe('RE');
        });
        it('ne rattache aucun compte de bilan (classes 1 à 5)', () => {
            for (const numero of ['10110000', '24510000', '31100000', '41100000', '52110000']) {
                expect((0, correspondance_compte_resultat_1.posteDuCompte)(numero)).toBeNull();
            }
        });
        it('ne rattache pas les comptes de classe 9 (hors bilan et hors résultat par construction)', () => {
            expect((0, correspondance_compte_resultat_1.posteDuCompte)('90000000')).toBeNull();
            expect((0, correspondance_compte_resultat_1.posteDuCompte)('91000000')).toBeNull();
        });
    });
    describe('lacunes du texte officiel, signalées et non comblées', () => {
        it('laisse 7054 et 7055 hors de tout poste (le tableau officiel ne les cite pas)', () => {
            expect((0, correspondance_compte_resultat_1.posteDuCompte)('70540000')).toBeNull();
            expect((0, correspondance_compte_resultat_1.posteDuCompte)('70550000')).toBeNull();
        });
        it('laisse 702 hors de tout poste (compte du jeu « projets de développement »)', () => {
            expect((0, correspondance_compte_resultat_1.posteDuCompte)('70200000')).toBeNull();
        });
    });
    describe('intégrité du tableau', () => {
        it('ne comporte aucun code REF en double', () => {
            const refs = correspondance_compte_resultat_1.TOUS_LES_POSTES.map((p) => p.ref);
            expect(new Set(refs).size).toBe(refs.length);
        });
        it('couvre les 8 postes de produits, 12 de charges et 2 H.A.O. du texte officiel', () => {
            expect(correspondance_compte_resultat_1.POSTES_PRODUITS).toHaveLength(8);
            expect(correspondance_compte_resultat_1.POSTES_CHARGES).toHaveLength(12);
            expect(correspondance_compte_resultat_1.POSTES_HAO).toHaveLength(2);
        });
        it('n’attribue jamais deux postes au même préfixe de compte', () => {
            const vus = new Map();
            for (const poste of correspondance_compte_resultat_1.TOUS_LES_POSTES) {
                for (const prefixe of poste.comptes) {
                    expect(vus.has(prefixe)).toBe(false);
                    vus.set(prefixe, poste.ref);
                }
            }
        });
    });
});
describe('en-tête du fichier (passe R6)', () => {
    it('situe le bilan sur SA table officielle, pas sur un regroupement simplifié', () => {
        const source = require('fs').readFileSync(require('path').join(__dirname, 'correspondance-compte-resultat.ts'), 'utf8');
        const entete = source.slice(0, source.indexOf('*/'));
        expect(entete).toContain('comme le bilan');
        expect(entete).toContain('`correspondance-bilan.ts`');
    });
});
//# sourceMappingURL=correspondance-compte-resultat.spec.js.map