"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ExportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportService = void 0;
exports.resultatDeLExerciceLogeAuBilan = resultatDeLExerciceLogeAuBilan;
exports.anomaliePosteDeFlux = anomaliePosteDeFlux;
exports.anomalieResultatAnterieurNonVire = anomalieResultatAnterieurNonVire;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const common_1 = require("@nestjs/common");
const impressions_journal_1 = require("../journaux/impressions-journal");
const mentions_immatriculation_1 = require("../tenant/mentions-immatriculation");
const correspondance_projet_emplois_ressources_1 = require("../etats-financiers/correspondance-projet-emplois-ressources");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const classeur_en_flux_1 = require("./classeur-en-flux");
const journal_edition_1 = require("./journal-edition");
const client_1 = require("@prisma/client");
const ExcelJS = require("exceljs");
const prisma_service_1 = require("../../common/prisma.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const ecriture_service_2 = require("../comptabilite/ecriture.service");
const balance_trois_colonnes_1 = require("../comptabilite/balance-trois-colonnes");
const immobilisation_service_1 = require("../immobilisations/immobilisation.service");
const test_ecritures_journal_service_1 = require("../controles/test-ecritures-journal.service");
const etats_financiers_service_1 = require("../etats-financiers/etats-financiers.service");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const etats_financiers_projet_service_1 = require("../etats-financiers/etats-financiers-projet.service");
const etats_financiers_smt_service_1 = require("../etats-financiers/etats-financiers-smt.service");
const etats_financiers_projet_budget_service_1 = require("../etats-financiers/etats-financiers-projet-budget.service");
const note_annexe_service_1 = require("../notes-annexes/note-annexe.service");
const etats_financiers_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.service");
const etats_financiers_smt_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-smt-syscohada.service");
const correspondance_compte_resultat_syscohada_1 = require("../etats-financiers-syscohada/correspondance-compte-resultat-syscohada");
const correspondance_smt_syscohada_1 = require("../etats-financiers-syscohada/correspondance-smt-syscohada");
const correspondance_tft_syscohada_1 = require("../etats-financiers-syscohada/correspondance-tft-syscohada");
const donation_service_1 = require("../registre-donateurs/donation.service");
const livre_inventaire_service_1 = require("../documents-obligatoires/livre-inventaire.service");
const rapport_activite_service_1 = require("../documents-obligatoires/rapport-activite.service");
const correspondance_inventaire_1 = require("../documents-obligatoires/correspondance-inventaire");
const correspondance_inventaire_syscohada_1 = require("../documents-obligatoires/correspondance-inventaire-syscohada");
const correspondance_projet_compte_exploitation_1 = require("../etats-financiers/correspondance-projet-compte-exploitation");
const theme_etafi_1 = require("./theme-etafi");
const theme_etafi_2 = require("./theme-etafi");
const balance_fpm_1 = require("./balance-fpm");
const etat_etafi_1 = require("./etat-etafi");
const libelle_exercice_1 = require("../../common/libelle-exercice");
const duree_mandat_1 = require("../mandat-auditeur/duree-mandat");
const forme_applicable_1 = require("../tenant/forme-applicable");
const ENTETE_FONT = { bold: true };
const ENTETE_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
};
const FORMAT_MONTANT = '#,##0.00';
const FORMAT_DATE = 'DD/MM/YYYY';
const FORMAT_DATE_HEURE = 'DD/MM/YYYY HH:mm';
function dureeEnMoisCartouche(debut, fin) {
    return Math.max(1, Math.round((fin.getTime() - debut.getTime()) / (30.44 * 86_400_000)));
}
const CODE_FORME_UNIVOQUE_FICHE_R2 = {
    SOCIETE_RESPONSABILITE_LIMITEE: '02',
    SOCIETE_COMMANDITE_SIMPLE: '03',
    SOCIETE_NOM_COLLECTIF: '04',
    GROUPEMENT_INTERET_ECONOMIQUE: '06',
    SOCIETE_PAR_ACTIONS_SIMPLIFIEE: '08',
};
const FORMAT_MONTANT_NOTE = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function montantNoteTexte(n) {
    return FORMAT_MONTANT_NOTE.format(Math.round(n * 100) / 100);
}
function nombreR2(v) {
    return v === null || v === undefined ? 'Non renseignée' : String(v);
}
function caseControleR2(declare, valeur) {
    const reponse = declare?.controleEntreprise ?? null;
    if (reponse === null)
        return 'Non renseignée';
    return reponse === valeur ? 'X' : '';
}
function resultatDeLExerciceLogeAuBilan(cellule, bilan) {
    if (bilan.resultatAnterieurNonVire)
        return cellule;
    const anterieur = Math.round(bilan.controle.resultatAnterieurNonAffecte * 100) / 100;
    return Math.abs(anterieur) > 0.005 ? `${cellule}-(${anterieur})` : cellule;
}
function postesParMotif(postes) {
    const groupes = [];
    for (const p of postes) {
        const groupe = groupes.find((g) => g.raison === p.raison);
        if (groupe) {
            groupe.refs.push(p.ref);
            groupe.aLever ||= p.aLever === true;
        }
        else
            groupes.push({ refs: [p.ref], raison: p.raison, aLever: p.aLever === true });
    }
    return groupes;
}
function anomaliePosteDeFlux(refs, raison, colonne, aLever) {
    const intitule = colonne === 'N' ? 'Tableau des flux de trésorerie' : 'Tableau des flux · colonne N-1';
    if (aLever === true) {
        return [
            'A_VERIFIER',
            refs,
            intitule,
            raison,
            colonne === 'N'
                ? 'Suivre l’issue que le motif nomme · tant que sa cause tient, le poste reste vide, ce n’est pas un zéro.'
                : 'Suivre l’issue que le motif nomme · tant que sa cause tient, la cellule N-1 reste vide, ce n’est pas un zéro.',
        ];
    }
    return [
        'INFO',
        refs,
        intitule,
        raison,
        colonne === 'N'
            ? 'Aucune action : la donnée manque, elle n’est pas approximée.'
            : 'Aucune action : la cellule N-1 reste vide, elle n’est pas un zéro.',
    ];
}
const SOLUTION_PROVENANCE = 'Suivre l’issue que la mention nomme, s’il y en a une ; aucune action si la provenance est la bonne.';
function motifsDesPostesSousLeTableau(ws, rangDepart, tft) {
    let r = rangDepart;
    for (const g of postesParMotif(tft.postesNonCalculables ?? [])) {
        r += 1;
        (0, etat_etafi_1.ligneControleSousEtat)(ws, r, `Exercice N · ${g.refs.join(', ')} · ${g.raison}`);
    }
    for (const g of postesParMotif(tft.postesNonCalculablesN1 ?? [])) {
        r += 1;
        (0, etat_etafi_1.ligneControleSousEtat)(ws, r, `Exercice N-1 · ${g.refs.join(', ')} · ${g.raison}`);
    }
    return r;
}
function anomalieResultatAnterieurNonVire(bilan) {
    const lignes = [];
    const n = bilan.resultatAnterieurNonVire;
    if (n) {
        lignes.push([
            'A_TRAITER',
            n.poste,
            "Résultat net de l'exercice",
            n.motif,
            "Le dire dans les notes annexes · l'affectation passée dans l'exercice suivant, ou sa clôture, porte ce montant au report à nouveau.",
        ]);
    }
    const n1 = bilan.resultatAnterieurNonVireN1;
    if (n1) {
        lignes.push([
            'A_TRAITER',
            n1.poste,
            "Résultat net de l'exercice · colonne N-1",
            n1.motif,
            "Le dire dans les notes annexes · la colonne N-1 reprend le poste tel que l'exercice précédent l'a présenté, rien n'est recalculé.",
        ]);
    }
    return lignes;
}
function refuserAuDelaDuPlafond(nb, quoi) {
    if (nb > classeur_en_flux_1.MAX_LIGNES_EXPORT) {
        throw new common_1.PayloadTooLargeException(`${quoi} : ${nb.toLocaleString('fr-FR')} lignes à exporter, au-delà de la limite de ` +
            `${classeur_en_flux_1.MAX_LIGNES_EXPORT.toLocaleString('fr-FR')}. Restreignez la période (ou le journal) ` +
            `et relancez l'export.`);
    }
}
let ExportService = ExportService_1 = class ExportService {
    constructor(prisma, ecritureService, etatsFinanciersService, etatsFinanciersProjetService, etatsFinanciersSmtService, etatsFinanciersProjetBudgetService, noteAnnexeService, donationService, livreInventaire, rapportActivite, etatsFinanciersSyscohadaService, etatsFinanciersSmtSyscohadaService, immobilisationService, testEcrituresJournal) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
        this.etatsFinanciersService = etatsFinanciersService;
        this.etatsFinanciersProjetService = etatsFinanciersProjetService;
        this.etatsFinanciersSmtService = etatsFinanciersSmtService;
        this.etatsFinanciersProjetBudgetService = etatsFinanciersProjetBudgetService;
        this.noteAnnexeService = noteAnnexeService;
        this.donationService = donationService;
        this.livreInventaire = livreInventaire;
        this.rapportActivite = rapportActivite;
        this.etatsFinanciersSyscohadaService = etatsFinanciersSyscohadaService;
        this.etatsFinanciersSmtSyscohadaService = etatsFinanciersSmtSyscohadaService;
        this.immobilisationService = immobilisationService;
        this.testEcrituresJournal = testEcrituresJournal;
        this.logger = new common_1.Logger(ExportService_1.name);
    }
    get immos() {
        if (!this.immobilisationService) {
            throw new Error("Service des immobilisations absent de l'injection : export impossible");
        }
        return this.immobilisationService;
    }
    get syscohada() {
        if (!this.etatsFinanciersSyscohadaService) {
            throw new Error("Moteur des états financiers SYSCOHADA absent de l'injection : export impossible");
        }
        return this.etatsFinanciersSyscohadaService;
    }
    get smtSyscohada() {
        if (!this.etatsFinanciersSmtSyscohadaService) {
            throw new Error("Moteur du Système minimal de trésorerie SYSCOHADA absent de l'injection : export impossible");
        }
        return this.etatsFinanciersSmtSyscohadaService;
    }
    nouveauClasseur() {
        const classeur = new ExcelJS.Workbook();
        classeur.creator = 'OmegaX';
        classeur.created = new Date();
        return classeur;
    }
    async versBuffer(classeur) {
        return Buffer.from(await classeur.xlsx.writeBuffer());
    }
    refuserClasseurEnMemoire(nb, quoi, rechange) {
        if (nb > ExportService_1.MAX_LIGNES_CLASSEUR_EN_MEMOIRE) {
            throw new common_1.PayloadTooLargeException(`${quoi} : ${nb.toLocaleString('fr-FR')} lignes, au-delà de la limite de ` +
                `${ExportService_1.MAX_LIGNES_CLASSEUR_EN_MEMOIRE.toLocaleString('fr-FR')} d'un classeur bâti en mémoire. ${rechange}`);
        }
    }
    async verifierVolume(ecriture, quoi) {
        const nb = await this.prisma.ligneEcriture.count({ where: { ecriture: (0, ecritures_de_situation_1.avecStatut)(ecriture) } });
        refuserAuDelaDuPlafond(nb, quoi);
    }
    async suffixeExercice(tenantId, exerciceId) {
        if (!exerciceId)
            return '';
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { dateDebut: true, dateFin: true },
        });
        return exercice ? `-${(0, libelle_exercice_1.libelleExercice)(exercice)}` : '';
    }
    formule(expression, resultat) {
        return { formula: expression, result: resultat };
    }
    ligneCoiffee(ligne) {
        return ligne + ExportService_1.DECALAGE_COIFFE;
    }
    colonne(feuille, cle) {
        return feuille.getColumn(cle).letter;
    }
    finaliserTableau(feuille, nbColonnes, derniereLigneDonnees, ligneEntete = 1) {
        styliserEntete(feuille.getRow(ligneEntete));
        feuille.views = [{ state: 'frozen', ySplit: ligneEntete }];
        if (derniereLigneDonnees > ligneEntete) {
            feuille.autoFilter = {
                from: { row: ligneEntete, column: 1 },
                to: { row: derniereLigneDonnees, column: nbColonnes },
            };
        }
    }
    piedDePageEtat(feuille, identite) {
        const edite = new Date().toLocaleDateString('fr-FR');
        const ident = (0, classeur_en_flux_1.segmentIdentification)(identite);
        feuille.headerFooter = {
            oddFooter: `&L${identite.entite}${ident ? ` · ${ident}` : ''} · ${identite.periode} · ` +
                `montants en ${identite.devise}&RPage &P / &N · édité le ${edite}`,
        };
    }
    coifferEtat(feuille, identite, titre, nbColonnes, ligneEnteteAvant = 1) {
        feuille.spliceRows(1, 0, [], [], []);
        const ligneTitre = feuille.getRow(1);
        ligneTitre.getCell(1).value = `${titre} · ${identite.entite}`;
        ligneTitre.getCell(1).font = { bold: true, size: 12 };
        if (nbColonnes > 1)
            feuille.mergeCells(1, 1, 1, nbColonnes);
        const ligneIdent = feuille.getRow(2);
        const edite = new Date().toLocaleDateString('fr-FR');
        ligneIdent.getCell(1).value =
            `${(0, classeur_en_flux_1.segmentIdentification)(identite) ? `${(0, classeur_en_flux_1.segmentIdentification)(identite)} · ` : ''}${identite.periode} · montants en ${identite.devise} · ` +
                `édité le ${edite}`;
        ligneIdent.getCell(1).font = { size: 9, italic: true };
        if (nbColonnes > 1)
            feuille.mergeCells(2, 1, 2, nbColonnes);
        return ligneEnteteAvant + 3;
    }
    async identiteEtat(tenantId, periode) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
        const exercice = periode.exerciceId
            ? await this.prisma.exercice.findFirst({ where: { id: periode.exerciceId, tenantId } })
            : null;
        const jour = (d) => new Date(d).toLocaleDateString('fr-FR');
        const libellePeriode = periode.dateDebut || periode.dateFin
            ? `Période du ${periode.dateDebut ? jour(periode.dateDebut) : '…'} au ${periode.dateFin ? jour(periode.dateFin) : '…'}`
            : exercice
                ? `Exercice du ${jour(exercice.dateDebut)} au ${jour(exercice.dateFin)}`
                : 'Toutes périodes';
        return {
            entite: tenant.nom,
            nif: tenant.numeroImpot ?? '',
            periode: libellePeriode,
            devise: (0, monnaie_de_tenue_1.monnaieDuJeuLegal)(tenant.devise),
            immatriculation: (0, mentions_immatriculation_1.immatriculationDesLivres)(tenant),
        };
    }
    appliquerFormats(feuille, formats) {
        for (const [cle, format] of Object.entries(formats)) {
            feuille.getColumn(cle).numFmt = format;
        }
    }
    async journalExcelEnFlux(tenantId, filtres, ouvrir, imprimePar) {
        const instantLecture = new Date();
        const where = (0, ecriture_service_1.perimetreJournal)(tenantId, filtres);
        const comptees = await this.prisma.ligneEcriture.count({ where: { ecriture: { ...where, tenantId } } });
        refuserAuDelaDuPlafond(comptees, 'Journal');
        const ecrituresComptees = await this.prisma.ecriture.count({ where: { ...where, tenantId } });
        const parJournal = await this.prisma.ecriture.groupBy({
            by: ['journalId', 'statut'],
            where: { ...where, tenantId },
            _count: { _all: true },
        });
        const statuts = new Map();
        for (const g of parJournal) {
            const s = statuts.get(g.journalId) ?? { validees: 0, brouillard: 0, situation: 0 };
            (0, journal_edition_1.compterStatut)(s, g.statut, g._count._all);
            statuts.set(g.journalId, s);
        }
        const journaux = statuts.size
            ? await this.prisma.journal.findMany({
                where: { tenantId, id: { in: [...statuts.keys()] } },
                select: { id: true, code: true, intitule: true, type: true },
                orderBy: [{ code: 'asc' }, { id: 'asc' }],
            })
            : [];
        if (journaux.length !== statuts.size) {
            const lus = new Set(journaux.map((j) => j.id));
            const manquants = [...statuts.keys()].filter((id) => !lus.has(id));
            throw new common_1.ConflictException(`Des écritures du périmètre portent un journal introuvable dans ce dossier (${manquants.join(', ')}) · ` +
                'le journal ne s’exporte pas amputé de leurs lignes. Signalez-le au support.');
        }
        const journalFiltre = journaux.length === 0 && filtres.journalId
            ? await this.prisma.journal.findFirst({
                where: { id: filtres.journalId, tenantId },
                select: { code: true, intitule: true, type: true },
            })
            : null;
        const identite = await this.identiteEtat(tenantId, filtres);
        const formatJour = (0, journal_edition_1.formatDuJour)(await this.bornesDuJournal(tenantId, filtres));
        const auteurs = await this.prisma.user.findMany({ where: { tenantId }, select: { id: true, email: true } });
        const courrielParId = new Map(auteurs.map((u) => [u.id, u.email]));
        const courriel = (id) => id ? (courrielParId.get(id) ?? 'utilisateur retiré du dossier') : '';
        const sortie = ouvrir(`journal${await this.suffixeExercice(tenantId, filtres.exerciceId)}.xlsx`);
        const edition = (0, journal_edition_1.ouvrirJournalEdition)({ sortie, identite, formatJour, selection: (0, journal_edition_1.criteresEnClair)(filtres) });
        const collectifsPorteurs = new Set((await this.prisma.compte.groupBy({
            by: ['collectifId'],
            where: { tenantId, collectifId: { not: null } },
        })).map((g) => g.collectifId));
        let nbLignes = 0;
        const signatures = [];
        if (journaux.length === 0)
            await edition.aucuneEcriture(journalFiltre);
        for (const journal of journaux) {
            const comptes = statuts.get(journal.id);
            await edition.ouvrirBloc(journal, comptes);
            const lus = { validees: 0, brouillard: 0, situation: 0 };
            for await (const lot of this.ecrituresDuJournal(tenantId, where, journal.id, {
                lignes: {
                    include: {
                        compte: {
                            select: {
                                id: true,
                                numero: true,
                                tiersCompte: { select: { tiers: { select: { code: true } } } },
                            },
                        },
                    },
                },
            })) {
                for (const e of lot) {
                    (0, journal_edition_1.compterStatut)(lus, e.statut);
                    signatures.push((0, journal_edition_1.signatureDeLecture)(e, e.lignes.length));
                    for (const l of e.lignes) {
                        nbLignes++;
                        await edition.ajouterLigne({
                            jour: e.date,
                            numeroPiece: e.numeroPiece,
                            compte: l.compte.numero,
                            tiers: (0, journal_edition_1.tiersDeLaLigne)(l.compte, collectifsPorteurs.has(l.compte.id)),
                            libelle: (0, journal_edition_1.libelleDeLaLigne)(l, e),
                            debit: Number(l.debit),
                            credit: Number(l.credit),
                            horsLivreJournal: (0, journal_edition_1.estHorsLivreJournal)(e.statut),
                        });
                    }
                }
            }
            const motif = (0, journal_edition_1.motifBlocChange)(journal.code, comptes, lus);
            if (motif)
                throw new common_1.ConflictException(motif);
            await edition.fermerBloc();
        }
        (0, classeur_en_flux_1.confronterAuDecompte)(nbLignes, comptees, 'Journal');
        await edition.terminer(async (ajouterFeuille) => {
            const piste = ajouterFeuille({
                nomFeuille: 'Piste de révision',
                titre: 'PISTE DE RÉVISION DU JOURNAL',
                identite,
                colonnes: journal_edition_1.COLONNES_PISTE_REVISION,
            });
            let nbEcritures = 0;
            for (const journal of journaux) {
                for await (const lot of this.ecrituresDuJournal(tenantId, where, journal.id, {
                    correction: { select: { numeroPiece: true } },
                    corrigeEcriture: { select: { numeroPiece: true } },
                    _count: { select: { lignes: true } },
                })) {
                    for (const e of lot) {
                        if (signatures[nbEcritures] !== (0, journal_edition_1.signatureDeLecture)(e, e._count.lignes)) {
                            throw new common_1.ConflictException((0, journal_edition_1.motifPieceDeplacee)(journal.code, e));
                        }
                        nbEcritures++;
                        await piste.ajouter({
                            journal: journal.code,
                            date: e.date,
                            dateValeur: e.dateValeur ?? null,
                            numeroPiece: e.numeroPiece,
                            reference: e.reference ?? '',
                            libelle: e.libelle,
                            statut: (0, ecritures_de_situation_1.libelleDuStatut)(e.statut),
                            saisieLe: e.createdAt,
                            saisiePar: courriel(e.createdBy),
                            valideeLe: e.valideeAt,
                            valideePar: courriel(e.valideeBy),
                            correction: (0, journal_edition_1.etatDeCorrection)(e),
                            motifCorrection: e.motifCorrection ?? '',
                        });
                    }
                }
            }
            (0, classeur_en_flux_1.confronterAuDecompte)(nbEcritures, ecrituresComptees, 'Piste de révision du journal');
            piste.fermer();
        });
        const lecture = { instantLecture, nombreEcritures: ecrituresComptees };
        await this.marquerJournalImprime(tenantId, filtres, imprimePar, lecture);
        return { lignes: nbLignes, lecture };
    }
    async *ecrituresDuJournal(tenantId, where, journalId, include) {
        let derniere;
        const rendues = new Set();
        for (;;) {
            const lot = (await this.prisma.ecriture.findMany({
                where: derniere
                    ? {
                        AND: [
                            { ...where, tenantId, journalId },
                            (0, lecture_par_lots_1.apresLaCle)([
                                { champ: 'date', valeur: derniere.date },
                                { champ: 'numeroPiece', valeur: derniere.numeroPiece, nullable: true },
                                { champ: 'id', valeur: derniere.id },
                            ]),
                        ],
                    }
                    : { ...where, tenantId, journalId },
                take: classeur_en_flux_1.LOT_EXPORT,
                include,
                orderBy: [{ date: 'asc' }, { numeroPiece: 'asc' }, { id: 'asc' }],
            }));
            const nouvelles = lot.filter((e) => !rendues.has(e.id));
            for (const e of nouvelles)
                rendues.add(e.id);
            if (nouvelles.length > 0)
                yield nouvelles;
            if (lot.length < classeur_en_flux_1.LOT_EXPORT)
                return;
            const fin = lot[lot.length - 1];
            derniere = { date: fin.date, numeroPiece: fin.numeroPiece, id: fin.id };
        }
    }
    async bornesDuJournal(tenantId, filtres) {
        const exercice = filtres.exerciceId
            ? await this.prisma.exercice.findFirst({
                where: { id: filtres.exerciceId, tenantId },
                select: { dateDebut: true, dateFin: true },
            })
            : null;
        const debut = filtres.dateDebut ? new Date(filtres.dateDebut) : exercice?.dateDebut;
        const fin = filtres.dateFin ? new Date(filtres.dateFin) : exercice?.dateFin;
        if (!debut || !fin || Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime()))
            return null;
        return { debut, fin };
    }
    async marquerJournalImprime(tenantId, filtres, imprimePar, lecture) {
        if (!imprimePar)
            return;
        try {
            const impression = await this.impressionDuJournal(this.prisma, tenantId, filtres, imprimePar, lecture);
            if (impression)
                await (0, impressions_journal_1.enregistrerImpression)(this.prisma, impression);
        }
        catch (erreur) {
            this.logger.error(`Journal exporté sans être enregistré comme imprimé (dossier ${tenantId}, exercice ${filtres.exerciceId}) · ` +
                (erreur instanceof Error ? erreur.message : String(erreur)));
        }
    }
    async impressionDuJournal(client, tenantId, filtres, imprimePar, lecture) {
        if (!filtres.exerciceId || (0, impressions_journal_1.estUneRecherche)(filtres))
            return null;
        const exercice = await client.exercice.findFirst({
            where: { id: filtres.exerciceId, tenantId },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        if (!exercice)
            return null;
        if (filtres.journalId) {
            const journal = await client.journal.findFirst({ where: { id: filtres.journalId, tenantId }, select: { type: true } });
            if (!journal || (0, ecritures_de_situation_1.estJournalDeSituation)(journal))
                return null;
        }
        const periode = (0, impressions_journal_1.periodeCouverte)(exercice, filtres);
        const nombreEcritures = lecture?.nombreEcritures ??
            (await client.ecriture.count({
                where: (0, ecriture_service_1.perimetreJournal)(tenantId, {
                    exerciceId: exercice.id,
                    ...(filtres.journalId ? { journalId: filtres.journalId } : {}),
                    dateDebut: periode.dateDebut.toISOString().slice(0, 10),
                    dateFin: periode.dateFin.toISOString().slice(0, 10),
                    ...(filtres.inclureBrouillard === false ? { inclureBrouillard: false } : {}),
                }),
            }));
        if (nombreEcritures === 0)
            return null;
        return {
            tenantId,
            exerciceId: exercice.id,
            journalId: filtres.journalId ?? null,
            dateDebut: periode.dateDebut,
            dateFin: periode.dateFin,
            forme: client_1.FormeImpressionJournal.EXPORT,
            nombreEcritures,
            imprimePar,
            ...(lecture ? { imprimeAt: lecture.instantLecture } : {}),
        };
    }
    colonnesGrandLivre(avecCompte, avecContrepartie = false) {
        const colonnesCompte = avecCompte
            ? [
                { header: 'Compte général', key: 'compteNumero', width: 14 },
                { header: 'Intitulé compte', key: 'compteIntitule', width: 30 },
            ]
            : [];
        return [
            ...colonnesCompte,
            { header: 'Journal', key: 'journal', width: 10 },
            { header: 'Date écriture', key: 'date', width: 13, style: { numFmt: FORMAT_DATE } },
            { header: 'N° pièce', key: 'numeroPiece', width: 10 },
            { header: 'Réf. pièce', key: 'reference', width: 16 },
            { header: 'Libellé', key: 'libelle', width: 34 },
            { header: 'Débit', key: 'debit', width: 14, style: { numFmt: FORMAT_MONTANT } },
            { header: 'Crédit', key: 'credit', width: 14, style: { numFmt: FORMAT_MONTANT } },
            { header: 'Solde progressif', key: 'solde', width: 16, style: { numFmt: FORMAT_MONTANT } },
            { header: 'Code lettrage', key: 'lettre', width: 13 },
            ...(avecContrepartie
                ? [{ header: 'Compte contrepartie', key: 'contrepartie', width: 28 }]
                : []),
        ];
    }
    noteContrepartie(feuille, cellule) {
        feuille.getCell(cellule).note =
            'Compte(s) de sens opposé dans la même écriture. Si plusieurs comptes apparaissent ' +
                '(séparés par « + »), l’écriture mêle débits et crédits multiples : la répartition exacte ' +
                "n'est pas déterminable sans information de saisie supplémentaire.";
    }
    async grandLivreExcel(tenantId, compteId, exerciceId) {
        const { compte, lignes, soldeFinal } = await this.ecritureService.grandLivre(tenantId, compteId, exerciceId);
        this.refuserClasseurEnMemoire(lignes.length, `Grand livre du compte ${compte.numero}`, "Le grand livre complet, écrit en flux, le porte · filtrez-y le compte.");
        const classeur = this.nouveauClasseur();
        const feuille = classeur.addWorksheet('Grand livre');
        feuille.columns = this.colonnesGrandLivre(false, true);
        this.noteContrepartie(feuille, 'J1');
        for (const l of lignes) {
            feuille.addRow({
                date: l.date,
                journal: l.journalCode,
                numeroPiece: l.numeroPiece,
                reference: l.reference ?? '',
                libelle: l.libelle,
                debit: l.debit || null,
                credit: l.credit || null,
                solde: l.soldeProgressif,
                lettre: l.lettre ?? '',
                contrepartie: l.contrepartie.join(' + '),
            });
        }
        const derniereLigneDonnees = feuille.rowCount;
        const ligneTotal = feuille.addRow({
            libelle: 'TOTAUX DU COMPTE',
            debit: lignes.reduce((s, l) => s + l.debit, 0),
            credit: lignes.reduce((s, l) => s + l.credit, 0),
            solde: soldeFinal,
        });
        ligneTotal.font = ENTETE_FONT;
        this.appliquerFormats(feuille, {
            date: FORMAT_DATE,
            debit: FORMAT_MONTANT,
            credit: FORMAT_MONTANT,
            solde: FORMAT_MONTANT,
        });
        const identiteGrandLivreCompte = await this.identiteEtat(tenantId, { exerciceId });
        const enteteGL = this.coifferEtat(feuille, identiteGrandLivreCompte, `GRAND LIVRE · ${compte.numero} ${compte.intitule}`, feuille.columns.length);
        this.finaliserTableau(feuille, feuille.columns.length, derniereLigneDonnees + 3, enteteGL);
        const enTete = `${compte.numero} · ${compte.intitule}`.replace(/&/g, '&&');
        feuille.headerFooter = { firstHeader: `&C${enTete}` };
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `grand-livre-${compte.numero}${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    async grandLivreCompletExcelEnFlux(tenantId, exerciceId, ouvrir) {
        const perimetre = { tenantId, ...(exerciceId ? { exerciceId } : {}), ...ecritures_de_situation_1.HORS_SITUATION };
        await this.verifierVolume(perimetre, 'Grand livre complet');
        const identite = await this.identiteEtat(tenantId, { exerciceId });
        const parCompte = await this.prisma.ligneEcriture.groupBy({
            by: ['compteId'],
            where: { ecriture: { ...perimetre, tenantId } },
            _sum: { debit: true, credit: true },
        });
        const mouvementes = parCompte.filter((c) => Number(c._sum.debit ?? 0) !== 0 || Number(c._sum.credit ?? 0) !== 0);
        const comptesMouvementes = new Set(mouvementes.map((c) => c.compteId));
        const sortie = ouvrir(`grand-livre-complet${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`);
        const flux = (0, classeur_en_flux_1.ouvrirFeuilleEnFlux)({
            sortie,
            nomFeuille: 'Grand livre',
            titre: 'GRAND LIVRE',
            identite,
            colonnes: [...this.colonnesGrandLivre(true), { header: 'Statut', key: 'statut', width: 12 }],
        });
        let compteCourant = null;
        let solde = 0;
        let nbLignes = 0;
        const comptees = await this.prisma.ligneEcriture.count({ where: { ecriture: { ...perimetre, tenantId } } });
        let lues = 0;
        let curseur;
        for (;;) {
            const lot = await this.prisma.ligneEcriture.findMany({
                where: { ecriture: { ...perimetre, tenantId } },
                take: classeur_en_flux_1.LOT_EXPORT,
                ...(curseur ? { cursor: { id: curseur }, skip: 1 } : {}),
                include: { compte: true, ecriture: { include: { journal: true } } },
                orderBy: [
                    { compte: { numero: 'asc' } },
                    { ecriture: { date: 'asc' } },
                    { ecriture: { numeroPiece: 'asc' } },
                    { id: 'asc' },
                ],
            });
            lues += lot.length;
            for (const l of lot) {
                if (!comptesMouvementes.has(l.compteId))
                    continue;
                if (l.compteId !== compteCourant) {
                    compteCourant = l.compteId;
                    solde = 0;
                }
                solde += Number(l.debit) - Number(l.credit);
                nbLignes++;
                await flux.ajouter({
                    compteNumero: l.compte.numero,
                    compteIntitule: l.compte.intitule,
                    journal: l.ecriture.journal.code,
                    date: l.ecriture.date,
                    numeroPiece: l.ecriture.numeroPiece,
                    reference: l.ecriture.reference ?? '',
                    libelle: l.libelle ?? l.ecriture.libelle,
                    debit: Number(l.debit) || null,
                    credit: Number(l.credit) || null,
                    solde: Math.round(solde * 100) / 100,
                    lettre: l.lettre ?? '',
                    statut: (0, ecritures_de_situation_1.libelleDuStatut)(l.ecriture.statut),
                });
            }
            if (lot.length < classeur_en_flux_1.LOT_EXPORT)
                break;
            curseur = lot[lot.length - 1].id;
        }
        (0, classeur_en_flux_1.confronterAuDecompte)(lues, comptees, 'Grand livre complet');
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, id: { in: [...comptesMouvementes] } },
            select: { id: true, numero: true, intitule: true },
        });
        const totaux = new Map(mouvementes.map((c) => [c.compteId, c._sum]));
        const arrondi = (n) => Math.round(n * 100) / 100;
        await flux.terminer(undefined, async (ajouterFeuille) => {
            const sommaire = ajouterFeuille({
                nomFeuille: 'Sommaire',
                titre: 'GRAND LIVRE · SOMMAIRE PAR COMPTE',
                identite,
                colonnes: [
                    { header: 'Compte général', key: 'compteNumero', width: 14 },
                    { header: 'Intitulé compte', key: 'compteIntitule', width: 36 },
                    { header: 'Total débit', key: 'debit', width: 16, style: { numFmt: FORMAT_MONTANT } },
                    { header: 'Total crédit', key: 'credit', width: 16, style: { numFmt: FORMAT_MONTANT } },
                    { header: 'Solde', key: 'solde', width: 16, style: { numFmt: FORMAT_MONTANT } },
                ],
            });
            let totalDebit = 0;
            let totalCredit = 0;
            for (const c of [...comptes].sort((a, b) => a.numero.localeCompare(b.numero))) {
                const t = totaux.get(c.id);
                const debit = Number(t.debit ?? 0);
                const credit = Number(t.credit ?? 0);
                totalDebit += debit;
                totalCredit += credit;
                await sommaire.ajouter({
                    compteNumero: c.numero,
                    compteIntitule: c.intitule,
                    debit: arrondi(debit),
                    credit: arrondi(credit),
                    solde: arrondi(debit - credit),
                });
            }
            const derniere = sommaire.derniereLigneDonnees();
            await sommaire.ajouter({
                compteIntitule: 'TOTAUX',
                debit: arrondi(totalDebit),
                credit: arrondi(totalCredit),
                solde: arrondi(totalDebit - totalCredit),
            });
            sommaire.fermer(derniere);
        });
        return { lignes: nbLignes };
    }
    async balanceAgeeExcel(tenantId, exerciceId, params = {}) {
        const etat = await this.ecritureService.balanceAgee(tenantId, { exerciceId, ...params });
        const identite = await this.identiteEtat(tenantId, { exerciceId });
        const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
        const nomClients = tenant.referentiel === client_1.Referentiel.SYCEBNL ? 'ADHÉRENTS / CLIENTS-USAGERS' : 'CLIENTS';
        const enTeteTiers = etat.type === 'CLIENTS_41' ? nomClients : etat.type === 'FOURNISSEURS' ? 'FOURNISSEURS' : 'TIERS';
        const classeur = this.nouveauClasseur();
        const feuille = classeur.addWorksheet('Balance âgée');
        const nbColonnes = etat.tranches.length + 2;
        const ligneAges = feuille.getRow(1);
        etat.tranches.forEach((t, i) => {
            ligneAges.getCell(i + 2).value = t.libelleAge;
        });
        ligneAges.font = { size: 9, italic: true };
        const ligneEntete = feuille.getRow(2);
        ligneEntete.getCell(1).value = enTeteTiers;
        etat.tranches.forEach((t, i) => {
            ligneEntete.getCell(i + 2).value = t.libellePeriode;
        });
        ligneEntete.getCell(nbColonnes).value = 'Solde';
        feuille.getColumn(1).width = 42;
        for (let i = 2; i <= nbColonnes; i++)
            feuille.getColumn(i).width = 20;
        const lettre = (colonne) => feuille.getColumn(colonne).letter;
        const premiereTranche = lettre(2);
        const derniereTranche = lettre(etat.tranches.length + 1);
        const ligneMontants = (libelle, montants, solde) => {
            const r = feuille.addRow([]);
            r.getCell(1).value = libelle;
            montants.forEach((m, i) => {
                r.getCell(i + 2).value = m || null;
            });
            const ligneCoiffee = this.ligneCoiffee(r.number);
            r.getCell(nbColonnes).value = montants.length
                ? this.formule(`SUM(${premiereTranche}${ligneCoiffee}:${derniereTranche}${ligneCoiffee})`, solde)
                : solde || null;
            return r;
        };
        const colSolde = lettre(nbColonnes);
        const sommeColonne = (col, de, a, valeur) => this.formule(`SUM(${col}${this.ligneCoiffee(de)}:${col}${this.ligneCoiffee(a)})`, valeur);
        const totaux = [];
        const section = (titre, lignes, libelleTotal, parTranche, total) => {
            if (titre) {
                const separateur = feuille.addRow([]);
                separateur.getCell(1).value = titre;
                separateur.font = { size: 9, italic: true };
            }
            const premiere = feuille.rowCount + 1;
            for (const l of lignes)
                ligneMontants(l.libelle, l.montants, l.solde);
            const derniere = feuille.rowCount;
            const r = feuille.addRow([]);
            r.getCell(1).value = libelleTotal;
            if (parTranche) {
                etat.tranches.forEach((_, i) => {
                    r.getCell(i + 2).value = lignes.length
                        ? sommeColonne(lettre(i + 2), premiere, derniere, parTranche[i])
                        : parTranche[i] || null;
                });
            }
            r.getCell(nbColonnes).value = lignes.length ? sommeColonne(colSolde, premiere, derniere, total) : total || null;
            r.font = ENTETE_FONT;
            totaux.push({ ligne: r.number });
            return { derniere, titree: titre !== null };
        };
        const sections = [];
        const aucuneLigne = etat.debiteurs.length + etat.crediteurs.length + etat.sensInverse.length === 0;
        if (etat.debiteurs.length > 0 || aucuneLigne) {
            sections.push(section(null, etat.debiteurs, 'TOTAL DÉBITEURS', etat.totaux.parTranche, etat.totaux.debiteurs));
        }
        if (etat.crediteurs.length > 0) {
            sections.push(section('SOLDES CRÉDITEURS', etat.crediteurs, 'TOTAL CRÉDITEURS', etat.totaux.parTrancheCrediteurs, etat.totaux.crediteurs));
        }
        if (etat.sensInverse.length > 0) {
            sections.push(section('SOLDES EN SENS INVERSE · non ventilés par antériorité', etat.sensInverse, 'TOTAL SOLDES EN SENS INVERSE', null, etat.totaux.sensInverse));
        }
        if ((etat.soldesNuls ?? []).length > 0) {
            const separateur = feuille.addRow([]);
            separateur.getCell(1).value = 'SOLDES NULS · pièces ouvertes qui se compensent';
            separateur.font = { size: 9, italic: true };
            for (const l of etat.soldesNuls) {
                const r = feuille.addRow([]);
                r.getCell(1).value = l.libelle;
                r.getCell(nbColonnes).value = 0;
            }
        }
        const premiere = sections[0];
        const derniereLigneDonnees = premiere && !premiere.titree ? premiere.derniere : 2;
        const net = feuille.addRow([]);
        net.getCell(1).value = 'SOLDE NET · recoupe la balance auxiliaire';
        net.getCell(nbColonnes).value = this.formule(totaux.map((t) => `${colSolde}${this.ligneCoiffee(t.ligne)}`).join('+'), etat.totaux.net);
        net.font = ENTETE_FONT;
        for (let i = 2; i <= nbColonnes; i++)
            feuille.getColumn(i).numFmt = FORMAT_MONTANT;
        this.piedDePageEtat(feuille, identite);
        const enteteAgee = this.coifferEtat(feuille, identite, 'BALANCE ÂGÉE', nbColonnes, 2);
        this.finaliserTableau(feuille, nbColonnes, derniereLigneDonnees + 3, enteteAgee);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `balance-agee${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    async justificatifSoldeExcel(tenantId, compteId, exerciceId, params = {}) {
        const j = await this.ecritureService.justificatifSolde(tenantId, { compteId, exerciceId, ...params });
        this.refuserClasseurEnMemoire(j.lignes.length, `Justificatif du compte ${j.compte.numero}`, "Masquez les lignes lettrées ou choisissez une date d'arrêt antérieure.");
        const identite = await this.identiteEtat(tenantId, { exerciceId });
        const classeur = this.nouveauClasseur();
        const feuille = classeur.addWorksheet('Justificatif');
        feuille.getRow(1).getCell(1).value = `${j.compte.numero} ${j.compte.intitule} · ${identite.entite}`;
        feuille.getRow(1).getCell(1).font = { bold: true, size: 11 };
        const colonnes = [
            { header: 'Date', key: 'date', width: 12 },
            { header: 'Journal', key: 'journal', width: 10 },
            { header: 'N° pièce', key: 'numeroPiece', width: 12 },
            { header: 'Réf. pièce', key: 'reference', width: 20 },
            { header: 'Libellé écriture', key: 'libelle', width: 52 },
            { header: 'Devise TR', key: 'deviseTransaction', width: 11 },
            { header: 'Montant devise', key: 'montantDevise', width: 16 },
            { header: `Débit (${identite.devise})`, key: 'debit', width: 16 },
            { header: `Crédit (${identite.devise})`, key: 'credit', width: 16 },
            { header: 'Lettrage', key: 'lettre', width: 10 },
        ];
        feuille.getRow(2).values = colonnes.map((c) => c.header);
        colonnes.forEach((c, i) => {
            feuille.getColumn(i + 1).key = c.key;
            feuille.getColumn(i + 1).width = c.width;
        });
        for (const l of j.lignes) {
            const r = feuille.addRow({
                date: l.date,
                journal: l.journal,
                numeroPiece: l.numeroPiece,
                reference: l.reference,
                libelle: l.estANouveau ? `${l.libelle} · à-nouveau` : l.libelle,
                deviseTransaction: l.deviseTransaction,
                montantDevise: l.montantDevise,
                debit: l.debit || null,
                credit: l.credit || null,
                lettre: l.lettre,
            });
            if (l.estANouveau)
                r.font = { italic: true };
        }
        const derniereLigneDonnees = feuille.rowCount;
        const premiereJustif = this.ligneCoiffee(3);
        const derniereJustif = this.ligneCoiffee(derniereLigneDonnees);
        const colDebit = this.colonne(feuille, 'debit');
        const colCredit = this.colonne(feuille, 'credit');
        const total = feuille.addRow({ libelle: 'Total' });
        total.getCell('debit').value = this.formule(`SUM(${colDebit}${premiereJustif}:${colDebit}${derniereJustif})`, j.totaux.debit);
        total.getCell('credit').value = this.formule(`SUM(${colCredit}${premiereJustif}:${colCredit}${derniereJustif})`, j.totaux.credit);
        total.font = ENTETE_FONT;
        const ligneSolde = feuille.addRow({ libelle: 'Solde' });
        ligneSolde.getCell('debit').value = this.formule(`${colDebit}${total.number + 3}-${colCredit}${total.number + 3}`, j.totaux.solde);
        ligneSolde.font = ENTETE_FONT;
        if (j.recoupement.applicable) {
            const r = feuille.addRow({
                libelle: j.recoupement.concordant
                    ? 'Recoupement avec la balance · concordant'
                    : "ÉCART AVEC LA BALANCE · le justificatif ne couvre pas tout le solde",
                debit: j.recoupement.soldeBalance || null,
            });
            r.getCell('credit').value = this.formule(`${colDebit}${ligneSolde.number + 3}-${colDebit}${r.number + 3}`, j.recoupement.ecart);
            r.font = { bold: true, italic: true };
        }
        this.appliquerFormats(feuille, {
            date: FORMAT_DATE,
            montantDevise: FORMAT_MONTANT,
            debit: FORMAT_MONTANT,
            credit: FORMAT_MONTANT,
        });
        this.piedDePageEtat(feuille, identite);
        const enteteJustif = this.coifferEtat(feuille, identite, `JUSTIFICATIF DE SOLDE · ${j.compte.numero} ${j.compte.intitule}`, colonnes.length, 2);
        this.finaliserTableau(feuille, colonnes.length, derniereLigneDonnees + 3, enteteJustif);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `justificatif-${j.compte.numero}-au-${j.dateArret}.xlsx`,
        };
    }
    async evolutionSoldesExcel(tenantId, nbExercices) {
        const { exercices, lignes } = await this.ecritureService.evolutionSoldes(tenantId, { nbExercices });
        const identite = await this.identiteEtat(tenantId, {});
        const classeur = this.nouveauClasseur();
        const feuille = classeur.addWorksheet('Évolution des soldes');
        const entetes = ['N° compte', 'Intitulé', ...exercices.map((e) => e.libelle)];
        feuille.getRow(1).values = entetes;
        feuille.getColumn(1).width = 14;
        feuille.getColumn(2).width = 42;
        for (let i = 3; i <= entetes.length; i++)
            feuille.getColumn(i).width = 18;
        for (const l of lignes) {
            const r = feuille.addRow([]);
            r.getCell(1).value = l.numero;
            r.getCell(2).value = l.intitule;
            l.soldes.forEach((s, i) => {
                r.getCell(i + 3).value = s;
            });
        }
        for (let i = 3; i <= entetes.length; i++)
            feuille.getColumn(i).numFmt = FORMAT_MONTANT;
        this.piedDePageEtat(feuille, identite);
        const derniereLigneDonnees = feuille.rowCount;
        const enteteEvolution = this.coifferEtat(feuille, identite, 'ÉVOLUTION DES SOLDES', entetes.length);
        this.finaliserTableau(feuille, entetes.length, derniereLigneDonnees + 3, enteteEvolution);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: 'evolution-soldes.xlsx',
        };
    }
    async tableauImmobilisationsExcel(tenantId, dateArret) {
        const t = await this.immos.tableauImmobilisations(tenantId, { dateArret });
        const identite = await this.identiteEtat(tenantId, {});
        const classeur = this.nouveauClasseur();
        const feuille = classeur.addWorksheet('Immobilisations');
        const colonnes = [
            { header: 'Libellé', key: 'libelle', width: 52 },
            { header: "Date d'acquisition", key: 'date', width: 18 },
            { header: 'Durée', key: 'duree', width: 8 },
            { header: `Val. brute (${identite.devise})`, key: 'brut', width: 18 },
            { header: 'Amort. cumulés', key: 'amort', width: 18 },
            { header: 'Dépréciations', key: 'dep', width: 18 },
            { header: 'Val. nette', key: 'net', width: 18 },
            { header: 'Observations', key: 'obs', width: 44 },
        ];
        feuille.getRow(1).values = colonnes.map((c) => c.header);
        colonnes.forEach((c, i) => {
            feuille.getColumn(i + 1).key = c.key;
            feuille.getColumn(i + 1).width = c.width;
        });
        const colBrut = this.colonne(feuille, 'brut');
        const colAmort = this.colonne(feuille, 'amort');
        const colDep = this.colonne(feuille, 'dep');
        const colNet = this.colonne(feuille, 'net');
        const lignesSousTotal = [];
        for (const g of t.groupes) {
            const titre = feuille.addRow({ libelle: `(${g.numero}) ${g.intitule}` });
            titre.font = { bold: true };
            const premiere = titre.number + 1;
            for (const l of g.lignes) {
                const r = feuille.addRow({
                    libelle: l.designation,
                    date: new Date(l.dateAcquisition),
                    duree: l.dureeAns,
                    brut: l.valeurBrute || null,
                    amort: l.amortissements || null,
                    dep: l.depreciations || null,
                    obs: l.dateSortie ? `Sorti le ${new Date(l.dateSortie).toLocaleDateString('fr-FR')}` : '',
                });
                const ligne = r.number + 3;
                r.getCell('net').value = this.formule(`${colBrut}${ligne}-${colAmort}${ligne}-${colDep}${ligne}`, l.valeurNette);
            }
            const sousTotal = feuille.addRow({ libelle: 'S/TOTAL' });
            const de = this.ligneCoiffee(premiere);
            const a = this.ligneCoiffee(sousTotal.number - 1);
            for (const [cle, col, valeur] of [
                ['brut', colBrut, g.brut],
                ['amort', colAmort, g.amortissements],
                ['dep', colDep, g.depreciations],
                ['net', colNet, g.net],
            ]) {
                sousTotal.getCell(cle).value = g.lignes.length
                    ? this.formule(`SUM(${col}${de}:${col}${a})`, valeur)
                    : valeur || null;
            }
            sousTotal.font = ENTETE_FONT;
            lignesSousTotal.push(this.ligneCoiffee(sousTotal.number));
        }
        const derniereLigneDonnees = feuille.rowCount;
        const total = feuille.addRow({ libelle: 'TOTAL GÉNÉRAL' });
        for (const [cle, col, valeur] of [
            ['brut', colBrut, t.totaux.brut],
            ['amort', colAmort, t.totaux.amortissements],
            ['dep', colDep, t.totaux.depreciations],
            ['net', colNet, t.totaux.net],
        ]) {
            total.getCell(cle).value = lignesSousTotal.length
                ? this.formule(lignesSousTotal.map((n) => `${col}${n}`).join('+'), valeur)
                : valeur || null;
        }
        total.font = ENTETE_FONT;
        if (t.sortis.length > 0) {
            feuille.addRow({});
            const titreSortis = feuille.addRow({ libelle: 'BIENS SORTIS À CETTE DATE · hors total' });
            titreSortis.font = { bold: true };
            for (const l of t.sortis) {
                feuille.addRow({
                    libelle: `(${l.compte}) ${l.designation}`,
                    date: new Date(l.dateAcquisition),
                    duree: l.dureeAns,
                    brut: l.valeurBrute || null,
                    amort: l.amortissements || null,
                    dep: l.depreciations || null,
                    net: l.valeurNette || null,
                    obs: l.dateSortie ? `Sorti le ${new Date(l.dateSortie).toLocaleDateString('fr-FR')}` : '',
                });
            }
        }
        this.appliquerFormats(feuille, {
            date: FORMAT_DATE,
            brut: FORMAT_MONTANT,
            amort: FORMAT_MONTANT,
            dep: FORMAT_MONTANT,
            net: FORMAT_MONTANT,
        });
        this.piedDePageEtat(feuille, identite);
        const titreImmo = t.dateArret
            ? `TABLEAU DES IMMOBILISATIONS AU ${new Date(t.dateArret).toLocaleDateString('fr-FR')}`
            : 'TABLEAU DES IMMOBILISATIONS';
        const enteteImmo = this.coifferEtat(feuille, identite, titreImmo, colonnes.length);
        this.finaliserTableau(feuille, colonnes.length, derniereLigneDonnees + 3, enteteImmo);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `tableau-immobilisations${t.dateArret ? `-au-${t.dateArret}` : ''}.xlsx`,
        };
    }
    async tableauAmortissementsExcel(tenantId, exerciceId) {
        const t = await this.immos.tableauAmortissements(tenantId, exerciceId);
        const identite = await this.identiteEtat(tenantId, { exerciceId });
        const classeur = this.nouveauClasseur();
        const feuille = classeur.addWorksheet('Amortissements');
        const entetes = [
            'Libellé',
            "Date d'acquisition",
            `Val. brute (${identite.devise})`,
            'Taux',
            ...t.mois.map((m) => m.libelle),
            "Dotations de l'exercice",
            'Amort. cum. N-1',
            'Amort. cum. N',
            'Dépréciations',
            'Val. nette',
            'Dotation',
        ];
        feuille.getRow(1).values = entetes;
        feuille.getColumn(1).width = 52;
        feuille.getColumn(2).width = 18;
        for (let i = 3; i <= entetes.length; i++)
            feuille.getColumn(i).width = 15;
        const PREMIER_MOIS = 5;
        const COL_DOTATION = PREMIER_MOIS + t.mois.length;
        const lettre = (colonne) => feuille.getColumn(colonne).letter;
        const colBrut = lettre(3);
        const colPremierMois = lettre(PREMIER_MOIS);
        const colDernierMois = lettre(PREMIER_MOIS + t.mois.length - 1);
        const colDotation = lettre(COL_DOTATION);
        const colCumulN1 = lettre(COL_DOTATION + 1);
        const colCumulN = lettre(COL_DOTATION + 2);
        const colDep = lettre(COL_DOTATION + 3);
        const colNet = lettre(COL_DOTATION + 4);
        const poser = (libelle, valeurs) => {
            const r = feuille.addRow([]);
            r.getCell(1).value = libelle;
            if (valeurs.date)
                r.getCell(2).value = valeurs.date;
            r.getCell(3).value = valeurs.brut ?? null;
            if (valeurs.taux !== undefined && valeurs.taux !== null)
                r.getCell(4).value = valeurs.taux / 100;
            valeurs.parMois.forEach((m, i) => {
                r.getCell(PREMIER_MOIS + i).value = m || null;
            });
            const n = r.number + 3;
            r.getCell(COL_DOTATION).value = valeurs.parMois.length
                ? this.formule(`SUM(${colPremierMois}${n}:${colDernierMois}${n})`, valeurs.dotation)
                : valeurs.dotation || null;
            r.getCell(COL_DOTATION + 1).value = valeurs.cumulN1 || null;
            r.getCell(COL_DOTATION + 2).value = this.formule(`${colCumulN1}${n}+${colDotation}${n}`, valeurs.cumulN);
            r.getCell(COL_DOTATION + 3).value = valeurs.depreciations || null;
            r.getCell(COL_DOTATION + 4).value =
                valeurs.brut !== undefined && valeurs.brut !== null
                    ? this.formule(`${colBrut}${n}-${colCumulN}${n}-${colDep}${n}`, valeurs.net)
                    : valeurs.net || null;
            if (valeurs.etat)
                r.getCell(COL_DOTATION + 5).value = valeurs.etat;
            return r;
        };
        const lignesSousTotal = [];
        for (const g of t.groupes) {
            const titre = feuille.addRow([]);
            titre.getCell(1).value = `(${g.numero}) ${g.intitule}`;
            titre.font = { bold: true };
            const premiere = this.ligneCoiffee(titre.number + 1);
            for (const l of g.lignes) {
                poser(l.designation, {
                    date: new Date(l.dateAcquisition),
                    brut: l.valeurBrute,
                    taux: l.taux,
                    parMois: l.parMois,
                    dotation: l.dotation,
                    cumulN1: l.cumulN1,
                    cumulN: l.cumulN,
                    depreciations: l.depreciations,
                    net: l.valeurNette,
                    etat: l.sortiLe
                        ? `Sorti le ${new Date(l.sortiLe).toLocaleDateString('fr-FR')}`
                        : l.dotationPassee
                            ? 'Comptabilisée'
                            : 'À passer',
                });
            }
            const st = feuille.addRow([]);
            st.getCell(1).value = 'S/TOTAL';
            const derniere = this.ligneCoiffee(st.number - 1);
            const sommeColonne = (colonne, valeur) => {
                const col = lettre(colonne);
                st.getCell(colonne).value = g.lignes.length
                    ? this.formule(`SUM(${col}${premiere}:${col}${derniere})`, valeur)
                    : valeur || null;
            };
            g.parMois.forEach((m, i) => sommeColonne(PREMIER_MOIS + i, m));
            sommeColonne(COL_DOTATION, g.dotation);
            sommeColonne(COL_DOTATION + 1, g.cumulN1);
            sommeColonne(COL_DOTATION + 2, g.cumulN);
            sommeColonne(COL_DOTATION + 3, g.depreciations);
            sommeColonne(COL_DOTATION + 4, g.net);
            st.font = ENTETE_FONT;
            lignesSousTotal.push(this.ligneCoiffee(st.number));
        }
        const derniereLigneDonnees = feuille.rowCount;
        const total = feuille.addRow([]);
        total.getCell(1).value = 'TOTAL GÉNÉRAL';
        const totalColonne = (colonne, valeur) => {
            const col = lettre(colonne);
            total.getCell(colonne).value = lignesSousTotal.length
                ? this.formule(lignesSousTotal.map((n) => `${col}${n}`).join('+'), valeur)
                : valeur || null;
        };
        t.totaux.parMois.forEach((m, i) => totalColonne(PREMIER_MOIS + i, m));
        totalColonne(COL_DOTATION, t.totaux.dotation);
        totalColonne(COL_DOTATION + 1, t.totaux.cumulN1);
        totalColonne(COL_DOTATION + 2, t.totaux.cumulN);
        totalColonne(COL_DOTATION + 3, t.totaux.depreciations);
        totalColonne(COL_DOTATION + 4, t.totaux.net);
        total.font = ENTETE_FONT;
        feuille.addRow([]);
        const ligneTotalCoiffee = total.number + 3;
        const controles = [
            ['Cumul amortissements à la clôture', this.formule(`${colCumulN}${ligneTotalCoiffee}`, t.totaux.cumulN)],
            ["Cumul amortissements à l'ouverture", this.formule(`${colCumulN1}${ligneTotalCoiffee}`, t.totaux.cumulN1)],
            ['Dotation de la période', this.formule(`${colDotation}${ligneTotalCoiffee}`, t.totaux.dotation)],
        ];
        const lignesControle = [];
        for (const [libelle, valeur] of controles) {
            const r = feuille.addRow([]);
            r.getCell(1).value = libelle;
            r.getCell(3).value = valeur;
            lignesControle.push(r.number + 3);
            r.font = { size: 9, italic: true };
        }
        const [ligneCloture, ligneOuverture, ligneDotation] = lignesControle;
        const ecart = Math.round((t.totaux.cumulN - t.totaux.cumulN1 - t.totaux.dotation) * 100) / 100;
        const ligneEcart = feuille.addRow([]);
        ligneEcart.getCell(1).value =
            Math.abs(ecart) < 0.005
                ? 'Écart · le cumul de clôture est bien celui d’ouverture augmenté de la dotation'
                : "ÉCART · le cumul de clôture ne s'explique pas par la dotation de la période";
        const colControle = feuille.getColumn(3).letter;
        ligneEcart.getCell(3).value = this.formule(`${colControle}${ligneCloture}-${colControle}${ligneOuverture}-${colControle}${ligneDotation}`, ecart);
        ligneEcart.font = ENTETE_FONT;
        feuille.getColumn(2).numFmt = FORMAT_DATE;
        feuille.getColumn(3).numFmt = FORMAT_MONTANT;
        feuille.getColumn(4).numFmt = '0.00%';
        for (let i = PREMIER_MOIS; i <= COL_DOTATION + 4; i++)
            feuille.getColumn(i).numFmt = FORMAT_MONTANT;
        this.piedDePageEtat(feuille, identite);
        const enteteAmort = this.coifferEtat(feuille, identite, 'TABLEAU DES AMORTISSEMENTS', entetes.length);
        this.finaliserTableau(feuille, entetes.length, derniereLigneDonnees + 3, enteteAmort);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `tableau-amortissements${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    async exerciceDuDossier(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException(etats_financiers_communs_1.MOTIF_EXERCICE_INTROUVABLE);
        return exercice;
    }
    async identiteLiasse(tenantId, exerciceId) {
        const [tenant, exercice] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
            this.exerciceDuDossier(tenantId, exerciceId),
        ]);
        const debut = exercice.dateDebut;
        const fin = exercice.dateFin;
        const duree = dureeEnMoisCartouche(debut, fin);
        const finAnnee = fin.getUTCMonth() === 11 && fin.getUTCDate() === 31;
        return {
            entite: tenant.nom,
            nif: tenant.numeroImpot ?? '',
            exercice: finAnnee ? String(fin.getUTCFullYear()) : fin.toLocaleDateString('fr-FR', { timeZone: 'UTC' }),
            dateDebut: debut.toLocaleDateString('fr-FR', { timeZone: 'UTC' }),
            dateFin: fin.toLocaleDateString('fr-FR', { timeZone: 'UTC' }),
            duree: String(duree),
            adresse: [tenant.adresse, tenant.ville, tenant.pays].filter(Boolean).join(', '),
            sigle: '',
            ntd: '',
            dateArrete: exercice.dateArreteComptes
                ? exercice.dateArreteComptes.toLocaleDateString('fr-FR', { timeZone: 'UTC' })
                : '',
            monnaie: (0, monnaie_de_tenue_1.monnaieDuJeuLegal)(tenant.devise),
        };
    }
    async champsFiche1(tenantId, exerciceId, tenant, avecCommissaire = false) {
        const courant = await this.exerciceDuDossier(tenantId, exerciceId);
        const precedent = await this.prisma.exercice.findFirst({
            where: { tenantId, dateDebut: { lt: courant.dateDebut } },
            orderBy: { dateDebut: 'desc' },
            select: { dateDebut: true, dateFin: true },
        });
        let zr = '';
        if (avecCommissaire) {
            const mandats = await this.prisma.mandatAuditeur.findMany({
                where: { tenantId, finAnticipeeLe: null },
                orderBy: { premierExercice: 'desc' },
                select: { nom: true, inscriptionOrdre: true, premierExercice: true, nombreExercices: true },
            });
            const couvrant = (0, duree_mandat_1.mandatCouvrant)(mandats, courant.dateFin.getUTCFullYear());
            if (couvrant)
                zr = `${couvrant.nom} · inscription à l'Ordre : ${couvrant.inscriptionOrdre}`;
        }
        return {
            ...(avecCommissaire ? { ZR: zr } : {}),
            ZC: precedent ? precedent.dateFin.toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '',
            ZD: precedent ? String(dureeEnMoisCartouche(precedent.dateDebut, precedent.dateFin)) : '',
            ZG: tenant.numeroAffiliationCnssEmployeur ?? '',
            ZK: [tenant.telephone, tenant.email, tenant.ville].filter((v) => v && v.trim()).join(' · '),
            ZM: tenant.activite ?? '',
        };
    }
    async domiciliationsBancaires(tenantId) {
        const ribs = await this.prisma.ribBanque.findMany({
            where: { tenantId },
            select: { numeroCompte: true, iban: true, banque: { select: { intitule: true } } },
            orderBy: { abrege: 'asc' },
            take: 50,
        });
        return ribs
            .map((r) => [r.banque.intitule, r.numeroCompte || r.iban].filter((v) => v && v.trim()).join(' '))
            .filter(Boolean)
            .join(' · ');
    }
    lignesEtatEtafi(postes, actif) {
        return postes.map((p) => ({
            ref: p.ref,
            libelle: p.libelle,
            note: etat_etafi_1.NOTE_PAR_REF_ASSOCIATIONS[p.ref] ?? '',
            niveau: etat_etafi_1.NIVEAUX_ETAT_ASSOCIATIONS[p.ref] ?? (p.estTotal ? 'inter' : 'normal'),
            montants: actif
                ? [
                    p.brut ?? p.montant,
                    p.amortissement ?? 0,
                    { formule: 'D{r}-E{r}' },
                    p.montantN1 ?? null,
                ]
                : [p.montant, p.montantN1 ?? null],
        }));
    }
    feuillesBilanEtafi(classeur, bilan, ident) {
        const rangsActif = (0, etat_etafi_1.construireFeuilleEtat)(classeur, {
            nom: 'Bilan-Actif',
            titre: 'BILAN',
            taille: 16,
            ident,
            pageRef: 'BILAN SYSTEME NORMAL\nPAGE 1/2',
            libelleColonne: 'ACTIF',
            groupes: ExportService_1.GROUPES_ACTIF,
            lignes: this.lignesEtatEtafi(bilan.actif, true),
            totaux: etat_etafi_1.TOTAUX_ASSOCIATIONS,
        });
        const rangsPassif = (0, etat_etafi_1.construireFeuilleEtat)(classeur, {
            nom: 'Bilan-Passif',
            titre: 'BILAN',
            taille: 16,
            ident,
            pageRef: 'BILAN SYSTEME NORMAL\nPAGE 2/2',
            libelleColonne: 'PASSIF',
            groupes: ExportService_1.GROUPES_NET,
            lignes: this.lignesEtatEtafi(bilan.passif, false),
            totaux: etat_etafi_1.TOTAUX_ASSOCIATIONS,
        });
        return { rangsActif, rangsPassif };
    }
    async bilanExcel(tenantId, exerciceId) {
        const [bilan, ident] = await Promise.all([
            this.etatsFinanciersService.bilan(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        const { rangsActif, rangsPassif } = this.feuillesBilanEtafi(classeur, bilan, ident);
        const controle = bilan.equilibre
            ? `Contrôle : bilan équilibré · actif = passif = ${bilan.totalActif.toLocaleString('fr-FR')}.`
            : `CONTRÔLE : DÉSÉQUILIBRE de ${(bilan.totalActif - bilan.totalPassif).toLocaleString('fr-FR')} entre actif et passif · vérifier les écritures.`;
        const nonRattaches = bilan.comptesNonRattaches.length > 0
            ? ` ${bilan.comptesNonRattaches.length} compte(s) de bilan non rattaché(s) à un poste officiel (montants hors totaux) : ` +
                bilan.comptesNonRattaches
                    .slice(0, 6)
                    .map((c) => c.numero)
                    .join(', ') +
                (bilan.comptesNonRattaches.length > 6 ? '…' : '') +
                '.'
            : '';
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Bilan-Actif'), Math.max(...rangsActif.values()) + 2, controle + nonRattaches);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Bilan-Passif'), Math.max(...rangsPassif.values()) + 2, controle);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `bilan${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleResultatEtafi(classeur, cr, ident) {
        const total = (ref, libelle) => ({
            ref,
            libelle,
            montant: 0,
            comptes: [],
            estTotal: true,
        });
        const postes = [
            ...cr.produits,
            total('XA', 'REVENUS DES ACTIVITES ORDINAIRES'),
            ...cr.charges,
            total('XB', 'CHARGES DES ACTIVITES ORDINAIRES'),
            total('XC', 'RESULTAT DES ACTIVITES ORDINAIRES'),
            cr.produitsHao,
            cr.chargesHao,
            total('XD', 'RESULTAT H.A.O.'),
            total('XE', "RESULTAT NET DE L'EXERCICE (+excedent, -deficit)"),
        ];
        return (0, etat_etafi_1.construireFeuilleEtat)(classeur, {
            nom: 'Résultat',
            titre: 'COMPTE DE RESULTAT',
            taille: 14,
            ident,
            pageRef: 'COMPTE DE RESULTAT\nSYSTEME NORMAL',
            libelleColonne: 'LIBELLES',
            groupes: ExportService_1.GROUPES_NET,
            lignes: this.lignesEtatEtafi(postes, false),
            totaux: etat_etafi_1.TOTAUX_ASSOCIATIONS,
        });
    }
    async compteDeResultatExcel(tenantId, exerciceId) {
        const [cr, ident] = await Promise.all([
            this.etatsFinanciersService.compteDeResultat(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        const rangs = this.feuilleResultatEtafi(classeur, cr, ident);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Résultat'), Math.max(...rangs.values()) + 2, cr.controle.coherent
            ? 'Contrôle : le résultat net (XE) recoupe le résultat logé au bilan.'
            : `CONTRÔLE : écart de ${cr.controle.ecart.toLocaleString('fr-FR')} entre le résultat du compte de résultat et celui du bilan.`);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `compte-de-resultat${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleTftEtafi(classeur, tft, ident) {
        const rangs = new Map();
        const ws = classeur.addWorksheet('TFT');
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'TABLEAU DES FLUX\nDE TRESORERIE', 6);
        (0, theme_etafi_1.titreEtat)(ws, 'TABLEAU DES FLUX DE TRESORERIE', 1, 6, 7, 14);
        let r = 8;
        for (const [i, h] of ['REF', 'LIBELLES', 'Rep.', 'Note', 'EXERCICE N', 'EXERCICE N-1'].entries()) {
            ws.getCell(r, i + 1).value = h;
        }
        (0, theme_etafi_1.entetesBande)(ws, r, r, 1, 6);
        ws.getRow(r).height = 22;
        const vides = new Set(tft.postesVides);
        for (const l of tft.lignes) {
            r += 1;
            ws.getRow(r).height = 22;
            if ('section' in l) {
                ws.getCell(r, 2).value = l.section;
                (0, theme_etafi_1.styleLigne)(ws, r, 2, 6, 'bande', [5, 6]);
                (0, theme_etafi_1.styleLigne)(ws, r, 1, 1, 'normal');
                continue;
            }
            rangs.set(l.ref, r);
            ws.getCell(r, 1).value = l.ref;
            ws.getCell(r, 2).value = l.libelle;
            ws.getCell(r, 3).value = l.repere ?? etat_etafi_1.REP_TFT[l.ref] ?? '';
            if (!vides.has(l.ref))
                ws.getCell(r, 5).value = l.montant;
            if (l.montantN1 !== undefined)
                ws.getCell(r, 6).value = l.montantN1;
            (0, theme_etafi_1.styleLigne)(ws, r, 1, 6, etat_etafi_1.NIVEAUX_TFT[l.ref] ?? 'normal', [5, 6], 1);
            ws.getCell(r, 3).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        (0, theme_etafi_1.cadre)(ws, 8, 1, r, 6, theme_etafi_1.MOYEN);
        r += 2;
        (0, etat_etafi_1.ligneControleSousEtat)(ws, r, "(1) à l'exclusion des fournisseurs d'investissements. Méthode directe (Partie 4, ch. 1 § 4) · " +
            'les lignes FA à FH sont ventilées depuis les écritures de trésorerie du dossier.');
        (0, theme_etafi_1.largeurs)(ws, { A: 5.5, B: 72, C: 6, D: 6, E: 15.7, F: 15.7 });
        ws.views = [{ state: 'frozen', ySplit: 8, showGridLines: false }];
        return { rangs, dernier: r };
    }
    async tableauFluxTresorerieExcel(tenantId, exerciceId) {
        const [tft, ident] = await Promise.all([
            this.etatsFinanciersService.tableauFluxTresorerie(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        const { dernier } = this.feuilleTftEtafi(classeur, tft, ident);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('TFT'), dernier + 1, tft.controle.coherent === null
            ? (tft.controle.motifNonControlable ?? 'Contrôle non effectué.')
            : tft.controle.coherent
                ? 'Contrôle : le TFT boucle avec la trésorerie du bilan (ZG = trésorerie actif N - trésorerie passif N).'
                : `CONTRÔLE : écart de bouclage de ${(tft.controle.ecart ?? 0).toLocaleString('fr-FR')} avec la trésorerie du bilan.`);
        motifsDesPostesSousLeTableau(classeur.getWorksheet('TFT'), dernier + 1, tft);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `tableau-flux-tresorerie${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    lignesProjetEtafi(postes) {
        return postes.map((p) => {
            const cle = p.cle ?? p.ref;
            return {
                ref: p.ref,
                cle,
                libelle: p.libelle,
                note: etat_etafi_1.NOTE_PAR_CLE_PROJETS[cle] ?? '',
                niveau: etat_etafi_1.NIVEAUX_ETAT_PROJETS[cle] ?? (p.estTotal ? 'inter' : 'normal'),
                montants: [p.montant, p.montantN1 ?? null],
            };
        });
    }
    feuillesBilanProjetEtafi(classeur, bilan, ident) {
        const rangsActif = (0, etat_etafi_1.construireFeuilleEtat)(classeur, {
            nom: 'Bilan-Actif',
            titre: 'BILAN',
            taille: 16,
            ident,
            pageRef: 'BILAN\nPAGE 1/2',
            libelleColonne: 'ACTIF',
            groupes: ExportService_1.GROUPES_BILAN_PROJET,
            lignes: this.lignesProjetEtafi(bilan.actif),
            totaux: etat_etafi_1.TOTAUX_PROJETS_BILAN,
        });
        const rangsPassif = (0, etat_etafi_1.construireFeuilleEtat)(classeur, {
            nom: 'Bilan-Passif',
            titre: 'BILAN',
            taille: 16,
            ident,
            pageRef: 'BILAN\nPAGE 2/2',
            libelleColonne: 'PASSIF',
            groupes: ExportService_1.GROUPES_BILAN_PROJET,
            lignes: this.lignesProjetEtafi(bilan.passif),
            totaux: etat_etafi_1.TOTAUX_PROJETS_BILAN,
        });
        return { rangsActif, rangsPassif };
    }
    async bilanProjetExcel(tenantId, exerciceId) {
        const [bilan, ident] = await Promise.all([
            this.etatsFinanciersProjetService.bilan(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        const { rangsActif, rangsPassif } = this.feuillesBilanProjetEtafi(classeur, bilan, ident);
        const controle = bilan.equilibre
            ? `Contrôle : bilan équilibré · actif = passif = ${bilan.totalActif.toLocaleString('fr-FR')}.`
            : `CONTRÔLE : DÉSÉQUILIBRE de ${(bilan.totalActif - bilan.totalPassif).toLocaleString('fr-FR')} entre actif et passif.`;
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Bilan-Actif'), Math.max(...rangsActif.values()) + 2, controle);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Bilan-Passif'), Math.max(...rangsPassif.values()) + 2, controle);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `bilan-projet${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleCompteExploitationEtafi(classeur, ce, ident) {
        const total = (ref, libelle) => ({
            ref,
            libelle,
            montant: 0,
            comptes: [],
            estTotal: true,
        });
        const avecCles = (postes, specs) => postes.map((p, i) => {
            const cle = specs[i]?.cle;
            return { ...p, cle: cle ? (etat_etafi_1.CLE_ETAFI_PAR_CLE_PROJET[cle] ?? cle) : cle };
        });
        const postes = [
            ...avecCles(ce.revenus, correspondance_projet_compte_exploitation_1.POSTES_REVENUS),
            total('XA', 'REVENUS (Somme RA à RE)'),
            ...avecCles(ce.charges, correspondance_projet_compte_exploitation_1.POSTES_CHARGES),
            total('XB', 'CHARGES DE FONCTIONNEMENT (Somme TA à TL)'),
            total('XC', "SOLDE DES OPERATIONS DE L'EXERCICE : XA-XB"),
        ];
        return (0, etat_etafi_1.construireFeuilleEtat)(classeur, {
            nom: 'Compte Exploitation',
            titre: "COMPTE D'EXPLOITATION",
            taille: 14,
            ident,
            pageRef: "COMPTE D'EXPLOITATION\nPROJETS DE\nDEVELOPPEMENT",
            libelleColonne: 'LIBELLES',
            groupes: ExportService_1.GROUPES_NET,
            lignes: this.lignesProjetEtafi(postes),
            totaux: etat_etafi_1.TOTAUX_PROJETS_CE,
        });
    }
    async compteExploitationProjetExcel(tenantId, exerciceId) {
        const [ce, ident] = await Promise.all([
            this.etatsFinanciersProjetService.compteExploitation(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        const rangs = this.feuilleCompteExploitationEtafi(classeur, ce, ident);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Compte Exploitation'), Math.max(...rangs.values()) + 2, ce.controle.boucleAZero
            ? 'Solde des opérations de l’exercice : XC = 0.'
            : `Solde des opérations de l'exercice : XC = ${ce.solde.toLocaleString('fr-FR')} · non nul, à expliquer en Notes (produit ou charge hors de la neutralisation par le 702).`);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `compte-exploitation-projet${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    async noteBailleurExcel(tenantId, exerciceId) {
        const [note, identite] = await Promise.all([
            this.etatsFinanciersProjetService.noteBailleur(tenantId, exerciceId),
            this.identiteEtat(tenantId, { exerciceId }),
        ]);
        const classeur = this.nouveauClasseur();
        const feuille = classeur.addWorksheet('Note 9 · Fonds du bailleur');
        feuille.columns = [
            { header: 'Bailleur', key: 'bailleur', width: 28 },
            { header: 'Investissement · Décaissé', key: 'iDecaisse', width: 20 },
            { header: 'Investissement · Consommé', key: 'iConsomme', width: 20 },
            { header: 'Investissement · Solde restant', key: 'iSolde', width: 22 },
            { header: 'Administration · Décaissé', key: 'aDecaisse', width: 20 },
            { header: 'Administration · Consommé', key: 'aConsomme', width: 20 },
            { header: 'Administration · Solde restant', key: 'aSolde', width: 22 },
            { header: 'Total des fonds · Décaissé', key: 'tDecaisse', width: 20 },
            { header: 'Total des fonds · Consommé', key: 'tConsomme', width: 20 },
            { header: 'Total des fonds · Solde restant', key: 'tSolde', width: 22 },
        ];
        const bailleurs = new Map();
        for (const b of [...note.investissement, ...note.administration]) {
            bailleurs.set(b.bailleur.id, { nom: b.bailleur.nom, code: b.bailleur.code });
        }
        for (const [id, { nom, code }] of bailleurs) {
            const inv = note.investissement.find((b) => b.bailleur.id === id);
            const adm = note.administration.find((b) => b.bailleur.id === id);
            feuille.addRow({
                bailleur: `${code} · ${nom}`,
                iDecaisse: inv?.decaisse ?? 0,
                iConsomme: inv?.consomme ?? 0,
                iSolde: inv?.soldeRestant ?? 0,
                aDecaisse: adm?.decaisse ?? 0,
                aConsomme: adm?.consomme ?? 0,
                aSolde: adm?.soldeRestant ?? 0,
                tDecaisse: (inv?.decaisse ?? 0) + (adm?.decaisse ?? 0),
                tConsomme: (inv?.consomme ?? 0) + (adm?.consomme ?? 0),
                tSolde: (inv?.soldeRestant ?? 0) + (adm?.soldeRestant ?? 0),
            });
        }
        if (note.investissementNonAffecte.decaisse !== 0 || note.administrationNonAffecte.decaisse !== 0) {
            const ligneNonAffecte = feuille.addRow({
                bailleur: 'NON AFFECTÉ (comptes 162-164/462-464 sans bailleur rattaché)',
                iDecaisse: note.investissementNonAffecte.decaisse,
                iConsomme: note.investissementNonAffecte.consomme,
                iSolde: note.investissementNonAffecte.soldeRestant,
                aDecaisse: note.administrationNonAffecte.decaisse,
                aConsomme: note.administrationNonAffecte.consomme,
                aSolde: note.administrationNonAffecte.soldeRestant,
                tDecaisse: note.investissementNonAffecte.decaisse + note.administrationNonAffecte.decaisse,
                tConsomme: note.investissementNonAffecte.consomme + note.administrationNonAffecte.consomme,
                tSolde: note.investissementNonAffecte.soldeRestant + note.administrationNonAffecte.soldeRestant,
            });
            ligneNonAffecte.font = { italic: true, color: { argb: 'FFB00020' } };
        }
        const ligneTotal = feuille.addRow({
            bailleur: 'TOTAL DES FONDS DU BAILLEUR',
            iDecaisse: note.totalInvestissement.decaisse,
            iConsomme: note.totalInvestissement.consomme,
            iSolde: note.totalInvestissement.soldeRestant,
            aDecaisse: note.totalAdministration.decaisse,
            aConsomme: note.totalAdministration.consomme,
            aSolde: note.totalAdministration.soldeRestant,
            tDecaisse: note.totalFondsDuBailleur.decaisse,
            tConsomme: note.totalFondsDuBailleur.consomme,
            tSolde: note.totalFondsDuBailleur.soldeRestant,
        });
        ligneTotal.font = ENTETE_FONT;
        this.appliquerFormats(feuille, {
            iDecaisse: FORMAT_MONTANT,
            iConsomme: FORMAT_MONTANT,
            iSolde: FORMAT_MONTANT,
            aDecaisse: FORMAT_MONTANT,
            aConsomme: FORMAT_MONTANT,
            aSolde: FORMAT_MONTANT,
            tDecaisse: FORMAT_MONTANT,
            tConsomme: FORMAT_MONTANT,
            tSolde: FORMAT_MONTANT,
        });
        this.piedDePageEtat(feuille, identite);
        const derniereNote9 = ligneTotal.number - 1;
        const enteteNote9 = this.coifferEtat(feuille, identite, 'NOTE 9 · FONDS DU BAILLEUR', 10);
        this.finaliserTableau(feuille, 10, derniereNote9 + 3, enteteNote9);
        const note9 = feuille.addRow([
            'Montants CUMULÉS depuis l’origine du projet, toutes périodes confondues · la Note 9 suit le cycle de vie du ' +
                'projet, pas l’exercice comptable. Décaissé = mouvements crédit (hors report à-nouveau) sur les sous-comptes ' +
                '162-164/462-464 rattachés au bailleur ; Consommé = mouvements débit ; Solde restant = Décaissé − Consommé. ' +
                'Les deux ambiguïtés du texte officiel sur ces montants sont résolues par lecture directe des écritures ' +
                '(Partie 3 ch. 3). La colonne « Date des décaissements » de la maquette n’est pas servie : le texte ne ' +
                'dit pas comment un montant consommé se rattache à un décaissement daté.',
        ]);
        note9.font = { italic: true, color: { argb: 'FF555555' } };
        feuille.mergeCells(`A${note9.number}:J${note9.number}`);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `note9-fonds-bailleur${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    valeurColonneNote(ligne, type, index) {
        if (ligne.saisie)
            return ligne.saisie[index] ?? null;
        switch (type) {
            case 'EXERCICE_N':
                return ligne.montantN;
            case 'EXERCICE_N1':
                return ligne.montantN1 ?? null;
            case 'VARIATION_VALEUR':
                return ligne.variationValeur ?? null;
            case 'VARIATION_POURCENT':
                return ligne.variationPourcent ?? null;
            case 'LIBRE':
                return ligne.saisieLibre?.[index] ?? null;
            default:
                return ligne.valeurs?.[type] ?? null;
        }
    }
    feuilleNote9FondsDuBailleur(classeur, note, tableaux, ident) {
        const somme = (a, b) => ({
            decaisse: a.decaisse + b.decaisse,
            consomme: a.consomme + b.consomme,
            soldeRestant: a.soldeRestant + b.soldeRestant,
        });
        const zero = { decaisse: 0, consomme: 0, soldeRestant: 0 };
        const bailleurs = new Map();
        for (const b of [...note.investissement, ...note.administration]) {
            bailleurs.set(b.bailleur.id, `${b.bailleur.code} · ${b.bailleur.nom}`);
        }
        const groupes = [...bailleurs].map(([id, titre]) => {
            const inv = note.investissement.find((b) => b.bailleur.id === id) ?? zero;
            const adm = note.administration.find((b) => b.bailleur.id === id) ?? zero;
            return { titre, inv, adm, total: somme(inv, adm) };
        });
        const nonAffecte = somme(note.investissementNonAffecte, note.administrationNonAffecte);
        if (nonAffecte.decaisse !== 0 || nonAffecte.consomme !== 0) {
            groupes.push({
                titre: 'NON AFFECTÉ (sans bailleur rattaché)',
                inv: note.investissementNonAffecte,
                adm: note.administrationNonAffecte,
                total: nonAffecte,
            });
        }
        groupes.push({
            titre: 'TOTAL',
            inv: note.totalInvestissement,
            adm: note.totalAdministration,
            total: note.totalFondsDuBailleur,
        });
        const ncols = 1 + 3 * groupes.length;
        const ws = classeur.addWorksheet('NOTE 9');
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'NOTE 9', ncols);
        (0, theme_etafi_2.titreNote)(ws, `NOTE 9 : ${(tableaux[0]?.titreNote ?? 'FONDS DU BAILLEUR').toUpperCase()}`, ncols);
        let r = 8;
        ws.getCell(r, 1).value = 'Libellés';
        (0, theme_etafi_2.fusion)(ws, r, 1, r + 1, 1);
        groupes.forEach((g, i) => {
            const c = 2 + 3 * i;
            ws.getCell(r, c).value = g.titre;
            (0, theme_etafi_2.fusion)(ws, r, c, r, c + 2);
            ['Montant décaissé', 'Montant consommé', 'Solde restant'].forEach((t, j) => {
                ws.getCell(r + 1, c + j).value = t;
            });
        });
        (0, theme_etafi_1.entetesBande)(ws, r, r + 1, 1, ncols);
        ws.getRow(r).height = 30;
        ws.getRow(r + 1).height = 30;
        const colsMontant = Array.from({ length: 3 * groupes.length }, (_, i) => 2 + i);
        r += 1;
        const ligne = (libelle, montants, niveau) => {
            r += 1;
            ws.getCell(r, 1).value = libelle;
            if (montants) {
                groupes.forEach((g, i) => {
                    const m = montants(g);
                    ws.getCell(r, 2 + 3 * i).value = m.decaisse;
                    ws.getCell(r, 3 + 3 * i).value = m.consomme;
                    ws.getCell(r, 4 + 3 * i).value = m.soldeRestant;
                });
            }
            (0, theme_etafi_1.styleLigne)(ws, r, 1, ncols, niveau, colsMontant);
            if (!montants)
                ws.getCell(r, 1).font = { name: 'Arial', size: 9, bold: true };
            ws.getRow(r).height = 18;
        };
        ligne("Fonds d'investissement", null, 'normal');
        ligne("TOTAL FONDS D'INVESTISSEMENT", (g) => g.inv, 'inter');
        ligne("Fonds d'administration", null, 'normal');
        ligne("TOTAL FONDS D'ADMINISTRATION", (g) => g.adm, 'inter');
        ligne('TOTAL DES FONDS DU BAILLEUR', (g) => g.total, 'inter');
        (0, theme_etafi_1.cadre)(ws, 8, 1, r, ncols, theme_etafi_1.MOYEN);
        const spec = tableaux[0];
        const commentaires = [
            'Montants cumulés depuis l\'origine du projet. La colonne « Date des décaissements » de la maquette n\'est ' +
                'pas servie : le texte ne dit pas comment un montant consommé se rattache à un décaissement daté. La ' +
                'colonne TOTAL, qui réunit les bailleurs, est une précision d\'OmegaX.',
        ];
        if (spec?.renvoyeeDepuis?.length)
            commentaires.push(`Renvoyée depuis les postes : ${spec.renvoyeeDepuis.join(', ')}.`);
        if (spec?.renvoiOfficiel)
            commentaires.push(spec.renvoiOfficiel);
        if (spec?.commentaire)
            commentaires.push(`Commentaire officiel : ${spec.commentaire}`);
        (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 2, commentaires.join(' '));
        ws.getColumn(1).width = 38;
        for (const c of colsMontant)
            ws.getColumn(c).width = 16;
        ws.views = [{ state: 'frozen', ySplit: 9, showGridLines: false }];
    }
    feuilleNote(classeur, tableaux, ident) {
        const code = tableaux[0].code;
        const nomFeuille = `NOTE ${code}`;
        const ws = classeur.addWorksheet(nomFeuille);
        const colMax = Math.max(...tableaux.map((t) => 1 + t.colonnes.length), 5);
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, nomFeuille, colMax);
        (0, theme_etafi_2.titreNote)(ws, `NOTE ${code} : ${(tableaux[0].titreNote ?? tableaux[0].titre).toUpperCase()}`, colMax);
        let r = 7;
        const commentaires = [];
        for (const note of tableaux) {
            const ncols = 1 + note.colonnes.length;
            r += 1;
            if (tableaux.length > 1 && note.sousTableau) {
                const c = ws.getCell(r, 1);
                c.value = note.sousTableau;
                c.font = { name: 'Arial', size: 9, bold: true };
                (0, theme_etafi_2.fusion)(ws, r, 1, r, ncols);
                r += 1;
            }
            const debutTableau = r;
            ws.getCell(r, 1).value = 'Libellés';
            note.colonnes.forEach((c, i) => {
                ws.getCell(r, 2 + i).value = c.libelle;
            });
            (0, theme_etafi_1.entetesBande)(ws, r, r, 1, ncols);
            ws.getRow(r).height = 30;
            const colsMontant = note.colonnes
                .map((c, i) => (c.type !== 'LIBRE' && c.type !== 'VARIATION_POURCENT' ? 2 + i : -1))
                .filter((x) => x > 0);
            const colsPourcent = note.colonnes
                .map((c, i) => (c.type === 'VARIATION_POURCENT' ? 2 + i : -1))
                .filter((x) => x > 0);
            const lignesImprimees = note.applicable ? note.lignes : [];
            if (lignesImprimees.length === 0) {
                r = (0, theme_etafi_1.bandeNeant)(ws, r + 1, ncols) - 1;
            }
            for (const l of lignesImprimees) {
                r += 1;
                ws.getCell(r, 1).value = l.libelle;
                note.colonnes.forEach((c, i) => {
                    const v = c.porteLeRenvoi ? (l.renvoi ?? null) : this.valeurColonneNote(l, c.type, i);
                    if (v !== null && v !== undefined)
                        ws.getCell(r, 2 + i).value = v;
                });
                (0, theme_etafi_1.styleLigne)(ws, r, 1, ncols, l.estTotal ? 'inter' : 'normal', colsMontant);
                for (const c of colsPourcent)
                    ws.getCell(r, c).numFmt = '#,##0.00"%"';
                ws.getRow(r).height = 18;
                if (l.enAttenteDeRattachement) {
                    ws.getCell(r, 1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFB00020' } };
                    ws.getCell(r, 1).note = `EN ATTENTE DE RATTACHEMENT : ${l.enAttenteDeRattachement}`;
                }
                if (l.ecartCloture !== undefined) {
                    ws.getCell(r, 1).note =
                        `Écart de clôture : ${l.ecartCloture.toFixed(2)} · la clôture recalculée (D = A + B − C) ne ` +
                            `correspond pas au solde réel de la balance. Anomalie du dossier à examiner (report à-nouveau ` +
                            `manquant, écriture hors comptes de la rubrique…).`;
                }
                for (const e of l.ecartsSaisie ?? []) {
                    ws.getCell(r, 2 + e.colonne).note =
                        `Contrôle : ${e.saisi === null ? 'cellule vide' : `saisi ${e.saisi.toFixed(2)}`}, attendu ` +
                            `${e.attendu.toFixed(2)} d'après les cellules saisies (formule du modèle).`;
                }
                if (l.echeanceNonVentilee !== undefined) {
                    const existante = ws.getCell(r, 1).note;
                    ws.getCell(r, 1).note =
                        (existante ? `${existante}\n` : '') +
                            `Part non ventilée par échéance (aucune date d'échéance saisie) : ${l.echeanceNonVentilee.toFixed(2)}.`;
                }
                if (l.renvoi && !note.colonnes.some((c) => c.porteLeRenvoi))
                    ws.getCell(r, ncols).note = l.renvoi;
            }
            (0, theme_etafi_1.cadre)(ws, debutTableau, 1, r, ncols, theme_etafi_1.MOYEN);
            r += 1;
            if (note.renvoyeeDepuis?.length)
                commentaires.push(`Renvoyée depuis les postes : ${note.renvoyeeDepuis.join(', ')}.`);
            if (note.renvoiOfficiel)
                commentaires.push(note.renvoiOfficiel);
            if (note.precisionEditeur)
                commentaires.push(`Précision d'OmegaX (pas du texte officiel) : ${note.precisionEditeur}`);
            if (note.commentaire)
                commentaires.push(`Commentaire officiel : ${note.commentaire}`);
            for (const phrase of note.commentaireServi ?? [])
                commentaires.push(phrase);
            for (const c of note.confrontations ?? []) {
                commentaires.push(`La somme des lignes saisies (« ${c.colonne} », ${montantNoteTexte(c.sommeSaisie)}) diffère de la ligne ` +
                    `« ${c.ligne} » lue en balance (${montantNoteTexte(c.montantBalance)}) · à rapprocher, rien n'est corrigé.`);
            }
            if (note.saisiesFormatAnterieur?.length) {
                commentaires.push('Saisie antérieure au format à huit colonnes « (M / F) », non répartie entre M et F, à reporter : ' +
                    note.saisiesFormatAnterieur.map((g) => `${g.rubrique} · ${g.colonneAnterieure} · ${g.valeur}`).join(' ; ') +
                    '.');
            }
            if (!note.applicable) {
                commentaires.push("NEANT : aucune rubrique de cette note n'est chiffrée ni renseignée sur l'exercice. La note est jointe à la liasse et " +
                    'cochée « N/A » sur la fiche récapitulative · elle figure pour attester qu\'elle a été examinée.');
            }
        }
        if (commentaires.length)
            (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 1, [...new Set(commentaires)].join(' '));
        const nbColonnesMax = Math.max(...tableaux.map((t) => t.colonnes.length));
        const spec = { A: 46 };
        for (let i = 0; i < nbColonnesMax; i++)
            spec[String.fromCharCode(66 + i)] = 18;
        (0, theme_etafi_1.largeurs)(ws, spec);
        ws.views = [{ state: 'frozen', ySplit: 7, showGridLines: false }];
    }
    feuilleFicheRecapitulative(classeur, fiche, ident, parties, notePied) {
        const parCode = new Map(fiche.map((n) => [n.code, n]));
        const groupes = (parties ?? [['NOTES ANNEXES', fiche.map((n) => n.code)]]).map(([titre, codes]) => [
            titre,
            codes
                .filter((code) => parCode.has(code))
                .map((code) => [`NOTE ${code}`, parCode.get(code).titre]),
        ]);
        const applicables = new Set(fiche.filter((n) => n.applicable).map((n) => `NOTE ${n.code}`));
        (0, theme_etafi_2.construireFicheNotes)(classeur, groupes, ident, applicables, undefined, notePied);
    }
    comparateurNotes(parties) {
        if (parties) {
            const rang = new Map();
            let i = 0;
            for (const [, codes] of parties)
                for (const code of codes)
                    rang.set(code, i++);
            return (a, b) => (rang.get(a) ?? 999) - (rang.get(b) ?? 999) || a.localeCompare(b);
        }
        const decompose = (code) => {
            const m = /^(\d+)([A-Z]*)$/.exec(code);
            return m ? [Number(m[1]), m[2]] : [999, code];
        };
        return (a, b) => {
            const [na, sa] = decompose(a);
            const [nb, sb] = decompose(b);
            return na - nb || sa.localeCompare(sb);
        };
    }
    construireClasseurNotes(resultat, ident, parties, classeur, feuillesPropres = {}, notePied) {
        const cible = classeur ?? this.nouveauClasseur();
        this.feuilleFicheRecapitulative(cible, resultat.ficheRecapitulative, ident, parties, notePied);
        const parCode = new Map();
        for (const n of resultat.notes) {
            parCode.set(n.code, [...(parCode.get(n.code) ?? []), n]);
        }
        const comparer = this.comparateurNotes(parties);
        for (const code of [...parCode.keys()].sort(comparer)) {
            const propre = feuillesPropres[code];
            if (propre)
                propre(cible, parCode.get(code));
            else
                this.feuilleNote(cible, parCode.get(code), ident);
        }
        return cible;
    }
    async notesAssociationsExcel(tenantId, exerciceId) {
        const [resultat, ident] = await Promise.all([
            this.noteAnnexeService.notesAssociations(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.construireClasseurNotes(resultat, ident, ExportService_1.PARTIES_NOTES_ASSOCIATIONS);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `notes-annexes-associations${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    async notesProjetExcel(tenantId, exerciceId) {
        const [resultat, ident] = await Promise.all([
            this.noteAnnexeService.notesProjet(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const note9 = await this.etatsFinanciersProjetService.noteBailleur(tenantId, exerciceId);
        const classeur = this.construireClasseurNotes(resultat, ident, ExportService_1.PARTIES_NOTES_PROJETS, undefined, {
            '9': (cible, tableaux) => this.feuilleNote9FondsDuBailleur(cible, note9, tableaux, ident),
        });
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `notes-annexes-projet${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    async registreDonateursExcel(tenantId, exerciceId) {
        const [lignes, rapport, identite] = await Promise.all([
            this.donationService.lister(tenantId, { exerciceId }),
            this.donationService.rapportConformite(tenantId, exerciceId),
            this.identiteEtat(tenantId, { exerciceId }),
        ]);
        const classeur = this.nouveauClasseur();
        this.feuilleRegistre(classeur, lignes, identite);
        this.feuilleConformite(classeur, rapport, identite);
        this.feuilleRapprochementRegistre(classeur, rapport.rapprochement, identite);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `registre-donateurs${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleRegistre(classeur, lignes, identite) {
        const feuille = classeur.addWorksheet('Registre des donateurs');
        feuille.columns = [
            { header: 'N°', key: 'numero', width: 7 },
            { header: 'Date de l’opération', key: 'dateOperation', width: 16 },
            { header: 'Nature', key: 'nature', width: 11 },
            { header: 'Type de donateur', key: 'typeDonateur', width: 18 },
            { header: 'Nom', key: 'nom', width: 20 },
            { header: 'Prénoms', key: 'prenoms', width: 20 },
            { header: 'Domicile', key: 'domicile', width: 26 },
            { header: 'Dénomination', key: 'denomination', width: 26 },
            { header: 'N° d’immatriculation', key: 'numeroImmatriculation', width: 22 },
            { header: 'N° d’identification fiscale', key: 'numeroIdentificationFiscale', width: 22 },
            { header: 'Adresse du siège social', key: 'adresseSiegeSocial', width: 28 },
            { header: 'Adresse électronique', key: 'adresseElectronique', width: 26 },
            { header: 'Montant', key: 'montant', width: 14 },
            { header: 'Mode de libération', key: 'modeLiberation', width: 18 },
            { header: 'Désignation du bien (nature)', key: 'designationNature', width: 30 },
            { header: 'Signée par (représentant légal)', key: 'signeePar', width: 28 },
            { header: 'Signée le', key: 'signeeLe', width: 16 },
            { header: 'Écriture comptable', key: 'ecriture', width: 24 },
            { header: 'Annulée', key: 'annulee', width: 9 },
            { header: 'Motif d’annulation', key: 'motifAnnulation', width: 34 },
            { header: 'Mentions manquantes', key: 'manquements', width: 34 },
        ];
        for (const d of lignes) {
            const rang = feuille.addRow({
                ...d,
                dateOperation: new Date(d.dateOperation),
                signeeLe: d.signeeLe ? new Date(d.signeeLe) : null,
                ecriture: d.ecriture ? `${d.ecriture.numeroPiece ?? ''} ${d.ecriture.libelle}`.trim() : '',
                annulee: d.annulee ? 'OUI' : '',
                manquements: (0, donation_service_1.manquementsArticle17)(d).map((m) => m.champ).join(', '),
            });
            if (d.annulee)
                rang.font = { strike: true, color: { argb: 'FF999999' } };
        }
        this.appliquerFormats(feuille, { dateOperation: FORMAT_DATE, signeeLe: FORMAT_DATE, montant: FORMAT_MONTANT });
        this.piedDePageEtat(feuille, identite);
        const entete = this.coifferEtat(feuille, identite, 'REGISTRE DES DONATEURS', feuille.columns.length);
        this.finaliserTableau(feuille, feuille.columns.length, lignes.length + 1 + 3, entete);
    }
    feuilleConformite(classeur, rapport, identite) {
        const feuille = classeur.addWorksheet('Conformité (art. 18)');
        feuille.columns = [
            { header: 'Constatation', key: 'constatation', width: 44 },
            { header: 'Résultat', key: 'resultat', width: 22 },
            { header: 'Fondement / détail', key: 'detail', width: 96 },
        ];
        const n = rapport.numerotation;
        const nonSignees = rapport.signature.lignesNonSignees;
        const incompletes = rapport.completude.lignesIncompletes;
        const constats = [
            [
                'Existence du registre',
                rapport.existence.registreOuvert ? 'OUI' : 'NON',
                `Art. 18 : le rapport « constate l’existence du registre des donateurs ». ${rapport.existence.lignesTotalRegistre} ligne(s) au registre, dont ${rapport.existence.lignesSurExercice} sur l’exercice (${rapport.existence.lignesAnnuleesSurExercice} annulée(s)).`,
            ],
            [
                'Numérotation continue',
                n.continue ? 'CONFORME' : 'NON CONFORME',
                `${n.exigence} Numéros ${n.premier ?? ''} à ${n.dernier ?? ''}.` +
                    (n.trous.length ? ` Trous : ${n.trous.join(', ')}.` : '') +
                    (n.doublons.length ? ` Doublons : ${n.doublons.join(', ')}.` : ''),
            ],
            [
                'Signature du représentant légal',
                nonSignees.length === 0 ? 'CONFORME' : `${nonSignees.length} ligne(s) non signée(s)`,
                `${rapport.signature.exigence}` +
                    (nonSignees.length ? ` Lignes n° ${nonSignees.map((l) => l.numero).join(', ')}.` : ''),
            ],
            [
                'Contenu obligatoire (art. 17, points 1 à 4)',
                incompletes.length === 0 ? 'CONFORME' : `${incompletes.length} ligne(s) incomplète(s)`,
                incompletes.length
                    ? incompletes
                        .map((l) => `n° ${l.numero} : ${l.manquements.map((m) => m.champ).join(', ')}`)
                        .join(' ; ')
                    : 'Toutes les mentions exigées sont renseignées.',
            ],
            [
                'Rapprochement avec la comptabilité',
                rapport.rapprochement.rapproche ? 'RAPPROCHÉ' : `Écart de ${rapport.rapprochement.ecart}`,
                rapport.rapprochement.lecture,
            ],
        ];
        for (const [constatation, resultat, detail] of constats) {
            const rang = feuille.addRow({ constatation, resultat, detail });
            const conforme = ['OUI', 'CONFORME', 'RAPPROCHÉ'].includes(resultat);
            rang.getCell('resultat').font = { bold: true, color: { argb: conforme ? 'FF1B7F3B' : 'FFB3261E' } };
            rang.getCell('detail').alignment = { wrapText: true, vertical: 'top' };
        }
        this.piedDePageEtat(feuille, identite);
        const entete = this.coifferEtat(feuille, identite, 'REGISTRE DES DONATEURS · CONFORMITÉ (ART. 18)', 3);
        this.finaliserTableau(feuille, 3, constats.length + 1 + 3, entete);
        const reserve = feuille.addRow([
            'Ces constatations ne valent pas avis. Art. 18 : « S’il existe un auditeur, ce dernier soumet […] un rapport qui constate l’existence du registre des donateurs et donne son avis sur sa tenue conforme. S’il n’existe pas d’auditeur, une déclaration des dirigeants attestant de la tenue conforme du registre des donateurs est annexée audit rapport ou soumise à l’assemblée générale ou l’instance qui en tient lieu. »',
        ]);
        reserve.font = { italic: true, color: { argb: 'FF555555' } };
        feuille.mergeCells(`A${reserve.number}:C${reserve.number}`);
    }
    feuilleRapprochementRegistre(classeur, r, identite) {
        const feuille = classeur.addWorksheet('Rapprochement comptable');
        feuille.columns = [
            { header: 'Catégorie', key: 'categorie', width: 22 },
            { header: 'Compte', key: 'numero', width: 10 },
            { header: 'Intitulé', key: 'intitule', width: 52 },
            { header: 'Lecture', key: 'lecture', width: 14 },
            { header: 'Montant', key: 'montant', width: 14 },
            { header: 'Fondement (texte officiel)', key: 'fondement', width: 110 },
        ];
        const bloc = (categorie, comptes) => {
            for (const c of comptes) {
                const rang = feuille.addRow({ categorie, ...c });
                rang.getCell('fondement').alignment = { wrapText: true, vertical: 'top' };
                if (categorie !== 'Libéralité')
                    rang.font = { color: { argb: 'FF777777' } };
            }
        };
        bloc('Libéralité', r.comptesLiberalite);
        bloc('Frontière', r.comptesFrontiere);
        bloc('Hors périmètre', r.comptesHorsPerimetre);
        const derniere = feuille.lastRow.number;
        this.appliquerFormats(feuille, { montant: FORMAT_MONTANT });
        this.piedDePageEtat(feuille, identite);
        const entete = this.coifferEtat(feuille, identite, 'REGISTRE DES DONATEURS · RAPPROCHEMENT COMPTABLE', 6);
        this.finaliserTableau(feuille, 6, derniere + 3, entete);
        feuille.addRow([]);
        const totaux = [
            ['Total comptabilisé (comptes « Libéralité » seuls)', r.totalComptable],
            ['Total du registre sur l’exercice', r.totalRegistre],
            ['Écart', r.ecart],
        ];
        for (const [libelle, valeur] of totaux) {
            const rang = feuille.addRow({ intitule: libelle, montant: valeur });
            rang.font = ENTETE_FONT;
            rang.getCell('montant').numFmt = FORMAT_MONTANT;
        }
        const lecture = feuille.addRow({ intitule: r.lecture });
        lecture.font = { italic: true, color: { argb: r.rapproche ? 'FF1B7F3B' : 'FFB3261E' } };
        const avertissement = feuille.addRow([r.avertissement]);
        avertissement.font = { italic: true, color: { argb: 'FF555555' } };
        avertissement.alignment = { wrapText: true, vertical: 'top' };
        feuille.mergeCells(`A${avertissement.number}:F${avertissement.number}`);
    }
    get testIsa240() {
        if (!this.testEcrituresJournal) {
            throw new Error("Sélection ISA 240 absente de l'injection : export impossible");
        }
        return this.testEcrituresJournal;
    }
    async testEcrituresJournalExcel(tenantId, exerciceId) {
        const r = await this.testIsa240.selection(tenantId, exerciceId, ExportService_1.MAX_LIGNES_CLASSEUR_EN_MEMOIRE);
        this.refuserClasseurEnMemoire(r.totalRetenues, "Test des écritures de journal (ISA 240)", "Une sélection de cette taille ne se lit plus comme un échantillon · le journal complet s'exporte en flux depuis la fenêtre Journal.");
        const identite = await this.identiteEtat(tenantId, { exerciceId });
        const classeur = this.nouveauClasseur();
        const garde = classeur.addWorksheet('Critères');
        garde.columns = [
            { header: 'Critère', key: 'titre', width: 38 },
            { header: 'Source', key: 'source', width: 26 },
            { header: 'Texte cité', key: 'citation', width: 60 },
            { header: 'Ce qui est mesuré', key: 'mesure', width: 60 },
            { header: 'Écritures retenues', key: 'nombre', width: 18 },
        ];
        for (const c of r.criteres) {
            const rang = garde.addRow({
                titre: c.titre,
                source: c.source,
                citation: `« ${c.citation} »`,
                mesure: c.mesure,
                nombre: r.parCritere.find((p) => p.cle === c.cle)?.nombre ?? 0,
            });
            for (const cle of ['citation', 'mesure']) {
                rang.getCell(cle).alignment = { wrapText: true, vertical: 'top' };
            }
        }
        const pied = garde.addRow([
            `${r.selection.length} écriture(s) retenue(s) sur ${r.totalEcritures} · une écriture peut relever ` +
                'de plusieurs critères. Aucune n\'est présentée comme douteuse : la norme demande de SÉLECTIONNER ' +
                "(ISA 240, § 33 a) ii)), le test reste celui de l'auditeur. Les seuils sont des conventions de " +
                "lecture d'OmegaX · la norme n'en fixe aucun.",
        ]);
        pied.font = { italic: true, color: { argb: 'FF555555' } };
        pied.alignment = { wrapText: true, vertical: 'top' };
        garde.mergeCells(`A${pied.number}:E${pied.number}`);
        this.finaliserTableau(garde, 5, r.criteres.length + 1);
        const feuille = classeur.addWorksheet('Écritures sélectionnées');
        feuille.columns = [
            { header: 'Date comptable', key: 'date', width: 15 },
            { header: 'Journal', key: 'journal', width: 10 },
            { header: 'N° pièce', key: 'numeroPiece', width: 10 },
            { header: 'Référence', key: 'reference', width: 16 },
            { header: 'Libellé', key: 'libelle', width: 40 },
            { header: 'Montant', key: 'montant', width: 16 },
            { header: 'Statut', key: 'statut', width: 12 },
            { header: 'Saisie le', key: 'saisieLe', width: 18 },
            { header: 'Saisie par', key: 'saisiePar', width: 30 },
            { header: 'Rôle', key: 'roleAuteur', width: 16 },
            { header: 'Validée le', key: 'valideeLe', width: 18 },
            { header: 'Validée par', key: 'valideePar', width: 30 },
            { header: 'Jours entre date et saisie', key: 'ecart', width: 24 },
            { header: 'Comptes rarement utilisés', key: 'comptesRares', width: 28 },
            { header: 'Critères', key: 'criteres', width: 44 },
        ];
        for (const e of r.selection) {
            const rang = feuille.addRow({
                date: e.date,
                journal: e.journal,
                numeroPiece: e.numeroPiece,
                reference: e.reference ?? '',
                libelle: e.libelle,
                montant: e.montant,
                statut: (0, ecritures_de_situation_1.libelleDuStatut)(e.statut),
                saisieLe: e.saisieLe,
                saisiePar: e.saisiePar,
                roleAuteur: e.roleAuteur ?? '',
                valideeLe: e.valideeLe,
                valideePar: e.valideePar ?? '',
                ecart: e.joursEntreDateEtSaisie,
                comptesRares: e.comptesRares.join(', '),
                criteres: e.criteres
                    .map((c) => r.criteres.find((k) => k.cle === c)?.titre ?? c)
                    .join(' · '),
            });
            rang.getCell('criteres').alignment = { wrapText: true, vertical: 'top' };
        }
        this.appliquerFormats(feuille, {
            date: FORMAT_DATE,
            montant: FORMAT_MONTANT,
            saisieLe: FORMAT_DATE_HEURE,
            valideeLe: FORMAT_DATE_HEURE,
        });
        this.piedDePageEtat(feuille, identite);
        const derniereLigneDonnees = feuille.rowCount;
        const entete = this.coifferEtat(feuille, identite, 'TEST DES ÉCRITURES DE JOURNAL · ISA 240', feuille.columns.length);
        this.finaliserTableau(feuille, feuille.columns.length, derniereLigneDonnees + 3, entete);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `test-ecritures-journal-isa-240${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    async livreInventaireExcel(tenantId, exerciceId) {
        const [transcription, conformite, identite] = await Promise.all([
            this.livreInventaire.courante(tenantId, exerciceId),
            this.livreInventaire.conformite(tenantId, exerciceId),
            this.identiteEtat(tenantId, { exerciceId }),
        ]);
        const classeur = this.nouveauClasseur();
        this.feuilleGardeInventaire(classeur, conformite, transcription, identite);
        if (transcription) {
            const etats = transcription.etats;
            for (const e of conformite.etatsExiges) {
                const etat = etats[e.cle];
                if (etat)
                    this.feuilleEtatFige(classeur, e.libelle, etat, identite);
            }
        }
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `livre-inventaire${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleGardeInventaire(classeur, c, t, identite) {
        const feuille = classeur.addWorksheet("Livre d'inventaire");
        feuille.columns = [
            { header: 'Rubrique', key: 'rubrique', width: 44 },
            { header: 'État', key: 'etat', width: 24 },
            { header: 'Détail', key: 'detail', width: 110 },
        ];
        const lignes = [
            ["Transcription de l'exercice", t ? `VERSION ${t.version}` : 'ABSENTE', c.exigence],
            ['Texte applicable', c.fondement.article, c.fondement.perimetre],
            ...c.etatsExiges.map((e) => [
                `État exigé · ${e.libelle}`,
                e.transcrit ? 'TRANSCRIT' : 'MANQUANT',
                e.motifIndisponibilite ?? 'Transcrit et figé dans ce classeur, feuille dédiée.',
            ]),
            [
                "Résumé de l'opération d'inventaire",
                c.resume.renseigne ? 'RENSEIGNÉ' : 'MANQUANT',
                `${c.resume.exigence} ${c.resume.remarque}`,
            ],
        ];
        for (const [rubrique, etat, detail] of lignes) {
            const rang = feuille.addRow({ rubrique, etat, detail });
            const ok = ['TRANSCRIT', 'RENSEIGNÉ'].includes(etat) || etat.startsWith('VERSION') || etat === c.fondement.article;
            rang.getCell('etat').font = { bold: true, color: { argb: ok ? 'FF1B7F3B' : 'FFB3261E' } };
            rang.getCell('detail').alignment = { wrapText: true, vertical: 'top' };
        }
        this.piedDePageEtat(feuille, identite);
        const entete = this.coifferEtat(feuille, identite, "LIVRE D'INVENTAIRE", 3);
        this.finaliserTableau(feuille, 3, lignes.length + 1 + 3, entete);
        if (t?.resumeOperationInventaire) {
            feuille.addRow([]);
            const titre = feuille.addRow(["Résumé de l'opération d'inventaire"]);
            titre.font = ENTETE_FONT;
            const texte = feuille.addRow([t.resumeOperationInventaire]);
            texte.alignment = { wrapText: true, vertical: 'top' };
            feuille.mergeCells(`A${texte.number}:C${texte.number}`);
        }
        const pied = feuille.addRow([
            t
                ? `Transcrit le ${new Date(t.transcritLe).toLocaleDateString('fr-FR')}. Les états des feuilles suivantes sont FIGÉS à cette date : ils sont relus tels quels, jamais recalculés · c'est le sens du mot « transcrits » (${c.fondement.article}).`
                : `Aucune transcription pour cet exercice. Sanction pénale : ${c.fondement.sanction}.`,
        ]);
        pied.font = { italic: true, color: { argb: 'FF555555' } };
        pied.alignment = { wrapText: true, vertical: 'top' };
        feuille.mergeCells(`A${pied.number}:C${pied.number}`);
    }
    feuilleEtatFige(classeur, libelle, etat, identite) {
        const feuille = classeur.addWorksheet(libelle.slice(0, 31));
        feuille.columns = [
            { header: 'Section', key: 'section', width: 22 },
            { header: 'REF', key: 'ref', width: 8 },
            { header: 'Libellé', key: 'libelle', width: 62 },
            { header: 'Exercice N', key: 'montant', width: 16 },
            { header: 'Exercice N-1', key: 'montantN1', width: 16 },
        ];
        const estPoste = (v) => v !== null && typeof v === 'object' && ('ref' in v || 'section' in v) && !Array.isArray(v);
        let sectionCourante = '';
        for (const [cle, valeur] of Object.entries(etat ?? {})) {
            if (!Array.isArray(valeur) || valeur.length === 0 || !valeur.some(estPoste))
                continue;
            sectionCourante = enMots(cle);
            const entete = feuille.addRow({ section: sectionCourante });
            entete.font = ENTETE_FONT;
            for (const l of valeur) {
                if (l.section) {
                    const s = feuille.addRow({ libelle: l.section });
                    s.font = { italic: true, bold: true };
                    continue;
                }
                const rang = feuille.addRow({
                    ref: l.ref,
                    libelle: l.libelle,
                    montant: l.montant,
                    montantN1: l.montantN1,
                });
                if (l.estTotal)
                    rang.font = ENTETE_FONT;
            }
        }
        this.appliquerFormats(feuille, { montant: FORMAT_MONTANT, montantN1: FORMAT_MONTANT });
        const derniereFigee = feuille.lastRow?.number ?? 1;
        this.piedDePageEtat(feuille, identite);
        const enteteFige = this.coifferEtat(feuille, identite, `LIVRE D'INVENTAIRE · ${libelle.toUpperCase()}`, 5);
        this.finaliserTableau(feuille, 5, derniereFigee + 3, enteteFige);
        const scalaires = Object.entries(etat ?? {}).filter(([, v]) => typeof v === 'number' || typeof v === 'boolean');
        const controle = (etat ?? {}).controle;
        if (scalaires.length > 0 || controle) {
            feuille.addRow([]);
            const titre = feuille.addRow({ section: 'Totaux et contrôles figés' });
            titre.font = ENTETE_FONT;
            for (const [cle, v] of scalaires) {
                const rang = feuille.addRow({ libelle: enMots(cle), montant: typeof v === 'number' ? v : undefined });
                if (typeof v === 'boolean')
                    rang.getCell('libelle').value = `${enMots(cle)} : ${v ? 'oui' : 'NON'}`;
                rang.getCell('montant').numFmt = FORMAT_MONTANT;
            }
            if (controle && typeof controle === 'object') {
                for (const [cle, v] of Object.entries(controle)) {
                    const rang = feuille.addRow({
                        libelle: typeof v === 'boolean' ? `${enMots(cle)} : ${v ? 'oui' : 'NON'}` : enMots(cle),
                        montant: typeof v === 'number' ? v : undefined,
                    });
                    rang.getCell('montant').numFmt = FORMAT_MONTANT;
                    if (typeof v === 'boolean' && !v)
                        rang.font = { bold: true, color: { argb: 'FFB3261E' } };
                }
            }
        }
    }
    async rapportActiviteExcel(tenantId, exerciceId) {
        const dossier = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, formeJuridiqueSyscohada: true, formeJuridiqueSyscohadaAnterieure: true, dateTransformationForme: true },
        });
        const referentiel = dossier.referentiel;
        let formeJuridiqueSyscohada = dossier.formeJuridiqueSyscohada;
        if (dossier.dateTransformationForme) {
            const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { dateFin: true } });
            if (!exercice)
                throw new common_1.NotFoundException(etats_financiers_communs_1.MOTIF_EXERCICE_INTROUVABLE);
            formeJuridiqueSyscohada = (0, forme_applicable_1.formeApplicable)(dossier, exercice.dateFin);
        }
        const [rapport, conformite, identite] = await Promise.all([
            this.rapportActivite.courant(tenantId, exerciceId),
            referentiel === client_1.Referentiel.SYSCOHADA
                ? this.rapportActivite.conformiteRapportGestion(tenantId, exerciceId)
                : this.rapportActivite.conformite(tenantId, exerciceId),
            this.identiteEtat(tenantId, { exerciceId }),
        ]);
        const regleSyscohada = (0, correspondance_inventaire_syscohada_1.regleRapportGestion)(formeJuridiqueSyscohada);
        const sections = referentiel === client_1.Referentiel.SYSCOHADA
            ? regleSyscohada.genre === 'EXIGE'
                ? regleSyscohada.sections
                : []
            : correspondance_inventaire_1.SECTIONS_RAPPORT_ACTIVITE;
        const classeur = this.nouveauClasseur();
        const feuille = classeur.addWorksheet(referentiel === client_1.Referentiel.SYSCOHADA ? 'Rapport de gestion' : "Rapport d'activité");
        feuille.columns = [
            { header: 'Section', key: 'titre', width: 46 },
            { header: 'État', key: 'etat', width: 14 },
            { header: 'Contenu', key: 'contenu', width: 90 },
            { header: 'Exigence (texte officiel)', key: 'exigence', width: 96 },
        ];
        const contenus = referentiel === client_1.Referentiel.SYSCOHADA
            ? (rapport?.sections ?? {})
            : (rapport ?? {});
        for (const s of sections) {
            const brut = contenus[s.cle];
            const contenu = typeof brut === 'string' && brut.trim() ? brut : null;
            const rang = feuille.addRow({
                titre: s.titre,
                etat: contenu ? 'RENSEIGNÉE' : 'VIDE',
                contenu: contenu ?? '',
                exigence: s.exigence,
            });
            rang.getCell('etat').font = { bold: true, color: { argb: contenu ? 'FF1B7F3B' : 'FFB3261E' } };
            for (const cle of ['contenu', 'exigence'])
                rang.getCell(cle).alignment = { wrapText: true, vertical: 'top' };
        }
        this.piedDePageEtat(feuille, identite);
        const enteteRapport = this.coifferEtat(feuille, identite, referentiel === client_1.Referentiel.SYSCOHADA ? 'RAPPORT DE GESTION' : "RAPPORT D'ACTIVITÉ", 4);
        this.finaliserTableau(feuille, 4, sections.length + 1 + 3, enteteRapport);
        feuille.addRow([]);
        const f = conformite.fenetreEvenementsPosterieurs;
        const meta = [
            ["Date d'établissement", rapport ? new Date(rapport.etabliLe).toLocaleDateString('fr-FR') : 'Rapport non établi'],
            [
                'Fenêtre des événements postérieurs',
                f
                    ? `du ${new Date(f.du).toLocaleDateString('fr-FR')} au ${new Date(f.au).toLocaleDateString('fr-FR')} · c'est la date d'établissement qui la ferme (${f.article}).`
                    : '·',
            ],
            [
                'Évolution de la trésorerie (figée du Tableau des flux)',
                conformite.tresorerie
                    ? `ouverture ${conformite.tresorerie.ouverture ?? 'non servie'} · variation ${conformite.tresorerie.variation ?? 'non servie'} · clôture ${conformite.tresorerie.cloture}` +
                        (conformite.tresorerie.boucle === null
                            ? ` · contrôle non effectué : ${conformite.tresorerie.motifNonControlable ?? 'ouverture ou variation laissée vide'}`
                            : conformite.tresorerie.boucle
                                ? ' · tableau bouclé'
                                : ' · ⚠ TABLEAU NON BOUCLÉ à cette date')
                    : '·',
            ],
        ];
        const mentionTransformation = 'mentionTransformation' in conformite ? conformite.mentionTransformation : null;
        if (mentionTransformation)
            meta.push(['Transformation de la société', mentionTransformation]);
        const declaration = referentiel === client_1.Referentiel.SYCEBNL && 'declarationRegistreDonateurs' in conformite
            ? conformite.declarationRegistreDonateurs
            : null;
        if (declaration) {
            meta.push([
                'Déclaration des dirigeants (registre des donateurs, art. 18)',
                declaration.attendue
                    ? declaration.renseignee
                        ? `Annexée. Registre ${declaration.registreConforme ? 'conforme' : '⚠ NON CONFORME au rapport de l’art. 18'}.`
                        : "⚠ ATTENDUE et absente : l'entité déclare n'avoir pas d'auditeur."
                    : "Non attendue : l'entité déclare avoir un auditeur, qui produit son propre rapport (art. 18).",
            ]);
        }
        for (const [libelle, valeur] of meta) {
            const rang = feuille.addRow({ titre: libelle, contenu: valeur });
            rang.font = ENTETE_FONT;
            rang.getCell('contenu').alignment = { wrapText: true, vertical: 'top' };
            rang.getCell('contenu').font = { bold: false };
        }
        if (rapport?.declarationDirigeants) {
            feuille.addRow([]);
            const d = feuille.addRow({ titre: 'Texte de la déclaration', contenu: rapport.declarationDirigeants });
            d.getCell('contenu').alignment = { wrapText: true, vertical: 'top' };
        }
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `rapport-activite${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleEmploisRessourcesEtafi(classeur, er, ident) {
        const ws = classeur.addWorksheet('Emplois-Ressources');
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'EMPLOIS-RESSOURCES\nPROJETS DE\nDEVELOPPEMENT', 5);
        (0, theme_etafi_1.titreEtat)(ws, 'TABLEAU EMPLOIS-RESSOURCES', 1, 5, 7, 14);
        let r = 8;
        for (const [i, h] of [
            'REF',
            'DESIGNATION',
            'SOLDE CUMULE DEBUT EXERCICE N',
            'EXERCICE N',
            'SOLDE CUMULE FIN EXERCICE N',
        ].entries()) {
            ws.getCell(r, i + 1).value = h;
        }
        (0, theme_etafi_1.entetesBande)(ws, r, r, 1, 5);
        ws.getRow(r).height = 30;
        const rangsParRef = new Map();
        const rangs = new Map();
        for (const l of er.lignes) {
            r += 1;
            rangsParRef.set(l.ref, [...(rangsParRef.get(l.ref) ?? []), r]);
            if (!rangs.has(l.ref))
                rangs.set(l.ref, r);
            ws.getCell(r, 1).value = l.ref;
            ws.getCell(r, 2).value = l.libelle;
            if (!etat_etafi_1.TOTAUX_TER[l.ref]) {
                ws.getCell(r, 3).value = l.montantCumulDebut;
                ws.getCell(r, 4).value = l.montant;
                ws.getCell(r, 5).value = correspondance_projet_emplois_ressources_1.REFS_DE_SOLDE.includes(l.ref)
                    ? l.montantCumulFin
                    : { formula: `C${r}+D${r}` };
            }
            (0, theme_etafi_1.styleLigne)(ws, r, 1, 5, etat_etafi_1.NIVEAUX_TER[l.ref] ?? 'normal', [3, 4, 5], 1);
            ws.getRow(r).height = 22;
        }
        for (const [ref, expression] of Object.entries(etat_etafi_1.TOTAUX_TER)) {
            const rang = rangs.get(ref);
            if (!rang)
                continue;
            for (const col of [3, 4, 5]) {
                const lettre = String.fromCharCode(64 + col);
                const formule = expression.replace(/[A-Z]{2}/g, (composante) => {
                    const rr = rangsParRef.get(composante) ?? [];
                    if (rr.length === 0)
                        return '0';
                    const cellules = rr.map((n) => `${lettre}${n}`).join('+');
                    return rr.length === 1 ? cellules : `(${cellules})`;
                });
                ws.getCell(rang, col).value = { formula: formule };
            }
        }
        (0, theme_etafi_1.cadre)(ws, 8, 1, r, 5, theme_etafi_1.MOYEN);
        r += 2;
        (0, etat_etafi_1.ligneControleSousEtat)(ws, r, 'Colonnes C et E · cumul depuis l\'origine du dossier, écritures de report à-nouveau exclues et bilan ' +
            "d'ouverture compris. Elles suivent la convention de financement, pas l'exercice comptable. La ligne VII " +
            'contrôle V = VI, et ce contrôle vaut pour chacune des trois colonnes.');
        (0, theme_etafi_1.largeurs)(ws, { A: 7, B: 56, C: 19, D: 17, E: 19 });
        ws.views = [{ state: 'frozen', ySplit: 8, showGridLines: false }];
        return rangs;
    }
    async emploisRessourcesExcel(tenantId, exerciceId) {
        const [er, ident] = await Promise.all([
            this.etatsFinanciersProjetService.tableauEmploisRessources(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        this.feuilleEmploisRessourcesEtafi(classeur, er, ident);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `emplois-ressources${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleExecutionBudgetaireEtafi(classeur, eb, ident) {
        const ws = classeur.addWorksheet('Execution budgetaire');
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'EXECUTION BUDGETAIRE\nPROJETS DE\nDEVELOPPEMENT', 8);
        (0, theme_etafi_1.titreEtat)(ws, "TABLEAU DE SUIVI D'EXECUTION DU BUDGET", 1, 8, 7, 14);
        let r = 8;
        for (const [i, h] of [
            'Code',
            'Libellé',
            "Budget de l'exercice (1)",
            'Décaissement (2)',
            'Engagement (3)',
            'Réalisation (4 = 2 + 3)',
            'Crédit disponible (5 = 1 - 4)',
            'Exécution budget % (4/1)',
        ].entries()) {
            ws.getCell(r, i + 1).value = h;
        }
        (0, theme_etafi_1.entetesBande)(ws, r, r, 1, 8);
        ws.getRow(r).height = 34;
        const debut = r + 1;
        const rangsFeuilles = [];
        for (const l of eb.lignes) {
            r += 1;
            if (!l.estRubrique)
                rangsFeuilles.push(r);
            ws.getCell(r, 1).value = l.code;
            ws.getCell(r, 2).value = l.libelle;
            ws.getCell(r, 3).value = l.budget;
            ws.getCell(r, 4).value = l.decaissement;
            ws.getCell(r, 5).value = l.engagement;
            ws.getCell(r, 6).value = { formula: `D${r}+E${r}` };
            ws.getCell(r, 7).value = { formula: `C${r}-F${r}` };
            ws.getCell(r, 8).value = { formula: `IF(C${r}=0,"",F${r}/C${r})` };
            (0, theme_etafi_1.styleLigne)(ws, r, 1, 8, l.estRubrique ? 'inter' : 'normal', [3, 4, 5, 6, 7]);
            ws.getCell(r, 8).numFmt = '0.0%';
        }
        r += 1;
        ws.getCell(r, 2).value = 'TOTAL';
        const totalDuService = {
            3: eb.total?.budget ?? 0,
            4: eb.total?.decaissement ?? 0,
            5: eb.total?.engagement ?? 0,
            6: eb.total?.realisation ?? 0,
            7: eb.total?.creditDisponible ?? 0,
        };
        const aDesRubriques = rangsFeuilles.length !== eb.lignes.length;
        for (const col of [3, 4, 5, 6, 7]) {
            const lettre = String.fromCharCode(64 + col);
            if (!aDesRubriques) {
                ws.getCell(r, col).value = { formula: `SUM(${lettre}${debut}:${lettre}${r - 1})` };
                continue;
            }
            const termes = rangsFeuilles.map((rang) => `${lettre}${rang}`).join(',');
            ws.getCell(r, col).value =
                termes.length > 0 && termes.length <= 2000 ? { formula: `SUM(${termes})` } : totalDuService[col];
        }
        ws.getCell(r, 8).value = { formula: `IF(C${r}=0,"",F${r}/C${r})` };
        (0, theme_etafi_1.styleLigne)(ws, r, 1, 8, 'inter', [3, 4, 5, 6, 7]);
        ws.getCell(r, 8).numFmt = '0.0%';
        (0, theme_etafi_1.cadre)(ws, 8, 1, r, 8, theme_etafi_1.MOYEN);
        r += 2;
        (0, etat_etafi_1.ligneControleSousEtat)(ws, r, `Nomenclature budgétaire : plan analytique « ${eb.plan.code} · ${eb.plan.intitule} ». ` +
            'Décaissement = dépense payée (trésorerie touchée ou fournisseur lettré). ' +
            `Engagement = dépense constatée non payée (${(eb.total?.engagementComptable ?? 0).toLocaleString('fr-FR')}) ` +
            '+ reste à exécuter des bons de commande et contrats du registre des engagements ' +
            `(${(eb.total?.engagementHorsComptabilite ?? 0).toLocaleString('fr-FR')}).`);
        (0, theme_etafi_1.largeurs)(ws, { A: 10, B: 40, C: 16, D: 15, E: 15, F: 16, G: 17, H: 14 });
        ws.views = [{ state: 'frozen', ySplit: 8, showGridLines: false }];
        return r;
    }
    feuilleExecutionBudgetaireVierge(classeur, ident, raison) {
        const eb = {
            plan: { id: '', code: '·', intitule: 'aucun plan analytique à budgets' },
            lignes: Array.from({ length: 14 }, () => ({
                code: '',
                libelle: '',
                budget: null,
                decaissement: null,
                engagement: null,
                realisation: 0,
                creditDisponible: 0,
                executionPourcent: null,
            })),
        };
        const dernier = this.feuilleExecutionBudgetaireEtafi(classeur, eb, ident);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Execution budgetaire'), dernier + 1, raison);
    }
    async executionBudgetaireExcel(tenantId, exerciceId, planId) {
        const [eb, ident] = await Promise.all([
            this.etatsFinanciersProjetBudgetService.executionBudgetaire(tenantId, exerciceId, planId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        this.feuilleExecutionBudgetaireEtafi(classeur, eb, ident);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `execution-budgetaire${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleReconciliationEtafi(classeur, recon, ident) {
        const ws = classeur.addWorksheet('Reconciliation tresorerie');
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'RECONCILIATION\nPROJETS DE\nDEVELOPPEMENT', 3);
        (0, theme_etafi_1.titreEtat)(ws, 'TABLEAU DE RECONCILIATION DE LA TRESORERIE', 1, 3, 7, 14);
        let r = 8;
        ws.getCell(r, 1).value = 'LIBELLE';
        ws.getCell(r, 2).value = 'REP.';
        ws.getCell(r, 3).value = 'MONTANT';
        (0, theme_etafi_1.entetesBande)(ws, r, r, 1, 3);
        ws.getRow(r).height = 22;
        const rangs = new Map();
        for (const l of recon.lignes) {
            r += 1;
            rangs.set(l.rep, r);
            ws.getCell(r, 1).value = l.libelle;
            ws.getCell(r, 2).value = l.rep;
            ws.getCell(r, 3).value = l.montant ?? 'non renseigné';
            (0, theme_etafi_1.styleLigne)(ws, r, 1, 3, etat_etafi_1.NIVEAUX_RECONCILIATION[l.rep] ?? 'normal', [3], 2);
            ws.getRow(r).height = 22;
        }
        if (rangs.has('G')) {
            ws.getCell(rangs.get('G'), 3).value = {
                formula: `C${rangs.get('A')}+C${rangs.get('B')}+C${rangs.get('C')}+C${rangs.get('D')}-C${rangs.get('E')}-C${rangs.get('F')}`,
            };
        }
        const hRenseigne = recon.lignes.some((l) => l.rep === 'H' && l.montant !== null);
        if (rangs.has('I') && hRenseigne) {
            ws.getCell(rangs.get('I'), 3).value = { formula: `C${rangs.get('G')}-C${rangs.get('H')}` };
        }
        (0, theme_etafi_1.cadre)(ws, 8, 1, r, 3, theme_etafi_1.MOYEN);
        r += 2;
        ws.getCell(r, 1).value = 'Rappel balance : trésorerie de clôture (classe 5 nette) :';
        ws.getCell(r, 1).font = { name: 'Arial', size: 9 };
        ws.getCell(r, 3).value = recon.controle.tresorerieBalance;
        ws.getCell(r, 3).numFmt = theme_etafi_2.FMT_MONTANT;
        r += 1;
        ws.getCell(r, 1).value = 'Écart avec la ligne G (dépenses non décaissées, créances · à expliquer en NOTE 2) :';
        ws.getCell(r, 1).font = { name: 'Arial', size: 9 };
        ws.getCell(r, 3).value = recon.controle.ecart;
        ws.getCell(r, 3).numFmt = theme_etafi_2.FMT_MONTANT;
        r += 2;
        (0, etat_etafi_1.ligneControleSousEtat)(ws, r, recon.avertissements.join(' '));
        (0, theme_etafi_1.largeurs)(ws, { A: 66, B: 7, C: 20 });
        ws.views = [{ state: 'frozen', ySplit: 8, showGridLines: false }];
        return { rangs, dernier: r };
    }
    async reconciliationTresorerieExcel(tenantId, exerciceId, paiementsEnInstance = null) {
        const [recon, ident] = await Promise.all([
            this.etatsFinanciersProjetBudgetService.reconciliationTresorerie(tenantId, exerciceId, paiementsEnInstance),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        this.feuilleReconciliationEtafi(classeur, recon, ident);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `reconciliation-tresorerie${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleMethodeSmt(classeur, precisions) {
        const f = classeur.addWorksheet('Méthode');
        f.columns = [{ header: 'Point', key: 'point', width: 34 }, { header: 'Ce qui est appliqué', key: 'texte', width: 120 }];
        const lignes = [
            ['Référentiel', "SYCEBNL, Acte uniforme adopté à Niamey le 22 décembre 2022, applicable depuis le 1er janvier 2024."],
            ['Jeu d’états', "Système Minimal de Trésorerie, Partie 4, chapitre 4 (Journal officiel OHADA, numéro spécial du 22 février 2023, p. 433-438)."],
            [
                'Éligibilité',
                "Article 5 : le Système normal est la règle, le S.M.T l’exception liée à la taille. Article 6 : chacune des cinq catégories de ressources annuelles doit rester sous 30 000 000 FCFA.",
            ],
            [
                'Rattachement des comptes',
                "Le chapitre 4 ne fournit AUCUN tableau de correspondance poste vers comptes, contrairement aux chapitres 2 et 3. Le rattachement appliqué ici est dérivé du plan des comptes SYCEBNL lui-même (Partie 2), poste par poste, par lecture du libellé officiel. Il est documenté dans le logiciel (correspondance-smt.ts).",
            ],
            [
                'Écritures retenues',
                "Écritures validées seulement ; écritures de clôture exclues, le report à nouveau n’étant pas un encaissement de l’exercice.",
            ],
            ...precisions.map((t) => ['Précision', t]),
        ];
        for (const [point, texte] of lignes) {
            const l = f.addRow({ point, texte });
            l.getCell('point').font = ENTETE_FONT;
            l.getCell('texte').alignment = { wrapText: true, vertical: 'top' };
        }
        styliserEntete(f.getRow(1));
        return f;
    }
    feuillesBilanSmtEtafi(classeur, bilan, ident) {
        const construire = (nom, cote, postes, page, renvoi) => {
            const ws = classeur.addWorksheet(nom);
            (0, theme_etafi_1.ecrireCartouche)(ws, ident, `BILAN SYCEBNL - SMT\n${page}`, 5);
            (0, theme_etafi_1.titreEtat)(ws, 'BILAN', 2, 4, 7, 16);
            let r = 8;
            for (const [i, h] of ['REF', cote, 'NOTE', 'EXERCICE N', 'EXERCICE N-1'].entries()) {
                ws.getCell(r, i + 1).value = h;
            }
            (0, theme_etafi_1.entetesBande)(ws, r, r, 1, 5);
            ws.getRow(r).height = 22;
            const premiere = r + 1;
            const rangs = new Map();
            for (const p of postes) {
                if (p.estTotal)
                    continue;
                r += 1;
                rangs.set(p.ref, r);
                ws.getCell(r, 1).value = p.ref;
                ws.getCell(r, 2).value = p.libelle;
                ws.getCell(r, 3).value = p.note ?? '';
                ws.getCell(r, 4).value = p.montant;
                if (p.montantN1 !== undefined)
                    ws.getCell(r, 5).value = p.montantN1;
                (0, theme_etafi_1.styleLigne)(ws, r, 1, 5, 'normal', [4, 5], 1);
                ws.getCell(r, 3).alignment = { horizontal: 'center', vertical: 'middle' };
                ws.getRow(r).height = 22;
            }
            r += 1;
            const totalRef = cote === 'ACTIF' ? 'GZ' : 'HZ';
            rangs.set(totalRef, r);
            ws.getCell(r, 1).value = totalRef;
            ws.getCell(r, 2).value = cote === 'ACTIF' ? 'TOTAL ACTIF' : 'TOTAL PASSIF';
            ws.getCell(r, 4).value = { formula: `SUM(D${premiere}:D${r - 1})` };
            ws.getCell(r, 5).value = { formula: `SUM(E${premiere}:E${r - 1})` };
            (0, theme_etafi_1.styleLigne)(ws, r, 1, 5, 'general', [4, 5], 1);
            ws.getRow(r).height = 22;
            (0, theme_etafi_1.cadre)(ws, 8, 1, r, 5, theme_etafi_1.MOYEN);
            (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 2, renvoi);
            (0, theme_etafi_1.largeurs)(ws, { A: 6, B: 52, C: 6.5, D: 15.7, E: 15.7 });
            ws.views = [{ state: 'frozen', ySplit: 8, showGridLines: false }];
            return rangs;
        };
        const rangsActif = construire('Bilan-Actif', 'ACTIF', bilan.actif, 'PAGE 1/2', bilan.renvoiImmobilisations);
        const rangsPassif = construire('Bilan-Passif', 'PASSIF', bilan.passif, 'PAGE 2/2', 'Autres fonds propres : réserves, report à nouveau, subventions, fonds affectés/reportés, emprunts et provisions (le modèle SMT ne les distingue pas).');
        return { rangsActif, rangsPassif };
    }
    async bilanSmtExcel(tenantId, exerciceId) {
        const [bilan, ident] = await Promise.all([
            this.etatsFinanciersSmtService.bilan(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        const { rangsActif, rangsPassif } = this.feuillesBilanSmtEtafi(classeur, bilan, ident);
        const controle = bilan.equilibre
            ? `Contrôle : bilan équilibré · actif = passif = ${bilan.totalActif.toLocaleString('fr-FR')}.`
            : `CONTRÔLE : DÉSÉQUILIBRE de ${(bilan.totalActif - bilan.totalPassif).toLocaleString('fr-FR')} entre actif et passif.`;
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Bilan-Actif'), Math.max(...rangsActif.values()) + 3, controle);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Bilan-Passif'), Math.max(...rangsPassif.values()) + 3, controle);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `bilan-smt${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleResultatSmtEtafi(classeur, cr, ident) {
        const ws = classeur.addWorksheet('Résultat');
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'COMPTE DE RESULTAT\nSYCEBNL - SMT', 5);
        (0, theme_etafi_1.titreEtat)(ws, 'COMPTE DE RESULTAT', 2, 4, 7, 14);
        let r = 8;
        for (const [i, h] of ['REF', 'LIBELLES', 'NOTE', 'EXERCICE N', 'EXERCICE N-1'].entries()) {
            ws.getCell(r, i + 1).value = h;
        }
        (0, theme_etafi_1.entetesBande)(ws, r, r, 1, 5);
        ws.getRow(r).height = 22;
        const NIVEAUX_CR_SMT = { KX: 'section', JX: 'section', KZ: 'inter', KZC: 'section' };
        const NOTES_CR_SMT = { VA: '2', VB: '3', VC: '3' };
        const rangs = new Map();
        const poser = (ref, libelle, montant, note, montantN1) => {
            r += 1;
            rangs.set(ref, r);
            ws.getCell(r, 1).value = ref;
            ws.getCell(r, 2).value = libelle;
            ws.getCell(r, 3).value = note ?? NOTES_CR_SMT[ref] ?? '';
            if (montant !== null)
                ws.getCell(r, 4).value = montant;
            if (montantN1 !== undefined)
                ws.getCell(r, 5).value = montantN1;
            (0, theme_etafi_1.styleLigne)(ws, r, 1, 5, NIVEAUX_CR_SMT[ref] ?? 'normal', [4, 5], 1);
            ws.getCell(r, 3).alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(r).height = 22;
        };
        for (const p of cr.recettes)
            poser(p.ref, p.libelle, p.montant, p.note, p.montantN1);
        poser('KX', 'TOTAL DES REVENUS ENCAISSÉS (A)', null, null);
        for (const p of cr.depenses)
            poser(p.ref, p.libelle, p.montant, p.note, p.montantN1);
        poser('JX', 'TOTAL DÉPENSES SUR CHARGES (B)', null, null);
        poser('KZ', 'SOLDE : excédent (+) ou insuffisance (-) de recettes (C = A - B)', null, null);
        for (const retraitement of cr.retraitements) {
            poser(retraitement.ref, retraitement.libelle, retraitement.montant, null, retraitement.montantN1);
        }
        poser('KZC', "RÉSULTAT NET DE L'EXERCICE", null, null);
        const colonnesTotaux = cr.exerciceN1Disponible ? ['D', 'E'] : ['D'];
        for (const [i, col] of colonnesTotaux.entries()) {
            const c = 4 + i;
            const somme = (refs) => refs.map((x) => `${col}${rangs.get(x)}`).join('+');
            ws.getCell(rangs.get('KX'), c).value = { formula: somme(cr.recettes.map((p) => p.ref)) };
            ws.getCell(rangs.get('JX'), c).value = { formula: somme(cr.depenses.map((p) => p.ref)) };
            ws.getCell(rangs.get('KZ'), c).value = { formula: `${col}${rangs.get('KX')}-${col}${rangs.get('JX')}` };
            ws.getCell(rangs.get('KZC'), c).value = {
                formula: `${col}${rangs.get('KZ')}+${col}${rangs.get('VA')}+${col}${rangs.get('VB')}-${col}${rangs.get('VC')}-${col}${rangs.get('JG')}`,
            };
        }
        (0, theme_etafi_1.cadre)(ws, 8, 1, r, 5, theme_etafi_1.MOYEN);
        (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 2, "Comptabilité de trésorerie puis retraitements (Partie 4, ch. 4) : variations de stocks, de créances et de dettes calculées d'après le bilan, dotations en JG.");
        (0, theme_etafi_1.largeurs)(ws, { A: 6, B: 60, C: 6.5, D: 15.7, E: 15.7 });
        ws.views = [{ state: 'frozen', ySplit: 8, showGridLines: false }];
        return rangs;
    }
    async compteDeResultatSmtExcel(tenantId, exerciceId) {
        const [cr, ident] = await Promise.all([
            this.etatsFinanciersSmtService.compteDeResultat(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        const rangs = this.feuilleResultatSmtEtafi(classeur, cr, ident);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Résultat'), Math.max(...rangs.values()) + 3, cr.controle.concordant
            ? 'Contrôle : le résultat net recoupe le résultat logé au bilan (flux hors exploitation déduits).'
            : `CONTRÔLE : écart de ${cr.controle.ecart.toLocaleString('fr-FR')} avec le résultat du bilan · voir les flux hors exploitation.`);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `compte-de-resultat-smt${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleJournalTresorerieEtafi(classeur, journal, ident, nomFeuille = 'NOTE 4 JOURNAL TRESORERIE') {
        const ws = classeur.addWorksheet(nomFeuille);
        const colonnes = colonnesVentilationParSens(journal);
        const ncols = 5 + colonnes.length;
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'NOTE 4\nSYCEBNL - SMT', ncols);
        (0, theme_etafi_2.titreNote)(ws, 'NOTE 4 : JOURNAL UNIQUE DE TRESORERIE', ncols);
        let r = 7;
        for (const j of journal.journaux) {
            r += 1;
            const c = ws.getCell(r, 1);
            c.value = `${j.numero} · ${j.intitule}`;
            c.font = { name: 'Arial', size: 9, bold: true };
            (0, theme_etafi_2.fusion)(ws, r, 1, r, ncols);
            r += 1;
            const debutTableau = r;
            bandeauVentilation(ws, r, journal.colonnesRecettes.length, journal.colonnesDepenses.length);
            r += 1;
            ws.getCell(r, 1).value = 'Dates';
            ws.getCell(r, 2).value = 'Libellés';
            ws.getCell(r, 3).value = 'Recettes';
            ws.getCell(r, 4).value = 'Dépenses';
            ws.getCell(r, 5).value = 'Solde';
            colonnes.forEach((col, i) => {
                ws.getCell(r, 6 + i).value = col.libelle;
            });
            (0, theme_etafi_1.entetesBande)(ws, debutTableau, r, 1, ncols);
            ws.getRow(r).height = 30;
            r += 1;
            ws.getCell(r, 2).value = 'Report à nouveau';
            ws.getCell(r, 5).value = j.reportANouveau;
            (0, theme_etafi_1.styleLigne)(ws, r, 1, ncols, 'rubrique', [3, 4, 5]);
            const colsMontant = [3, 4, 5, ...colonnes.map((_, i) => 6 + i)];
            for (const operation of j.operations) {
                r += 1;
                ws.getCell(r, 1).value = new Date(operation.date);
                ws.getCell(r, 1).numFmt = 'DD/MM/YYYY';
                ws.getCell(r, 2).value = operation.virementInterne ? `${operation.libelle} (virement interne)` : operation.libelle;
                if (operation.recette)
                    ws.getCell(r, 3).value = operation.recette;
                if (operation.depense)
                    ws.getCell(r, 4).value = operation.depense;
                ws.getCell(r, 5).value = { formula: `E${r - 1}+C${r}-D${r}` };
                colonnes.forEach((col, i) => {
                    const v = ventilationDeLaColonne(operation, col);
                    if (v)
                        ws.getCell(r, 6 + i).value = v;
                });
                (0, theme_etafi_1.styleLigne)(ws, r, 1, ncols, 'normal', colsMontant);
            }
            r += 1;
            ws.getCell(r, 2).value = 'Solde à reporter';
            ws.getCell(r, 5).value = { formula: `E${r - 1}` };
            (0, theme_etafi_1.styleLigne)(ws, r, 1, ncols, 'inter', [3, 4, 5]);
            (0, theme_etafi_1.cadre)(ws, debutTableau, 1, r, ncols, theme_etafi_1.MOYEN);
            if (!j.boucle) {
                r += 1;
                (0, etat_etafi_1.ligneControleSousEtat)(ws, r, `CONTRÔLE : le solde à reporter diverge du solde balance du compte (${j.soldeBalance.toLocaleString('fr-FR')}).`);
            }
            r += 1;
        }
        if (journal.journaux.length === 0) {
            r += 1;
            (0, etat_etafi_1.ligneControleSousEtat)(ws, r, 'Aucun compte de trésorerie mouvementé sur cet exercice.');
        }
        const spec = { A: 11, B: 32, C: 13, D: 13, E: 13 };
        colonnes.forEach((_, i) => {
            spec[String.fromCharCode(70 + i)] = 14;
        });
        (0, theme_etafi_1.largeurs)(ws, spec);
        return ws;
    }
    async journalTresorerieSmtExcel(tenantId, exerciceId) {
        const [journal, ident] = await Promise.all([
            this.etatsFinanciersSmtService.journalTresorerie(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        this.feuilleJournalTresorerieEtafi(classeur, journal, ident);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `journal-tresorerie-smt${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuillesNotesSmtEtafi(classeur, donnees, ident) {
        const { note1, note2, note3, note5 } = donnees;
        {
            const ws = classeur.addWorksheet('NOTE 1 IMMOBILISATIONS');
            (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'NOTE 1\nSYCEBNL - SMT', 7);
            (0, theme_etafi_2.titreNote)(ws, "NOTE 1 : TABLEAU D'ACQUISITION ET DE SUIVI DU MATERIEL, DU MOBILIER ET AUTRES IMMOBILISATIONS", 7);
            let r = 8;
            for (const [i, h] of [
                'Date de mise en service',
                'Désignation',
                'Montant',
                "Date d'acquisition",
                "Durée d'utilité",
                'Date de sortie',
                'Prix de cession',
            ].entries()) {
                ws.getCell(r, i + 1).value = h;
            }
            (0, theme_etafi_1.entetesBande)(ws, r, r, 1, 7);
            ws.getRow(r).height = 30;
            const date = (rang, colonne, d) => {
                if (!d)
                    return;
                ws.getCell(rang, colonne).value = new Date(d);
                ws.getCell(rang, colonne).numFmt = 'DD/MM/YYYY';
            };
            const ligneBien = (l) => {
                r += 1;
                if (l.dateMiseEnService)
                    date(r, 1, l.dateMiseEnService);
                else if (l.origine === 'REGISTRE')
                    ws.getCell(r, 1).value = 'Non mis en service';
                ws.getCell(r, 2).value = l.designation;
                ws.getCell(r, 3).value = l.montant;
                date(r, 4, l.dateAcquisition);
                if (l.dureeUtiliteAns !== null)
                    ws.getCell(r, 5).value = l.dureeUtiliteAns;
                date(r, 6, l.dateSortie);
                if (l.prixCession !== null && l.prixCession !== undefined)
                    ws.getCell(r, 7).value = l.prixCession;
                (0, theme_etafi_1.styleLigne)(ws, r, 1, 7, 'normal', [3, 7]);
            };
            if (note1.lignes.length === 0 && note1.sortiesDeLExercice.length === 0 && note1.ecartsGA.length === 0) {
                r = (0, theme_etafi_1.bandeNeant)(ws, r + 1, 7) - 1;
            }
            for (const l of note1.lignes)
                ligneBien(l);
            r += 1;
            ws.getCell(r, 2).value = 'TOTAL DES BIENS DÉTENUS À LA CLÔTURE';
            ws.getCell(r, 3).value = note1.total;
            (0, theme_etafi_1.styleLigne)(ws, r, 1, 7, 'inter', [3]);
            if (note1.sortiesDeLExercice.length > 0) {
                r += 1;
                ws.getCell(r, 1).value = "Biens sortis pendant l'exercice · hors du total";
                (0, theme_etafi_2.fusion)(ws, r, 1, r, 7);
                (0, theme_etafi_1.styleLigne)(ws, r, 1, 7, 'bande');
                for (const l of note1.sortiesDeLExercice)
                    ligneBien(l);
            }
            (0, theme_etafi_1.cadre)(ws, 8, 1, r, 7, theme_etafi_1.MOYEN);
            const mentions = [note1.motifCautions, note1.motifEcartsGA].filter((m) => Boolean(m));
            for (const [i, m] of mentions.entries())
                (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 2 + i, m);
            let rc = r + 2 + mentions.length;
            for (const e of note1.ecartsGA) {
                (0, etat_etafi_1.ligneControleSousEtat)(ws, rc++, `${e.numero} ${e.intitule} · solde brut ${e.soldeBalance.toLocaleString('fr-FR')}, fiches ${e.valeurFiches.toLocaleString('fr-FR')}, écart ${e.ecart.toLocaleString('fr-FR')}.`);
            }
            for (const f of note1.fichesSansSolde) {
                (0, etat_etafi_1.ligneControleSousEtat)(ws, rc++, `Fiche sans solde au compte : ${f.designation} (${f.montant.toLocaleString('fr-FR')}).`);
            }
            (0, theme_etafi_1.largeurs)(ws, { A: 14, B: 44, C: 15, D: 15, E: 13, F: 13, G: 15 });
        }
        {
            const ws = classeur.addWorksheet('NOTE 2 STOCKS');
            (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'NOTE 2\nSYCEBNL - SMT', 5);
            (0, theme_etafi_2.titreNote)(ws, 'NOTE 2 : ETAT DES STOCKS', 5);
            let r = 8;
            for (const [i, h] of ['Référence', 'Désignation', 'Quantité', 'Prix unitaire', 'Montant'].entries()) {
                ws.getCell(r, i + 1).value = h;
            }
            (0, theme_etafi_1.entetesBande)(ws, r, r, 1, 5);
            if (note2.lignes.length === 0)
                r = (0, theme_etafi_1.bandeNeant)(ws, r + 1, 5) - 1;
            for (const l of note2.lignes) {
                r += 1;
                ws.getCell(r, 1).value = l.reference;
                ws.getCell(r, 2).value = l.designation;
                if (l.quantite !== null)
                    ws.getCell(r, 3).value = l.quantite;
                if (l.prixUnitaire !== null)
                    ws.getCell(r, 4).value = l.prixUnitaire;
                ws.getCell(r, 5).value = l.montant;
                (0, theme_etafi_1.styleLigne)(ws, r, 1, 5, 'normal', [5]);
                formaterQuantiteEtPrix(ws, r);
            }
            r += 1;
            ws.getCell(r, 2).value = 'VALEUR DU STOCK FINAL';
            ws.getCell(r, 5).value = note2.valeurStockFinal;
            (0, theme_etafi_1.styleLigne)(ws, r, 1, 5, 'inter', [5]);
            r += 1;
            ws.getCell(r, 2).value = 'VALEUR DU STOCK INITIAL';
            ws.getCell(r, 5).value = note2.valeurStockInitial;
            (0, theme_etafi_1.styleLigne)(ws, r, 1, 5, 'inter', [5]);
            (0, theme_etafi_1.cadre)(ws, 8, 1, r, 5, theme_etafi_1.MOYEN);
            const mentionQuantites = [note2.sourceQuantites, note2.motifQuantites].filter(Boolean).join(' ');
            if (mentionQuantites)
                (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 2, mentionQuantites);
            (0, theme_etafi_1.largeurs)(ws, { A: 12, B: 46, C: 12, D: 14, E: 16 });
        }
        {
            const NB = 9;
            const COL_VENTILATION = 7;
            const ws = classeur.addWorksheet('NOTE 3 CREANCES-DETTES');
            (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'NOTE 3\nSYCEBNL - SMT', NB);
            (0, theme_etafi_2.titreNote)(ws, 'NOTE 3 : ETAT DES CREANCES ET DES DETTES NON ECHUES', NB);
            let r = 7;
            const bloc = (titre, nomColonne, blocLignes, totalLibelle, totaux, deductions = []) => {
                r += 1;
                const debut = r;
                ws.getCell(r, 1).value = 'MAQUETTE OFFICIELLE · SYCEBNL, Partie 4, ch. 4, section 3';
                (0, theme_etafi_2.fusion)(ws, r, 1, r, COL_VENTILATION - 1);
                ws.getCell(r, COL_VENTILATION).value = 'VENTILATION DU MONTANT AU 31/12/N PAR ÉCHÉANCE · ajout hors maquette';
                (0, theme_etafi_2.fusion)(ws, r, COL_VENTILATION, r, NB);
                r += 1;
                for (const [i, h] of [
                    'DATE',
                    nomColonne,
                    'Montant au 31 décembre N',
                    'Montant au 1er janvier N',
                    'Variation en valeur',
                    'Variation en %',
                    ...etat_etafi_1.ENTETES_VENTILATION_ECHEANCE,
                ].entries()) {
                    ws.getCell(r, i + 1).value = h;
                }
                (0, theme_etafi_1.entetesBande)(ws, debut, r, 1, NB);
                ws.getRow(r).height = 30;
                r += 1;
                ws.getCell(r, 1).value = titre;
                (0, theme_etafi_2.fusion)(ws, r, 1, r, NB);
                (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'bande');
                if (blocLignes.length === 0)
                    r = (0, theme_etafi_1.bandeNeant)(ws, r + 1, NB) - 1;
                for (const l of blocLignes) {
                    r += 1;
                    ws.getCell(r, 2).value = `${l.numero} ${l.nom}`;
                    ws.getCell(r, 3).value = l.montantCloture;
                    if (l.montantOuverture !== undefined)
                        ws.getCell(r, 4).value = l.montantOuverture;
                    if (l.variationValeur !== undefined)
                        ws.getCell(r, 5).value = l.variationValeur;
                    (0, etat_etafi_1.ecrireVentilationEcheance)(ws, r, COL_VENTILATION, {
                        nonEchu: l.montantNonEchu,
                        echu: l.montantEchu,
                        nonVentile: l.montantNonVentile,
                    });
                    (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'normal', [3, 4, 5, 7, 8, 9]);
                    if (l.variationPourcent !== undefined && l.variationPourcent !== null) {
                        ws.getCell(r, 6).value = l.variationPourcent;
                        ws.getCell(r, 6).numFmt = '#,##0.00"%"';
                    }
                }
                r += 1;
                ws.getCell(r, 2).value = totalLibelle;
                ws.getCell(r, 3).value = totaux.montant;
                (0, etat_etafi_1.ecrireVentilationEcheance)(ws, r, COL_VENTILATION, totaux);
                (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'inter', [3, 7, 8, 9]);
                if (deductions.length > 0) {
                    for (const d of deductions) {
                        r += 1;
                        ws.getCell(r, 2).value = `${d.numero} ${d.intitule} · dépréciation, en déduction`;
                        ws.getCell(r, 3).value = d.montantCloture;
                        ws.getCell(r, 4).value = d.montantOuverture;
                        ws.getCell(r, 5).value = d.variationValeur;
                        (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'normal', [3, 4, 5]);
                    }
                    r += 1;
                    ws.getCell(r, 2).value = 'CRÉANCES NETTES DES DÉPRÉCIATIONS (poste GC)';
                    ws.getCell(r, 3).value = note3.totalCreancesNettes;
                    (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'inter', [3]);
                }
                (0, theme_etafi_1.cadre)(ws, debut, 1, r, NB, theme_etafi_1.MOYEN);
                r += 1;
            };
            bloc('CRÉANCES', 'NOM CLIENTS-USAGERS ET AUTRES DEBITEURS', note3.creances, 'TOTAL DES CRÉANCES', {
                montant: note3.totalCreances,
                nonEchu: note3.totalCreancesNonEchues,
                echu: note3.totalCreancesEchues,
                nonVentile: note3.totalCreancesNonVentilees,
            }, note3.depreciationsCreances);
            bloc('DETTES', 'NOM DES FOURNISSEURS ET AUTRES CRÉDITEURS', note3.dettes, 'TOTAL DES DETTES', {
                montant: note3.totalDettes,
                nonEchu: note3.totalDettesNonEchues,
                echu: note3.totalDettesEchues,
                nonVentile: note3.totalDettesNonVentilees,
            });
            (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 1, (0, etat_etafi_1.texteControleEcheances)(note3.motifEcheances, note3.totalCreancesNonVentilees, note3.totalDettesNonVentilees));
            (0, theme_etafi_1.largeurs)(ws, { A: 13, B: 42, C: 18, D: 18, E: 18, F: 14, G: 18, H: 18, I: 20 });
        }
        {
            const ws = classeur.addWorksheet('NOTE 5 DOTATIONS');
            (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'NOTE 5\nSYCEBNL - SMT', 4);
            (0, theme_etafi_2.titreNote)(ws, 'NOTE 5 : DOTATION', 4);
            let r = 8;
            for (const [i, h] of [
                'Nom et prénoms des membres',
                'Nationalité',
                'Montant',
                "Préciser avec droit d'entrée ou sans droit d'entrée",
            ].entries()) {
                ws.getCell(r, i + 1).value = h;
            }
            (0, theme_etafi_1.entetesBande)(ws, r, r, 1, 4);
            ws.getRow(r).height = 26;
            if (note5.rubriques.length === 0 && note5.membres.length === 0)
                r = (0, theme_etafi_1.bandeNeant)(ws, r + 1, 4) - 1;
            for (const rubrique of note5.rubriques) {
                r += 1;
                ws.getCell(r, 1).value = `${rubrique.libelle} · rappel balance`;
                ws.getCell(r, 3).value = rubrique.montant;
                (0, theme_etafi_1.styleLigne)(ws, r, 1, 4, 'rubrique', [3]);
            }
            for (const membre of note5.membres) {
                r += 1;
                ws.getCell(r, 1).value = membre.nom;
                ws.getCell(r, 2).value = membre.nationalite ?? '';
                ws.getCell(r, 3).value = membre.montant;
                ws.getCell(r, 4).value = membre.precisionDroitEntree ?? '';
                (0, theme_etafi_1.styleLigne)(ws, r, 1, 4, 'normal', [3]);
            }
            r += 1;
            ws.getCell(r, 1).value = 'TOTAL';
            ws.getCell(r, 3).value = note5.total;
            (0, theme_etafi_1.styleLigne)(ws, r, 1, 4, 'inter', [3]);
            for (const c of note5.horsRubriques) {
                r += 1;
                ws.getCell(r, 1).value = `${c.numero} ${c.intitule} · hors rubriques, rappel balance`;
                ws.getCell(r, 3).value = c.montant;
                (0, theme_etafi_1.styleLigne)(ws, r, 1, 4, 'normal', [3]);
            }
            if (note5.horsRubriques.length > 0) {
                r += 1;
                ws.getCell(r, 1).value = 'POSTE HA DU BILAN (TOTAL + hors rubriques)';
                ws.getCell(r, 3).value = note5.totalPosteHA;
                (0, theme_etafi_1.styleLigne)(ws, r, 1, 4, 'inter', [3]);
            }
            (0, theme_etafi_1.cadre)(ws, 8, 1, r, 4, theme_etafi_1.MOYEN);
            const mentions = [note5.motifColonnesNonTenues, note5.motifMembres, note5.motifHorsRubriques].filter((m) => Boolean(m));
            for (const [i, m] of mentions.entries())
                (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 2 + i, m);
            (0, theme_etafi_1.largeurs)(ws, { A: 44, B: 16, C: 16, D: 30 });
        }
    }
    async notesSmtExcel(tenantId, exerciceId) {
        const [ident, fiche, note1, note2, note3, note5, journal] = await Promise.all([
            this.identiteLiasse(tenantId, exerciceId),
            Promise.resolve(this.etatsFinanciersSmtService.ficheNotes()),
            this.etatsFinanciersSmtService.note1Immobilisations(tenantId, exerciceId),
            this.etatsFinanciersSmtService.note2Stocks(tenantId, exerciceId),
            this.etatsFinanciersSmtService.note3CreancesDettes(tenantId, exerciceId),
            this.etatsFinanciersSmtService.note5Dotation(tenantId, exerciceId),
            this.etatsFinanciersSmtService.journalTresorerie(tenantId, exerciceId),
        ]);
        const applicables = await this.etatsFinanciersSmtService.notesApplicables(tenantId, exerciceId, {
            note1,
            note2,
            note3,
            note5,
        });
        const classeur = this.nouveauClasseur();
        this.ficheNotesSmtEtafi(classeur, fiche, ident, applicables);
        this.feuillesNotesSmtEtafi(classeur, { note1, note2, note3, note5 }, ident);
        this.feuilleJournalTresorerieEtafi(classeur, journal, ident);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `notes-annexes-smt${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    ficheNotesSmtEtafi(classeur, fiche, ident, applicables) {
        const parties = [
            [
                'Partie 1 : Notes sur le bilan',
                fiche.filter((n) => n.partie === 'BILAN').map((n) => [`Note ${n.numero}`, n.intitule]),
            ],
            [
                'Partie 2 : Notes sur le compte de résultat',
                fiche.filter((n) => n.partie !== 'BILAN').map((n) => [`Note ${n.numero}`, n.intitule]),
            ],
        ];
        (0, theme_etafi_2.construireFicheNotes)(classeur, parties, ident, new Set(applicables.map((n) => `Note ${n}`)), 'NOTES ANNEXES', "(1) Partie 4, ch. 1, § 6 : « Les modèles de Notes ci-dessous non documentés ne doivent pas être joints aux états financiers. » Les notes non applicables sont jointes avec la mention NEANT et cochées N/A.");
        return parties;
    }
    async eligibiliteSmtExcel(tenantId, exerciceId) {
        const e = await this.etatsFinanciersSmtService.eligibilite(tenantId, exerciceId);
        const classeur = this.nouveauClasseur();
        const f = classeur.addWorksheet('Éligibilité');
        f.columns = [
            { header: 'Catégorie de ressources', key: 'libelle', width: 52 },
            { header: 'Exercice N', key: 'montant', width: 20 },
            { header: 'Seuil légal', key: 'seuil', width: 22 },
            { header: 'Comptes', key: 'comptes', width: 46 },
        ];
        for (const c of e.categories) {
            f.addRow({
                libelle: c.libelle,
                montant: c.montant,
                seuil: `${e.seuilParCategorieFcfa.toLocaleString('fr-FR')} FCFA`,
                comptes: c.comptes.map((x) => x.numero).join(', '),
            });
        }
        f.addRow({ libelle: 'TOTAL DES RESSOURCES', montant: e.totalRessources }).font = ENTETE_FONT;
        f.addRow({});
        f.addRow({ libelle: `Montants exprimés en ${e.deviseDossier}.` });
        f.addRow({ libelle: e.avertissement });
        this.appliquerFormats(f, { montant: FORMAT_MONTANT });
        this.finaliserTableau(f, f.columns.length, f.rowCount);
        this.feuilleMethodeSmt(classeur, [
            "OmegaX ne convertit PAS le seuil : l’article 6 le fixe en francs CFA « ou l’équivalent dans l’unité monétaire ayant cours légal dans l’État partie », et le cours de conversion n’appartient pas au texte comptable. Comparez chaque catégorie au seuil converti au cours que retient votre entité.",
        ]);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `eligibilite-smt${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    async exerciceN1Id(tenantId, exerciceId) {
        const courant = await this.exerciceDuDossier(tenantId, exerciceId);
        const anterieur = await this.prisma.exercice.findFirst({
            where: { tenantId, dateDebut: { lt: courant.dateDebut } },
            orderBy: { dateDebut: 'desc' },
            select: { id: true },
        });
        return anterieur?.id ?? null;
    }
    async lignesBalanceLiasse(tenantId, exerciceId) {
        const [balance, exercice, identite] = await Promise.all([
            this.ecritureService.balance(tenantId, exerciceId, false),
            this.prisma.exercice.findFirstOrThrow({
                where: { id: exerciceId, tenantId },
                select: { dateDebut: true, dateFin: true },
            }),
            this.identiteEtat(tenantId, { exerciceId }),
        ]);
        const soldeRetire = balance.lignes.some((l) => (l.clotureDebit ?? 0) !== 0 || (l.clotureCredit ?? 0) !== 0);
        const lignes = (0, balance_trois_colonnes_1.avantSoldeDesComptesDeGestion)(balance.lignes)
            .filter((l) => l.typeCompte !== 'TOTAL')
            .map((l) => ({
            compteId: l.compteId,
            numero: l.numero,
            intitule: l.intitule,
            classe: l.classe,
            avantDebit: l.reportDebit,
            avantCredit: l.reportCredit,
            mouvementDebit: l.mouvementDebit,
            mouvementCredit: l.mouvementCredit,
            totalDebit: l.totalDebit,
            totalCredit: l.totalCredit,
        }));
        const divisions = (0, balance_fpm_1.divisionsDeLaClasse9)(lignes);
        const intitulesDivisions = divisions.length
            ? new Map((await this.prisma.compte.findMany({
                where: { tenantId, numero: { in: divisions } },
                select: { numero: true, intitule: true },
            })).map((c) => [c.numero, c.intitule]))
            : new Map();
        return {
            lignes,
            identite,
            debut: exercice.dateDebut,
            fin: exercice.dateFin,
            intitulesDivisions,
            mention: soldeRetire ? "Avant l'écriture qui solde les comptes de gestion · livre-journal seul" : undefined,
        };
    }
    provenanceDuComparatif(bilan, resultat, tft) {
        const lignes = [];
        if (bilan.mentionComparatif)
            lignes.push(['INFO', '·', 'Bilan · colonne N-1', bilan.mentionComparatif, SOLUTION_PROVENANCE]);
        if (resultat.motifComparatifAbsent)
            lignes.push(['INFO', '·', 'Compte de résultat · colonne N-1', resultat.motifComparatifAbsent, 'Voir l’issue dite.']);
        if (tft?.mentionOuverture && tft.mentionOuverture !== bilan.mentionComparatif) {
            lignes.push(['INFO', 'ZA', 'Tableau des flux · ouverture', tft.mentionOuverture, SOLUTION_PROVENANCE]);
        }
        return lignes;
    }
    async liasseProjetsEtafi(tenantId, exerciceId, paiementsEnInstance) {
        const [ident, tenant, bilan, ce, er, recon, notes, exerciceN1Id] = await Promise.all([
            this.identiteLiasse(tenantId, exerciceId),
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
            this.etatsFinanciersProjetService.bilan(tenantId, exerciceId),
            this.etatsFinanciersProjetService.compteExploitation(tenantId, exerciceId),
            this.etatsFinanciersProjetService.tableauEmploisRessources(tenantId, exerciceId),
            this.etatsFinanciersProjetBudgetService.reconciliationTresorerie(tenantId, exerciceId, paiementsEnInstance),
            this.noteAnnexeService.notesProjet(tenantId, exerciceId),
            this.exerciceN1Id(tenantId, exerciceId),
        ]);
        const balN = await this.lignesBalanceLiasse(tenantId, exerciceId);
        const balN1 = exerciceN1Id ? await this.lignesBalanceLiasse(tenantId, exerciceN1Id) : null;
        const classeur = this.nouveauClasseur();
        const corpsN = await (0, theme_etafi_2.ecrireFeuilleBalance)(classeur, theme_etafi_2.NOM_BALANCE, balN);
        const corpsN1 = balN1 ? await (0, theme_etafi_2.ecrireFeuilleBalance)(classeur, theme_etafi_2.NOM_BALANCE_N1, balN1) : null;
        (0, theme_etafi_2.construireControleBalance)(classeur, corpsN, corpsN1);
        (0, theme_etafi_2.construireCouverture)(classeur, ident, 'LIASSE PROJETS DE DEVELOPPEMENT', tenant.pays ?? '');
        (0, theme_etafi_2.construireGarde)(classeur, ident, {
            bandeau: 'ETATS FINANCIERS NORMALISES\nDU SYSTEME COMPTABLE DES ENTITES A BUT NON LUCRATIF (SYCEBNL)',
            sousBandeau: 'Projets de développement et assimilés',
            systeme: 'PROJETS DE DEVELOPPEMENT',
            documents: [
                "Fiche d'identification et renseignements divers",
                'Tableau emplois-ressources',
                "Tableau d'exécution budgétaire",
                'Tableau de réconciliation de trésorerie',
                'Bilan (actif et passif)',
                "Compte d'exploitation",
                'Notes annexes',
            ],
        });
        (0, theme_etafi_2.construireFiche1)(classeur, ident, 'SYCEBNL', 'Projets de développement et assimilés', {
            ...(await this.champsFiche1(tenantId, exerciceId, tenant)),
            ZE: tenant.actePersonnaliteJuridique ?? '',
        });
        (0, theme_etafi_2.construireFiche2)(classeur, ident, 'EQUIPE DU PROJET DE DEVELOPPEMENT');
        const terRangs = this.feuilleEmploisRessourcesEtafi(classeur, er, ident);
        try {
            const eb = await this.etatsFinanciersProjetBudgetService.executionBudgetaire(tenantId, exerciceId);
            this.feuilleExecutionBudgetaireEtafi(classeur, eb, ident);
        }
        catch (e) {
            if (!(e instanceof etats_financiers_projet_budget_service_1.AucunPlanABudgetsException))
                throw e;
            this.feuilleExecutionBudgetaireVierge(classeur, ident, "Aucun plan analytique à budgets n'est défini pour ce dossier : remplir code et libellé suivant la nomenclature budgétaire du projet.");
        }
        const { rangs: rangsRecon } = this.feuilleReconciliationEtafi(classeur, recon, ident);
        const versCote = (postes, libelle) => ({
            feuille: libelle === 'ACTIF' ? 'Bilan-Actif' : 'Bilan-Passif',
            libelle,
            cols: [
                { entete: 'N', lettre: 'D' },
                { entete: 'N-1', lettre: 'E' },
            ],
            lignes: postes.map((p, i) => ({
                ref: p.ref,
                libelle: p.libelle,
                note: etat_etafi_1.NOTE_PAR_CLE_PROJETS[p.ref] ?? '',
                rangSource: 10 + i,
                niveau: etat_etafi_1.NIVEAUX_ETAT_PROJETS[p.ref] ?? (p.estTotal ? 'inter' : 'normal'),
            })),
        });
        (0, theme_etafi_2.construireBilanPaysage)(classeur, ident, versCote(bilan.actif, 'ACTIF'), versCote(bilan.passif, 'PASSIF'), 'BILAN');
        const { rangsActif, rangsPassif } = this.feuillesBilanProjetEtafi(classeur, bilan, ident);
        const rangsCe = this.feuilleCompteExploitationEtafi(classeur, ce, ident);
        const note9 = await this.etatsFinanciersProjetService.noteBailleur(tenantId, exerciceId);
        this.construireClasseurNotes(notes, ident, ExportService_1.PARTIES_NOTES_PROJETS, classeur, {
            '9': (cible, tableaux) => this.feuilleNote9FondsDuBailleur(cible, note9, tableaux, ident),
        });
        const parCode = new Map(notes.ficheRecapitulative.map((n) => [n.code, n.titre]));
        const parties = ExportService_1.PARTIES_NOTES_PROJETS.map(([titre, codes]) => [
            titre,
            codes.filter((c) => parCode.has(c)).map((c) => [`NOTE ${c}`, parCode.get(c)]),
        ]);
        (0, theme_etafi_2.construireTableCommentaires)(classeur, parties, ident);
        const ctl = classeur.addWorksheet('CONTROLES');
        ctl.getCell(1, 1).value = 'Contrôle';
        ctl.getCell(1, 2).value = 'Valeur';
        ctl.getCell(1, 3).value = 'Attendu';
        (0, theme_etafi_1.entetesBande)(ctl, 1, 1, 1, 3);
        const controles = [
            ['Total solde de clôture débit balance', (0, theme_etafi_2.sommeColonneBalance)(theme_etafi_2.NOM_BALANCE, corpsN, 'G'), ''],
            ['Total solde de clôture crédit balance', (0, theme_etafi_2.sommeColonneBalance)(theme_etafi_2.NOM_BALANCE, corpsN, 'H'), ''],
            ['Écart balance (doit être 0)', 'B2-B3', 0],
            ['Total général actif (BZ)', `'Bilan-Actif'!D${rangsActif.get('BZ')}`, ''],
            ['Total général passif (DZ)', `'Bilan-Passif'!D${rangsPassif.get('DZ')}`, ''],
            ['Écart bilan actif - passif (doit être 0)', 'B5-B6', 0],
            ["Solde des opérations de l'exercice, compte d'exploitation (XC)", `'Compte Exploitation'!D${rangsCe.get('XC')}`, ''],
            ["Solde des opérations de l'exercice, bilan (CC)", resultatDeLExerciceLogeAuBilan(`'Bilan-Passif'!D${rangsPassif.get('CC')}`, bilan), ''],
            ["Écart compte d'exploitation / bilan (XC-CC, doit être 0)", 'B8-B9', 0],
            ['Contrôle emplois-ressources (VII · V - VI, doit être 0)', `'Emplois-Ressources'!D${terRangs.get('GZ')}`, 0],
            ['Trésorerie fin (réconciliation, G)', `'Reconciliation tresorerie'!C${rangsRecon.get('G')}`, ''],
            ['Trésorerie balance (classe 5 nette)', recon.controle.tresorerieBalance, ''],
            ['Écart réconciliation / balance (doit être 0)', 'B12-B13', 0],
        ];
        let rc = 1;
        for (const [lab, val, attendu] of controles) {
            rc += 1;
            ctl.getCell(rc, 1).value = lab;
            ctl.getCell(rc, 2).value = typeof val === 'string' ? { formula: val } : val;
            ctl.getCell(rc, 3).value = attendu;
            (0, theme_etafi_1.styleLigne)(ctl, rc, 1, 3, 'normal', [2]);
        }
        (0, theme_etafi_1.largeurs)(ctl, { A: 62, B: 20, C: 10 });
        const an = classeur.addWorksheet('ANOMALIES');
        for (const [i, h] of ['Gravité', 'Compte', 'Intitulé', 'Problème', 'Solution proposée'].entries()) {
            an.getCell(1, i + 1).value = h;
        }
        (0, theme_etafi_1.entetesBande)(an, 1, 1, 1, 5);
        const anomalies = [];
        if (!bilan.equilibre) {
            anomalies.push([
                'BLOQUANT',
                'BZ / DZ',
                'Bilan',
                `Actif et passif diffèrent de ${(bilan.totalActif - bilan.totalPassif).toFixed(2)}.`,
                'Vérifier les écritures déséquilibrées et les comptes non rattachés.',
            ]);
        }
        if (!ce.controle.boucleAZero) {
            anomalies.push([
                'A_VERIFIER',
                'XC',
                "Compte d'exploitation",
                `XC = ${ce.solde.toFixed(2)} · le compte d'exploitation ne boucle pas à zéro.`,
                'Vérifier la consommation des fonds (Partie 3, ch. 3) et les comptes non rattachés.',
            ]);
        }
        if (!recon.controle.boucle) {
            anomalies.push([
                'A_TRAITER',
                'G',
                'Réconciliation de trésorerie',
                `Écart de ${recon.controle.ecart.toFixed(2)} entre G reconstitué et la trésorerie de la balance.`,
                'Expliquer en NOTE 2 (dépenses non décaissées, créances).',
            ]);
        }
        for (const c of [...bilan.comptesNonRattaches, ...ce.comptesNonRattaches]) {
            anomalies.push([
                'A_TRAITER',
                c.numero,
                c.intitule,
                "Compte qu'aucun poste du tableau de correspondance officiel ne réclame.",
                'Vérifier le numéro de compte.',
            ]);
        }
        anomalies.push(...anomalieResultatAnterieurNonVire(bilan));
        anomalies.push(...this.provenanceDuComparatif(bilan, ce));
        if (anomalies.length === 0)
            anomalies.push(['INFO', '·', '·', 'Aucune anomalie détectée sur cet exercice.', '·']);
        let ra = 1;
        for (const ligne of anomalies) {
            ra += 1;
            ligne.forEach((v, i) => {
                an.getCell(ra, i + 1).value = v;
            });
            (0, theme_etafi_1.styleLigne)(an, ra, 1, 5, 'normal');
        }
        (0, theme_etafi_1.largeurs)(an, { A: 12, B: 12, C: 26, D: 62, E: 62 });
        an.views = [{ state: 'frozen', ySplit: 1 }];
        (0, theme_etafi_1.numeroterPages)(classeur);
        return classeur;
    }
    async liasseSmtEtafi(tenantId, exerciceId) {
        const [ident, tenant, bilan, cr, journal, note1, note2, note3, note5, eligibilite, exerciceN1Id] = await Promise.all([
            this.identiteLiasse(tenantId, exerciceId),
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
            this.etatsFinanciersSmtService.bilan(tenantId, exerciceId),
            this.etatsFinanciersSmtService.compteDeResultat(tenantId, exerciceId),
            this.etatsFinanciersSmtService.journalTresorerie(tenantId, exerciceId),
            this.etatsFinanciersSmtService.note1Immobilisations(tenantId, exerciceId),
            this.etatsFinanciersSmtService.note2Stocks(tenantId, exerciceId),
            this.etatsFinanciersSmtService.note3CreancesDettes(tenantId, exerciceId),
            this.etatsFinanciersSmtService.note5Dotation(tenantId, exerciceId),
            this.etatsFinanciersSmtService.eligibilite(tenantId, exerciceId),
            this.exerciceN1Id(tenantId, exerciceId),
        ]);
        const balN = await this.lignesBalanceLiasse(tenantId, exerciceId);
        const balN1 = exerciceN1Id ? await this.lignesBalanceLiasse(tenantId, exerciceN1Id) : null;
        const classeur = this.nouveauClasseur();
        const corpsN = await (0, theme_etafi_2.ecrireFeuilleBalance)(classeur, theme_etafi_2.NOM_BALANCE, balN);
        const corpsN1 = balN1 ? await (0, theme_etafi_2.ecrireFeuilleBalance)(classeur, theme_etafi_2.NOM_BALANCE_N1, balN1) : null;
        (0, theme_etafi_2.construireControleBalance)(classeur, corpsN, corpsN1);
        (0, theme_etafi_2.construireCouverture)(classeur, ident, 'LIASSE SMT', tenant.pays ?? '');
        (0, theme_etafi_2.construireGarde)(classeur, ident, {
            bandeau: 'ETATS FINANCIERS NORMALISES\nDU SYSTEME COMPTABLE DES ENTITES A BUT NON LUCRATIF (SYCEBNL)',
            sousBandeau: 'Associations, Ordres Professionnels, Fondations et Assimilées',
            systeme: 'SYSTEME MINIMAL DE TRESORERIE',
            documents: [
                "Fiche d'identification et renseignements divers",
                'Bilan (actif et passif)',
                'Compte de résultat',
                'Notes annexes 1 à 5',
            ],
        });
        (0, theme_etafi_2.construireFiche1)(classeur, ident, 'SYCEBNL', 'Système minimal de trésorerie', {
            ...(await this.champsFiche1(tenantId, exerciceId, tenant)),
            ZE: tenant.actePersonnaliteJuridique ?? '',
        });
        (0, theme_etafi_2.construireFiche2)(classeur, ident, "EQUIPE DE L'ENTITE A BUT NON LUCRATIF");
        const versCote = (postes, libelle) => {
            const details = postes.filter((p) => !p.estTotal);
            const totalRef = libelle === 'ACTIF' ? 'GZ' : 'HZ';
            return {
                feuille: libelle === 'ACTIF' ? 'Bilan-Actif' : 'Bilan-Passif',
                libelle,
                cols: [
                    { entete: 'EXERCICE N', lettre: 'D' },
                    { entete: 'EXERCICE N-1', lettre: 'E' },
                ],
                lignes: [
                    ...details.map((p, i) => ({
                        ref: p.ref,
                        libelle: p.libelle,
                        note: p.note ?? '',
                        rangSource: 9 + i,
                        niveau: 'normal',
                    })),
                    {
                        ref: totalRef,
                        libelle: libelle === 'ACTIF' ? 'TOTAL ACTIF' : 'TOTAL PASSIF',
                        note: '',
                        rangSource: 9 + details.length,
                        niveau: 'general',
                    },
                ],
            };
        };
        (0, theme_etafi_2.construireBilanPaysage)(classeur, ident, versCote(bilan.actif, 'ACTIF'), versCote(bilan.passif, 'PASSIF'), 'BILAN');
        const { rangsActif, rangsPassif } = this.feuillesBilanSmtEtafi(classeur, bilan, ident);
        const rangsCr = this.feuilleResultatSmtEtafi(classeur, cr, ident);
        const fiche = this.etatsFinanciersSmtService.ficheNotes();
        const applicables = await this.etatsFinanciersSmtService.notesApplicables(tenantId, exerciceId, {
            note1,
            note2,
            note3,
            note5,
        });
        const parties = this.ficheNotesSmtEtafi(classeur, fiche, ident, applicables);
        this.feuillesNotesSmtEtafi(classeur, { note1, note2, note3, note5 }, ident);
        this.feuilleJournalTresorerieEtafi(classeur, journal, ident);
        (0, theme_etafi_2.construireTableCommentaires)(classeur, parties, ident);
        const ctl = classeur.addWorksheet('CONTROLES');
        ctl.getCell(1, 1).value = 'Contrôle';
        ctl.getCell(1, 2).value = 'Valeur';
        ctl.getCell(1, 3).value = 'Attendu';
        (0, theme_etafi_1.entetesBande)(ctl, 1, 1, 1, 3);
        const controles = [
            ['Total solde de clôture débit balance', (0, theme_etafi_2.sommeColonneBalance)(theme_etafi_2.NOM_BALANCE, corpsN, 'G'), ''],
            ['Total solde de clôture crédit balance', (0, theme_etafi_2.sommeColonneBalance)(theme_etafi_2.NOM_BALANCE, corpsN, 'H'), ''],
            ['Écart balance (doit être 0)', 'B2-B3', 0],
            ['TOTAL ACTIF (GZ)', `'Bilan-Actif'!D${rangsActif.get('GZ')}`, ''],
            ['TOTAL PASSIF (HZ)', `'Bilan-Passif'!D${rangsPassif.get('HZ')}`, ''],
            ['Écart bilan actif - passif (doit être 0)', 'B5-B6', 0],
            ['Résultat net (compte de résultat, KZC)', `Résultat!D${rangsCr.get('KZC')}`, ''],
            ['Résultat net logé au bilan (HB)', resultatDeLExerciceLogeAuBilan(`'Bilan-Passif'!D${rangsPassif.get('HB')}`, bilan), ''],
            ['Flux hors exploitation (hors du résultat, information)', cr.controle.fluxHorsExploitation, ''],
            ['Écart résultat CR / bilan (doit être 0)', 'B8-B9', 0],
            [
                "Éligibilité art. 6 · plus haute catégorie de ressources de l'exercice",
                Math.max(0, ...eligibilite.categories.map((c) => c.montant)),
                `≤ ${eligibilite.seuilParCategorieFcfa.toLocaleString('fr-FR')} FCFA`,
            ],
        ];
        let rc = 1;
        for (const [lab, val, attendu] of controles) {
            rc += 1;
            ctl.getCell(rc, 1).value = lab;
            ctl.getCell(rc, 2).value = typeof val === 'string' ? { formula: val } : val;
            ctl.getCell(rc, 3).value = attendu;
            (0, theme_etafi_1.styleLigne)(ctl, rc, 1, 3, 'normal', [2]);
        }
        (0, theme_etafi_1.largeurs)(ctl, { A: 62, B: 20, C: 14 });
        const an = classeur.addWorksheet('ANOMALIES');
        for (const [i, h] of ['Gravité', 'Compte', 'Intitulé', 'Problème', 'Solution proposée'].entries()) {
            an.getCell(1, i + 1).value = h;
        }
        (0, theme_etafi_1.entetesBande)(an, 1, 1, 1, 5);
        const anomalies = [];
        if (!bilan.equilibre) {
            anomalies.push([
                'BLOQUANT',
                'GZ / HZ',
                'Bilan',
                `Actif et passif diffèrent de ${(bilan.totalActif - bilan.totalPassif).toFixed(2)}.`,
                'Vérifier les écritures déséquilibrées.',
            ]);
        }
        if (!cr.controle.concordant) {
            anomalies.push([
                'A_TRAITER',
                'KZC',
                'Compte de résultat',
                `Écart de ${cr.controle.ecart.toFixed(2)} avec le résultat du bilan, flux hors exploitation déduits.`,
                'Examiner les flux hors exploitation listés par le contrôle.',
            ]);
        }
        for (const j of journal.journaux) {
            if (!j.boucle) {
                anomalies.push([
                    'A_TRAITER',
                    j.numero,
                    j.intitule,
                    `Le journal de trésorerie ne boucle pas avec la balance (écart ${(j.soldeAReporter - j.soldeBalance).toFixed(2)}).`,
                    'Vérifier les écritures du compte.',
                ]);
            }
        }
        const plusHaute = Math.max(0, ...eligibilite.categories.map((c) => c.montant));
        if (plusHaute > eligibilite.seuilParCategorieFcfa) {
            anomalies.push([
                'A_VERIFIER',
                'art. 6',
                'Éligibilité au S.M.T',
                `Une catégorie de ressources atteint ${plusHaute.toLocaleString('fr-FR')} · au-delà du seuil de ${eligibilite.seuilParCategorieFcfa.toLocaleString('fr-FR')} FCFA, sous réserve de la conversion monétaire (voir l'avertissement de l'écran Éligibilité).`,
                'Passer au Système normal (art. 5) dès le prochain exercice.',
            ]);
        }
        anomalies.push(...anomalieResultatAnterieurNonVire(bilan));
        anomalies.push(...this.provenanceDuComparatif(bilan, cr));
        if (anomalies.length === 0)
            anomalies.push(['INFO', '·', '·', 'Aucune anomalie détectée sur cet exercice.', '·']);
        let ra = 1;
        for (const ligne of anomalies) {
            ra += 1;
            ligne.forEach((v, i) => {
                an.getCell(ra, i + 1).value = v;
            });
            (0, theme_etafi_1.styleLigne)(an, ra, 1, 5, 'normal');
        }
        (0, theme_etafi_1.largeurs)(an, { A: 12, B: 12, C: 26, D: 62, E: 62 });
        an.views = [{ state: 'frozen', ySplit: 1 }];
        (0, theme_etafi_1.numeroterPages)(classeur);
        return classeur;
    }
    async liasseAssociationsEtafi(tenantId, exerciceId) {
        const [ident, tenant, bilan, cr, tft, notes, exerciceN1Id] = await Promise.all([
            this.identiteLiasse(tenantId, exerciceId),
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
            this.etatsFinanciersService.bilan(tenantId, exerciceId),
            this.etatsFinanciersService.compteDeResultat(tenantId, exerciceId),
            this.etatsFinanciersService.tableauFluxTresorerie(tenantId, exerciceId),
            this.noteAnnexeService.notesAssociations(tenantId, exerciceId),
            this.exerciceN1Id(tenantId, exerciceId),
        ]);
        const balN = await this.lignesBalanceLiasse(tenantId, exerciceId);
        const balN1 = exerciceN1Id ? await this.lignesBalanceLiasse(tenantId, exerciceN1Id) : null;
        const classeur = this.nouveauClasseur();
        const corpsN = await (0, theme_etafi_2.ecrireFeuilleBalance)(classeur, theme_etafi_2.NOM_BALANCE, balN);
        const corpsN1 = balN1 ? await (0, theme_etafi_2.ecrireFeuilleBalance)(classeur, theme_etafi_2.NOM_BALANCE_N1, balN1) : null;
        (0, theme_etafi_2.construireControleBalance)(classeur, corpsN, corpsN1);
        (0, theme_etafi_2.construireCouverture)(classeur, ident, 'LIASSE SYSTEME NORMAL', tenant.pays ?? '');
        (0, theme_etafi_2.construireGarde)(classeur, ident, {
            bandeau: 'ETATS FINANCIERS NORMALISES\nDU SYSTEME COMPTABLE DES ENTITES A BUT NON LUCRATIF (SYCEBNL)',
            sousBandeau: 'Associations, Ordres Professionnels, Fondations et Assimilées',
            systeme: 'SYSTEME NORMAL',
            documents: [
                "Fiche d'identification et renseignements divers",
                'Bilan (actif et passif)',
                'Compte de résultat',
                'Tableau des flux de trésorerie',
                'Notes annexes',
            ],
        });
        (0, theme_etafi_2.construireFiche1)(classeur, ident, 'SYCEBNL', 'Associations et ordres professionnels - Système normal', {
            ...(await this.champsFiche1(tenantId, exerciceId, tenant)),
            ZE: tenant.actePersonnaliteJuridique ?? '',
        });
        (0, theme_etafi_2.construireFiche2)(classeur, ident, "EQUIPE DE L'ENTITE A BUT NON LUCRATIF");
        const versCote = (postes, libelle) => ({
            feuille: libelle === 'ACTIF' ? 'Bilan-Actif' : 'Bilan-Passif',
            libelle,
            cols: libelle === 'ACTIF'
                ? [
                    { entete: 'BRUT', lettre: 'D' },
                    { entete: 'AMORT et DEPREC.', lettre: 'E' },
                    { entete: 'NET', lettre: 'F' },
                    { entete: 'NET N-1', lettre: 'G' },
                ]
                : [
                    { entete: 'NET', lettre: 'D' },
                    { entete: 'NET N-1', lettre: 'E' },
                ],
            lignes: postes.map((p, i) => ({
                ref: p.ref,
                libelle: p.libelle,
                note: etat_etafi_1.NOTE_PAR_REF_ASSOCIATIONS[p.ref] ?? '',
                rangSource: 10 + i,
                niveau: etat_etafi_1.NIVEAUX_ETAT_ASSOCIATIONS[p.ref] ?? (p.estTotal ? 'inter' : 'normal'),
            })),
        });
        (0, theme_etafi_2.construireBilanPaysage)(classeur, ident, versCote(bilan.actif, 'ACTIF'), versCote(bilan.passif, 'PASSIF'), 'BILAN');
        const { rangsActif, rangsPassif } = this.feuillesBilanEtafi(classeur, bilan, ident);
        const rangsCr = this.feuilleResultatEtafi(classeur, cr, ident);
        const { rangs: rangsTft } = this.feuilleTftEtafi(classeur, tft, ident);
        this.construireClasseurNotes(notes, ident, ExportService_1.PARTIES_NOTES_ASSOCIATIONS, classeur);
        const parCode = new Map(notes.ficheRecapitulative.map((n) => [n.code, n.titre]));
        const parties = ExportService_1.PARTIES_NOTES_ASSOCIATIONS.map(([titre, codes]) => [
            titre,
            codes.filter((c) => parCode.has(c)).map((c) => [`NOTE ${c}`, parCode.get(c)]),
        ]);
        (0, theme_etafi_2.construireTableCommentaires)(classeur, parties, ident);
        const ctl = classeur.addWorksheet('CONTROLES');
        ctl.getCell(1, 1).value = 'Contrôle';
        ctl.getCell(1, 2).value = 'Valeur';
        ctl.getCell(1, 3).value = 'Attendu';
        (0, theme_etafi_1.entetesBande)(ctl, 1, 1, 1, 3);
        const tftNonControlable = tft.controle.coherent === null;
        const controles = [
            ['Total solde de clôture débit balance', (0, theme_etafi_2.sommeColonneBalance)(theme_etafi_2.NOM_BALANCE, corpsN, 'G'), ''],
            ['Total solde de clôture crédit balance', (0, theme_etafi_2.sommeColonneBalance)(theme_etafi_2.NOM_BALANCE, corpsN, 'H'), ''],
            ['Écart balance (doit être 0)', 'B2-B3', 0],
            ['Total général actif net (BZ)', `'Bilan-Actif'!F${rangsActif.get('BZ')}`, ''],
            ['Total général passif (DZ)', `'Bilan-Passif'!D${rangsPassif.get('DZ')}`, ''],
            ['Écart bilan actif - passif (doit être 0)', 'B5-B6', 0],
            ['Résultat net (compte de résultat, XE)', `Résultat!D${rangsCr.get('XE')}`, ''],
            ['Résultat net logé au bilan (CH)', resultatDeLExerciceLogeAuBilan(`'Bilan-Passif'!D${rangsPassif.get('CH')}`, bilan), ''],
            ['Écart résultat CR / bilan (doit être 0)', 'B8-B9', 0],
            ['Trésorerie nette au 31/12 (TFT, ZG)', tftNonControlable ? { texte: 'Laissée vide · voir ANOMALIES' } : `TFT!E${rangsTft.get('ZG')}`, ''],
            [
                'Trésorerie nette au 31/12 (bilan, BX - DX)',
                `'Bilan-Actif'!F${rangsActif.get('BX')}-'Bilan-Passif'!D${rangsPassif.get('DX')}`,
                '',
            ],
            tftNonControlable
                ? ['Écart trésorerie TFT / bilan · contrôle non effectué', { texte: 'Non contrôlable' }, '']
                : ['Écart trésorerie TFT / bilan (doit être 0)', 'B11-B12', 0],
        ];
        let rc = 1;
        for (const [lab, val, attendu] of controles) {
            rc += 1;
            ctl.getCell(rc, 1).value = lab;
            ctl.getCell(rc, 2).value = typeof val === 'string' ? { formula: val } : typeof val === 'number' ? val : val.texte;
            ctl.getCell(rc, 3).value = attendu;
            (0, theme_etafi_1.styleLigne)(ctl, rc, 1, 3, 'normal', [2]);
        }
        (0, theme_etafi_1.largeurs)(ctl, { A: 62, B: 20, C: 10 });
        const an = classeur.addWorksheet('ANOMALIES');
        for (const [i, h] of ['Gravité', 'Compte', 'Intitulé', 'Problème', 'Solution proposée'].entries()) {
            an.getCell(1, i + 1).value = h;
        }
        (0, theme_etafi_1.entetesBande)(an, 1, 1, 1, 5);
        const anomalies = [];
        if (!bilan.equilibre) {
            anomalies.push([
                'BLOQUANT',
                'BZ / DZ',
                'Bilan',
                `Actif et passif diffèrent de ${(bilan.totalActif - bilan.totalPassif).toFixed(2)}.`,
                'Vérifier les écritures déséquilibrées et les comptes non rattachés.',
            ]);
        }
        if (!cr.controle.coherent) {
            anomalies.push([
                'A_TRAITER',
                'XE',
                'Compte de résultat',
                `Écart de ${cr.controle.ecart.toFixed(2)} entre le résultat des postes officiels et le solde des classes de gestion.`,
                'Rattacher les comptes de gestion listés ci-dessous à un poste officiel.',
            ]);
        }
        if (tft.controle.coherent === false) {
            anomalies.push([
                'A_TRAITER',
                'ZG',
                'Tableau des flux de trésorerie',
                `Écart de bouclage de ${(tft.controle.ecart ?? 0).toFixed(2)} avec la trésorerie du bilan.`,
                'Examiner les comptes non ventilés du tableau.',
            ]);
        }
        if (tft.controle.coherent === null) {
            anomalies.push([
                'INFO',
                'ZG',
                'Tableau des flux de trésorerie',
                tft.controle.motifNonControlable ?? 'Contrôle non effectué.',
                'Lever la cause des postes laissés vides (lignes suivantes) ; le contrôle se fera alors.',
            ]);
        }
        for (const g of postesParMotif(tft.postesNonCalculables)) {
            anomalies.push(anomaliePosteDeFlux(g.refs.join(', '), g.raison, 'N', g.aLever));
        }
        for (const g of postesParMotif(tft.postesNonCalculablesN1)) {
            anomalies.push(anomaliePosteDeFlux(g.refs.join(', '), g.raison, 'N-1', g.aLever));
        }
        for (const c of bilan.comptesNonRattaches) {
            anomalies.push([
                'A_TRAITER',
                c.numero,
                c.intitule,
                "Compte de bilan qu'aucun poste du tableau de correspondance officiel ne réclame · son montant n'entre dans aucun total.",
                'Vérifier le numéro de compte, ou créer le compte au bon niveau du plan.',
            ]);
        }
        for (const c of cr.comptesNonRattaches) {
            anomalies.push([
                'A_TRAITER',
                c.numero,
                c.intitule,
                "Compte de gestion qu'aucun poste officiel du compte de résultat ne réclame.",
                'Vérifier le numéro de compte.',
            ]);
        }
        anomalies.push(...anomalieResultatAnterieurNonVire(bilan));
        anomalies.push(...this.provenanceDuComparatif(bilan, cr, tft));
        if (anomalies.length === 0) {
            anomalies.push(['INFO', '·', '·', 'Aucune anomalie détectée sur cet exercice.', '·']);
        }
        let ra = 1;
        for (const ligne of anomalies) {
            ra += 1;
            ligne.forEach((v, i) => {
                an.getCell(ra, i + 1).value = v;
            });
            (0, theme_etafi_1.styleLigne)(an, ra, 1, 5, 'normal');
        }
        (0, theme_etafi_1.largeurs)(an, { A: 12, B: 12, C: 26, D: 62, E: 62 });
        an.views = [{ state: 'frozen', ySplit: 1 }];
        (0, theme_etafi_1.numeroterPages)(classeur);
        return classeur;
    }
    lignesBilanSyscohadaEtafi(postes, actif) {
        return postes.map((p) => ({
            ref: p.ref,
            libelle: p.libelle,
            note: p.note ?? etat_etafi_1.NOTE_PAR_REF_SYSCOHADA[p.ref] ?? '',
            niveau: etat_etafi_1.NIVEAUX_ETAT_SYSCOHADA[p.ref] ?? (p.estTotal ? 'inter' : 'normal'),
            montants: actif
                ? [
                    p.brut ?? p.montant,
                    p.amortissement ?? 0,
                    { formule: 'D{r}-E{r}' },
                    p.montantN1 ?? null,
                ]
                : [p.montant, p.montantN1 ?? null],
        }));
    }
    feuillesBilanSyscohadaEtafi(classeur, bilan, ident) {
        const rangsActif = (0, etat_etafi_1.construireFeuilleEtat)(classeur, {
            nom: 'Bilan-Actif',
            titre: 'BILAN AU 31 DECEMBRE N',
            taille: 16,
            ident,
            pageRef: 'BILAN SYSTEME NORMAL\nSYSCOHADA - PAGE 1/2',
            libelleColonne: 'ACTIF',
            groupes: ExportService_1.GROUPES_ACTIF_SYSCOHADA,
            lignes: this.lignesBilanSyscohadaEtafi(bilan.actif, true),
            totaux: etat_etafi_1.TOTAUX_SYSCOHADA,
        });
        const rangsPassif = (0, etat_etafi_1.construireFeuilleEtat)(classeur, {
            nom: 'Bilan-Passif',
            titre: 'BILAN AU 31 DECEMBRE N',
            taille: 16,
            ident,
            pageRef: 'BILAN SYSTEME NORMAL\nSYSCOHADA - PAGE 2/2',
            libelleColonne: 'PASSIF',
            groupes: ExportService_1.GROUPES_NET_SYSCOHADA,
            lignes: this.lignesBilanSyscohadaEtafi(bilan.passif, false),
            totaux: etat_etafi_1.TOTAUX_SYSCOHADA,
        });
        return { rangsActif, rangsPassif };
    }
    controlesBilanSyscohada(bilan) {
        const equilibre = bilan.equilibre
            ? `Contrôle : bilan équilibré · actif = passif = ${bilan.totalActif.toLocaleString('fr-FR')}.`
            : `CONTRÔLE : DÉSÉQUILIBRE de ${(bilan.totalActif - bilan.totalPassif).toLocaleString('fr-FR')} entre actif et passif.`;
        const nonRattaches = bilan.comptesNonRattaches.length > 0
            ? ` ${bilan.comptesNonRattaches.length} compte(s) de bilan non rattaché(s) à un poste du tableau de correspondance officiel (Titre IX ch. 7), montants hors totaux : ` +
                bilan.comptesNonRattaches
                    .slice(0, 6)
                    .map((c) => c.numero)
                    .join(', ') +
                (bilan.comptesNonRattaches.length > 6 ? '…' : '') +
                '.'
            : '';
        const aSolder = bilan.comptesASolderALaCloture.length > 0
            ? ' Comptes à solder à la clôture portant un solde : ' +
                bilan.comptesASolderALaCloture.map((c) => `${c.numero} (${c.source})`).join(' ; ') +
                '.'
            : '';
        return equilibre + nonRattaches + aSolder;
    }
    async bilanSyscohadaExcel(tenantId, exerciceId) {
        const [bilan, ident] = await Promise.all([
            this.syscohada.bilan(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        const { rangsActif, rangsPassif } = this.feuillesBilanSyscohadaEtafi(classeur, bilan, ident);
        const controle = this.controlesBilanSyscohada(bilan);
        const renvois = [...bilan.actif, ...bilan.passif]
            .filter((p) => p.renvoi)
            .map((p) => `${p.ref} : ${p.renvoi}`)
            .join(' ');
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Bilan-Actif'), Math.max(...rangsActif.values()) + 2, `${controle}${renvois ? ` ${renvois}` : ''}`);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Bilan-Passif'), Math.max(...rangsPassif.values()) + 2, controle);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `bilan-syscohada${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleResultatSyscohadaEtafi(classeur, cr, ident) {
        const lignes = cr.lignes.map((l) => ({
            ref: correspondance_compte_resultat_syscohada_1.REFS_POSTES_SUPPLEMENTAIRES.includes(l.ref) ? '' : l.ref,
            cle: l.ref,
            libelle: l.estSolde && l.formuleOfficielle ? `${l.libelle} (${l.formuleOfficielle})` : l.libelle,
            note: etat_etafi_1.NOTE_PAR_REF_SYSCOHADA[l.ref] ?? '',
            niveau: etat_etafi_1.NIVEAUX_ETAT_SYSCOHADA[l.ref] ?? 'normal',
            montants: [l.montant, l.montantN1 ?? null],
        }));
        return (0, etat_etafi_1.construireFeuilleEtat)(classeur, {
            nom: 'Résultat',
            titre: 'COMPTE DE RESULTAT AU 31 DECEMBRE N',
            taille: 14,
            ident,
            pageRef: 'COMPTE DE RESULTAT\nSYSTEME NORMAL SYSCOHADA',
            libelleColonne: 'LIBELLES',
            groupes: ExportService_1.GROUPES_NET_SYSCOHADA,
            lignes,
            totaux: etat_etafi_1.TOTAUX_SYSCOHADA,
            largeurLibelle: 62,
        });
    }
    async compteDeResultatSyscohadaExcel(tenantId, exerciceId) {
        const [cr, ident] = await Promise.all([
            this.syscohada.compteDeResultat(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        const rangs = this.feuilleResultatSyscohadaEtafi(classeur, cr, ident);
        const nonRattaches = cr.comptesNonRattaches.length > 0
            ? ` ${cr.comptesNonRattaches.length} compte(s) de gestion hors poste officiel (montants hors totaux) : ` +
                cr.comptesNonRattaches
                    .slice(0, 6)
                    .map((c) => c.numero)
                    .join(', ') +
                (cr.comptesNonRattaches.length > 6 ? '…' : '') +
                '.'
            : '';
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Résultat'), Math.max(...rangs.values()) + 2, (cr.controle.coherent
            ? 'Contrôle : le résultat net (XI) recoupe le solde de TOUS les comptes de gestion, celui que le bilan loge en CJ.'
            : `CONTRÔLE : écart de ${cr.controle.ecart.toLocaleString('fr-FR')} entre le résultat net (XI) et le solde de toutes les classes de gestion.`) +
            nonRattaches);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `compte-de-resultat-syscohada${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleTftSyscohadaEtafi(classeur, tft, ident) {
        const NB = 6;
        const rangs = new Map();
        const ws = classeur.addWorksheet('TFT');
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'TABLEAU DES FLUX\nDE TRESORERIE - SYSCOHADA', NB);
        (0, theme_etafi_1.titreEtat)(ws, 'TABLEAU DES FLUX DE TRESORERIE', 1, NB, 7, 14);
        let r = 8;
        for (const [i, h] of ['REF', 'LIBELLES', 'NOTE', 'EXERCICE N', 'EXERCICE N-1', 'Clé'].entries()) {
            ws.getCell(r, i + 1).value = h;
        }
        (0, theme_etafi_1.entetesBande)(ws, r, r, 1, NB);
        ws.getRow(r).height = 22;
        let rangVariationBf = 0;
        const videsN = new Set(tft.postesVides);
        for (const l of tft.lignes) {
            r += 1;
            ws.getRow(r).height = 22;
            if ('section' in l) {
                ws.getCell(r, 2).value = l.section;
                (0, theme_etafi_1.styleLigne)(ws, r, 2, NB, 'bande', [4, 5]);
                (0, theme_etafi_1.styleLigne)(ws, r, 1, 1, 'normal');
                continue;
            }
            if (l.ref)
                rangs.set(l.ref, r);
            else
                rangVariationBf = r;
            ws.getCell(r, 1).value = l.ref;
            ws.getCell(r, 2).value = l.libelle;
            if (!videsN.has(l.ref))
                ws.getCell(r, 4).value = l.montant;
            if (l.montantN1 !== undefined)
                ws.getCell(r, 5).value = l.montantN1;
            ws.getCell(r, 6).value = l.repere ?? etat_etafi_1.REP_TFT_SYSCOHADA[l.ref] ?? '';
            (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, etat_etafi_1.NIVEAUX_TFT_SYSCOHADA[l.ref] ?? (l.estTotal ? 'inter' : 'normal'), [4, 5], 1);
            for (const c of [3, 6])
                ws.getCell(r, c).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        const colonnes = tft.exerciceN1Disponible
            ? [
                ['D', 4],
                ['E', 5],
            ]
            : [['D', 4]];
        const montantsN1 = new Map(tft.lignes.filter((l) => !('section' in l)).map((l) => [l.ref ?? '', l.montantN1]));
        for (const total of correspondance_tft_syscohada_1.TOTAUX_FLUX_SYSCOHADA) {
            const rang = total.ref ? rangs.get(total.ref) : rangVariationBf;
            if (!rang)
                continue;
            for (const [lettre, col] of colonnes) {
                if (col === 5 && montantsN1.get(total.ref ?? '') === undefined)
                    continue;
                if (col === 4 && total.ref && videsN.has(total.ref))
                    continue;
                const termes = total.deRefs.map((ref) => (rangs.has(ref) ? `${lettre}${rangs.get(ref)}` : '0'));
                ws.getCell(rang, col).value = { formula: termes.join('+') };
            }
        }
        (0, theme_etafi_1.cadre)(ws, 8, 1, r, NB, theme_etafi_1.MOYEN);
        r += 2;
        (0, etat_etafi_1.ligneControleSousEtat)(ws, r, 'Méthode indirecte (Titre IX ch. 5 § 1.2.1 : « le point d’entrée est l’EBE, jamais le résultat net »). ' +
            'La colonne NOTE est celle du modèle ; le ch. 5 n’attribue aucun renvoi de note annexe aux lignes du tableau, ' +
            'elle reste donc vide. ' +
            correspondance_tft_syscohada_1.RENVOI_1_TFT_SYSCOHADA);
        (0, theme_etafi_1.largeurs)(ws, { A: 5.5, B: 70, C: 6.5, D: 15.7, E: 15.7, F: 5.5 });
        ws.views = [{ state: 'frozen', ySplit: 8, showGridLines: false }];
        return { rangs, dernier: r };
    }
    controlesTftSyscohada(tft) {
        const bouclage = tft.controle.coherent === null
            ? (tft.controle.motifNonControlable ?? 'Contrôle non effectué.')
            : tft.controle.coherent
                ? `Contrôle du modèle : ZH = Trésorerie actif N - Trésorerie passif N (BT - DT) = ${tft.controle.tresorerieClotureParBilan.toLocaleString('fr-FR')}.`
                : `CONTRÔLE : ZH par les flux (${(tft.controle.tresorerieClotureParFlux ?? 0).toLocaleString('fr-FR')}) diffère de BT - DT du bilan (${tft.controle.tresorerieClotureParBilan.toLocaleString('fr-FR')}) de ${(tft.controle.ecart ?? 0).toLocaleString('fr-FR')} · l'écart chiffre ce que la ventilation FA à FQ ne couvre pas, il n'est pas corrigé.`;
        const nonVentiles = tft.comptesNonVentiles.length > 0
            ? ` ${tft.comptesNonVentiles.length} compte(s) de trésorerie non ventilé(s) : ` +
                tft.comptesNonVentiles
                    .slice(0, 6)
                    .map((c) => c.numero)
                    .join(', ') +
                (tft.comptesNonVentiles.length > 6 ? '…' : '') +
                '.'
            : '';
        const nonCalculables = tft.postesNonCalculables.length > 0
            ? ` Postes non calculables sur cet exercice : ${tft.postesNonCalculables.map((p) => p.ref).join(', ')}.`
            : '';
        const tropAgreges = tft.comptesTropAgreges.length > 0
            ? ` ${tft.comptesTropAgreges.length} compte(s) tenu(s) sans la subdivision que le tableau lit : ` +
                tft.comptesTropAgreges
                    .slice(0, 6)
                    .map((c) => `${c.numero} (lu en ${c.subdivisions.join(', ')})`)
                    .join(', ') +
                (tft.comptesTropAgreges.length > 6 ? '…' : '') +
                '.'
            : '';
        return bouclage + nonVentiles + tropAgreges + nonCalculables;
    }
    async tableauFluxTresorerieSyscohadaExcel(tenantId, exerciceId) {
        const [tft, ident] = await Promise.all([
            this.syscohada.tableauFluxTresorerie(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        const { dernier } = this.feuilleTftSyscohadaEtafi(classeur, tft, ident);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('TFT'), dernier + 1, this.controlesTftSyscohada(tft));
        motifsDesPostesSousLeTableau(classeur.getWorksheet('TFT'), dernier + 1, tft);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `tableau-flux-tresorerie-syscohada${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    async notesSyscohadaExcel(tenantId, exerciceId) {
        const [resultat, ident] = await Promise.all([
            this.noteAnnexeService.notesSyscohada(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.construireClasseurNotes(resultat, ident, ExportService_1.PARTIES_NOTES_SYSCOHADA, undefined, {}, ExportService_1.PIED_FICHE_R4_SYSCOHADA);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `notes-annexes-syscohada${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuillesBilanSmtSyscohadaEtafi(classeur, bilan, ident) {
        const NB = 4;
        const construire = (nom, cote, postes, page, renvoi) => {
            const ws = classeur.addWorksheet(nom);
            (0, theme_etafi_1.ecrireCartouche)(ws, ident, `BILAN SMT SYSCOHADA\n${page}`, NB);
            (0, theme_etafi_1.titreEtat)(ws, 'BILAN SMT AU 31 DECEMBRE N', 1, NB, 7, 16);
            let r = 8;
            for (const [i, h] of [cote, 'NOTE', 'EXERCICE N', 'EXERCICE N-1'].entries())
                ws.getCell(r, i + 1).value = h;
            (0, theme_etafi_1.entetesBande)(ws, r, r, 1, NB);
            ws.getRow(r).height = 22;
            const premiere = r + 1;
            const rangs = new Map();
            for (const p of postes) {
                if (p.estTotal)
                    continue;
                r += 1;
                rangs.set(p.ref, r);
                ws.getCell(r, 1).value = p.libelle;
                ws.getCell(r, 2).value = p.note ?? '';
                ws.getCell(r, 3).value = p.montant;
                if (p.montantN1 !== undefined)
                    ws.getCell(r, 4).value = p.montantN1;
                (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'normal', [3, 4]);
                ws.getCell(r, 2).alignment = { horizontal: 'center', vertical: 'middle' };
                ws.getRow(r).height = 22;
            }
            const total = postes.find((p) => p.estTotal);
            r += 1;
            if (total)
                rangs.set(total.ref, r);
            ws.getCell(r, 1).value = total?.libelle ?? (cote === 'ACTIF' ? 'Total actif' : 'Total passif');
            ws.getCell(r, 3).value = { formula: `SUM(C${premiere}:C${r - 1})` };
            ws.getCell(r, 4).value = { formula: `SUM(D${premiere}:D${r - 1})` };
            (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'general', [3, 4]);
            ws.getRow(r).height = 22;
            (0, theme_etafi_1.cadre)(ws, 8, 1, r, NB, theme_etafi_1.MOYEN);
            (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 2, renvoi);
            (0, theme_etafi_1.largeurs)(ws, { A: 54, B: 7, C: 17, D: 17 });
            ws.views = [{ state: 'frozen', ySplit: 8, showGridLines: false }];
            return rangs;
        };
        const rangsActif = construire('Bilan-Actif', 'ACTIF', bilan.actif, 'PAGE 1/2', bilan.renvoiImmobilisations);
        const rangsPassif = construire('Bilan-Passif', 'PASSIF', bilan.passif, 'PAGE 2/2', "Le poste « Banque (en + ou en –) » figure à l'ACTIF et peut être négatif : le bilan SMT n'ouvre aucun poste de banques créditrices au passif (Titre X ch. 2 § 1).");
        return { rangsActif, rangsPassif };
    }
    async bilanSmtSyscohadaExcel(tenantId, exerciceId) {
        const [bilan, ident] = await Promise.all([
            this.smtSyscohada.bilan(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        const { rangsActif, rangsPassif } = this.feuillesBilanSmtSyscohadaEtafi(classeur, bilan, ident);
        const controle = bilan.equilibre
            ? `Contrôle : bilan équilibré · actif = passif = ${bilan.totalActif.toLocaleString('fr-FR')}.`
            : `CONTRÔLE : DÉSÉQUILIBRE de ${(bilan.totalActif - bilan.totalPassif).toLocaleString('fr-FR')} entre actif et passif.`;
        const nonRattaches = bilan.comptesNonRattaches.length > 0
            ? ` ${bilan.comptesNonRattaches.length} compte(s) de bilan hors maquette SMT : ` +
                bilan.comptesNonRattaches
                    .slice(0, 6)
                    .map((c) => c.numero)
                    .join(', ') +
                '.'
            : '';
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Bilan-Actif'), Math.max(...rangsActif.values()) + 3, controle + nonRattaches);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Bilan-Passif'), Math.max(...rangsPassif.values()) + 3, controle);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `bilan-smt-syscohada${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleResultatSmtSyscohadaEtafi(classeur, cr, ident) {
        const NB = 5;
        const ws = classeur.addWorksheet('Résultat');
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'COMPTE DE RESULTAT\nSMT SYSCOHADA', NB);
        (0, theme_etafi_1.titreEtat)(ws, 'COMPTE DE RESULTAT SMT AU 31 DECEMBRE N', 1, NB, 7, 14);
        let r = 8;
        for (const [i, h] of ['RUBRIQUES', 'NOTE', 'EXERCICE N', 'EXERCICE N-1', 'Lettre'].entries()) {
            ws.getCell(r, i + 1).value = h;
        }
        (0, theme_etafi_1.entetesBande)(ws, r, r, 1, NB);
        ws.getRow(r).height = 22;
        const NIVEAUX = { SRA: 'inter', SDB: 'inter', SC: 'section', SG: 'general' };
        const rangs = new Map();
        for (const l of cr.lignes) {
            r += 1;
            rangs.set(l.ref, r);
            ws.getCell(r, 1).value = l.libelle;
            ws.getCell(r, 2).value = l.note ?? '';
            if (!l.estTotal)
                ws.getCell(r, 3).value = l.montant;
            if (!l.estTotal && l.montantN1 !== undefined)
                ws.getCell(r, 4).value = l.montantN1;
            ws.getCell(r, 5).value = l.lettre ?? '';
            (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, NIVEAUX[l.ref] ?? 'normal', [3, 4]);
            for (const c of [2, 5])
                ws.getCell(r, c).alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(r).height = 22;
        }
        const colonnes = cr.exerciceN1Disponible
            ? [
                ['C', 3],
                ['D', 4],
            ]
            : [['C', 3]];
        const cellule = (lettre, ref) => `${lettre}${rangs.get(ref)}`;
        for (const [lettre, col] of colonnes) {
            ws.getCell(rangs.get('SRA'), col).value = {
                formula: cr.recettes.map((p) => cellule(lettre, p.ref)).join('+'),
            };
            ws.getCell(rangs.get('SDB'), col).value = {
                formula: cr.depenses.map((p) => cellule(lettre, p.ref)).join('+'),
            };
            ws.getCell(rangs.get('SC'), col).value = {
                formula: `${cellule(lettre, 'SRA')}-${cellule(lettre, 'SDB')}`,
            };
            const d = correspondance_smt_syscohada_1.LETTRES_D_E_SMT_SYSCOHADA.D.map((ref) => cellule(lettre, ref)).join('+');
            const e = correspondance_smt_syscohada_1.LETTRES_D_E_SMT_SYSCOHADA.E.map((ref) => cellule(lettre, ref)).join('+');
            ws.getCell(rangs.get('SG'), col).value = {
                formula: `${cellule(lettre, 'SC')}-(${d})+(${e})-${cellule(lettre, 'SF')}`,
            };
        }
        (0, theme_etafi_1.cadre)(ws, 8, 1, r, NB, theme_etafi_1.MOYEN);
        (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 2, "Comptabilité de trésorerie corrigée des variations d'inventaire et des amortissements (Titre X ch. 2 § 2), " +
            'formule officielle G = C - D + E - F, avec C = A - B. ANOMALIE DU TEXTE, signalée et non corrigée : la maquette ' +
            "invoque D et E sans les attribuer à aucune ligne · D regroupe ici les corrections soustraites (stocks, créances) " +
            "et E la correction ajoutée (dettes d'exploitation). La « Variation N / N-1 » est prise dans le sens (N-1) - N, " +
            'celui du compte 603.');
        (0, theme_etafi_1.largeurs)(ws, { A: 58, B: 7, C: 17, D: 17, E: 8 });
        ws.views = [{ state: 'frozen', ySplit: 8, showGridLines: false }];
        return rangs;
    }
    decompositionEcartSmtSyscohada(controle) {
        const m = (n) => n.toLocaleString('fr-FR');
        const c = controle.composantesEcart;
        return (`Décomposition : financement enregistré sans passer par la trésorerie ${m(c.classe1)} ; ` +
            `investissement enregistré sans passer par la trésorerie ${m(c.classe2)} ; ` +
            `dépréciations des comptes de trésorerie ${m(c.depreciationsTresorerie)} ; ` +
            `autres comptes ${m(c.autresComptes)} ; dotations reprises en F ${m(-c.dotations)} ; ` +
            `résiduel ${m(controle.residuel)}.`);
    }
    async compteDeResultatSmtSyscohadaExcel(tenantId, exerciceId) {
        const [cr, ident] = await Promise.all([
            this.smtSyscohada.compteDeResultat(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        const rangs = this.feuilleResultatSmtSyscohadaEtafi(classeur, cr, ident);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('Résultat'), Math.max(...rangs.values()) + 4, cr.controle.concordant
            ? 'Contrôle : le résultat G recoupe le résultat logé au bilan (poste « Résultat exercice »).'
            : `CONTRÔLE : écart de ${cr.controle.ecart.toLocaleString('fr-FR')} avec le résultat du bilan · ${this.decompositionEcartSmtSyscohada(cr.controle)}`);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `compte-de-resultat-smt-syscohada${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleJournalTresorerieSmtSyscohadaEtafi(classeur, journal, ident, nomFeuille = 'NOTE 4 JOURNAL TRESORERIE') {
        const ws = classeur.addWorksheet(nomFeuille);
        const colonnes = colonnesVentilationParSens(journal);
        const ncols = 5 + colonnes.length;
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'NOTE 4\nSMT SYSCOHADA', ncols);
        (0, theme_etafi_2.titreNote)(ws, 'NOTE 4 : JOURNAL DE TRESORERIE SMT', ncols);
        let r = 7;
        for (const j of journal.journaux) {
            r += 1;
            const c = ws.getCell(r, 1);
            c.value = `${j.numero} · ${j.intitule}`;
            c.font = { name: 'Arial', size: 9, bold: true };
            (0, theme_etafi_2.fusion)(ws, r, 1, r, ncols);
            r += 1;
            const debutTableau = r;
            bandeauVentilation(ws, r, journal.colonnesRecettes.length, journal.colonnesDepenses.length);
            r += 1;
            for (const [i, h] of ['Date', 'Libellés', 'Recettes', 'Dépenses', 'Solde'].entries()) {
                ws.getCell(r, i + 1).value = h;
            }
            colonnes.forEach((col, i) => {
                ws.getCell(r, 6 + i).value = col.rajoutAutorise ? `${col.libelle} (rajout NB)` : col.libelle;
            });
            (0, theme_etafi_1.entetesBande)(ws, debutTableau, r, 1, ncols);
            ws.getRow(r).height = 30;
            const colsMontant = [3, 4, 5, ...colonnes.map((_, i) => 6 + i)];
            const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
            const parMois = new Map();
            for (const operation of j.operations) {
                const d = new Date(operation.date);
                const cle = `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, '0')}`;
                parMois.set(cle, [...(parMois.get(cle) ?? []), operation]);
            }
            const mois = parMois.size > 0 ? [...parMois.keys()].sort() : [null];
            let rangSoldePrecedent = null;
            for (const cle of mois) {
                if (cle) {
                    r += 1;
                    const [annee, m] = cle.split('-').map(Number);
                    ws.getCell(r, 1).value = `Journal de trésorerie SMT · mois de ${MOIS[m]} Année ${annee}`;
                    ws.getCell(r, 1).font = { name: 'Arial', size: 8, bold: true };
                    (0, theme_etafi_2.fusion)(ws, r, 1, r, ncols);
                }
                r += 1;
                ws.getCell(r, 2).value = 'Report à nouveau';
                ws.getCell(r, 5).value = rangSoldePrecedent === null ? j.reportANouveau : { formula: `E${rangSoldePrecedent}` };
                (0, theme_etafi_1.styleLigne)(ws, r, 1, ncols, 'rubrique', [3, 4, 5]);
                for (const operation of cle ? parMois.get(cle) : []) {
                    r += 1;
                    ws.getCell(r, 1).value = new Date(operation.date);
                    ws.getCell(r, 1).numFmt = 'DD/MM/YYYY';
                    ws.getCell(r, 2).value = operation.virementInterne
                        ? `${operation.libelle} (virement interne)`
                        : operation.libelle;
                    if (operation.recette)
                        ws.getCell(r, 3).value = operation.recette;
                    if (operation.depense)
                        ws.getCell(r, 4).value = operation.depense;
                    ws.getCell(r, 5).value = { formula: `E${r - 1}+C${r}-D${r}` };
                    colonnes.forEach((col, i) => {
                        const v = ventilationDeLaColonne(operation, col);
                        if (v)
                            ws.getCell(r, 6 + i).value = v;
                    });
                    (0, theme_etafi_1.styleLigne)(ws, r, 1, ncols, 'normal', colsMontant);
                }
                r += 1;
                ws.getCell(r, 2).value = 'Solde à reporter';
                ws.getCell(r, 5).value = { formula: `E${r - 1}` };
                (0, theme_etafi_1.styleLigne)(ws, r, 1, ncols, 'inter', [3, 4, 5]);
                rangSoldePrecedent = r;
            }
            (0, theme_etafi_1.cadre)(ws, debutTableau, 1, r, ncols, theme_etafi_1.MOYEN);
            if (!j.boucle) {
                r += 1;
                (0, etat_etafi_1.ligneControleSousEtat)(ws, r, `CONTRÔLE : le solde à reporter diverge du solde balance du compte (${j.soldeBalance.toLocaleString('fr-FR')}).`);
            }
            if (j.lignesNonVentilees > 0) {
                r += 1;
                (0, etat_etafi_1.ligneControleSousEtat)(ws, r, `${j.lignesNonVentilees} opération(s) touchant plusieurs comptes de trésorerie : comptées en Recettes, Dépenses et Solde, laissées hors ventilation faute de clé de répartition portée par l'écriture.`);
            }
            r += 1;
        }
        if (journal.journaux.length === 0) {
            r += 1;
            (0, etat_etafi_1.ligneControleSousEtat)(ws, r, 'Aucun compte de trésorerie mouvementé sur cet exercice.');
        }
        r += 1;
        (0, etat_etafi_1.ligneControleSousEtat)(ws, r, journal.nb);
        const spec = { A: 11, B: 32, C: 13, D: 13, E: 13 };
        colonnes.forEach((_, i) => {
            spec[String.fromCharCode(70 + i)] = 14;
        });
        (0, theme_etafi_1.largeurs)(ws, spec);
        return ws;
    }
    feuilleJournauxDeSuiviSmtSyscohadaEtafi(classeur, suivi, ident) {
        const NB = 5;
        const ws = classeur.addWorksheet('JOURNAUX DE SUIVI');
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'JOURNAUX DE SUIVI\nSMT SYSCOHADA', NB);
        (0, theme_etafi_2.titreNote)(ws, 'JOURNAUX DE SUIVI DES CREANCES IMPAYEES ET DES DETTES A PAYER', NB);
        let r = 7;
        for (const j of suivi.journaux) {
            r += 1;
            ws.getCell(r, 1).value = j.intitule;
            ws.getCell(r, 1).font = { name: 'Arial', size: 9, bold: true };
            (0, theme_etafi_2.fusion)(ws, r, 1, r, NB);
            r += 1;
            const debut = r;
            j.colonnes.forEach((h, i) => (ws.getCell(r, i + 1).value = h));
            (0, theme_etafi_1.entetesBande)(ws, r, r, 1, NB);
            if (j.lignes.length === 0)
                r = (0, theme_etafi_1.bandeNeant)(ws, r + 1, NB) - 1;
            for (const l of j.lignes) {
                r += 1;
                ws.getCell(r, 1).value = new Date(l.date);
                ws.getCell(r, 1).numFmt = 'DD/MM/YYYY';
                ws.getCell(r, 2).value = l.numeroFacture ?? '';
                ws.getCell(r, 3).value = l.nom;
                ws.getCell(r, 4).value = l.montant;
                if (l.datePaiement) {
                    ws.getCell(r, 5).value = new Date(l.datePaiement);
                    ws.getCell(r, 5).numFmt = 'DD/MM/YYYY';
                }
                else if (l.paiementPartiel) {
                    ws.getCell(r, 5).value = 'Payée en partie';
                }
                (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'normal', [4]);
            }
            (0, theme_etafi_1.cadre)(ws, debut, 1, r, NB, theme_etafi_1.MOYEN);
            r += 1;
        }
        r += 1;
        (0, etat_etafi_1.ligneControleSousEtat)(ws, r, suivi.limite);
        (0, theme_etafi_1.largeurs)(ws, { A: 12, B: 16, C: 36, D: 16, E: 14 });
        return ws;
    }
    async journalTresorerieSmtSyscohadaExcel(tenantId, exerciceId) {
        const [journal, ident] = await Promise.all([
            this.smtSyscohada.journalTresorerie(tenantId, exerciceId),
            this.identiteLiasse(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        this.feuilleJournalTresorerieSmtSyscohadaEtafi(classeur, journal, ident);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `journal-tresorerie-smt-syscohada${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuillesNotesSmtSyscohadaEtafi(classeur, donnees, ident) {
        const { note1, note2, note3 } = donnees;
        {
            const NB = 5;
            const ws = classeur.addWorksheet('NOTE 1 MATERIEL-CAUTIONS');
            (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'NOTE 1\nSMT SYSCOHADA', NB);
            (0, theme_etafi_2.titreNote)(ws, 'NOTE 1 : TABLEAU SMT DE SUIVI DU MATERIEL, DU MOBILIER ET DES CAUTIONS', NB);
            let r = 8;
            for (const [i, h] of ['Date', 'Désignation', 'Montant', 'Date de sortie', 'Prix de cession'].entries()) {
                ws.getCell(r, i + 1).value = h;
            }
            (0, theme_etafi_1.entetesBande)(ws, r, r, 1, NB);
            ws.getRow(r).height = 26;
            if (note1.lignes.length === 0 &&
                note1.sortiesDeLExercice.length === 0 &&
                note1.ecartsImmobilisations.length === 0) {
                r = (0, theme_etafi_1.bandeNeant)(ws, r + 1, NB) - 1;
            }
            const ligneBien = (l) => {
                r += 1;
                if (l.date) {
                    ws.getCell(r, 1).value = new Date(l.date);
                    ws.getCell(r, 1).numFmt = 'DD/MM/YYYY';
                }
                ws.getCell(r, 2).value = l.designation;
                ws.getCell(r, 3).value = l.montant;
                if (l.dateSortie) {
                    ws.getCell(r, 4).value = new Date(l.dateSortie);
                    ws.getCell(r, 4).numFmt = 'DD/MM/YYYY';
                }
                if (l.prixCession !== null && l.prixCession !== undefined)
                    ws.getCell(r, 5).value = l.prixCession;
                (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'normal', [3, 5]);
                if (l.origine === 'BALANCE')
                    ws.getCell(r, 2).note = note1.motifCautions;
            };
            for (const l of note1.lignes)
                ligneBien(l);
            r += 1;
            ws.getCell(r, 2).value = 'TOTAL DES BIENS DÉTENUS À LA CLÔTURE';
            ws.getCell(r, 3).value = note1.total;
            (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'inter', [3]);
            if (note1.sortiesDeLExercice.length > 0) {
                r += 1;
                ws.getCell(r, 1).value = "Biens sortis pendant l'exercice · hors du total";
                (0, theme_etafi_2.fusion)(ws, r, 1, r, NB);
                (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'bande');
                for (const l of note1.sortiesDeLExercice)
                    ligneBien(l);
            }
            (0, theme_etafi_1.cadre)(ws, 8, 1, r, NB, theme_etafi_1.MOYEN);
            (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 2, `Registre des immobilisations (${note1.totalRegistre.toLocaleString('fr-FR')}) et cautions relevées au compte 275 (${note1.totalCautions.toLocaleString('fr-FR')}). ` +
                `Amortissement ${note1.amortissement.mode.toLowerCase()}${note1.amortissement.prorataTemporis ? '' : ' sans prorata temporis'} (Titre X ch. 1 § 1). ${note1.motifCautions}`);
            let rc = r + 3;
            if (note1.motifEcartsImmobilisations)
                (0, etat_etafi_1.ligneControleSousEtat)(ws, rc++, note1.motifEcartsImmobilisations);
            for (const e of note1.ecartsImmobilisations) {
                (0, etat_etafi_1.ligneControleSousEtat)(ws, rc++, `${e.numero} ${e.intitule} · solde brut ${e.soldeBalance.toLocaleString('fr-FR')}, fiches ${e.valeurFiches.toLocaleString('fr-FR')}, écart ${e.ecart.toLocaleString('fr-FR')}.`);
            }
            for (const f of note1.fichesSansSolde) {
                (0, etat_etafi_1.ligneControleSousEtat)(ws, rc++, `Fiche sans solde au compte : ${f.designation} (${f.montant.toLocaleString('fr-FR')}).`);
            }
            (0, theme_etafi_1.largeurs)(ws, { A: 15, B: 52, C: 17, D: 15, E: 17 });
        }
        {
            const NB = 5;
            const ws = classeur.addWorksheet('NOTE 2 STOCKS');
            (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'NOTE 2\nSMT SYSCOHADA', NB);
            (0, theme_etafi_2.titreNote)(ws, 'NOTE 2 : ETAT DES STOCKS AU 31 DECEMBRE', NB);
            let r = 8;
            for (const [i, h] of ['Référence', 'Désignation', 'Quantité', 'Prix unitaire', 'Montant'].entries()) {
                ws.getCell(r, i + 1).value = h;
            }
            (0, theme_etafi_1.entetesBande)(ws, r, r, 1, NB);
            ws.getRow(r).height = 26;
            if (note2.lignes.length === 0)
                r = (0, theme_etafi_1.bandeNeant)(ws, r + 1, NB) - 1;
            for (const l of note2.lignes) {
                r += 1;
                ws.getCell(r, 1).value = l.reference;
                ws.getCell(r, 2).value = l.designation;
                if (l.quantite !== null)
                    ws.getCell(r, 3).value = l.quantite;
                if (l.prixUnitaire !== null)
                    ws.getCell(r, 4).value = l.prixUnitaire;
                ws.getCell(r, 5).value = l.montant;
                (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'normal', [5]);
                formaterQuantiteEtPrix(ws, r);
            }
            for (const [libelle, montant] of [
                [note2.lignesSynthese[0], note2.valeurStockFinal],
                [note2.lignesSynthese[1], note2.valeurStockInitial],
            ]) {
                r += 1;
                ws.getCell(r, 2).value = libelle;
                ws.getCell(r, 5).value = montant;
                (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'inter', [5]);
            }
            (0, theme_etafi_1.cadre)(ws, 8, 1, r, NB, theme_etafi_1.MOYEN);
            (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 2, [
                `Variation portée au compte de résultat (ligne « Variation des stocks N / N-1 ») : ${note2.variationSv1.toLocaleString('fr-FR')}, sens (N-1) - N.`,
                note2.sourceQuantites,
                note2.motifQuantites,
            ]
                .filter(Boolean)
                .join(' '));
            (0, theme_etafi_1.largeurs)(ws, { A: 14, B: 48, C: 12, D: 15, E: 17 });
        }
        {
            const NB = 8;
            const COL_VENTILATION = 6;
            const ws = classeur.addWorksheet('NOTE 3 CREANCES-DETTES');
            (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'NOTE 3\nSMT SYSCOHADA', NB);
            (0, theme_etafi_2.titreNote)(ws, 'NOTE 3 : ETAT DES CREANCES ET DES DETTES NON ECHUES AU 31 DECEMBRE', NB);
            let r = 7;
            const tableau = (intitule, nomColonne, lignes, libelleTotal, totaux) => {
                r += 1;
                const c = ws.getCell(r, 1);
                c.value = intitule;
                c.font = { name: 'Arial', size: 9, bold: true };
                (0, theme_etafi_2.fusion)(ws, r, 1, r, NB);
                r += 1;
                const debut = r;
                ws.getCell(r, 1).value = 'MAQUETTE OFFICIELLE · AUDCIF, Titre X, ch. 3';
                (0, theme_etafi_2.fusion)(ws, r, 1, r, COL_VENTILATION - 1);
                ws.getCell(r, COL_VENTILATION).value = 'VENTILATION DU MONTANT AU 31/12/N PAR ÉCHÉANCE · ajout hors maquette';
                (0, theme_etafi_2.fusion)(ws, r, COL_VENTILATION, r, NB);
                r += 1;
                for (const [i, h] of [
                    'Date',
                    nomColonne,
                    'Montant au 31 décembre',
                    'Montant au 1er janvier',
                    'Variation %',
                    ...etat_etafi_1.ENTETES_VENTILATION_ECHEANCE,
                ].entries()) {
                    ws.getCell(r, i + 1).value = h;
                }
                (0, theme_etafi_1.entetesBande)(ws, debut, r, 1, NB);
                ws.getRow(r).height = 30;
                if (lignes.length === 0)
                    r = (0, theme_etafi_1.bandeNeant)(ws, r + 1, NB) - 1;
                for (const l of lignes) {
                    r += 1;
                    ws.getCell(r, 2).value = `${l.numero} ${l.nom}`;
                    ws.getCell(r, 3).value = l.montantCloture;
                    ws.getCell(r, 4).value = l.montantOuverture;
                    (0, etat_etafi_1.ecrireVentilationEcheance)(ws, r, COL_VENTILATION, {
                        nonEchu: l.montantNonEchu,
                        echu: l.montantEchu,
                        nonVentile: l.montantNonVentile,
                    });
                    (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'normal', [3, 4, 6, 7, 8]);
                    if (l.variationPourcent !== null && l.variationPourcent !== undefined) {
                        ws.getCell(r, 5).value = l.variationPourcent;
                        ws.getCell(r, 5).numFmt = '#,##0.00"%"';
                    }
                    ws.getCell(r, 5).note = `Variation EN VALEUR portée au compte de résultat : ${l.variationValeur.toFixed(2)} (sens (N-1) - N).`;
                }
                r += 1;
                ws.getCell(r, 2).value = libelleTotal;
                ws.getCell(r, 3).value = totaux.montant;
                (0, etat_etafi_1.ecrireVentilationEcheance)(ws, r, COL_VENTILATION, totaux);
                (0, theme_etafi_1.styleLigne)(ws, r, 1, NB, 'inter', [3, 6, 7, 8]);
                (0, theme_etafi_1.cadre)(ws, debut, 1, r, NB, theme_etafi_1.MOYEN);
                r += 1;
            };
            tableau('Créances', 'Nom du client', note3.creances, 'TOTAL DES CRÉANCES', {
                montant: note3.totalCreances,
                nonEchu: note3.totalCreancesNonEchues,
                echu: note3.totalCreancesEchues,
                nonVentile: note3.totalCreancesNonVentilees,
            });
            tableau('Dettes', 'Nom du fournisseur', note3.dettes, 'TOTAL DES DETTES', {
                montant: note3.totalDettes,
                nonEchu: note3.totalDettesNonEchues,
                echu: note3.totalDettesEchues,
                nonVentile: note3.totalDettesNonVentilees,
            });
            (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 1, `Variations portées au compte de résultat : créances ${note3.variationSv2.toLocaleString('fr-FR')}, dettes ${note3.variationSv3.toLocaleString('fr-FR')}. ${note3.reserveVariationPourcent}`);
            (0, etat_etafi_1.ligneControleSousEtat)(ws, r + 2, (0, etat_etafi_1.texteControleEcheances)(note3.motifEcheances, note3.totalCreancesNonVentilees, note3.totalDettesNonVentilees));
            (0, theme_etafi_1.largeurs)(ws, { A: 13, B: 46, C: 19, D: 19, E: 13, F: 18, G: 18, H: 20 });
        }
    }
    ficheNotesSmtSyscohadaEtafi(classeur, fiche, ident) {
        const parties = [
            [
                'Notes sur le bilan (Titre X ch. 3)',
                fiche.notes
                    .filter((n) => n.partie === 'BILAN')
                    .map((n) => [`NOTE ${n.numero}`, n.intitule]),
            ],
            [
                'Notes sur le compte de résultat (Titre X ch. 3)',
                fiche.notes
                    .filter((n) => n.partie !== 'BILAN')
                    .map((n) => [`NOTE ${n.numero}`, n.intitule]),
            ],
            [
                'Pièces de suivi non numérotées comme notes (Titre X ch. 1 § 1 et ch. 3)',
                fiche.journauxDeSuivi.map((j) => [j.intitule, j.colonnes.join(' · ')]),
            ],
        ];
        (0, theme_etafi_2.construireFicheNotes)(classeur, parties, ident, undefined, 'NOTES ANNEXES', "Inventaire extra-comptable de fin d'exercice exigé par le Titre X ch. 1 § 1 : " +
            `${fiche.inventaireExtraComptable.join(' · ')}. Chaque immobilisation fait l'objet d'un tableau d'amortissement ` +
            `${fiche.amortissement.mode.toLowerCase()}${fiche.amortissement.prorataTemporis ? '' : ' sans prorata temporis'}.`);
        return parties;
    }
    async notesSmtSyscohadaExcel(tenantId, exerciceId) {
        const [ident, note1, note2, note3, journal, suivi] = await Promise.all([
            this.identiteLiasse(tenantId, exerciceId),
            this.smtSyscohada.note1MaterielMobilierCautions(tenantId, exerciceId),
            this.smtSyscohada.note2Stocks(tenantId, exerciceId),
            this.smtSyscohada.note3CreancesDettes(tenantId, exerciceId),
            this.smtSyscohada.journalTresorerie(tenantId, exerciceId),
            this.smtSyscohada.journauxDeSuivi(tenantId, exerciceId),
        ]);
        const classeur = this.nouveauClasseur();
        this.ficheNotesSmtSyscohadaEtafi(classeur, this.smtSyscohada.ficheNotes(), ident);
        this.feuillesNotesSmtSyscohadaEtafi(classeur, { note1, note2, note3 }, ident);
        this.feuilleJournalTresorerieSmtSyscohadaEtafi(classeur, journal, ident);
        this.feuilleJournauxDeSuiviSmtSyscohadaEtafi(classeur, suivi, ident);
        (0, theme_etafi_1.numeroterPages)(classeur);
        return {
            buffer: await this.versBuffer(classeur),
            nomFichier: `notes-annexes-smt-syscohada${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
    feuilleFicheR2Syscohada(classeur, ident, forme, notes, declare, portefeuille = { entreprisePortefeuilleEtat: null, quotePartEtatCapital: null }) {
        const NB = 10;
        const ws = classeur.addWorksheet('Fiche R2');
        (0, theme_etafi_1.ecrireCartouche)(ws, ident, 'FICHE R2', NB);
        (0, theme_etafi_2.fusion)(ws, 7, 1, 7, NB);
        let c = ws.getCell(7, 1);
        c.value = 'FICHE D\'IDENTIFICATION ET RENSEIGNEMENTS DIVERS 2 (FICHE R2)';
        c.font = { name: 'Arial', size: 11, bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        (0, theme_etafi_2.fusion)(ws, 8, 1, 8, NB);
        ws.getCell(8, 1).value =
            'Codes ZK à ZS de l\'AUDCIF (Titre IX ch. 2) · distincts des cases homonymes de la Fiche 1 au gabarit ETAFI.';
        ws.getCell(8, 1).font = { name: 'Arial', size: 8, italic: true };
        const n36 = notes.notes.find((n) => n.code === '36');
        const saisi = (cle) => {
            const v = n36?.lignes.find((l) => l.cle === cle)?.saisie?.[0];
            return v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim();
        };
        const zk = saisi('1-code-forme-juridique-1');
        const saDuPortefeuille = forme === 'SOCIETE_ANONYME' && portefeuille.entreprisePortefeuilleEtat === true;
        const proposition = saDuPortefeuille ? '00' : forme ? CODE_FORME_UNIVOQUE_FICHE_R2[forme] : undefined;
        const valeurZk = zk ??
            (proposition
                ? `Non renseigné · la NOTE 36 donne ${proposition} (1${proposition.slice(1)} avec agrément prioritaire)` +
                    (saDuPortefeuille ? ' · SA à participation publique, entreprise du portefeuille de l’État déclarée' : '')
                : 'Non renseigné · à déclarer à la NOTE 36');
        const quote = portefeuille.entreprisePortefeuilleEtat === true ? portefeuille.quotePartEtatCapital : null;
        const zqPublic = (declare?.controleEntreprise ?? null) === null && quote !== null && quote > 50
            ? `Non renseignée · contrôle public proposé (quote-part de l’État déclarée · ${quote} %)`
            : caseControleR2(declare, 'PUBLIC');
        const lignes = [
            ['ZK', 'Forme juridique (1)', valeurZk],
            ['ZL', 'Régime fiscal (1)', saisi('2-code-regime-fiscal') ?? 'Non renseigné · à déclarer à la NOTE 36'],
            ['ZM', 'Pays du siège social (1)', saisi('3-code-pays-du-siege-social-2') ?? 'Non renseigné · à déclarer à la NOTE 36'],
            ['ZN', "Nombre d'établissements dans le pays", nombreR2(declare?.nombreEtablissementsPays)],
            [
                'ZO',
                "Nombre d'établissements hors du pays pour lesquels une comptabilité distincte est tenue",
                nombreR2(declare?.nombreEtablissementsHorsPays),
            ],
            ['ZP', "Première année d'exercice dans le pays", nombreR2(declare?.premiereAnneeExercicePays)],
            ['ZQ', "Contrôle de l'entreprise : entreprise sous contrôle public", zqPublic],
            [
                'ZQ',
                "Contrôle de l'entreprise : entreprise sous contrôle privé national [texte officiel : code ZQ employé deux fois]",
                caseControleR2(declare, 'PRIVE_NATIONAL'),
            ],
            ['ZS', "Contrôle de l'entreprise : entreprise sous contrôle privé étranger", caseControleR2(declare, 'PRIVE_ETRANGER')],
        ];
        let r = 9;
        for (const [code, lab, val] of lignes) {
            r += 1;
            ws.getCell(r, 1).value = code;
            ws.getCell(r, 1).font = { name: 'Arial', size: 8, bold: true };
            (0, theme_etafi_2.fusion)(ws, r, 2, r, 6);
            ws.getCell(r, 2).value = lab;
            ws.getCell(r, 2).font = { name: 'Arial', size: 8 };
            (0, theme_etafi_2.fusion)(ws, r, 7, r, NB);
            ws.getCell(r, 7).value = val;
            ws.getCell(r, 7).font = { name: 'Arial', size: 8, bold: true };
            ws.getRow(r).height = 22;
        }
        r += 2;
        (0, theme_etafi_2.fusion)(ws, r, 1, r, NB);
        ws.getCell(r, 1).value = "ACTIVITE DE L'ENTREPRISE";
        ws.getCell(r, 1).font = { name: 'Arial', size: 10, bold: true };
        r += 1;
        const entetes = [
            ["Désignation de l'activité (2)", 1, 4],
            ["Code nomenclature d'activité (1)", 5, 6],
            ['Chiffre d\'affaires HT (CA HT) ou valeur ajoutée (VA) (3)', 7, 8],
            ['% activité dans le CA HT ou la VA', 9, 10],
        ];
        for (const [lab, c1, c2] of entetes) {
            (0, theme_etafi_2.fusion)(ws, r, c1, r, c2);
            ws.getCell(r, c1).value = lab;
        }
        (0, theme_etafi_1.entetesBande)(ws, r, r, 1, NB);
        for (let i = 0; i < 8; i++) {
            r += 1;
            for (const [, c1, c2] of entetes)
                (0, theme_etafi_2.fusion)(ws, r, c1, r, c2);
        }
        for (const lib of ['Divers', 'TOTAL']) {
            r += 1;
            for (const [, c1, c2] of entetes)
                (0, theme_etafi_2.fusion)(ws, r, c1, r, c2);
            ws.getCell(r, 1).value = lib;
            ws.getCell(r, 1).font = { name: 'Arial', size: 8, bold: lib === 'TOTAL' };
        }
        r += 2;
        for (const [ref, lib] of [
            ['XB', "Chiffre d'affaires HT de l'exercice (XB, feuille Résultat)"],
            ['XC', "Valeur ajoutée de l'exercice (XC, feuille Résultat)"],
        ]) {
            (0, theme_etafi_2.fusion)(ws, r, 1, r, 6);
            ws.getCell(r, 1).value = lib;
            ws.getCell(r, 1).font = { name: 'Arial', size: 8 };
            (0, theme_etafi_2.fusion)(ws, r, 7, r, 8);
            ws.getCell(r, 7).value = { formula: `INDEX('Résultat'!D:D,MATCH("${ref}",'Résultat'!A:A,0))` };
            ws.getCell(r, 7).numFmt = '#,##0';
            r += 1;
        }
        r += 1;
        for (const renvoi of [
            '(1) Voir les tables des codes, NOTE 36 [texte officiel : le renvoi imprime NOTE 34].',
            "(2) Lister de manière précise les activités dans l'ordre décroissant du CA HT, ou de la valeur ajoutée (VA).",
            '(3) Rayer la mention inutile (utiliser de préférence la VA).',
        ]) {
            (0, theme_etafi_2.fusion)(ws, r, 1, r, NB);
            ws.getCell(r, 1).value = renvoi;
            ws.getCell(r, 1).font = { name: 'Arial', size: 8 };
            r += 1;
        }
        (0, theme_etafi_1.largeurs)(ws, { A: 8, B: 12, C: 12, D: 12, E: 10, F: 10, G: 12, H: 12, I: 9, J: 9 });
        return ws;
    }
    async liasseSyscohadaEtafi(tenantId, exerciceId) {
        const [ident, tenant, bilan, cr, tft, notes, exerciceN1Id] = await Promise.all([
            this.identiteLiasse(tenantId, exerciceId),
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
            this.syscohada.bilan(tenantId, exerciceId),
            this.syscohada.compteDeResultat(tenantId, exerciceId),
            this.syscohada.tableauFluxTresorerie(tenantId, exerciceId),
            this.noteAnnexeService.notesSyscohada(tenantId, exerciceId),
            this.exerciceN1Id(tenantId, exerciceId),
        ]);
        const balN = await this.lignesBalanceLiasse(tenantId, exerciceId);
        const balN1 = exerciceN1Id ? await this.lignesBalanceLiasse(tenantId, exerciceN1Id) : null;
        const classeur = this.nouveauClasseur();
        const corpsN = await (0, theme_etafi_2.ecrireFeuilleBalance)(classeur, theme_etafi_2.NOM_BALANCE, balN);
        const corpsN1 = balN1 ? await (0, theme_etafi_2.ecrireFeuilleBalance)(classeur, theme_etafi_2.NOM_BALANCE_N1, balN1) : null;
        (0, theme_etafi_2.construireControleBalance)(classeur, corpsN, corpsN1);
        (0, theme_etafi_2.construireCouverture)(classeur, ident, 'LIASSE SYSTEME NORMAL', tenant.pays ?? '');
        (0, theme_etafi_2.construireGarde)(classeur, ident, {
            bandeau: 'ETATS FINANCIERS NORMALISES\nDU SYSTEME COMPTABLE OHADA (SYSCOHADA)',
            sousBandeau: 'Entités astreintes à la comptabilité financière (AUDCIF art. 2)',
            systeme: 'SYSTEME NORMAL',
            documents: [
                "Fiche d'identification et renseignements divers",
                'Bilan',
                'Compte de résultat',
                'Tableau des flux de trésorerie',
                'Notes annexes',
            ],
            contextureAudcif: true,
        });
        (0, theme_etafi_2.construireFiche1)(classeur, ident, 'SYSCOHADA', 'Système normal', {
            ...(await this.champsFiche1(tenantId, exerciceId, tenant, true)),
            ZI: tenant.codeActivitePrincipale ?? '',
            ZE: (0, mentions_immatriculation_1.numeroRegistreLiasse)(tenant),
            ZW: await this.domiciliationsBancaires(tenantId),
        });
        const declarationsR2 = await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: {
                nombreEtablissementsPays: true,
                nombreEtablissementsHorsPays: true,
                premiereAnneeExercicePays: true,
                controleEntreprise: true,
            },
        });
        this.feuilleFicheR2Syscohada(classeur, ident, tenant.formeJuridiqueSyscohada, notes, declarationsR2, {
            entreprisePortefeuilleEtat: tenant.entreprisePortefeuilleEtat ?? null,
            quotePartEtatCapital: tenant.quotePartEtatCapital === null || tenant.quotePartEtatCapital === undefined
                ? null
                : Number(tenant.quotePartEtatCapital),
        });
        (0, theme_etafi_2.construireFiche2)(classeur, ident, 'DIRIGEANTS (1)', [], 'FICHE 2', 20, true);
        const versCote = (postes, libelle) => ({
            feuille: libelle === 'ACTIF' ? 'Bilan-Actif' : 'Bilan-Passif',
            libelle,
            cols: libelle === 'ACTIF'
                ? [
                    { entete: 'BRUT', lettre: 'D' },
                    { entete: 'AMORT. et DEPREC.', lettre: 'E' },
                    { entete: 'NET', lettre: 'F' },
                    { entete: 'NET N-1', lettre: 'G' },
                ]
                : [
                    { entete: 'NET', lettre: 'D' },
                    { entete: 'NET N-1', lettre: 'E' },
                ],
            lignes: postes.map((p, i) => ({
                ref: p.ref,
                libelle: p.libelle,
                note: p.note ?? etat_etafi_1.NOTE_PAR_REF_SYSCOHADA[p.ref] ?? '',
                rangSource: 10 + i,
                niveau: etat_etafi_1.NIVEAUX_ETAT_SYSCOHADA[p.ref] ?? (p.estTotal ? 'inter' : 'normal'),
            })),
        });
        (0, theme_etafi_2.construireBilanPaysage)(classeur, ident, versCote(bilan.actif, 'ACTIF'), versCote(bilan.passif, 'PASSIF'), 'BILAN AU 31 DECEMBRE N');
        const { rangsActif, rangsPassif } = this.feuillesBilanSyscohadaEtafi(classeur, bilan, ident);
        const rangsCr = this.feuilleResultatSyscohadaEtafi(classeur, cr, ident);
        const { rangs: rangsTft, dernier } = this.feuilleTftSyscohadaEtafi(classeur, tft, ident);
        (0, etat_etafi_1.ligneControleSousEtat)(classeur.getWorksheet('TFT'), dernier + 1, this.controlesTftSyscohada(tft));
        this.construireClasseurNotes(notes, ident, ExportService_1.PARTIES_NOTES_SYSCOHADA, classeur, {}, ExportService_1.PIED_FICHE_R4_SYSCOHADA);
        const parCode = new Map(notes.ficheRecapitulative.map((n) => [n.code, n.titre]));
        const parties = ExportService_1.PARTIES_NOTES_SYSCOHADA.map(([titre, codes]) => [
            titre,
            codes.filter((c) => parCode.has(c)).map((c) => [`NOTE ${c}`, parCode.get(c)]),
        ]);
        (0, theme_etafi_2.construireTableCommentaires)(classeur, parties, ident);
        const ctl = classeur.addWorksheet('CONTROLES');
        ctl.getCell(1, 1).value = 'Contrôle';
        ctl.getCell(1, 2).value = 'Valeur';
        ctl.getCell(1, 3).value = 'Attendu';
        (0, theme_etafi_1.entetesBande)(ctl, 1, 1, 1, 3);
        const tftNonControlable = tft.controle.coherent === null;
        const controles = [
            ['Total solde de clôture débit balance', (0, theme_etafi_2.sommeColonneBalance)(theme_etafi_2.NOM_BALANCE, corpsN, 'G'), ''],
            ['Total solde de clôture crédit balance', (0, theme_etafi_2.sommeColonneBalance)(theme_etafi_2.NOM_BALANCE, corpsN, 'H'), ''],
            ['Écart balance (doit être 0)', 'B2-B3', 0],
            ['TOTAL GÉNÉRAL actif net (BZ)', `'Bilan-Actif'!F${rangsActif.get('BZ')}`, ''],
            ['TOTAL GÉNÉRAL passif (DZ)', `'Bilan-Passif'!D${rangsPassif.get('DZ')}`, ''],
            ['Écart bilan actif - passif (doit être 0)', 'B5-B6', 0],
            ['RÉSULTAT NET du compte de résultat (XI)', `Résultat!D${rangsCr.get('XI')}`, ''],
            ["Résultat net logé au bilan (CJ)", resultatDeLExerciceLogeAuBilan(`'Bilan-Passif'!D${rangsPassif.get('CJ')}`, bilan), ''],
            ['Écart résultat CR / bilan (doit être 0)', 'B8-B9', 0],
            [
                'Trésorerie nette au 31 Décembre par les flux (TFT, ZH)',
                tftNonControlable ? { texte: 'Laissée vide · voir ANOMALIES' } : `TFT!D${rangsTft.get('ZH')}`,
                '',
            ],
            [
                'Contrôle du modèle : Trésorerie actif N - Trésorerie passif N (BT - DT)',
                `'Bilan-Actif'!F${rangsActif.get('BT')}-'Bilan-Passif'!D${rangsPassif.get('DT')}`,
                '',
            ],
            tftNonControlable
                ? ['Écart de bouclage du TFT · contrôle non effectué', { texte: 'Non contrôlable' }, '']
                : ['Écart de bouclage du TFT (doit être 0)', 'B11-B12', 0],
            [
                'Résultat par les classes 6/7/8 (avant clôture)',
                bilan.controle.resultatClasses678,
                '',
            ],
            ['Résultat par le compte 13 (non affecté ou après clôture)', bilan.controle.resultatCompte13, ''],
        ];
        let rc = 1;
        for (const [lab, val, attendu] of controles) {
            rc += 1;
            ctl.getCell(rc, 1).value = lab;
            ctl.getCell(rc, 2).value = typeof val === 'string' ? { formula: val } : typeof val === 'number' ? val : val.texte;
            ctl.getCell(rc, 3).value = attendu;
            (0, theme_etafi_1.styleLigne)(ctl, rc, 1, 3, 'normal', [2]);
        }
        (0, theme_etafi_1.largeurs)(ctl, { A: 68, B: 24, C: 14 });
        const an = classeur.addWorksheet('ANOMALIES');
        for (const [i, h] of ['Gravité', 'Compte / poste', 'Intitulé', 'Problème', 'Solution proposée'].entries()) {
            an.getCell(1, i + 1).value = h;
        }
        (0, theme_etafi_1.entetesBande)(an, 1, 1, 1, 5);
        const anomalies = [];
        if (!bilan.equilibre) {
            anomalies.push([
                'BLOQUANT',
                'BZ / DZ',
                'Bilan',
                `Actif et passif diffèrent de ${(bilan.totalActif - bilan.totalPassif).toFixed(2)}.`,
                'Vérifier les écritures déséquilibrées et les comptes non rattachés ci-dessous.',
            ]);
        }
        if (!cr.controle.coherent) {
            anomalies.push([
                'A_TRAITER',
                'XI',
                'Compte de résultat',
                `Écart de ${cr.controle.ecart.toFixed(2)} entre le résultat net des postes officiels et le solde de toutes les classes de gestion.`,
                'Rattacher les comptes de gestion listés ci-dessous à un poste du ch. 7.',
            ]);
        }
        if (tft.controle.coherent === false) {
            anomalies.push([
                'A_TRAITER',
                'ZH',
                'Tableau des flux de trésorerie',
                `Écart de ${(tft.controle.ecart ?? 0).toFixed(2)} entre ZH par les flux et BT - DT du bilan · l’écart chiffre ce que la ventilation FA à FQ ne couvre pas.`,
                'Examiner les comptes non ventilés ci-dessous.',
            ]);
        }
        if (tft.controle.coherent === null) {
            anomalies.push([
                'INFO',
                'ZH',
                'Tableau des flux de trésorerie',
                tft.controle.motifNonControlable ?? 'Contrôle non effectué.',
                'Lever la cause des postes laissés vides (lignes du tableau des flux ci-dessous) ; le contrôle se fera alors.',
            ]);
        }
        for (const c of bilan.comptesNonRattaches) {
            anomalies.push([
                'A_TRAITER',
                c.numero,
                c.intitule,
                "Compte de bilan qu'aucun poste du tableau de correspondance officiel (Titre IX ch. 7) ne réclame · son montant n'entre dans aucun total.",
                'Vérifier le numéro de compte, ou créer le compte au bon niveau du plan.',
            ]);
        }
        for (const c of cr.comptesNonRattaches) {
            anomalies.push([
                'A_TRAITER',
                c.numero,
                c.intitule,
                "Compte de gestion qu'aucun poste officiel du compte de résultat ne réclame.",
                'Vérifier le numéro de compte.',
            ]);
        }
        for (const c of tft.comptesNonVentiles) {
            anomalies.push([
                'A_VERIFIER',
                c.numero,
                c.intitule,
                `Mouvement de trésorerie qu'aucun poste FA à FQ ne ventile (${c.montant.toFixed(2)}).`,
                'Rapprocher l’opération de la ventilation du ch. 5 ; l’écart de bouclage de ZH en dépend.',
            ]);
        }
        for (const p of tft.postesNonCalculables) {
            anomalies.push(anomaliePosteDeFlux(p.ref, p.raison, 'N', p.aLever));
        }
        for (const p of tft.postesNonCalculablesN1 ?? []) {
            anomalies.push(anomaliePosteDeFlux(p.ref, p.raison, 'N-1', p.aLever));
        }
        anomalies.push(...anomalieResultatAnterieurNonVire(bilan));
        anomalies.push(...this.provenanceDuComparatif(bilan, cr, tft));
        if (anomalies.length === 0)
            anomalies.push(['INFO', '·', '·', 'Aucune anomalie détectée sur cet exercice.', '·']);
        let ra = 1;
        for (const ligne of anomalies) {
            ra += 1;
            ligne.forEach((v, i) => {
                an.getCell(ra, i + 1).value = v;
            });
            (0, theme_etafi_1.styleLigne)(an, ra, 1, 5, 'normal');
        }
        (0, theme_etafi_1.largeurs)(an, { A: 12, B: 16, C: 30, D: 70, E: 62 });
        an.views = [{ state: 'frozen', ySplit: 1 }];
        (0, theme_etafi_1.numeroterPages)(classeur);
        return classeur;
    }
    async liasseSmtSyscohadaEtafi(tenantId, exerciceId) {
        const [ident, tenant, bilan, cr, journal, note1, note2, note3, eligibilite, exerciceN1Id] = await Promise.all([
            this.identiteLiasse(tenantId, exerciceId),
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
            this.smtSyscohada.bilan(tenantId, exerciceId),
            this.smtSyscohada.compteDeResultat(tenantId, exerciceId),
            this.smtSyscohada.journalTresorerie(tenantId, exerciceId),
            this.smtSyscohada.note1MaterielMobilierCautions(tenantId, exerciceId),
            this.smtSyscohada.note2Stocks(tenantId, exerciceId),
            this.smtSyscohada.note3CreancesDettes(tenantId, exerciceId),
            this.smtSyscohada.eligibilite(tenantId, exerciceId),
            this.exerciceN1Id(tenantId, exerciceId),
        ]);
        const suivi = await this.smtSyscohada.journauxDeSuivi(tenantId, exerciceId);
        const balN = await this.lignesBalanceLiasse(tenantId, exerciceId);
        const balN1 = exerciceN1Id ? await this.lignesBalanceLiasse(tenantId, exerciceN1Id) : null;
        const classeur = this.nouveauClasseur();
        const corpsN = await (0, theme_etafi_2.ecrireFeuilleBalance)(classeur, theme_etafi_2.NOM_BALANCE, balN);
        const corpsN1 = balN1 ? await (0, theme_etafi_2.ecrireFeuilleBalance)(classeur, theme_etafi_2.NOM_BALANCE_N1, balN1) : null;
        (0, theme_etafi_2.construireControleBalance)(classeur, corpsN, corpsN1);
        (0, theme_etafi_2.construireCouverture)(classeur, ident, 'LIASSE SMT', tenant.pays ?? '');
        (0, theme_etafi_2.construireGarde)(classeur, ident, {
            bandeau: 'ETATS FINANCIERS NORMALISES\nDU SYSTEME COMPTABLE OHADA (SYSCOHADA)',
            sousBandeau: 'Entités astreintes à la comptabilité financière (AUDCIF art. 2)',
            systeme: 'SYSTEME MINIMAL DE TRESORERIE',
            documents: [
                "Fiche d'identification et renseignements divers",
                'Bilan',
                'Compte de résultat',
                'Notes annexes 1 à 3',
            ],
        });
        (0, theme_etafi_2.construireFiche1)(classeur, ident, 'SYSCOHADA', 'Système minimal de trésorerie', {
            ...(await this.champsFiche1(tenantId, exerciceId, tenant, true)),
            ZE: (0, mentions_immatriculation_1.numeroRegistreLiasse)(tenant),
            ZI: tenant.codeActivitePrincipale ?? '',
        });
        (0, theme_etafi_2.construireFiche2)(classeur, ident, 'DIRIGEANTS');
        const versCote = (postes, libelle) => {
            const details = postes.filter((p) => !p.estTotal);
            const total = postes.find((p) => p.estTotal);
            return {
                feuille: libelle === 'ACTIF' ? 'Bilan-Actif' : 'Bilan-Passif',
                libelle,
                cols: [
                    { entete: 'EXERCICE N', lettre: 'C' },
                    { entete: 'EXERCICE N-1', lettre: 'D' },
                ],
                lignes: [
                    ...details.map((p, i) => ({
                        ref: '',
                        libelle: p.libelle,
                        note: p.note ?? '',
                        rangSource: 9 + i,
                        niveau: 'normal',
                    })),
                    {
                        ref: '',
                        libelle: total?.libelle ?? (libelle === 'ACTIF' ? 'Total actif' : 'Total passif'),
                        note: '',
                        rangSource: 9 + details.length,
                        niveau: 'general',
                    },
                ],
            };
        };
        (0, theme_etafi_2.construireBilanPaysage)(classeur, ident, versCote(bilan.actif, 'ACTIF'), versCote(bilan.passif, 'PASSIF'), 'BILAN SMT AU 31 DECEMBRE N');
        const { rangsActif, rangsPassif } = this.feuillesBilanSmtSyscohadaEtafi(classeur, bilan, ident);
        const rangsCr = this.feuilleResultatSmtSyscohadaEtafi(classeur, cr, ident);
        const parties = this.ficheNotesSmtSyscohadaEtafi(classeur, this.smtSyscohada.ficheNotes(), ident);
        this.feuillesNotesSmtSyscohadaEtafi(classeur, { note1, note2, note3 }, ident);
        this.feuilleJournalTresorerieSmtSyscohadaEtafi(classeur, journal, ident);
        this.feuilleJournauxDeSuiviSmtSyscohadaEtafi(classeur, suivi, ident);
        (0, theme_etafi_2.construireTableCommentaires)(classeur, parties, ident);
        const ctl = classeur.addWorksheet('CONTROLES');
        ctl.getCell(1, 1).value = 'Contrôle';
        ctl.getCell(1, 2).value = 'Valeur';
        ctl.getCell(1, 3).value = 'Attendu';
        (0, theme_etafi_1.entetesBande)(ctl, 1, 1, 1, 3);
        const controles = [
            ['Total solde de clôture débit balance', (0, theme_etafi_2.sommeColonneBalance)(theme_etafi_2.NOM_BALANCE, corpsN, 'G'), ''],
            ['Total solde de clôture crédit balance', (0, theme_etafi_2.sommeColonneBalance)(theme_etafi_2.NOM_BALANCE, corpsN, 'H'), ''],
            ['Écart balance (doit être 0)', 'B2-B3', 0],
            ['Total actif', `'Bilan-Actif'!C${rangsActif.get('SAZ')}`, ''],
            ['Total passif', `'Bilan-Passif'!C${rangsPassif.get('SPZ')}`, ''],
            ['Écart bilan actif - passif (doit être 0)', 'B5-B6', 0],
            ['RÉSULTAT EXERCICE du compte de résultat (G = C - D + E - F)', `Résultat!C${rangsCr.get('SG')}`, ''],
            ['Résultat logé au bilan (poste « Résultat exercice »)', resultatDeLExerciceLogeAuBilan(`'Bilan-Passif'!C${rangsPassif.get('SP2')}`, bilan), ''],
            ['Écart résultat CR / bilan (doit être 0)', 'B8-B9', 0],
            [
                "Chiffre d'affaires de l'exercice (art. 13, compte 70)",
                eligibilite.chiffreAffaires,
                eligibilite.deviseDossier,
            ],
            ...eligibilite.seuils.map((s) => [`Seuil art. 13 · ${s.categorie}`, s.montantFcfa, `F CFA, ${s.clause}`]),
        ];
        let rc = 1;
        for (const [lab, val, attendu] of controles) {
            rc += 1;
            ctl.getCell(rc, 1).value = lab;
            ctl.getCell(rc, 2).value = typeof val === 'string' ? { formula: val } : val;
            ctl.getCell(rc, 3).value = attendu;
            (0, theme_etafi_1.styleLigne)(ctl, rc, 1, 3, 'normal', [2]);
        }
        rc += 2;
        (0, etat_etafi_1.ligneControleSousEtat)(ctl, rc, eligibilite.avertissementConversion);
        rc += 1;
        (0, etat_etafi_1.ligneControleSousEtat)(ctl, rc, eligibilite.qualificationParLEntite);
        rc += 1;
        (0, etat_etafi_1.ligneControleSousEtat)(ctl, rc, eligibilite.rappelArticle11);
        (0, theme_etafi_1.largeurs)(ctl, { A: 68, B: 24, C: 46 });
        const an = classeur.addWorksheet('ANOMALIES');
        for (const [i, h] of ['Gravité', 'Compte / poste', 'Intitulé', 'Problème', 'Solution proposée'].entries()) {
            an.getCell(1, i + 1).value = h;
        }
        (0, theme_etafi_1.entetesBande)(an, 1, 1, 1, 5);
        const anomalies = [];
        if (!bilan.equilibre) {
            anomalies.push([
                'BLOQUANT',
                'Total actif / Total passif',
                'Bilan SMT',
                `Actif et passif diffèrent de ${(bilan.totalActif - bilan.totalPassif).toFixed(2)}.`,
                'Vérifier les écritures déséquilibrées et les comptes hors maquette.',
            ]);
        }
        if (!cr.controle.concordant) {
            anomalies.push([
                'A_TRAITER',
                'G',
                'Compte de résultat SMT',
                `Écart de ${cr.controle.ecart.toFixed(2)} avec le résultat du bilan (résidu inexpliqué : ${cr.controle.residuel.toFixed(2)}).`,
                this.decompositionEcartSmtSyscohada(cr.controle),
            ]);
        }
        for (const c of bilan.comptesNonRattaches) {
            anomalies.push([
                'A_TRAITER',
                c.numero,
                c.intitule,
                "Compte de bilan qu'aucun poste de la maquette SMT ne capte · son montant n'entre dans aucun total.",
                'Vérifier le numéro de compte, ou créer le compte au bon niveau du plan.',
            ]);
        }
        for (const j of journal.journaux) {
            if (!j.boucle) {
                anomalies.push([
                    'A_TRAITER',
                    j.numero,
                    j.intitule,
                    `Le journal de trésorerie ne boucle pas avec la balance (écart ${(j.soldeAReporter - j.soldeBalance).toFixed(2)}).`,
                    'Vérifier les écritures du compte.',
                ]);
            }
        }
        for (const c of cr.contrepartiesNonRattachees) {
            anomalies.push([
                'A_VERIFIER',
                c.numero,
                c.intitule,
                `Contrepartie de trésorerie qu'aucun poste A / B ni aucune rubrique hors résultat ne capte (${c.montant.toFixed(2)}).`,
                'Vérifier le numéro de compte de la contrepartie.',
            ]);
        }
        const plusBasSeuil = Math.min(...eligibilite.seuils.map((s) => s.montantFcfa));
        if (eligibilite.chiffreAffaires > plusBasSeuil) {
            anomalies.push([
                'A_VERIFIER',
                'art. 13',
                'Éligibilité au Système minimal de trésorerie',
                `Chiffre d'affaires de ${eligibilite.chiffreAffaires.toLocaleString('fr-FR')} ${eligibilite.deviseDossier} face à des seuils exprimés en F CFA (30 à 60 millions selon la catégorie). ${eligibilite.avertissementConversion}`,
                eligibilite.qualificationParLEntite,
            ]);
        }
        anomalies.push(...anomalieResultatAnterieurNonVire(bilan));
        anomalies.push(...this.provenanceDuComparatif(bilan, cr));
        if (anomalies.length === 0)
            anomalies.push(['INFO', '·', '·', 'Aucune anomalie détectée sur cet exercice.', '·']);
        let ra = 1;
        for (const ligne of anomalies) {
            ra += 1;
            ligne.forEach((v, i) => {
                an.getCell(ra, i + 1).value = v;
            });
            (0, theme_etafi_1.styleLigne)(an, ra, 1, 5, 'normal');
        }
        (0, theme_etafi_1.largeurs)(an, { A: 12, B: 22, C: 30, D: 70, E: 62 });
        an.views = [{ state: 'frozen', ySplit: 1 }];
        (0, theme_etafi_1.numeroterPages)(classeur);
        return classeur;
    }
    async liasseCompleteExcel(tenantId, exerciceId, paiementsEnInstance = null) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
        if (tenant.referentiel === client_1.Referentiel.SYSCOHADA) {
            const natifSyscohada = tenant.systemeComptableSyscohada === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE
                ? await this.liasseSmtSyscohadaEtafi(tenantId, exerciceId)
                : await this.liasseSyscohadaEtafi(tenantId, exerciceId);
            return {
                buffer: await this.versBuffer(natifSyscohada),
                nomFichier: `liasse-complete${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
            };
        }
        const jeu = tenant.jeuEtatsFinanciersSycebnl;
        const natif = jeu === client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS
            ? await this.liasseAssociationsEtafi(tenantId, exerciceId)
            : jeu === client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT
                ? await this.liasseProjetsEtafi(tenantId, exerciceId, paiementsEnInstance)
                : await this.liasseSmtEtafi(tenantId, exerciceId);
        return {
            buffer: await this.versBuffer(natif),
            nomFichier: `liasse-complete${await this.suffixeExercice(tenantId, exerciceId)}.xlsx`,
        };
    }
};
exports.ExportService = ExportService;
ExportService.MAX_LIGNES_CLASSEUR_EN_MEMOIRE = 50_000;
ExportService.DECALAGE_COIFFE = 3;
ExportService.GROUPES_ACTIF = [
    { titre: 'EXERCICE AU 31/12/N', sousTitres: ['BRUT', 'AMORT et DEPREC.', 'NET'] },
    { titre: 'EXERCICE AU 31/12/N-1', sousTitres: ['NET'] },
];
ExportService.GROUPES_BILAN_PROJET = [
    { titre: 'EXERCICE AU 31/12/N', sousTitres: [''] },
    { titre: 'EXERCICE AU 31/12/N-1', sousTitres: [''] },
];
ExportService.GROUPES_NET = [
    { titre: 'EXERCICE AU 31/12/N', sousTitres: ['NET'] },
    { titre: 'EXERCICE AU 31/12/N-1', sousTitres: ['NET'] },
];
ExportService.PARTIES_NOTES_ASSOCIATIONS = [
    ['Partie 1 : Informations générales', ['1', '2', '3', '4']],
    [
        'Partie 2 : Notes sur le bilan',
        ['5A', '5B', '5C', '5D', '5E', '5F', '5G', '5H', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17A', '17B', '18A', '18B', '19', '20', '21', '22'],
    ],
    ['Partie 3 : Notes sur le compte de résultat', ['23', '24', '25', '26', '27', '28', '29A', '29B', '30', '31', '32']],
    ['Partie 4 : Autres informations', ['33', '34', '35']],
];
ExportService.PARTIES_NOTES_PROJETS = [
    ['Partie 1 : Informations générales', ['1']],
    [
        "Partie 2 : Notes sur le tableau emplois-ressources, le tableau d'exécution budgétaire et la réconciliation de trésorerie",
        ['2'],
    ],
    ['Partie 3 : Notes sur le bilan', ['3A', '3B', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']],
    [
        "Partie 4 : Notes sur le compte d'exploitation",
        ['14', '15', '16', '17', '18', '19', '20A', '20B', '21', '22', '23', '24'],
    ],
];
ExportService.GROUPES_ACTIF_SYSCOHADA = [
    { titre: 'EXERCICE AU 31/12/N', sousTitres: ['BRUT', 'AMORT. et DEPREC.', 'NET'] },
    { titre: 'EXERCICE AU 31/12/N-1', sousTitres: ['NET'] },
];
ExportService.GROUPES_NET_SYSCOHADA = [
    { titre: 'EXERCICE AU 31/12/N', sousTitres: ['NET'] },
    { titre: 'EXERCICE AU 31/12/N-1', sousTitres: ['NET'] },
];
ExportService.PIED_FICHE_R4_SYSCOHADA = '(1) Les Notes non documentées ne doivent pas être jointes aux états financiers. Leur contenu peut être amélioré par les entités.';
ExportService.PARTIES_NOTES_SYSCOHADA = [
    ['Liste officielle des Notes annexes · AUDCIF Titre IX ch. 6 section 2 (NOTE 1 à NOTE 36)', [...correspondance_compte_resultat_syscohada_1.CODES_NOTES_CH6]],
];
exports.ExportService = ExportService = ExportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_2.EcritureService,
        etats_financiers_service_1.EtatsFinanciersService,
        etats_financiers_projet_service_1.EtatsFinanciersProjetService,
        etats_financiers_smt_service_1.EtatsFinanciersSmtService,
        etats_financiers_projet_budget_service_1.EtatsFinanciersProjetBudgetService,
        note_annexe_service_1.NoteAnnexeService,
        donation_service_1.DonationService,
        livre_inventaire_service_1.LivreInventaireService,
        rapport_activite_service_1.RapportActiviteService,
        etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService,
        etats_financiers_smt_syscohada_service_1.EtatsFinanciersSmtSyscohadaService,
        immobilisation_service_1.ImmobilisationService,
        test_ecritures_journal_service_1.TestEcrituresJournalService])
], ExportService);
function colonnesVentilationParSens(journal) {
    return [
        ...journal.colonnesRecettes.map((c) => ({ ...c, sens: 'RECETTE' })),
        ...journal.colonnesDepenses.map((c) => ({ ...c, sens: 'DEPENSE' })),
    ];
}
function ventilationDeLaColonne(operation, colonne) {
    return colonne.sens === operation.sens ? (operation.ventilation[colonne.cle] ?? 0) : 0;
}
function bandeauVentilation(ws, r, nbRecettes, nbDepenses) {
    if (nbRecettes > 0) {
        ws.getCell(r, 6).value = 'Ventilation recettes';
        (0, theme_etafi_2.fusion)(ws, r, 6, r, 5 + nbRecettes);
    }
    if (nbDepenses > 0) {
        ws.getCell(r, 6 + nbRecettes).value = 'Ventilation dépenses';
        (0, theme_etafi_2.fusion)(ws, r, 6 + nbRecettes, r, 5 + nbRecettes + nbDepenses);
    }
}
function styliserEntete(ligne) {
    ligne.font = ENTETE_FONT;
    ligne.fill = ENTETE_FILL;
}
function enMots(cle) {
    const espace = cle.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
    return espace.charAt(0).toUpperCase() + espace.slice(1).toLowerCase();
}
function formaterQuantiteEtPrix(ws, r) {
    const quantite = ws.getCell(r, 3);
    quantite.numFmt = '#,##0.###';
    quantite.alignment = { horizontal: 'right', vertical: 'middle' };
    const prix = ws.getCell(r, 4);
    prix.numFmt = '#,##0.00';
    prix.alignment = { horizontal: 'right', vertical: 'middle' };
}
//# sourceMappingURL=export.service.js.map