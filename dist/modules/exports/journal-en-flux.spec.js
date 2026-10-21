"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const fs_1 = require("fs");
const path_1 = require("path");
const ExcelJS = require("exceljs");
const JSZip = require("jszip");
const export_service_1 = require("./export.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const classeur_en_flux_1 = require("./classeur-en-flux");
const journal_edition_1 = require("./journal-edition");
jest.setTimeout(30000);
const EXERCICE = { id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const TITRES_DU_BLOC = 5;
const DONNEES = 6;
const JOUR = 1;
const PIECE = 2;
const COMPTE = 3;
const TIERS = 4;
const LIBELLE = 5;
const DEBIT = 6;
const CREDIT = 7;
const ACHATS = { id: 'j-ach', code: 'ACH', intitule: 'Achats', type: 'ACHATS' };
const BANQUE = { id: 'j-bq', code: 'BQ', intitule: 'Banque', type: 'TRESORERIE' };
const ecriture = (i, journal = ACHATS) => ({
    id: `e-${String(i).padStart(6, '0')}`,
    journalId: journal.id,
    date: new Date('2026-03-01'),
    dateValeur: null,
    numeroPiece: i,
    reference: `FAC-${i}`,
    libelle: `Écriture ${i}`,
    statut: 'VALIDEE',
    motifCorrection: null,
    createdAt: new Date('2026-03-02'),
    createdBy: 'u-1',
    valideeAt: new Date('2026-03-03'),
    valideeBy: 'u-1',
    correction: null,
    corrigeEcriture: null,
    lignes: [
        { debit: 100, credit: 0, libelle: 'débit', compte: { id: 'c-60410000', numero: '60410000', tiersCompte: null } },
        {
            debit: 0,
            credit: 100,
            libelle: 'crédit',
            compte: { id: 'c-40110001', numero: '40110001', tiersCompte: { tiers: { code: 'F-KINPAP' } } },
        },
    ],
    get _count() {
        return { lignes: this.lignes.length };
    },
});
const comparable = (v) => (v instanceof Date ? v.getTime() : v);
function correspond(e, where) {
    if (!where)
        return true;
    return Object.entries(where).every(([cle, attendu]) => {
        if (cle === 'AND')
            return attendu.every((w) => correspond(e, w));
        if (cle === 'OR')
            return attendu.some((w) => correspond(e, w));
        if (!['date', 'numeroPiece', 'id', 'journalId'].includes(cle))
            return true;
        const v = e[cle];
        if (attendu === null)
            return v === null;
        if (attendu && typeof attendu === 'object' && !(attendu instanceof Date)) {
            const b = attendu;
            if (v === null)
                return false;
            return ((b.gt === undefined || comparable(v) > comparable(b.gt)) &&
                (b.gte === undefined || comparable(v) >= comparable(b.gte)) &&
                (b.lte === undefined || comparable(v) <= comparable(b.lte)));
        }
        return v !== null && comparable(v) === comparable(attendu);
    });
}
function service(depart, journaux = [ACHATS], collectifs = []) {
    const toutes = typeof depart === 'number' ? Array.from({ length: depart }, (_, i) => ecriture(i + 1)) : depart;
    const findMany = jest.fn(async ({ take, cursor, where }) => {
        if (cursor)
            throw new Error('Le journal exporté ne pagine plus par le curseur de Prisma (relecture M6).');
        const ordre = (a, b) => a.date.getTime() - b.date.getTime() || a.numeroPiece - b.numeroPiece || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        return toutes
            .filter((e) => correspond(e, where))
            .sort(ordre)
            .slice(0, take);
    });
    const parBloc = new Map();
    for (const e of toutes) {
        const cle = `${e.journalId}|${e.statut}`;
        const g = parBloc.get(cle) ?? { journalId: e.journalId, statut: e.statut, _count: { _all: 0 } };
        g._count._all++;
        parBloc.set(cle, g);
    }
    const prisma = {
        ligneEcriture: { count: jest.fn().mockResolvedValue(toutes.reduce((n, e) => n + e.lignes.length, 0)) },
        ecriture: {
            findMany,
            count: jest.fn().mockResolvedValue(toutes.length),
            groupBy: jest.fn().mockResolvedValue([...parBloc.values()]),
        },
        journal: {
            findMany: jest.fn(async ({ where }) => journaux.filter((j) => where.id.in.includes(j.id)).sort((a, b) => a.code.localeCompare(b.code))),
            findFirst: jest.fn(async ({ where }) => journaux.find((j) => j.id === where.id) ?? null),
        },
        user: { findMany: jest.fn().mockResolvedValue([{ id: 'u-1', email: 'comptable@vmg.cd' }]) },
        compte: {
            groupBy: jest.fn(async ({ where }) => where.tenantId === 't1' ? collectifs.map((collectifId) => ({ collectifId })) : []),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ nom: 'Dossier', numeroImpot: 'A1', devise: 'CDF' }) },
        exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE), findUnique: jest.fn().mockResolvedValue(EXERCICE) },
    };
    const svc = new export_service_1.ExportService(prisma, {}, {}, {}, {}, {}, {}, {}, {}, {});
    return { svc, findMany, toutes, prisma };
}
function tampon() {
    const morceaux = [];
    const sortie = new stream_1.Writable({
        write(m, _e, cb) {
            morceaux.push(Buffer.from(m));
            cb();
        },
    });
    return { sortie, octets: () => Buffer.concat(morceaux) };
}
async function exporter(depart, filtres = { exerciceId: 'ex' }, journaux = [ACHATS]) {
    const { svc, findMany } = service(depart, journaux);
    const { sortie, octets } = tampon();
    let nomFichier = '';
    await svc.journalExcelEnFlux('t1', filtres, (nom) => {
        nomFichier = nom;
        return sortie;
    });
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(octets());
    return {
        feuille: classeur.getWorksheet('Journal'),
        piste: classeur.getWorksheet('Piste de révision'),
        classeur,
        octets: octets(),
        nomFichier,
        findMany,
    };
}
function rangsDe(feuille, texte) {
    const rangs = [];
    feuille.eachRow((r, n) => {
        if (r.getCell(LIBELLE).value === texte)
            rangs.push(n);
    });
    return rangs;
}
describe('Journal exporté en flux', () => {
    it('N’EST PLUS AMPUTÉ au plafond de la fenêtre', async () => {
        expect(ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE).toBe(2000);
        const { feuille } = await exporter(2500);
        expect(feuille.rowCount).toBe(TITRES_DU_BLOC + 5000 + 3);
        expect(feuille.getRow(DONNEES + 5000).getCell(LIBELLE).value).toBe('Totaux du journal ACH');
        expect(feuille.getRow(DONNEES + 5002).getCell(LIBELLE).value).toBe('Totaux de la période');
    });
    it('les DEUX totaux sont le même · la formule et la valeur jointe', async () => {
        const { feuille } = await exporter(2500);
        const duJournal = feuille.getRow(DONNEES + 5000).getCell(DEBIT).value;
        expect(duJournal.formula).toBe(`SUM(F${DONNEES}:F${DONNEES + 4999})`);
        expect(duJournal.result).toBe(2500 * 100);
        const dePeriode = feuille.getRow(DONNEES + 5002).getCell(DEBIT).value;
        expect(dePeriode.formula).toBe(`F${DONNEES + 5000}`);
        expect(dePeriode.result).toBe(2500 * 100);
    });
    it('lit PAR LOTS · la mémoire ne dépend plus de la taille du dossier', async () => {
        const { findMany } = await exporter(2500);
        expect(findMany.mock.calls.length).toBeGreaterThan(1);
        for (const [args] of findMany.mock.calls) {
            expect(args.take).toBeLessThanOrEqual(500);
        }
    });
    it('la tranche suivante part des VALEURS de la dernière écriture rendue · ni doublon, ni saut', async () => {
        const { findMany } = await exporter(1200);
        let suites = 0;
        for (const [rang, [a]] of findMany.mock.calls.entries()) {
            const appel = a;
            if (!appel.where.AND)
                continue;
            suites++;
            const lotPrecedent = (await findMany.mock.results[rang - 1].value);
            const fin = lotPrecedent[lotPrecedent.length - 1];
            const branches = appel.where.AND[1].OR;
            expect(branches[branches.length - 1].AND).toEqual([{ date: fin.date }, { numeroPiece: fin.numeroPiece }, { id: { gt: fin.id } }]);
        }
        expect(suites).toBe(4);
    });
    it('une écriture retirée pendant l’export ne tronque pas le journal, et la piste qui ne la porte plus est refusée (relecture M6)', async () => {
        const { svc, findMany, toutes } = service(1200);
        const lire = findMany.getMockImplementation();
        findMany.mockImplementation(async (a) => {
            const rendues = await lire(a);
            if (rendues.length === 500 && findMany.mock.calls.length === 1)
                toutes.splice(toutes.indexOf(rendues[499]), 1);
            return rendues;
        });
        const { sortie } = tampon();
        await expect(svc.journalExcelEnFlux('t1', { exerciceId: 'ex' }, () => sortie)).rejects.toThrow(/La pièce n° 501 du 01\/03\/2026 au journal ACH n'est plus celle que la feuille Journal a lue/);
    });
    it('la DERNIÈRE pièce retirée entre les deux passages · la piste, courte d’une écriture, est refusée (relecture M6)', async () => {
        const { svc, findMany, toutes } = service(1200);
        const lire = findMany.getMockImplementation();
        findMany.mockImplementation(async (a) => {
            const rendues = await lire(a);
            if (findMany.mock.calls.length === 3)
                toutes.splice(toutes.findIndex((e) => e.id === 'e-001200'), 1);
            return rendues;
        });
        const { sortie } = tampon();
        await expect(svc.journalExcelEnFlux('t1', { exerciceId: 'ex' }, () => sortie)).rejects.toThrow(/Piste de révision du journal : 1\s199 lignes lues sur 1\s200 comptées au départ/);
    });
    it('une pièce dont la date AVANCE pendant l’export ne s’écrit qu’une fois, et le classeur qui la dirait à deux dates est refusé (M2, relecture M1)', async () => {
        const { svc, findMany, toutes } = service(1200);
        const lire = findMany.getMockImplementation();
        let deplacee;
        findMany.mockImplementation(async (a) => {
            const rendues = await lire(a);
            if (!deplacee && rendues.length > 0) {
                deplacee = rendues[0].id;
                toutes.find((e) => e.id === deplacee).date = new Date('2026-12-31');
            }
            return rendues;
        });
        const { sortie } = tampon();
        await expect(svc.journalExcelEnFlux('t1', { exerciceId: 'ex' }, () => sortie)).rejects.toThrow(/La pièce n° 2 du 01\/03\/2026 au journal ACH n'est plus celle que la feuille Journal a lue/);
    });
    it('une écriture VALIDÉE entre les deux passages · la piste la dirait validée, la feuille au brouillard · refusé (relecture M1)', async () => {
        const ecritures = [1, 2, 3].map((i) => ({ ...ecriture(i), statut: 'BROUILLARD', valideeAt: null, valideeBy: null }));
        const { svc, findMany, toutes } = service(ecritures);
        const lire = findMany.getMockImplementation();
        findMany.mockImplementation(async (a) => {
            const rendues = (await lire(a)).map((e) => ({ ...e }));
            if (findMany.mock.calls.length === 1) {
                for (const e of toutes)
                    Object.assign(e, { statut: 'VALIDEE', valideeAt: new Date('2026-03-31'), valideeBy: 'u-1' });
            }
            return rendues;
        });
        const { sortie } = tampon();
        await expect(svc.journalExcelEnFlux('t1', { exerciceId: 'ex' }, () => sortie)).rejects.toThrow(/La pièce n° 1 du 01\/03\/2026 au journal ACH n'est plus celle que la feuille Journal a lue/);
    });
    it('une écriture VALIDÉE entre le décompte et la lecture · le bloc titré « BROUILLARD » ne reçoit pas ses totaux (relecture M1)', async () => {
        const ecritures = [1, 2].map((i) => ({ ...ecriture(i), statut: 'BROUILLARD', valideeAt: null, valideeBy: null }));
        const { svc, findMany, toutes } = service(ecritures);
        const lire = findMany.getMockImplementation();
        findMany.mockImplementation(async (a) => {
            if (findMany.mock.calls.length === 1)
                toutes[0].statut = 'VALIDEE';
            return lire(a);
        });
        const { sortie } = tampon();
        await expect(svc.journalExcelEnFlux('t1', { exerciceId: 'ex' }, () => sortie)).rejects.toThrow(/Le journal ACH a changé pendant la production · 1 écritures validées et 1 hors livre-journal lues, contre 0 et 2 comptées au départ/);
    });
    it('une pièce dont la date RECULE pendant l’export n’est jamais relue · le livre est refusé avant ses totaux, jamais remis amputé (M2)', async () => {
        const { svc, findMany, toutes } = service(1200);
        const lire = findMany.getMockImplementation();
        let deplacee = false;
        findMany.mockImplementation(async (a) => {
            const rendues = await lire(a);
            if (!deplacee) {
                deplacee = true;
                toutes.find((e) => e.id === 'e-001200').date = new Date('2026-01-01');
            }
            return rendues;
        });
        const sortie = new stream_1.Writable({ write: (_m, _e, cb) => cb() });
        await expect(svc.journalExcelEnFlux('t1', { exerciceId: 'ex' }, () => sortie)).rejects.toThrow(/Le journal ACH a changé pendant la production · 1\s199 écritures validées et 0 hors livre-journal lues, contre 1\s200 et 0/);
    });
    it('l’en-tête du bloc dit le dossier, le journal, la période, l’unité et le tirage, puis les sept colonnes', async () => {
        const { feuille } = await exporter(3);
        expect(feuille.getRow(1).getCell(1).value).toBe('JOURNAL · Dossier');
        expect(String(feuille.getRow(1).getCell(7).value)).toContain('2026');
        expect(feuille.getRow(2).getCell(1).value).toBe('ACH · Achats');
        expect(feuille.getRow(2).getCell(7).value).toBe('Tenue de compte : CDF');
        expect(String(feuille.getRow(3).getCell(1).value)).toMatch(/^Tiré le \d{2}\/\d{2}\/\d{2} à \d{2}:\d{2}:\d{2}/);
        const titres = Array.from({ length: 7 }, (_v, i) => feuille.getRow(TITRES_DU_BLOC).getCell(i + 1).value);
        expect(titres).toEqual(['Jour', 'N° pièce', 'N° compte', 'N° tiers', 'Libellé', 'Débit', 'Crédit']);
        expect(titres).toEqual([...journal_edition_1.TITRES_COLONNES_JOURNAL]);
        expect(feuille.headerFooter.oddHeader).toContain('Page &P / &N');
    });
    it('les titres des colonnes s’écrivent une fois par bloc · ni en ligne 1, ni deux fois (relevé de Manasse du 2026-10-16)', async () => {
        const { feuille, piste } = await exporter(3);
        const lignesDeTitres = [];
        feuille.eachRow((r, n) => {
            if (r.getCell(JOUR).value === 'Jour')
                lignesDeTitres.push(n);
        });
        expect(lignesDeTitres).toEqual([TITRES_DU_BLOC]);
        const nb = piste.getRow(classeur_en_flux_1.LIGNE_ENTETE).cellCount;
        expect(nb).toBe(13);
        for (let c = 2; c <= nb; c++)
            expect(piste.getRow(1).getCell(c).value ?? null).toBeNull();
        const titres = Array.from({ length: nb }, (_v, i) => piste.getRow(classeur_en_flux_1.LIGNE_ENTETE).getCell(i + 1).value);
        expect(titres).toContain('Correction');
        expect(titres).toContain('Motif de la correction');
    });
    it('une ligne porte le jour, la pièce, le compte, le tiers du compte individuel et son libellé', async () => {
        const { feuille } = await exporter(1);
        const debit = feuille.getRow(DONNEES);
        const credit = feuille.getRow(DONNEES + 1);
        expect(debit.getCell(JOUR).value.toISOString().slice(0, 10)).toBe('2026-03-01');
        expect(debit.getCell(PIECE).value).toBe(1);
        expect(debit.getCell(COMPTE).value).toBe('60410000');
        expect(debit.getCell(TIERS).value ?? null).toBeNull();
        expect(debit.getCell(LIBELLE).value).toBe('débit');
        expect(debit.getCell(DEBIT).value).toBe(100);
        expect(debit.getCell(CREDIT).value ?? null).toBeNull();
        expect(credit.getCell(TIERS).value).toBe('F-KINPAP');
        expect(credit.getCell(CREDIT).value).toBe(100);
    });
    it('le collectif qui porte des comptes individuels ne désigne aucun tiers', async () => {
        const e = ecriture(1);
        e.lignes[1].compte = { id: 'c-40110000', numero: '40110000', tiersCompte: { tiers: { code: 'F-PREMIER' } } };
        const { feuille } = await exporter([e]);
        expect(feuille.getRow(DONNEES + 1).getCell(TIERS).value ?? null).toBeNull();
    });
    it('un collectif ouvert par le cabinet se reconnaît à ses individuels, lus une fois et bornés au dossier (relecture TypeScript, M1)', async () => {
        const e = ecriture(1);
        e.lignes[1].compte = { id: 'c-40120000', numero: '40120000', tiersCompte: { tiers: { code: 'F-PREMIER' } } };
        const { svc, prisma } = service([e], [ACHATS], ['c-40120000']);
        const { sortie, octets } = tampon();
        await svc.journalExcelEnFlux('t1', { exerciceId: 'ex' }, () => sortie);
        const classeur = new ExcelJS.Workbook();
        await classeur.xlsx.load(octets());
        expect(classeur.getWorksheet('Journal').getRow(DONNEES + 1).getCell(TIERS).value ?? null).toBeNull();
        expect(prisma.compte.groupBy).toHaveBeenCalledTimes(1);
        expect(prisma.compte.groupBy.mock.calls[0][0].where).toEqual({ tenantId: 't1', collectifId: { not: null } });
        for (const [a] of prisma.ecriture.findMany.mock.calls) {
            expect(JSON.stringify(a.include ?? {})).not.toContain('individuels');
        }
    });
    it('le collectif rattaché à un tiers sans aucun compte individuel ne désigne pas ce tiers (relecture M3)', async () => {
        const e = ecriture(1);
        e.lignes[1].compte = { id: 'c-40110000', numero: '40110000', tiersCompte: { tiers: { code: 'F-PREMIER' } } };
        const client = ecriture(2);
        client.lignes[1].compte = { id: 'c-41110000', numero: '41110000', tiersCompte: { tiers: { code: 'C-PREMIER' } } };
        const { feuille } = await exporter([e, client]);
        expect(feuille.getRow(DONNEES + 1).getCell(TIERS).value ?? null).toBeNull();
        expect(feuille.getRow(DONNEES + 3).getCell(TIERS).value ?? null).toBeNull();
    });
    it('la date de valeur reste mentionnée distinctement · dans le libellé de la ligne (AUDCIF art. 22, 4°)', async () => {
        const e = ecriture(1);
        e.dateValeur = new Date('2026-02-27');
        const sansLibelle = ecriture(2);
        sansLibelle.lignes[0].libelle = '';
        const { feuille, piste } = await exporter([e, sansLibelle]);
        expect(feuille.getRow(DONNEES).getCell(LIBELLE).value).toBe('débit · valeur au 27/02/2026');
        expect(feuille.getRow(DONNEES + 2).getCell(LIBELLE).value).toBe('Écriture 2');
        expect(piste.getRow(classeur_en_flux_1.PREMIERE_LIGNE_DONNEES).getCell(3).value.toISOString().slice(0, 10)).toBe('2026-02-27');
    });
    it('un journal par bloc, un saut de page entre eux, et les totaux de la période additionnent les journaux', async () => {
        const ecritures = [ecriture(1), ecriture(2), ecriture(3, BANQUE)];
        const { feuille, octets } = await exporter(ecritures, { exerciceId: 'ex' }, [ACHATS, BANQUE]);
        const totauxAch = rangsDe(feuille, 'Totaux du journal ACH');
        const totauxBq = rangsDe(feuille, 'Totaux du journal BQ');
        expect(totauxAch).toEqual([DONNEES + 4]);
        expect(totauxBq).toEqual([DONNEES + 4 + 5 + 2 + 1]);
        expect(feuille.getRow(DONNEES + 5).getCell(1).value).toBe('JOURNAL · Dossier');
        expect(feuille.getRow(DONNEES + 6).getCell(1).value).toBe('BQ · Banque');
        const periode = rangsDe(feuille, 'Totaux de la période')[0];
        const debit = feuille.getRow(periode).getCell(DEBIT).value;
        expect(debit.formula).toBe(`F${totauxAch[0]}+F${totauxBq[0]}`);
        expect(debit.result).toBe(300);
        const xml = await (await JSZip.loadAsync(octets)).file('xl/worksheets/sheet1.xml').async('string');
        expect(xml).toMatch(new RegExp(`<rowBreaks[^>]*>\\s*<brk id="${totauxAch[0]}"`));
    });
    it('le brouillard se dit au titre du bloc et s’imprime en italique · hors du livre-journal (AUDCIF art. 22, 2°)', async () => {
        const validee = ecriture(1);
        const brouillard = { ...ecriture(2), statut: 'BROUILLARD', valideeAt: null, valideeBy: null };
        const { feuille } = await exporter([validee, brouillard]);
        expect(feuille.getRow(1).getCell(1).value).toBe('JOURNAL ET BROUILLARD · Dossier');
        expect(feuille.getRow(4).getCell(1).value).toBe('Lignes en italique · hors du livre-journal, non validées.');
        expect(feuille.getRow(DONNEES).font?.italic ?? false).toBe(false);
        expect(feuille.getRow(DONNEES + 2).getCell(LIBELLE).font?.italic).toBe(true);
    });
    it('la piste de révision porte une ligne par écriture · statut, saisie, validation, corrections', async () => {
        const erronee = { ...ecriture(1), correction: { numeroPiece: 2 } };
        const negatif = { ...ecriture(2), corrigeEcriture: { numeroPiece: 1 }, motifCorrection: 'Facture saisie deux fois' };
        const { piste } = await exporter([erronee, negatif]);
        const premiere = piste.getRow(classeur_en_flux_1.PREMIERE_LIGNE_DONNEES);
        const seconde = piste.getRow(classeur_en_flux_1.PREMIERE_LIGNE_DONNEES + 1);
        expect(premiere.getCell(1).value).toBe('ACH');
        expect(premiere.getCell(4).value).toBe(1);
        expect(premiere.getCell(7).value).toBe('Validée');
        expect(premiere.getCell(9).value).toBe('comptable@vmg.cd');
        expect(premiere.getCell(12).value).toBe('Annulée par la pièce n° 2');
        expect(seconde.getCell(12).value).toBe('Annule la pièce n° 1');
        expect(seconde.getCell(13).value).toBe('Facture saisie deux fois');
        expect(piste.rowCount).toBe(classeur_en_flux_1.LIGNE_ENTETE + 2);
    });
    it('un journal filtré sans écriture se nomme · jamais « Tous journaux » (relecture m3)', async () => {
        const SITUATION = { id: 'j-sit', code: 'SIT', intitule: 'Situation', type: 'SITUATION' };
        const { feuille } = await exporter([], { exerciceId: 'ex', journalId: 'j-sit' }, [ACHATS, SITUATION]);
        expect(feuille.getRow(1).getCell(1).value).toBe('JOURNAL DE SITUATION · HORS LIVRE-JOURNAL · Dossier');
        expect(feuille.getRow(2).getCell(1).value).toBe('SIT · Situation');
    });
    it('un journal de situation aux écritures validées héritées ne se dit pas hors du livre-journal (relecture m1)', async () => {
        const SITUATION = { id: 'j-sit', code: 'SIT', intitule: 'Situation', type: 'SITUATION' };
        const { feuille } = await exporter([ecriture(1, SITUATION)], { exerciceId: 'ex', journalId: 'j-sit' }, [SITUATION]);
        expect(feuille.getRow(1).getCell(1).value).toBe('JOURNAL DE SITUATION · ÉCRITURES VALIDÉES AU LIVRE-JOURNAL · Dossier');
    });
    it('une écriture porte un journal introuvable · le refus le nomme, jamais « relancez » (relecture m2)', async () => {
        const FANTOME = { id: 'j-fantome', code: 'X', intitule: 'X', type: 'ACHATS' };
        const { svc } = service([ecriture(1), ecriture(2, FANTOME)], [ACHATS]);
        const { sortie } = tampon();
        await expect(svc.journalExcelEnFlux('t1', { exerciceId: 'ex' }, () => sortie)).rejects.toThrow(/journal introuvable dans ce dossier \(j-fantome\)/);
    });
    it('une recherche exportée se titre comme une sélection · critères dits, totaux de la sélection (relecture m4)', async () => {
        const { feuille } = await exporter(2, { exerciceId: 'ex', compte: '401', montantMin: 100 });
        expect(feuille.getRow(1).getCell(1).value).toBe("SÉLECTION D'ÉCRITURES · JOURNAL · Dossier");
        expect(feuille.getRow(4).getCell(1).value).toBe('Sélection · compte 401, montant 100');
        expect(rangsDe(feuille, 'Totaux de la sélection, journal ACH')).toHaveLength(1);
        expect(rangsDe(feuille, 'Totaux de la sélection')).toHaveLength(1);
        expect(rangsDe(feuille, 'Totaux de la période')).toHaveLength(0);
    });
    it('un « & » du dossier s’imprime, jamais pris pour un code d’Excel, et l’en-tête reste sous 255 caractères (relecture m5)', () => {
        expect((0, classeur_en_flux_1.enTeteImpression)('H&P', 'Exercice 2026', 'Page &P / &N')).toBe('&LH&&P&CExercice 2026&RPage &P / &N');
        const long = (0, classeur_en_flux_1.enTeteImpression)('&'.repeat(400), null, 'Tiré le 16/10/26');
        expect(long.length).toBeLessThanOrEqual(255);
        expect(/(^|[^&])(&&)*&…/.test(long)).toBe(false);
    });
    it('la piste est datée du jour de Kinshasa, comme le tirage · un classeur, une date (relecture m6)', async () => {
        const { sortie, octets } = tampon();
        const edition = (0, journal_edition_1.ouvrirJournalEdition)({
            sortie,
            identite: { entite: 'Dossier', periode: 'Exercice 2026', devise: 'CDF' },
            formatJour: 'DD/MM',
            tire: new Date('2026-10-16T23:30:00Z'),
        });
        await edition.aucuneEcriture();
        await edition.terminer(async (ajouter) => {
            ajouter({ nomFeuille: 'Piste de révision', titre: 'PISTE', identite: { entite: 'Dossier', periode: 'Exercice 2026', devise: 'CDF' }, colonnes: journal_edition_1.COLONNES_PISTE_REVISION }).fermer();
        });
        const classeur = new ExcelJS.Workbook();
        await classeur.xlsx.load(octets());
        expect(String(classeur.getWorksheet('Journal').getRow(3).getCell(1).value)).toMatch(/^Tiré le 17\/10\/26/);
        expect(String(classeur.getWorksheet('Piste de révision').getRow(2).getCell(1).value)).toContain('édité le 17/10/2026');
    });
    it('un journal sans écriture le dit · jamais un fichier vide', async () => {
        const { feuille, piste } = await exporter([]);
        expect(feuille.getRow(1).getCell(1).value).toBe('JOURNAL · Dossier');
        expect(feuille.getRow(5).getCell(1).value).toBe('Aucune écriture sur la période.');
        expect(rangsDe(feuille, 'Totaux de la période')).toHaveLength(1);
        expect(piste.rowCount).toBe(classeur_en_flux_1.LIGNE_ENTETE);
    });
    it('garde les formats de cellule · sans eux une date sort en numéro de série', async () => {
        expect(classeur_en_flux_1.OPTIONS_CLASSEUR_EN_FLUX.useStyles).toBe(true);
        expect(classeur_en_flux_1.OPTIONS_CLASSEUR_EN_FLUX.useSharedStrings).toBe(false);
        const { feuille, piste } = await exporter(3);
        const premiere = feuille.getRow(DONNEES);
        expect(premiere.getCell(JOUR).numFmt).toBe('DD/MM');
        expect(premiere.getCell(DEBIT).numFmt).toBe('#,##0.00');
        expect(premiere.getCell(CREDIT).numFmt).toBe('#,##0.00');
        const ligne = piste.getRow(classeur_en_flux_1.PREMIERE_LIGNE_DONNEES);
        expect(ligne.getCell(2).numFmt).toBe('DD/MM/YYYY');
        expect(ligne.getCell(3).numFmt).toBe('DD/MM/YYYY');
        expect(ligne.getCell(8).numFmt).toBe('DD/MM/YYYY HH:mm');
    });
    it('au-delà de douze mois, le jour porte son année · deux 15/01 ne se confondent pas', async () => {
        const { feuille } = await exporter(1, { exerciceId: 'ex', dateDebut: '2025-07-01', dateFin: '2026-12-31' });
        expect(feuille.getRow(DONNEES).getCell(JOUR).numFmt).toBe('DD/MM/YY');
    });
    it('le périmètre du journal est celui de la fenêtre · une seule écriture du filtre', () => {
        const filtres = { exerciceId: 'ex', journalId: 'j', dateDebut: '2026-01-01', recherche: 'vente' };
        expect((0, ecriture_service_1.perimetreJournal)('t1', filtres)).toEqual({
            tenantId: 't1',
            exerciceId: 'ex',
            journalId: 'j',
            date: { gte: new Date('2026-01-01') },
            AND: [
                {
                    OR: [
                        { libelle: { contains: 'vente', mode: 'insensitive' } },
                        { lignes: { some: { libelle: { contains: 'vente', mode: 'insensitive' } } } },
                    ],
                },
            ],
        });
    });
    it('brouillard décoché · l’export ne lit que les écritures VALIDÉES', async () => {
        const { findMany } = await exporter(3, { exerciceId: 'ex', inclureBrouillard: false });
        expect(findMany.mock.calls[0][0].where?.statut).toBe('VALIDEE');
    });
    it('sans le paramètre · le brouillard reste inclus, comme à l’écran', async () => {
        const { findMany } = await exporter(3);
        expect(findMany.mock.calls[0][0].where?.statut).toEqual({ not: 'SITUATION' });
    });
    it('la route d’export lit le paramètre et le transmet', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'export.controller.ts'), 'utf8');
        const debut = source.indexOf("@Get('journal')");
        const corps = source.slice(debut, source.indexOf('@Get(', debut + 1));
        expect(corps).toContain("@Query('inclureBrouillard')");
        expect(corps).toMatch(/inclureBrouillard:\s*inclureBrouillard !== 'false'/);
    });
});
//# sourceMappingURL=journal-en-flux.spec.js.map