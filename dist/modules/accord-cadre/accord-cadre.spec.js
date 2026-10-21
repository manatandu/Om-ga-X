"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const accord_cadre_service_1 = require("./accord-cadre.service");
const controles_service_1 = require("../controles/controles.service");
const conditions_ong_etrangere_1 = require("./conditions-ong-etrangere");
describe('Périmètre de l’article 37 · la sous-section ne vise que l’ONG étrangère', () => {
    it('ne vise QUE l’organisation non gouvernementale de droit étranger', () => {
        expect((0, conditions_ong_etrangere_1.articleTrenteSeptApplicable)(client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, true)).toBe(true);
        expect((0, conditions_ong_etrangere_1.articleTrenteSeptApplicable)(client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, false)).toBe(false);
        for (const forme of [
            client_1.FormeJuridiqueEbnl.ASSOCIATION,
            client_1.FormeJuridiqueEbnl.ASSOCIATION_CONFESSIONNELLE,
            client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE,
            client_1.FormeJuridiqueEbnl.UNITE_GESTION_PROJET,
        ]) {
            expect((0, conditions_ong_etrangere_1.articleTrenteSeptApplicable)(forme, true)).toBe(false);
        }
    });
    it('les dix ans et les six mois portent leur ORIGINE · un modèle, pas la loi', () => {
        expect(conditions_ong_etrangere_1.MODELE_KAHASHA.dureeAnnees).toBe(10);
        expect(conditions_ong_etrangere_1.MODELE_KAHASHA.preavisMois).toBe(6);
        expect(conditions_ong_etrangere_1.MODELE_KAHASHA.source).toMatch(/MODÈLE/);
        expect(conditions_ong_etrangere_1.MODELE_KAHASHA.source).toMatch(/n['’]est PAS une règle de la loi/);
    });
    it('le seuil de main-d’œuvre locale est celui de l’article · 60 %', () => {
        expect(conditions_ong_etrangere_1.PART_MAIN_OEUVRE_LOCALE_MINIMALE).toBe(60);
    });
});
const base = {
    dateSignature: new Date('2016-03-01'),
    dureeAnnees: 10,
    preavisMois: 6,
    denonceLe: null,
};
describe('État d’un accord · une période écoulée n’est pas une fin', () => {
    it('sans tacite reconduction, la période écoulée EST la fin', () => {
        const e = (0, conditions_ong_etrangere_1.etatAccordCadre)({
            ...base,
            taciteReconduction: false,
            reference: new Date('2027-06-01'),
        });
        expect(e.finDePeriode.toISOString().slice(0, 10)).toBe('2026-03-01');
        expect(e.periodeEcoulee).toBe(true);
        expect(e.enTaciteReconduction).toBe(false);
    });
    it('AVEC tacite reconduction, l’accord repart pour une période · jamais « expiré »', () => {
        const e = (0, conditions_ong_etrangere_1.etatAccordCadre)({
            ...base,
            taciteReconduction: true,
            reference: new Date('2027-06-01'),
        });
        expect(e.finDePeriode.toISOString().slice(0, 10)).toBe('2036-03-01');
        expect(e.periodeEcoulee).toBe(false);
        expect(e.enTaciteReconduction).toBe(true);
    });
    it('une DÉNONCIATION arrête la reconduction · le seul fait qui l’arrête', () => {
        const e = (0, conditions_ong_etrangere_1.etatAccordCadre)({
            ...base,
            taciteReconduction: true,
            denonceLe: new Date('2025-09-01'),
            reference: new Date('2027-06-01'),
        });
        expect(e.enTaciteReconduction).toBe(false);
        expect(e.periodeEcoulee).toBe(true);
        expect(e.finDePeriode.toISOString().slice(0, 10)).toBe('2026-03-01');
        expect(e.denonciationHorsPreavis).toBe(false);
    });
    it('une dénonciation en DEUXIÈME période termine la période en cours ce jour-là, pas la première', () => {
        const e = (0, conditions_ong_etrangere_1.etatAccordCadre)({
            dateSignature: new Date('2010-01-15'),
            dureeAnnees: 10,
            preavisMois: 6,
            taciteReconduction: true,
            denonceLe: new Date('2026-03-01'),
            reference: new Date('2026-09-30'),
        });
        expect(e.finDePeriode.toISOString().slice(0, 10)).toBe('2030-01-15');
        expect(e.periodeEcoulee).toBe(false);
        expect(e.dernierJourPourDenoncer.toISOString().slice(0, 10)).toBe('2029-07-15');
        expect(e.denonciationHorsPreavis).toBe(false);
    });
    it('une dénonciation parvenue après le dernier jour du préavis est DITE, sans autre date', () => {
        const e = (0, conditions_ong_etrangere_1.etatAccordCadre)({
            dateSignature: new Date('2010-01-15'),
            dureeAnnees: 10,
            preavisMois: 6,
            taciteReconduction: true,
            denonceLe: new Date('2029-10-01'),
            reference: new Date('2029-10-02'),
        });
        expect(e.finDePeriode.toISOString().slice(0, 10)).toBe('2030-01-15');
        expect(e.denonciationHorsPreavis).toBe(true);
    });
    it('rend le DERNIER JOUR POUR DÉNONCER · la seule date encore utilisable', () => {
        const e = (0, conditions_ong_etrangere_1.etatAccordCadre)({ ...base, taciteReconduction: true, reference: new Date('2020-01-01') });
        expect(e.finDePeriode.toISOString().slice(0, 10)).toBe('2026-03-01');
        expect(e.dernierJourPourDenoncer.toISOString().slice(0, 10)).toBe('2025-09-01');
    });
    it('borne la fin de période et le dernier jour pour dénoncer à la fin du mois', () => {
        const e = (0, conditions_ong_etrangere_1.etatAccordCadre)({
            dateSignature: new Date('2024-02-29'),
            dureeAnnees: 2,
            preavisMois: 1,
            denonceLe: null,
            taciteReconduction: false,
            reference: new Date('2025-01-01'),
        });
        const f = (0, conditions_ong_etrangere_1.etatAccordCadre)({
            dateSignature: new Date('2024-03-31'),
            dureeAnnees: 2,
            preavisMois: 1,
            denonceLe: null,
            taciteReconduction: false,
            reference: new Date('2025-01-01'),
        });
        expect([e.finDePeriode, f.dernierJourPourDenoncer].map((d) => d.toISOString().slice(0, 10))).toEqual([
            '2026-02-28',
            '2026-02-28',
        ]);
    });
    it('sans préavis stipulé, aucune date n’est inventée', () => {
        const e = (0, conditions_ong_etrangere_1.etatAccordCadre)({
            ...base,
            preavisMois: null,
            taciteReconduction: true,
            reference: new Date('2020-01-01'),
        });
        expect(e.dernierJourPourDenoncer).toBeNull();
    });
});
function service(forme, droitEtranger, accords = []) {
    const ecrit = [];
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', formeJuridique: forme, droitEtranger }),
        },
        accordCadrePlan: {
            findMany: jest.fn().mockResolvedValue(accords),
            findFirst: jest.fn().mockResolvedValue(accords[0] ?? null),
            create: jest.fn().mockImplementation(({ data }) => {
                ecrit.push(data);
                return Promise.resolve({ id: 'a1', ...data });
            }),
            update: jest.fn().mockImplementation(({ data }) => {
                ecrit.push(data);
                return Promise.resolve({ id: 'a1', ...data });
            }),
        },
    };
    return { svc: new accord_cadre_service_1.AccordCadreService(prisma), ecrit };
}
const accordValide = {
    reference: 'AC/PLAN/2026/014',
    dateSignature: '2026-03-01',
    dureeAnnees: 10,
    taciteReconduction: true,
    preavisMois: 6,
};
describe('Enregistrement · ce que l’article 37 refuse', () => {
    it('enregistre pour une ONG de droit étranger', async () => {
        const { svc, ecrit } = service(client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, true);
        await svc.enregistrer('t', accordValide);
        expect(ecrit[0].dureeAnnees).toBe(10);
        expect(ecrit[0].taciteReconduction).toBe(true);
    });
    it('REFUSE à tout dossier que la sous-section II ne vise pas', async () => {
        for (const [forme, etranger] of [
            [client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, false],
            [client_1.FormeJuridiqueEbnl.ASSOCIATION, true],
            [client_1.FormeJuridiqueEbnl.ASSOCIATION_CONFESSIONNELLE, true],
        ]) {
            const { svc } = service(forme, etranger);
            await expect(svc.enregistrer('t', accordValide)).rejects.toThrow(/DROIT ÉTRANGER|art\. 37/);
        }
    });
    it('la DURÉE est saisie · le refus cite l’origine des dix ans', async () => {
        const { svc } = service(client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, true);
        await expect(svc.enregistrer('t', { ...accordValide, dureeAnnees: 0 })).rejects.toThrow(/MODÈLE/);
    });
    it('la part de main-d’œuvre EXIGE sa source · OmegaX ne la calcule pas', async () => {
        const { svc, ecrit } = service(client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, true, [
            { id: 'a1', tenantId: 't' },
        ]);
        await expect(svc.declarerMainOeuvre('t', 'a1', { part: 72, source: '  ', date: '2026-12-31' })).rejects.toThrow(/source du relevé est exigée/);
        await svc.declarerMainOeuvre('t', 'a1', {
            part: 72,
            source: 'Registre du personnel au 31/12/2026',
            date: '2026-12-31',
        });
        expect(ecrit[0].sourceMainOeuvre).toBe('Registre du personnel au 31/12/2026');
    });
    it('une dénonciation sans motif est refusée', async () => {
        const { svc } = service(client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, true, [
            { id: 'a1', tenantId: 't' },
        ]);
        await expect(svc.denoncer('t', 'a1', { denonceLe: '2027-01-01', motif: ' ' })).rejects.toThrow(/motif de la dénonciation/);
    });
    it('un dossier hors périmètre rend `applicable: false` et AUCUN accord', async () => {
        const { svc } = service(client_1.FormeJuridiqueEbnl.ASSOCIATION, false, [{ id: 'a1' }]);
        const etat = await svc.etat('t');
        expect(etat.applicable).toBe(false);
        expect(etat.accords).toHaveLength(0);
    });
});
function serviceControles(forme, droitEtranger, accords) {
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date('2027-01-01'),
                dateFin: new Date('2027-12-31'),
                dateArreteComptes: new Date('2028-03-31'),
            }),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                id: 't',
                referentiel: client_1.Referentiel.SYCEBNL,
                formeJuridique: forme,
                droitEtranger,
                formeJuridiqueSyscohada: null,
            }),
        },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        accordCadrePlan: { findMany: jest.fn().mockResolvedValue(accords) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const anomalie = async (code, forme, droitEtranger, accords) => {
    const rapport = await serviceControles(forme, droitEtranger, accords).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === code);
};
const ONG_ETR = client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE;
describe('Le contrôle de l’article 37', () => {
    it('signale l’absence d’accord-cadre pour une ONG de droit étranger', async () => {
        const a = await anomalie('ACCORD_CADRE_PLAN_ABSENT', ONG_ETR, true, []);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.consequence).toMatch(/art\. 37/);
    });
    it('SE TAIT hors périmètre · une association ne conclut pas d’accord-cadre', async () => {
        expect(await anomalie('ACCORD_CADRE_PLAN_ABSENT', client_1.FormeJuridiqueEbnl.ASSOCIATION, true, [])).toBeUndefined();
        expect(await anomalie('ACCORD_CADRE_PLAN_ABSENT', ONG_ETR, false, [])).toBeUndefined();
    });
    it('un accord en TACITE RECONDUCTION n’est jamais signalé échu', async () => {
        const reconduit = [
            {
                id: 'a',
                reference: 'AC/1',
                dateSignature: new Date('2010-03-01'),
                dureeAnnees: 10,
                taciteReconduction: true,
                preavisMois: 6,
                denonceLe: null,
                partMainOeuvreLocale: null,
                sourceMainOeuvre: null,
            },
        ];
        expect(await anomalie('ACCORD_CADRE_PLAN_ECHU', ONG_ETR, true, reconduit)).toBeUndefined();
        expect(await anomalie('ACCORD_CADRE_PLAN_ABSENT', ONG_ETR, true, reconduit)).toBeUndefined();
    });
    it('SANS tacite reconduction, la période écoulée est signalée', async () => {
        const echu = [
            {
                id: 'a',
                reference: 'AC/2',
                dateSignature: new Date('2010-03-01'),
                dureeAnnees: 10,
                taciteReconduction: false,
                preavisMois: null,
                denonceLe: null,
                partMainOeuvreLocale: null,
                sourceMainOeuvre: null,
            },
        ];
        const a = await anomalie('ACCORD_CADRE_PLAN_ECHU', ONG_ETR, true, echu);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
    });
    it('une part DÉCLARÉE sous 60 % est signalée, une part ABSENTE ne l’est pas', async () => {
        const avec = (part) => [
            {
                id: 'a',
                reference: 'AC/3',
                dateSignature: new Date('2026-03-01'),
                dureeAnnees: 10,
                taciteReconduction: true,
                preavisMois: 6,
                denonceLe: null,
                partMainOeuvreLocale: part,
                sourceMainOeuvre: part === null ? null : 'Registre du personnel',
            },
        ];
        expect(await anomalie('MAIN_OEUVRE_LOCALE_SOUS_SEUIL', ONG_ETR, true, avec(null))).toBeUndefined();
        expect(await anomalie('MAIN_OEUVRE_LOCALE_SOUS_SEUIL', ONG_ETR, true, avec(72))).toBeUndefined();
        const a = await anomalie('MAIN_OEUVRE_LOCALE_SOUS_SEUIL', ONG_ETR, true, avec(41));
        expect(a).toBeDefined();
        expect(a.consequence).toMatch(/60% au minimum/);
        expect(a.consequence).toMatch(/ne calcule pas ce chiffre/);
    });
});
describe('F146 · le registre du personnel PROPOSE la part, il ne la substitue pas', () => {
    function avecRegistre(salaries) {
        const { svc, ecrit } = service(client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, true, [
            { id: 'a1', tenantId: 't', dateSignature: new Date('2026-03-01'), dureeAnnees: 10, taciteReconduction: true, preavisMois: 6, denonceLe: null, partMainOeuvreLocale: 55 },
        ]);
        const prisma = svc.prisma;
        const enVigueur = (c, f) => c.tenantId === f.tenantId &&
            c.dateEntreeEnVigueur <= f.dateEntreeEnVigueur.lte &&
            (c.dateFin === null || c.dateFin >= f.dateEntreeEnVigueur.lte) &&
            (f.type === undefined || c.type === f.type);
        const retenus = ({ where }) => salaries.filter((s) => s.tenantId === where.tenantId && s.contrats.some((c) => enVigueur(c, where.contrats.some)));
        prisma.salarie = {
            groupBy: jest.fn((args) => {
                const groupes = new Map();
                for (const s of retenus(args)) {
                    const cle = Object.fromEntries(args.by.map((k) => [k, s[k] ?? null]));
                    const g = groupes.get(JSON.stringify(cle)) ?? { ...cle, _count: { _all: 0 } };
                    g._count._all += 1;
                    groupes.set(JSON.stringify(cle), g);
                }
                return Promise.resolve([...groupes.values()]);
            }),
            count: jest.fn((args) => Promise.resolve(retenus(args).length)),
        };
        return { svc, ecrit };
    }
    const salarie = (id, nationalite) => ({
        id,
        tenantId: 't',
        sexe: 'MASCULIN',
        nationalite,
        contrats: [
            { tenantId: 't', type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: new Date('2026-01-05'), dateFin: null },
        ],
    });
    it('l’état porte la part du registre, sa source, et laisse la part déclarée intacte', async () => {
        const { svc } = avecRegistre([salarie('s1', 'Congolaise'), salarie('s2', 'Congolaise'), salarie('s3', 'Belge'), salarie('s4', 'RDC')]);
        const etat = await svc.etat('t', { dateReference: '2026-12-31' });
        expect(etat.propositionMainOeuvre).toMatchObject({ part: 75, effectif: 4, nationaux: 3, source: 'Registre du personnel au 2026-12-31' });
        expect(etat.accords[0].partMainOeuvreLocale).toBe(55);
    });
    it('une nationalité manquante ne propose rien, et le dit', async () => {
        const { svc } = avecRegistre([salarie('s1', 'Congolaise'), salarie('s2', null)]);
        const etat = await svc.etat('t', { dateReference: '2026-12-31' });
        expect(etat.propositionMainOeuvre?.part).toBeNull();
        expect(etat.propositionMainOeuvre?.reserve).toMatch(/1 salarié\(s\) de l'effectif n'ont pas de nationalité/);
        expect(etat.propositionMainOeuvre?.reserve).toMatch(/main-d'œuvre locale \(art\. 37, 4° de la loi n° 004\/2001\)/);
    });
    it('un dossier hors périmètre ne lit pas le registre', async () => {
        const { svc } = service(client_1.FormeJuridiqueEbnl.ASSOCIATION, false);
        expect((await svc.etat('t')).propositionMainOeuvre).toBeNull();
    });
});
//# sourceMappingURL=accord-cadre.spec.js.map