"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const champs_audites_1 = require("./champs-audites");
const MODELES_DU_SCHEMA = client_1.Prisma.dmmf.datamodel.models.map((m) => m.name);
describe('classement des modèles au journal d’audit', () => {
    it('le schéma porte bien des modèles · un recensement vide ne vérifierait rien', () => {
        expect(MODELES_DU_SCHEMA.length).toBeGreaterThan(100);
    });
    it.each(MODELES_DU_SCHEMA)('%s est journalisé OU exempté avec son motif, jamais les deux', (modele) => {
        const audite = champs_audites_1.MODELES_AUDITES.has(modele);
        const exempte = Object.prototype.hasOwnProperty.call(champs_audites_1.NON_AUDITES_MOTIVES, modele);
        expect([modele, audite !== exempte]).toEqual([modele, true]);
    });
    it('aucune entrée ne nomme un modèle que le schéma ne porte plus', () => {
        const connus = new Set(MODELES_DU_SCHEMA);
        const perimes = [...champs_audites_1.MODELES_AUDITES, ...Object.keys(champs_audites_1.NON_AUDITES_MOTIVES)].filter((m) => !connus.has(m));
        expect(perimes).toEqual([]);
    });
    it.each(Object.entries(champs_audites_1.NON_AUDITES_MOTIVES))('le motif de %s est écrit', (modele, motif) => {
        expect([modele, motif.trim().length > 20]).toEqual([modele, true]);
    });
    it('les quinze tables relevées par l’audit serveur (point I4) sont TRANCHÉES', () => {
        for (const m of [
            'DotationAmortissement',
            'AmortissementDerogatoire',
            'ReclassementImmobilisation',
            'DepreciationImmobilisation',
            'Facture',
            'Consignation',
            'MouvementStock',
            'EngagementDepense',
            'ExecutionEngagement',
            'ConventionFinancement',
            'DossierFiscalExercice',
            'LotVirement',
            'CoursDevise',
            'ModeleReglement',
            'MandatAuditeur',
        ]) {
            expect([m, champs_audites_1.MODELES_AUDITES.has(m) || m in champs_audites_1.NON_AUDITES_MOTIVES]).toEqual([m, true]);
        }
    });
    it('un modèle journalisé qui porte une colonne BINAIRE l’exclut nommément', () => {
        const oublis = client_1.Prisma.dmmf.datamodel.models
            .filter((m) => champs_audites_1.MODELES_AUDITES.has(m.name))
            .flatMap((m) => m.fields
            .filter((f) => f.kind === 'scalar' && f.type === 'Bytes')
            .filter((f) => !(champs_audites_1.COLONNES_EXCLUES_PAR_MODELE[m.name] ?? []).includes(f.name))
            .map((f) => `${m.name}.${f.name}`));
        expect(oublis).toEqual([]);
    });
});
//# sourceMappingURL=classement-modeles.spec.js.map