"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_notes_associations_1 = require("./correspondance-notes-associations");
const correspondance_notes_syscohada_1 = require("../etats-financiers-syscohada/correspondance-notes-syscohada");
const transfert_depreciation_note_1 = require("./transfert-depreciation-note");
const fr = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const transfert = (montant, source, cible, hao = false, valide = true) => [
    { nature: 'TRANSFERT_REPRISE', montant, numeroCompteDepreciation: source, numeroContrepartie: hao ? '86300000' : '79140000', valide },
    { nature: 'TRANSFERT_DOTATION', montant, numeroCompteDepreciation: cible, numeroContrepartie: hao ? '85300000' : '69140000', valide },
];
describe('Transfert de dépréciation à la mise en service, dit dans la note', () => {
    const rubriques5F = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.find((n) => n.code === '5F').rubriques;
    const rubriques28 = correspondance_notes_syscohada_1.NOTES_SYSCOHADA.find((n) => n.code === '28').rubriques;
    const ligne5F = (numero) => (0, transfert_depreciation_note_1.rubriqueQuiLit)(numero, rubriques5F, []);
    const ligne28 = (numero) => (0, transfert_depreciation_note_1.rubriqueQuiLit)(numero, rubriques28, []);
    it('les deux tableaux visés existent dans leur jeu, et aucun autre jeu n’en reçoit', () => {
        expect(transfert_depreciation_note_1.NOTE_DU_TRANSFERT).toEqual({ SYSCOHADA_SYSTEME_NORMAL: '28', ASSOCIATIONS_ORDRES_PROFESSIONNELS: '5F' });
        expect(ligne28('29390000')).toBe('Dépréciation des immobilisations');
        expect(ligne5F('29190000')).toBe('Autres immobilisations incorporelles');
        expect(ligne5F('29130000')).toBe('Logiciels et sites internet');
    });
    it('NOTE 28 · une seule ligne lit le 29 · la phrase chiffre reprise et dotation, sans nommer de ligne', () => {
        const [p] = (0, transfert_depreciation_note_1.phrasesTransfertDepreciation)(transfert(1_400_000, '29390000', '29310000'), ligne28);
        expect(p).toBe(`Dont transfert à la mise en service · ${fr(1_400_000)} en reprise et ${fr(1_400_000)} en dotation (exploitation), ` +
            "dépréciation déjà constatée sur l'immobilisation en cours, portée au compte du bien achevé, sans perte de valeur nouvelle.");
    });
    it('5F · le 2919 et le 2913 tombent sur deux lignes · la phrase les nomme toutes deux', () => {
        const [p] = (0, transfert_depreciation_note_1.phrasesTransfertDepreciation)(transfert(250_000, '29190000', '29130000'), ligne5F);
        expect(p).toContain(`${fr(250_000)} en reprise sur la ligne « Autres immobilisations incorporelles »`);
        expect(p).toContain(`${fr(250_000)} en dotation sur la ligne « Logiciels et sites internet »`);
    });
    it('le niveau se lit sur la contrepartie passée · H.A.O. (853 / 863), ou les deux', () => {
        expect((0, transfert_depreciation_note_1.phrasesTransfertDepreciation)(transfert(100, '29390000', '29310000', true), ligne28)[0]).toContain('(H.A.O.)');
        const melange = [...transfert(100, '29390000', '29310000'), ...transfert(50, '29490000', '29440000', true)];
        const [p] = (0, transfert_depreciation_note_1.phrasesTransfertDepreciation)(melange, ligne28);
        expect(p).toContain(`${fr(150)} en reprise`);
        expect(p).toContain('(exploitation et H.A.O.)');
    });
    it('un transfert au brouillard n’est pas dans les colonnes · dit à part, jamais compté', () => {
        const phrases = (0, transfert_depreciation_note_1.phrasesTransfertDepreciation)([...transfert(1_000, '29390000', '29310000'), ...transfert(300, '29490000', '29440000', false, false)], ligne28);
        expect(phrases[0]).toContain(`${fr(1_000)} en reprise`);
        expect(phrases[1]).toContain(`au brouillard · ${fr(300)} en reprise et ${fr(300)} en dotation`);
    });
    it('aucun transfert · aucune phrase', () => {
        expect((0, transfert_depreciation_note_1.phrasesTransfertDepreciation)([], ligne28)).toEqual([]);
    });
    it('un rattachement du dossier prime sur la racine du modèle', () => {
        expect((0, transfert_depreciation_note_1.rubriqueQuiLit)('29190000', rubriques5F, [{ libelle: 'Brevets, licences et droits similaires', comptesRattaches: ['29190000'] }])).toBe('Brevets, licences et droits similaires');
    });
});
//# sourceMappingURL=transfert-depreciation-note.spec.js.map