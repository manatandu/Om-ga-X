"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCollecteId: 'c4431', compteDeductibleId: 'c4452' };
function projeter(objet, select) {
    if (!select || objet == null)
        return objet;
    const rendu = {};
    for (const [cle, valeur] of Object.entries(select)) {
        if (valeur === true)
            rendu[cle] = objet[cle];
        else if (valeur && typeof valeur === 'object') {
            const brut = objet[cle];
            rendu[cle] = Array.isArray(brut)
                ? brut.filter((x) => ligneRetenue(x, valeur.where)).map((x) => projeter(x, valeur.select))
                : projeter(brut, valeur.select);
        }
    }
    return rendu;
}
function ligneRetenue(ligne, where) {
    if (!where?.OR)
        return true;
    return where.OR.some((o) => {
        if (o.compte?.classe && ligne.compte?.classe !== o.compte.classe)
            return false;
        if (o.lettrageId && o.lettrageId.not === null && ligne.lettrageId == null)
            return false;
        if (o.compte?.tiersCompte && o.compte.tiersCompte.isNot === null && ligne.compte?.tiersCompte == null)
            return false;
        return true;
    });
}
function retenue(ligne, where) {
    const e = where.ecriture ?? {};
    if (e.statut && ligne.ecriture.statut !== e.statut)
        return false;
    if (e.date?.lte && ligne.ecriture.date > e.date.lte)
        return false;
    if (e.date?.gte && ligne.ecriture.date < e.date.gte)
        return false;
    if (where.tauxTvaId?.in && !where.tauxTvaId.in.includes(ligne.tauxTvaId))
        return false;
    if (where.tauxTvaId && 'not' in where.tauxTvaId && where.tauxTvaId.not === null && ligne.tauxTvaId == null)
        return false;
    const c = where.compte;
    if (c?.OR)
        return c.OR.some((o) => ligne.compte.numero.startsWith(o.numero.startsWith));
    if (c?.numero?.startsWith)
        return ligne.compte.numero.startsWith(c.numero.startsWith);
    return true;
}
function monter(stock, referentiel = 'SYSCOHADA', bloc = false) {
    const appels = [];
    const findMany = jest.fn().mockImplementation((args) => {
        if (appels.length >= 200)
            throw new Error('pagination sans fin');
        let lignes = stock.filter((l) => retenue(l, args.where ?? {}));
        if (args.orderBy?.id === 'asc')
            lignes = [...lignes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        let tranche;
        if (bloc) {
            tranche = args.cursor ? [] : lignes;
        }
        else {
            let debut = 0;
            if (args.cursor) {
                const i = lignes.findIndex((l) => l.id === args.cursor.id);
                if (i < 0)
                    return Promise.resolve([]);
                debut = i;
            }
            debut += args.skip ?? 0;
            tranche = lignes.slice(debut, args.take === undefined ? lignes.length : debut + args.take);
        }
        appels.push({ requete: args, rendues: tranche.length, derniere: tranche[tranche.length - 1]?.id });
        return Promise.resolve(tranche.map((l) => projeter(l, args.select)));
    });
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel }) },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        ligneEcriture: {
            findMany,
            aggregate: jest.fn().mockImplementation((args) => {
                const ids = args.where?.ecritureId?.in;
                return Promise.resolve({ _sum: { credit: ids ? 1000 * ids.length : 0, debit: 0 } });
            }),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
    return { service: new taux_tva_service_1.TauxTvaService(prisma, {}), appels };
}
function exigerUnePaginationExacte(lecture, taille) {
    lecture.forEach((a, i) => {
        expect(a.requete.take).toBe(taille);
        expect(a.requete.orderBy).toEqual({ id: 'asc' });
        expect(a.rendues).toBeLessThanOrEqual(taille);
        if (i === 0) {
            expect(a.requete.cursor).toBeUndefined();
        }
        else {
            expect(a.requete.cursor).toEqual({ id: lecture[i - 1].derniere });
            expect(a.requete.skip).toBe(1);
        }
    });
}
const identifiant = (k) => `l${String((k * 7919) % 100003).padStart(6, '0')}`;
const jour = (iso) => new Date(`${iso}T00:00:00.000Z`);
function contrepartie(numero, classe, montant, sensDebit) {
    return {
        debit: sensDebit ? montant : 0,
        credit: sensDebit ? 0 : montant,
        lettrageId: null,
        compte: { numero, classe, tiersCompte: null },
        lettrage: null,
    };
}
function tiersLettre(numero, montant, sensDebit, dateFacture, dateReglement, tiers = null) {
    const facture = { debit: sensDebit ? montant : 0, credit: sensDebit ? 0 : montant, ecriture: { date: jour(dateFacture) } };
    const reglement = { debit: sensDebit ? 0 : montant, credit: sensDebit ? montant : 0, ecriture: { date: jour(dateReglement) } };
    return {
        ...facture,
        lettrageId: `lg-${numero}-${dateFacture}`,
        compte: { numero, classe: 'CLASSE_4', tiersCompte: tiers ? { tiers } : null },
        lettrage: { statut: 'SOLDE', solde: 0, soldeAt: null, lignes: [facture, reglement] },
    };
}
function dossier(familles) {
    const stock = [];
    let k = 1;
    for (const f of familles) {
        const collecte = f.compteTva.startsWith('443');
        for (let n = 0; n < f.nombre; n++, k++) {
            const auCredit = collecte !== !!f.avoir;
            stock.push({
                id: identifiant(k),
                tauxTvaId: TAUX.id,
                compteId: `c${f.compteTva.slice(0, 4)}`,
                debit: auCredit ? 0 : f.tva,
                credit: auCredit ? f.tva : 0,
                compte: { numero: f.compteTva },
                ecritureId: `e${k}`,
                tauxTva: { taux: TAUX.taux },
                ecriture: { date: jour(f.date), statut: 'VALIDEE', facture: null, lignes: f.lignes },
            });
        }
    }
    return stock;
}
const MARS = jour('2026-03-01');
const FIN_MARS = new Date('2026-03-31T23:59:59.999Z');
const FAMILLES = [
    { nombre: 710, compteTva: '44520000', date: '2023-05-10', tva: 1000, lignes: [contrepartie('60110000', 'CLASSE_6', 6250, true)] },
    { nombre: 300, compteTva: '44310000', date: '2026-03-15', tva: 160, lignes: [contrepartie('70110000', 'CLASSE_7', 1000, false)] },
    { nombre: 250, compteTva: '44520000', date: '2026-03-20', tva: 100, lignes: [contrepartie('60110000', 'CLASSE_6', 625, true)] },
    {
        nombre: 120,
        compteTva: '44540000',
        date: '2024-11-10',
        tva: 50,
        lignes: [contrepartie('63240000', 'CLASSE_6', 312.5, true), tiersLettre('40110000', 362.5, false, '2024-11-10', '2026-03-18')],
    },
    {
        nombre: 80,
        compteTva: '44320000',
        date: '2025-06-10',
        tva: 200,
        lignes: [contrepartie('70610000', 'CLASSE_7', 1250, false), tiersLettre('41110000', 1450, true, '2025-06-10', '2026-03-05')],
    },
    { nombre: 50, compteTva: '44310000', date: '2025-02-01', tva: 300, avoir: true, lignes: [] },
    {
        nombre: 40,
        compteTva: '44540000',
        date: '2026-03-12',
        tva: 25,
        lignes: [
            contrepartie('63240000', 'CLASSE_6', 156.25, true),
            tiersLettre('40110000', 181.25, false, '2026-03-12', '2026-04-05', {
                autoriseTvaDebits: true,
                referenceAutorisationDebits: 'DGI/2025/017',
            }),
        ],
    },
];
describe('Déclaration de TVA · la lecture par tranches (audit final F188)', () => {
    it('aucun appel ne rend plus d’une tranche, et chaque appel en demande une', async () => {
        const stock = dossier(FAMILLES);
        expect(stock.length).toBeGreaterThan(3 * lecture_par_lots_1.LOT_ECRITURES);
        const { service, appels } = monter(stock);
        await service.declaration('t1', MARS, FIN_MARS);
        const lecture = appels.filter((a) => a.requete.where?.compte?.OR);
        expect(lecture.length).toBe(Math.ceil(stock.length / lecture_par_lots_1.LOT_ECRITURES));
        exigerUnePaginationExacte(lecture, lecture_par_lots_1.LOT_ECRITURES);
        expect(lecture[0].requete.select.id).toBe(true);
    });
    it('rend l’objet ENTIER de la lecture d’un bloc · mêmes montants, mêmes mentions, même ordre des comptes', async () => {
        const stock = dossier(FAMILLES);
        const parTranches = await monter(stock).service.declaration('t1', MARS, FIN_MARS);
        const enUnBloc = await monter(stock, 'SYSCOHADA', true).service.declaration('t1', MARS, FIN_MARS);
        expect(parTranches).toEqual(enUnBloc);
    });
    it('rend le résultat de la lecture d’un bloc, au centime', async () => {
        const { service } = monter(dossier(FAMILLES));
        const d = await service.declaration('t1', MARS, FIN_MARS);
        expect(d.totalCollecte).toBe(64_000);
        expect(d.totalDeductible).toBe(32_000);
        expect(d.tvaDeductibleDechue).toBe(710_000);
        expect(d.avoirsCollecteNonImputes).toBe(15_000);
        expect(d.tvaEnAttenteEncaissement).toBe(0);
        expect(d.prorata.pourcentage).toBe(100);
        expect(d.net).toBe(32_000);
        const parCompte = Object.fromEntries(d.lignes[0].parCompte.map((p) => [p.compteId, p]));
        expect(parCompte.c4431.collecte).toBe(48_000);
        expect(parCompte.c4432.collecte).toBe(16_000);
        expect(parCompte.c4452.deductible).toBe(25_000);
        expect(parCompte.c4454.deductible).toBe(7_000);
    });
});
describe('Prorata de déduction · la TVA collectée de l’année lue par tranches (audit final F188)', () => {
    it('aucun appel ne rend plus d’une tranche, et le numérateur est celui de toute l’année', async () => {
        const annee = { debut: jour('2025-01-01'), fin: new Date('2025-12-31T23:59:59.999Z') };
        const stock = [];
        for (let k = 1; k <= 5200; k++) {
            stock.push({
                id: identifiant(k),
                tauxTvaId: TAUX.id,
                credit: 16,
                ecritureId: `e${k}`,
                compte: { numero: '44310000' },
                tauxTva: { taux: 16 },
                ecriture: { date: jour('2025-06-10'), statut: 'VALIDEE' },
            });
        }
        stock.push({
            id: identifiant(5201),
            tauxTvaId: TAUX.id,
            credit: 16_000,
            ecritureId: 'e-soi',
            compte: { numero: '44340000' },
            tauxTva: { taux: 16 },
            ecriture: { date: jour('2025-07-01'), statut: 'VALIDEE' },
        });
        stock.push({
            id: identifiant(5202),
            tauxTvaId: 'tx0',
            credit: 0,
            ecritureId: 'e-export',
            compte: { numero: '44310000' },
            tauxTva: { taux: 0 },
            ecriture: { date: jour('2025-08-01'), statut: 'VALIDEE' },
        });
        stock.push({
            id: identifiant(5203),
            tauxTvaId: TAUX.id,
            credit: 16_000,
            ecritureId: 'e-2024',
            compte: { numero: '44310000' },
            tauxTva: { taux: 16 },
            ecriture: { date: jour('2024-12-31'), statut: 'VALIDEE' },
        });
        const { service, appels } = monter(stock);
        const p = await service.calculerProrata('t1', annee.debut, annee.fin);
        const lecture = appels.filter((a) => a.requete.where?.compte?.numero?.startsWith === '443');
        expect(lecture.length).toBe(2);
        exigerUnePaginationExacte(lecture, lecture_par_lots_1.LOT_LECTURE);
        expect(lecture[0].requete.select.id).toBe(true);
        expect(p.numerateur).toBe(521_000);
        const enUnBloc = await monter(stock, 'SYSCOHADA', true).service.calculerProrata('t1', annee.debut, annee.fin);
        expect(p).toEqual(enUnBloc);
    });
});
//# sourceMappingURL=declaration-par-tranches.spec.js.map