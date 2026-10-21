"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const regles_affectation_1 = require("./regles-affectation");
describe('Réserve légale · SYSCOHADA', () => {
    const cas = (p) => (0, regles_affectation_1.dotationReserveLegale)({
        referentiel: client_1.Referentiel.SYSCOHADA,
        forme: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
        benefice: 0,
        pertesAnterieures: 0,
        reserveExistante: 0,
        capitalSocial: 10_000_000,
        ...p,
    });
    it('dote un dixième du bénéfice quand rien ne s’y oppose', () => {
        const r = cas({ benefice: 3_000_000 });
        expect(r.dotation).toBe(300_000);
        expect(r.motif).toContain('dixième');
    });
    it('déduit d’abord les pertes antérieures de l’assiette', () => {
        const r = cas({ benefice: 3_000_000, pertesAnterieures: 1_000_000 });
        expect(r.dotation).toBe(200_000);
    });
    it('ne dote rien si les pertes antérieures absorbent le bénéfice', () => {
        const r = cas({ benefice: 1_000_000, pertesAnterieures: 1_200_000 });
        expect(r.dotation).toBeNull();
        expect(r.motif).toContain('ne laisse rien');
    });
    it('ne dote rien sur un exercice déficitaire', () => {
        const r = cas({ benefice: 0 });
        expect(r.dotation).toBeNull();
    });
    it('cesse d’être obligatoire au cinquième du CAPITAL SOCIAL', () => {
        const r = cas({ benefice: 5_000_000, reserveExistante: 2_000_000 });
        expect(r.dotation).toBeNull();
        expect(r.motif).toContain('cinquième du capital social');
    });
    it('plafonne la dotation à ce qui manque pour atteindre le cinquième', () => {
        const r = cas({ benefice: 3_000_000, reserveExistante: 1_950_000 });
        expect(r.dotation).toBe(50_000);
    });
    it('dote le dixième entier quand le capital n’est pas renseigné', () => {
        const r = cas({ benefice: 3_000_000, capitalSocial: 0 });
        expect(r.dotation).toBe(300_000);
    });
});
describe('Réserve légale · SYCEBNL', () => {
    it('n’existe pas · l’AUSCGIE ne régit pas une entité à but non lucratif', () => {
        const r = (0, regles_affectation_1.dotationReserveLegale)({
            referentiel: client_1.Referentiel.SYCEBNL,
            forme: null,
            benefice: 5_000_000,
            pertesAnterieures: 0,
            reserveExistante: 0,
            capitalSocial: 0,
        });
        expect(r.dotation).toBeNull();
        expect(r.motif).toContain('sociétés commerciales');
    });
    it('la table ne porte pas de réserve légale pour ce référentiel', () => {
        expect(regles_affectation_1.REGLES[client_1.Referentiel.SYCEBNL].reserveLegale).toBeUndefined();
        expect(regles_affectation_1.REGLES[client_1.Referentiel.SYSCOHADA].reserveLegale).toBe('111');
    });
    it('et aucun capital n’y est lu · le compte 10 du SYCEBNL est une DOTATION', () => {
        expect((0, regles_affectation_1.racineCapital)(client_1.Referentiel.SYCEBNL, null)).toBeNull();
    });
});
describe('Destinations du résultat · une liste par sens, lue dans les fiches (passe R1, A3)', () => {
    const syscohada = regles_affectation_1.REGLES[client_1.Referentiel.SYSCOHADA];
    it('un bénéfice va aux 101, 103, 11, 12 et 465 que la fiche du compte 13 nomme', () => {
        expect([...syscohada.destinationsBenefice.racines].sort()).toEqual(['101', '103', '11', '12', '465']);
        expect(syscohada.destinationsBenefice.source).toContain('465 (Associés, dividendes à payer)');
    });
    it('une perte ne se porte jamais au 465, et le 105 l’absorbe par sa propre fiche', () => {
        expect([...syscohada.destinationsPerte.racines].sort()).toEqual(['101', '103', '105', '11', '12']);
        expect(syscohada.destinationsPerte.source).toContain('compte 105');
    });
    it('le sens choisit sa liste', () => {
        expect((0, regles_affectation_1.destinationsDuSens)(syscohada, true)).toBe(syscohada.destinationsBenefice);
        expect((0, regles_affectation_1.destinationsDuSens)(syscohada, false)).toBe(syscohada.destinationsPerte);
    });
});
describe('Ligne au capital social · avertie, jamais refusée (passe O1b, D2)', () => {
    it('SA · augmentation par l’AGE (art. 564), réduction à défaut de rapport du commissaire nulle (art. 630)', () => {
        expect((0, regles_affectation_1.avertissementLigneCapital)(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, true)).toContain('art. 564');
        expect((0, regles_affectation_1.avertissementLigneCapital)(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, false)).toContain('art. 630');
    });
    it('SAS · décision collective des associés (art. 853-11, al. 2) · SARL · art. 360 et 358', () => {
        expect((0, regles_affectation_1.avertissementLigneCapital)(client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, true)).toContain('art. 853-11, al. 2');
        expect((0, regles_affectation_1.avertissementLigneCapital)(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, true)).toContain('art. 360');
        expect((0, regles_affectation_1.avertissementLigneCapital)(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, false)).toContain('art. 358');
    });
});
describe('Destinations du résultat · les deux plans ne les offrent pas toutes', () => {
    it('le SYCEBNL ne connaît pas les dividendes', () => {
        expect(regles_affectation_1.REGLES[client_1.Referentiel.SYCEBNL].destinationsBenefice.racines).not.toContain('465');
        expect(regles_affectation_1.REGLES[client_1.Referentiel.SYCEBNL].destinationsPerte.racines).not.toContain('465');
        expect(regles_affectation_1.REGLES[client_1.Referentiel.SYCEBNL].interdits.map((i) => i.racine)).toContain('465');
    });
    it('le SYSCOHADA les connaît · 465 Associés, dividendes à payer', () => {
        expect(regles_affectation_1.REGLES[client_1.Referentiel.SYSCOHADA].destinationsBenefice.racines).toContain('465');
        expect(regles_affectation_1.REGLES[client_1.Referentiel.SYSCOHADA].interdits.map((i) => i.racine)).not.toContain('465');
    });
    it('les DEUX plans refusent l’écart de réévaluation · racine 106 (passe F6)', () => {
        for (const r of Object.values(regles_affectation_1.REGLES)) {
            expect(r.interdits.map((i) => i.racine)).toContain('106');
            const motif = r.interdits.find((i) => i.racine === '106').motif;
            expect(motif).toContain('art. 133, alinéa 4');
            expect(motif).toContain('AUDCIF, art. 65');
            expect(motif).toContain('compensation des pertes');
        }
    });
    it('les deux soldent le 13 par la classe 1, et le report à nouveau y est toujours', () => {
        for (const r of Object.values(regles_affectation_1.REGLES)) {
            expect(r.reportANouveau).toBe('12');
            for (const sens of [r.destinationsBenefice, r.destinationsPerte]) {
                expect(sens.racines).toContain('11');
                expect(sens.racines).toContain('12');
            }
        }
    });
});
describe('Réserve légale · quelles formes le texte vise', () => {
    const dote = (forme) => (0, regles_affectation_1.dotationReserveLegale)({
        referentiel: client_1.Referentiel.SYSCOHADA,
        forme,
        benefice: 3_000_000,
        pertesAnterieures: 0,
        reserveExistante: 0,
        capitalSocial: 10_000_000,
    });
    it('la SARL dote · art. 346, et le motif cite CET article', () => {
        const r = dote(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        expect(r.dotation).toBe(300_000);
        expect(r.motif).toContain('art. 346');
        expect(r.motif).not.toContain('546');
    });
    it('la coopérative voit aussi les art. 115 et 116 (constat O6-B7)', () => {
        const regime = (0, regles_affectation_1.regimeReserveLegale)(client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE);
        expect(regime.source).toBe('AUSCOOP, art. 113 à 116');
        expect('motif' in regime && regime.motif).toContain('« vingt pour cent des excédents nets » (art. 115)');
        expect('motif' in regime && regime.motif).toContain('réserve de formation » (art. 116)');
    });
    it('la SA dote · art. 546, 2°, et le motif cite CET article', () => {
        const r = dote(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        expect(r.dotation).toBe(300_000);
        expect(r.motif).toContain('art. 546, 2°');
        expect(r.motif).not.toContain('346');
    });
    it.each([
        [client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, '853-3'],
        [client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF, 'nom collectif'],
        [client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE, '293-1'],
        [client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE, '869'],
        [client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE, 'AUSCOOP'],
        [client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE, 'AUDCG'],
        [client_1.FormeJuridiqueSyscohada.ENTREPRENANT, 'AUDCG'],
        [client_1.FormeJuridiqueSyscohada.SUCCURSALE, '117'],
        [client_1.FormeJuridiqueSyscohada.ENTITE_PUBLIQUE, '102'],
        [client_1.FormeJuridiqueSyscohada.AUTRE, 'Autre'],
    ])('%s ne dote pas, et le motif dit ce qui a été lu', (forme, attendu) => {
        const r = dote(forme);
        expect(r.dotation).toBeNull();
        expect(r.motif).toContain(attendu);
    });
    it('une forme non renseignée ne dote pas · le logiciel ne présume pas une SARL', () => {
        const r = dote(null);
        expect(r.dotation).toBeNull();
        expect(r.motif).toContain("n'est pas renseignée");
    });
    it('le GIE sans capital ne se voit pas réclamer le dixième plein', () => {
        const r = (0, regles_affectation_1.dotationReserveLegale)({
            referentiel: client_1.Referentiel.SYSCOHADA,
            forme: client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE,
            benefice: 3_000_000,
            pertesAnterieures: 0,
            reserveExistante: 0,
            capitalSocial: 0,
        });
        expect(r.dotation).toBeNull();
    });
    it('la coopérative n’est pas traitée en société commerciale', () => {
        const r = dote(client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE);
        expect(r.dotation).toBeNull();
        expect(r.motif).toContain('vingt pour cent');
        expect(r.motif).toContain('art. 114');
        expect(r.motif).not.toContain('346');
        expect(r.motif).not.toContain('546');
    });
    it('chaque forme du schéma a un régime décidé · aucune ne tombe dans un trou', () => {
        for (const forme of Object.values(client_1.FormeJuridiqueSyscohada)) {
            const regime = (0, regles_affectation_1.regimeReserveLegale)(forme);
            expect(regime).toBeDefined();
            expect(regime.source.length).toBeGreaterThan(0);
            if (!regime.exigee)
                expect(regime.motif.length).toBeGreaterThan(0);
        }
    });
});
describe('Réserve légale · le capital se lit là où la forme le porte', () => {
    it.each([
        [client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, '101'],
        [client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, '101'],
        [client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE, '101'],
        [client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE, '103'],
        [client_1.FormeJuridiqueSyscohada.ENTREPRENANT, '103'],
        [client_1.FormeJuridiqueSyscohada.ENTITE_PUBLIQUE, '102'],
    ])('%s porte son capital au %s', (forme, racine) => {
        expect((0, regles_affectation_1.racineCapital)(client_1.Referentiel.SYSCOHADA, forme)).toBe(racine);
    });
    it('le GIE et la succursale n’ont pas de capital à lire', () => {
        expect((0, regles_affectation_1.racineCapital)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE)).toBeNull();
        expect((0, regles_affectation_1.racineCapital)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SUCCURSALE)).toBeNull();
    });
});
describe('La citation de l’art. 853-3 n’est pas tronquée (passe O1b, D6)', () => {
    it('le motif servi à une SAS porte toute la liste des exceptions', () => {
        const r = (0, regles_affectation_1.regimeReserveLegale)(client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE);
        expect(r.exigee).toBe(false);
        expect(!r.exigee && r.motif).toContain('414 à 561, 690, 751 à 753 ci-dessus');
    });
});
//# sourceMappingURL=reserve-legale.spec.js.map