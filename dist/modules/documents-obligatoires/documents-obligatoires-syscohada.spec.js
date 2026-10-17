"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const correspondance_inventaire_syscohada_1 = require("./correspondance-inventaire-syscohada");
const correspondance_inventaire_1 = require("./correspondance-inventaire");
describe('livre d’inventaire · AUDCIF art. 19', () => {
    it('transcrit les trois états que l’article nomme, dans son ordre', () => {
        expect(correspondance_inventaire_syscohada_1.ETATS_INVENTAIRE_SYSTEME_NORMAL.map((e) => e.libelle)).toEqual([
            'Bilan',
            'Compte de résultat',
            'Tableau des flux de trésorerie',
        ]);
    });
    it('écarte le tableau des flux au Système minimal de trésorerie', () => {
        expect(correspondance_inventaire_syscohada_1.ETATS_INVENTAIRE_SMT_SYSCOHADA.map((e) => e.cle)).toEqual(['bilan', 'compteDeResultat']);
        expect((0, correspondance_inventaire_syscohada_1.etatsExigesParSysteme)(client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE)).toBe(correspondance_inventaire_syscohada_1.ETATS_INVENTAIRE_SMT_SYSCOHADA);
        expect((0, correspondance_inventaire_syscohada_1.etatsExigesParSysteme)(client_1.SystemeComptableSyscohada.NORMAL)).toBe(correspondance_inventaire_syscohada_1.ETATS_INVENTAIRE_SYSTEME_NORMAL);
        expect((0, correspondance_inventaire_syscohada_1.etatsExigesParSysteme)(null)).toBe(correspondance_inventaire_syscohada_1.ETATS_INVENTAIRE_SYSTEME_NORMAL);
    });
});
describe('rapport de gestion · ce que les trois textes ne partagent PAS', () => {
    it('l’AUSCOOP ne demande PAS les événements postérieurs à la clôture', () => {
        expect(correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCGIE.map((s) => s.cle)).toContain('evenementsPosterieurs');
        expect(correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCOOP.map((s) => s.cle)).not.toContain('evenementsPosterieurs');
    });
    it('l’AUSCOOP demande EN PLUS l’état de promotion des coopérateurs', () => {
        expect(correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCOOP.map((s) => s.cle)).toContain('promotionCooperateurs');
        expect(correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCGIE.map((s) => s.cle)).not.toContain('promotionCooperateurs');
    });
    it('l’AUSCGIE nomme six choses, transcrites en six sections', () => {
        expect(correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCGIE).toHaveLength(6);
        expect(correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCGIE.map((s) => s.cle)).toEqual([
            'situationExerciceEcoule',
            'evolutionPrevisible',
            'evenementsPosterieurs',
            'continuationActivite',
            'evolutionTresorerie',
            'planFinancement',
        ]);
    });
    it('le rapport d’activité SYCEBNL reste à QUATRE sections, distinctes', () => {
        expect(correspondance_inventaire_1.SECTIONS_RAPPORT_ACTIVITE).toHaveLength(4);
        const sycebnl = new Set(correspondance_inventaire_1.SECTIONS_RAPPORT_ACTIVITE.map((s) => s.cle));
        const communes = correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCGIE.filter((s) => sycebnl.has(s.cle)).map((s) => s.cle);
        expect(communes.sort()).toEqual(['evenementsPosterieurs', 'evolutionTresorerie', 'situationExerciceEcoule']);
    });
    it('chaque section cite le texte qui la fonde, et le BON', () => {
        for (const s of correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCGIE) {
            expect([s.cle, s.exigence.startsWith('AUSCGIE art. 138')]).toEqual([s.cle, true]);
        }
        for (const s of correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCOOP) {
            const article = s.cle === 'modificationsPresentationMethodes' ? 'AUSCOOP art. 111' : 'AUSCOOP art. 108';
            expect([s.cle, s.exigence.startsWith(article)]).toEqual([s.cle, true]);
        }
    });
    it('l’AUSCOOP art. 111 · les modifications de présentation ou de méthodes ont leur section, exigée toujours', () => {
        expect(correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCOOP.map((s) => s.cle)).toContain('modificationsPresentationMethodes');
        expect(correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCOOP).toHaveLength(7);
        expect(correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCGIE.map((s) => s.cle)).not.toContain('modificationsPresentationMethodes');
    });
});
describe('qui doit établir un rapport de gestion', () => {
    it('les cinq sociétés commerciales · AUSCGIE art. 138', () => {
        for (const forme of [
            client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
            client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
            client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF,
            client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE,
        ]) {
            const regle = (0, correspondance_inventaire_syscohada_1.regleRapportGestion)(forme);
            expect([forme, regle.genre]).toEqual([forme, 'EXIGE']);
            const attendues = [
                ...correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCGIE,
                correspondance_inventaire_syscohada_1.SECTION_MODIFICATIONS_AUSCGIE,
                ...(forme === client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME ? [correspondance_inventaire_syscohada_1.SECTION_PARTICIPATION_SALARIES_SA] : []),
            ];
            expect([forme, regle.genre === 'EXIGE' && regle.sections]).toEqual([forme, attendues]);
        }
    });
    it('l’art. 141 · les modifications de présentation ou de méthodes, pour les cinq sociétés (passe O1a, C5)', () => {
        expect(correspondance_inventaire_syscohada_1.SECTION_MODIFICATIONS_AUSCGIE.exigence.startsWith('AUSCGIE art. 141')).toBe(true);
        expect(correspondance_inventaire_syscohada_1.SECTION_MODIFICATIONS_AUSCGIE.exigence).toContain('Néant');
    });
    it('l’art. 547-1 · la participation des salariés au capital, SA seule (passe O1b, C2)', () => {
        const sa = (0, correspondance_inventaire_syscohada_1.regleRapportGestion)(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        const sas = (0, correspondance_inventaire_syscohada_1.regleRapportGestion)(client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE);
        expect(sa.genre === 'EXIGE' && sa.sections.map((s) => s.cle)).toContain('participationSalariesCapital');
        expect(sas.genre === 'EXIGE' && sas.sections.map((s) => s.cle)).not.toContain('participationSalariesCapital');
        expect(correspondance_inventaire_syscohada_1.SECTION_PARTICIPATION_SALARIES_SA.exigence.startsWith('AUSCGIE art. 547-1')).toBe(true);
    });
    it('la coopérative relève de son PROPRE texte, pas de l’AUSCGIE', () => {
        const regle = (0, correspondance_inventaire_syscohada_1.regleRapportGestion)(client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE);
        expect(regle.genre).toBe('EXIGE');
        expect(regle.genre === 'EXIGE' && regle.source).toContain('AUSCOOP');
        expect(regle.genre === 'EXIGE' && regle.sections).toBe(correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCOOP);
    });
    it('le GIE · AUCUNE règle lue, et on le dit', () => {
        const regle = (0, correspondance_inventaire_syscohada_1.regleRapportGestion)(client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE);
        expect(regle.genre).toBe('AUCUNE_REGLE_LUE');
        expect(regle.genre === 'AUCUNE_REGLE_LUE' && regle.motif).toContain('contrat');
    });
    it('le commerçant personne physique et l’entreprenant · AUCUNE règle lue', () => {
        for (const forme of [client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE, null]) {
            const regle = (0, correspondance_inventaire_syscohada_1.regleRapportGestion)(forme);
            expect([String(forme), regle.genre]).toEqual([String(forme), 'AUCUNE_REGLE_LUE']);
            expect(regle.genre === 'AUCUNE_REGLE_LUE' && regle.motif).toContain("livre d'inventaire");
        }
    });
});
//# sourceMappingURL=documents-obligatoires-syscohada.spec.js.map