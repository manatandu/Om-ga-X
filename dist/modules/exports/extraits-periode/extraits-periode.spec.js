"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const stream_1 = require("stream");
const ExcelJS = require("exceljs");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("../../comptabilite/ecriture.service");
const periode_extrait_1 = require("../../comptabilite/periode-extrait");
const export_service_1 = require("../export.service");
const export_fpm_service_1 = require("../export-fpm.service");
const extraits_periode_service_1 = require("./extraits-periode.service");
const EXERCICE = { id: 'ex', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') };
const TENANT = { id: 't1', nom: 'Association Essai', numeroImpot: 'A1', devise: null, referentiel: 'SYCEBNL' };
const PERIODE = (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-04-01', au: '2026-06-30' });
const compte = (id, numero, intitule, classe) => ({
    id,
    numero,
    intitule,
    classe,
    typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
});
const COMPTES = [
    compte('dotation', '10100000', 'Dotation', client_1.ClasseCompte.CLASSE_1),
    compte('banque', '52110000', 'Banque', client_1.ClasseCompte.CLASSE_5),
    compte('caisse', '57110000', 'Caisse', client_1.ClasseCompte.CLASSE_5),
    compte('achats', '60110000', 'Achats', client_1.ClasseCompte.CLASSE_6),
];
const COMPTE = new Map(COMPTES.map((c) => [c.id, c]));
const ecr = (date, numeroPiece, o = {}) => ({
    tenantId: 't1',
    exerciceId: 'ex',
    statut: 'VALIDEE',
    date: new Date(`${date}T00:00:00Z`),
    numeroPiece,
    libelle: `Pièce ${numeroPiece}`,
    journal: { code: 'OD' },
    estGenereeParCloture: false,
    estSoldeDesComptesDeGestion: false,
    ...o,
});
const AN = ecr('2026-01-01', 1, { estGenereeParCloture: true, libelle: 'À-nouveau', journal: { code: 'AN' } });
const JANVIER = ecr('2026-01-15', 2);
const MARS = ecr('2026-03-31', 3, { statut: 'BROUILLARD' });
const AVRIL = ecr('2026-04-01', 4);
const JUILLET = ecr('2026-07-01', 5);
const ligne = (id, compteId, debit, credit, ecriture) => ({
    id,
    compteId,
    debit,
    credit,
    lettre: null,
    libelle: null,
    ecriture,
});
const LIGNES = [
    ligne('an2', 'dotation', 0, 1000, AN),
    ligne('an1', 'banque', 1000, 0, AN),
    ligne('j2', 'banque', 0, 200, JANVIER),
    ligne('m2', 'banque', 0, 50, MARS),
    ligne('p2', 'banque', 0, 300, AVRIL),
    ligne('a2', 'banque', 0, 999, JUILLET),
    ligne('m1', 'caisse', 50, 0, MARS),
    ligne('j1', 'achats', 200, 0, JANVIER),
    ligne('p1', 'achats', 300, 0, AVRIL),
    ligne('a1', 'achats', 999, 0, JUILLET),
];
function valeurRepond(v, c) {
    if (c === null || typeof c !== 'object' || c instanceof Date) {
        return v instanceof Date && c instanceof Date ? v.getTime() === c.getTime() : v === c;
    }
    for (const [op, a] of Object.entries(c)) {
        if (op === 'not' ? valeurRepond(v, a) : false)
            return false;
        if (op === 'in' && !a.includes(v))
            return false;
        if (op === 'lt' && !(v.getTime() < a.getTime()))
            return false;
        if (op === 'lte' && !(v.getTime() <= a.getTime()))
            return false;
        if (op === 'gte' && !(v.getTime() >= a.getTime()))
            return false;
        if (!['not', 'in', 'lt', 'lte', 'gte'].includes(op))
            throw new Error(`Opérateur non lu · ${op}`);
    }
    return true;
}
function repond(e, where) {
    if (!where)
        return true;
    for (const [cle, c] of Object.entries(where)) {
        if (c === undefined)
            continue;
        if (cle === 'AND') {
            if (!(Array.isArray(c) ? c : [c]).every((x) => repond(e, x)))
                return false;
        }
        else if (cle === 'OR') {
            if (!c.some((x) => repond(e, x)))
                return false;
        }
        else if (!valeurRepond(e[cle], c))
            return false;
    }
    return true;
}
function prismaEssai() {
    const choisies = (where) => LIGNES.filter((x) => {
        const fc = where.compteId;
        if (typeof fc === 'string' && x.compteId !== fc)
            return false;
        if (fc && typeof fc === 'object' && !fc.in.includes(x.compteId))
            return false;
        return repond(x.ecriture, where.ecriture);
    });
    const enLigne = (x) => ({ ...x, compte: COMPTE.get(x.compteId), ecriture: x.ecriture });
    const extraits = [];
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(TENANT) },
        exercice: { findFirst: jest.fn(async ({ where }) => (where.id === 'ex' && where.tenantId === 't1' ? EXERCICE : null)) },
        ecriture: {
            count: jest.fn(async ({ where }) => new Set(LIGNES.filter((x) => repond(x.ecriture, where)).map((x) => x.ecriture)).size),
        },
        compte: {
            findMany: jest.fn(async ({ where }) => (where.numero ? [] : COMPTES)),
            findFirst: jest.fn(async ({ where }) => COMPTE.get(where.id) ?? null),
        },
        ligneEcriture: {
            count: jest.fn(async ({ where }) => choisies(where).length),
            findMany: jest.fn(async ({ where, take, cursor, skip }) => {
                const toutes = choisies(where).map(enLigne);
                const rang = cursor ? toutes.findIndex((x) => x.id === cursor.id) : -1;
                if (cursor && rang < 0)
                    return [];
                const depart = cursor ? rang + (skip ?? 0) : 0;
                return toutes.slice(depart, depart + (take ?? toutes.length));
            }),
            groupBy: jest.fn(async ({ where }) => {
                const sommes = new Map();
                for (const x of choisies(where)) {
                    const s = sommes.get(x.compteId) ?? { debit: 0, credit: 0 };
                    s.debit += x.debit;
                    s.credit += x.credit;
                    sommes.set(x.compteId, s);
                }
                return [...sommes].map(([compteId, s]) => ({ compteId, _sum: s }));
            }),
        },
        extraitPeriode: {
            aggregate: jest.fn(async () => ({ _max: { numero: extraits.length === 0 ? null : Math.max(...extraits.map((e) => e.numero)) } })),
            create: jest.fn(async ({ data }) => {
                const e = { id: `x${extraits.length + 1}`, etabliLe: new Date('2026-10-16T09:00:00Z'), ...data };
                extraits.push(e);
                return e;
            }),
            update: jest.fn(async ({ where, data }) => Object.assign(extraits.find((e) => e.id === where.id), data)),
        },
        $executeRaw: jest.fn().mockResolvedValue(0),
    };
    prisma.$transaction = jest.fn(async (fn) => fn(prisma));
    return { prisma, extraits };
}
function services() {
    const { prisma, extraits } = prismaEssai();
    const ecritures = new ecriture_service_1.EcritureService(prisma, {}, {}, {});
    const vide = {};
    const exports = new export_service_1.ExportService(prisma, ecritures, vide, vide, vide, vide, vide, vide, vide, vide);
    return {
        prisma,
        extraits,
        fpm: new export_fpm_service_1.ExportFpmService(prisma, ecritures, exports),
        registre: new extraits_periode_service_1.ExtraitsPeriodeService(prisma),
    };
}
async function lire(ecrire) {
    const morceaux = [];
    let nom = '';
    const sortie = new stream_1.Writable({
        write(m, _e, cb) {
            morceaux.push(Buffer.from(m));
            cb();
        },
    });
    await ecrire((n) => {
        nom = n;
        return sortie;
    });
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(Buffer.concat(morceaux));
    return { classeur, nom };
}
const valeurs = (f) => {
    const lignes = [];
    for (let i = 1; i <= f.rowCount; i++) {
        const r = f.getRow(i);
        lignes.push(Array.from({ length: 8 }, (_, k) => r.getCell(k + 1).value ?? null));
    }
    return lignes;
};
function demande(registre, nature) {
    let numeroter = async () => {
        throw new Error('produire non appelé');
    };
    const executer = (travail) => registre.produire({ tenantId: 't1', nature, libelle: 'Balance des comptes', periode: PERIODE, etabliPar: 'u1' }, (n) => {
        numeroter = n;
        return travail({ periode: PERIODE, numeroter });
    });
    return executer;
}
describe('la balance d’une période · le report à la veille, l’extrait numéroté et daté', () => {
    it('se titre extrait, garde « Mouvements au » la veille, numéro et date en ligne 7 et au pied', async () => {
        const s = services();
        const { classeur, nom } = await lire((ouvrir) => demande(s.registre, client_1.NatureExtraitPeriode.BALANCE)((d) => s.fpm.balanceGeneraleEnFlux('t1', 'ex', false, ouvrir, d)));
        const f = classeur.getWorksheet('Balance');
        expect(nom).toBe('balance-2026-du-2026-04-01-au-2026-06-30.xlsx');
        expect(f.getCell('D4').value).toBe('Extrait du 01/04/2026 au 30/06/2026');
        expect(f.getCell('H2').value).toEqual(PERIODE.du);
        expect(f.getCell('H3').value).toEqual(PERIODE.au);
        expect(f.getCell('C8').value).toBe('Mouvements au 31/03/26');
        expect(String(f.getCell('A7').value)).toMatch(/^Extrait n° 1 établi le 16\/10\/2026 · Brouillard compris · 1 écriture non validée$/);
        expect(f.headerFooter.oddFooter).toContain('Extrait n° 1 · du 01/04/2026 au 30/06/2026');
        const banque = valeurs(f).find((r) => r[0] === '52110000');
        expect(banque.slice(2, 8)).toEqual([1000, 250, null, 300, 450, null]);
        const caisse = valeurs(f).find((r) => r[0] === '57110000');
        expect(caisse.slice(2, 8)).toEqual([50, null, null, null, 50, null]);
        expect(s.extraits).toEqual([expect.objectContaining({ numero: 1, nature: 'BALANCE', termineLe: expect.any(Date) })]);
    });
    it('LE NUMÉRO NE SE PREND QU’APRÈS LES REFUS · un export refusé par son volume ne laisse aucun trou', async () => {
        const s = services();
        s.prisma.ligneEcriture.count.mockResolvedValue(10_000_000);
        await expect(lire((ouvrir) => demande(s.registre, client_1.NatureExtraitPeriode.BALANCE)((d) => s.fpm.balanceGeneraleEnFlux('t1', 'ex', true, ouvrir, d)))).rejects.toBeInstanceOf(common_1.PayloadTooLargeException);
        expect(s.extraits).toEqual([]);
    });
});
describe('le grand livre d’une période · chaque compte ouvre sur son report', () => {
    it('le report est la première ligne de chaque compte, le compte à report seul garde son bloc, et le livre rend la balance', async () => {
        const s = services();
        const { classeur } = await lire((ouvrir) => demande(s.registre, client_1.NatureExtraitPeriode.GRAND_LIVRE)((d) => s.fpm.grandLivreEnFlux('t1', 'ex', ouvrir, { extrait: d })));
        const f = classeur.getWorksheet('Grand-livre des comptes');
        const lignes = valeurs(f).slice(8);
        const textes = lignes.map((r) => [r[0] instanceof Date ? r[0].toISOString().slice(0, 10) : r[0], r[3], r[5], r[6], r[7]]);
        expect(textes).toEqual([
            ['10100000', 'Dotation', null, null, null],
            ['2026-03-31', 'Report au 31/03/2026', null, 1000, -1000],
            [null, 'Total du compte', null, 1000, -1000],
            ['52110000', 'Banque', null, null, null],
            ['2026-03-31', 'Report au 31/03/2026', 1000, 250, 750],
            ['2026-04-01', 'Pièce 4', null, 300, 450],
            [null, 'Total du compte', 1000, 550, 450],
            ['57110000', 'Caisse', null, null, null],
            ['2026-03-31', 'Report au 31/03/2026', 50, null, 50],
            [null, 'Total du compte', 50, null, 50],
            ['60110000', 'Achats', null, null, null],
            ['2026-03-31', 'Report au 31/03/2026', 200, null, 200],
            ['2026-04-01', 'Pièce 4', 300, null, 500],
            [null, 'Total du compte', 500, null, 500],
            [null, 'Totaux', 1550, 1550, null],
            [null, 'Solde à la balance générale', 1550, 1550, null],
            [null, 'Écart : aucun', null, null, null],
        ]);
        expect(String(f.getCell('A7').value)).toContain("le grand livre de l'exercice est celui du 01/01/2026 au 31/12/2026");
        expect(f.getCell('D4').value).toBe('Extrait du 01/04/2026 au 30/06/2026');
    });
    it('le grand livre d’un seul compte · son report, sa période, et le numéro du compte dans le titre', async () => {
        const s = services();
        const { classeur, nom } = await lire((ouvrir) => demande(s.registre, client_1.NatureExtraitPeriode.GRAND_LIVRE)((d) => s.fpm.grandLivreEnFlux('t1', 'ex', ouvrir, { extrait: d, compteId: 'caisse' })));
        expect(nom).toBe('grand-livre-57110000-2026-du-2026-04-01-au-2026-06-30.xlsx');
        const f = classeur.getWorksheet('Grand-livre des comptes');
        expect(f.getCell('D4').value).toBe('Extrait du 01/04/2026 au 30/06/2026 · compte 57110000');
        expect(valeurs(f).slice(8).map((r) => r[3])).toEqual(['Caisse', 'Report au 31/03/2026', 'Total du compte', 'Totaux', 'Solde à la balance générale', 'Écart : aucun']);
    });
    it('la balance avec les grands livres · la feuille d’un compte à report seul existe, son lien ne mène pas nulle part', async () => {
        const s = services();
        const { classeur } = await lire((ouvrir) => demande(s.registre, client_1.NatureExtraitPeriode.BALANCE)((d) => s.fpm.balanceGeneraleEnFlux('t1', 'ex', true, ouvrir, d)));
        expect(classeur.worksheets.map((f) => f.name)).toEqual(['Balance', '10100000', '52110000', '57110000', '60110000']);
        const caisse = classeur.getWorksheet('57110000');
        expect(valeurs(caisse).slice(8).map((r) => r[3])).toEqual(['Caisse', 'Report au 31/03/2026', 'Total du compte', 'Solde à la balance générale', 'Écart : aucun']);
    });
});
describe('le registre des extraits · le numéro reste, l’échec se dit', () => {
    it('un fichier interrompu après son numéro le garde, l’échec écrit, et l’erreur d’origine remonte', async () => {
        const s = services();
        await expect(s.registre.produire({ tenantId: 't1', nature: client_1.NatureExtraitPeriode.BALANCE, libelle: 'Balance des comptes', periode: PERIODE, etabliPar: 'u1' }, async (n) => {
            await n();
            throw new Error('connexion perdue');
        })).rejects.toThrow('connexion perdue');
        expect(s.extraits).toEqual([expect.objectContaining({ numero: 1, motifEchec: 'Production interrompue · connexion perdue', termineLe: null })]);
        await s.registre.produire({ tenantId: 't1', nature: client_1.NatureExtraitPeriode.BALANCE, libelle: 'Balance des comptes', periode: PERIODE, etabliPar: 'u1' }, async (n) => n());
        expect(s.extraits.map((e) => e.numero)).toEqual([1, 2]);
    });
    it('un travail qui ne numérote pas ne prend aucun numéro', async () => {
        const s = services();
        await s.registre.produire({ tenantId: 't1', nature: client_1.NatureExtraitPeriode.BALANCE, libelle: 'x', periode: PERIODE, etabliPar: 'u1' }, async () => 'rien');
        expect(s.extraits).toEqual([]);
    });
    it('une marque de fin manquée est consignée, jamais substituée au fichier remis', async () => {
        const s = services();
        s.prisma.extraitPeriode.update.mockRejectedValueOnce(new Error('base indisponible'));
        const consigne = jest.spyOn(s.registre.logger, 'error').mockImplementation(() => undefined);
        await expect(s.registre.produire({ tenantId: 't1', nature: client_1.NatureExtraitPeriode.BALANCE, libelle: 'x', periode: PERIODE, etabliPar: 'u1' }, async (n) => {
            await n();
            return 'remis';
        })).resolves.toBe('remis');
        expect(consigne).toHaveBeenCalledWith(expect.stringContaining('fichier remis, fin non écrite (base indisponible)'));
    });
    it('le libellé relit le compte dans le dossier, et la création entre ENTIÈRE au journal d’audit', async () => {
        const s = services();
        await expect(s.registre.libelleDe('t1', client_1.NatureExtraitPeriode.GRAND_LIVRE, { compteId: 'banque' })).resolves.toBe('Grand livre du compte 52110000 · Banque');
        await expect(s.registre.libelleDe('t1', client_1.NatureExtraitPeriode.BALANCE, { avecGrandsLivres: true })).resolves.toBe('Balance des comptes, avec le grand livre de chaque compte');
        await expect(s.registre.libelleDe('t1', client_1.NatureExtraitPeriode.GRAND_LIVRE, { compteId: 'inconnu' })).rejects.toThrow(/Compte introuvable/);
        await s.registre.produire({ tenantId: 't1', nature: client_1.NatureExtraitPeriode.BALANCE, libelle: 'x', periode: PERIODE, etabliPar: 'u1' }, async (n) => {
            await n();
            return 'remis';
        });
        expect(s.prisma.extraitPeriode.create.mock.calls[0][0]).not.toHaveProperty('select');
    });
    it('UN EXTRAIT VIDE NE PREND PAS DE NUMÉRO · ni report ni mouvement jusqu’au dernier jour, refus nommé', async () => {
        const s = services();
        const janvier = (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-01-02', au: '2026-01-10' });
        await expect(s.registre.refuserSiVide('t1', 'ex', janvier, 'caisse')).rejects.toThrow(/Aucune écriture jusqu'au 10\/01\/2026 sur ce compte/);
        expect(s.extraits).toEqual([]);
        await expect(s.registre.refuserSiVide('t1', 'ex', janvier)).resolves.toBeUndefined();
    });
    it('établi le jour de Kinshasa · à 23 h 30 en temps universel, c’est déjà le lendemain', async () => {
        const s = services();
        s.prisma.extraitPeriode.create.mockImplementationOnce(async ({ data }) => {
            const e = { id: 'x1', etabliLe: new Date('2026-10-15T23:30:00Z'), ...data };
            s.extraits.push(e);
            return e;
        });
        const { classeur } = await lire((ouvrir) => demande(s.registre, client_1.NatureExtraitPeriode.BALANCE)((d) => s.fpm.balanceGeneraleEnFlux('t1', 'ex', false, ouvrir, d)));
        expect(String(classeur.getWorksheet('Balance').getCell('A7').value)).toMatch(/^Extrait n° 1 établi le 16\/10\/2026 /);
    });
});
//# sourceMappingURL=extraits-periode.spec.js.map