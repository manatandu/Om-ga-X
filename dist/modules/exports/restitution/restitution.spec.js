"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_stream_1 = require("node:stream");
const restitution_service_1 = require("./restitution.service");
const client_1 = require("@prisma/client");
const tables_restitution_1 = require("./tables-restitution");
const champs_audites_1 = require("../../../common/audit/champs-audites");
const lecture_fichier_1 = require("../../import/lecture-fichier");
const manifeste_restitution_1 = require("./manifeste-restitution");
jest.setTimeout(30000);
const DOSSIER = 'd-1';
const LIGNE_DOSSIER = {
    id: DOSSIER,
    nom: 'ASBL Espoir',
    referentiel: 'SYCEBNL',
    numeroImpot: 'A1234567B',
    doubleRegardValidation: true,
};
function prismaFactice(lignes = {}) {
    const filtres = [];
    const maillons = [];
    const client = {
        tenant: {
            findUniqueOrThrow: async ({ select } = {}) => select ? Object.fromEntries(Object.keys(select).map((c) => [c, LIGNE_DOSSIER[c] ?? null])) : LIGNE_DOSSIER,
        },
    };
    for (const modele of tables_restitution_1.TABLES_RESTITUEES) {
        const propriete = modele.charAt(0).toLowerCase() + modele.slice(1);
        client[propriete] = {
            count: async () => (lignes[modele] ?? []).length,
            findMany: async ({ where, orderBy, select, take, cursor }) => {
                filtres.push({ modele, where, orderBy, take, cursor });
                const toutes = [...(lignes[modele] ?? [])];
                const cle = Object.keys(orderBy)[0];
                toutes.sort((a, b) => String(a[cle]).localeCompare(String(b[cle])));
                if (cursor && !toutes.some((l) => l[cle] === cursor[cle]))
                    return [];
                const apres = where[cle]?.gt ?? cursor?.[cle];
                const restantes = apres === undefined ? toutes : toutes.filter((l) => l[cle] > apres);
                return restantes
                    .slice(0, take)
                    .map((l) => Object.fromEntries(Object.keys(select).map((c) => [c, l[c] ?? null])));
            },
        };
    }
    const tx = {
        $executeRaw: async () => 1,
        evenementAudit: {
            findFirst: async () => null,
            create: async ({ data }) => {
                maillons.push(data);
                return data;
            },
        },
    };
    client.clientNu = { $transaction: async (f) => f(tx) };
    return { client: client, filtres, maillons };
}
const relancer = (e) => {
    throw e;
};
function collecteur() {
    const morceaux = [];
    const flux = new node_stream_1.Writable({
        write(morceau, _enc, suite) {
            morceaux.push(Buffer.from(morceau));
            suite();
        },
    });
    return { flux, buffer: () => Buffer.concat(morceaux) };
}
describe('la lecture est bornée au dossier, table par table', () => {
    it('borne un modèle PORTÉ par sa relation parente, jamais par rien', async () => {
        const { client, filtres } = prismaFactice();
        const service = new restitution_service_1.RestitutionService(client);
        const { flux } = collecteur();
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        const lignesEcriture = filtres.filter((f) => f.modele === 'LigneEcriture');
        expect(lignesEcriture.length).toBeGreaterThan(0);
        expect(lignesEcriture[0].where).toEqual({ ecriture: { tenantId: DOSSIER } });
    });
    it('interroge toutes les tables, et chacune avec une borne', async () => {
        const { client, filtres } = prismaFactice();
        const service = new restitution_service_1.RestitutionService(client);
        const { flux } = collecteur();
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        expect(new Set(filtres.map((f) => f.modele)).size).toBe(tables_restitution_1.TABLES_RESTITUEES.length);
        for (const f of filtres) {
            expect([f.modele, JSON.stringify(f.where).includes(DOSSIER)]).toEqual([f.modele, true]);
        }
    });
    it('lit le journal d’audit par son rang', async () => {
        const { client, filtres } = prismaFactice();
        const service = new restitution_service_1.RestitutionService(client);
        const { flux } = collecteur();
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        expect(filtres.find((f) => f.modele === 'EvenementAudit').orderBy).toEqual({ rang: 'asc' });
        expect(filtres.find((f) => f.modele === 'Ecriture').orderBy).toEqual({ id: 'asc' });
    });
});
describe('le CSV d’une table', () => {
    const JOURNAUX = [
        { id: 'a', tenantId: DOSSIER, code: 'OD', intitule: 'Opérations diverses', type: 'GENERAL' },
        { id: 'b', tenantId: DOSSIER, code: 'CA', intitule: 'Caisse; dite "petite"\ncaisse', type: 'TRESORERIE' },
    ];
    it('se relit à l’identique, libellés hostiles compris', async () => {
        const { client } = prismaFactice({ Journal: JOURNAUX });
        const service = new restitution_service_1.RestitutionService(client);
        let csv = '';
        for await (const bout of service.lignesCsv('Journal', DOSSIER, { ecrites: 0 }, relancer))
            csv += bout;
        const relu = (0, lecture_fichier_1.analyserCsv)(csv, ';');
        const iLibelle = relu[0].indexOf('intitule');
        expect(relu).toHaveLength(3);
        expect(relu[1][iLibelle]).toBe('Opérations diverses');
        expect(relu[2][iLibelle]).toBe('Caisse; dite "petite"\ncaisse');
    });
    it('compte ce qu’il écrit', async () => {
        const { client } = prismaFactice({ Journal: JOURNAUX });
        const service = new restitution_service_1.RestitutionService(client);
        const compteur = { ecrites: 0 };
        for await (const _ of service.lignesCsv('Journal', DOSSIER, compteur, relancer))
            void _;
        expect(compteur.ecrites).toBe(2);
    });
    it('avance son curseur au lieu de relire le même lot', async () => {
        const beaucoup = Array.from({ length: 2_100 }, (_, i) => ({
            id: `j-${String(i).padStart(5, '0')}`,
            tenantId: DOSSIER,
            code: 'OD',
            intitule: `Journal ${i}`,
        }));
        const { client, filtres } = prismaFactice({ Journal: beaucoup });
        const service = new restitution_service_1.RestitutionService(client);
        const compteur = { ecrites: 0 };
        for await (const _ of service.lignesCsv('Journal', DOSSIER, compteur, relancer))
            void _;
        const lectures = filtres.filter((f) => f.modele === 'Journal');
        expect(lectures).toHaveLength(2);
        expect(lectures[0].where).toEqual({ tenantId: DOSSIER });
        expect(lectures[1].where).toEqual({ tenantId: DOSSIER, id: { gt: 'j-01999' } });
        expect(compteur.ecrites).toBe(2_100);
    });
});
describe('la trace de l’extraction', () => {
    it('écrit UN maillon EXTRACTION, par le client NON étendu', async () => {
        const { client, maillons } = prismaFactice();
        const service = new restitution_service_1.RestitutionService(client);
        const { flux } = collecteur();
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: '41.243.0.1' }, flux);
        expect(maillons).toHaveLength(1);
        expect(maillons[0]).toMatchObject({
            tenantId: DOSSIER,
            action: 'EXTRACTION',
            entite: 'Tenant',
            entiteId: DOSSIER,
            acteurEmail: 'chef@asbl.cd',
            adresseIp: '41.243.0.1',
            rang: 1,
        });
    });
});
describe('le contrôle dit l’écart au lieu de le taire', () => {
    it('signale une table dont l’inventaire et l’écriture ne concordent pas', async () => {
        const { client } = prismaFactice({ Journal: [{ id: 'a', tenantId: DOSSIER, code: 'OD' }] });
        client.journal.count = async () => 3;
        const service = new restitution_service_1.RestitutionService(client);
        const ecrites = { Journal: { ecrites: 1 } };
        let texte = '';
        for await (const bout of service.controles({ Journal: 3 }, ecrites, { annoncees: 0, ecrites: 0, manquantes: [] }))
            texte += bout;
        expect(texte).toContain('Journal;3;1;ECART');
        expect(texte).toContain('table(s) en écart.');
    });
    it('dit « aucun écart » quand tout concorde', async () => {
        const { client } = prismaFactice();
        const service = new restitution_service_1.RestitutionService(client);
        let texte = '';
        for await (const bout of service.controles({}, {}, { annoncees: 0, ecrites: 0, manquantes: [] }))
            texte += bout;
        expect(texte).toContain('Aucun écart.');
    });
});
describe('l’archive produite', () => {
    it('est un ZIP portant le manifeste, toutes les tables et le contrôle', async () => {
        const { client } = prismaFactice({ Journal: [{ id: 'a', tenantId: DOSSIER, code: 'OD' }] });
        const service = new restitution_service_1.RestitutionService(client);
        const { flux, buffer } = collecteur();
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        const zip = buffer();
        expect(zip.subarray(0, 2).toString('latin1')).toBe('PK');
        const texte = zip.toString('latin1');
        expect(texte).toContain('MANIFESTE.md');
        expect(texte).toContain('controles.txt');
        for (const table of tables_restitution_1.TABLES_RESTITUEES)
            expect(texte).toContain((0, tables_restitution_1.fichierDeLaTable)(table));
    });
});
describe('le manifeste dit ce que l’archive n’est pas', () => {
    const manifeste = (0, manifeste_restitution_1.ecrireManifeste)({
        dossier: { id: DOSSIER, nom: 'ASBL Espoir', referentiel: 'SYCEBNL' },
        demandeePar: 'chef@asbl.cd',
        horodatage: '2026-09-18T08:00:00.000Z',
        maillon: { rang: 12, empreinte: 'abc123' },
        lignesParTable: { Journal: 4 },
    });
    it('dit la valeur probante d’après le Code du numérique, jamais d’après la note de cours de 2020', () => {
        const deplie = manifeste.replace(/\s+/g, ' ');
        expect(deplie).toContain("Elle n'a pas la force probante de l'écrit papier légalisé.");
        expect(deplie).toContain('ordonnance-loi n° 23/10 du 13 mars 2023');
        expect(deplie).toContain("« L'écrit électronique a la même valeur juridique que l'écrit sur papier » (art. 89)");
        expect(deplie).toContain("« L'horodatage et la signature électronique certifiée confèrent à l'écrit électronique la même force probante que l'écrit sur papier légalisé ayant une date certaine » (art. 91)");
        expect(deplie).toContain('Son admission en preuve relève de l\'art. 95');
        expect(deplie).toContain('Sa qualification comme preuve revient à un juriste.');
    });
    it('dit que la migration 20270149 a déplacé des saisies hors du journal d’audit (relecture 2)', () => {
        const deplie = manifeste.replace(/\s+/g, ' ');
        expect(deplie).toContain("Une migration a déplacé des lignes hors du journal d'audit.");
        expect(deplie).toContain('20270149000000_effectifs_seize_colonnes');
        expect(deplie).toContain('à la colonne 100 + k, k étant leur ancienne colonne');
        expect(deplie).toContain('saisie-note.csv');
    });
    it('fonde le maillon EXTRACTION aussi sur l’art. 219, 14° du Code du numérique', () => {
        const deplie = manifeste.replace(/\s+/g, ' ');
        expect(deplie).toContain('art. 219, 14°');
        expect(deplie).toContain('copiées, effacées ou lues dans le système, le moment auquel ces données ont été manipulées');
    });
    it('refuse d’annoncer une conservation, une réversibilité ou un instantané', () => {
        const deplie = manifeste.replace(/\s+/g, ' ');
        expect(deplie).toContain("Elle ne satisfait pas à elle seule à l'obligation de conservation");
        expect(deplie).toContain("Ce n'est pas une réversibilité");
        expect(deplie).toContain("Ce n'est pas un instantané");
        expect(deplie).toContain('OmegaX garde les COPIES numériques que le cabinet joint aux écritures');
        expect(deplie).toContain('restituées dans `pieces-jointes/`, `documents-tiers/` et `pieces-virements/`');
        expect(deplie).toContain('Les originaux, papier ou électroniques, restent la conservation.');
        expect(deplie).toContain("trois imports ciblés lisent un relevé bancaire, la balance d'une entité consolidée");
        expect(manifeste).not.toMatch(/conserver cette archive pendant/i);
    });
    it('nomme la colonne binaire sortie à côté des CSV', () => {
        const deplie = manifeste.replace(/\s+/g, ' ');
        expect(deplie).toContain("Les colonnes binaires du schéma n'entrent pas dans le CSV · chaque pièce sort À CÔTÉ, un fichier par pièce, sous son identifiant");
        expect(deplie).toContain("Le fichier de chaque export des écritures (`ExportEcritures.contenu`) sort de même dans `exports-ecritures/` · il porte les écritures TELLES QU'ELLES ÉTAIENT à leur envoi");
        expect(deplie).toContain("Le fichier de chaque impression différée prête (`ImpressionDifferee.contenu`) sort dans `impressions-differees/`");
        const binaires = client_1.Prisma.dmmf.datamodel.models.flatMap((m) => m.fields.filter((f) => f.type === 'Bytes').map((f) => `${m.name}.${f.name}`));
        expect(binaires.sort()).toEqual(tables_restitution_1.TABLES_DE_PIECES.map((t) => `${t.modele}.contenu`).sort());
        for (const t of tables_restitution_1.TABLES_DE_PIECES)
            expect(deplie).toContain(`\`${t.modele}.contenu\``);
    });
    it('nomme les tables dont le journal d’audit ne garde aucune trace', () => {
        expect(manifeste).toContain(`- VentilationAnalytique · ${champs_audites_1.NON_AUDITES_MOTIVES.VentilationAnalytique}`);
        expect(manifeste).toContain(`- LigneEcriture · ${champs_audites_1.NON_AUDITES_MOTIVES.LigneEcriture}`);
    });
    it('présente le format et le rôle comme des décisions, pas comme du droit', () => {
        const deplie = manifeste.replace(/\s+/g, ' ');
        expect(deplie).toContain("Décisions d'OmegaX, et non règles de droit");
        expect(deplie).toContain("Aucun texte lu n'impose la restitution d'un dossier complet");
    });
});
describe('les documents attachés aux tiers (point 21)', () => {
    it('le CSV ne porte jamais la colonne binaire, mais garde l’empreinte qui relie le fichier', () => {
        const colonnes = (0, tables_restitution_1.colonnesDuModele)('DocumentTiers');
        expect(colonnes).not.toContain('contenu');
        expect(colonnes).toEqual(expect.arrayContaining(['id', 'nomFichier', 'empreinte', 'taille']));
    });
    it('chaque pièce sort à côté, sous son identifiant, lue dans le dossier seul', async () => {
        const { client } = prismaFactice({
            DocumentTiers: [{ id: 'doc-1', tenantId: DOSSIER, nomFichier: 'statuts.pdf' }],
        });
        const lus = [];
        client.documentTiers.findFirst = async ({ where }) => {
            lus.push(where);
            return { contenu: Buffer.from('CONTENU-DE-LA-PIECE') };
        };
        const service = new restitution_service_1.RestitutionService(client);
        const { flux, buffer } = collecteur();
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        expect(buffer().toString('latin1')).toContain((0, tables_restitution_1.fichierDuDocument)('doc-1', 'statuts.pdf'));
        expect(lus).toEqual([{ id: 'doc-1', tenantId: DOSSIER }]);
    });
    it('les fichiers des exports des écritures et des impressions prêtes sortent à côté, lus dans le dossier seul (m7)', async () => {
        const { client } = prismaFactice({
            ExportEcritures: [{ id: 'exp-1', tenantId: DOSSIER, nomFichier: 'ecritures-export-0001.xlsx' }],
            ImpressionDifferee: [{ id: 'imp-1', tenantId: DOSSIER, nomFichier: 'journal.xlsx' }],
        });
        const lus = [];
        client.exportEcritures.findFirst = async ({ where }) => {
            lus.push(where);
            return { contenu: Buffer.from('ENVOI-1') };
        };
        client.impressionDifferee.findFirst = async ({ where }) => {
            lus.push(where);
            return { contenu: Buffer.from('JOURNAL-IMPRIME') };
        };
        const service = new restitution_service_1.RestitutionService(client);
        const { flux, buffer } = collecteur();
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        const zip = buffer().toString('latin1');
        expect(zip).toContain((0, tables_restitution_1.fichierDeLExport)('exp-1', 'ecritures-export-0001.xlsx'));
        expect(zip).toContain((0, tables_restitution_1.fichierDeLImpression)('imp-1', 'journal.xlsx'));
        expect(lus).toEqual([
            { id: 'exp-1', tenantId: DOSSIER },
            { id: 'imp-1', tenantId: DOSSIER },
        ]);
    });
    it('un nom qui porte un séparateur ne crée pas de sous-dossier dans l’archive', () => {
        expect((0, tables_restitution_1.fichierDuDocument)('x', 'a/b\\c.pdf')).toBe('documents-tiers/x-a_b_c.pdf');
    });
    it('une pièce illisible ne fait pas tomber l’archive · elle est nommée dans controles.txt', async () => {
        const { client } = prismaFactice({
            DocumentTiers: [
                { id: 'doc-1', tenantId: DOSSIER, nomFichier: 'statuts.pdf' },
                { id: 'doc-2', tenantId: DOSSIER, nomFichier: 'rccm.pdf' },
            ],
        });
        client.documentTiers.findFirst = async ({ where }) => {
            if (where.id === 'doc-1')
                throw new Error('délai dépassé');
            return null;
        };
        const service = new restitution_service_1.RestitutionService(client);
        const { flux } = collecteur();
        const texte = [];
        const controles = service.controles.bind(service);
        service.controles = async function* (...a) {
            for await (const x of controles(...a)) {
                texte.push(x);
                yield x;
            }
        };
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        const lu = texte.join('');
        expect(lu).toContain('2 annoncé(s), 0 écrit(s)');
        expect(lu).toContain('PIECE NON RESTITUEE;documents-tiers;doc-1 · illisible (délai dépassé)');
        expect(lu).toContain("PIECE NON RESTITUEE;documents-tiers;doc-2 · retirée pendant l'extraction");
    });
    it('l’inventaire des pièces est BORNÉ · décompte, lots de LOT_PIECES, tout écrit (second tour sage-l6, mineur 3)', async () => {
        const nombre = restitution_service_1.LOT_PIECES + 3;
        const docs = Array.from({ length: nombre }, (_, i) => ({ id: `doc-${String(i).padStart(4, '0')}`, tenantId: DOSSIER, nomFichier: `p${i}.pdf` }));
        const { client, filtres } = prismaFactice({ DocumentTiers: docs });
        client.documentTiers.findFirst = async () => ({ contenu: Buffer.from('X') });
        const service = new restitution_service_1.RestitutionService(client);
        const { flux, buffer } = collecteur();
        const texte = [];
        const controles = service.controles.bind(service);
        service.controles = async function* (...a) {
            for await (const x of controles(...a)) {
                texte.push(x);
                yield x;
            }
        };
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        const lectures = filtres.filter((f) => f.modele === 'DocumentTiers' && f.take === restitution_service_1.LOT_PIECES);
        expect(lectures.map((f) => f.where.id?.gt ?? null)).toEqual([null, docs[restitution_service_1.LOT_PIECES - 1].id]);
        expect(lectures.every((f) => f.cursor === undefined)).toBe(true);
        expect(texte.join('')).toContain(`${nombre} annoncé(s), ${nombre} écrit(s)`);
        expect(buffer().toString('latin1')).toContain(`doc-${String(nombre - 1).padStart(4, '0')}-p${nombre - 1}.pdf`);
    });
    it('la pièce-curseur retirée entre deux lots n’ampute pas la suite (relecture sage-l6)', async () => {
        const nombre = restitution_service_1.LOT_PIECES + 3;
        const docs = Array.from({ length: nombre }, (_, i) => ({ id: `doc-${String(i).padStart(4, '0')}`, tenantId: DOSSIER, nomFichier: `p${i}.pdf` }));
        const { client } = prismaFactice({ DocumentTiers: docs });
        const curseur = docs[restitution_service_1.LOT_PIECES - 1].id;
        client.documentTiers.findFirst = async ({ where }) => {
            if (where.id === curseur) {
                docs.splice(restitution_service_1.LOT_PIECES - 1, 1);
                return null;
            }
            return { contenu: Buffer.from('X') };
        };
        const service = new restitution_service_1.RestitutionService(client);
        const { flux, buffer } = collecteur();
        const texte = [];
        const controles = service.controles.bind(service);
        service.controles = async function* (...a) {
            for await (const x of controles(...a)) {
                texte.push(x);
                yield x;
            }
        };
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        const archive = buffer().toString('latin1');
        for (const i of [nombre - 3, nombre - 2, nombre - 1]) {
            expect(archive).toContain(`doc-${String(i).padStart(4, '0')}-p${i}.pdf`);
        }
        expect(texte.join('')).toContain(`PIECE NON RESTITUEE;documents-tiers;${curseur} · retirée pendant l'extraction`);
    });
    it('un inventaire de pièces illisible arrête l’archive, comme une table (F96)', async () => {
        const { client } = prismaFactice({ DocumentTiers: [{ id: 'doc-1', tenantId: DOSSIER, nomFichier: 'a.pdf' }] });
        client.documentTiers.findMany = async () => Promise.reject(new Error('connexion perdue'));
        const service = new restitution_service_1.RestitutionService(client);
        const { flux } = collecteur();
        flux.on('error', () => undefined);
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        expect(flux.destroyed).toBe(true);
        expect(flux.errored?.message).toBe('pièces non lues · connexion perdue');
    });
    it('une pièce retirée entre le décompte et la lecture est dite au contrôle', async () => {
        const { client } = prismaFactice({ DocumentTiers: [{ id: 'doc-1', tenantId: DOSSIER, nomFichier: 'a.pdf' }] });
        client.documentTiers.count = async () => 2;
        client.documentTiers.findFirst = async () => ({ contenu: Buffer.from('X') });
        const service = new restitution_service_1.RestitutionService(client);
        const { flux } = collecteur();
        const texte = [];
        const controles = service.controles.bind(service);
        service.controles = async function* (...a) {
            for await (const x of controles(...a)) {
                texte.push(x);
                yield x;
            }
        };
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        expect(texte.join('')).toContain('2 annoncé(s), 1 écrit(s)');
        expect(texte.join('')).toContain('PIECE NON RESTITUEE;documents-tiers;1 pièce(s) · retirée(s) entre le décompte et la lecture');
    });
    it('une pièce jointe non restituée nomme son dossier dans l’archive (relecture sage-l6, mineur 7)', async () => {
        const { client } = prismaFactice({
            PieceJointeSalarie: [{ id: 'pj-1', tenantId: DOSSIER, nomFichier: 'contrat.pdf' }],
        });
        client.pieceJointeSalarie.findFirst = async () => null;
        const service = new restitution_service_1.RestitutionService(client);
        const { flux } = collecteur();
        const texte = [];
        const controles = service.controles.bind(service);
        service.controles = async function* (...a) {
            for await (const x of controles(...a)) {
                texte.push(x);
                yield x;
            }
        };
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        expect(texte.join('')).toContain("PIECE NON RESTITUEE;pieces-jointes/salaries;pj-1 · retirée pendant l'extraction");
    });
});
describe('la ligne du dossier (tables/tenant.csv)', () => {
    it('l’archive la contient', async () => {
        const { client } = prismaFactice();
        const service = new restitution_service_1.RestitutionService(client);
        const { flux, buffer } = collecteur();
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        expect(buffer().toString('latin1')).toContain('tables/tenant.csv');
    });
    it('porte toute colonne scalaire du schéma, hors la liste d’exclusion', async () => {
        const { client } = prismaFactice();
        const service = new restitution_service_1.RestitutionService(client);
        const compteur = { ecrites: 0 };
        let csv = '';
        for await (const bout of service.ligneDuDossierCsv(DOSSIER, compteur, relancer))
            csv += bout;
        const [entete, ligne, ...reste] = (0, lecture_fichier_1.analyserCsv)(csv, ';');
        const exclues = (0, champs_audites_1.colonnesNonRestituables)('Tenant');
        const scalaires = client_1.Prisma.dmmf.datamodel.models
            .find((m) => m.name === 'Tenant')
            .fields.filter((f) => (f.kind === 'scalar' && f.type !== 'Bytes') || f.kind === 'enum')
            .map((f) => f.name);
        const manquantes = scalaires.filter((c) => !entete.includes(c) && !exclues.has(c.toLowerCase()));
        expect(['colonnes manquantes', manquantes]).toEqual(['colonnes manquantes', []]);
        expect(['colonnes', entete]).toEqual(['colonnes', (0, tables_restitution_1.colonnesDuModele)('Tenant')]);
        expect(reste.filter((r) => r.some((c) => c !== ''))).toHaveLength(0);
        expect(ligne[entete.indexOf('numeroImpot')]).toBe('A1234567B');
        expect(ligne[entete.indexOf('doubleRegardValidation')]).toBe('true');
        expect(compteur.ecrites).toBe(1);
    });
    it('le contrôle de l’extraction la confronte comme les autres tables', async () => {
        const { client } = prismaFactice();
        const service = new restitution_service_1.RestitutionService(client);
        const { flux } = collecteur();
        const texte = [];
        const controles = service.controles.bind(service);
        service.controles = async function* (...a) {
            for await (const x of controles(...a)) {
                texte.push(x);
                yield x;
            }
        };
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        expect(texte.join('')).toContain('Tenant;1;1;conforme');
    });
    it('le contrôle attend que les tables soient écrites, même lentes', async () => {
        const { client } = prismaFactice({ Journal: [{ id: 'a', tenantId: DOSSIER, code: 'OD' }] });
        const lire = client.journal.findMany;
        client.journal.findMany = async (args) => {
            await new Promise((r) => setTimeout(r, 30));
            return lire(args);
        };
        const service = new restitution_service_1.RestitutionService(client);
        const { flux } = collecteur();
        const texte = [];
        const controles = service.controles.bind(service);
        service.controles = async function* (...a) {
            for await (const x of controles(...a)) {
                texte.push(x);
                yield x;
            }
        };
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        expect(texte.join('')).toContain('Journal;1;1;conforme');
        expect(texte.join('')).toContain('Aucun écart.');
    });
});
describe('une table illisible arrête l’archive sans arrêter le serveur', () => {
    it.each([
        ['Journal', (client) => (client.journal.findMany = async () => Promise.reject(new Error('connexion perdue')))],
        ['Tenant', (client) => {
                const lire = client.tenant.findUniqueOrThrow;
                let appels = 0;
                client.tenant.findUniqueOrThrow = async (a) => (++appels >= 2 ? Promise.reject(new Error('connexion perdue')) : lire(a));
            }],
    ])('%s · la sortie est détruite en nommant la table, et `produire` rend la main', async (table, casser) => {
        const { client } = prismaFactice();
        casser(client);
        const service = new restitution_service_1.RestitutionService(client);
        const { flux } = collecteur();
        flux.on('error', () => undefined);
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        expect(flux.destroyed).toBe(true);
        expect(flux.errored?.message).toBe(`table ${table} non lue · connexion perdue`);
    });
});
describe('les pièces jointes de la ligne sage-l6', () => {
    it('le CSV de chaque table ne porte jamais le binaire', () => {
        for (const modele of ['PieceJointeEcriture', 'PieceJointeSection', 'PieceJointeImmobilisation', 'PieceJointeSalarie']) {
            const colonnes = (0, tables_restitution_1.colonnesDuModele)(modele);
            expect([modele, colonnes.includes('contenu')]).toEqual([modele, false]);
            expect(colonnes).toEqual(expect.arrayContaining(['id', 'nomFichier', 'empreinte', 'taille']));
        }
    });
    it('chaque pièce sort dans le sous-dossier de son objet, lue par son identifiant et le dossier', async () => {
        const { client } = prismaFactice({
            PieceJointeEcriture: [{ id: 'pe-1', tenantId: DOSSIER, nomFichier: 'facture.pdf' }],
            PieceJointeSalarie: [{ id: 'ps-1', tenantId: DOSSIER, nomFichier: 'contrat.pdf' }],
        });
        const lus = [];
        for (const delegue of ['pieceJointeEcriture', 'pieceJointeSalarie']) {
            client[delegue].findFirst = async ({ where }) => {
                lus.push(where);
                return { contenu: Buffer.from('PIECE') };
            };
        }
        const service = new restitution_service_1.RestitutionService(client);
        const { flux, buffer } = collecteur();
        await service.produire(DOSSIER, { id: 'u-1', email: 'chef@asbl.cd', adresseIp: null }, flux);
        const archive = buffer().toString('latin1');
        expect(archive).toContain((0, tables_restitution_1.fichierDeLaPiece)('pieces-jointes/ecritures', 'pe-1', 'facture.pdf'));
        expect(archive).toContain((0, tables_restitution_1.fichierDeLaPiece)('pieces-jointes/salaries', 'ps-1', 'contrat.pdf'));
        expect(lus).toEqual([
            { id: 'pe-1', tenantId: DOSSIER },
            { id: 'ps-1', tenantId: DOSSIER },
        ]);
    });
});
//# sourceMappingURL=restitution.spec.js.map