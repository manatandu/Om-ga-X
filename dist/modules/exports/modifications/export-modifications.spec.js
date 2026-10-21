"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ExcelJS = require("exceljs");
const client_1 = require("@prisma/client");
const client_2 = require("@prisma/client");
const export_modifications_service_1 = require("./export-modifications.service");
const export_modifications_1 = require("./export-modifications");
const import_service_1 = require("../../import/import.service");
const lecture_fichier_1 = require("../../import/lecture-fichier");
const import_dto_1 = require("../../import/dto/import.dto");
jest.setTimeout(60_000);
const DOSSIER = 'dossier-1';
const AUTRE = 'dossier-2';
const comparable = (v) => (v instanceof Date ? v.getTime() : v);
function correspond(ligne, where) {
    if (!where)
        return true;
    return Object.entries(where).every(([cle, attendu]) => {
        if (cle === 'AND')
            return attendu.every((w) => correspond(ligne, w));
        if (cle === 'OR')
            return attendu.some((w) => correspond(ligne, w));
        const valeur = ligne[cle];
        if (attendu === undefined)
            return true;
        if (attendu === null)
            return valeur === null || valeur === undefined;
        if (typeof attendu === 'object' && !(attendu instanceof Date)) {
            const a = attendu;
            if ('in' in a)
                return (a.in ?? []).includes(valeur);
            if ('not' in a)
                return valeur !== a.not;
            if ('lt' in a)
                return valeur !== null && valeur !== undefined && comparable(valeur) < comparable(a.lt);
            if ('gt' in a)
                return valeur !== null && valeur !== undefined && comparable(valeur) > comparable(a.gt);
            if (valeur && typeof valeur === 'object')
                return correspond(valeur, attendu);
            throw new Error(`Filtre non pris en charge par la doublure · ${cle}`);
        }
        return comparable(valeur) === comparable(attendu);
    });
}
function paginer(lignes, args) {
    const ordres = (Array.isArray(args.orderBy) ? args.orderBy : args.orderBy ? [args.orderBy] : []);
    const triees = [...lignes].sort((a, b) => {
        for (const o of ordres) {
            const [cle, sens] = Object.entries(o)[0];
            const va = comparable(a[cle]);
            const vb = comparable(b[cle]);
            const c = va < vb ? -1 : va > vb ? 1 : 0;
            if (c !== 0)
                return sens === 'asc' ? c : -c;
        }
        return 0;
    });
    let depart = 0;
    if (args.cursor) {
        const rang = triees.findIndex((l) => l.id === args.cursor.id);
        if (rang < 0)
            return [];
        depart = rang + (args.skip ?? 0);
    }
    return triees.slice(depart, args.take !== undefined ? depart + args.take : undefined);
}
function nouveauFaux() {
    const ecritures = [];
    const registre = [];
    const exports = [];
    const lecturesDesLignes = [];
    const lecturesDuRegistre = [];
    const creationsRendues = [];
    const crochets = {};
    let compteur = 0;
    const id = (prefixe) => `${prefixe}-${String(++compteur).padStart(5, '0')}`;
    const prisma = {
        ecriture: {
            findMany: async (args) => {
                const filtrees = ecritures.filter((e) => correspond(e, args.where));
                const page = paginer(filtrees, args);
                if (args.select) {
                    if (args.select._count)
                        throw new Error("`_count` agrège toute la table des lignes (relecture M2) · le service compte par regroupement.");
                    return page.map((e) => ({
                        id: e.id,
                        ...(args.select.date ? { date: e.date } : {}),
                        ...(args.select.statut ? { statut: e.statut } : {}),
                        ...(args.select.numeroPiece ? { numeroPiece: e.numeroPiece } : {}),
                        ...(args.select.journal ? { journal: e.journal } : {}),
                    }));
                }
                return page.map((e) => ({ ...e, lignes: e.lignes.map((l) => ({ ...l })) }));
            },
            findFirst: async (args) => {
                const e = ecritures.find((x) => correspond(x, args.where));
                return e ? { numeroPiece: e.numeroPiece, date: e.date, journal: e.journal } : null;
            },
        },
        ligneEcriture: {
            groupBy: async (args) => {
                lecturesDesLignes.push(args.where);
                return ecritures
                    .filter((e) => args.where.ecritureId.in.includes(e.id) && correspond(e, args.where.ecriture))
                    .map((e) => ({ ecritureId: e.id, _count: { _all: e.lignes.length } }));
            },
        },
        ecritureExportee: {
            findMany: async (args) => {
                lecturesDuRegistre.push(args.where);
                return paginer(registre.filter((r) => correspond(r, args.where)), args).map((r) => ({ ...r }));
            },
            deleteMany: async ({ where }) => {
                const avant = registre.length;
                for (let i = registre.length - 1; i >= 0; i--)
                    if (correspond(registre[i], where))
                        registre.splice(i, 1);
                return { count: avant - registre.length };
            },
            createMany: async ({ data }) => {
                for (const d of data)
                    registre.push({ id: id('reg'), supprimeeAuNumero: null, ...d });
                return { count: data.length };
            },
            updateMany: async ({ where, data }) => {
                let n = 0;
                for (const r of registre)
                    if (correspond(r, where))
                        (Object.assign(r, data), n++);
                return { count: n };
            },
        },
        exportEcritures: {
            aggregate: async ({ where }) => {
                const nums = exports.filter((e) => correspond(e, where)).map((e) => e.numero);
                return { _max: { numero: nums.length ? Math.max(...nums) : null } };
            },
            create: async ({ data, select }) => {
                const e = { id: id('exp'), ...data };
                exports.push(e);
                const rendu = select ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, e[k]])) : { ...e };
                creationsRendues.push(rendu);
                return rendu;
            },
            findFirst: async ({ where }) => exports.find((e) => correspond(e, where)) ?? null,
            findMany: async ({ where, take, select }) => exports
                .filter((e) => correspond(e, where))
                .sort((a, b) => b.numero - a.numero)
                .slice(0, take)
                .map((e) => (select ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, e[k]])) : e)),
            count: async ({ where }) => exports.filter((e) => correspond(e, where)).length,
        },
        user: { findMany: async () => [{ id: 'u1', email: 'comptable@cabinet.cd' }] },
        $executeRaw: async () => 0,
        $queryRaw: async (morceaux, ...valeurs) => {
            const texte = morceaux.join('?');
            if (texte.includes('pg_try_advisory_xact_lock'))
                return [{ pris: !crochets.verrouTenuAilleurs }];
            const dansLaPortee = (e, dossier, brouillardCompris) => e.tenantId === dossier &&
                !e.estANouveauProvisoire &&
                e.statut !== client_1.StatutEcriture.SITUATION &&
                (brouillardCompris || e.statut === client_1.StatutEcriture.VALIDEE);
            const jamaisParties = (dossier) => {
                const connues = new Set(registre.filter((r) => r.tenantId === dossier).map((r) => r.ecritureId));
                return (e) => !connues.has(e.id);
            };
            const ordre = (a, b) => a.date.getTime() - b.date.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
            if (texte.includes('COUNT(*)')) {
                const [dossier, , brouillardCompris, , date, idDepuis] = valeurs;
                const inconnue = jamaisParties(dossier);
                const n = ecritures.filter((e) => dansLaPortee(e, dossier, brouillardCompris) &&
                    inconnue(e) &&
                    (e.date.getTime() > date.getTime() || (e.date.getTime() === date.getTime() && e.id >= idDepuis))).length;
                return [{ n }];
            }
            if (texte.includes('SELECT e."id", e."date"')) {
                const [dossier, , brouillardCompris, , borne, limite] = valeurs;
                const [date, idApres] = borne.values;
                const inconnue = jamaisParties(dossier);
                const rendues = ecritures
                    .filter((e) => dansLaPortee(e, dossier, brouillardCompris) &&
                    inconnue(e) &&
                    (!date || e.date.getTime() > date.getTime() || (e.date.getTime() === date.getTime() && e.id > idApres)))
                    .sort(ordre)
                    .slice(0, limite)
                    .map((e) => ({ id: e.id, date: e.date }));
                crochets.surTrancheJamaisParties?.(rendues);
                return rendues;
            }
            if (texte.includes('FROM "ecritures_exportees" r')) {
                const [dossier, statut, apres, , limite] = valeurs;
                return registre
                    .filter((r) => r.tenantId === dossier &&
                    (r.supprimeeAuNumero === null || r.supprimeeAuNumero === undefined) &&
                    r.statutExporte === statut &&
                    r.id > apres &&
                    !ecritures.some((e) => e.id === r.ecritureId && e.tenantId === dossier && !e.estANouveauProvisoire && e.statut !== client_1.StatutEcriture.SITUATION))
                    .sort((a, b) => (a.id < b.id ? -1 : 1))
                    .slice(0, limite)
                    .map((r) => ({ ...r }));
            }
            throw new Error('Requête brute non prise en charge par la doublure.');
        },
    };
    prisma.$transaction = async (fn) => fn(prisma);
    const exportService = {
        identiteEtat: async () => ({ entite: 'ASBL Essai', nif: 'A123', periode: 'Toutes périodes', devise: 'CDF', immatriculation: '' }),
    };
    const service = new export_modifications_service_1.ExportModificationsService(prisma, exportService);
    const d = (x) => new client_2.Prisma.Decimal(x);
    const ajouter = (p) => {
        const eid = id('ecr');
        const montant = p.montant ?? 1000;
        const e = {
            id: eid,
            tenantId: p.tenantId ?? DOSSIER,
            date: new Date(`${p.date}T00:00:00Z`),
            dateValeur: null,
            journal: { code: 'BQ' },
            numeroPiece: p.numeroPiece === undefined ? compteur : p.numeroPiece,
            reference: null,
            libelle: p.libelle ?? 'Pièce',
            statut: p.statut ?? client_1.StatutEcriture.VALIDEE,
            estANouveauProvisoire: p.estANouveauProvisoire ?? false,
            lignes: [],
        };
        e.lignes = [
            { id: id('lig'), ecritureId: eid, compte: { numero: '60110000' }, libelle: null, debit: d(montant), credit: d(0), montantDevise: null, coursApplique: null, dateEcheance: null, devise: null },
            { id: id('lig'), ecritureId: eid, compte: { numero: '52110000' }, libelle: null, debit: d(0), credit: d(montant), montantDevise: null, coursApplique: null, dateEcheance: null, devise: null },
        ];
        ecritures.push(e);
        return e;
    };
    const retirer = (e) => ecritures.splice(ecritures.indexOf(e), 1);
    return { service, ajouter, retirer, ecritures, registre, exports, lecturesDesLignes, lecturesDuRegistre, creationsRendues, crochets };
}
async function relire(contenu, moteur = ExcelJS) {
    const classeur = new moteur.Workbook();
    await classeur.xlsx.load(contenu);
    const feuille = (nom) => {
        const f = classeur.getWorksheet(nom);
        if (!f)
            throw new Error(`Feuille absente · ${nom}`);
        const lignes = [];
        f.eachRow((r) => lignes.push(r.values.slice(1)));
        return lignes;
    };
    return { noms: classeur.worksheets.map((f) => f.name), feuille };
}
const contenuRange = (f, numero) => Buffer.from(f.exports.find((e) => e.numero === numero).contenu);
describe('export des seules modifications · registre et fichier', () => {
    it('le premier export porte tout, le second ne porte que ce qui est né depuis, rien en double', async () => {
        const f = nouveauFaux();
        f.ajouter({ date: '2026-01-10' });
        f.ajouter({ date: '2026-01-05' });
        f.ajouter({ date: '2026-01-07', tenantId: AUTRE });
        const premier = await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        expect(premier).toMatchObject({ numero: 1, nombreEcritures: 2, nombreNouvelles: 2, nombreLignes: 4, nombreSupprimees: 0 });
        expect(f.registre.map((r) => r.tenantId)).toEqual([DOSSIER, DOSSIER]);
        await expect(f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/Aucune modification depuis l'export n° 1/);
        expect(f.exports).toHaveLength(1);
        const troisieme = f.ajouter({ date: '2026-02-01' });
        const second = await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        expect(second).toMatchObject({ numero: 2, nombreEcritures: 1, nombreNouvelles: 1 });
        const { feuille } = await relire(contenuRange(f, 2));
        const ids = feuille(export_modifications_1.FEUILLE_ECRITURES).slice(1).map((l) => l[15]);
        expect(new Set(ids)).toEqual(new Set([troisieme.id]));
    });
    it('une écriture du brouillard modifiée repart entière et dit l’envoi qu’elle remplace ; validée depuis, elle le dit', async () => {
        const f = nouveauFaux();
        const b = f.ajouter({ date: '2026-03-01', statut: client_1.StatutEcriture.BROUILLARD, montant: 500 });
        await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        b.lignes = b.lignes.map((l, i) => ({ ...l, id: `recree-${i}` }));
        await expect(f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/Aucune modification/);
        b.lignes[0].debit = new client_2.Prisma.Decimal(750);
        b.lignes[1].credit = new client_2.Prisma.Decimal(750);
        const deux = await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        expect(deux).toMatchObject({ numero: 2, nombreModifiees: 1, nombreNouvelles: 0 });
        let lignes = (await relire(contenuRange(f, 2))).feuille(export_modifications_1.FEUILLE_ECRITURES);
        expect(lignes[1][14]).toBe("Modifiée · remplace l'envoi n° 1");
        expect(lignes[1][6]).toBe(750);
        b.statut = client_1.StatutEcriture.VALIDEE;
        await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        lignes = (await relire(contenuRange(f, 3))).feuille(export_modifications_1.FEUILLE_ECRITURES);
        expect(lignes[1][13]).toBe('Validée');
        expect(lignes[1][14]).toBe("Modifiée · remplace l'envoi n° 2 · validée depuis");
        await expect(f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/Aucune modification/);
    });
    it('une écriture du brouillard retirée après son envoi est nommée une fois, avec l’envoi qui la portait', async () => {
        const f = nouveauFaux();
        const b = f.ajouter({ date: '2026-03-01', statut: client_1.StatutEcriture.BROUILLARD, libelle: 'Achat retiré' });
        await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        f.retirer(b);
        const deux = await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        expect(deux).toMatchObject({ numero: 2, nombreEcritures: 0, nombreSupprimees: 1 });
        const supprimees = (await relire(contenuRange(f, 2))).feuille(export_modifications_1.FEUILLE_SUPPRIMEES);
        expect(supprimees[0]).toEqual(COLONNES_SUPPRIMEES_ENTETES);
        expect(supprimees[1][0]).toBe(b.id);
        expect(supprimees[1][4]).toBe('Achat retiré');
        expect(supprimees[1][5]).toBe(1);
        await expect(f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/Aucune modification/);
    });
    it('brouillard non compris · seul le livre-journal part ; la pièce du brouillard partira validée', async () => {
        const f = nouveauFaux();
        f.ajouter({ date: '2026-01-02' });
        const b = f.ajouter({ date: '2026-01-03', statut: client_1.StatutEcriture.BROUILLARD });
        const un = await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, false);
        expect(un.nombreEcritures).toBe(1);
        b.statut = client_1.StatutEcriture.VALIDEE;
        const deux = await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, false);
        expect(deux).toMatchObject({ nombreEcritures: 1, nombreNouvelles: 1 });
    });
    it('ni simulation ni à-nouveau provisoire ne partent', async () => {
        const f = nouveauFaux();
        f.ajouter({ date: '2026-01-02', statut: client_1.StatutEcriture.SITUATION });
        f.ajouter({ date: '2026-01-01', statut: client_1.StatutEcriture.BROUILLARD, estANouveauProvisoire: true });
        await expect(f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/Aucune écriture à exporter/);
    });
    it('la création rend au journal d’audit l’export entier sans son fichier · numéro, empreinte, auteur (mineur 4)', async () => {
        const f = nouveauFaux();
        f.ajouter({ date: '2026-01-02' });
        const envoi = await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        expect(f.creationsRendues).toHaveLength(1);
        const rendu = f.creationsRendues[0];
        expect(rendu).toMatchObject({ tenantId: DOSSIER, numero: 1, empreinte: envoi.empreinte, produitPar: 'u1', nombreEcritures: 1, nomFichier: envoi.nomFichier });
        expect(rendu).not.toHaveProperty('contenu');
    });
    it('un rangement en cours ailleurs refuse aussitôt, sans attendre le verrou ni prendre de numéro (mineur 6)', async () => {
        const f = nouveauFaux();
        f.ajouter({ date: '2026-01-02' });
        f.crochets.verrouTenuAilleurs = true;
        await expect(f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/en cours de rangement · rien n'a été rangé/);
        expect([f.exports.length, f.registre.length]).toEqual([0, 0]);
        f.crochets.verrouTenuAilleurs = false;
        await expect(f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true)).resolves.toMatchObject({ numero: 1 });
    });
    it('un autre export rangé pendant la production refuse le second, sans numéro pris', async () => {
        const f = nouveauFaux();
        f.ajouter({ date: '2026-01-02' });
        const inventaire = f.service.inventaire.bind(f.service);
        jest.spyOn(f.service, 'inventaire').mockImplementationOnce(async (...a) => {
            const inv = await inventaire(...a);
            f.exports.push({ id: 'concurrent', tenantId: DOSSIER, numero: 1 });
            return inv;
        });
        await expect(f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/Un autre export \(n° 1\) a été produit pendant celui-ci/);
        expect(f.registre).toHaveLength(0);
    });
    it('le fichier se relit par l’import des écritures · toutes les colonnes exigées sont reconnues, une pièce par écriture', async () => {
        const f = nouveauFaux();
        f.ajouter({ date: '2026-04-01', numeroPiece: null, montant: 100 });
        f.ajouter({ date: '2026-04-01', numeroPiece: null, montant: 200 });
        await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        const contenu = contenuRange(f, 1);
        const relu = await relire(contenu);
        expect(relu.noms).toEqual([export_modifications_1.FEUILLE_ECRITURES, export_modifications_1.FEUILLE_SUPPRIMEES, export_modifications_1.FEUILLE_EXPORT]);
        const lignes = relu.feuille(export_modifications_1.FEUILLE_ECRITURES);
        expect(lignes[0]).toEqual(export_modifications_1.COLONNES_ECHANGE.map((c) => c.header));
        expect(new Set(lignes.slice(1).map((l) => l[2])).size).toBe(2);
        const importService = new import_service_1.ImportService(null, null);
        const analyse = await importService.analyser({
            type: import_dto_1.TypeImport.ECRITURES,
            nomFichier: 'export.xlsx',
            contenuBase64: contenu.toString('base64'),
        });
        expect(analyse.manquants).toEqual([]);
        expect(analyse.mappingPropose).toMatchObject({
            date: 'Date',
            journal: 'Code journal',
            piece: 'N° de pièce',
            numero: 'Numéro de compte',
            libelle: 'Libellé',
            debit: 'Débit',
            credit: 'Crédit',
            montantDevise: 'Montant en devise',
            devise: 'Devise',
            cours: 'Cours',
        });
        const recap = relu.feuille(export_modifications_1.FEUILLE_EXPORT);
        expect(recap.find((l) => l[0] === 'Export n°')?.[1]).toBe(1);
        expect(recap.find((l) => l[0] === 'Portée')?.[1]).toBe('Premier export');
    });
    it('un envoi qui remplace ou retire une pièce est REFUSÉ ENTIER par l’import, en le nommant ; le premier envoi se relit (M3)', async () => {
        const f = nouveauFaux();
        const b = f.ajouter({ date: '2026-04-01', statut: client_1.StatutEcriture.BROUILLARD });
        const c = f.ajouter({ date: '2026-04-02', statut: client_1.StatutEcriture.BROUILLARD });
        await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        const importService = new import_service_1.ImportService(null, null);
        const tableauDe = (n) => (0, lecture_fichier_1.lireFichier)('export.xlsx', contenuRange(f, n).toString('base64'));
        const premier = await tableauDe(1);
        expect(premier.lignesSupprimees).toBe(0);
        expect((0, export_modifications_1.motifEnvoiNonRelu)(premier.colonnes, premier.lignes, 0)).toBeNull();
        b.libelle = 'Libellé corrigé';
        f.retirer(c);
        await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        const contenu = contenuRange(f, 2);
        const analyse = await importService.analyser({ type: import_dto_1.TypeImport.ECRITURES, nomFichier: 'export.xlsx', contenuBase64: contenu.toString('base64') });
        await expect(importService.executer(DOSSIER, 'u1', {
            type: import_dto_1.TypeImport.ECRITURES,
            nomFichier: 'export.xlsx',
            contenuBase64: contenu.toString('base64'),
            mapping: analyse.mappingPropose,
        })).rejects.toThrow(/2 lignes de la colonne « Mouvement » remplacent ou renvoient une pièce déjà envoyée \(première à la ligne 2 · « Modifiée · remplace l'envoi n° 1 »\) · l'import les créerait une seconde fois ; la feuille « Supprimées » nomme 1 pièce retirée.*Rien n'est importé/);
    });
    it('au-delà du plafond, l’export des modifications part par lots dans l’ordre des dates et dit ce qui attend ; le complet est refusé', async () => {
        const ancien = process.env.EXPORT_MAX_LIGNES;
        jest.resetModules();
        process.env.EXPORT_MAX_LIGNES = '4';
        try {
            const { ExportModificationsService: Service } = await Promise.resolve().then(() => require('./export-modifications.service'));
            const f = nouveauFaux();
            const service = new Service(f.service.prisma, { identiteEtat: async () => ({ entite: 'X', nif: '', periode: '', devise: 'CDF' }) });
            const tardive = f.ajouter({ date: '2026-03-01' });
            f.ajouter({ date: '2026-01-01' });
            f.ajouter({ date: '2026-02-01' });
            await expect(service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.COMPLET, true)).rejects.toThrow(/refusé plutôt qu'amputé/);
            const un = await service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
            expect(un).toMatchObject({ nombreEcritures: 2, nombreLignes: 4, nombreEnAttente: 1 });
            expect(f.registre.map((r) => r.ecritureId)).not.toContain(tardive.id);
            const deux = await service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
            expect(deux).toMatchObject({ nombreEcritures: 1, nombreEnAttente: 0 });
            expect(f.registre.map((r) => r.ecritureId)).toContain(tardive.id);
        }
        finally {
            if (ancien === undefined)
                delete process.env.EXPORT_MAX_LIGNES;
            else
                process.env.EXPORT_MAX_LIGNES = ancien;
            jest.resetModules();
        }
    });
    it('un brouillard retiré pendant l’inventaire n’arrête plus la lecture · la tranche suivante part de la clé (M6)', async () => {
        const f = nouveauFaux();
        for (let i = 0; i < 5002; i++)
            f.ajouter({ date: `2026-01-${String(1 + (i % 28)).padStart(2, '0')}` });
        let premiere = true;
        f.crochets.surTrancheJamaisParties = (rendues) => {
            if (!premiere || rendues.length === 0)
                return;
            premiere = false;
            f.retirer(f.ecritures.find((e) => e.id === rendues[rendues.length - 1].id));
        };
        const apercu = await f.service.apercu(DOSSIER, true);
        expect(apercu.nouvelles).toBe(5002);
        expect(premiere).toBe(false);
    });
    it('l’aperçu ne relit que le brouillard parti, et ne compte que les lignes des pièces jamais parties (mineur 1)', async () => {
        const f = nouveauFaux();
        for (let i = 1; i <= 6; i++)
            f.ajouter({ date: `2026-01-0${i}` });
        f.ajouter({ date: '2026-01-07', statut: client_1.StatutEcriture.BROUILLARD });
        const retiree = f.ajouter({ date: '2026-01-07', statut: client_1.StatutEcriture.BROUILLARD });
        await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        f.retirer(retiree);
        const nouvelle = f.ajouter({ date: '2026-01-08' });
        f.lecturesDesLignes.length = 0;
        f.lecturesDuRegistre.length = 0;
        const apercu = await f.service.apercu(DOSSIER, true);
        expect(apercu).toMatchObject({ nouvelles: 1, modifiees: 0, supprimees: 1 });
        expect(f.lecturesDesLignes.map((w) => w.ecritureId.in)).toEqual([[nouvelle.id]]);
        expect(f.lecturesDuRegistre.length).toBeGreaterThan(0);
        for (const w of f.lecturesDuRegistre)
            expect(w).toMatchObject({ tenantId: DOSSIER, supprimeeAuNumero: null, statutExporte: client_1.StatutEcriture.BROUILLARD });
        f.lecturesDuRegistre.length = 0;
        const complet = await f.service.inventaire(DOSSIER, client_1.ModeExportEcritures.COMPLET, true);
        expect(complet.renvoyees).toBe(7);
        expect(new Set(f.lecturesDuRegistre.map((w) => w.statutExporte))).toEqual(new Set(Object.values(client_1.StatutEcriture)));
    });
    it('une pièce jamais partie dont la date avance pendant l’inventaire est retenue UNE fois, et part une fois (B1)', async () => {
        jest.resetModules();
        jest.doMock('../../../common/lecture-par-lots', () => ({ ...jest.requireActual('../../../common/lecture-par-lots'), LOT_LECTURE: 2 }));
        try {
            const { ExportModificationsService: Service } = await Promise.resolve().then(() => require('./export-modifications.service'));
            const f = nouveauFaux();
            const prisma = f.service.prisma;
            const service = new Service(prisma, { identiteEtat: async () => ({ entite: 'X', nif: '', periode: '', devise: 'CDF' }) });
            for (let i = 1; i <= 5; i++)
                f.ajouter({ date: `2026-01-0${i}` });
            let deplacee;
            f.crochets.surTrancheJamaisParties = (rendues) => {
                if (deplacee || rendues.length === 0)
                    return;
                deplacee = rendues[0].id;
                f.ecritures.find((e) => e.id === deplacee).date = new Date('2026-12-31T00:00:00Z');
            };
            const apercu = await service.apercu(DOSSIER, true);
            expect(deplacee).toBeDefined();
            expect(apercu).toMatchObject({ nouvelles: 5, lignes: 10 });
            for (const e of f.ecritures)
                e.date = new Date(`2026-01-0${1 + f.ecritures.indexOf(e)}T00:00:00Z`);
            deplacee = undefined;
            const envoi = await service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
            expect(deplacee).toBeDefined();
            expect(envoi).toMatchObject({ nombreEcritures: 5, nombreNouvelles: 5, nombreLignes: 10 });
            const lignes = (await relire(contenuRange(f, 1), await Promise.resolve().then(() => require('exceljs')))).feuille(export_modifications_1.FEUILLE_ECRITURES).slice(1);
            expect(lignes.filter((l) => l[15] === deplacee)).toHaveLength(2);
            expect(f.registre.filter((r) => r.ecritureId === deplacee)).toHaveLength(1);
        }
        finally {
            jest.dontMock('../../../common/lecture-par-lots');
            jest.resetModules();
        }
    });
    it('les lignes se comptent par regroupement sur la tranche, et ce qui attend par la base, sans lire la suite (M2)', async () => {
        const ancien = process.env.EXPORT_MAX_LIGNES;
        jest.resetModules();
        process.env.EXPORT_MAX_LIGNES = '4';
        try {
            const { ExportModificationsService: Service } = await Promise.resolve().then(() => require('./export-modifications.service'));
            const f = nouveauFaux();
            const prisma = f.service.prisma;
            const service = new Service(prisma, { identiteEtat: async () => ({ entite: 'X', nif: '', periode: '', devise: 'CDF' }) });
            for (let i = 1; i <= 10; i++)
                f.ajouter({ date: `2026-01-${String(i).padStart(2, '0')}` });
            const apercu = await service.apercu(DOSSIER, true);
            expect(apercu).toMatchObject({ nouvelles: 2, lignes: 4, enAttente: 8 });
            expect(f.lecturesDesLignes.length).toBeGreaterThan(0);
            for (const w of f.lecturesDesLignes)
                expect(w).toMatchObject({ ecriture: { tenantId: DOSSIER, statut: { not: client_1.StatutEcriture.SITUATION } } });
        }
        finally {
            if (ancien === undefined)
                delete process.env.EXPORT_MAX_LIGNES;
            else
                process.env.EXPORT_MAX_LIGNES = ancien;
            jest.resetModules();
        }
    });
    it('une pièce qu’aucun export ne peut porter est NOMMÉE, jamais dite « aucune modification » (m3)', async () => {
        const ancien = process.env.EXPORT_MAX_LIGNES;
        jest.resetModules();
        process.env.EXPORT_MAX_LIGNES = '4';
        try {
            const { ExportModificationsService: Service } = await Promise.resolve().then(() => require('./export-modifications.service'));
            const f = nouveauFaux();
            const prisma = f.service.prisma;
            const service = new Service(prisma, { identiteEtat: async () => ({ entite: 'X', nif: '', periode: '', devise: 'CDF' }) });
            const grosse = f.ajouter({ date: '2026-01-01', numeroPiece: 17 });
            grosse.lignes = [...grosse.lignes, ...grosse.lignes, ...grosse.lignes].map((l, i) => ({ ...l, id: `g-${i}` }));
            f.ajouter({ date: '2026-01-02' });
            const apercu = await service.apercu(DOSSIER, true);
            expect(apercu.horsPlafond).toMatch(/pièce n° 17 du journal BQ, du 01\/01\/2026, porte 6 lignes, au-delà du plafond de 4 lignes/);
            expect(apercu.enAttente).toBe(1);
            await expect(service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/pièce n° 17 du journal BQ/);
            expect(f.exports).toHaveLength(0);
        }
        finally {
            if (ancien === undefined)
                delete process.env.EXPORT_MAX_LIGNES;
            else
                process.env.EXPORT_MAX_LIGNES = ancien;
            jest.resetModules();
        }
    });
    it('un brouillard envoyé puis modifié, hors de la portée, se compte à l’aperçu et au récapitulatif (m8)', async () => {
        const f = nouveauFaux();
        const b = f.ajouter({ date: '2026-01-02', statut: client_1.StatutEcriture.BROUILLARD });
        await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        b.libelle = 'Libellé corrigé';
        f.ajouter({ date: '2026-01-03' });
        expect((await f.service.apercu(DOSSIER, false)).brouillardModifieHorsPortee).toBe(1);
        expect((await f.service.apercu(DOSSIER, true)).brouillardModifieHorsPortee).toBe(0);
        const deux = await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, false);
        expect(deux.brouillardModifieHorsPortee).toBe(1);
        const recap = (await relire(contenuRange(f, 2))).feuille(export_modifications_1.FEUILLE_EXPORT);
        expect(recap.find((l) => l[0] === 'Envoyées au brouillard, modifiées depuis, hors de cette portée')?.[1]).toBe(1);
    });
    it('l’export complet renvoie tout, dit ce qui était déjà parti, et ne fait rien repartir ensuite', async () => {
        const f = nouveauFaux();
        f.ajouter({ date: '2026-01-02' });
        await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        f.ajouter({ date: '2026-01-03' });
        const complet = await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.COMPLET, true);
        expect(complet).toMatchObject({ numero: 2, nombreEcritures: 2, nombreNouvelles: 1, nombreModifiees: 0 });
        const lignes = (await relire(contenuRange(f, 2))).feuille(export_modifications_1.FEUILLE_ECRITURES);
        expect(lignes.slice(1).map((l) => l[14])).toEqual(['Déjà envoyée au n° 1', 'Déjà envoyée au n° 1', 'Nouvelle', 'Nouvelle']);
        await expect(f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/Aucune modification/);
    });
});
describe('liste des exports', () => {
    it('les plus récents d’abord, l’auteur en courriel, sans le fichier, le total dit', async () => {
        const f = nouveauFaux();
        f.ajouter({ date: '2026-01-02' });
        await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        f.ajouter({ date: '2026-01-03' });
        await f.service.exporter(DOSSIER, 'u1', client_1.ModeExportEcritures.MODIFICATIONS, true);
        const liste = await f.service.lister(DOSSIER);
        expect(liste.exports.map((e) => [e.numero, e.produitPar, e.nombreNouvelles])).toEqual([
            [2, 'comptable@cabinet.cd', 1],
            [1, 'comptable@cabinet.cd', 1],
        ]);
        expect(liste.exports.every((e) => !('contenu' in e))).toBe(true);
        expect([liste.total, liste.tronque, liste.plusAnciensAvant]).toEqual([2, false, null]);
    });
    it('la liste se poursuit par le numéro · un ancien export se retrouve et se retélécharge (m5)', async () => {
        const f = nouveauFaux();
        for (let n = 1; n <= 52; n++) {
            f.exports.push({ id: `exp-${n}`, tenantId: DOSSIER, numero: n, produitPar: 'u1', nomFichier: `ecritures-export-${n}.xlsx`, contenu: Buffer.from(`envoi ${n}`) });
        }
        const premiere = await f.service.lister(DOSSIER);
        expect([premiere.exports.length, premiere.exports[0].numero, premiere.plusAnciensAvant, premiere.tronque]).toEqual([50, 52, 3, true]);
        const suite = await f.service.lister(DOSSIER, premiere.plusAnciensAvant);
        expect([suite.exports.map((e) => e.numero), suite.plusAnciensAvant]).toEqual([[2, 1], null]);
        expect((await f.service.fichier(DOSSIER, 'exp-1')).contenu.toString()).toBe('envoi 1');
        expect((await f.service.fichier(DOSSIER, 'exp-1')).contenu).toBe(f.exports.find((e) => e.id === 'exp-1').contenu);
    });
});
const COLONNES_SUPPRIMEES_ENTETES = ["Identifiant de l'écriture", 'Date', 'Code journal', 'N° de pièce', 'Libellé', "Envoyée à l'export n°"];
describe('règles pures de l’export des modifications', () => {
    const base = {
        id: 'e1',
        date: new Date('2026-01-01T00:00:00Z'),
        dateValeur: null,
        journal: 'BQ',
        numeroPiece: 3,
        reference: null,
        libelle: 'X',
        statut: client_1.StatutEcriture.BROUILLARD,
        lignes: [
            { compte: '601', libelle: null, debit: '10.00', credit: '0.00', devise: null, montantDevise: null, cours: null, echeance: null },
            { compte: '521', libelle: null, debit: '0.00', credit: '10.00', devise: null, montantDevise: null, cours: null, echeance: null },
        ],
    };
    it('l’empreinte ne dépend pas de l’ordre des lignes, mais du lettrage non plus · il n’y entre pas', () => {
        const a = (0, export_modifications_1.empreinteEcriture)(base);
        expect((0, export_modifications_1.empreinteEcriture)({ ...base, lignes: [...base.lignes].reverse() })).toBe(a);
        expect((0, export_modifications_1.empreinteEcriture)({ ...base, statut: client_1.StatutEcriture.VALIDEE })).not.toBe(a);
        expect((0, export_modifications_1.empreinteEcriture)({ ...base, dateValeur: new Date('2025-12-31T00:00:00Z') })).not.toBe(a);
        expect((0, export_modifications_1.empreinteEcriture)({ ...base, lignes: [{ ...base.lignes[0], echeance: '2026-02-01' }, base.lignes[1]] })).not.toBe(a);
    });
    it('deux lignes qui ne diffèrent que par l’échéance, la devise ou le cours, lues dans les deux ordres, gardent l’empreinte et l’ordre du fichier (M1)', () => {
        const echeances = {
            ...base,
            lignes: [
                { compte: '411', libelle: null, debit: '50.00', credit: '0.00', devise: null, montantDevise: null, cours: null, echeance: '2026-03-31' },
                { compte: '411', libelle: null, debit: '50.00', credit: '0.00', devise: null, montantDevise: null, cours: null, echeance: '2026-04-30' },
                { compte: '701', libelle: null, debit: '0.00', credit: '100.00', devise: null, montantDevise: null, cours: null, echeance: null },
            ],
        };
        const inverse = { ...echeances, lignes: [echeances.lignes[1], echeances.lignes[0], echeances.lignes[2]] };
        expect((0, export_modifications_1.empreinteEcriture)(inverse)).toBe((0, export_modifications_1.empreinteEcriture)(echeances));
        expect((0, export_modifications_1.ordonnerLignes)(inverse.lignes).map((l) => l.echeance)).toEqual(['2026-03-31', '2026-04-30', null]);
        const devises = {
            ...base,
            lignes: [
                { compte: '411', libelle: null, debit: '50.00', credit: '0.00', devise: 'USD', montantDevise: '20.00', cours: '2500', echeance: null },
                { compte: '411', libelle: null, debit: '50.00', credit: '0.00', devise: 'USD', montantDevise: '20.00', cours: '2500.5', echeance: null },
                { compte: '701', libelle: null, debit: '0.00', credit: '100.00', devise: null, montantDevise: null, cours: null, echeance: null },
            ],
        };
        expect((0, export_modifications_1.empreinteEcriture)({ ...devises, lignes: [...devises.lignes].reverse() })).toBe((0, export_modifications_1.empreinteEcriture)(devises));
    });
    it('le mouvement se lit contre le registre', () => {
        const entree = { numeroExport: 4, statutExporte: client_1.StatutEcriture.BROUILLARD, empreinte: 'abc' };
        expect((0, export_modifications_1.mouvementDe)(undefined, 'abc')).toBe('NOUVELLE');
        expect((0, export_modifications_1.mouvementDe)(entree, 'abc')).toBe('RENVOYEE');
        expect((0, export_modifications_1.mouvementDe)(entree, 'def')).toBe('MODIFIEE');
        expect((0, export_modifications_1.libelleMouvement)('MODIFIEE', entree, client_1.StatutEcriture.BROUILLARD)).toBe("Modifiée · remplace l'envoi n° 4");
    });
    it('deux pièces sans numéro, ou au même numéro, du même jour et du même journal restent distinctes', () => {
        expect((0, export_modifications_1.pieceDuFichier)(null, 'abcdef0123')).toBe('sans n° · abcdef01');
        const p = new export_modifications_1.PiecesDistinctes();
        const jour = new Date('2026-01-01T00:00:00Z');
        expect(p.piece({ id: 'aaaaaaaa1', date: jour, journal: 'BQ', numeroPiece: 7 })).toBe('7');
        expect(p.piece({ id: 'bbbbbbbb2', date: jour, journal: 'BQ', numeroPiece: 7 })).toBe('7 · bbbbbbbb');
        expect(p.piece({ id: 'cccccccc3', date: jour, journal: 'AC', numeroPiece: 7 })).toBe('7');
    });
});
//# sourceMappingURL=export-modifications.spec.js.map