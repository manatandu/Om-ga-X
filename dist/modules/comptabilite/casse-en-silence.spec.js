"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("./ecriture.service");
const exercice_service_1 = require("../exercice/exercice.service");
const numerotation_piece_1 = require("../journaux/numerotation-piece");
const journal_seed_1 = require("../journaux/journal-seed");
const import_service_1 = require("../import/import.service");
const import_dto_1 = require("../import/dto/import.dto");
const fs_1 = require("fs");
const path_1 = require("path");
const EXERCICE = {
    id: 'ex',
    dateDebut: new Date('2026-01-01'),
    dateFin: new Date('2026-12-31'),
    statut: 'OUVERT',
};
function serviceEcriture(detenteurs = {}, statut = 'BROUILLARD') {
    const compte = (id) => ({ id, numero: '60100000', intitule: 'Achats', typeCompte: 'DETAIL', tenantId: 't1' });
    const compteur = (modele) => jest.fn().mockResolvedValue(detenteurs[modele] ?? 0);
    const prisma = {
        exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE) },
        compte: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id.in.map(compte))),
            findFirst: jest.fn().mockResolvedValue({ ...compte('c2'), estActif: true }),
        },
        tauxTva: { findMany: jest.fn().mockResolvedValue([]) },
        ecriture: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'e1', statut, exercice: EXERCICE, exerciceId: 'ex', tenantId: 't1', lignes: [], journalId: 'j1',
                journal: { id: 'j1', code: 'OD' }, date: new Date('2026-03-04'), libelle: 'Pièce', correction: null,
                corrigeEcritureId: null, estGenereeParCloture: false, immobilisationsAcquisition: [],
                immobilisationSortie: null, dotationAmortissement: null,
            }),
            delete: jest.fn().mockResolvedValue({}),
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        pieceJointeEcriture: { count: jest.fn().mockResolvedValue(0) },
        $queryRaw: jest.fn().mockResolvedValue([]),
        ligneEcriture: {
            deleteMany: jest.fn().mockResolvedValue({}),
            findMany: jest.fn().mockResolvedValue([
                {
                    id: 'l1', ecritureId: 'e1', compteId: 'c1', compte: { numero: '60100000' }, debit: 100, credit: 0,
                    lettre: null, rapprochementId: null, tauxTvaId: null, ventilations: [],
                    ecriture: {
                        id: 'e1', statut, exerciceId: 'ex', journalId: 'j1', date: new Date('2026-03-04'),
                        estGenereeParCloture: false, exercice: EXERCICE, journal: { code: 'OD' },
                        immobilisationsAcquisition: [], immobilisationSortie: null, dotationAmortissement: null,
                    },
                },
            ]),
        },
        immobilisation: { count: compteur('immobilisation') },
        dotationAmortissement: { count: compteur('dotationAmortissement') },
        depreciationImmobilisation: { count: compteur('depreciationImmobilisation') },
        reclassementImmobilisation: { count: compteur('reclassementImmobilisation') },
        reevaluation: { count: compteur('reevaluation') },
        regularisation: { count: compteur('regularisation') },
        echeanceAbonnement: { count: compteur('echeanceAbonnement') },
        liquidationTva: { count: compteur('liquidationTva') },
        donation: { count: compteur('donation') },
        affectationResultat: { count: compteur('affectationResultat') },
        executionEngagement: { count: compteur('executionEngagement') },
        mouvementStock: { count: compteur('mouvementStock') },
        consignation: { count: compteur('consignation') },
        ecartInventaire: { count: compteur('ecartInventaire') },
        clotureLocationAcquisition: { count: compteur('clotureLocationAcquisition') },
        repriseSubventionImmobilisation: { count: compteur('repriseSubventionImmobilisation') },
        reductionSubventionImmobilisation: { count: compteur('reductionSubventionImmobilisation') },
        revisionPlanAmortissement: { count: compteur('revisionPlanAmortissement') },
        coutEmpruntIncorpore: { count: compteur('coutEmpruntIncorpore') },
        reevaluationBilan: { count: compteur('reevaluationBilan') },
        repriseProvisionReevaluation: { count: compteur('repriseProvisionReevaluation') },
        mouvementDemantelement: { count: compteur('mouvementDemantelement') },
        annulationTraitementImmobilisation: { count: compteur('annulationTraitementImmobilisation') },
        creanceDouteuse: { count: compteur('creanceDouteuse') },
        ajustementCreanceDouteuse: { count: compteur('ajustementCreanceDouteuse') },
        mouvementCreanceDouteuse: { count: compteur('mouvementCreanceDouteuse') },
        recuperationTvaCreance: { count: compteur('recuperationTvaCreance') },
        virementFonds: { count: compteur('virementFonds') },
        paiementSalaires: { count: compteur('paiementSalaires') },
        declarationDeviseANouveau: { count: compteur('declarationDeviseANouveau') },
        constatImpotResultat: { count: compteur('constatImpotResultat') },
        bulletinPaie: { count: compteur('bulletinPaie') },
        ligneOrdreVirement: { count: compteur('ligneOrdreVirement') },
        amortissementDerogatoire: { count: compteur('amortissementDerogatoire') },
        $transaction: jest.fn().mockImplementation((f) => f(prisma)),
    };
    const journalService = {
        trouver: jest.fn().mockResolvedValue({ id: 'j1', code: 'OD', estActif: true, numerotation: 'MANUELLE' }),
        prochainNumeroPiece: jest.fn().mockResolvedValue(null),
    };
    const exerciceService = { verifierEcritureAutorisee: jest.fn().mockResolvedValue(undefined) };
    const analytiqueService = { verifierVentilationObligatoire: jest.fn().mockResolvedValue(undefined) };
    return new ecriture_service_1.EcritureService(prisma, journalService, exerciceService, analytiqueService);
}
const ECRITURE = {
    exerciceId: 'ex',
    journalId: 'j1',
    date: '2026-03-04',
    libelle: 'Achat de fournitures',
    lignes: [
        { compteId: 'c1', debit: 100_000, credit: 0 },
        { compteId: 'c2', debit: 0, credit: 100_000 },
    ],
};
describe('1 · la date de l’écriture tombe dans son exercice', () => {
    it('refuse une date antérieure à l’ouverture · la faute de janvier', async () => {
        await expect(serviceEcriture().creer('t1', 'u1', { ...ECRITURE, date: '2025-12-31' })).rejects.toThrow(/sort de l'exercice/i);
    });
    it('refuse une date postérieure à la clôture', async () => {
        await expect(serviceEcriture().creer('t1', 'u1', { ...ECRITURE, date: '2027-01-02' })).rejects.toThrow(/sort de l'exercice/i);
    });
    it('relit l’exercice DANS la transaction · un arrêt passé entre la lecture et l’écriture refuse la date (constat 10)', async () => {
        const svc = serviceEcriture();
        const prisma = svc.prisma;
        const arrete = { ...EXERCICE, dateFin: new Date('2026-05-15') };
        let lectures = 0;
        prisma.exercice.findFirst.mockImplementation(() => Promise.resolve(lectures++ === 0 ? EXERCICE : arrete));
        await expect(svc.creer('t1', 'u1', { ...ECRITURE, date: '2026-07-01' })).rejects.toThrow(/sort de l'exercice/i);
        expect(lectures).toBeGreaterThan(1);
    });
    it('accepte une date dans l’exercice', async () => {
        const svc = serviceEcriture();
        await expect(svc.creer('t1', 'u1', ECRITURE)).rejects.not.toThrow(/sort de l'exercice/i);
    });
});
describe('2 · toute écriture reçoit le numéro que son journal impose', () => {
    const tx = (max) => ({
        ecriture: { aggregate: jest.fn().mockResolvedValue({ _max: { numeroPiece: max } }) },
    });
    it('MANUELLE ne numérote pas', async () => {
        const n = await (0, numerotation_piece_1.prochainNumeroPiece)(tx(7), 't1', { id: 'j1', numerotation: client_1.NumerotationPiece.MANUELLE }, 'ex', new Date());
        expect(n).toBeNull();
    });
    it('CONTINUE_JOURNAL prend la suite', async () => {
        const n = await (0, numerotation_piece_1.prochainNumeroPiece)(tx(12), 't1', { id: 'j1', numerotation: client_1.NumerotationPiece.CONTINUE_JOURNAL }, 'ex', new Date('2026-03-04'));
        expect(n).toBe(13);
    });
    it('un journal vierge commence à 1, pas à 0 ni à null', async () => {
        const n = await (0, numerotation_piece_1.prochainNumeroPiece)(tx(null), 't1', { id: 'j1', numerotation: client_1.NumerotationPiece.CONTINUE_FICHIER }, 'ex', new Date('2026-03-04'));
        expect(n).toBe(1);
    });
    it('la séquence du fichier ne compte que ses journaux, ceux que l’analyse relit (semis réel)', async () => {
        const t = tx(3);
        await (0, numerotation_piece_1.prochainNumeroPiece)(t, 't1', { id: 'j-od', numerotation: client_1.NumerotationPiece.CONTINUE_FICHIER }, 'ex', new Date());
        const where = t.ecriture.aggregate.mock.calls[0][0].where;
        const fichier = (0, numerotation_piece_1.journauxDeLaSequenceDuFichier)((0, journal_seed_1.journauxDefaut)(client_1.Referentiel.SYSCOHADA)).map((j) => j.code);
        expect({ filtre: where.journal, fichier }).toEqual({
            filtre: { numerotation: client_1.NumerotationPiece.CONTINUE_FICHIER, type: { not: 'SITUATION' } },
            fichier: ['OD'],
        });
    });
    it('le numéroteur d’un lot relit une fois par série, et chaque mois repart de son propre maximum', async () => {
        const t = tx(0);
        const numeroter = (0, numerotation_piece_1.numeroteurDeLot)(t, 't1', 'ex');
        const bq = { id: 'j-bq', numerotation: client_1.NumerotationPiece.MENSUELLE };
        const n = [
            await numeroter(bq, new Date('2026-03-02')),
            await numeroter(bq, new Date('2026-03-20')),
            await numeroter(bq, new Date('2026-04-01')),
        ];
        expect({ n, lectures: t.ecriture.aggregate.mock.calls.length }).toEqual({ n: [1, 2, 1], lectures: 2 });
    });
    it('les quatre chemins qui l’ignoraient l’appellent désormais', () => {
        const sansNumero = [];
        let appels = 0;
        const parcourir = (dossier) => {
            for (const entree of (0, fs_1.readdirSync)(dossier, { withFileTypes: true })) {
                const chemin = (0, path_1.join)(dossier, entree.name);
                if (entree.isDirectory())
                    parcourir(chemin);
                else if (entree.name.endsWith('.ts') && !entree.name.endsWith('.spec.ts')) {
                    const source = (0, fs_1.readFileSync)(chemin, 'utf-8');
                    for (const m of source.matchAll(/ecriture\.create(?:Many)?\(/g)) {
                        const ouvrante = (m.index ?? 0) + m[0].length - 1;
                        let profondeur = 0;
                        let fin = ouvrante;
                        for (let i = ouvrante; i < source.length; i++) {
                            if (source[i] === '(')
                                profondeur++;
                            else if (source[i] === ')' && --profondeur === 0) {
                                fin = i;
                                break;
                            }
                        }
                        appels++;
                        if (!source.slice(ouvrante, fin + 1).includes('numeroPiece')) {
                            sansNumero.push(`${(0, path_1.relative)(process.cwd(), chemin)}:${source.slice(0, ouvrante).split('\n').length}`);
                        }
                    }
                }
            }
        };
        parcourir((0, path_1.join)(__dirname, '../..'));
        expect(appels).toBeGreaterThanOrEqual(10);
        expect(sansNumero).toEqual([]);
    });
});
describe('3 · une écriture qu’un module tient ne se supprime pas', () => {
    it('refuse, et nomme le module', async () => {
        await expect(serviceEcriture({ affectationResultat: 1 }).supprimer('t1', 'e1')).rejects.toThrow(/affectation du résultat/i);
    });
    it('nomme les DEUX modules quand deux la tiennent', async () => {
        await expect(serviceEcriture({ donation: 1, liquidationTva: 1 }).supprimer('t1', 'e1')).rejects.toThrow(/liquidation de TVA et une donation/i);
    });
    it("refuse aussi quand l'écriture exécute un engagement de dépense", async () => {
        await expect(serviceEcriture({ executionEngagement: 1 }).supprimer('t1', 'e1')).rejects.toThrow(/engagement de dépense/i);
    });
    it("refuse aussi quand l'écriture porte un mouvement de magasin", async () => {
        await expect(serviceEcriture({ mouvementStock: 1 }).supprimer('t1', 'e1')).rejects.toThrow(/mouvement de magasin/i);
    });
    it("refuse aussi quand l'écriture ouvre ou dénoue une consignation", async () => {
        await expect(serviceEcriture({ consignation: 1 }).supprimer('t1', 'e1')).rejects.toThrow(/consignation d'emballages/i);
    });
    it("refuse aussi quand l'écriture redresse un écart d'inventaire", async () => {
        await expect(serviceEcriture({ ecartInventaire: 1 }).supprimer('t1', 'e1')).rejects.toThrow(/écart d'inventaire/i);
    });
    it("refuse aussi quand l'écriture passe la paie du mois", async () => {
        await expect(serviceEcriture({ bulletinPaie: 3 }).supprimer('t1', 'e1')).rejects.toThrow(/paie du mois/i);
    });
    it("refuse aussi quand l'écriture est exécutée par un ordre de virement", async () => {
        await expect(serviceEcriture({ ligneOrdreVirement: 1 }).supprimer('t1', 'e1')).rejects.toThrow(/ordre de virement/i);
    });
    it("refuse aussi quand l'écriture passe un amortissement dérogatoire", async () => {
        await expect(serviceEcriture({ amortissementDerogatoire: 1 }).supprimer('t1', 'e1')).rejects.toThrow(/dérogatoire/i);
    });
    it('laisse partir une écriture que personne ne tient', async () => {
        await expect(serviceEcriture().supprimer('t1', 'e1')).resolves.toEqual({ supprime: true, piecesDetachees: 0 });
    });
    it('les pièces jointes qu’elle détache sont comptées, leur description refaite, et le retour les dit', async () => {
        const s = serviceEcriture();
        const prisma = s.prisma;
        prisma.pieceJointeEcriture.count = jest.fn().mockResolvedValue(2);
        prisma.pieceJointeEcriture.findMany = jest.fn().mockResolvedValueOnce([{ id: 'pj-1' }, { id: 'pj-2' }]).mockResolvedValue([]);
        prisma.pieceJointeEcriture.update = jest.fn().mockResolvedValue({});
        prisma.ecriture.findFirst.mockResolvedValue({
            ...(await prisma.ecriture.findFirst()),
            numeroPiece: 9, estANouveauProvisoire: false,
        });
        await expect(s.supprimer('t1', 'e1')).resolves.toEqual({ supprime: true, piecesDetachees: 2 });
        expect(prisma.pieceJointeEcriture.count).toHaveBeenCalledWith({ where: { tenantId: 't1', ecritureId: 'e1' } });
        expect(prisma.pieceJointeEcriture.update).toHaveBeenCalledWith({
            where: { id: 'pj-1' },
            data: { ecritureDecrite: 'OD n° 9 du 04/03/2026 · Pièce' },
            select: { id: true, ecritureId: true, ecritureDecrite: true },
        });
        expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.pieceJointeEcriture.count.mock.invocationCallOrder[0]);
        expect(prisma.pieceJointeEcriture.update.mock.invocationCallOrder[1]).toBeLessThan(prisma.ecriture.deleteMany.mock.invocationCallOrder[0]);
    });
    it('m6 · la suppression ne retire que ce qui est ENCORE au brouillard, sinon 409 et rien ne part', async () => {
        const s = serviceEcriture();
        const prisma = s.prisma;
        await s.supprimer('t1', 'e1');
        expect(prisma.ecriture.deleteMany).toHaveBeenLastCalledWith({ where: { id: 'e1', tenantId: 't1', statut: 'BROUILLARD' } });
        expect(prisma.ligneEcriture.deleteMany).toHaveBeenLastCalledWith({ where: { ecritureId: 'e1', ecriture: { tenantId: 't1', statut: 'BROUILLARD' } } });
        expect(prisma.ecriture.delete).not.toHaveBeenCalled();
        prisma.ecriture.deleteMany.mockResolvedValue({ count: 0 });
        await expect(s.supprimer('t1', 'e1')).rejects.toBeInstanceOf(common_1.ConflictException);
        await expect(s.supprimer('t1', 'e1')).rejects.toThrow(/n'est plus au brouillard/);
    });
    it('A7 ter · le lettrage que le module défait dans `liberer` est toléré, et relu dans la transaction', async () => {
        const s = serviceEcriture({ mouvementCreanceDouteuse: 1 });
        const prisma = s.prisma;
        const tete = await prisma.ecriture.findFirst();
        prisma.ecriture.findFirst.mockResolvedValue({ ...tete, lignes: [{ lettre: 'A', lettrageId: 'g-A', rapprochementId: null }] });
        await expect(s.supprimer('t1', 'e1', { detenteur: 'une créance douteuse (perte ou recouvrement)', liberer: jest.fn() })).rejects.toThrow(/lettrée \(A\)/);
        prisma.ligneEcriture.findMany.mockResolvedValue([{ lettre: null, lettrageId: null }]);
        const liberer = jest.fn().mockResolvedValue(undefined);
        await expect(s.supprimer('t1', 'e1', { detenteur: 'une créance douteuse (perte ou recouvrement)', liberer, lettrageTolere: 'g-A' })).resolves.toEqual({ supprime: true, piecesDetachees: 0 });
        expect(liberer).toHaveBeenCalled();
        prisma.ligneEcriture.findMany.mockResolvedValue([{ lettre: 'B', lettrageId: 'g-B' }]);
        prisma.ecriture.deleteMany.mockClear();
        await expect(s.supprimer('t1', 'e1', { detenteur: 'une créance douteuse (perte ou recouvrement)', liberer, lettrageTolere: 'g-A' })).rejects.toThrow(/lettrée \(B\).*avant de supprimer/);
        expect(prisma.ecriture.deleteMany).not.toHaveBeenCalled();
    });
});
describe('3 bis · une écriture qu’un module tient ne se retouche pas non plus', () => {
    const DETENTEURS = [
        'immobilisation', 'dotationAmortissement', 'depreciationImmobilisation', 'reclassementImmobilisation', 'reevaluation', 'regularisation',
        'echeanceAbonnement', 'liquidationTva', 'donation', 'affectationResultat', 'executionEngagement',
        'mouvementStock', 'bulletinPaie', 'amortissementDerogatoire', 'ligneOrdreVirement', 'consignation',
        'ecartInventaire', 'clotureLocationAcquisition', 'repriseSubventionImmobilisation', 'reductionSubventionImmobilisation', 'revisionPlanAmortissement', 'coutEmpruntIncorpore', 'reevaluationBilan', 'repriseProvisionReevaluation', 'mouvementDemantelement', 'creanceDouteuse', 'ajustementCreanceDouteuse', 'mouvementCreanceDouteuse', 'recuperationTvaCreance', 'declarationDeviseANouveau', 'constatImpotResultat', 'virementFonds', 'paiementSalaires',
        'annulationTraitementImmobilisation',
    ];
    const gestes = [
        ['supprimer', 'BROUILLARD', (s) => s.supprimer('t1', 'e1')],
        ['modifier', 'BROUILLARD', (s) => s.modifier('t1', 'e1', { libelle: 'autre' })],
        ['réimputer au brouillard', 'BROUILLARD', (s) => s.reimputer('t1', 'u1', { ligneIds: ['l1'], compteCibleId: 'c2', motif: 'x' })],
        ['réimputer une ligne validée', 'VALIDEE', (s) => s.reimputer('t1', 'u1', { ligneIds: ['l1'], compteCibleId: 'c2', date: '2026-06-30', motif: 'x' })],
        ['corriger en négatif', 'VALIDEE', (s) => s.corrigerParInscriptionEnNegatif('t1', 'u1', 'e1', { motifCorrection: 'x', date: '2026-06-30' })],
    ];
    for (const [geste, statut, faire] of gestes) {
        it.each(DETENTEURS)(`${geste} · refuse quand %s tient l'écriture`, async (modele) => {
            await expect(faire(serviceEcriture({ [modele]: 1 }, statut))).rejects.toThrow(/contrepartie comptable de/);
        });
    }
});
describe('4 · une période n’est couverte que par un seul exercice', () => {
    const service = (existant) => new exercice_service_1.ExerciceService({
        exercice: {
            count: async () => (existant ? 1 : 0),
            findFirst: async () => existant,
            create: async (a) => a,
        },
        tenant: { findUnique: async () => ({ referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: null, dateDissolution: null }) },
    }, {});
    it('refuse un second exercice sur la même année civile', async () => {
        await expect(service({ dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }).creer('t1', {
            dateDebut: '2026-01-01',
            dateFin: '2026-12-31',
        })).rejects.toThrow(common_1.BadRequestException);
    });
    it('accepte l’exercice suivant, qui ne chevauche rien', async () => {
        await expect(service(null).creer('t1', { dateDebut: '2027-01-01', dateFin: '2027-12-31' })).resolves.toBeDefined();
    });
});
describe('5 · les imports passent par les contrôles d’entrée de la saisie', () => {
    const COMPTES_IMPORT = [
        { id: 'c52', numero: '52110000', typeCompte: 'DETAIL' },
        { id: 'c10', numero: '10110000', typeCompte: 'DETAIL' },
    ];
    function serviceImport(refus) {
        const creerEcriture = jest.fn().mockResolvedValue({ id: 'e-imp' });
        const tx = {
            compte: {
                createMany: jest.fn(),
                findMany: jest.fn().mockResolvedValue(COMPTES_IMPORT.map((c) => ({ id: c.id, numero: c.numero }))),
            },
            ecriture: { create: creerEcriture, findFirst: jest.fn().mockResolvedValue(null) },
        };
        const prisma = {
            tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't', longueurCompte: 8, referentiel: 'SYCEBNL' }) },
            exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE) },
            journal: {
                findMany: jest.fn().mockResolvedValue([{ id: 'j-od', code: 'OD', type: 'GENERAL', numerotation: 'MANUELLE' }]),
            },
            compte: { findMany: jest.fn().mockResolvedValue(COMPTES_IMPORT) },
            $transaction: jest.fn().mockImplementation((f) => f(tx)),
        };
        const controlesDEntree = jest.fn().mockImplementation(async () => {
            if (refus)
                throw refus;
            return {};
        });
        const svc = new import_service_1.ImportService(prisma, { controlesDEntree });
        return { svc, creerEcriture, controlesDEntree, tx };
    }
    const csv = (entete, lignes) => Buffer.from([entete, ...lignes].join('\n'), 'utf8').toString('base64');
    const BALANCE = csv('numero;intitule;debit;credit', ['52110000;Banque;500;0', '10110000;Dotation;0;500']);
    const MAPPING_BALANCE = { numero: 'numero', intitule: 'intitule', debit: 'debit', credit: 'credit' };
    it('une reprise de balance datée HORS de l’exercice est refusée, avant toute écriture', async () => {
        const { svc, creerEcriture, controlesDEntree } = serviceImport();
        await expect(svc.executer('t', 'u', {
            type: import_dto_1.TypeImport.BALANCE,
            nomFichier: 'b.csv',
            contenuBase64: BALANCE,
            mapping: MAPPING_BALANCE,
            dateOperation: '2025-12-31',
        })).rejects.toThrow(/sort de l'exercice/);
        expect(creerEcriture).not.toHaveBeenCalled();
        expect(controlesDEntree).not.toHaveBeenCalled();
    });
    it('une reprise de balance joue les contrôles de la saisie DANS la transaction, et un refus n’écrit rien', async () => {
        const refus = new common_1.BadRequestException('Le journal OD est en sommeil');
        const { svc, creerEcriture, controlesDEntree, tx } = serviceImport(refus);
        await expect(svc.executer('t', 'u', {
            type: import_dto_1.TypeImport.BALANCE,
            nomFichier: 'b.csv',
            contenuBase64: BALANCE,
            mapping: MAPPING_BALANCE,
            dateOperation: '2026-01-01',
        })).rejects.toThrow(/en sommeil/);
        expect(creerEcriture).not.toHaveBeenCalled();
        const [dossier, piece, client] = controlesDEntree.mock.calls[0];
        expect([dossier, piece.journalId, piece.lignes.length, client === tx]).toEqual(['t', 'j-od', 2, true]);
    });
    it('une pièce importée que la saisie refuserait est une anomalie nommée, et n’est pas créée', async () => {
        const refus = new common_1.BadRequestException('Période close jusqu’au 31/03/2026');
        const { svc, creerEcriture, controlesDEntree } = serviceImport(refus);
        const rapport = await svc.executer('t', 'u', {
            type: import_dto_1.TypeImport.ECRITURES,
            nomFichier: 'e.csv',
            contenuBase64: csv('date;piece;numero;libelle;debit;credit', [
                '2026-03-04;P1;52110000;Apport;500;0',
                '2026-03-04;P1;10110000;Apport;0;500',
            ]),
            mapping: { date: 'date', piece: 'piece', numero: 'numero', libelle: 'libelle', debit: 'debit', credit: 'credit' },
        });
        expect(controlesDEntree).toHaveBeenCalledTimes(1);
        expect(creerEcriture).not.toHaveBeenCalled();
        expect(rapport.anomalies.map((a) => a.message)).toEqual([
            "Période close jusqu’au 31/03/2026 · la pièce n'a pas été créée.",
        ]);
    });
    it('la ventilation obligatoire n’est levée que pour les chemins sans colonne de section, et nommément', async () => {
        const analytique = { verifierVentilationObligatoire: jest.fn().mockResolvedValue(undefined) };
        const prisma = {
            exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE) },
            compte: {
                findMany: jest.fn().mockResolvedValue([
                    { id: 'c1', numero: '60100000', typeCompte: 'DETAIL' },
                    { id: 'c2', numero: '52110000', typeCompte: 'DETAIL' },
                ]),
            },
            sectionAnalytique: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const svc = new ecriture_service_1.EcritureService(prisma, { trouver: jest.fn().mockResolvedValue({ id: 'j1', code: 'OD', estActif: true }) }, { verifierEcritureAutorisee: jest.fn().mockResolvedValue(undefined) }, analytique);
        const piece = { exerciceId: 'ex', journalId: 'j1', date: '2026-03-04', lignes: ECRITURE.lignes };
        await svc.controlesDEntree('t1', { ...piece, exigerVentilationObligatoire: false });
        expect(analytique.verifierVentilationObligatoire).not.toHaveBeenCalled();
        await svc.controlesDEntree('t1', piece);
        expect(analytique.verifierVentilationObligatoire).toHaveBeenCalledTimes(1);
    });
    it('la reprise de balance la lève', async () => {
        const { svc, controlesDEntree } = serviceImport();
        await svc.executer('t', 'u', {
            type: import_dto_1.TypeImport.BALANCE,
            nomFichier: 'b.csv',
            contenuBase64: BALANCE,
            mapping: MAPPING_BALANCE,
            dateOperation: '2026-01-01',
        });
        expect(controlesDEntree.mock.calls[0][1].exigerVentilationObligatoire).toBe(false);
    });
    it('chaque fichier qui crée une écriture hors de la saisie appelle les contrôles d’entrée, ou dit pourquoi', () => {
        const racine = (0, path_1.join)(__dirname, '..', '..');
        const fichiers = [];
        const parcourir = (dossier) => {
            for (const e of (0, fs_1.readdirSync)(dossier, { withFileTypes: true })) {
                const p = (0, path_1.join)(dossier, e.name);
                if (e.isDirectory())
                    parcourir(p);
                else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) {
                    if (/ecriture\.create\(/.test((0, fs_1.readFileSync)(p, 'utf-8')))
                        fichiers.push((0, path_1.relative)(racine, p));
                }
            }
        };
        parcourir(racine);
        const EXEMPTES = new Set([
            (0, path_1.join)('modules', 'comptabilite', 'ecriture.service.ts'),
            (0, path_1.join)('modules', 'exercice', 'exercice.service.ts'),
        ]);
        expect(fichiers.sort()).toEqual([
            (0, path_1.join)('modules', 'comptabilite', 'ecriture.service.ts'),
            (0, path_1.join)('modules', 'devises', 'declaration-devise-a-nouveau.service.ts'),
            (0, path_1.join)('modules', 'exercice', 'exercice.service.ts'),
            (0, path_1.join)('modules', 'groupe', 'groupe.service.ts'),
            (0, path_1.join)('modules', 'import', 'import.service.ts'),
        ].sort());
        for (const f of fichiers.filter((x) => !EXEMPTES.has(x))) {
            const source = (0, fs_1.readFileSync)((0, path_1.join)(racine, f), 'utf-8');
            expect([f, /\.controlesDEntree\(/.test(source)]).toEqual([f, true]);
        }
    });
});
//# sourceMappingURL=casse-en-silence.spec.js.map