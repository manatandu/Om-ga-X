"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const ExcelJS = require("exceljs");
const client_1 = require("@prisma/client");
const livre_inventaire_service_1 = require("../documents-obligatoires/livre-inventaire.service");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const export_service_1 = require("./export.service");
const export_controller_1 = require("./export.controller");
const correspondance_inventaire_1 = require("../documents-obligatoires/correspondance-inventaire");
const correspondance_inventaire_syscohada_1 = require("../documents-obligatoires/correspondance-inventaire-syscohada");
const RAPPORT = {
    etabliLe: new Date('2027-03-15'),
    situationExerciceEcoule: 'Exercice de consolidation après reprise du portefeuille.',
    perspectivesDeveloppement: 'Ouverture d’une agence à Lubumbashi.',
    evolutionTresorerie: 'Trésorerie nette positive, en progression.',
    declarationDirigeants: null,
};
function service(referentiel, forme, rapport = RAPPORT, dossier = {}, conformiteGestion = {}) {
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel, formeJuridiqueSyscohada: forme, ...dossier }) },
        exercice: {
            findFirst: jest.fn().mockResolvedValue({ dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }),
        },
    };
    const rapportActivite = {
        courant: jest.fn().mockResolvedValue(rapport),
        conformite: jest.fn().mockResolvedValue({
            fenetreEvenementsPosterieurs: null,
            tresorerie: null,
            declarationRegistreDonateurs: { attendue: false, renseignee: false, registreConforme: true },
        }),
        conformiteRapportGestion: jest.fn().mockResolvedValue({
            fenetreEvenementsPosterieurs: null,
            tresorerie: null,
            ...conformiteGestion,
        }),
    };
    return new export_service_1.ExportService(prisma, {}, {}, {}, {}, {}, {}, {}, {}, rapportActivite);
}
async function feuilleDuRapport(referentiel, forme) {
    const { buffer } = await service(referentiel, forme).rapportActiviteExcel('t1', 'ex');
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(buffer);
    const feuille = classeur.worksheets[0];
    const titres = [];
    const exigences = [];
    feuille.eachRow((rang, i) => {
        if (i === 1)
            return;
        titres.push(String(rang.getCell(1).value ?? ''));
        exigences.push(String(rang.getCell(4).value ?? ''));
    });
    return { nom: feuille.name, titres, exigences: exigences.join(' ') };
}
describe('le rapport de gestion exporté lit SES sections', () => {
    it('le contenu vient de `sections`, jamais des colonnes du rapport SYCEBNL', async () => {
        const [premiere, seconde] = correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCGIE;
        const { buffer } = await service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, {
            ...RAPPORT,
            sections: { [premiere.cle]: 'Activité de la société au cours de l’exercice.' },
        }).rapportActiviteExcel('t1', 'ex');
        const classeur = new ExcelJS.Workbook();
        await classeur.xlsx.load(buffer);
        const lignes = {};
        classeur.worksheets[0].eachRow((r, i) => {
            if (i > 1)
                lignes[String(r.getCell(1).value)] = [String(r.getCell(2).value ?? ''), String(r.getCell(3).value ?? '')];
        });
        expect([lignes[premiere.titre], lignes[seconde.titre]]).toEqual([
            ['RENSEIGNÉE', 'Activité de la société au cours de l’exercice.'],
            ['VIDE', ''],
        ]);
    });
});
describe('le rapport exporté porte les sections de SON texte', () => {
    it('un dossier SYCEBNL reçoit les quatre sections de l’art. 16-3', async () => {
        const f = await feuilleDuRapport(client_1.Referentiel.SYCEBNL, null);
        expect(f.nom).toBe("Rapport d'activité");
        for (const s of correspondance_inventaire_1.SECTIONS_RAPPORT_ACTIVITE)
            expect(f.titres).toContain(s.titre);
        expect(f.exigences).not.toContain('AUSCGIE');
    });
    it('une société commerciale reçoit les SIX sections de l’AUSCGIE art. 138', async () => {
        const f = await feuilleDuRapport(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        expect(f.nom).toBe('Rapport de gestion');
        for (const s of correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCGIE)
            expect(f.titres).toContain(s.titre);
        expect(f.exigences).toContain('AUSCGIE art. 138');
        expect(f.exigences).not.toContain('art. 16-3');
    });
    it('les deux jeux n’ont pas le même nombre de sections · ce n’est pas un détail', () => {
        expect(correspondance_inventaire_1.SECTIONS_RAPPORT_ACTIVITE).toHaveLength(4);
        expect(correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCGIE).toHaveLength(6);
    });
    it('une forme juridique sans rapport dû n’en invente aucun', async () => {
        const f = await feuilleDuRapport(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.ENTREPRENANT);
        for (const s of correspondance_inventaire_syscohada_1.SECTIONS_RAPPORT_GESTION_AUSCGIE)
            expect(f.titres).not.toContain(s.titre);
        for (const s of correspondance_inventaire_1.SECTIONS_RAPPORT_ACTIVITE)
            expect(f.titres).not.toContain(s.titre);
    });
    it('la déclaration de l’art. 18 ne suit QUE le SYCEBNL', async () => {
        const sycebnl = await feuilleDuRapport(client_1.Referentiel.SYCEBNL, null);
        expect(sycebnl.titres.join(' ')).toContain('registre des donateurs');
        const syscohada = await feuilleDuRapport(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        expect(syscohada.titres.join(' ')).not.toContain('registre des donateurs');
    });
});
describe('le rapport de gestion exporté suit la forme de l’EXERCICE (AUSCGIE art. 182, 183 et 185)', () => {
    const titresDe = async (buffer) => {
        const classeur = new ExcelJS.Workbook();
        await classeur.xlsx.load(buffer);
        const titres = [];
        classeur.worksheets[0].eachRow((r, i) => {
            if (i > 1)
                titres.push(`${String(r.getCell(1).value ?? '')} ${String(r.getCell(3).value ?? '')}`);
        });
        return titres;
    };
    it('une SA devenue SARL après la clôture exporte les sections de la SA pour cet exercice', async () => {
        const sa = (0, correspondance_inventaire_syscohada_1.regleRapportGestion)(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        const sarl = (0, correspondance_inventaire_syscohada_1.regleRapportGestion)(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        if (sa.genre !== 'EXIGE' || sarl.genre !== 'EXIGE')
            throw new Error('règles attendues');
        const propreSa = sa.sections.find((x) => !sarl.sections.some((y) => y.cle === x.cle));
        const { buffer } = await service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, RAPPORT, {
            formeJuridiqueSyscohadaAnterieure: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
            dateTransformationForme: new Date('2027-05-15'),
        }).rapportActiviteExcel('t1', 'ex');
        expect((await titresDe(buffer)).some((t) => t.startsWith(propreSa.titre))).toBe(true);
    });
    it('l’exercice de la transformation porte la mention de l’art. 185', async () => {
        const mention = 'La société a changé de forme le 15/05/2026 · (AUSCGIE art. 185).';
        const { buffer } = await service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, RAPPORT, {}, {
            mentionTransformation: mention,
        }).rapportActiviteExcel('t1', 'ex');
        expect(await titresDe(buffer)).toContain(`Transformation de la société ${mention}`);
    });
});
describe('les portes des documents communs restent ouvertes aux deux', () => {
    const metadonnee = (methode) => Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, export_controller_1.ExportController.prototype[methode]);
    it('le livre d’inventaire et le rapport ne portent AUCUN cloisonnement', () => {
        expect(metadonnee('livreInventaire')).toBeUndefined();
        expect(metadonnee('rapportActivite')).toBeUndefined();
    });
    it('en revanche l’éligibilité au Système minimal RESTE cloisonnée', () => {
        expect(metadonnee('eligibiliteSmt')).toEqual([client_1.Referentiel.SYCEBNL]);
    });
});
describe('les documents exportés citent le texte du dossier', () => {
    async function lignesDu(buffer) {
        const classeur = new ExcelJS.Workbook();
        await classeur.xlsx.load(buffer);
        const lignes = [];
        classeur.worksheets[0].eachRow((r) => lignes.push(r.values.map((v) => String(v ?? '')).join(' | ')));
        return lignes.join('\n');
    }
    function exportLivre(referentiel, systeme) {
        const livre = {
            courante: jest.fn().mockResolvedValue(null),
            conformite: jest.fn().mockResolvedValue({
                exigence: 'exigence du texte',
                etatsExiges: [],
                resume: { renseigne: false, exigence: '', remarque: '' },
                fondement: (0, livre_inventaire_service_1.fondementInventaire)({
                    referentiel,
                    jeuEtatsFinanciersSycebnl: client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
                    systemeComptableSyscohada: systeme,
                }),
            }),
        };
        const prisma = {
            exercice: { findFirst: jest.fn().mockResolvedValue(null) },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ nom: 'Dossier', numeroImpot: 'A1', devise: 'CDF' }) },
        };
        return new export_service_1.ExportService(prisma, {}, {}, {}, {}, {}, {}, {}, livre, {}).livreInventaireExcel('t1', 'ex');
    }
    it('le livre d’une société cite l’AUDCIF art. 19 et sa sanction de l’art. 111', async () => {
        const texte = await lignesDu((await exportLivre(client_1.Referentiel.SYSCOHADA, client_1.SystemeComptableSyscohada.NORMAL)).buffer);
        expect(texte).toContain('Texte applicable | AUDCIF art. 19 | Système normal.');
        expect(texte).toContain('Sanction pénale : AUDCIF, art. 111');
    });
    it('le livre d’une association garde l’art. 14 et l’art. 24 du SYCEBNL', async () => {
        const texte = await lignesDu((await exportLivre(client_1.Referentiel.SYCEBNL, null)).buffer);
        expect(texte).toContain('Texte applicable | Art. 14, point 1 | Associations et ordres professionnels.');
        expect(texte).toContain('Sanction pénale : Acte uniforme SYCEBNL, art. 24');
    });
    it('la fenêtre des événements postérieurs d’une société cite l’AUSCGIE', async () => {
        const s = service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        s.rapportActivite.conformiteRapportGestion.mockResolvedValue({
            fenetreEvenementsPosterieurs: { du: new Date('2026-12-31'), au: new Date('2027-03-15'), article: 'AUSCGIE, article 138' },
            tresorerie: null,
        });
        const texte = await lignesDu((await s.rapportActiviteExcel('t1', 'ex')).buffer);
        expect(texte).toContain("c'est la date d'établissement qui la ferme (AUSCGIE, article 138).");
    });
});
//# sourceMappingURL=parite-documents-obligatoires.spec.js.map