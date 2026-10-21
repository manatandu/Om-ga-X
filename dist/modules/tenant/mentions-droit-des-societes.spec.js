"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const mentions_societe_1 = require("./mentions-societe");
const mentions_immatriculation_1 = require("./mentions-immatriculation");
const forme_applicable_1 = require("./forme-applicable");
const tenant_service_1 = require("./tenant.service");
const base = {
    referentiel: client_1.Referentiel.SYSCOHADA,
    nom: 'Démo',
    capitalSocial: 10000000,
    capitalVariable: false,
    adresse: '12, avenue du Commerce',
    ville: 'Kinshasa',
    rccm: 'CD/KIN/RCCM/24-B-00001',
    devise: 'CDF',
};
describe('SA · le mode d’administration fait partie de la forme (art. 386 et 414)', () => {
    const sa = { ...base, formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME };
    it('déclaré, il s’imprime avec la forme', () => {
        expect((0, mentions_societe_1.mentionsArticle17)({ ...sa, modeAdministrationSa: 'CONSEIL_ADMINISTRATION' }).ligne).toMatch(/^Société anonyme avec conseil d’administration · au capital/);
        expect((0, mentions_societe_1.mentionsArticle17)({ ...sa, modeAdministrationSa: 'ADMINISTRATEUR_GENERAL' }).ligne).toMatch(/^Société anonyme avec administrateur général · /);
        expect((0, mentions_societe_1.mentionsArticle17)({ ...sa, modeAdministrationSa: 'ADMINISTRATEUR_GENERAL' }).manquantes).toEqual([]);
    });
    it('non déclaré, le manque est dit · jamais un mode présumé', () => {
        const m = (0, mentions_societe_1.mentionsArticle17)({ ...sa, modeAdministrationSa: null });
        expect(m.ligne).toMatch(/^Société anonyme · au capital/);
        expect(m.manquantes).toContain('mode d’administration de la société anonyme (AUSCGIE art. 386 et 414)');
    });
    it('n’est pas réclamé à la SAS, que l’art. 853-3 exclut des art. 414 à 561', () => {
        const m = (0, mentions_societe_1.mentionsArticle17)({
            ...base,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
            associeUnique: false,
        });
        expect(m.manquantes).toEqual([]);
    });
});
describe('SAS · l’associé unique fait une SASU (art. 853-2, al. 2)', () => {
    const sas = { ...base, formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE };
    it('« société par actions simplifiée unipersonnelle » quand l’associé est unique', () => {
        expect((0, mentions_societe_1.mentionsArticle17)({ ...sas, associeUnique: true }).ligne).toMatch(/^Société par actions simplifiée unipersonnelle · /);
    });
    it('pas encore dit · la ligne ne change pas, le manque se dit', () => {
        const m = (0, mentions_societe_1.mentionsArticle17)({ ...sas, associeUnique: null });
        expect(m.ligne).toMatch(/^Société par actions simplifiée · /);
        expect(m.manquantes).toContain('associé unique ou non (AUSCGIE art. 853-2)');
    });
});
describe('Société en liquidation · art. 204', () => {
    const sarl = {
        ...base,
        formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
        dateDissolution: new Date('2026-03-01'),
    };
    it('la mention et le liquidateur précèdent la ligne de l’art. 17', () => {
        const m = (0, mentions_societe_1.mentionsEmetteur)({ ...sarl, liquidateurs: 'Me Kabila Mwamba' }, new Date('2026-04-01'));
        expect(m.ligne).toMatch(/^Société en liquidation · liquidateur\(s\) : Me Kabila Mwamba · Société à responsabilité limitée/);
    });
    it('un liquidateur non nommé se dit, il n’est pas inventé', () => {
        const m = (0, mentions_societe_1.mentionsEmetteur)({ ...sarl, liquidateurs: null }, new Date('2026-04-01'));
        expect(m.ligne).toMatch(/^Société en liquidation · Société à responsabilité limitée/);
        expect(m.manquantes).toContain('nom du ou des liquidateurs (AUSCGIE art. 204)');
    });
    it('une pièce antérieure à la dissolution ne la porte pas, et une société non dissoute non plus', () => {
        expect((0, mentions_societe_1.mentionLiquidation)({ ...sarl, liquidateurs: 'X' }, new Date('2026-02-01')).ligne).toBeNull();
        expect((0, mentions_societe_1.mentionLiquidation)({ ...sarl, dateDissolution: null, liquidateurs: 'X' }).ligne).toBeNull();
    });
});
describe('GIE · « groupement d’intérêt économique » après la dénomination (art. 876)', () => {
    it('la ligne du GIE porte sa nature, avant le RCCM', () => {
        const m = (0, mentions_immatriculation_1.mentionImmatriculation)({
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE,
            rccm: 'CD/KIN/RCCM/24-C-00002',
        });
        expect(m.ligne).toBe('Groupement d’intérêt économique · RCCM CD/KIN/RCCM/24-C-00002');
    });
    it('sans RCCM, la nature reste imprimée et le RCCM est dit manquant', () => {
        const m = (0, mentions_immatriculation_1.mentionImmatriculation)({
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE,
            rccm: null,
        });
        expect(m.ligne).toBe('Groupement d’intérêt économique');
        expect(m.manquantes).toHaveLength(1);
    });
});
describe('La forme d’un exercice est celle qu’il avait (art. 182 et 183, passe O1a, D3)', () => {
    const t = {
        formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
        formeJuridiqueSyscohadaAnterieure: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
        dateTransformationForme: new Date('2027-05-15'),
    };
    it('un exercice clos avant la décision garde l’ancienne forme', () => {
        expect((0, forme_applicable_1.formeApplicable)(t, new Date('2025-12-31'))).toBe(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        expect((0, forme_applicable_1.formeApplicable)(t, new Date('2026-12-31'))).toBe(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
    });
    it('l’exercice au cours duquel elle intervient suit la nouvelle forme (art. 183, al. 2)', () => {
        expect((0, forme_applicable_1.formeApplicable)(t, new Date('2027-12-31'))).toBe(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        expect((0, forme_applicable_1.exerciceDeTransformation)(t, { dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') })).toBe(true);
        expect((0, forme_applicable_1.exerciceDeTransformation)(t, { dateDebut: new Date('2028-01-01'), dateFin: new Date('2028-12-31') })).toBe(false);
    });
    it('une correction sans date vaut pour tous les exercices', () => {
        expect((0, forme_applicable_1.formeApplicable)({ formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME }, new Date('2020-12-31'))).toBe(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
    });
    it('une transformation n’existe qu’entre sociétés commerciales, et ne se date pas dans le futur', () => {
        const auj = new Date('2027-06-01');
        expect((0, forme_applicable_1.motifRefusTransformation)(client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, new Date('2027-01-01'), auj)).toContain('art. 188');
        expect((0, forme_applicable_1.motifRefusTransformation)(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, new Date('2027-07-01'), auj)).toContain('art. 182');
        expect((0, forme_applicable_1.motifRefusTransformation)(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, new Date('2027-05-15'), auj)).toBeNull();
    });
});
describe('Les faits de la dénomination se déclarent à la route, chacun à sa forme', () => {
    const service = (forme, capture = {}) => new tenant_service_1.TenantService({
        tenant: {
            findUnique: async () => ({ id: 't1', referentiel: client_1.Referentiel.SYSCOHADA, formeJuridiqueSyscohada: forme }),
            update: async ({ data }) => {
                capture.data = data;
                return {};
            },
        },
        ecriture: { count: async () => 0 },
        compte: { findMany: async () => [] },
    });
    it('le mode d’administration n’est reçu que d’une SA', async () => {
        await expect(service(client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE).modifierIdentite('t1', {
            modeAdministrationSa: 'CONSEIL_ADMINISTRATION',
        })).rejects.toThrow(/art\. 386 et 414/);
        const capture = {};
        await service(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, capture).modifierIdentite('t1', {
            modeAdministrationSa: 'ADMINISTRATEUR_GENERAL',
        });
        expect(capture.data.modeAdministrationSa).toBe('ADMINISTRATEUR_GENERAL');
    });
    it('l’associé unique est reçu d’une SARL, d’une SA ou d’une SAS, et d’elles seules (paquet 1, C4)', async () => {
        for (const forme of [
            client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
            client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
        ]) {
            const capture = {};
            await service(forme, capture).modifierIdentite('t1', { associeUnique: 'OUI' });
            expect(capture.data.associeUnique).toBe(true);
        }
        await expect(service(client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF).modifierIdentite('t1', { associeUnique: 'OUI' })).rejects.toThrow(/SARL, une SA ou une SAS/);
    });
    it('la dissolution d’une société commerciale se déclare, jamais dans le futur', async () => {
        const capture = {};
        await service(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, capture).modifierIdentite('t1', {
            dateDissolution: '2026-03-01',
            liquidateurs: ' Me Kabila ',
        });
        expect([capture.data.dateDissolution.toISOString().slice(0, 10), capture.data.liquidateurs]).toEqual([
            '2026-03-01',
            'Me Kabila',
        ]);
        await expect(service(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE).modifierIdentite('t1', { dateDissolution: '2999-01-01' })).rejects.toThrow(/art\. 204/);
        await expect(service(client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE).modifierIdentite('t1', { dateDissolution: '2026-03-01' })).rejects.toThrow(/art\. 203 et 204/);
    });
    it('une transformation garde la forme d’avant et sa date · une correction n’y touche pas', async () => {
        const capture = {};
        await service(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, capture).modifierFormeSyscohada('t1', client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, '2026-05-15');
        expect(capture.data.formeJuridiqueSyscohadaAnterieure).toBe(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        expect(capture.data.dateTransformationForme.toISOString().slice(0, 10)).toBe('2026-05-15');
        const correction = {};
        await service(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, correction).modifierFormeSyscohada('t1', client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        expect(correction.data).toEqual({ formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME });
        await expect(service(client_1.FormeJuridiqueSyscohada.ENTREPRENANT).modifierFormeSyscohada('t1', client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, '2026-05-15')).rejects.toThrow(/art\. 188/);
    });
});
//# sourceMappingURL=mentions-droit-des-societes.spec.js.map