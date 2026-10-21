"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const stream_1 = require("stream");
const ExcelJS = require("exceljs");
const exercice_requis_1 = require("../../common/exercice-requis");
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const export_service_1 = require("./export.service");
const export_controller_1 = require("./export.controller");
const classeur_en_flux_1 = require("./classeur-en-flux");
const EXERCICE = { id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const COMPTES = {
    c6: { id: 'c6', numero: '60410000', intitule: 'Achats' },
    c4: { id: 'c4', numero: '40100000', intitule: 'Fournisseurs' },
};
const ligne = (id, compte, debit, credit, statut) => ({
    id,
    compteId: compte,
    debit,
    credit,
    lettre: null,
    libelle: null,
    compte: COMPTES[compte],
    ecriture: { date: new Date('2026-03-01'), numeroPiece: 1, reference: null, libelle: 'Achat', statut, journal: { code: 'ACH' } },
});
const LIGNES = [
    ligne('l2', 'c4', 0, 100, 'VALIDEE'),
    ligne('l4', 'c4', 0, 50, 'BROUILLARD'),
    ligne('l1', 'c6', 100, 0, 'VALIDEE'),
    ligne('l3', 'c6', 50, 0, 'BROUILLARD'),
];
async function exporter(comptees = LIGNES.length) {
    const prisma = {
        ligneEcriture: {
            count: jest.fn().mockResolvedValue(comptees),
            groupBy: jest.fn().mockResolvedValue([
                { compteId: 'c6', _sum: { debit: 150, credit: 0 } },
                { compteId: 'c4', _sum: { debit: 0, credit: 150 } },
            ]),
            findMany: jest.fn(async ({ take, cursor, skip }) => {
                const rang = cursor ? LIGNES.findIndex((l) => l.id === cursor.id) : -1;
                if (cursor && rang < 0)
                    return [];
                const depart = cursor ? rang + (skip ?? 0) : 0;
                return LIGNES.slice(depart, depart + take);
            }),
        },
        compte: {
            findMany: jest.fn(async ({ where }) => Object.values(COMPTES).filter((c) => where.id.in.includes(c.id) && where.tenantId === 't1')),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ nom: 'Dossier', numeroImpot: 'A1', devise: 'CDF' }) },
        exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE), findUnique: jest.fn().mockResolvedValue(EXERCICE) },
    };
    const svc = new export_service_1.ExportService(prisma, {}, {}, {}, {}, {}, {}, {}, {}, {});
    const morceaux = [];
    const sortie = new stream_1.Writable({
        write(m, _e, cb) {
            morceaux.push(Buffer.from(m));
            cb();
        },
    });
    await svc.grandLivreCompletExcelEnFlux('t1', 'ex', () => sortie);
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(Buffer.concat(morceaux));
    return classeur;
}
function donnees(feuille) {
    const lignes = [];
    feuille.eachRow((r, n) => {
        if (n >= classeur_en_flux_1.PREMIERE_LIGNE_DONNEES)
            lignes.push(r.values.slice(1));
    });
    return lignes;
}
describe('F99 · le grand livre complet porte son sommaire et le statut de chaque ligne', () => {
    it('deux feuilles, le grand livre puis le sommaire', async () => {
        const classeur = await exporter();
        expect(classeur.worksheets.map((f) => f.name)).toEqual(['Grand livre', 'Sommaire']);
    });
    it('chaque ligne dit si elle est validée ou encore au brouillard', async () => {
        const [grandLivre] = (await exporter()).worksheets;
        const statuts = donnees(grandLivre).map((l) => l[l.length - 1]);
        expect(statuts).toEqual(['Validée', 'Brouillard', 'Validée', 'Brouillard']);
    });
    it('le sommaire rend une ligne par compte, dans l’ordre des numéros, et les totaux', async () => {
        const sommaire = (await exporter()).getWorksheet('Sommaire');
        expect(donnees(sommaire)).toEqual([
            ['40100000', 'Fournisseurs', 0, 150, -150],
            ['60410000', 'Achats', 150, 0, 150],
            [undefined, 'TOTAUX', 150, 150, 0],
        ]);
    });
});
describe('relecture « échecs silencieux » de sage-l7, M6 · le grand livre lu se confronte à son décompte', () => {
    it('des lignes lues en moins que comptées au départ · le livre est REFUSÉ, jamais remis amputé', async () => {
        await expect(exporter(LIGNES.length + 600)).rejects.toThrow(/Grand livre complet : 4 lignes lues sur 604 comptées au départ · .*n'est pas remis amputé/);
    });
});
describe('F100 · les exports du grand livre exigent l’exercice', () => {
    it.each(['grandLivreComplet', 'grandLivre'])('%s · le paramètre exerciceId passe par un ParseUUIDPipe', (methode) => {
        const args = Reflect.getMetadata(constants_1.ROUTE_ARGS_METADATA, export_controller_1.ExportController, methode);
        const exercice = Object.values(args).find((a) => a.data === 'exerciceId');
        expect(exercice?.pipes).toContain(exercice_requis_1.EXERCICE_REQUIS);
        expect(exercice_requis_1.EXERCICE_REQUIS.format).toBeInstanceOf(common_1.ParseUUIDPipe);
    });
});
//# sourceMappingURL=grand-livre-complet-en-flux.spec.js.map