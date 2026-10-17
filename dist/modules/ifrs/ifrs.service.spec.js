"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const fs_1 = require("fs");
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const exercice_requis_1 = require("../../common/exercice-requis");
const constants_1 = require("@nestjs/common/constants");
const client_1 = require("@prisma/client");
const ifrs_service_1 = require("./ifrs.service");
const cumul_consolidation_1 = require("../consolidation/cumul-consolidation");
const ifrs_controller_1 = require("./ifrs.controller");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const etats_financiers_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.service");
const T = 'dossier-1';
const EX = 'ex-2026';
const EX1 = 'ex-2025';
const EX2 = 'ex-2024';
function doublure(avecPrecedent = false, avecAvantPrecedent = false, balancesPropres = {}) {
    const tables = { regles: [], reglesConso: [], retraitements: [], parametres: [], mouvements: [], effets: [], notes: [] };
    const exercices = [
        { id: EX, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') },
        ...(avecPrecedent ? [{ id: EX1, dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }] : []),
        ...(avecAvantPrecedent ? [{ id: EX2, dateDebut: new Date('2024-01-01'), dateFin: new Date('2024-12-31') }] : []),
    ];
    let seq = 0;
    const prisma = {
        exercice: {
            findFirst: jest.fn(async ({ where }) => {
                if ('id' in where)
                    return (where.tenantId === T && exercices.find((e) => where.id === undefined || e.id === where.id)) || null;
                const avant = exercices.filter((e) => e.dateFin < where.dateFin.lt).sort((a, b) => b.dateFin.getTime() - a.dateFin.getTime());
                return avant[0] ?? null;
            }),
        },
        parametresIfrs: {
            findUnique: jest.fn(async () => tables.parametres[0] ?? null),
            upsert: jest.fn(async ({ create, update }) => {
                tables.parametres[0] = tables.parametres[0] ? { ...tables.parametres[0], ...update } : create;
                return tables.parametres[0];
            }),
        },
        regleCorrespondanceIfrs: {
            findMany: jest.fn(async () => tables.regles),
            findFirst: jest.fn(async ({ where }) => tables.regles.find((r) => r.id === where.id && r.tenantId === where.tenantId) ?? null),
            create: jest.fn(async ({ data }) => {
                if (tables.regles.some((r) => r.prefixe === data.prefixe)) {
                    throw new client_1.Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
                }
                const r = { id: `r-${++seq}`, ...data };
                tables.regles.push(r);
                return r;
            }),
            delete: jest.fn(async ({ where }) => (tables.regles = tables.regles.filter((r) => r.id !== where.id))),
        },
        regleConsolidationIfrs: {
            findMany: jest.fn(async ({ where }) => tables.reglesConso.filter((r) => r.tenantId === where.tenantId)),
            findFirst: jest.fn(async ({ where }) => tables.reglesConso.find((r) => r.id === where.id && r.tenantId === where.tenantId) ?? null),
            create: jest.fn(async ({ data }) => {
                if (tables.reglesConso.some((r) => r.tenantId === data.tenantId && r.poste === data.poste)) {
                    throw new client_1.Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
                }
                const r = { id: `rc-${++seq}`, ...data };
                tables.reglesConso.push(r);
                return r;
            }),
            delete: jest.fn(async ({ where }) => (tables.reglesConso = tables.reglesConso.filter((r) => r.id !== where.id))),
        },
        effetChangeTresorerieIfrs: {
            findUnique: jest.fn(async ({ where }) => {
                const k = where.tenantId_exerciceId_consolide;
                return tables.effets.find((e) => e.tenantId === k.tenantId && e.exerciceId === k.exerciceId && (e.consolide ?? false) === k.consolide) ?? null;
            }),
            upsert: jest.fn(async ({ where, create, update }) => {
                const k = where.tenantId_exerciceId_consolide;
                const i = tables.effets.findIndex((e) => e.tenantId === k.tenantId && e.exerciceId === k.exerciceId && (e.consolide ?? false) === k.consolide);
                const e = i >= 0 ? { ...tables.effets[i], ...update } : { id: `e-${++seq}`, ...create };
                e.montant = new client_1.Prisma.Decimal(e.montant);
                if (i >= 0)
                    tables.effets[i] = e;
                else
                    tables.effets.push(e);
                return e;
            }),
            delete: jest.fn(async ({ where }) => (tables.effets = tables.effets.filter((e) => e.id !== where.id))),
        },
        tenant: {
            findUnique: jest.fn(async ({ where }) => where.id === T ? { nom: 'Société Alpha', pays: 'RD Congo', adresse: '12 avenue du Port', ville: 'Kinshasa', activite: 'Négoce de matériaux' } : null),
        },
        notesIfrs: {
            findUnique: jest.fn(async ({ where }) => {
                const k = where.tenantId_exerciceId_consolide;
                return tables.notes.find((e) => e.tenantId === k.tenantId && e.exerciceId === k.exerciceId && (e.consolide ?? false) === k.consolide) ?? null;
            }),
            upsert: jest.fn(async ({ where, create, update }) => {
                const k = where.tenantId_exerciceId_consolide;
                const i = tables.notes.findIndex((e) => e.tenantId === k.tenantId && e.exerciceId === k.exerciceId && (e.consolide ?? false) === k.consolide);
                const e = i >= 0 ? { ...tables.notes[i], ...update } : { id: `n-${++seq}`, ...create };
                if (i >= 0)
                    tables.notes[i] = e;
                else
                    tables.notes.push(e);
                return e;
            }),
        },
        mouvementCapitauxPropresIfrs: {
            findMany: jest.fn(async ({ where }) => tables.mouvements.filter((m) => m.exerciceId === where.exerciceId && m.tenantId === where.tenantId && (m.consolide ?? false) === where.consolide)),
            findFirst: jest.fn(async ({ where }) => tables.mouvements.find((m) => m.id === where.id && m.tenantId === where.tenantId) ?? null),
            create: jest.fn(async ({ data }) => {
                const m = { id: `m-${++seq}`, createdAt: new Date(), ...data, montant: new client_1.Prisma.Decimal(data.montant) };
                tables.mouvements.push(m);
                return m;
            }),
            delete: jest.fn(async ({ where }) => (tables.mouvements = tables.mouvements.filter((m) => m.id !== where.id))),
        },
        retraitementIfrs: {
            findMany: jest.fn(async ({ where }) => tables.retraitements.filter((r) => r.exerciceId === where.exerciceId &&
                (r.aLaTransition ?? false) === where.aLaTransition &&
                (r.consolide ?? false) === where.consolide)),
            findFirst: jest.fn(async ({ where }) => tables.retraitements.find((r) => r.id === where.id && r.tenantId === where.tenantId) ?? null),
            create: jest.fn(async ({ data }) => {
                const r = { id: `t-${++seq}`, createdAt: new Date(), ...data, lignes: data.lignes.create.map((l) => ({ ...l, montant: new client_1.Prisma.Decimal(l.montant) })) };
                tables.retraitements.push(r);
                return r;
            }),
            delete: jest.fn(async ({ where }) => (tables.retraitements = tables.retraitements.filter((r) => r.id !== where.id))),
        },
    };
    const balances = {
        [EX]: [['24100000', 1000], ['10100000', -800], ['70100000', -500], ['60100000', 300]],
        [EX1]: [['24100000', 900], ['10100000', -800], ['70100000', -400], ['60100000', 300]],
        [EX2]: [['24100000', 800], ['10100000', -800]],
        ...balancesPropres,
    };
    const ecritures = {
        balance: jest.fn(async (_t, ex, brouillard) => {
            expect(brouillard).toBe(false);
            return {
                lignes: balances[ex].map(([numero, solde, reportDebit = 0, reportCredit = 0]) => ({
                    compteId: `id-${numero}`,
                    numero,
                    intitule: numero,
                    classe: `CLASSE_${numero[0]}`,
                    typeCompte: 'DETAIL',
                    solde,
                    totalDebit: Math.max(solde, 0),
                    totalCredit: Math.max(-solde, 0),
                    reportDebit,
                    reportCredit,
                    mouvementDebit: Math.max(solde, 0) - reportDebit,
                    mouvementCredit: Math.max(-solde, 0) - reportCredit,
                })),
            };
        }),
        mouvementsDeReevaluation: jest.fn().mockResolvedValue(new Map()),
    };
    const syscohada = new etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService(ecritures, {});
    const cumulsParExercice = {};
    const cumuls = {
        cumul: jest.fn(async (t, ex) => {
            expect(t).toBe(T);
            const c = cumulsParExercice[ex];
            if (c === undefined || typeof c === 'string')
                throw new common_1.BadRequestException(c ?? 'Aucun périmètre de consolidation pour cet exercice.');
            return c;
        }),
        lignesConsolidante: jest.fn(async () => []),
    };
    const perimetresParExercice = {};
    const perimetre = {
        etat: jest.fn(async (_t, ex) => {
            const resultats = perimetresParExercice[ex] ?? [];
            return { entites: resultats, resultats };
        }),
    };
    return {
        prisma,
        tables,
        ecritures,
        cumuls,
        cumulsParExercice,
        perimetresParExercice,
        service: new ifrs_service_1.IfrsService(prisma, ecritures, syscohada, cumuls, perimetre),
    };
}
const REGLES = [
    { prefixe: '24', rubrique: 'SF_IMMOBILISATIONS_CORPORELLES' },
    { prefixe: '10', rubrique: 'SF_CAPITAL' },
    { prefixe: '70', rubrique: 'PL_PRODUITS' },
    { prefixe: '60', rubrique: 'PL_ACHATS_CONSOMMES' },
];
describe('IfrsService · de la balance légale aux états IFRS', () => {
    it('le livre-journal seul, les règles déclarées, un retraitement déclaré · résultat 200 → 150', async () => {
        const { service } = doublure();
        for (const r of REGLES)
            await service.ajouterRegle(T, r);
        await service.declarerActivite(T, { activitePrincipale: 'AUCUNE' });
        await service.ajouterRetraitement(T, {
            exerciceId: EX,
            libelle: 'Dépréciation',
            fondement: 'IAS 36 § 59',
            lignes: [{ rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES', montant: 50 }, { rubrique: 'SF_IMMOBILISATIONS_CORPORELLES', montant: -50 }],
        });
        const e = await service.etat(T, EX);
        expect(e.n.rapprochements).toMatchObject({ resultatSyscohada: 200, retraitementsResultat: -50, resultatIfrs: 150 });
        expect(e.n.controles.every((c) => c.ok)).toBe(true);
        expect(e.activitePrincipale).toBe('AUCUNE');
        expect(e.n1).toBeNull();
        expect(e.motifN1).toMatch(/Aucun exercice précédent/);
    });
    it('le comparatif est un second calcul sur l’exercice précédent, avec les mêmes règles', async () => {
        const { service } = doublure(true);
        for (const r of REGLES)
            await service.ajouterRegle(T, r);
        const e = await service.etat(T, EX);
        expect(e.n1.rapprochements.resultatIfrs).toBe(100);
    });
    it('refus à la porte · règle hors classe ou vers le mauvais état, doublon, retraitement déséquilibré ou sans fondement', async () => {
        const { service, tables } = doublure();
        await expect(service.ajouterRegle(T, { prefixe: '60', rubrique: 'SF_STOCKS' })).rejects.toThrow(/compte de gestion/);
        await service.ajouterRegle(T, REGLES[0]);
        await expect(service.ajouterRegle(T, { prefixe: ' 24 ', rubrique: 'SF_GOODWILL' })).rejects.toThrow(/existe déjà pour le préfixe 24/);
        const l = [{ rubrique: 'SF_STOCKS', montant: 10 }, { rubrique: 'SF_RESERVES', montant: -5 }];
        await expect(service.ajouterRetraitement(T, { exerciceId: EX, libelle: 'x', fondement: 'IAS 2', lignes: l })).rejects.toThrow(/déséquilibré/);
        await expect(service.ajouterRetraitement(T, { exerciceId: EX, libelle: 'x', fondement: '', lignes: l })).rejects.toThrow(/sans fondement/);
        await expect(service.ajouterRetraitement(T, { exerciceId: 'autre', libelle: 'x', fondement: 'IAS 2', lignes: l })).rejects.toThrow(/introuvable/);
        expect(tables.retraitements).toHaveLength(0);
        expect(tables.regles).toHaveLength(1);
    });
});
describe('IfrsService · variation des capitaux propres sur trois exercices', () => {
    it('deux blocs, N et N-1 ; l’écart non déclaré est nommé, la distribution déclarée l’explique', async () => {
        const { service, tables } = doublure(true, true);
        for (const r of REGLES)
            await service.ajouterRegle(T, r);
        await service.declarerActivite(T, { activitePrincipale: 'AUCUNE' });
        let e = await service.etat(T, EX);
        const L = (v, cle) => v.lignes.find((l) => l.cle === cle);
        expect(L(e.variationCapitauxPropres.n1, 'RESULTAT_NET').reserves).toBe(100);
        expect(L(e.variationCapitauxPropres.n1, 'ECART_NON_EXPLIQUE')).toBeUndefined();
        expect(L(e.variationCapitauxPropres.n, 'ECART_NON_EXPLIQUE').reserves).toBe(-100);
        expect(e.n.motifsNonPubliable.join(' ')).toMatch(/-100 de variation/);
        await service.ajouterMouvementCp(T, { exerciceId: EX, type: 'DISTRIBUTION', composante: 'RESERVES', montant: -100, libelle: 'Dividende 2025', justification: 'PV AGO' });
        expect(tables.mouvements).toHaveLength(1);
        e = await service.etat(T, EX);
        expect(L(e.variationCapitauxPropres.n, 'DISTRIBUTIONS').reserves).toBe(-100);
        expect(L(e.variationCapitauxPropres.n, 'ECART_NON_EXPLIQUE')).toBeUndefined();
        expect(e.n.motifsNonPubliable.join(' ')).not.toMatch(/de variation que ni le résultat global/);
        expect(e.variationCapitauxPropres.mouvements.map((m) => m.montant)).toEqual([-100]);
    });
    it('sans l’exercice N-2, le bloc comparatif n’est pas rendu et le jeu le dit (§ 10 f)', async () => {
        const { service } = doublure(true);
        for (const r of REGLES)
            await service.ajouterRegle(T, r);
        const e = await service.etat(T, EX);
        expect(e.variationCapitauxPropres.n).not.toBeNull();
        expect(e.variationCapitauxPropres.n1).toBeNull();
        expect(e.n.motifsNonPubliable.join(' ')).toMatch(/Bloc comparatif de l’état des variations des capitaux propres non établi \(IFRS 18 § 10 f\)/);
    });
    it('refus à la porte · distribution positive, mouvement d’un autre dossier', async () => {
        const { service, tables } = doublure();
        await expect(service.ajouterMouvementCp(T, { exerciceId: EX, type: 'DISTRIBUTION', composante: 'RESERVES', montant: 10, libelle: 'x', justification: 'PV' })).rejects.toThrow(/montant est négatif/);
        await expect(service.supprimerMouvementCp('autre-dossier', 'm-1')).rejects.toThrow(/introuvable/);
        expect(tables.mouvements).toHaveLength(0);
    });
});
describe('IfrsService · première application (IFRS 1)', () => {
    const B = {
        [EX1]: [
            ['24100000', 950, 750, 0],
            ['10100000', -800, 0, 700],
            ['14100000', -50, 0, 50],
            ['70100000', -400],
            ['60100000', 300],
        ],
    };
    const REGLES_PA = [...REGLES, { prefixe: '14', rubrique: 'SF_FOURNISSEURS_NC' }];
    const lignes = (immo, contrepartie, montant = immo) => [
        { rubrique: 'SF_IMMOBILISATIONS_CORPORELLES', montant: immo },
        { rubrique: contrepartie, montant: -montant },
    ];
    async function dossier() {
        const d = doublure(true, true, B);
        for (const r of REGLES_PA)
            await d.service.ajouterRegle(T, r);
        await d.service.declarerActivite(T, { activitePrincipale: 'AUCUNE' });
        await d.service.declarerPremiereApplication(T, { premierExerciceIfrsId: EX, dejaAdoptant: false });
        return d;
    }
    it('trois rapprochements chiffrés à la main, reclassement et méthodes avant erreurs (§ 24 a i, a ii, b, § 26)', async () => {
        const { service } = await dossier();
        await service.ajouterRetraitement(T, { exerciceId: EX1, libelle: 'Coût présumé', fondement: 'IFRS 1 § D5', lignes: lignes(100, 'SF_RESERVES'), aLaTransition: true });
        await service.ajouterRetraitement(T, { exerciceId: EX1, libelle: 'Coût présumé reporté', fondement: 'IFRS 1 § D5', lignes: lignes(100, 'SF_RESERVES') });
        await service.ajouterRetraitement(T, {
            exerciceId: EX1,
            libelle: 'Amortissement de l’écart',
            fondement: 'IAS 16 § 50',
            lignes: [{ rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES', montant: 20 }, { rubrique: 'SF_IMMOBILISATIONS_CORPORELLES', montant: -20 }],
        });
        await service.ajouterRetraitement(T, {
            exerciceId: EX1,
            libelle: 'Facture omise',
            fondement: 'IAS 8 § 42',
            correctionErreur: true,
            lignes: [{ rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES', montant: 10 }, { rubrique: 'SF_FOURNISSEURS', montant: -10 }],
        });
        const e = await service.etat(T, EX);
        const pa = e.premiereApplication;
        expect(pa.dateTransition).toBe('2025-01-01');
        const [ouverture, cloture, global] = pa.rapprochements;
        expect(ouverture.lignes.map((l) => [l.cle.replace(/^R_.*/, 'R'), l.montant])).toEqual([['DEPART', 750], ['RECLASSEMENTS', -50], ['R', 100], ['ARRIVEE', 800]]);
        expect(cloture.lignes.map((l) => [l.libelle, l.nature ?? null, l.montant])).toEqual([
            ['Capitaux propres selon le SYSCOHADA (bilan, total CP)', null, 950],
            ['Reclassements de présentation (règles de correspondance)', null, -50],
            ['Coût présumé reporté', 'METHODE', 100],
            ['Amortissement de l’écart', 'METHODE', -20],
            ['Facture omise', 'ERREUR', -10],
            ['Capitaux propres selon les IFRS', null, 970],
        ]);
        expect(global.lignes.map((l) => l.montant)).toEqual([100, -20, -10, 70]);
        expect(pa.rapprochements.every((r) => r.ecart === 0)).toBe(true);
        expect(e.n1.rapprochements.capitauxPropresIfrs).toBe(970);
        expect(e.ajustementsTransition.map((r) => r.libelle)).toEqual(['Coût présumé']);
    });
    it('le bloc comparatif des capitaux propres part de l’état d’ouverture, pas de la clôture N-2', async () => {
        const { service } = await dossier();
        await service.ajouterRetraitement(T, { exerciceId: EX1, libelle: 'Coût présumé', fondement: 'IFRS 1 § D5', lignes: lignes(100, 'SF_RESERVES'), aLaTransition: true });
        await service.ajouterRetraitement(T, { exerciceId: EX1, libelle: 'Coût présumé reporté', fondement: 'IFRS 1 § D5', lignes: lignes(100, 'SF_RESERVES') });
        await service.ajouterMouvementCp(T, { exerciceId: EX1, type: 'APPORT', composante: 'CAPITAL', montant: 100, libelle: 'Apport en nature', justification: 'PV AGE' });
        const e = await service.etat(T, EX);
        const L = (cle) => e.variationCapitauxPropres.n1.lignes.find((l) => l.cle === cle);
        expect(L('OUVERTURE_PUBLIEE')).toMatchObject({ capital: 700, reserves: 100 });
        expect(L('APPORTS')).toMatchObject({ capital: 100 });
        expect(L('CLOTURE')).toMatchObject({ capital: 800, reserves: 200 });
        expect(L('ECART_NON_EXPLIQUE')).toBeUndefined();
    });
    it('ajustement de transition · refusé hors de l’exercice comparatif, sans premier exercice déclaré, ou vers le résultat (§ 11)', async () => {
        const nu = doublure(true);
        await expect(nu.service.ajouterRetraitement(T, { exerciceId: EX1, libelle: 'x', fondement: 'IFRS 1 § D5', lignes: lignes(10, 'SF_RESERVES'), aLaTransition: true })).rejects.toThrow(/suppose un premier exercice IFRS déclaré/);
        const { service, tables } = await dossier();
        await expect(service.ajouterRetraitement(T, { exerciceId: EX, libelle: 'x', fondement: 'IFRS 1 § D5', lignes: lignes(10, 'SF_RESERVES'), aLaTransition: true })).rejects.toThrow(/se pose sur l’exercice comparatif/);
        await expect(service.ajouterRetraitement(T, {
            exerciceId: EX1,
            libelle: 'x',
            fondement: 'IFRS 1 § D5',
            lignes: [{ rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES', montant: 10 }, { rubrique: 'SF_FOURNISSEURS', montant: -10 }],
            aLaTransition: true,
        })).rejects.toThrow(/IFRS 1 § 11/);
        expect(tables.retraitements).toHaveLength(0);
    });
    it('la déclaration · non déclarée, le jeu le dit ; déjà adoptant, rien ; les deux à la fois, refusé', async () => {
        const { service } = doublure(true, false, B);
        for (const r of REGLES_PA)
            await service.ajouterRegle(T, r);
        let e = await service.etat(T, EX);
        expect(e.n.motifsNonPubliable.join(' ')).toMatch(/Première application non déclarée · les premiers états financiers IFRS relèvent d’IFRS 1 \(§ 2 et 3\)/);
        expect(e.premiereApplication).toBeNull();
        await service.declarerPremiereApplication(T, { premierExerciceIfrsId: null, dejaAdoptant: true });
        e = await service.etat(T, EX);
        expect(e.n.motifsNonPubliable.join(' ')).not.toMatch(/Première application/);
        await expect(service.declarerPremiereApplication(T, { premierExerciceIfrsId: EX, dejaAdoptant: true })).rejects.toThrow(/l’un ou l’autre/);
        await expect(service.declarerPremiereApplication(T, { premierExerciceIfrsId: 'ailleurs', dejaAdoptant: false })).rejects.toThrow(/introuvable/);
    });
    it('un premier exercice sans exercice comparatif, et un exercice antérieur à la transition, sont nommés', async () => {
        const seul = doublure();
        await seul.service.declarerPremiereApplication(T, { premierExerciceIfrsId: EX });
        const e = await seul.service.etat(T, EX);
        expect(e.premiereApplication).toBeNull();
        expect(e.motifPremiereApplication).toMatch(/au moins un exercice comparatif \(IFRS 1 § 21\)/);
        expect(e.n.motifsNonPubliable.join(' ')).toMatch(/Première application non établie · Le premier exercice IFRS présente/);
        const trois = doublure(true, true);
        for (const r of REGLES)
            await trois.service.ajouterRegle(T, r);
        await trois.service.declarerPremiereApplication(T, { premierExerciceIfrsId: EX });
        const avant = await trois.service.etat(T, EX2);
        expect(avant.n.motifsNonPubliable.join(' ')).toMatch(/Exercice antérieur à la date de transition aux IFRS/);
        const comparatif = await trois.service.etat(T, EX1);
        expect(comparatif.n.motifsNonPubliable.join(' ')).not.toMatch(/Exercice antérieur à la date de transition/);
    });
});
describe('IfrsService · tableau des flux de trésorerie (IAS 7 modifiée par IFRS 18)', () => {
    const B = {
        [EX1]: [
            ['52110000', 1000, 1000, 0],
            ['10130000', -1000, 0, 1000],
        ],
        [EX]: [
            ['52110000', 1280, 1000, 0],
            ['50110000', 100],
            ['24110000', 300],
            ['28410000', -50],
            ['10130000', -1000, 0, 1000],
            ['16200000', -400],
            ['70110000', -500],
            ['60110000', 200],
            ['68130000', 50],
            ['67110000', 30],
            ['77120000', -10],
        ],
    };
    const REGLES_FLUX = [
        { prefixe: '24', rubrique: 'SF_IMMOBILISATIONS_CORPORELLES' },
        { prefixe: '28', rubrique: 'SF_IMMOBILISATIONS_CORPORELLES' },
        { prefixe: '10', rubrique: 'SF_CAPITAL' },
        { prefixe: '16', rubrique: 'SF_PASSIFS_FINANCIERS_NC' },
        { prefixe: '50', rubrique: 'SF_ACTIFS_FINANCIERS_C' },
        { prefixe: '52', rubrique: 'SF_TRESORERIE' },
        { prefixe: '70', rubrique: 'PL_PRODUITS' },
        { prefixe: '60', rubrique: 'PL_ACHATS_CONSOMMES' },
        { prefixe: '68', rubrique: 'PL_AMORTISSEMENTS' },
        { prefixe: '67', rubrique: 'PL_CHARGES_FINANCEMENT' },
        { prefixe: '77', rubrique: 'PL_PRODUITS_INVESTISSEMENT' },
    ];
    async function dossier() {
        const d = doublure(true, false, B);
        for (const r of REGLES_FLUX)
            await d.service.ajouterRegle(T, r);
        await d.service.declarerActivite(T, { activitePrincipale: 'AUCUNE' });
        return d;
    }
    const M = (t, cle) => t.lignes.find((l) => l.cle === cle)?.montant;
    it('lot 14 · la réévaluation légale du module n’est pas une acquisition IFRS non plus · le tableau de départ la neutralise', async () => {
        const avecReevaluation = {
            ...B,
            [EX]: B[EX].map((l) => (l[0] === '24110000' ? ['24110000', 400] : l[0] === '28410000' ? ['28410000', -90] : l)).concat([
                ['10610000', -60],
            ]),
        };
        const d = doublure(true, false, avecReevaluation);
        for (const r of [...REGLES_FLUX, { prefixe: '106', rubrique: 'SF_CAPITAL' }])
            await d.service.ajouterRegle(T, r);
        await d.service.declarerActivite(T, { activitePrincipale: 'AUCUNE' });
        await d.service.declarerTresorerie(T, { decouvertsDansTresorerie: null, tresorerieEnDevises: false });
        d.ecritures.mouvementsDeReevaluation.mockImplementation(async (_t, ex) => ex === EX
            ? new Map([
                ['id-24110000', { debit: 100, credit: 0 }],
                ['id-28410000', { debit: 0, credit: 40 }],
                ['id-10610000', { debit: 0, credit: 60 }],
            ])
            : new Map());
        const t = (await d.service.etat(T, EX)).fluxTresorerie.n;
        expect(M(t, 'I_ACQ_CORPORELLES')).toBe(-300);
        expect(d.ecritures.mouvementsDeReevaluation).toHaveBeenCalledWith(T, EX);
    });
    it('du résultat d’exploitation à la trésorerie, chaque flux à sa place (§ 18 b, § 20, § 16, § 17, § 33A, § 34A)', async () => {
        const { service } = await dossier();
        await service.declarerTresorerie(T, { decouvertsDansTresorerie: null, tresorerieEnDevises: false });
        const e = await service.etat(T, EX);
        const t = e.fluxTresorerie.n;
        expect(t).not.toBeNull();
        expect(M(t, 'E_RESULTAT_EXPLOITATION')).toBe(250);
        expect(M(t, 'E_ELEMENTS_SANS_TRESORERIE')).toBe(50);
        expect(M(t, 'E_TOTAL')).toBe(300);
        expect(M(t, 'I_ACQ_CORPORELLES')).toBe(-300);
        expect(M(t, 'I_PLACEMENTS')).toBe(-100);
        expect(M(t, 'I_INTERETS_DIVIDENDES')).toBe(10);
        expect(M(t, 'I_TOTAL')).toBe(-390);
        expect(M(t, 'F_INTERETS')).toBe(-30);
        expect(M(t, 'F_TOTAL')).toBe(370);
        expect([M(t, 'T_VARIATION'), M(t, 'T_OUVERTURE'), M(t, 'T_CLOTURE'), M(t, 'T_ECART')]).toEqual([280, 1000, 1280, undefined]);
        expect(t.rapprochementLegal.map((x) => [x.syscohada, x.ifrs])).toEqual([[280, 300], [-300, -390], [400, 370], [380, 280]]);
        expect(t.rapprochementSituation.map((x) => x.montant)).toEqual([1280, 1280]);
        expect(t.motifsNonPubliable).toEqual([]);
        expect(e.fluxTresorerie.n1).toBeNull();
        expect(e.n.motifsNonPubliable.join(' ')).toMatch(/Tableau des flux de trésorerie comparatif non établi/);
    });
    it('un retraitement ne déplace aucune trésorerie · son effet sur le résultat d’exploitation est retiré (§ 20 b)', async () => {
        const { service } = await dossier();
        await service.declarerTresorerie(T, { tresorerieEnDevises: false });
        await service.ajouterRetraitement(T, {
            exerciceId: EX,
            libelle: 'Dépréciation',
            fondement: 'IAS 36 § 59',
            lignes: [{ rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES', montant: 40 }, { rubrique: 'SF_IMMOBILISATIONS_CORPORELLES', montant: -40 }],
        });
        const t = (await service.etat(T, EX)).fluxTresorerie.n;
        expect([M(t, 'E_RESULTAT_EXPLOITATION'), M(t, 'E_RETRAITEMENTS'), M(t, 'E_TOTAL')]).toEqual([210, 40, 300]);
    });
    it('§ 28 · la trésorerie en devises se déclare, et l’effet de change sort de sa catégorie pour sa propre ligne', async () => {
        const { service } = await dossier();
        let e = await service.etat(T, EX);
        expect(e.n.motifsNonPubliable.join(' ')).toMatch(/déclarez si la trésorerie comprend des soldes en devises/);
        await service.declarerTresorerie(T, { tresorerieEnDevises: true });
        e = await service.etat(T, EX);
        expect(e.n.motifsNonPubliable.join(' ')).toMatch(/l’effet de change de l’exercice n’est pas déclaré/);
        await service.declarerEffetChange(T, { exerciceId: EX, montant: 10, categorie: 'INVESTISSEMENT', justification: 'Conversion au cours de clôture' });
        const t = (await service.etat(T, EX)).fluxTresorerie.n;
        expect([M(t, 'I_INTERETS_DIVIDENDES'), M(t, 'T_CHANGE'), M(t, 'T_CLOTURE'), M(t, 'T_ECART')]).toEqual([0, 10, 1280, undefined]);
        expect(t.rapprochementLegal[3]).toMatchObject({ syscohada: 380, ifrs: 280 });
        expect(t.motifsNonPubliable).toEqual([]);
        await service.declarerTresorerie(T, { tresorerieEnDevises: false });
        await expect(service.declarerEffetChange(T, { exerciceId: EX, montant: 5, categorie: 'INVESTISSEMENT', justification: 'x' })).rejects.toThrow(/sans devises/);
    });
    const BD = {
        [EX1]: [
            ['52110000', 1000, 1000, 0],
            ['56100000', -200, 0, 200],
            ['10130000', -800, 0, 800],
        ],
        [EX]: [
            ['52110000', 1300, 1000, 0],
            ['56100000', -300, 0, 200],
            ['10130000', -800, 0, 800],
            ['70110000', -220],
            ['65820000', 20],
        ],
    };
    async function avecDecouvert(regle56) {
        const d = doublure(true, false, BD);
        for (const r of [
            { prefixe: '10', rubrique: 'SF_CAPITAL' },
            { prefixe: '52', rubrique: 'SF_TRESORERIE' },
            { prefixe: '56', rubrique: regle56 },
            { prefixe: '70', rubrique: 'PL_PRODUITS' },
        ]) {
            await d.service.ajouterRegle(T, r);
        }
        return d;
    }
    it('§ 8 · déclaré hors trésorerie, le découvert est un financement ; déclaré dedans, il se rapproche de la situation (§ 45)', async () => {
        const { service } = await avecDecouvert('SF_PASSIFS_FINANCIERS_C');
        let e = await service.etat(T, EX);
        expect(e.n.motifsNonPubliable.join(' ')).toMatch(/déclarez si les découverts bancaires font partie intégrante/);
        await service.declarerTresorerie(T, { decouvertsDansTresorerie: false, tresorerieEnDevises: false });
        let t = (await service.etat(T, EX)).fluxTresorerie.n;
        expect([M(t, 'E_TOTAL'), M(t, 'F_CREDITS_TRESORERIE'), M(t, 'I_PLACEMENTS'), M(t, 'T_OUVERTURE'), M(t, 'T_CLOTURE'), M(t, 'T_ECART')]).toEqual([
            200, 100, undefined, 1000, 1300, undefined,
        ]);
        await service.declarerTresorerie(T, { decouvertsDansTresorerie: true, tresorerieEnDevises: false });
        e = await service.etat(T, EX);
        t = e.fluxTresorerie.n;
        expect([M(t, 'F_CREDITS_TRESORERIE'), M(t, 'T_OUVERTURE'), M(t, 'T_CLOTURE'), M(t, 'T_ECART')]).toEqual([undefined, 800, 1000, undefined]);
        expect(t.rapprochementSituation.map((x) => [x.cle, x.montant])).toEqual([['R_SITUATION', 1300], ['R_DECOUVERTS', -300], ['R_TABLEAU', 1000]]);
    });
    it('§ 45 · un découvert déjà rangé en trésorerie par sa règle n’est pas rapproché une seconde fois', async () => {
        const { service } = await avecDecouvert('SF_TRESORERIE');
        await service.declarerTresorerie(T, { decouvertsDansTresorerie: true, tresorerieEnDevises: false });
        const t = (await service.etat(T, EX)).fluxTresorerie.n;
        expect(t.rapprochementSituation.map((x) => [x.cle, x.montant])).toEqual([['R_SITUATION', 1000], ['R_TABLEAU', 1000]]);
    });
    it('sans l’exercice précédent, pas de tableau, et le jeu le dit', async () => {
        const { service } = doublure();
        const e = await service.etat(T, EX);
        expect(e.fluxTresorerie.n).toBeNull();
        expect(e.n.motifsNonPubliable.join(' ')).toMatch(/Tableau des flux de trésorerie non établi · Sans l’exercice précédent/);
    });
});
describe('F234 · les lectures IFRS exigent l’exercice', () => {
    it.each(['etat', 'etatConsolide'])('%s · le paramètre exerciceId passe par un ParseUUIDPipe', (methode) => {
        const args = Reflect.getMetadata(constants_1.ROUTE_ARGS_METADATA, ifrs_controller_1.IfrsController, methode);
        const exercice = Object.values(args).find((a) => a.data === 'exerciceId');
        expect(exercice?.pipes).toContain(exercice_requis_1.EXERCICE_REQUIS);
        expect(exercice_requis_1.EXERCICE_REQUIS.format).toBeInstanceOf(common_1.ParseUUIDPipe);
    });
    it('au service aussi · sans exercice, 400, jamais l’état du premier exercice venu', async () => {
        const { service } = doublure(true, true);
        for (const r of REGLES)
            await service.ajouterRegle(T, r);
        await expect(service.etat(T, undefined)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/exerciceId est requis/) });
        await expect(service.etatConsolide(T, undefined)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/exerciceId est requis/) });
    });
});
describe('IfrsController · les écritures sont réservées', () => {
    it('toute route qui écrit porte @Roles, sans la lecture seule', () => {
        const proto = ifrs_controller_1.IfrsController.prototype;
        for (const m of ['declarerNotes', 'declarerActivite', 'declarerPremiereApplication', 'declarerTresorerie', 'declarerEffetChange', 'supprimerEffetChange', 'ajouterRegle', 'supprimerRegle', 'ajouterRetraitement', 'supprimerRetraitement', 'ajouterMouvementCp', 'supprimerMouvementCp', 'ajouterRegleConsolidation', 'supprimerRegleConsolidation']) {
            const roles = Reflect.getMetadata(roles_decorator_1.ROLES_KEY, proto[m]);
            expect(roles).toEqual([client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE]);
        }
    });
});
describe('IfrsService · les notes (IFRS 18 § 113 à 132, IAS 8)', () => {
    it('la déclaration est ENREGISTRÉE sous sa forme normalisée · ce qui est illisible devient null', async () => {
        const { service, tables } = doublure();
        await service.declarerNotes(T, { exerciceId: EX, contenu: { entite: { domicile: '  Kinshasa ' }, conformiteDeclaree: 'oui', dividendes: { proposesNonComptabilises: '0' } } });
        expect(tables.notes).toHaveLength(1);
        expect(tables.notes[0]).toMatchObject({ tenantId: T, exerciceId: EX });
        expect(tables.notes[0].contenu.entite.domicile).toBe('Kinshasa');
        expect(tables.notes[0].contenu.conformiteDeclaree).toBeNull();
        expect(tables.notes[0].contenu.dividendes.proposesNonComptabilises).toBe(0);
    });
    it('refus à la porte · une déclaration qui se contredit, un exercice d’un autre dossier', async () => {
        const { service, tables } = doublure();
        await expect(service.declarerNotes(T, { exerciceId: EX, contenu: { entite: { sansSocieteMere: true, societeMere: 'Holding' } } })).rejects.toThrow(/§ 116 c/);
        await expect(service.declarerNotes('autre-dossier', { exerciceId: EX, contenu: {} })).rejects.toThrow(/Exercice introuvable/);
        expect(tables.notes).toHaveLength(0);
    });
    it('l’état rend les notes de l’exercice, la fiche du dossier à défaut, et les déclarations N-1 lues sur SON exercice', async () => {
        const { service } = doublure(true);
        for (const r of REGLES)
            await service.ajouterRegle(T, r);
        await service.declarerNotes(T, { exerciceId: EX1, contenu: { conformiteDeclaree: true, methodes: [{ intitule: 'Stocks', texte: 'Coût moyen pondéré.' }] } });
        const e = await service.etat(T, EX);
        expect(e.notes.declarations.methodes).toEqual([]);
        expect(e.notes.declarationsN1.methodes).toEqual([{ intitule: 'Stocks', texte: 'Coût moyen pondéré.' }]);
        const entite = e.notes.notes.find((x) => x.cle === 'ENTITE').blocs;
        expect(entite).toContainEqual({ type: 'texte', texte: 'Dénomination · Société Alpha', source: 'FICHE_DOSSIER' });
        expect(entite).toContainEqual({ type: 'texte', texte: 'Adresse du siège social · 12 avenue du Port, Kinshasa', source: 'FICHE_DOSSIER' });
        expect(entite).toContainEqual({ type: 'texte', texte: 'Nature des opérations et principales activités · Négoce de matériaux', source: 'FICHE_DOSSIER' });
        expect(e.n.motifsNonPubliable).toContain('Notes · forme juridique de l’entité à renseigner (IFRS 18 § 116 a).');
        expect(e.n.motifsNonPubliable).toContain('Notes · informations significatives sur les méthodes comptables non déclarées (IAS 8 § 27A).');
        const composition = e.notes.notes.find((x) => x.cle === 'POSTES').numero;
        expect(e.notes.renvois.SF_IMMOBILISATIONS_CORPORELLES).toEqual([composition]);
    });
    it('la conformité déclarée n’est jamais imprimée sur un jeu non publiable · les motifs du jeu la suspendent', async () => {
        const { service } = doublure();
        for (const r of REGLES)
            await service.ajouterRegle(T, r);
        await service.declarerNotes(T, { exerciceId: EX, contenu: { conformiteDeclaree: true } });
        const e = await service.etat(T, EX);
        const base = e.notes.notes.find((x) => x.cle === 'BASE').blocs[0];
        expect(base.type).toBe('manque');
        expect(base.texte).toMatch(/NON IMPRIMÉE/);
        expect(e.notes.notes.find((x) => x.cle === 'BASE').blocs.some((x) => x.type === 'texte' && /par anticipation/.test(x.texte))).toBe(true);
    });
    it('des notes complètes ne suffisent pas · les motifs du RESTE du jeu suspendent aussi la conformité', async () => {
        const { service } = doublure();
        for (const r of REGLES)
            await service.ajouterRegle(T, r);
        await service.declarerNotes(T, {
            exerciceId: EX,
            contenu: {
                entite: { formeJuridique: 'Société anonyme', sansSocieteMere: true, dureeVieLimitee: false },
                conformiteDeclaree: true,
                continuite: { retenue: true, incertitudesSignificatives: false },
                methodes: [{ intitule: 'Immobilisations', texte: 'Coût historique, amortissement linéaire.' }],
                aucunJugement: true,
                aucuneEstimation: true,
                aucuneMesurePerformance: true,
                capital: {
                    description: 'Les capitaux propres.',
                    commentObjectifsAtteints: 'Autofinancement.',
                    soumisExigencesExternes: false,
                    changements: 'Aucun.',
                    quantitatif: [{ libelle: 'Capitaux propres', montantN: 1000 }],
                },
                sansCapitalSocial: true,
                informationsEquivalentes: 'Associé unique.',
                dividendes: { proposesNonComptabilises: 0, preferentielsCumulesNonComptabilises: 0 },
            },
        });
        const e = await service.etat(T, EX);
        expect(e.notes.motifsNonPubliable).toEqual([]);
        expect(e.n.motifsNonPubliable.some((m) => m.startsWith('Notes ·'))).toBe(false);
        expect(e.n.motifsNonPubliable.length).toBeGreaterThan(0);
        expect(e.notes.notes.find((x) => x.cle === 'BASE').blocs[0].type).toBe('manque');
    });
    it('des distributions déclarées sur l’exercice appellent le § 110', async () => {
        const { service } = doublure();
        for (const r of REGLES)
            await service.ajouterRegle(T, r);
        await service.declarerNotes(T, { exerciceId: EX, contenu: { categoriesActions: [{ intitule: 'Ordinaires' }] } });
        const avant = await service.etat(T, EX);
        expect(avant.n.motifsNonPubliable.some((m) => /§ 110/.test(m))).toBe(false);
        await service.ajouterMouvementCp(T, { exerciceId: EX, type: 'DISTRIBUTION', composante: 'RESERVES', montant: -50, libelle: 'Dividende', justification: 'PV AG' });
        const apres = await service.etat(T, EX);
        expect(apres.n.motifsNonPubliable).toContain('Notes · montant par action des dividendes comptabilisés non déclaré (IFRS 18 § 110).');
    });
});
const LC = (cle, solde) => ({ cle, intitule: `Ligne ${cle}`, solde, poste: !/^\d/.test(cle) });
const CUMUL = {
    lignes: [
        LC('24100000', 1000), LC('52100000', 200), LC('40100000', -300), LC('70100000', -900), LC('60100000', 600),
        LC('ECART_ACQUISITION', 100), LC('AMORTISSEMENT_ECART_ACQUISITION', -20), LC('DOTATION_ECART_ACQUISITION', 10),
        LC('CAPITAL', -500), LC('RESERVES_GROUPE', -130), LC('INTERETS_MINORITAIRES', -60),
    ],
    capitauxPropres: {
        capital: 500, primes: 0, ecartsReevaluation: 0, reservesGroupe: 130, ecartsConversion: 0,
        resultatGroupe: 250, interetsMinoritairesHorsResultat: 60, resultatMinoritaires: 40, resultatEnsemble: 290,
    },
    conversions: [],
    conversionsIncompletes: [],
    retraitementsNonJoues: [],
    impotsDifferesIncomplets: [],
};
const REGLES_CONSO = [
    { prefixe: '24', rubrique: 'SF_IMMOBILISATIONS_CORPORELLES' }, { prefixe: '52', rubrique: 'SF_TRESORERIE' },
    { prefixe: '40', rubrique: 'SF_FOURNISSEURS' }, { prefixe: '70', rubrique: 'PL_PRODUITS' }, { prefixe: '60', rubrique: 'PL_ACHATS_CONSOMMES' },
];
const ANNULATION_GOODWILL = {
    libelle: 'Annulation de l’amortissement de l’écart d’acquisition',
    fondement: 'IFRS 3 § B63 a, IAS 36 § 90',
    lignes: [
        { rubrique: 'SF_GOODWILL', montant: 20 },
        { rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES', montant: -10 },
        { rubrique: 'SF_RESERVES', montant: -10 },
    ],
};
const X = (xs, cle) => xs.find((x) => x.cle === cle);
async function dossierConsolide(avecPrecedent = false) {
    const d = doublure(avecPrecedent);
    for (const r of REGLES_CONSO)
        await d.service.ajouterRegle(T, r);
    await d.service.ajouterRegleConsolidation(T, { poste: 'DOTATION_ECART_ACQUISITION', rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES' });
    d.cumulsParExercice[EX] = CUMUL;
    return d;
}
describe('IfrsService · états IFRS consolidés (tranche C1)', () => {
    it('un dossier qui ne se consolide pas ne rend pas d’état · il dit pourquoi, sans lever', async () => {
        const { service } = doublure();
        const e = await service.etatConsolide(T, EX);
        expect(e.n).toBeNull();
        expect(e.motifN).toBe('Aucun périmètre de consolidation pour cet exercice.');
    });
    it('la balance du cumul projetée, les minoritaires répartis, et la première application non déclarée est dite', async () => {
        const { service } = await dossierConsolide();
        const e = await service.etatConsolide(T, EX);
        expect(X(e.n.situation, 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE').ifrs).toBe(100);
        expect(X(e.n.resultat, 'RN_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE').ifrs).toBe(40);
        expect(X(e.n.resultat, 'PL_AUTRES_CHARGES_OPERATIONNELLES').legal).toBe(-10);
        const m = e.n.motifsNonPubliable;
        expect(m).toContain('Première application consolidée non déclarée · les premiers états consolidés IFRS relèvent d’IFRS 1 (§ 2 et 3). Déclarez le premier exercice IFRS du groupe, ou qu’il présente déjà des états consolidés conformes aux IFRS (§ 4 et 5).');
        expect(m).toContain('Comparatif consolidé non établi (IFRS 18 § 10 f) · Aucun exercice précédent dans le dossier · la colonne comparative est vide.');
        expect(m.join(' ')).toMatch(/IFRS 3 § B63 a/);
    });
    it('les retraitements individuels et consolidés ne se lisent jamais l’un pour l’autre', async () => {
        const { service } = await dossierConsolide();
        await service.ajouterRetraitement(T, { exerciceId: EX, ...ANNULATION_GOODWILL, consolide: true, partMinoritairesResultat: 0, partMinoritairesCapitauxPropres: 0 });
        const c = await service.etatConsolide(T, EX);
        expect(X(c.n.situation, 'SF_GOODWILL').ifrs).toBe(100);
        expect(c.n.motifsNonPubliable.join(' ')).not.toMatch(/IFRS 3 § B63 a l’évalue/);
        expect(c.retraitements).toHaveLength(1);
        const i = await service.etat(T, EX);
        expect(i.retraitements).toHaveLength(0);
        expect(X(i.n.situation, 'SF_GOODWILL')?.retraitements ?? 0).toBe(0);
    });
    it('un retraitement individuel ne corrige pas l’état consolidé', async () => {
        const { service, tables } = await dossierConsolide();
        tables.retraitements.push({
            id: 'ind', tenantId: T, exerciceId: EX, aLaTransition: false, consolide: false, createdAt: new Date(), correctionErreur: false,
            libelle: 'Individuel', fondement: 'IAS 16', partMinoritairesResultat: null, partMinoritairesOci: null, partMinoritairesCapitauxPropres: null,
            lignes: [{ rubrique: 'SF_GOODWILL', montant: new client_1.Prisma.Decimal(20) }, { rubrique: 'SF_RESERVES', montant: new client_1.Prisma.Decimal(-20) }],
        });
        const c = await service.etatConsolide(T, EX);
        expect(c.retraitements).toHaveLength(0);
        expect(X(c.n.situation, 'SF_GOODWILL').ifrs).toBe(80);
    });
    it('la part des minoritaires déclarée est enregistrée et répartie (IFRS 10 § B94)', async () => {
        const { service, tables } = await dossierConsolide();
        await service.ajouterRetraitement(T, {
            exerciceId: EX,
            libelle: 'Perte de valeur de l’écart d’acquisition',
            fondement: 'IAS 36 § 90',
            lignes: [{ rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES', montant: 12 }, { rubrique: 'SF_GOODWILL', montant: -12 }],
            consolide: true,
            partMinoritairesResultat: -3,
        });
        expect(tables.retraitements[0]).toMatchObject({ consolide: true, partMinoritairesResultat: -3, partMinoritairesOci: null });
        const c = await service.etatConsolide(T, EX);
        expect(X(c.n.resultat, 'RN_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE').ifrs).toBe(37);
        expect(X(c.n.resultat, 'RN_PROPRIETAIRES').ifrs).toBe(241);
    });
    it('la porte refuse ce que le moteur refuserait · part manquante, part sur un individuel, transition consolidée', async () => {
        const { service, tables } = await dossierConsolide();
        await expect(service.ajouterRetraitement(T, { exerciceId: EX, ...ANNULATION_GOODWILL, consolide: true })).rejects.toThrow(/IFRS 10 § B94/);
        await expect(service.ajouterRetraitement(T, { exerciceId: EX, ...ANNULATION_GOODWILL, partMinoritairesResultat: 0 })).rejects.toThrow(/n’existe que dans les comptes consolidés/);
        await expect(service.ajouterRetraitement(T, { exerciceId: EX, ...ANNULATION_GOODWILL, consolide: true, aLaTransition: true, partMinoritairesResultat: 0, partMinoritairesCapitauxPropres: 0 })).rejects.toThrow(/IFRS 1 § 11/);
        expect(tables.retraitements).toHaveLength(0);
    });
    it('le comparatif est une seconde consolidation, avec SES retraitements, ou son motif', async () => {
        const d = await dossierConsolide(true);
        let e = await d.service.etatConsolide(T, EX);
        expect(e.n1).toBeNull();
        expect(e.motifN1).toBe('L’exercice précédent ne se consolide pas · Aucun périmètre de consolidation pour cet exercice.');
        d.cumulsParExercice[EX1] = CUMUL;
        await d.service.ajouterRetraitement(T, { exerciceId: EX1, ...ANNULATION_GOODWILL, consolide: true, partMinoritairesResultat: 0, partMinoritairesCapitauxPropres: 0 });
        e = await d.service.etatConsolide(T, EX);
        expect(X(e.n1.situation, 'SF_GOODWILL').ifrs).toBe(100);
        expect(X(e.n.situation, 'SF_GOODWILL').ifrs).toBe(80);
        expect(e.n.motifsNonPubliable.join(' ')).not.toMatch(/Comparatif consolidé non établi/);
        expect(d.cumuls.cumul).toHaveBeenCalledWith(T, EX1);
    });
    it('une règle de poste passe par la même règle que le calcul, une seule par poste', async () => {
        const { service, tables } = await dossierConsolide();
        await expect(service.ajouterRegleConsolidation(T, { poste: 'ECART_ACQUISITION', rubrique: 'SF_GOODWILL' })).rejects.toThrow(/rangé par IFRS 18 elle-même/);
        await expect(service.ajouterRegleConsolidation(T, { poste: 'DOTATION_ECART_ACQUISITION', rubrique: 'PL_PRODUITS' })).rejects.toThrow(/déjà une rubrique/);
        await expect(service.supprimerRegleConsolidation('autre-dossier', tables.reglesConso[0].id)).rejects.toThrow(/introuvable/);
        await service.supprimerRegleConsolidation(T, tables.reglesConso[0].id);
        expect(tables.reglesConso).toHaveLength(0);
        const e = await service.etatConsolide(T, EX);
        expect(e.n.motifsNonPubliable).toContain(`Poste de consolidation « ${cumul_consolidation_1.LIBELLE_POSTE.DOTATION_ECART_ACQUISITION} » sans rubrique IFRS · déclarez la ligne où il se range.`);
    });
});
const CUMUL_CONVERSION = (groupe, minoritaires, me) => ({
    ...CUMUL,
    lignes: [...CUMUL.lignes, LC('ECARTS_CONVERSION', -groupe), LC('INTERETS_MINORITAIRES', -minoritaires), LC('24100000', groupe + minoritaires)],
    capitauxPropres: { ...CUMUL.capitauxPropres, ecartsConversion: groupe, ecartsConversionMinoritaires: minoritaires, ecartsConversionMe: me, interetsMinoritairesHorsResultat: 60 + minoritaires },
    conversions: [{ entite: 'Filiale', monnaie: 'USD', coursCloture: 1, coursProduitsCharges: 1, ecartConversion: groupe + minoritaires }],
    obstaclesFlux: ['Filiale est convertie.'],
    mouvements: [],
});
describe('IfrsService · écarts de conversion consolidés (IAS 21 § 39 c et § 41)', () => {
    it('la variation de N se lit sur le cumul N-1, celle du comparatif sur N-2, ou son motif', async () => {
        const d = doublure(true);
        for (const r of REGLES_CONSO)
            await d.service.ajouterRegle(T, r);
        await d.service.ajouterRegleConsolidation(T, { poste: 'DOTATION_ECART_ACQUISITION', rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES' });
        d.cumulsParExercice[EX] = CUMUL_CONVERSION(15, 5, 4);
        d.cumulsParExercice[EX1] = CUMUL_CONVERSION(10, 3, 1);
        const filiale = { ...ENTITE, id: 'f', nom: 'Filiale', estConsolidante: false, methode: 'IG', pctInteret: 75 };
        d.perimetresParExercice[EX] = [PERIMETRE[0], filiale];
        d.perimetresParExercice[EX1] = [PERIMETRE[0], filiale];
        const e = await d.service.etatConsolide(T, EX);
        expect(X(e.n.resultatGlobal, 'OCI_R_AUTRES').legal).toBe(4);
        expect(X(e.n.resultatGlobal, 'OCI_R_QUOTE_PART_MEE').legal).toBe(3);
        expect(X(e.n.resultatGlobal, 'RG_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE').legal).toBe(42);
        expect(e.n.motifsNonPubliable.some((m) => /IAS 21/.test(m))).toBe(false);
        expect(X(e.n1.resultatGlobal, 'TOTAL_OCI').legal).toBe(0);
        expect(e.n1.motifsNonPubliable.some((m) => /IAS 21 § 39 c/.test(m) && /exercice précédent/.test(m))).toBe(true);
        expect(d.cumuls.cumul.mock.calls.filter((c) => c[1] === EX1)).toHaveLength(1);
        const d2 = doublure(true, true);
        for (const r of REGLES_CONSO)
            await d2.service.ajouterRegle(T, r);
        await d2.service.ajouterRegleConsolidation(T, { poste: 'DOTATION_ECART_ACQUISITION', rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES' });
        d2.cumulsParExercice[EX] = CUMUL_CONVERSION(15, 5, 4);
        d2.cumulsParExercice[EX1] = CUMUL_CONVERSION(10, 3, 1);
        d2.cumulsParExercice[EX2] = CUMUL_CONVERSION(8, 2, 0);
        const e2 = await d2.service.etatConsolide(T, EX);
        expect(X(e2.n1.resultatGlobal, 'TOTAL_OCI').legal).toBe(3);
        expect(X(e2.n1.resultatGlobal, 'OCI_R_QUOTE_PART_MEE').legal).toBe(1);
        d.perimetresParExercice[EX1] = [PERIMETRE[0], { ...filiale, pctInteret: 60 }];
        const p = await d.service.etatConsolide(T, EX);
        expect(X(p.n.resultatGlobal, 'TOTAL_OCI').legal).toBe(0);
        expect(p.n.motifsNonPubliable.some((m) => /IFRS 10 § B96/.test(m))).toBe(true);
    });
});
const LM = (cle, debit, credit) => ({ cle, intitule: `Ligne ${cle}`, debit, credit });
const cumulFlux = (n) => ({
    lignes: n
        ? [LC('52100000', 530), LC('24100000', 1000), LC('40100000', -300), LC('70100000', -900), LC('60100000', 600), LC('CAPITAL', -500), LC('RESERVES_GROUPE', -500), LC('TITRES_MIS_EN_EQUIVALENCE', 70)]
        : [LC('52100000', 200), LC('24100000', 1000), LC('40100000', -300), LC('CAPITAL', -500), LC('RESERVES_GROUPE', -500), LC('TITRES_MIS_EN_EQUIVALENCE', 100)],
    mouvements: n ? [LM('52100000', 930, 600), LM('70100000', 0, 900), LM('60100000', 600, 0)] : [],
    capitauxPropres: {
        capital: 500, primes: 0, ecartsReevaluation: 0, reservesGroupe: 500, ecartsConversion: 0,
        resultatGroupe: n ? 300 : 0, interetsMinoritairesHorsResultat: 0, resultatMinoritaires: 0, resultatEnsemble: n ? 300 : 0,
    },
    obstaclesFlux: [],
    dividendesRecusMe: n ? 30 : 0,
    ecartsEvaluationStocksResultat: 0,
    conversions: [],
    conversionsIncompletes: [],
    retraitementsNonJoues: [],
    impotsDifferesIncomplets: [],
});
const ENTITE = { pctControle: 100, natureControle: 'EXCLUSIF_DE_DROIT', fondement: 'art. 78', aJustifierEnNotes: [], exclusion: null, dateCloture: null };
const PERIMETRE = [
    { ...ENTITE, id: 'm', nom: 'Mère', estConsolidante: true, methode: 'IG', pctInteret: 100 },
    { ...ENTITE, id: 'a', nom: 'Associée', estConsolidante: false, methode: 'ME', pctInteret: 30, pctControle: 30, natureControle: 'INFLUENCE_NOTABLE' },
];
async function dossierFluxConsolide() {
    const d = doublure(true);
    for (const r of REGLES_CONSO)
        await d.service.ajouterRegle(T, r);
    d.cumulsParExercice[EX] = cumulFlux(true);
    d.cumulsParExercice[EX1] = cumulFlux(false);
    d.perimetresParExercice[EX] = PERIMETRE;
    d.perimetresParExercice[EX1] = PERIMETRE;
    await d.service.declarerTresorerie(T, { tresorerieGroupeEnDevises: false });
    return d;
}
describe('IfrsService · tableau des flux IFRS consolidé (tranche C2)', () => {
    it('le tableau du D4C repris puis reclassé · le dividende de la mise en équivalence à l’investissement, la trésorerie boucle', async () => {
        const { service } = await dossierFluxConsolide();
        const e = await service.etatConsolide(T, EX);
        const t = e.fluxTresorerie.n;
        expect([X(t.lignes, 'E_TOTAL').montant, X(t.lignes, 'I_DIVIDENDES_MEE').montant, X(t.lignes, 'T_VARIATION').montant, X(t.lignes, 'T_CLOTURE').montant]).toEqual([300, 30, 330, 530]);
        expect(X(t.lignes, 'T_ECART')).toBeUndefined();
        expect(t.rapprochementLegal.map((x) => x.syscohada)).toEqual([330, 0, 0, 330]);
        expect(e.n.motifsNonPubliable.join(' ')).not.toMatch(/Tableau des flux de trésorerie consolidé non/);
        expect(e.fluxTresorerie.motifN1).toMatch(/Aucun exercice avant l’exercice précédent/);
    });
    it('un périmètre qui a bougé arrête le tableau par le refus du D4C, dit sur le jeu', async () => {
        const d = await dossierFluxConsolide();
        d.perimetresParExercice[EX1] = [PERIMETRE[0]];
        const e = await d.service.etatConsolide(T, EX);
        expect(e.fluxTresorerie.n).toBeNull();
        expect(e.fluxTresorerie.motifN).toMatch(/^Le tableau des flux consolidé du D4C ne s’établit pas · .*Associée/);
        expect(e.n.motifsNonPubliable.join(' ')).toMatch(/Tableau des flux de trésorerie consolidé non établi \(IAS 7, IFRS 18 § 10 d\)/);
    });
    it('la trésorerie du groupe en devises se déclare à part, et l’effet individuel ne se lit pas au consolidé', async () => {
        const d = await dossierFluxConsolide();
        await d.service.declarerTresorerie(T, { tresorerieGroupeEnDevises: true });
        await d.service.declarerTresorerie(T, { tresorerieEnDevises: true });
        await d.service.declarerEffetChange(T, { exerciceId: EX, montant: 12, categorie: 'FINANCEMENT', justification: 'Conversion des comptes en USD de la mère' });
        let e = await d.service.etatConsolide(T, EX);
        expect(X(e.fluxTresorerie.n.lignes, 'T_CHANGE')).toBeUndefined();
        expect(e.n.motifsNonPubliable.join(' ')).toMatch(/l’effet de change de l’exercice n’est pas déclaré/);
        await d.service.declarerEffetChange(T, { exerciceId: EX, montant: 5, categorie: 'FINANCEMENT', justification: 'Filiale · USD', consolide: true });
        e = await d.service.etatConsolide(T, EX);
        expect(X(e.fluxTresorerie.n.lignes, 'T_CHANGE').montant).toBe(5);
        expect(Number(e.effetChange.montant)).toBe(5);
        expect(d.tables.parametres[0]).toMatchObject({ tresorerieEnDevises: true, tresorerieGroupeEnDevises: true });
        await d.service.supprimerEffetChange(T, EX, true);
        expect(d.tables.effets.map((x) => Number(x.montant))).toEqual([12]);
    });
    it('la CAFG est celle du D4C, élimination comprise · l’écart avec le tableau du D4C n’est que le dividende déplacé', async () => {
        const d = await dossierFluxConsolide();
        d.cumulsParExercice[EX] = { ...cumulFlux(true), ecartsEvaluationStocksResultat: 10 };
        const t = (await d.service.etatConsolide(T, EX)).fluxTresorerie.n;
        expect(t.rapprochementLegal[0]).toMatchObject({ syscohada: 320, ifrs: 290, ecart: -30 });
        expect(t.motifsNonPubliable.join(' ')).not.toMatch(/CAFG répartie/);
    });
    it('la déclaration des comptes individuels n’efface pas celle du groupe', async () => {
        const d = await dossierFluxConsolide();
        await d.service.declarerTresorerie(T, { decouvertsDansTresorerie: true, tresorerieEnDevises: false });
        expect(d.tables.parametres[0]).toMatchObject({ decouvertsDansTresorerie: true, tresorerieEnDevises: false, tresorerieGroupeEnDevises: false });
    });
    it('un groupe déclaré sans devises refuse un effet de change consolidé', async () => {
        const d = await dossierFluxConsolide();
        await expect(d.service.declarerEffetChange(T, { exerciceId: EX, montant: 5, categorie: 'FINANCEMENT', justification: 'x', consolide: true })).rejects.toThrow(/du groupe est déclarée sans devises/);
    });
});
describe('IfrsService · variation des capitaux propres consolidée (tranche C3)', () => {
    it('le bloc N rapproche les deux consolidations, le résultat du groupe explique la variation', async () => {
        const { service } = await dossierFluxConsolide();
        const v = (await service.etatConsolide(T, EX)).variationCapitauxPropres;
        const L = (cle) => v.n.lignes.find((l) => l.cle === cle);
        expect(L('OUVERTURE_RETRAITEE')).toMatchObject({ groupe: 1000, minoritaires: 0 });
        expect(L('RESULTAT_NET')).toMatchObject({ groupe: 300, total: 300 });
        expect(L('CLOTURE')).toMatchObject({ groupe: 1300, total: 1300 });
        expect(L('ECART_NON_EXPLIQUE')).toBeUndefined();
        expect(v.motifN1).toMatch(/^Le bloc comparatif part de la clôture N-2 · /);
    });
    it('un mouvement du groupe ne se lit jamais dans les comptes individuels, ni l’inverse', async () => {
        const d = await dossierFluxConsolide();
        const base = { exerciceId: EX, type: 'DISTRIBUTION', composante: 'RESERVES', montant: -50, justification: 'PV AGO' };
        await d.service.ajouterMouvementCp(T, { ...base, libelle: 'Dividende du groupe', consolide: true });
        await d.service.ajouterMouvementCp(T, { ...base, montant: -70, libelle: 'Dividende de la mère' });
        const c = (await d.service.etatConsolide(T, EX)).variationCapitauxPropres;
        expect(c.mouvements.map((m) => m.libelle)).toEqual(['Dividende du groupe']);
        expect(c.n.lignes.find((l) => l.cle === 'DISTRIBUTIONS').total).toBe(-50);
        expect(d.tables.mouvements.map((m) => m.consolide)).toEqual([true, false]);
    });
    it('la porte refuse les minoritaires aux comptes individuels et les accepte au consolidé', async () => {
        const d = await dossierFluxConsolide();
        const m = { exerciceId: EX, type: 'DISTRIBUTION', composante: 'MINORITAIRES', montant: -15, libelle: 'Dividende aux minoritaires', justification: 'PV' };
        await expect(d.service.ajouterMouvementCp(T, m)).rejects.toThrow(/n’existent que dans les comptes consolidés/);
        await d.service.ajouterMouvementCp(T, { ...m, consolide: true });
        expect(d.tables.mouvements).toHaveLength(1);
    });
});
describe('IfrsService · notes consolidées et IFRS 12 (tranche C4)', () => {
    it('la note IFRS 12 prend le dernier numéro, ses postes leurs renvois, et ses manques rendent le jeu non publiable', async () => {
        const { service } = await dossierFluxConsolide();
        const e = await service.etatConsolide(T, EX);
        const derniere = e.notes.notes[e.notes.notes.length - 1];
        expect([derniere.cle, derniere.numero]).toEqual(['IFRS12_INTERETS_AUTRES_ENTITES', e.notes.notes.length]);
        expect(e.notes.renvois.SF_PARTICIPATIONS_MEE).toContain(derniere.numero);
        const m = e.n.motifsNonPubliable.join(' ');
        expect(m).toContain('Notes · IFRS 12 · Associée · établissement principal');
        expect(m).not.toContain('Notes des états consolidés non servies');
    });
    it('les déclarations du groupe se rangent à part · IFRS 12 normalisé, notes de base consolidées, jamais lues pour le dossier', async () => {
        const d = await dossierFluxConsolide();
        await d.service.declarerNotesIfrs12(T, { exerciceId: EX, contenu: { jugements: 'Influence notable sur l’associée.', restrictions: '  ', partenaires: { Associée: { etablissement: 'Kinshasa' } } } });
        await d.service.declarerNotes(T, { exerciceId: EX, contenu: { conformiteDeclaree: true }, consolide: true });
        expect(d.tables.notes).toHaveLength(1);
        expect(d.tables.notes[0]).toMatchObject({ consolide: true, ifrs12: { jugements: 'Influence notable sur l’associée.', restrictions: null } });
        const e = await d.service.etatConsolide(T, EX);
        expect(e.notes.ifrs12.partenaires.Associée.etablissement).toBe('Kinshasa');
        expect(e.notes.declarations.conformiteDeclaree).toBe(true);
        expect(e.n.motifsNonPubliable.join(' ')).not.toContain('hypothèses et jugements importants non déclarés');
        const i = await d.service.etat(T, EX);
        expect(i.notes.declarations.conformiteDeclaree).toBeNull();
    });
});
describe('IfrsService · première application consolidée (tranche C5, IFRS 1)', () => {
    async function dossierIfrs1() {
        const d = doublure(true, true);
        for (const r of REGLES_CONSO)
            await d.service.ajouterRegle(T, r);
        d.cumulsParExercice[EX] = cumulFlux(true);
        d.cumulsParExercice[EX1] = cumulFlux(false);
        const n2 = cumulFlux(false);
        d.cumulsParExercice[EX2] = {
            ...n2,
            lignes: n2.lignes.map((l) => (l.cle === '52100000' ? { ...l, solde: 100 } : l.cle === 'RESERVES_GROUPE' ? { ...l, solde: -400 } : l)),
            capitauxPropres: { ...n2.capitauxPropres, reservesGroupe: 400 },
        };
        return d;
    }
    const AJUSTEMENT = {
        libelle: 'Réévaluation d’un terrain au coût présumé',
        fondement: 'IFRS 1 § D5',
        lignes: [{ rubrique: 'SF_IMMOBILISATIONS_CORPORELLES', montant: 50 }, { rubrique: 'SF_RESERVES', montant: -50 }],
        consolide: true,
        aLaTransition: true,
        partMinoritairesCapitauxPropres: 0,
    };
    it('l’ouverture est la consolidation de clôture N-2, les rapprochements du § 24 partent des capitaux propres du D4C', async () => {
        const d = await dossierIfrs1();
        await d.service.declarerPremiereApplication(T, { premierExerciceIfrsId: EX, consolide: true });
        await d.service.ajouterRetraitement(T, { exerciceId: EX1, ...AJUSTEMENT });
        const e = await d.service.etatConsolide(T, EX);
        const pa = e.premiereApplication;
        expect(pa.dateTransition).toBe('2025-01-01');
        expect(pa.rapprochements[0]).toMatchObject({ depart: 900, arrivee: 950, ecart: 0 });
        expect(pa.rapprochements[0].lignes.map((l) => l.cle)).toEqual(['DEPART', `R_${d.tables.retraitements[0].id}`, 'ARRIVEE']);
        expect(e.exerciceTransitionId).toBe(EX1);
        expect(e.ajustementsTransition).toHaveLength(1);
        const transition = e.notes.notes.find((x) => x.cle === 'TRANSITION');
        expect(transition?.titre).toBe('Transition aux normes IFRS');
        expect(JSON.stringify(transition?.blocs)).toContain('Capitaux propres consolidés selon le D4C (part du groupe et minoritaires)');
        expect(e.variationCapitauxPropres.n1.lignes.find((l) => l.cle === 'OUVERTURE_RETRAITEE').total).toBe(950);
        expect(d.cumuls.cumul).toHaveBeenCalledWith(T, EX2);
    });
    it('§ C1 · le choix sur les regroupements passés se déclare, et il se dit', async () => {
        const d = await dossierIfrs1();
        await d.service.declarerPremiereApplication(T, { premierExerciceIfrsId: EX, consolide: true });
        let e = await d.service.etatConsolide(T, EX);
        expect(e.n.motifsNonPubliable.join(' ')).toContain('(IFRS 1 § C1)');
        await d.service.declarerPremiereApplication(T, { premierExerciceIfrsId: EX, consolide: true, exemptionRegroupementsC1: true });
        e = await d.service.etatConsolide(T, EX);
        expect(e.n.motifsNonPubliable.join(' ')).not.toContain('(IFRS 1 § C1)');
        expect(e.premiereApplication.mentions.join(' ')).toContain('§ C4 g et h ii');
    });
    it('la déclaration du groupe ne touche pas celle du dossier, et l’ajustement consolidé se pose sur le comparatif du groupe', async () => {
        const d = await dossierIfrs1();
        await d.service.declarerPremiereApplication(T, { premierExerciceIfrsId: EX1 });
        await expect(d.service.ajouterRetraitement(T, { exerciceId: EX2, ...AJUSTEMENT })).rejects.toThrow(/premier exercice IFRS du groupe déclaré/);
        await d.service.declarerPremiereApplication(T, { premierExerciceIfrsId: EX, consolide: true, exemptionRegroupementsC1: false });
        expect(d.tables.parametres[0]).toMatchObject({ premierExerciceIfrsId: EX1, premierExerciceIfrsConsolideId: EX, exemptionRegroupementsC1: false });
        await expect(d.service.ajouterRetraitement(T, { exerciceId: EX, ...AJUSTEMENT })).rejects.toThrow(/se pose sur l’exercice comparatif/);
        await d.service.ajouterRetraitement(T, { exerciceId: EX1, ...AJUSTEMENT });
        expect(d.tables.retraitements).toHaveLength(1);
    });
    it('sans consolidation N-2, l’ouverture ne s’établit pas et le jeu le dit', async () => {
        const d = await dossierIfrs1();
        delete d.cumulsParExercice[EX2];
        await d.service.declarerPremiereApplication(T, { premierExerciceIfrsId: EX, consolide: true, exemptionRegroupementsC1: true });
        const e = await d.service.etatConsolide(T, EX);
        expect(e.premiereApplication).toBeNull();
        expect(e.motifPremiereApplication).toMatch(/^L’état d’ouverture à la date de transition est la consolidation de clôture/);
    });
});
describe('les tables IFRS ne sont lues que par le module IFRS', () => {
    it('les fichiers du serveur qui les nomment sont exactement le service IFRS, la liste du cloisonnement et le classement du journal d’audit', () => {
        const racine = (0, path_1.join)(__dirname, '..', '..');
        const fichiers = (dossier) => (0, fs_1.readdirSync)(dossier).flatMap((nom) => {
            const p = (0, path_1.join)(dossier, nom);
            return (0, fs_1.statSync)(p).isDirectory() ? fichiers(p) : p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
        });
        const lecteurs = fichiers(racine)
            .filter((f) => /\b(retraitementIfrs|regleCorrespondanceIfrs|parametresIfrs|ligneRetraitementIfrs|RetraitementIfrs|RegleCorrespondanceIfrs|ParametresIfrs|LigneRetraitementIfrs|mouvementCapitauxPropresIfrs|MouvementCapitauxPropresIfrs|effetChangeTresorerieIfrs|EffetChangeTresorerieIfrs|notesIfrs|NotesIfrs|regleConsolidationIfrs|RegleConsolidationIfrs)\b/.test((0, fs_1.readFileSync)(f, 'utf8')))
            .map((f) => (0, path_1.relative)(racine, f))
            .sort();
        expect(lecteurs).toEqual([
            'common/audit/champs-audites.ts',
            'common/audit/libelles-objets-audites.ts',
            'common/cloisonnement/modeles-cloisonnes.ts',
            'modules/ifrs/ifrs.service.ts',
        ]);
    });
});
//# sourceMappingURL=ifrs.service.spec.js.map