"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const arret_dissolution_1 = require("./arret-dissolution");
const client_1 = require("@prisma/client");
const liquidation_societe_1 = require("./liquidation-societe");
const tenant_service_1 = require("../tenant/tenant.service");
const exercice_service_1 = require("./exercice.service");
const mentions_societe_1 = require("../tenant/mentions-societe");
const iso = (d) => (d === null ? null : d.toISOString().slice(0, 10));
const EX_2026 = { dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) };
const EX_2027 = { dateDebut: new Date(Date.UTC(2027, 0, 1)), dateFin: new Date(Date.UTC(2027, 11, 31)) };
const EX_2025 = { dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) };
const AUJOURDHUI = new Date(Date.UTC(2026, 9, 1));
const base = {
    forme: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
    dateDissolution: new Date(Date.UTC(2026, 4, 31)),
    dateNominationLiquidateur: new Date(Date.UTC(2026, 5, 15)),
    regimeLiquidation: null,
};
const parLibelle = (j) => new Map(j.map((x) => [x.libelle, x]));
describe('Liquidation d’une société commerciale au planning', () => {
    it('chapitre 1 · bilan avant liquidation SANS DÉLAI, publication à un mois, clôture à trois ans DATE À DATE', () => {
        const j = parLibelle((0, liquidation_societe_1.jalonsLiquidation)(base, EX_2026, AUJOURDHUI));
        const bilan = j.get('Bilan avant liquidation');
        expect(bilan.echeance).toBeNull();
        expect(bilan.sansDelai).toBe(true);
        expect(iso(bilan.debut)).toBe('2026-05-31');
        expect(bilan.enRetard).toBe(false);
        expect(bilan.detail).toContain('AUDCIF art. 39');
        expect(iso(j.get('Publication de la nomination du liquidateur').echeance)).toBe('2026-07-15');
        expect(j.get('Publication de la nomination du liquidateur').enRetard).toBe(true);
        expect(iso(j.get('Clôture de la liquidation').echeance)).toBe('2029-05-31');
        expect(j.has('Rapport du liquidateur à l’assemblée des associés')).toBe(false);
    });
    it('le lendemain de la dissolution et le lendemain de la clôture, rien n’est en retard sans délai au texte', () => {
        const lendemainDissolution = new Date(Date.UTC(2026, 5, 1));
        const bilan = parLibelle((0, liquidation_societe_1.jalonsLiquidation)(base, EX_2026, lendemainDissolution)).get('Bilan avant liquidation');
        expect(bilan.enRetard).toBe(false);
        const amiable = { ...base, regimeLiquidation: client_1.RegimeLiquidation.AMIABLE_STATUTAIRE };
        const lendemainCloture = new Date(Date.UTC(2027, 0, 1));
        const situation = parLibelle((0, liquidation_societe_1.jalonsLiquidation)(amiable, EX_2026, lendemainCloture)).get('Situation annuelle provisoire de liquidation');
        expect(situation.echeance).toBeNull();
        expect(situation.sansDelai).toBe(true);
        expect(iso(situation.debut)).toBe('2026-12-31');
        expect(situation.enRetard).toBe(false);
    });
    it('régime NON DÉCLARÉ · un jalon visible « à déclarer », non calculé, et rien d’autre de la liquidation n’est servi', () => {
        const parL = parLibelle((0, liquidation_societe_1.jalonsLiquidation)(base, EX_2026, AUJOURDHUI));
        const aDeclarer = parL.get('Régime de la liquidation à déclarer');
        expect(aDeclarer.echeance).toBeNull();
        expect(aDeclarer.sansDelai).toBeUndefined();
        expect(aDeclarer.observation).toBeUndefined();
        expect(parL.has('Situation annuelle provisoire de liquidation')).toBe(false);
        expect(parL.has('États financiers annuels et rapport écrit du liquidateur')).toBe(false);
        expect(parL.has('Assemblée des associés sur les états annuels de liquidation')).toBe(false);
    });
    it('le compte du résultat de liquidation est le 1384 du plan, jamais le « 1374 » du chapitre 40', () => {
        const bilan = parLibelle((0, liquidation_societe_1.jalonsLiquidation)(base, EX_2026, AUJOURDHUI)).get('Bilan avant liquidation');
        expect(bilan.detail).toContain('1384 « Résultat de liquidation »');
        expect(bilan.source).toContain('compte 13 (1384)');
    });
    it('sanctions · art. 902 sur toute liquidation, art. 903 sur la seule liquidation judiciaire', () => {
        const amiable = parLibelle((0, liquidation_societe_1.jalonsLiquidation)({ ...base, regimeLiquidation: client_1.RegimeLiquidation.ARTICLE_223_1 }, EX_2026, AUJOURDHUI));
        expect(amiable.get('Publication de la nomination du liquidateur').sanction).toContain('Article 902, 1°');
        expect(amiable.get('Clôture de la liquidation').sanction).toBeNull();
        expect(amiable.get('Clôture de la liquidation').detail).toContain('saisir la juridiction compétente');
        const depot = amiable.get('Comptes définitifs, assemblée de clôture et dépôt au registre');
        expect(depot.sanction).toContain('Article 902, 2° et 3°');
        expect(depot.echeance).toBeNull();
        expect(depot.sansDelai).toBe(true);
        expect(depot.enRetard).toBe(false);
        expect(amiable.get('Rapport du liquidateur à l’assemblée des associés').sanction).toBeNull();
        expect(amiable.get('États financiers annuels et rapport écrit du liquidateur').sanction).toBeNull();
        const judiciaire = parLibelle((0, liquidation_societe_1.jalonsLiquidation)({ ...base, regimeLiquidation: client_1.RegimeLiquidation.ARTICLE_223_2_JUDICIAIRE }, EX_2026, AUJOURDHUI));
        expect(judiciaire.get('Rapport du liquidateur à l’assemblée des associés').sanction).toContain('Article 903, 1°');
        expect(judiciaire.get('États financiers annuels et rapport écrit du liquidateur').sanction).toContain('Article 903, 2°');
    });
    it('associé unique personne morale · une ligne satisfaite dans l’exercice de dissolution, aucun jalon de liquidation', () => {
        const faits = { ...base, dateNominationLiquidateur: null, associeUniquePersonneMorale: true };
        const j = (0, liquidation_societe_1.jalonsLiquidation)(faits, EX_2026, AUJOURDHUI);
        expect(j).toHaveLength(1);
        expect(j[0].libelle).toBe('Dissolution sans liquidation · associé unique personne morale');
        expect(j[0].observation?.satisfait).toBe(true);
        expect(j[0].enRetard).toBe(false);
        expect(j[0].source).toContain('art. 201 al. 4');
        expect((0, liquidation_societe_1.jalonsLiquidation)(faits, EX_2027, AUJOURDHUI)).toEqual([]);
    });
    it('associé unique personne morale SOUS PROCÉDURE COLLECTIVE · la procédure collective prime (AUPCAP art. 53)', () => {
        const faits = {
            ...base,
            dateNominationLiquidateur: null,
            associeUniquePersonneMorale: true,
            regimeLiquidation: client_1.RegimeLiquidation.PROCEDURE_COLLECTIVE,
        };
        const j = (0, liquidation_societe_1.jalonsLiquidation)(faits, EX_2026, AUJOURDHUI);
        expect(j).toHaveLength(1);
        expect(j[0].libelle).toBe('Liquidation dans une procédure collective');
        expect(j[0].detail).toContain('ne joue pas');
        expect(j[0].source).toContain('art. 200, 6°');
        expect(j[0].echeance).toBeNull();
        expect(j[0].enRetard).toBe(false);
    });
    it('art. 223 · rapport à six mois de la nomination, états à trois mois et assemblée à six mois de CHAQUE clôture', () => {
        const faits = { ...base, regimeLiquidation: client_1.RegimeLiquidation.ARTICLE_223_2_JUDICIAIRE };
        const j2026 = parLibelle((0, liquidation_societe_1.jalonsLiquidation)(faits, EX_2026, AUJOURDHUI));
        expect(iso(j2026.get('Rapport du liquidateur à l’assemblée des associés').echeance)).toBe('2026-12-15');
        expect(iso(j2026.get('États financiers annuels et rapport écrit du liquidateur').echeance)).toBe('2027-03-31');
        expect(iso(j2026.get('Assemblée des associés sur les états annuels de liquidation').echeance)).toBe('2027-06-30');
        expect(j2026.has('Situation annuelle provisoire de liquidation')).toBe(false);
        const j2027 = parLibelle((0, liquidation_societe_1.jalonsLiquidation)(faits, EX_2027, AUJOURDHUI));
        expect(iso(j2027.get('États financiers annuels et rapport écrit du liquidateur').echeance)).toBe('2028-03-31');
        expect(j2027.has('Bilan avant liquidation')).toBe(false);
        expect(j2027.has('Rapport du liquidateur à l’assemblée des associés')).toBe(false);
        expect(iso(j2027.get('Clôture de la liquidation').echeance)).toBe('2029-05-31');
    });
    it('sans nomination déclarée · échéances non calculées, jamais supposées', () => {
        const j = parLibelle((0, liquidation_societe_1.jalonsLiquidation)({ ...base, dateNominationLiquidateur: null, regimeLiquidation: client_1.RegimeLiquidation.ARTICLE_223_1 }, EX_2026, AUJOURDHUI));
        expect(j.get('Publication de la nomination du liquidateur').echeance).toBeNull();
        expect(j.get('Rapport du liquidateur à l’assemblée des associés').echeance).toBeNull();
    });
    it('procédure collective · rien de l’AUSCGIE n’est calculé, et c’est dit ; exercice antérieur · rien', () => {
        const pc = (0, liquidation_societe_1.jalonsLiquidation)({ ...base, regimeLiquidation: client_1.RegimeLiquidation.PROCEDURE_COLLECTIVE }, EX_2026, AUJOURDHUI);
        expect(pc).toHaveLength(1);
        expect(pc[0].source).toContain('AUSCGIE, art. 203 al. 2');
        expect(pc[0].source).toContain('AUPCAP, art. 53');
        expect(pc[0].echeance).toBeNull();
        expect((0, liquidation_societe_1.jalonsLiquidation)(base, EX_2025, AUJOURDHUI)).toEqual([]);
        expect((0, liquidation_societe_1.jalonsLiquidation)({ ...base, dateDissolution: null }, EX_2026, AUJOURDHUI)).toEqual([]);
    });
    it('coopérative (décision du 2026-10-07, quater, points 6 et 7) · servie par l’AUSCOOP, art. 196 pour les art. 228 à 233, sans sanction pénale de l’AUSCGIE', () => {
        const coop = { ...base, forme: client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE, regimeLiquidation: client_1.RegimeLiquidation.ARTICLE_223_1 };
        const j = (0, liquidation_societe_1.jalonsLiquidation)(coop, EX_2026, AUJOURDHUI);
        expect(j.length).toBeGreaterThan(0);
        expect(j.find((x) => x.libelle === 'Clôture de la liquidation').source).toContain('AUSCOOP, art. 191');
        const etats = j.find((x) => x.libelle === 'États financiers annuels et rapport écrit du liquidateur');
        expect(etats.source).toContain('AUSCOOP, art. 196');
        expect(iso(etats.echeance)).toBe('2027-03-31');
        expect(j.every((x) => !x.sanction)).toBe(true);
    });
});
describe('Liquidation · câblée au planning de clôture', () => {
    it('le planning de l’exercice de dissolution sert les jalons de la liquidation, après ceux de l’exercice', async () => {
        const exercice = { id: 'e1', tenantId: 't1', ...EX_2026, statut: 'OUVERT', dateAssembleeGenerale: null, dateDepotEtatsPortefeuille: null };
        const prisma = {
            exercice: {
                findFirst: jest.fn().mockResolvedValue(exercice),
                findMany: jest.fn().mockResolvedValue([{ id: 'e1', dateDebut: EX_2026.dateDebut, dateFin: EX_2026.dateFin, statut: 'OUVERT' }]),
            },
            tenant: {
                findUniqueOrThrow: jest.fn().mockResolvedValue({
                    referentiel: client_1.Referentiel.SYSCOHADA,
                    formeJuridique: 'ASSOCIATION',
                    formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
                    droitEtranger: false,
                    associeUnique: null,
                    entreprisePortefeuilleEtat: null,
                    dateDissolution: base.dateDissolution,
                    dateNominationLiquidateur: base.dateNominationLiquidateur,
                    regimeLiquidation: null,
                    associeUniquePersonneMorale: null,
                }),
            },
            ecriture: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
            transcriptionInventaire: { count: jest.fn().mockResolvedValue(0) },
            rapportActivite: { count: jest.fn().mockResolvedValue(0) },
            donation: { findMany: jest.fn().mockResolvedValue([]) },
            ...Object.fromEntries(arret_dissolution_1.ACTES_DE_LA_PERIODE.map((a) => [a.modele, { findMany: jest.fn().mockResolvedValue([]) }])),
        };
        const p = await new exercice_service_1.ExerciceService(prisma, {}).planningCloture('t1', 'e1');
        const libelles = p.jalons.map((j) => j.libelle);
        expect(libelles).toContain('Bilan avant liquidation');
        expect(libelles.indexOf('Bilan avant liquidation')).toBeGreaterThan(libelles.indexOf('Affectation du résultat'));
    });
});
describe('Liquidation · faits déclarés au dossier', () => {
    function service(tenant, capture = {}) {
        const t = { id: 't1', referentiel: client_1.Referentiel.SYSCOHADA, ...tenant };
        return new tenant_service_1.TenantService({
            tenant: {
                findUnique: async () => t,
                findUniqueOrThrow: async () => t,
                update: async ({ data }) => {
                    capture.data = data;
                    return { id: 't1' };
                },
            },
            exercice: { findFirst: async () => null, count: async () => 0 },
            ecriture: { count: async () => 0 },
            compte: { findMany: async () => [] },
        });
    }
    it('associé unique personne morale · la DISSOLUTION se déclare, seuls nomination et régime sont refusés (art. 201 al. 4)', async () => {
        const sa = { formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME };
        const admise = {};
        await service(sa, admise).modifierIdentite('t1', { associeUniquePersonneMorale: 'OUI', dateDissolution: '2026-05-31' });
        expect(admise.data).toMatchObject({ associeUniquePersonneMorale: true });
        expect(admise.data.dateDissolution.toISOString().slice(0, 10)).toBe('2026-05-31');
        await service({ ...sa, associeUniquePersonneMorale: true }).modifierIdentite('t1', { dateDissolution: '2026-05-31' });
        await expect(service({ ...sa, associeUniquePersonneMorale: true }).modifierIdentite('t1', {
            dateDissolution: '2026-05-31',
            dateNominationLiquidateur: '2026-06-15',
        })).rejects.toThrow('art. 201 al. 4');
        await expect(service({ ...sa, associeUniquePersonneMorale: true }).modifierIdentite('t1', { regimeLiquidation: 'AMIABLE_STATUTAIRE' })).rejects.toThrow('sans qu’il y ait lieu');
        await expect(service({ ...sa, regimeLiquidation: 'ARTICLE_223_1' }).modifierIdentite('t1', { associeUniquePersonneMorale: 'OUI' })).rejects.toThrow('art. 201 al. 4');
        await expect(service({ ...sa, associeUniquePersonneMorale: true }).modifierIdentite('t1', { regimeLiquidation: 'ARTICLE_223_2_JUDICIAIRE' })).rejects.toThrow('art. 201 al. 4');
        const pc = {};
        await service({ ...sa, associeUniquePersonneMorale: true }, pc).modifierIdentite('t1', {
            dateDissolution: '2026-05-31',
            regimeLiquidation: 'PROCEDURE_COLLECTIVE',
        });
        expect(pc.data).toMatchObject({ regimeLiquidation: 'PROCEDURE_COLLECTIVE' });
        const pc2 = {};
        await service({ ...sa, regimeLiquidation: 'PROCEDURE_COLLECTIVE' }, pc2).modifierIdentite('t1', {
            associeUniquePersonneMorale: 'OUI',
        });
        expect(pc2.data).toMatchObject({ associeUniquePersonneMorale: true });
        await expect(service({ ...sa, associeUniquePersonneMorale: true, regimeLiquidation: 'PROCEDURE_COLLECTIVE' }).modifierIdentite('t1', {
            dateDissolution: '2026-05-31',
            dateNominationLiquidateur: '2026-06-15',
        })).rejects.toThrow('art. 201 al. 4');
        const capture = {};
        await service(sa, capture).modifierIdentite('t1', {
            dateDissolution: '2026-05-31',
            dateNominationLiquidateur: '2026-06-15',
            regimeLiquidation: 'ARTICLE_223_1',
            associeUniquePersonneMorale: 'NON',
        });
        expect(capture.data).toMatchObject({ regimeLiquidation: 'ARTICLE_223_1', associeUniquePersonneMorale: false });
    });
    it('une date absente du calendrier est refusée, nommée ; un jour se déclare AAAA-MM-JJ, jamais avec heure et fuseau', async () => {
        const sarl = { formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE };
        await expect(service(sarl).modifierIdentite('t1', { dateDissolution: '2026-02-30' })).rejects.toThrow('absente du calendrier');
        await expect(service(sarl).modifierIdentite('t1', { dateDissolution: '2026-05-31T23:30:00-05:00' })).rejects.toThrow('format AAAA-MM-JJ');
        await expect(service(sarl).modifierIdentite('t1', { dateNominationLiquidateur: '2026-06-15T00:00:00Z' })).rejects.toThrow('format AAAA-MM-JJ');
        const capture = {};
        await service(sarl, capture).modifierIdentite('t1', { dateDissolution: '2026-05-31' });
        expect(capture.data.dateDissolution.toISOString()).toBe('2026-05-31T00:00:00.000Z');
    });
    it('nomination avant la dissolution refusée ; régime refusé hors société commerciale', async () => {
        const sarl = { formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE };
        await expect(service(sarl).modifierIdentite('t1', { dateDissolution: '2026-05-31', dateNominationLiquidateur: '2026-05-01' })).rejects.toThrow('art. 204');
        await expect(service({ formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE }).modifierIdentite('t1', {
            regimeLiquidation: 'AMIABLE_STATUTAIRE',
        })).rejects.toThrow('société commerciale');
    });
});
describe('Liquidation · mention de l’art. 204 sur les pièces', () => {
    const societe = {
        formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
        dateDissolution: new Date(Date.UTC(2026, 4, 31)),
        liquidateurs: 'Liquidateur désigné',
    };
    it('société dissoute · « Société en liquidation » et le nom du liquidateur', () => {
        expect((0, mentions_societe_1.mentionLiquidation)(societe, new Date(Date.UTC(2026, 6, 1))).ligne).toContain('Société en liquidation');
    });
    it('procédure collective · aucune mention de l’art. 204, l’art. 203 al. 2 écartant son chapitre', () => {
        for (const associe of [null, false, true]) {
            const m = (0, mentions_societe_1.mentionLiquidation)({ ...societe, regimeLiquidation: client_1.RegimeLiquidation.PROCEDURE_COLLECTIVE, associeUniquePersonneMorale: associe }, new Date(Date.UTC(2026, 6, 1)));
            expect(m.ligne).toBeNull();
            expect(m.manquantes).toEqual([]);
        }
        const amiable = (0, mentions_societe_1.mentionLiquidation)({ ...societe, regimeLiquidation: client_1.RegimeLiquidation.AMIABLE_STATUTAIRE }, new Date(Date.UTC(2026, 6, 1)));
        expect(amiable.ligne).toContain('Société en liquidation');
    });
    it('associé unique personne morale · aucune mention, la société n’étant pas en liquidation (art. 201 al. 4)', () => {
        const m = (0, mentions_societe_1.mentionLiquidation)({ ...societe, associeUniquePersonneMorale: true }, new Date(Date.UTC(2026, 6, 1)));
        expect(m.ligne).toBeNull();
        expect(m.manquantes).toEqual([]);
    });
});
//# sourceMappingURL=liquidation-societe.spec.js.map