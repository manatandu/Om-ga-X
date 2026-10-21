"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const situation_intermediaire_1 = require("./situation-intermediaire");
const EXERCICE_2026 = { dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') };
const EXERCICE_2025 = { dateDebut: new Date('2025-01-01T00:00:00Z'), dateFin: new Date('2025-12-31T00:00:00Z') };
describe('la date d’arrêté d’une situation intermédiaire', () => {
    it('accepte une date à l’intérieur de l’exercice', () => {
        expect((0, situation_intermediaire_1.motifRefusDateArrete)(new Date('2026-06-30T23:59:59Z'), EXERCICE_2026)).toBeNull();
    });
    it('REFUSE une date antérieure à l’ouverture, et dit pourquoi', () => {
        const motif = (0, situation_intermediaire_1.motifRefusDateArrete)(new Date('2025-12-31T23:59:59Z'), EXERCICE_2026);
        expect(motif).toContain('report à-nouveau');
        expect(motif).toContain('2026-01-01');
    });
    it('accepte le DERNIER jour de l’exercice, lu à la fin de sa journée (audit final F90)', () => {
        expect((0, situation_intermediaire_1.motifRefusDateArrete)((0, situation_intermediaire_1.finDeJournee)(new Date('2026-12-31T00:00:00Z')), EXERCICE_2026)).toBeNull();
    });
    it('refuse une date postérieure à la clôture, et dit pourquoi', () => {
        const motif = (0, situation_intermediaire_1.motifRefusDateArrete)(new Date('2027-03-01T23:59:59Z'), EXERCICE_2026);
        expect(motif).toContain('après la clôture');
        expect(motif).toContain('2026-12-31');
    });
    it('lit la date à la FIN de la journée', () => {
        const borne = (0, situation_intermediaire_1.finDeJournee)(new Date('2026-06-30T00:00:00Z'));
        expect(borne.toISOString()).toBe('2026-06-30T23:59:59.999Z');
    });
});
describe('la MÊME PÉRIODE de l’exercice précédent · § 2.1.2, deuxième tiret', () => {
    it('rend le même jour du même mois sur l’exercice précédent', () => {
        const equivalent = (0, situation_intermediaire_1.memePeriodeExercicePrecedent)(new Date('2026-06-30T23:59:59Z'), EXERCICE_2025);
        expect(equivalent?.toISOString().slice(0, 10)).toBe('2025-06-30');
    });
    it('n’en rend AUCUNE quand il n’y a pas d’exercice précédent', () => {
        expect((0, situation_intermediaire_1.memePeriodeExercicePrecedent)(new Date('2026-06-30T23:59:59Z'), null)).toBeNull();
    });
    it('n’en rend aucune quand la période équivalente tombe hors de l’exercice précédent', () => {
        const premierExerciceCourt = {
            dateDebut: new Date('2025-09-01T00:00:00Z'),
            dateFin: new Date('2025-12-31T23:59:59Z'),
        };
        expect((0, situation_intermediaire_1.memePeriodeExercicePrecedent)(new Date('2026-06-30T23:59:59Z'), premierExerciceCourt)).toBeNull();
        expect((0, situation_intermediaire_1.memePeriodeExercicePrecedent)(new Date('2026-10-15T23:59:59Z'), premierExerciceCourt)?.toISOString().slice(0, 10)).toBe('2025-10-15');
    });
});
describe('ce que la situation DIT d’elle-même', () => {
    it('porte la déclaration du § 2.1.1 sur les méthodes comptables', () => {
        expect(situation_intermediaire_1.DECLARATION_METHODES_IDENTIQUES).toContain('identiques à celles utilisées dans les comptes');
        expect(situation_intermediaire_1.DECLARATION_METHODES_IDENTIQUES).toContain('pro-forma');
        expect(situation_intermediaire_1.DECLARATION_METHODES_IDENTIQUES).toContain('§ 2.1.1');
    });
    it('DIT qu’elle n’est pas un jeu complet, et ce qui manque', () => {
        expect(situation_intermediaire_1.RESERVE_JEU_INCOMPLET).toContain('n’est pas un jeu complet');
        for (const mention of ['éléments exceptionnels', 'estimation', 'parties liées', 'saisonnier']) {
            expect(situation_intermediaire_1.RESERVE_JEU_INCOMPLET).toContain(mention);
        }
    });
});
describe('la borne traverse tout le chemin, de la balance aux trois états', () => {
    const lire = (chemin) => (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', '..', '..', chemin), 'utf8');
    const balance = lire('src/modules/comptabilite/ecriture.service.ts');
    const communs = lire('src/modules/etats-financiers/etats-financiers.communs.ts');
    const etats = lire('src/modules/etats-financiers-syscohada/etats-financiers-syscohada.service.ts');
    const controleur = lire('src/modules/etats-financiers-syscohada/etats-financiers-syscohada.controller.ts');
    it('la balance accepte une date d’arrêté et en fait un filtre sur la DATE COMPTABLE', () => {
        expect(balance).toContain('arreteAu?: Date');
        expect(balance).toContain('...(arreteAu ? { date: { lte: arreteAu } } : {})');
    });
    it('le chargement commun la transmet à la balance', () => {
        expect(communs).toContain('arreteAu?: Date');
        expect(communs).toContain('balance(tenantId, exerciceId, false, arreteAu)');
    });
    it('les TROIS états la prennent · bilan, compte de résultat, tableau des flux', () => {
        expect(etats).toContain('async bilan(tenantId: string, exerciceId: string, arreteAu?: string)');
        expect(etats).toMatch(/async compteDeResultat\(\s*tenantId: string,\s*exerciceId: string,\s*arreteAu\?: string,/);
        expect(etats).toMatch(/async tableauFluxTresorerie\(\s*tenantId: string,\s*exerciceId: string,\s*arreteAu\?: string,/);
    });
    it('SEULE la colonne N est bornée · le § 2.1.2 veut la CLÔTURE en comparatif', () => {
        const corps = (nom) => {
            const debut = etats.indexOf(`async ${nom}(`);
            expect(debut).toBeGreaterThan(0);
            const fin = etats.indexOf('\n  }', debut);
            return etats.slice(debut, fin);
        };
        for (const nom of ['bilan', 'compteDeResultat', 'tableauFluxTresorerie']) {
            const bloc = corps(nom);
            expect([nom, bloc.includes('this.chargerLignes(tenantId, exerciceId, borneN)')]).toEqual([nom, true]);
            expect([nom, bloc.includes('exerciceN1Id, borneN')]).toEqual([nom, false]);
            expect([nom, bloc.includes('this.chargerLignes(tenantId, exerciceN1Id),')]).toEqual([nom, true]);
        }
    });
    it('les trois routes exposent la date, et une seule des trois ouvre la colonne comparative', () => {
        expect((controleur.match(/@Query\('arreteAu'\) arreteAu\?: string/g) ?? [])).toHaveLength(3);
        expect(etats).toContain('borneMemePeriodeN1');
    });
});
//# sourceMappingURL=situation-intermediaire.spec.js.map