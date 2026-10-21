"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const extension_cloisonnement_1 = require("../../common/cloisonnement/extension-cloisonnement");
const contexte_cloisonnement_1 = require("../../common/cloisonnement/contexte-cloisonnement");
const contexte_audit_1 = require("../../common/audit/contexte-audit");
const lecture_des_dossiers_1 = require("./lecture-des-dossiers");
const groupe_service_1 = require("./groupe.service");
function correspond(objet, filtre) {
    return Object.entries(filtre).every(([cle, attendu]) => {
        if (attendu === undefined)
            return true;
        if (cle === 'OR')
            return attendu.some((branche) => correspond(objet, branche));
        if (cle === 'AND')
            return [].concat(attendu).every((branche) => correspond(objet, branche));
        const valeur = objet[cle];
        if (attendu !== null && typeof attendu === 'object' && !(attendu instanceof Date)) {
            return Object.entries(attendu).every(([operateur, x]) => {
                if (operateur === 'in')
                    return x.includes(valeur);
                if (operateur === 'equals')
                    return valeur === x;
                if (operateur === 'not' && (x === null || typeof x !== 'object'))
                    return valeur !== x;
                throw new Error(`doublure · opérateur non simulé « ${operateur} » sur ${cle}`);
            });
        }
        return valeur === attendu;
    });
}
const parNumero = (a, b) => (a.numero < b.numero ? -1 : a.numero > b.numero ? 1 : 0);
function doublure(base, extra = {}) {
    const appels = [];
    const suivi = { enVol: 0, maxEnVol: 0 };
    const ecritureDe = new Map(base.ecritures.map((e) => [e.id, e]));
    const requete = (modele, operation, executer) => async (args) => {
        appels.push({ nom: `${modele}.${operation}`, args });
        suivi.enVol++;
        suivi.maxEnVol = Math.max(suivi.maxEnVol, suivi.enVol);
        try {
            await new Promise((r) => setImmediate(r));
            return await (0, extension_cloisonnement_1.garderCloisonnement)({}, {
                model: modele,
                operation,
                args,
                query: async (a) => executer(a),
            });
        }
        finally {
            suivi.enVol--;
        }
    };
    const prisma = {
        compte: {
            findMany: requete('Compte', 'findMany', (({ where, orderBy, select }) => {
                if (orderBy !== undefined && JSON.stringify(orderBy) !== JSON.stringify({ numero: 'asc' })) {
                    throw new Error('doublure · ordre non simulé');
                }
                return base.comptes
                    .filter((c) => correspond(c, where))
                    .sort(parNumero)
                    .map((c) => (select ? Object.fromEntries(Object.entries(c).filter(([k]) => select[k])) : { ...c }));
            })),
        },
        ligneEcriture: {
            groupBy: requete('LigneEcriture', 'groupBy', (({ by, where }) => {
                const { ecriture, ...reste } = where;
                if (JSON.stringify(by) !== JSON.stringify(['compteId']) || Object.keys(reste).length > 0) {
                    throw new Error('doublure · regroupement non simulé');
                }
                const sommes = new Map();
                for (const l of base.lignes) {
                    if (!correspond(ecritureDe.get(l.ecritureId), ecriture))
                        continue;
                    const s = sommes.get(l.compteId) ?? { debit: new client_1.Prisma.Decimal(0), credit: new client_1.Prisma.Decimal(0) };
                    sommes.set(l.compteId, { debit: s.debit.add(l.debit), credit: s.credit.add(l.credit) });
                }
                return [...sommes].map(([compteId, _sum]) => ({ compteId, _sum }));
            })),
        },
        ecriture: {
            groupBy: requete('Ecriture', 'groupBy', (({ by, where }) => {
                const groupes = new Map();
                for (const e of base.ecritures) {
                    if (!correspond(e, where))
                        continue;
                    const cle = by.map((k) => String(e[k])).join('|');
                    const g = groupes.get(cle) ?? {
                        ...Object.fromEntries(by.map((k) => [k, e[k]])),
                        _count: { _all: 0 },
                        _max: { date: null },
                    };
                    g._count._all++;
                    if (!g._max.date || e.date.getTime() > g._max.date.getTime())
                        g._max.date = e.date;
                    groupes.set(cle, g);
                }
                return [...groupes.values()];
            })),
            count: requete('Ecriture', 'count', (({ where }) => base.ecritures.filter((e) => correspond(e, where)).length)),
        },
    };
    for (const [modele, operations] of Object.entries(extra)) {
        const nomModele = modele.charAt(0).toUpperCase() + modele.slice(1);
        prisma[modele] = {
            ...(prisma[modele] ?? {}),
            ...Object.fromEntries(Object.entries(operations).map(([op, f]) => [op, requete(nomModele, op, f)])),
        };
    }
    return { prisma, appels, suivi };
}
const SIEGE = 'siege';
const commeLeSiege = (perimetre, suite) => (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'siege@eglise.cd', tenantId: SIEGE }, () => (0, contexte_cloisonnement_1.perimetreDeGroupe)([SIEGE, ...perimetre], suite));
const compte = (tenantId, numero, typeCompte = 'DETAIL') => ({
    id: `${tenantId}:${numero}`,
    tenantId,
    numero,
    intitule: `Compte ${numero}`,
    classe: `CLASSE_${numero[0]}`,
    typeCompte,
});
const ecriture = (id, tenantId, exerciceId, colonne, date, statut = 'VALIDEE', estANouveauProvisoire = false) => ({
    id,
    tenantId,
    exerciceId,
    statut,
    date: new Date(date),
    estGenereeParCloture: colonne !== 'mouvement',
    estSoldeDesComptesDeGestion: colonne === 'cloture',
    estANouveauProvisoire,
});
const ligne = (ecritureId, tenantId, numero, debit, credit) => ({
    ecritureId,
    compteId: `${tenantId}:${numero}`,
    debit,
    credit,
});
const BASE = {
    comptes: [
        ...['10110000', '13100000', '41110000', '47100000', '52110000', '58100000', '60100000', '70100000'].map((n) => compte('d-a', n)),
        compte('d-a', '52', 'TOTAL'),
        ...['52110000', '57100000', '65800000'].map((n) => compte('d-b', n)),
        ...['52110000', '70100000'].map((n) => compte('d-c', n)),
        compte('d-x', '52110000'),
    ],
    ecritures: [
        ecriture('a-an', 'd-a', 'a-26', 'report', '2026-01-01'),
        ecriture('a-mv1', 'd-a', 'a-26', 'mouvement', '2026-02-03'),
        ecriture('a-mv2', 'd-a', 'a-26', 'mouvement', '2026-05-05', 'BROUILLARD'),
        ecriture('a-mv3', 'd-a', 'a-26', 'mouvement', '2026-06-06'),
        ecriture('a-nul', 'd-a', 'a-26', 'mouvement', '2026-07-07'),
        ecriture('a-tot', 'd-a', 'a-26', 'mouvement', '2026-08-08'),
        ecriture('a-clo', 'd-a', 'a-26', 'cloture', '2026-12-31'),
        ecriture('a-sit', 'd-a', 'a-26', 'mouvement', '2026-09-30', 'SITUATION'),
        ecriture('a-ancien', 'd-a', 'a-25', 'mouvement', '2025-04-04'),
        ecriture('b-mv', 'd-b', 'b-26', 'mouvement', '2026-03-03'),
        ecriture('b-mv2', 'd-b', 'b-26', 'mouvement', '2026-09-09', 'BROUILLARD'),
        ecriture('c-mv', 'd-c', 'c-25', 'mouvement', '2025-10-10'),
        ecriture('c-mv26', 'd-c', 'c-26', 'mouvement', '2026-10-10'),
        ecriture('x-mv', 'd-x', 'x-26', 'mouvement', '2026-01-15'),
    ],
    lignes: [
        ligne('a-an', 'd-a', '52110000', 1000.1, 0),
        ligne('a-an', 'd-a', '10110000', 0, 1000.1),
        ligne('a-mv1', 'd-a', '60100000', 0.2, 0),
        ligne('a-mv1', 'd-a', '52110000', 0, 0.2),
        ligne('a-mv2', 'd-a', '41110000', 333.33, 0),
        ligne('a-mv2', 'd-a', '70100000', 0, 333.33),
        ligne('a-mv3', 'd-a', '52110000', 333.33, 0),
        ligne('a-mv3', 'd-a', '41110000', 0, 333.33),
        ligne('a-nul', 'd-a', '47100000', 0, 0),
        ligne('a-tot', 'd-a', '52', 5, 0),
        ligne('a-tot', 'd-a', '70100000', 0, 5),
        ligne('a-clo', 'd-a', '70100000', 338.33, 0),
        ligne('a-sit', 'd-a', '52110000', 777, 0),
        ligne('a-sit', 'd-a', '70100000', 0, 777),
        ligne('a-clo', 'd-a', '60100000', 0, 0.2),
        ligne('a-clo', 'd-a', '13100000', 0, 338.13),
        ligne('a-ancien', 'd-a', '52110000', 777, 0),
        ligne('a-ancien', 'd-a', '70100000', 0, 777),
        ligne('b-mv', 'd-b', '57100000', 50.05, 0),
        ligne('b-mv', 'd-b', '52110000', 0, 50.05),
        ligne('b-mv2', 'd-b', '65800000', 12.5, 0),
        ligne('b-mv2', 'd-b', '57100000', 0, 12.5),
        ligne('c-mv', 'd-c', '52110000', 10, 0),
        ligne('c-mv', 'd-c', '70100000', 0, 10),
        ligne('c-mv26', 'd-c', '52110000', 99, 0),
        ligne('c-mv26', 'd-c', '70100000', 0, 99),
        ligne('x-mv', 'd-x', '52110000', 42, 0),
    ],
};
const COUPLES = [
    { tenantId: 'd-a', exerciceId: 'a-26' },
    { tenantId: 'd-b', exerciceId: 'b-26' },
    { tenantId: 'd-c', exerciceId: 'c-25' },
];
const LUS = COUPLES.map((c) => c.tenantId);
describe('F190 · la balance lue par tranches est celle du service des écritures', () => {
    it('dossier par dossier, au bit près, dans le même ordre', async () => {
        const { prisma } = doublure(BASE);
        const ecritures = new ecriture_service_1.EcritureService(prisma, {}, {}, {});
        await commeLeSiege(LUS, async () => {
            const balances = await (0, lecture_des_dossiers_1.balancesDesDossiers)(prisma, COUPLES);
            expect([...balances.keys()].sort()).toEqual(['d-a', 'd-b', 'd-c']);
            for (const { tenantId, exerciceId } of COUPLES) {
                const attendue = await ecritures.balance(tenantId, exerciceId);
                const lue = balances.get(tenantId);
                expect(lue).toEqual(attendue);
                expect([lue.totaux.debit, lue.totaux.credit]).toEqual([attendue.totaux.debit, attendue.totaux.credit]);
                lue.lignes.forEach((l, i) => expect(l.totalDebit).toBe(attendue.lignes[i].totalDebit));
            }
        });
    });
    it('le jeu d’essai porte bien ce qu’une balance écarte · sinon l’équivalence ne prouverait rien', async () => {
        const { prisma } = doublure(BASE);
        await commeLeSiege(LUS, async () => {
            const a = (await (0, lecture_des_dossiers_1.balancesDesDossiers)(prisma, COUPLES)).get('d-a');
            const numeros = a.lignes.map((l) => l.numero);
            expect(numeros).toEqual(['10110000', '13100000', '41110000', '52110000', '60100000', '70100000']);
            expect(a.lignes.find((l) => l.numero === '41110000')).toMatchObject({ totalDebit: 333.33, totalCredit: 333.33, solde: 0 });
            expect(a.lignes.find((l) => l.numero === '52110000')).toMatchObject({ reportDebit: 1000.1, mouvementDebit: 333.33, mouvementCredit: 0.2 });
            expect(a.lignes.find((l) => l.numero === '70100000')).toMatchObject({ clotureDebit: 338.33, mouvementCredit: 338.33 });
            expect(a.lignes.find((l) => l.numero === '52110000').totalDebit).toBe(1000.1 + 333.33);
            const c = (await (0, lecture_des_dossiers_1.balancesDesDossiers)(prisma, COUPLES)).get('d-c');
            expect(c.totaux).toEqual({ debit: 10, credit: 10 });
        });
    });
    it('un dossier sans mouvement rend une balance vide, jamais une absence', async () => {
        const { prisma } = doublure(BASE);
        await commeLeSiege(['d-x'], async () => {
            const balances = await (0, lecture_des_dossiers_1.balancesDesDossiers)(prisma, [{ tenantId: 'd-x', exerciceId: 'x-25' }]);
            expect(balances.get('d-x')).toEqual({ lignes: [], totaux: { debit: 0, credit: 0 } });
        });
    });
    it('un même dossier nommé pour deux exercices lève · ses comptes réuniraient les deux', async () => {
        const { prisma } = doublure(BASE);
        await expect((0, lecture_des_dossiers_1.balancesDesDossiers)(prisma, [
            { tenantId: 'd-a', exerciceId: 'a-26' },
            { tenantId: 'd-a', exerciceId: 'a-25' },
        ])).rejects.toThrow(/un seul exercice/);
        await expect((0, lecture_des_dossiers_1.comptagesDesDossiers)(prisma, [
            { tenantId: 'd-a', exerciceId: 'a-26' },
            { tenantId: 'd-a', exerciceId: 'a-25' },
        ])).rejects.toThrow(/un seul exercice/);
    });
});
describe('F190 · les comptages de la supervision et de la liasse', () => {
    const COMPTAGE = {
        comptes: [],
        lignes: [],
        ecritures: [
            ecriture('v', 'd-a', 'a-26', 'mouvement', '2026-03-01'),
            ecriture('b', 'd-a', 'a-26', 'mouvement', '2026-11-30', 'BROUILLARD'),
            ecriture('p', 'd-a', 'a-26', 'report', '2026-01-01', 'BROUILLARD', true),
            ecriture('s', 'd-a', 'a-26', 'mouvement', '2026-12-15', 'SITUATION'),
            ecriture('ancien', 'd-a', 'a-25', 'mouvement', '2025-12-31', 'BROUILLARD'),
            ecriture('w', 'd-b', 'b-26', 'mouvement', '2026-02-02'),
        ],
    };
    it('écritures, brouillard, à-nouveau provisoire et dernière date, par couple', async () => {
        const { prisma } = doublure(COMPTAGE);
        await commeLeSiege(['d-a', 'd-b', 'd-c'], async () => {
            const c = await (0, lecture_des_dossiers_1.comptagesDesDossiers)(prisma, COUPLES);
            expect(c.get('d-a')).toEqual({
                nbEcritures: 3,
                nbBrouillard: 2,
                nbProvisoiresAuBrouillard: 1,
                derniereEcriture: new Date('2026-11-30'),
            });
            expect(c.get('d-b')).toEqual({ nbEcritures: 1, nbBrouillard: 0, nbProvisoiresAuBrouillard: 0, derniereEcriture: new Date('2026-02-02') });
            expect(c.get('d-c')).toEqual({ nbEcritures: 0, nbBrouillard: 0, nbProvisoiresAuBrouillard: 0, derniereEcriture: null });
        });
    });
});
const EX_SIEGE = { id: 'ex-siege', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const NOMBRE_CELLULES = 45;
const idCellule = (i) => `cel-${String(i).padStart(2, '0')}`;
const CELLULES = Array.from({ length: NOMBRE_CELLULES }, (_, i) => idCellule(i));
const exerciceDe = (t) => (t === SIEGE ? EX_SIEGE.id : `ex-${t}`);
function groupeFourni(particularites = {}) {
    const base = { comptes: [], ecritures: [], lignes: [] };
    for (const t of [SIEGE, ...CELLULES]) {
        base.comptes.push(compte(t, '52110000'), compte(t, '70100000'));
        base.ecritures.push(ecriture(`${t}-e`, t, exerciceDe(t), 'mouvement', '2026-06-30'));
        base.lignes.push(ligne(`${t}-e`, t, '52110000', 100, 0), ligne(`${t}-e`, t, '70100000', 0, 100));
        base.ecritures.push(ecriture(`${t}-ancien`, t, `ancien-${t}`, 'mouvement', '2025-06-30'));
        base.lignes.push(ligne(`${t}-ancien`, t, '52110000', 999, 0), ligne(`${t}-ancien`, t, '70100000', 0, 999));
    }
    if (particularites.brouillard) {
        const t = particularites.brouillard;
        base.ecritures.push(ecriture(`${t}-b`, t, exerciceDe(t), 'mouvement', '2026-09-15', 'BROUILLARD'));
        base.lignes.push(ligne(`${t}-b`, t, '52110000', 5, 0), ligne(`${t}-b`, t, '70100000', 0, 5));
    }
    if (particularites.provisoire) {
        const t = particularites.provisoire;
        base.ecritures.push(ecriture(`${t}-p`, t, exerciceDe(t), 'report', '2026-01-01', 'BROUILLARD', true));
        base.lignes.push(ligne(`${t}-p`, t, '52110000', 7, 0), ligne(`${t}-p`, t, '70100000', 0, 7));
    }
    return base;
}
function serviceDuGroupe(base) {
    const d = doublure(base, {
        tenant: {
            findUnique: (() => ({
                id: SIEGE,
                nom: 'Siège',
                referentiel: 'SYCEBNL',
                systemeComptableSyscohada: null,
                jeuEtatsFinanciersSycebnl: null,
                dossierCombinaisonId: 't-comb',
            })),
            findMany: (({ where }) => where.dossierMereId === SIEGE
                ? CELLULES.map((t) => ({
                    id: t,
                    nom: `Cellule ${t}`,
                    jeuEtatsFinanciersSycebnl: 'SYSTEME_MINIMAL_TRESORERIE',
                    exercices: [
                        { id: exerciceDe(t), dateDebut: EX_SIEGE.dateDebut, dateFin: EX_SIEGE.dateFin },
                        { id: `ancien-${t}`, dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') },
                    ],
                }))
                : []),
            update: (() => ({})),
        },
        exercice: {
            findFirst: (({ where }) => where.id === EX_SIEGE.id && where.tenantId === SIEGE ? EX_SIEGE : null),
        },
        tiersCompte: { findMany: (() => []) },
    });
    const s = new groupe_service_1.GroupeService(d.prisma, {}, {}, {
        liasseCompleteExcel: async () => {
            throw new Error('la liasse ne doit pas être produite sur un groupe qui a du brouillard');
        },
    });
    return { s, ...d };
}
const enSession = (suite) => (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'siege@eglise.cd', tenantId: SIEGE }, suite);
const tranches = Math.ceil((NOMBRE_CELLULES + 1) / lecture_des_dossiers_1.TRANCHE_DOSSIERS);
describe('F190 · un groupe fourni se lit en quelques requêtes, jamais une par cellule', () => {
    it('la balance agrégée · trois regroupements par tranche, sous la garde, pas plus de quatre en vol', async () => {
        const { s, appels, suivi } = serviceDuGroupe(groupeFourni());
        const a = await enSession(() => s.balanceAgregee(SIEGE, EX_SIEGE.id));
        expect(a.totaux).toEqual({ debit: 100 * (NOMBRE_CELLULES + 1), credit: 100 * (NOMBRE_CELLULES + 1) });
        expect(a.dossiers).toHaveLength(NOMBRE_CELLULES + 1);
        expect(a.controles.tousEquilibres).toBe(true);
        const regroupements = appels.filter((x) => x.nom === 'LigneEcriture.groupBy');
        expect(regroupements).toHaveLength(3 * tranches);
        expect(appels.filter((x) => x.nom === 'Compte.findMany')).toHaveLength(tranches);
        const couples = regroupements.flatMap((x) => x.args.where.ecriture.OR);
        const tailles = regroupements.map((x) => x.args.where.ecriture.OR.length);
        for (const taille of tailles)
            expect(taille).toBeLessThanOrEqual(lecture_des_dossiers_1.TRANCHE_DOSSIERS);
        expect(Math.max(...tailles)).toBeLessThan(NOMBRE_CELLULES + 1);
        expect(couples).toHaveLength(3 * (NOMBRE_CELLULES + 1));
        expect(new Set(couples.map((c) => `${c.tenantId}|${c.exerciceId}`)).size).toBe(NOMBRE_CELLULES + 1);
        expect(suivi.maxEnVol).toBeLessThanOrEqual(4);
    });
    it('la supervision · aucune requête par cellule, et les voyants tirés des comptages', async () => {
        const { s, appels, suivi } = serviceDuGroupe(groupeFourni({ brouillard: idCellule(17) }));
        const sup = await enSession(() => s.supervision(SIEGE, EX_SIEGE.id));
        expect(sup.cellules).toHaveLength(NOMBRE_CELLULES);
        const brouillee = sup.cellules.find((c) => c.id === idCellule(17));
        expect(brouillee).toMatchObject({ nbEcritures: 2, nbBrouillard: 1, prete: false, derniereEcriture: new Date('2026-09-15') });
        const saine = sup.cellules.find((c) => c.id === idCellule(3));
        expect(saine).toMatchObject({ nbEcritures: 1, nbBrouillard: 0, prete: true, tresorerie: 100, equilibre: true });
        expect(saine.derniereEcriture).toEqual(new Date('2026-06-30'));
        expect(appels.some((x) => x.nom === 'Ecriture.count' || x.nom === 'Ecriture.findFirst')).toBe(false);
        expect(appels.filter((x) => x.nom === 'Ecriture.groupBy')).toHaveLength(Math.ceil(NOMBRE_CELLULES / lecture_des_dossiers_1.TRANCHE_DOSSIERS));
        expect(suivi.maxEnVol).toBeLessThanOrEqual(4);
        expect(appels.length).toBeLessThan(NOMBRE_CELLULES);
    });
    it('la liasse · le brouillard compté par tranche, et l’à-nouveau provisoire nommé', async () => {
        const { s, appels, suivi } = serviceDuGroupe(groupeFourni({ brouillard: idCellule(7), provisoire: idCellule(31) }));
        const refus = await enSession(() => s.liasseGroupe(SIEGE, EX_SIEGE.id, 'u-siege')).catch((e) => e.message);
        expect(refus).toContain(`Cellule ${idCellule(7)} (1 pièce(s))`);
        expect(refus).toContain(`Cellule ${idCellule(31)} (1 pièce(s), dont l'à-nouveau provisoire`);
        expect(appels.some((x) => x.nom === 'Ecriture.count')).toBe(false);
        expect(suivi.maxEnVol).toBeLessThanOrEqual(4);
    });
    it('un exercice étranger au siège reste refusé avant toute lecture des cellules', async () => {
        const { s, appels } = serviceDuGroupe(groupeFourni());
        await expect(enSession(() => s.balanceAgregee(SIEGE, 'ex-inconnu'))).rejects.toThrow(common_1.NotFoundException);
        expect(appels.some((x) => x.nom === 'LigneEcriture.groupBy')).toBe(false);
    });
});
describe('F190 · la supervision lit une cellule décalée sur son exercice recouvrant', () => {
    const EX_AVANT = { id: 'ex-dec-avant', dateDebut: new Date('2025-07-01'), dateFin: new Date('2026-06-30') };
    const EX_DECALE = { id: 'ex-dec', dateDebut: new Date('2026-07-01'), dateFin: new Date('2027-06-30') };
    const base = {
        comptes: ['cel-decalee', 'cel-vide'].flatMap((t) => [compte(t, '52110000'), compte(t, '70100000')]),
        ecritures: [
            ecriture('dec-e', 'cel-decalee', EX_DECALE.id, 'mouvement', '2026-08-01'),
            ecriture('dec-avant', 'cel-decalee', EX_AVANT.id, 'mouvement', '2026-03-01'),
        ],
        lignes: [
            ligne('dec-e', 'cel-decalee', '52110000', 60, 0),
            ligne('dec-e', 'cel-decalee', '70100000', 0, 60),
            ligne('dec-avant', 'cel-decalee', '52110000', 999, 0),
            ligne('dec-avant', 'cel-decalee', '70100000', 0, 999),
        ],
    };
    it('l’activité vient de l’exercice retenu, et une cellule sans exercice ne demande rien', async () => {
        const { prisma, appels } = doublure(base, {
            tenant: {
                findUnique: (() => ({ id: SIEGE, referentiel: 'SYCEBNL', dossierCombinaisonId: null })),
                findMany: (({ where }) => where.dossierMereId === SIEGE
                    ? [
                        { id: 'cel-decalee', nom: 'Cellule décalée', jeuEtatsFinanciersSycebnl: null, exercices: [EX_AVANT, EX_DECALE] },
                        { id: 'cel-vide', nom: 'Cellule vide', jeuEtatsFinanciersSycebnl: null, exercices: [] },
                    ]
                    : []),
            },
            exercice: {
                findFirst: (({ where }) => where.id === EX_SIEGE.id && where.tenantId === SIEGE ? EX_SIEGE : null),
            },
        });
        const s = new groupe_service_1.GroupeService(prisma, {}, {}, {});
        const sup = await enSession(() => s.supervision(SIEGE, EX_SIEGE.id));
        const decalee = sup.cellules.find((c) => c.id === 'cel-decalee');
        expect(decalee).toMatchObject({
            exerciceId: EX_DECALE.id,
            periodeDiscordante: { dateDebut: EX_DECALE.dateDebut, dateFin: EX_DECALE.dateFin },
            nbEcritures: 1,
            nbBrouillard: 0,
            tresorerie: 60,
            equilibre: true,
            prete: false,
            derniereEcriture: new Date('2026-08-01'),
        });
        expect(sup.cellules.find((c) => c.id === 'cel-vide')).toMatchObject({ exerciceId: null, nbEcritures: 0, prete: false });
        const lectures = appels.filter((x) => x.nom === 'LigneEcriture.groupBy' || x.nom === 'Ecriture.groupBy');
        expect(lectures.length).toBeGreaterThan(0);
        for (const x of lectures) {
            const filtre = (x.nom === 'Ecriture.groupBy' ? x.args.where : x.args.where.ecriture);
            expect(filtre.OR).toEqual([{ tenantId: 'cel-decalee', exerciceId: EX_DECALE.id }]);
        }
    });
});
describe('F190 · chaque requête est bornée par la VALEUR de ses dossiers', () => {
    it('passe la garde sous le périmètre du siège, et lève pour une cellule qui n’en est pas', async () => {
        const { prisma } = doublure(BASE);
        await expect(commeLeSiege(LUS, () => (0, lecture_des_dossiers_1.balancesDesDossiers)(prisma, COUPLES))).resolves.toBeDefined();
        await expect(commeLeSiege(LUS, () => (0, lecture_des_dossiers_1.comptagesDesDossiers)(prisma, COUPLES))).resolves.toBeDefined();
        await expect(commeLeSiege(['d-a', 'd-c'], () => (0, lecture_des_dossiers_1.balancesDesDossiers)(prisma, COUPLES))).rejects.toBeInstanceOf(contexte_cloisonnement_1.CloisonnementViole);
        await expect(commeLeSiege(['d-a', 'd-c'], () => (0, lecture_des_dossiers_1.comptagesDesDossiers)(prisma, COUPLES))).rejects.toBeInstanceOf(contexte_cloisonnement_1.CloisonnementViole);
    });
});
//# sourceMappingURL=lecture-groupe-f190.spec.js.map