"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const etats_financiers_projet_budget_service_1 = require("../etats-financiers/etats-financiers-projet-budget.service");
const etats_financiers_service_1 = require("../etats-financiers/etats-financiers.service");
const note_annexe_service_1 = require("./note-annexe.service");
const correspondance_notes_associations_1 = require("./correspondance-notes-associations");
const correspondance_notes_projets_1 = require("./correspondance-notes-projets");
const effectifs_seize_colonnes_1 = require("./effectifs-seize-colonnes");
const note_annexe_controller_1 = require("./note-annexe.controller");
const saisie_note_dto_1 = require("./dto/saisie-note.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const ExcelJS = require("exceljs");
const export_service_1 = require("../exports/export.service");
const prisma_retry_util_1 = require("../../common/prisma-retry.util");
function serviceAvec(saisies) {
    const ecriture = {
        balance: jest.fn(() => Promise.resolve({ lignes: [], totaux: { debit: 0, credit: 0 } })),
        virementsDeMiseEnService: jest.fn().mockResolvedValue(new Map()),
        mouvementsDeCoutsEmpruntIncorpores: jest.fn().mockResolvedValue(new Map()),
        ouverturePasseeAuPremierJour: jest.fn().mockResolvedValue(null),
        positionDOuvertureAuPremierJour: jest.fn().mockResolvedValue({ etat: 'AUCUNE' }),
        mouvementsDeReevaluation: jest.fn().mockResolvedValue(new Map()),
    };
    const exercice = {
        lister: jest.fn().mockResolvedValue([{ id: 'e1', dateDebut: new Date('2026-01-01T00:00:00Z') }]),
    };
    const prisma = {
        rattachementNote: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        provisionRisqueCharge: { findMany: jest.fn().mockResolvedValue([]) },
        saisieNote: { findMany: jest.fn().mockResolvedValue(saisies) },
        exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', dateFin: new Date('2026-12-31T00:00:00Z') }) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
    };
    const budget = {
        executionBudgetaire: jest.fn().mockRejectedValue(new etats_financiers_projet_budget_service_1.AucunPlanABudgetsException('aucun plan à budgets')),
    };
    return new note_annexe_service_1.NoteAnnexeService(ecriture, exercice, prisma, budget, new etats_financiers_service_1.EtatsFinanciersService(ecriture, exercice));
}
describe('Notes 20B et 29B · personnel propre à seize colonnes', () => {
    it.each([
        ['29B', correspondance_notes_associations_1.NOTES_ASSOCIATIONS],
        ['20B', correspondance_notes_projets_1.NOTES_PROJETS],
    ])('%s · seize colonnes dans l’ordre du texte, le personnel extérieur garde sa colonne unique', (code, notes) => {
        const propre = notes.find((n) => n.code === code && n.sousTableau === 'PERSONNEL PROPRE');
        expect(propre.colonnes.map((c) => c.libelle)).toEqual([
            'EFFECTIFS · Nationaux · M',
            'EFFECTIFS · Nationaux · F',
            'EFFECTIFS · Autres Etats de la Région · M',
            'EFFECTIFS · Autres Etats de la Région · F',
            'EFFECTIFS · Hors Région · M',
            'EFFECTIFS · Hors Région · F',
            'EFFECTIFS · Total · M',
            'EFFECTIFS · Total · F',
            'MASSE SALARIALE · Nationaux · M',
            'MASSE SALARIALE · Nationaux · F',
            'MASSE SALARIALE · Autres Etats de la Région · M',
            'MASSE SALARIALE · Autres Etats de la Région · F',
            'MASSE SALARIALE · Hors Région · M',
            'MASSE SALARIALE · Hors Région · F',
            'MASSE SALARIALE · Total · M',
            'MASSE SALARIALE · Total · F',
        ]);
        expect(propre.colonnes.every((c) => c.type === 'LIBRE')).toBe(true);
        const exterieur = notes.find((n) => n.code === code && n.sousTableau === 'PERSONNEL EXTERIEUR ET BENEVOLE');
        expect(exterieur.colonnes.map((c) => c.libelle)).toEqual(["Facturation à l'entité"]);
    });
    it('la migration porte l’ancien rang k au rang 100 + k, sur les seules rubriques du personnel propre, sans rien supprimer', () => {
        const sql = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../../../prisma/migrations/20270149000000_effectifs_seize_colonnes/migration.sql'), 'utf8');
        expect(effectifs_seize_colonnes_1.RANG_FORMAT_ANTERIEUR).toBe(100);
        expect(sql).toContain('SET "colonne" = "colonne" + 100');
        expect(sql).toContain(`"jeu" = 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' AND "codeNote" = '29B'`);
        expect(sql).toContain(`"jeu" = 'PROJETS_DEVELOPPEMENT' AND "codeNote" = '20B'`);
        const instructions = sql
            .split('\n')
            .filter((l) => !l.trim().startsWith('--'))
            .join('\n')
            .split(';')
            .map((x) => x.trim())
            .filter((x) => x !== '');
        expect(instructions).toHaveLength(1);
        expect(instructions[0].startsWith('UPDATE "saisies_notes"')).toBe(true);
        const cles = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL PROPRE').rubriques.map((r) => r.cle);
        const liste = /"cleRubrique" IN \(([^)]*)\)/.exec(instructions[0])[1];
        const visees = [...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]);
        expect(visees).toEqual(cles);
        expect(correspondance_notes_projets_1.NOTES_PROJETS.find((n) => n.code === '20B' && n.sousTableau === 'PERSONNEL PROPRE').rubriques.map((r) => r.cle)).toEqual(cles);
    });
    it('une saisie ancienne n’est JAMAIS scindée · aucune cellule ne la lit, la note la montre à part', async () => {
        const ecriture = {
            balance: jest.fn(() => Promise.resolve({ lignes: [], totaux: { debit: 0, credit: 0 } })),
            virementsDeMiseEnService: jest.fn().mockResolvedValue(new Map()),
            mouvementsDeCoutsEmpruntIncorpores: jest.fn().mockResolvedValue(new Map()),
            ouverturePasseeAuPremierJour: jest.fn().mockResolvedValue(null),
            positionDOuvertureAuPremierJour: jest.fn().mockResolvedValue({ etat: 'AUCUNE' }),
            mouvementsDeReevaluation: jest.fn().mockResolvedValue(new Map()),
        };
        const exercice = {
            lister: jest.fn().mockResolvedValue([{ id: 'e1', dateDebut: new Date('2026-01-01T00:00:00Z') }]),
        };
        const prisma = {
            rattachementNote: { findMany: jest.fn().mockResolvedValue([]) },
            depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
            provisionRisqueCharge: { findMany: jest.fn().mockResolvedValue([]) },
            saisieNote: {
                findMany: jest.fn().mockResolvedValue([
                    { codeNote: '29B', cleRubrique: 'ya-1-cadres-superieurs', colonne: 100, valeurTexte: '3 / 2', valeurNombre: null },
                    { codeNote: '29B', cleRubrique: 'yb-2-techniciens-superieurs-et-cadres-moyens', colonne: 1, valeurTexte: '4', valeurNombre: null },
                ]),
            },
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', dateFin: new Date('2026-12-31T00:00:00Z') }) },
            ecriture: { findMany: jest.fn().mockResolvedValue([]) },
            ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        };
        const budget = {
            executionBudgetaire: jest.fn().mockRejectedValue(new etats_financiers_projet_budget_service_1.AucunPlanABudgetsException('aucun plan à budgets')),
        };
        const service = new note_annexe_service_1.NoteAnnexeService(ecriture, exercice, prisma, budget, new etats_financiers_service_1.EtatsFinanciersService(ecriture, exercice));
        const { notes } = await service.notesAssociations('t', 'e1');
        const propre = notes.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL PROPRE');
        const ya = propre.lignes.find((l) => l.cle === 'ya-1-cadres-superieurs');
        expect(ya.saisie).toHaveLength(16);
        expect(ya.saisie.every((v) => v === null)).toBe(true);
        expect(propre.lignes.find((l) => l.cle === 'yb-2-techniciens-superieurs-et-cadres-moyens').saisie[1]).toBe('4');
        expect(propre.saisiesFormatAnterieur).toEqual([
            {
                cleRubrique: 'ya-1-cadres-superieurs',
                rubrique: 'YA. 1. Cadres supérieurs',
                colonneAnterieure: 'EFFECTIFS · Nationaux (M / F)',
                nature: 'EFFECTIF',
                valeur: '3 / 2',
            },
        ]);
        expect(propre.applicable).toBe(true);
        const exterieur = notes.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL EXTERIEUR ET BENEVOLE');
        expect(exterieur.saisiesFormatAnterieur).toBeUndefined();
    });
    it('sans saisie au format antérieur, la note vide n’est plus forcée applicable', async () => {
        const { notes } = await serviceAvec([]).notesAssociations('t', 'e1');
        const propre = notes.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL PROPRE');
        expect(propre.saisiesFormatAnterieur).toBeUndefined();
        expect(propre.applicable).toBe(false);
    });
    it('une ligne gardée dont la rubrique n’existe plus est NOMMÉE par sa clé, jamais tue', async () => {
        const { notes } = await serviceAvec([
            { codeNote: '29B', cleRubrique: 'rubrique-disparue', colonne: 104, valeurTexte: '1 500 000', valeurNombre: null },
        ]).notesAssociations('t', 'e1');
        const propre = notes.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL PROPRE');
        expect(propre.saisiesFormatAnterieur).toEqual([
            {
                cleRubrique: 'rubrique-disparue',
                rubrique: 'Rubrique inconnue · rubrique-disparue',
                colonneAnterieure: 'MASSE SALARIALE · Nationaux (M / F)',
                nature: 'MASSE_SALARIALE',
                valeur: '1 500 000',
            },
        ]);
    });
});
describe('Retirer la saisie au format antérieur (notes 20B et 29B)', () => {
    function prismaRetrait(lignes) {
        const appels = [];
        const tx = {
            saisieNote: {
                update: jest.fn().mockImplementation(({ where, data }) => {
                    appels.push(`update ${where.id} ${data.motifRetrait}`);
                    return Promise.resolve({});
                }),
                delete: jest.fn().mockImplementation(({ where }) => {
                    appels.push(`delete ${where.id}`);
                    return Promise.resolve({});
                }),
                deleteMany: jest.fn(),
            },
        };
        const prisma = {
            tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: 'SYCEBNL' }) },
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', statut: 'CLOTURE' }) },
            saisieNote: { findMany: jest.fn().mockResolvedValue(lignes) },
            $transaction: jest.fn().mockImplementation((fn, _options) => fn(tx)),
        };
        const service = new note_annexe_service_1.NoteAnnexeService({}, {}, prisma, {}, {});
        return { service, prisma, tx, appels };
    }
    it('motif écrit par une mise à jour unitaire PUIS suppression par identifiant, dans une transaction · exercice clos compris', async () => {
        const { service, prisma, tx, appels } = prismaRetrait([{ id: 's1' }, { id: 's2' }]);
        const r = await service.retirerSaisieFormatAnterieur('t', 'u', 'e1', 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', '29B', '  Reporté dans les seize colonnes  ');
        expect(r).toEqual({ retirees: 2 });
        expect(appels).toEqual([
            'update s1 Reporté dans les seize colonnes',
            'delete s1',
            'update s2 Reporté dans les seize colonnes',
            'delete s2',
        ]);
        expect(tx.saisieNote.deleteMany).not.toHaveBeenCalled();
        expect(prisma.$transaction.mock.calls[0][1]).toEqual({ maxWait: 10_000, timeout: (0, prisma_retry_util_1.delaiSelonVolume)(4) });
        expect(prisma.saisieNote.findMany.mock.calls[0][0].where).toEqual({
            tenantId: 't',
            exerciceId: 'e1',
            jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS',
            codeNote: '29B',
            colonne: { gte: effectifs_seize_colonnes_1.RANG_FORMAT_ANTERIEUR },
        });
    });
    it('refus nommés · motif trop court, note qui n’en porte pas, plus rien à retirer', async () => {
        const { service } = prismaRetrait([{ id: 's1' }]);
        await expect(service.retirerSaisieFormatAnterieur('t', 'u', 'e1', 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', '29B', 'ok')).rejects.toThrow('de 3 à 500 caractères');
        await expect(service.retirerSaisieFormatAnterieur('t', 'u', 'e1', 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', '13', 'Motif valable')).rejects.toThrow('seules les notes 20B');
        const vide = prismaRetrait([]);
        await expect(vide.service.retirerSaisieFormatAnterieur('t', 'u', 'e1', 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', '29B', 'Motif valable')).rejects.toThrow('ne porte plus de saisie au format antérieur');
    });
    it('la route porte les mêmes rôles que la saisie des notes', () => {
        const roles = (m) => Reflect.getMetadata(roles_decorator_1.ROLES_KEY, note_annexe_controller_1.NoteAnnexeController.prototype[m]);
        expect(roles('retirerFormatAnterieur')).toEqual(roles('saisir'));
        expect(roles('saisir')).toBeDefined();
    });
    it('le DTO exige un motif de 3 à 500 caractères, et le rang de ligne n’accepte jamais null', async () => {
        const proprietes = async (cls, o) => (await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(cls, o))).map((e) => [e.property, Object.values(e.constraints ?? {})[0]]);
        const base = { exerciceId: '7c1c7b3e-0a6b-4a7e-9c1e-1d2f3a4b5c6d', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', codeNote: '29B' };
        expect((await proprietes(saisie_note_dto_1.RetirerFormatAnterieurDto, { ...base, motif: 'ab' })).map((x) => x[0])).toEqual(['motif']);
        expect(await proprietes(saisie_note_dto_1.RetirerFormatAnterieurDto, { ...base, motif: 'Valeurs reportées' })).toEqual([]);
        const saisie = { ...base, cleRubrique: 'ya-1-cadres-superieurs', colonne: 0, valeur: 'x' };
        const refus = await proprietes(saisie_note_dto_1.SaisirNoteDto, { ...saisie, rang: null });
        expect(refus).toEqual([
            ['rang', 'Le rang de ligne se donne par un entier à partir de 0, ou s’omet pour la ligne unique · jamais null.'],
        ]);
        expect(await proprietes(saisie_note_dto_1.SaisirNoteDto, saisie)).toEqual([]);
        expect(await proprietes(saisie_note_dto_1.SaisirNoteDto, { ...saisie, rang: 2 })).toEqual([]);
    });
});
describe('Saisie au format antérieur · rendue telle qu’elle a été saisie', () => {
    const ANCIENNES = [
        { codeNote: '29B', cleRubrique: 'ya-1-cadres-superieurs', colonne: 104, valeurTexte: '150.000', valeurNombre: null },
        { codeNote: '29B', cleRubrique: 'yb-2-techniciens-superieurs-et-cadres-moyens', colonne: 104, valeurTexte: '1.500', valeurNombre: null },
    ];
    it('le service sert le texte saisi, jamais un nombre relu', async () => {
        const { notes } = await serviceAvec(ANCIENNES).notesAssociations('t', 'e1');
        const propre = notes.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL PROPRE');
        expect(propre.saisiesFormatAnterieur.map((g) => [g.nature, g.valeur])).toEqual([
            ['MASSE_SALARIALE', '150.000'],
            ['MASSE_SALARIALE', '1.500'],
        ]);
    });
    it('le classeur des notes l’écrit tel quel · « 150.000 » et « 1.500 », jamais « 150,00 » ni « 1,50 »', async () => {
        const prisma = {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', nom: 'ASBL ESSAI', ville: 'Kinshasa', pays: 'RD Congo' }) },
            exercice: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'e1',
                    tenantId: 't',
                    dateDebut: new Date('2026-01-01T00:00:00Z'),
                    dateFin: new Date('2026-12-31T00:00:00Z'),
                    dateArreteComptes: null,
                }),
            },
        };
        const vide = {};
        const exports = new export_service_1.ExportService(prisma, vide, vide, vide, vide, vide, serviceAvec(ANCIENNES), vide, vide, vide);
        const { buffer } = await exports.notesAssociationsExcel('t', 'e1');
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const feuille = wb.worksheets.find((w) => /^NOTE 29B/.test(w.name));
        const textes = [];
        feuille.eachRow((row) => row.eachCell((c) => textes.push(String(c.value ?? ''))));
        const mention = textes.find((t) => t.includes('Saisie antérieure au format à huit colonnes'));
        expect(mention).toContain('MASSE SALARIALE · Nationaux (M / F) · 150.000');
        expect(mention).toContain('MASSE SALARIALE · Nationaux (M / F) · 1.500');
        expect(mention).not.toMatch(/150,00|1,50\b/);
    });
});
//# sourceMappingURL=effectifs-seize-colonnes.spec.js.map