"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fonctions_modele_1 = require("./fonctions-modele");
describe('fonctions de ligne d’un modèle (Sage i7)', () => {
    it('le modèle du manuel · Saisir, Calculer (TVA), Équilibrer', () => {
        expect((0, fonctions_modele_1.motifRefusFonctions)([{ fonction: 'SAISIR' }, { fonction: 'CALCULER', tauxTvaId: 't' }, { fonction: 'EQUILIBRER' }])).toBeNull();
    });
    it('Répéter et Calculer ne se posent pas en première ligne', () => {
        expect((0, fonctions_modele_1.motifRefusFonctions)([{ fonction: 'REPETER' }, { fonction: 'EQUILIBRER' }])).toMatch(/première ligne/);
        expect((0, fonctions_modele_1.motifRefusFonctions)([{ fonction: 'CALCULER', tauxTvaId: 't' }, { fonction: 'SAISIR' }])).toMatch(/première ligne/);
    });
    it('Calculer demande son taux, et un taux ne sert qu’à Calculer', () => {
        expect((0, fonctions_modele_1.motifRefusFonctions)([{ fonction: 'SAISIR' }, { fonction: 'CALCULER' }])).toMatch(/taux de taxe à appliquer/);
        expect((0, fonctions_modele_1.motifRefusFonctions)([{ fonction: 'SAISIR', tauxTvaId: 't' }, { fonction: 'EQUILIBRER' }])).toMatch(/ne sert qu'à une ligne « Calculer »/);
    });
    it('une seule ligne équilibre, et un montant figé ne vaut que pour Saisir', () => {
        expect((0, fonctions_modele_1.motifRefusFonctions)([{ fonction: 'EQUILIBRER' }, { fonction: 'EQUILIBRER' }])).toMatch(/Une seule ligne/);
        expect((0, fonctions_modele_1.motifRefusFonctions)([{ fonction: 'SAISIR' }, { fonction: 'EQUILIBRER', montant: 10 }])).toMatch(/montant figé/);
        expect((0, fonctions_modele_1.motifRefusFonctions)([{ montant: 10 }, { fonction: 'EQUILIBRER' }])).toBeNull();
    });
});
//# sourceMappingURL=fonctions-modele.spec.js.map