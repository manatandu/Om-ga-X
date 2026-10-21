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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ExerciceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCORD_OUVERTURE_NON_RESSAISIE = exports.ExerciceService = void 0;
exports.libellesResultat = libellesResultat;
exports.exerciceSuivantApres = exerciceSuivantApres;
exports.refuserSuivantCivilApresDissolution = refuserSuivantCivilApresDissolution;
exports.refuserSiPeriodeClose = refuserSiPeriodeClose;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const impressions_journal_1 = require("../journaux/impressions-journal");
const ecarts_non_constates_1 = require("../reglements/ecarts-non-constates");
const exercice_contigu_1 = require("./exercice-contigu");
const lignes_reportees_au_detail_1 = require("./lignes-reportees-au-detail");
const depreciations_orphelines_1 = require("../creances-douteuses/depreciations-orphelines");
const creances_douteuses_1 = require("../creances-douteuses/creances-douteuses");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const lecteurs_bilan_1 = require("../../common/lecteurs-bilan");
const virement_resultat_non_affecte_1 = require("./virement-resultat-non-affecte");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const date_effacable_1 = require("../tenant/date-effacable");
const portefeuille_etat_1 = require("./portefeuille-etat");
const mentions_societe_1 = require("../tenant/mentions-societe");
const liquidation_societe_1 = require("./liquidation-societe");
const duree_mandat_1 = require("../mandat-auditeur/duree-mandat");
const arret_dissolution_1 = require("./arret-dissolution");
const lignes_en_negatif_1 = require("../comptabilite/lignes-en-negatif");
const lignes_tenues_1 = require("../comptabilite/lignes-tenues");
const references_1 = require("../../common/suppression/references");
const journal_service_1 = require("../journaux/journal.service");
const prisma_retry_util_1 = require("../../common/prisma-retry.util");
const planning_cloture_1 = require("./planning-cloture");
const REMPLACEE_PAR_LES_COTISATIONS = Symbol('cotisations spéciales');
const centralisation_brouillard_1 = require("../comptabilite/centralisation-brouillard");
const exercice_budgetaire_clos_1 = require("../analytique/exercice-budgetaire-clos");
const echeance_1 = require("../../common/echeance");
const jour_ouvrable_1 = require("../retenues/jour-ouvrable");
const report_periode_close_1 = require("./report-periode-close");
const report_a_nouveau_1 = require("./report-a-nouveau");
const ligne_lettree_1 = require("../lettrage/ligne-lettree");
const reconduction_lettrage_1 = require("../lettrage/reconduction-lettrage");
const crypto_1 = require("crypto");
const gel_cloture_1 = require("./gel-cloture");
const lettrage_service_1 = require("../lettrage/lettrage.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const libelle_exercice_1 = require("../../common/libelle-exercice");
const forme_applicable_1 = require("../tenant/forme-applicable");
const ouverture_passee_1 = require("./ouverture-passee");
const AIDE_REPORT_ART_22 = "Pour une opération de cette période arrivée après la clôture, l'AUDCIF (art. 22, 4°) veut qu'elle soit " +
    "enregistrée au premier jour de la période non encore clôturée, sa date de valeur étant mentionnée " +
    'distinctement · demandez le report au premier jour ouvert.';
const EPSILON = 0.005;
const auCentime = (x) => Math.round(x * 100) / 100;
function validationParLaCloture(userId) {
    return { statut: client_1.StatutEcriture.VALIDEE, valideeAt: new Date(), valideeBy: userId };
}
function periodeLisible(e) {
    const d = e.dateDebut.toISOString().slice(0, 10);
    const f = e.dateFin.toISOString().slice(0, 10);
    if (d.slice(5) === '01-01' && f.slice(5) === '12-31' && d.slice(0, 4) === f.slice(0, 4))
        return d.slice(0, 4);
    const fr = (x) => `${x.slice(8, 10)}/${x.slice(5, 7)}/${x.slice(0, 4)}`;
    return `du ${fr(d)} au ${fr(f)}`;
}
function libellesResultat(referentiel) {
    return referentiel === client_1.Referentiel.SYSCOHADA
        ? {
            excedent: 'Résultat net : bénéfice (131)',
            deficit: 'Résultat net : perte (139)',
            ligneExcedent: "Bénéfice net de l'exercice",
            ligneDeficit: "Perte nette de l'exercice",
            plan: 'SYSCOHADA',
        }
        : {
            excedent: "Excédent de l'exercice (131)",
            deficit: "Déficit de l'exercice (139)",
            ligneExcedent: "Excédent de l'exercice",
            ligneDeficit: "Déficit de l'exercice",
            plan: 'SYCEBNL',
        };
}
function exerciceSuivantApres(dateFinClos) {
    const dateDebut = new Date(dateFinClos);
    dateDebut.setUTCDate(dateDebut.getUTCDate() + 1);
    const dateFin = new Date(Date.UTC(dateDebut.getUTCFullYear(), 11, 31));
    return { dateDebut, dateFin };
}
function refuserSuivantCivilApresDissolution(exercice, dossier) {
    const d = dossier.dateDissolution ?? null;
    if (!d || exercice.dateFin.getTime() !== d.getTime())
        return;
    if (dossier.associeUniquePersonneMorale === true && dossier.regimeLiquidation !== 'PROCEDURE_COLLECTIVE')
        return;
    throw new common_1.BadRequestException(`Cet exercice s'arrête à la dissolution du ${(0, portefeuille_etat_1.jourFr)(d)} · l'exercice suivant est l'exercice de liquidation, du ` +
        `${(0, portefeuille_etat_1.jourFr)((0, liquidation_societe_1.lendemainDe)(d))} à la clôture de la liquidation (AUDCIF art. 7 al. 4). Créez-le d'abord dans la ` +
        'fenêtre Exercices (« Exercice de liquidation ») · il reçoit le report à-nouveau.');
}
let ExerciceService = ExerciceService_1 = class ExerciceService {
    async virementDuResultatNonAffecte(client, tenantId, comptes, dossier) {
        const entiteIndividuelle = dossier.formeJuridiqueSyscohada === client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE ||
            dossier.formeJuridiqueSyscohada === client_1.FormeJuridiqueSyscohada.ENTREPRENANT;
        const destination = (0, virement_resultat_non_affecte_1.destinationsDuVirement)(dossier.referentiel, entiteIndividuelle);
        const numeros = [...new Set([destination.credit, destination.debit])];
        const plan = await client.compte.findMany({
            where: { tenantId, numero: { in: numeros } },
            select: { id: true, numero: true },
            orderBy: { numero: 'asc' },
        });
        try {
            return (0, virement_resultat_non_affecte_1.virementResultatNonAffecte)(comptes, destination, (n) => plan.find((c) => c.numero === n)?.id);
        }
        catch (e) {
            throw new common_1.BadRequestException(e.message);
        }
    }
    constructor(prisma, journalService, moduleRef) {
        this.prisma = prisma;
        this.journalService = journalService;
        this.moduleRef = moduleRef;
        this.journal = new common_1.Logger(ExerciceService_1.name);
    }
    async refuserBilanDesequilibre(tenantId, exerciceId, dossier, periode) {
        if (!this.moduleRef)
            return;
        const jeton = dossier.referentiel === client_1.Referentiel.SYSCOHADA
            ? dossier.systemeComptableSyscohada === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE
                ? lecteurs_bilan_1.LECTEUR_BILAN_SYSCOHADA_SMT
                : lecteurs_bilan_1.LECTEUR_BILAN_SYSCOHADA_NORMAL
            : dossier.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT
                ? lecteurs_bilan_1.LECTEUR_BILAN_SYCEBNL_PROJETS
                : dossier.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE
                    ? lecteurs_bilan_1.LECTEUR_BILAN_SYCEBNL_SMT
                    : lecteurs_bilan_1.LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS;
        let lecteur;
        try {
            lecteur = this.moduleRef.get(jeton, { strict: false });
        }
        catch (e) {
            this.journal.warn(`Contrôle d'équilibre du bilan non joué à la clôture · ${jeton} introuvable (${e.message})`);
            return;
        }
        const [bilan, treize] = await Promise.all([
            lecteur.bilan(tenantId, exerciceId),
            this.prisma.ligneEcriture.aggregate({
                where: {
                    compte: { tenantId, numero: { startsWith: '13' } },
                    ecriture: { tenantId, exerciceId, statut: client_1.StatutEcriture.VALIDEE, estSoldeDesComptesDeGestion: false },
                },
                _sum: { debit: true, credit: true },
            }),
        ]);
        const resultat13 = Number(treize._sum.credit ?? 0) - Number(treize._sum.debit ?? 0);
        const ecart = (0, virement_resultat_non_affecte_1.ecartInexpliqueDuBilan)(bilan, resultat13);
        if (ecart === null || Math.abs(ecart) <= EPSILON)
            return;
        let solde585 = 0;
        if (dossier.referentiel === client_1.Referentiel.SYCEBNL) {
            const virements = await this.prisma.ligneEcriture.aggregate({
                where: {
                    compte: { tenantId, numero: { startsWith: '585' }, virementFonds: { is: null } },
                    ecriture: { tenantId, exerciceId, statut: client_1.StatutEcriture.VALIDEE, estSoldeDesComptesDeGestion: false },
                },
                _sum: { debit: true, credit: true },
            });
            solde585 = Number(virements._sum.debit ?? 0) - Number(virements._sum.credit ?? 0);
        }
        const enGroupe = !!dossier.dossierMereId || dossier._count.cellules > 0;
        const smt = dossier.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE;
        if (enGroupe && !smt && Math.abs(solde585) > EPSILON && Math.abs(ecart + solde585) <= EPSILON) {
            let lecteurGroupe;
            try {
                lecteurGroupe = this.moduleRef.get(lecteurs_bilan_1.LECTEUR_VIREMENTS_GROUPE, { strict: false });
            }
            catch (e) {
                throw new common_1.BadRequestException(`Le 585 du groupe n'a pas pu être lu (${e.message}) · la clôture qui l'admettrait est refusée.`);
            }
            const groupe = await lecteurGroupe.virements585DuGroupe(tenantId, periode.dateFin);
            if (Math.abs(groupe.solde) <= EPSILON)
                return;
            throw new common_1.BadRequestException(`Le 585 (virements de fonds) du groupe n'est pas soldé au ${periode.dateFin.toLocaleDateString('fr-FR', { timeZone: 'UTC' })} · écart de ` +
                `${(0, virement_resultat_non_affecte_1.montantFr)(Math.abs(groupe.solde))} ${groupe.solde > 0 ? 'au débit' : 'au crédit'}, écritures validées de tous les ` +
                "dossiers du groupe. Un transfert est passé d'un seul côté, sa contrepartie n'est pas encore validée, ou un dossier a " +
                "quitté le groupe en gardant un virement · passez et validez la contrepartie, ou reclassez le solde, puis clôturez " +
                "(fiche du compte 58, « soldés à la fin de l'exercice »).");
        }
        const part585 = Math.abs(solde585) > EPSILON
            ? ` Le 585 (virements de fonds) porte un solde ${solde585 > 0 ? 'débiteur' : 'créditeur'} de ` +
                `${(0, virement_resultat_non_affecte_1.montantFr)(Math.abs(solde585))}, que le bilan ne lit pas · un virement interne se solde à la fin de ` +
                "l'exercice (fiche du compte 58)" +
                (enGroupe && !smt ? ", et seul un écart égal à ce solde est admis dans un dossier du groupe." : '.')
            : '';
        throw new common_1.BadRequestException(`Le bilan de l'exercice ne s'équilibre pas · actif ${(0, virement_resultat_non_affecte_1.montantFr)(Number(bilan.totalActif))}, passif ` +
            `${(0, virement_resultat_non_affecte_1.montantFr)(Number(bilan.totalPassif))}, écart de ${(0, virement_resultat_non_affecte_1.montantFr)(Math.abs(ecart))} que le report à nouveau ` +
            "du résultat non affecté n'explique pas. Un compte n'est rattaché à aucun poste, ou un poste est mal lu · voyez les " +
            '« comptes non rattachés » du bilan, corrigez, puis clôturez (AUDCIF art. 34 ; SYCEBNL art. 16, 4)).' +
            part585);
    }
    async creerExerciceCourant(tenantId, client = this.prisma) {
        const annee = new Date().getFullYear();
        return client.exercice.create({
            data: {
                tenantId,
                dateDebut: new Date(Date.UTC(annee, 0, 1)),
                dateFin: new Date(Date.UTC(annee, 11, 31)),
            },
        });
    }
    async lister(tenantId) {
        return this.prisma.exercice.findMany({ where: { tenantId }, orderBy: { dateDebut: 'desc' } });
    }
    async creer(tenantId, dto, client = this.prisma) {
        const dateDebut = new Date(dto.dateDebut);
        const dateFin = new Date(dto.dateFin);
        if (dateFin <= dateDebut) {
            throw new common_1.BadRequestException("La date de fin doit être postérieure à la date de début");
        }
        await this.validerArticle7(tenantId, dateDebut, dateFin, dto.liquidation === true, client);
        return client.exercice.create({ data: { tenantId, dateDebut, dateFin } });
    }
    async validerArticle7(tenantId, dateDebut, dateFin, liquidation, client) {
        if (liquidation) {
            const tenant = await client.tenant.findUnique({
                where: { id: tenantId },
                select: { referentiel: true, formeJuridiqueSyscohada: true, dateDissolution: true },
            });
            const dissolution = tenant?.dateDissolution ?? null;
            if (dissolution) {
                const lendemain = (0, liquidation_societe_1.lendemainDe)(dissolution);
                if (dateDebut.getTime() !== lendemain.getTime()) {
                    throw new common_1.BadRequestException(`L'exercice de liquidation court du lendemain de la dissolution, le ${(0, portefeuille_etat_1.jourFr)(lendemain)}, à la clôture ` +
                        'de la liquidation · la durée des opérations de liquidation est comptée pour un seul exercice (AUDCIF ' +
                        'art. 7 al. 4).');
                }
                const chevauche = await client.exercice.findFirst({
                    where: { tenantId, dateDebut: { lte: dateFin }, dateFin: { gte: dateDebut } },
                    orderBy: { dateDebut: 'asc' },
                    select: { dateDebut: true, dateFin: true },
                });
                if (chevauche) {
                    const contientDissolution = chevauche.dateDebut.getTime() <= dissolution.getTime() && chevauche.dateFin.getTime() >= dissolution.getTime();
                    throw new common_1.BadRequestException(contientDissolution
                        ? `L'exercice du ${(0, portefeuille_etat_1.jourFr)(chevauche.dateDebut)} au ${(0, portefeuille_etat_1.jourFr)(chevauche.dateFin)} couvre encore la période ` +
                            `qui suit la dissolution du ${(0, portefeuille_etat_1.jourFr)(dissolution)} · arrêtez-le d'abord à cette date (fenêtre ` +
                            'Exercices), puis créez l’exercice de liquidation.'
                        : `L'exercice du ${(0, portefeuille_etat_1.jourFr)(chevauche.dateDebut)} au ${(0, portefeuille_etat_1.jourFr)(chevauche.dateFin)} couvre déjà une partie ` +
                            'de cette période · une période n’est couverte que par un seul exercice, et la liquidation n’en ' +
                            'forme qu’un (AUDCIF art. 7 al. 4).');
                }
                return;
            }
            const forme = tenant?.formeJuridiqueSyscohada ?? null;
            if (tenant?.referentiel === client_1.Referentiel.SYSCOHADA &&
                forme !== null &&
                (mentions_societe_1.FORMES_SOCIETES_COMMERCIALES.includes(forme) || forme === client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE)) {
                throw new common_1.BadRequestException('Déclarez d’abord la date de dissolution dans Paramètres du dossier · l’exercice de liquidation court du ' +
                    'lendemain de la dissolution à la clôture de la liquidation (AUDCIF art. 7 al. 4).');
            }
            const closDejaCouvert = await client.exercice.findFirst({
                where: {
                    tenantId,
                    statut: client_1.StatutExercice.CLOTURE,
                    dateDebut: { lte: dateFin },
                    dateFin: { gte: dateDebut },
                },
                select: { dateDebut: true, dateFin: true },
            });
            if (closDejaCouvert) {
                throw new common_1.BadRequestException(`Un exercice CLÔTURÉ couvre déjà cette période (${closDejaCouvert.dateDebut.toISOString().slice(0, 10)} ` +
                    `au ${closDejaCouvert.dateFin.toISOString().slice(0, 10)}) · un exercice de liquidation échappe à la ` +
                    "règle du 31 décembre (AUDCIF art. 7 al. 4), jamais à l'unicité de la période. Faites-le commencer " +
                    "après la clôture du dernier exercice arrêté.");
            }
            return;
        }
        const dossierDissous = await client.tenant.findUnique({
            where: { id: tenantId },
            select: { referentiel: true, formeJuridiqueSyscohada: true, dateDissolution: true },
        });
        if (dossierDissous?.referentiel === client_1.Referentiel.SYSCOHADA &&
            dossierDissous.dateDissolution &&
            (0, liquidation_societe_1.formeEnLiquidation)(dossierDissous.formeJuridiqueSyscohada) &&
            dateDebut.getTime() > dossierDissous.dateDissolution.getTime()) {
            throw new common_1.BadRequestException(`La société est dissoute le ${(0, portefeuille_etat_1.jourFr)(dossierDissous.dateDissolution)} · la liquidation forme un seul exercice, du ` +
                `${(0, portefeuille_etat_1.jourFr)((0, liquidation_societe_1.lendemainDe)(dossierDissous.dateDissolution))} à sa clôture (AUDCIF art. 7 al. 4), et aucun exercice ` +
                'civil ne s’ouvre après. Créez l’exercice de liquidation (case « Exercice de liquidation »), ou reportez sa fin.');
        }
        const finLe31Decembre = dateFin.getUTCMonth() === 11 && dateFin.getUTCDate() === 31;
        if (!finLe31Decembre) {
            throw new common_1.BadRequestException("L'exercice coïncide avec l'année civile (AUDCIF art. 7, repris au glossaire SYCEBNL) : il se " +
                'termine un 31 décembre. Seul un exercice de liquidation y échappe, et il doit être déclaré ' +
                'comme tel.');
        }
        const premier = (await client.exercice.count({ where: { tenantId } })) === 0;
        const debutLe1erJanvier = dateDebut.getUTCMonth() === 0 && dateDebut.getUTCDate() === 1;
        const anneeDejaOuverte = await client.exercice.findFirst({
            where: {
                tenantId,
                dateDebut: { lte: dateFin },
                dateFin: { gte: dateDebut },
            },
            select: { dateDebut: true, dateFin: true },
        });
        if (anneeDejaOuverte) {
            throw new common_1.BadRequestException(`Un exercice couvre déjà cette période (${anneeDejaOuverte.dateDebut.toISOString().slice(0, 10)} au ` +
                `${anneeDejaOuverte.dateFin.toISOString().slice(0, 10)}) · une période n'est couverte que par un seul ` +
                'exercice, sans quoi les écritures se répartiraient entre deux liasses qui bouclent chacune de son côté.');
        }
        if (!premier) {
            const [precedent, suivant] = await Promise.all([
                client.exercice.findFirst({
                    where: { tenantId, dateFin: { lt: dateDebut } },
                    orderBy: { dateFin: 'desc' },
                    select: { dateFin: true },
                }),
                client.exercice.findFirst({
                    where: { tenantId, dateDebut: { gt: dateFin } },
                    orderBy: { dateDebut: 'asc' },
                    select: { dateDebut: true },
                }),
            ]);
            const motifTrou = (0, exercice_contigu_1.motifCreationNonContigue)(dateDebut, dateFin, precedent, suivant);
            if (motifTrou)
                throw new common_1.BadRequestException(motifTrou);
        }
        if (!premier) {
            if (!debutLe1erJanvier || dateDebut.getUTCFullYear() !== dateFin.getUTCFullYear()) {
                throw new common_1.BadRequestException("Seul le PREMIER exercice d'un dossier peut s'écarter de l'année civile (AUDCIF art. 7). " +
                    'Celui-ci doit courir du 1er janvier au 31 décembre de la même année.');
            }
            return;
        }
        const premierSemestre = dateDebut.getUTCMonth() <= 5;
        const anneesEcart = dateFin.getUTCFullYear() - dateDebut.getUTCFullYear();
        if (premierSemestre && anneesEcart !== 0) {
            throw new common_1.BadRequestException("Un premier exercice débutant au cours du premier semestre est exceptionnellement INFÉRIEUR à " +
                'douze mois (AUDCIF art. 7) : il se termine le 31 décembre de la même année.');
        }
        if (!premierSemestre && anneesEcart > 1) {
            throw new common_1.BadRequestException("Un premier exercice débutant au cours du deuxième semestre se termine le 31 décembre de la " +
                "même année ou de la suivante (AUDCIF art. 7) : sa durée peut dépasser douze mois, pas vingt-quatre.");
        }
    }
    async planningCloture(tenantId, exerciceId) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
        const formeDeLExercice = (0, forme_applicable_1.formeApplicable)(tenant, exercice.dateFin);
        const [enBrouillard, transcriptions, rapports, donations] = await Promise.all([
            this.prisma.ecriture.count({
                where: { tenantId, exerciceId, statut: client_1.StatutEcriture.BROUILLARD, ...(0, centralisation_brouillard_1.filtreBrouillardAValider)(exercice.statut) },
            }),
            this.prisma.transcriptionInventaire.count({ where: { tenantId, exerciceId } }),
            this.prisma.rapportActivite.count({ where: { tenantId, exerciceId } }),
            this.prisma.donation.findMany({
                where: {
                    tenantId,
                    annulee: false,
                    dateOperation: { gte: exercice.dateDebut, lte: exercice.dateFin },
                },
                select: { signeeLe: true },
            }),
        ]);
        const donationsNonSignees = donations.filter((d) => d.signeeLe === null).length;
        const observations = {
            BROUILLARD: {
                libelle: enBrouillard === 0
                    ? 'Aucune écriture au brouillard'
                    : `${enBrouillard} écriture(s) encore au brouillard, à valider avant la balance`,
                satisfait: enBrouillard === 0,
            },
            INVENTAIRE: {
                libelle: transcriptions === 0
                    ? 'Aucune transcription au livre d’inventaire'
                    : `${transcriptions} transcription(s) au livre d’inventaire`,
                satisfait: transcriptions > 0,
            },
            RAPPORT_ACTIVITE: {
                libelle: rapports === 0 ? 'Aucun rapport d’activité établi' : `${rapports} version(s) du rapport d’activité`,
                satisfait: rapports > 0,
            },
            DONATEURS: {
                libelle: donations.length === 0
                    ? 'Aucune libéralité enregistrée sur l’exercice'
                    : donationsNonSignees === 0
                        ? `${donations.length} libéralité(s), toutes signées`
                        : `${donations.length} libéralité(s) dont ${donationsNonSignees} non signée(s)`,
                satisfait: donationsNonSignees === 0,
            },
            CLOTURE_ANNUELLE: {
                libelle: exercice.statut === client_1.StatutExercice.CLOTURE ? 'Exercice clôturé' : 'Exercice encore ouvert',
                satisfait: exercice.statut === client_1.StatutExercice.CLOTURE,
            },
        };
        const aujourdHui = (0, echeance_1.jourDeKinshasa)(new Date());
        const societe = tenant.referentiel === client_1.Referentiel.SYSCOHADA &&
            formeDeLExercice !== null &&
            mentions_societe_1.FORMES_SOCIETES_COMMERCIALES.includes(formeDeLExercice);
        const portefeuille = societe ? tenant.entreprisePortefeuilleEtat : null;
        const affectation = portefeuille === true
            ? await this.prisma.affectationResultat.findFirst({
                where: { tenantId, exerciceId },
                select: { dateDecision: true },
            })
            : null;
        let commissaireDesigne = null;
        if (portefeuille === true) {
            const mandats = await this.prisma.mandatAuditeur.findMany({
                where: { tenantId },
                orderBy: { premierExercice: 'desc' },
                select: { premierExercice: true, nombreExercices: true, refusDeProrogation: true, finAnticipeeLe: true },
            });
            if ((0, duree_mandat_1.commissaireCouvreLExercice)(mandats, exercice.dateFin.getUTCFullYear(), tenant.referentiel, formeDeLExercice, exercice.dateFin)) {
                commissaireDesigne = true;
            }
        }
        const secteurMinier = portefeuille === true ? (tenant.portefeuilleSecteurMinier ?? null) : null;
        const quotePartEtat = tenant.quotePartEtatCapital === null || tenant.quotePartEtatCapital === undefined
            ? null
            : Number(tenant.quotePartEtatCapital);
        let resultatNet = null;
        let capitauxPropres = null;
        if (secteurMinier === true) {
            const livreJournal = { tenantId, exerciceId, statut: client_1.StatutEcriture.VALIDEE, estSoldeDesComptesDeGestion: false };
            const solde = async (compte) => {
                const s = await this.prisma.ligneEcriture.aggregate({
                    where: { compte: { tenantId, ...compte }, ecriture: livreJournal },
                    _sum: { debit: true, credit: true },
                });
                return Math.round((Number(s._sum.credit ?? 0) - Number(s._sum.debit ?? 0)) * 100) / 100;
            };
            const parRacines = (racines) => ({
                OR: racines.map((r) => ({ numero: { startsWith: r } })),
            });
            const [resultat, capital, reportANouveau, autres] = await Promise.all([
                solde({ classe: { in: [client_1.ClasseCompte.CLASSE_6, client_1.ClasseCompte.CLASSE_7, client_1.ClasseCompte.CLASSE_8] } }),
                solde(parRacines(['101', '102', '103', '104'])),
                solde(parRacines(['12'])),
                solde(parRacines(['10', '11', '12', '13', '14', '15'])),
            ]);
            resultatNet = resultat;
            capitauxPropres = { capital, reportANouveau, capitauxPropres: Math.round((autres + resultat) * 100) / 100 };
        }
        const faitsLiquidation = {
            forme: formeDeLExercice,
            dateDissolution: tenant.dateDissolution,
            dateNominationLiquidateur: tenant.dateNominationLiquidateur,
            regimeLiquidation: tenant.regimeLiquidation,
            associeUniquePersonneMorale: tenant.associeUniquePersonneMorale,
            dateClotureLiquidation: tenant.dateClotureLiquidation,
            dateDeclarationCotisationActivite: tenant.dateDeclarationCotisationActivite,
            dateDeclarationCotisationLiquidation: tenant.dateDeclarationCotisationLiquidation,
        };
        const liquidation = (0, liquidation_societe_1.jalonsLiquidation)(faitsLiquidation, exercice, aujourdHui);
        const exercicesDuDossier = tenant.dateDissolution
            ? await this.prisma.exercice.findMany({
                where: { tenantId },
                select: { id: true, dateDebut: true, dateFin: true, statut: true },
            })
            : [];
        const cotisations = (0, liquidation_societe_1.cotisationsSpeciales)(faitsLiquidation, { dateDebut: exercice.dateDebut, dateFin: exercice.dateFin, clos: exercice.statut === client_1.StatutExercice.CLOTURE }, aujourdHui, tenant.dateDissolution
            ? { porteurSeconde: (0, liquidation_societe_1.exercicePorteurSecondeCotisation)(exercicesDuDossier, faitsLiquidation) === exercice.id }
            : {});
        const impotAnnuelCede = (0, liquidation_societe_1.impotAnnuelCedeAuxCotisations)(faitsLiquidation, exercice);
        const avecCotisations = (definitions) => {
            if (!impotAnnuelCede && cotisations.length === 0)
                return definitions;
            const index = definitions.findIndex((d) => d.declarationAnnuelleImpotSocietes);
            if (index >= 0)
                return definitions.map((d, i) => (i === index ? REMPLACEE_PAR_LES_COTISATIONS : d));
            const apres = definitions.findIndex((d) => d.etape > 15);
            return apres < 0
                ? [...definitions, REMPLACEE_PAR_LES_COTISATIONS]
                : [...definitions.slice(0, apres), REMPLACEE_PAR_LES_COTISATIONS, ...definitions.slice(apres)];
        };
        let gestesDissolution = null;
        if (tenant.dateDissolution) {
            const d = tenant.dateDissolution;
            const ouvert = exercice.statut === client_1.StatutExercice.OUVERT;
            const contient = exercice.dateDebut.getTime() <= d.getTime() && d.getTime() < exercice.dateFin.getTime();
            const lu = contient
                ? (await lireEtatAvantArret(this.prisma, tenantId, exercice, { ...tenant, formeJuridiqueSyscohada: formeDeLExercice })).etat
                : null;
            const motifArret = lu ? (0, arret_dissolution_1.motifRefusArret)({ ...lu, actesDeLaPeriode: lu.actesDeLaPeriode.filter((a) => !a.retirable) }) : null;
            const actesDeLaPeriodeARetirer = lu ? lu.actesDeLaPeriode.filter((a) => a.retirable).map((a) => `${a.libelle} (${a.piece})`) : [];
            const avecLiquidation = (0, liquidation_societe_1.formeEnLiquidation)(formeDeLExercice) &&
                !(0, liquidation_societe_1.sansLiquidation)({ forme: formeDeLExercice, regimeLiquidation: tenant.regimeLiquidation, associeUniquePersonneMorale: tenant.associeUniquePersonneMorale });
            const lendemain = (0, liquidation_societe_1.lendemainDe)(d);
            gestesDissolution = {
                date: d,
                arretPropose: contient && ouvert && motifArret === null,
                motifArret: contient && ouvert ? motifArret : null,
                annulationProposee: ouvert && exercice.dateFin.getTime() === d.getTime() && !(d.getUTCMonth() === 11 && d.getUTCDate() === 31),
                rattachementPropose: avecLiquidation &&
                    ouvert &&
                    exercice.dateDebut.getTime() > lendemain.getTime() &&
                    !exercicesDuDossier.some((e) => e.id !== exercice.id && (e.dateFin.getTime() >= lendemain.getTime() || e.statut === client_1.StatutExercice.OUVERT)),
                exerciceDeLiquidation: (0, liquidation_societe_1.estExerciceDeLiquidation)(exercice, d),
                dateClotureLiquidation: tenant.dateClotureLiquidation,
                actesDeLaPeriodeARetirer,
            };
        }
        const avecPortefeuille = (jalons) => [
            ...(portefeuille === true
                ? (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(jalons, {
                    dateFin: exercice.dateFin,
                    forme: formeDeLExercice,
                    commissaireDesigne,
                    exerciceClos: exercice.statut === client_1.StatutExercice.CLOTURE,
                    dateArreteComptes: exercice.dateArreteComptes,
                    dateAssembleeGenerale: exercice.dateAssembleeGenerale,
                    dateDepotEtatsPortefeuille: exercice.dateDepotEtatsPortefeuille,
                    dateTransmissionPvPortefeuille: exercice.dateTransmissionPvPortefeuille,
                    dateDecisionAffectation: affectation?.dateDecision ?? null,
                    secteurMinier,
                    quotePartEtat,
                    sourceQuotePartEtat: tenant.sourceQuotePartEtat,
                    resultatNet,
                    dateDeclarationDividendeEtat: exercice.dateDeclarationDividendeEtat,
                    dateNotePerceptionDividende: exercice.dateNotePerceptionDividende,
                    datePaiementDividendeEtat: exercice.datePaiementDividendeEtat,
                    dateDissolution: tenant.dateDissolution,
                    capitauxPropres,
                }, aujourdHui)
                : societe && portefeuille === null
                    ? (0, portefeuille_etat_1.inviterADeclarerPortefeuille)(jalons)
                    : jalons),
            ...liquidation,
        ];
        return {
            exerciceId: exercice.id,
            dateDebut: exercice.dateDebut,
            dateFin: exercice.dateFin,
            statut: exercice.statut,
            derniereVerification: planning_cloture_1.DERNIERE_VERIFICATION,
            formeJuridique: tenant.formeJuridique,
            formeJuridiqueSyscohada: formeDeLExercice,
            droitEtranger: tenant.droitEtranger,
            entreprisePortefeuilleEtat: portefeuille,
            dateAssembleeGenerale: exercice.dateAssembleeGenerale,
            dateDepotEtatsPortefeuille: exercice.dateDepotEtatsPortefeuille,
            dateTransmissionPvPortefeuille: exercice.dateTransmissionPvPortefeuille,
            portefeuilleSecteurMinier: secteurMinier,
            quotePartEtatCapital: portefeuille === true ? quotePartEtat : null,
            dateDeclarationDividendeEtat: exercice.dateDeclarationDividendeEtat,
            dateNotePerceptionDividende: exercice.dateNotePerceptionDividende,
            datePaiementDividendeEtat: exercice.datePaiementDividendeEtat,
            dissolution: gestesDissolution,
            jalons: avecPortefeuille(avecCotisations((0, planning_cloture_1.jalonsApplicables)({
                referentiel: tenant.referentiel,
                formeJuridique: tenant.formeJuridique,
                formeJuridiqueSyscohada: formeDeLExercice,
                droitEtranger: tenant.droitEtranger,
                associeUnique: tenant.associeUnique,
            })).flatMap((j) => {
                if (j === REMPLACEE_PAR_LES_COTISATIONS)
                    return cotisations;
                const brute = (0, planning_cloture_1.dateJalon)(exercice.dateFin, j.echeance);
                const echeance = j.echeanceFiscale ? (0, jour_ouvrable_1.reporterAuJourOuvrable)(brute) : brute;
                const observation = j.observation ? observations[j.observation] : undefined;
                return [{
                        etape: j.etape,
                        libelle: j.libelle,
                        detail: j.detail,
                        nature: j.nature,
                        source: j.source,
                        sanction: j.sanction ?? null,
                        debut: (0, planning_cloture_1.dateJalon)(exercice.dateFin, j.debut),
                        echeance,
                        enRetard: (0, echeance_1.echeanceDepassee)(echeance, aujourdHui) && !(observation?.satisfait ?? false),
                        observation,
                    }];
            })),
        };
    }
    async arreterComptes(tenantId, exerciceId, dto) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        const date = dto.dateArreteComptes ? new Date(dto.dateArreteComptes) : null;
        if (date && date < exercice.dateFin) {
            throw new common_1.BadRequestException("La date d'arrêté des comptes ne peut pas précéder la clôture de l'exercice : les organes dirigeants " +
                'arrêtent des comptes déjà clos (AUDCIF, Titre VIII ch. 31 § 1.3).');
        }
        return this.prisma.exercice.update({
            where: { id: exerciceId },
            data: { dateArreteComptes: date },
        });
    }
    async declarerFicheR2(tenantId, exerciceId, dto) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { systemeComptableSyscohada: true },
        });
        if (tenant.systemeComptableSyscohada === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE) {
            throw new common_1.BadRequestException('La fiche R2 (cases ZN à ZS) est celle du Système normal · le Système minimal de trésorerie n’en porte ' +
                'pas (AUDCIF, Titre X), et sa liasse ne l’imprime pas.');
        }
        const annee = dto.premiereAnneeExercicePays;
        const anneeDeCloture = exercice.dateFin.getUTCFullYear();
        if (annee !== undefined && annee !== null && annee > anneeDeCloture) {
            throw new common_1.BadRequestException(`La première année d'exercice dans le pays (${annee}) ne peut pas suivre l'année où se clôt ` +
                `l'exercice déclaré (${anneeDeCloture}) · fiche R2, case ZP.`);
        }
        const data = {};
        if (dto.nombreEtablissementsPays !== undefined)
            data.nombreEtablissementsPays = dto.nombreEtablissementsPays;
        if (dto.nombreEtablissementsHorsPays !== undefined) {
            data.nombreEtablissementsHorsPays = dto.nombreEtablissementsHorsPays;
        }
        if (dto.premiereAnneeExercicePays !== undefined)
            data.premiereAnneeExercicePays = dto.premiereAnneeExercicePays;
        if (dto.controleEntreprise !== undefined)
            data.controleEntreprise = dto.controleEntreprise;
        return this.prisma.exercice.update({ where: { id: exercice.id }, data });
    }
    async declarerDatesPortefeuille(tenantId, exerciceId, dto) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        const assemblee = (0, date_effacable_1.jourSaisiOuEffacement)(dto.dateAssembleeGenerale);
        const depot = (0, date_effacable_1.jourSaisiOuEffacement)(dto.dateDepotEtatsPortefeuille);
        const transmission = (0, date_effacable_1.jourSaisiOuEffacement)(dto.dateTransmissionPvPortefeuille);
        const declarationDividende = (0, date_effacable_1.jourSaisiOuEffacement)(dto.dateDeclarationDividendeEtat);
        const notePerception = (0, date_effacable_1.jourSaisiOuEffacement)(dto.dateNotePerceptionDividende);
        const paiementDividende = (0, date_effacable_1.jourSaisiOuEffacement)(dto.datePaiementDividendeEtat);
        if (declarationDividende || notePerception || paiementDividende) {
            const dossier = await this.prisma.tenant.findUniqueOrThrow({
                where: { id: tenantId },
                select: { entreprisePortefeuilleEtat: true, portefeuilleSecteurMinier: true },
            });
            if (dossier.entreprisePortefeuilleEtat !== true || dossier.portefeuilleSecteurMinier !== true) {
                throw new common_1.BadRequestException('Le dividende prioritaire de l’État ne vise que les entreprises du portefeuille du secteur minier ' +
                    '(arrêté interministériel du 10 décembre 2025, art. 3) · déclarez d’abord ces deux faits dans Paramètres du dossier.');
            }
        }
        const aujourdHui = (0, echeance_1.jourDeKinshasa)(new Date());
        for (const [date, quoi] of [
            [depot, 'Le dépôt des états financiers au ministère du Portefeuille'],
            [transmission, 'La communication du procès-verbal à l’Administration des recettes non fiscales'],
            [declarationDividende, 'La déclaration du dividende prioritaire'],
            [notePerception, 'La réception de la note de perception'],
            [paiementDividende, 'Le paiement du dividende prioritaire'],
        ]) {
            if (date && date > aujourdHui) {
                throw new common_1.BadRequestException(`${quoi} à venir ne se déclare pas · déclarez-le une fois intervenu.`);
            }
        }
        for (const [date, quoi] of [
            [assemblee, 'L’assemblée générale ordinaire statue sur les résultats d’un exercice clos'],
            [depot, 'Les états financiers se déposent une fois l’exercice clos'],
            [transmission, 'Le procès-verbal se communique après l’assemblée d’un exercice clos'],
        ]) {
            if (date && date < exercice.dateFin) {
                throw new common_1.BadRequestException(`${quoi} · la date ne peut pas précéder la clôture de l'exercice (O.-L. n° 13/003, art. 112 et 113).`);
            }
        }
        for (const [date, quoi] of [
            [declarationDividende, 'La déclaration du dividende prioritaire'],
            [notePerception, 'La note de perception du dividende prioritaire'],
            [paiementDividende, 'Le paiement du dividende prioritaire'],
        ]) {
            if (date && date < exercice.dateFin) {
                throw new common_1.BadRequestException(`${quoi} porte sur le bénéfice net comptable de l’exercice · la date ne peut pas précéder sa clôture ` +
                    '(arrêté interministériel du 10 décembre 2025, art. 2).');
            }
        }
        const assembleeApres = assemblee === undefined ? exercice.dateAssembleeGenerale : assemblee;
        const transmissionApres = transmission === undefined ? exercice.dateTransmissionPvPortefeuille : transmission;
        if (assembleeApres && transmissionApres && transmissionApres < assembleeApres) {
            throw new common_1.BadRequestException('Le procès-verbal se communique « dans les dix (10) jours qui suivent la tenue » de l’assemblée · sa date ne ' +
                'peut pas précéder celle de l’assemblée (O.-L. n° 13/003, art. 112).');
        }
        const data = {};
        if (assemblee !== undefined)
            data.dateAssembleeGenerale = assemblee;
        if (depot !== undefined)
            data.dateDepotEtatsPortefeuille = depot;
        if (transmission !== undefined)
            data.dateTransmissionPvPortefeuille = transmission;
        const noteApres = notePerception === undefined ? (exercice.dateNotePerceptionDividende ?? null) : notePerception;
        const paiementApres = paiementDividende === undefined ? (exercice.datePaiementDividendeEtat ?? null) : paiementDividende;
        if (noteApres && paiementApres && paiementApres < noteApres) {
            throw new common_1.BadRequestException(`Le paiement du dividende (${(0, portefeuille_etat_1.jourFr)(paiementApres)}) ne peut pas précéder la réception de la note de ` +
                `perception (${(0, portefeuille_etat_1.jourFr)(noteApres)}) · il se fait « dans les huit jours de la réception de la note de ` +
                'perception » (arrêté interministériel du 10 décembre 2025, art. 2).');
        }
        if (declarationDividende !== undefined)
            data.dateDeclarationDividendeEtat = declarationDividende;
        if (notePerception !== undefined)
            data.dateNotePerceptionDividende = notePerception;
        if (paiementDividende !== undefined)
            data.datePaiementDividendeEtat = paiementDividende;
        return this.prisma.exercice.update({ where: { id: exercice.id }, data });
    }
    async arreterALaDissolution(tenantId, exerciceId, options = {}) {
        const dossier = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: {
                dateDissolution: true,
                dateClotureLiquidation: true,
                regimeLiquidation: true,
                associeUniquePersonneMorale: true,
                formeJuridiqueSyscohada: true,
            },
        });
        await this.trouverExercice(tenantId, exerciceId);
        const operations = dossier.dateDissolution
            ? await this.prisma.ecriture.count({ where: { tenantId, exerciceId, date: { gt: dossier.dateDissolution } } })
            : 0;
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const exercice = await tx.exercice.findFirstOrThrow({ where: { id: exerciceId, tenantId } });
            let etat = await lireEtatAvantArret(tx, tenantId, exercice, dossier);
            let actesRetires = [];
            if (options.retirerActesDeLaPeriode && (0, arret_dissolution_1.motifRefusArret)({ ...etat.etat, actesDeLaPeriode: [] }) === null) {
                actesRetires = await this.retirerActesDeLaPeriode(tx, tenantId, options.userId ?? 'arret-dissolution', etat.actes);
                if (actesRetires.length)
                    etat = await lireEtatAvantArret(tx, tenantId, exercice, dossier);
            }
            const motif = (0, arret_dissolution_1.motifRefusArret)(etat.etat);
            if (motif)
                throw new common_1.BadRequestException(motif);
            const dissolution = dossier.dateDissolution;
            const relevesARevoir = await relevesUnitesOeuvre(tx, tenantId, [exercice.id, ...(etat.posterieurs.length === 1 ? [etat.posterieurs[0].id] : [])]);
            if (etat.etat.sansLiquidation) {
                for (const p of etat.posterieurs) {
                    await retirerANouveauProvisoire(tx, tenantId, p.id);
                    await (0, impressions_journal_1.rattacherLesImpressions)(tx, tenantId, p.id, exercice.id);
                    await tx.exercice.delete({ where: { id: p.id } });
                }
                const arrete = await tx.exercice.update({ where: { id: exercice.id }, data: { dateFin: dissolution } });
                return {
                    exercice: arrete,
                    exerciceDeLiquidation: null,
                    exercicesRetires: etat.posterieurs.map((p) => periodeLisible(p)),
                    ecrituresRattachees: 0,
                    actesRattaches: 0,
                    cloturesRattachees: 0,
                    actesRetires,
                    relevesARevoir,
                };
            }
            const lendemain = (0, liquidation_societe_1.lendemainDe)(dissolution);
            let liquidation;
            if (etat.posterieurs.length === 1) {
                const suivant = etat.posterieurs[0];
                const passee = await ouvertureDejaPassee(tx, tenantId, suivant);
                const issueOuverture = issueOuvertureQuiSeDeplace(passee, options.ouvertureAnnuleeNonRessaisie === true);
                if (issueOuverture === 'A_CONFIRMER')
                    throw new common_1.BadRequestException(refusOuvertureAnnuleeHorsDuPremierJour(passee, suivant.dateDebut));
                if (issueOuverture === 'REFUS') {
                    throw new common_1.BadRequestException(`L'exercice du ${(0, portefeuille_etat_1.jourFr)(suivant.dateDebut)} au ${(0, portefeuille_etat_1.jourFr)(suivant.dateFin)} devient l'exercice de liquidation, ` +
                        `et son ouverture passée au ${(0, portefeuille_etat_1.jourFr)(suivant.dateDebut)} (${piecesLisibles(passee.ecritures)}) ne serait plus ` +
                        'celle de son premier jour · au brouillard, supprimez-la ; validée, inscrivez-la en négatif (AUDCIF art. 20, ' +
                        'al. 2). La clôture de l’exercice arrêté reportera ensuite ses soldes au lendemain de la dissolution.');
                }
                await retirerANouveauProvisoire(tx, tenantId, suivant.id);
                liquidation = await tx.exercice.update({ where: { id: suivant.id }, data: { dateDebut: lendemain } });
            }
            else {
                const derniere = etat.aDeplacer.length ? etat.aDeplacer[etat.aDeplacer.length - 1].date : null;
                let fin = dossier.dateClotureLiquidation && dossier.dateClotureLiquidation.getTime() > dissolution.getTime()
                    ? dossier.dateClotureLiquidation
                    : exercice.dateFin;
                if (derniere && derniere.getTime() > fin.getTime())
                    fin = derniere;
                liquidation = await tx.exercice.create({ data: { tenantId, dateDebut: lendemain, dateFin: fin } });
            }
            const arrete = await tx.exercice.update({ where: { id: exercice.id }, data: { dateFin: dissolution } });
            const rattachement = await rattacherALExercice(tx, tenantId, {
                depuis: exercice.id,
                vers: liquidation.id,
                ecritures: etat.aDeplacer,
                clotures: { dateLimite: { gt: dissolution } },
                dates: { gt: dissolution },
            });
            return { exercice: arrete, exerciceDeLiquidation: liquidation, ...rattachement, actesRetires, relevesARevoir };
        }, "Un autre geste a modifié l'exercice pendant l'arrêt · relancez-le.", { operations });
    }
    async annulerArretDissolution(tenantId, exerciceId, options = {}) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        const { dateDissolution: dissolution } = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { dateDissolution: true },
        });
        if (!dissolution || exercice.dateFin.getTime() !== dissolution.getTime()) {
            throw new common_1.BadRequestException('Cet exercice n’est pas arrêté à la date de dissolution déclarée · rien à annuler.');
        }
        const finOrigine = (0, arret_dissolution_1.finDOrigineDeLExerciceArrete)(dissolution);
        if (finOrigine.getTime() === dissolution.getTime()) {
            throw new common_1.BadRequestException('La dissolution tombe un 31 décembre · l’exercice finit à sa date ordinaire, rien à annuler.');
        }
        if (exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException('Cet exercice est clôturé · ses dates ne changent plus.');
        }
        const operations = await this.prisma.ecriture.count({
            where: { tenantId, exercice: { dateDebut: (0, liquidation_societe_1.lendemainDe)(dissolution) }, date: { lte: finOrigine } },
        });
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const liquidation = await tx.exercice.findFirst({ where: { tenantId, dateDebut: (0, liquidation_societe_1.lendemainDe)(dissolution) } });
            const autre = await tx.exercice.findFirst({
                where: {
                    tenantId,
                    id: { notIn: [exercice.id, ...(liquidation ? [liquidation.id] : [])] },
                    dateDebut: { lte: finOrigine },
                    dateFin: { gt: dissolution },
                },
                select: { dateDebut: true, dateFin: true },
            });
            if (autre) {
                throw new common_1.BadRequestException(`L'exercice du ${(0, portefeuille_etat_1.jourFr)(autre.dateDebut)} au ${(0, portefeuille_etat_1.jourFr)(autre.dateFin)} couvre une partie de la période à rendre · ` +
                    'une période n’est couverte que par un seul exercice.');
            }
            const actesRetires = await this.actesDeLaPeriodeLevesOuRefuses(tx, tenantId, [exercice, ...(liquidation ? [liquidation] : [])], options);
            if (!liquidation) {
                const arrete = await tx.exercice.update({ where: { id: exercice.id }, data: { dateFin: finOrigine } });
                return { exercice: arrete, exerciceDeLiquidation: null, ecrituresRattachees: 0, actesRattaches: 0, cloturesRattachees: 0, actesRetires };
            }
            if (liquidation.statut === client_1.StatutExercice.CLOTURE) {
                throw new common_1.BadRequestException('L’exercice de liquidation est clôturé · l’arrêt ne s’annule plus.');
            }
            const auDela = liquidation.dateFin.getTime() > finOrigine.getTime();
            const finCivileSuivante = new Date(Date.UTC(finOrigine.getUTCFullYear() + 1, 11, 31));
            if (auDela && liquidation.dateFin.getTime() !== finCivileSuivante.getTime()) {
                throw new common_1.BadRequestException(`L'exercice de liquidation finit le ${(0, portefeuille_etat_1.jourFr)(liquidation.dateFin)} · rendu à l'année civile, il commencerait le ` +
                    `${(0, portefeuille_etat_1.jourFr)((0, liquidation_societe_1.lendemainDe)(finOrigine))} et devrait finir le ${(0, portefeuille_etat_1.jourFr)(finCivileSuivante)} (AUDCIF art. 7 al. 2). ` +
                    'Portez d’abord sa fin à cette date, puis annulez l’arrêt.');
            }
            const passee = await ouvertureDejaPassee(tx, tenantId, liquidation);
            const issueOuverture = issueOuvertureQuiSeDeplace(passee, options.ouvertureAnnuleeNonRessaisie === true);
            if (issueOuverture === 'A_CONFIRMER')
                throw new common_1.BadRequestException(refusOuvertureAnnuleeHorsDuPremierJour(passee, liquidation.dateDebut));
            if (issueOuverture === 'REFUS') {
                throw new common_1.BadRequestException(`L'ouverture passée au ${(0, portefeuille_etat_1.jourFr)(liquidation.dateDebut)} dans l'exercice de liquidation (${piecesLisibles(passee.ecritures)}) ` +
                    'tomberait au milieu de l’exercice rendu · au brouillard, supprimez-la ; validée, inscrivez-la en négatif ' +
                    '(AUDCIF art. 20, al. 2), puis annulez l’arrêt.');
            }
            await retirerANouveauProvisoire(tx, tenantId, liquidation.id);
            const aRendre = await tx.ecriture.findMany({
                where: { tenantId, exerciceId: liquidation.id, date: { lte: finOrigine } },
                select: { id: true, date: true, numeroPiece: true, journal: { select: { code: true } } },
                orderBy: [{ date: 'asc' }, { id: 'asc' }],
            });
            const arrete = await tx.exercice.update({ where: { id: exercice.id }, data: { dateFin: finOrigine } });
            const rattachement = await rattacherALExercice(tx, tenantId, {
                depuis: liquidation.id,
                vers: exercice.id,
                ecritures: aRendre,
                clotures: { dateLimite: { lte: finOrigine } },
                dates: { lte: finOrigine },
            });
            if (auDela) {
                const suivant = await tx.exercice.update({ where: { id: liquidation.id }, data: { dateDebut: (0, liquidation_societe_1.lendemainDe)(finOrigine) } });
                return { exercice: arrete, exerciceDeLiquidation: null, exerciceSuivant: suivant, ...rattachement, actesRetires };
            }
            await (0, impressions_journal_1.rattacherLesImpressions)(tx, tenantId, liquidation.id, exercice.id);
            const references = await (0, references_1.referencesVers)(tx, 'Exercice', liquidation.id, tenantId);
            if (references.length > 0) {
                throw new common_1.BadRequestException(`L'exercice de liquidation ne porte plus aucune écriture mais reste utilisé (${references.map(references_1.libelleReference).join(', ')}) · ` +
                    'retirez ces éléments, puis annulez l’arrêt.');
            }
            await tx.exercice.delete({ where: { id: liquidation.id } });
            return { exercice: arrete, exerciceDeLiquidation: null, ...rattachement, actesRetires };
        }, "Un autre geste a modifié l'exercice pendant l'annulation de l'arrêt · relancez-la.", { operations });
    }
    async rattacherALaLiquidation(tenantId, exerciceId, options = {}) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        const dossier = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { dateDissolution: true, regimeLiquidation: true, associeUniquePersonneMorale: true, formeJuridiqueSyscohada: true },
        });
        const dissolution = dossier.dateDissolution;
        if (!dissolution || !(0, liquidation_societe_1.formeEnLiquidation)(dossier.formeJuridiqueSyscohada) || (0, liquidation_societe_1.sansLiquidation)({ forme: dossier.formeJuridiqueSyscohada, regimeLiquidation: dossier.regimeLiquidation, associeUniquePersonneMorale: dossier.associeUniquePersonneMorale })) {
            throw new common_1.BadRequestException('Aucune liquidation n’est déclarée · déclarez la dissolution d’une société ou d’une coopérative dans Paramètres du dossier.');
        }
        const lendemain = (0, liquidation_societe_1.lendemainDe)(dissolution);
        if (exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException('Cet exercice est clôturé · ses dates ne changent plus.');
        }
        if (exercice.dateDebut.getTime() <= lendemain.getTime()) {
            throw new common_1.BadRequestException(exercice.dateDebut.getTime() === lendemain.getTime()
                ? 'Cet exercice est déjà l’exercice de liquidation.'
                : `Cet exercice contient la dissolution du ${(0, portefeuille_etat_1.jourFr)(dissolution)} · arrêtez-le à cette date (« Arrêter l’exercice »).`);
        }
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const autre = await tx.exercice.findFirst({
                where: { tenantId, id: { not: exercice.id }, OR: [{ dateFin: { gte: lendemain } }, { statut: client_1.StatutExercice.OUVERT }] },
                orderBy: { dateDebut: 'asc' },
                select: { dateDebut: true, dateFin: true, statut: true },
            });
            if (autre) {
                throw new common_1.BadRequestException(autre.dateFin.getTime() >= lendemain.getTime()
                    ? `L'exercice du ${(0, portefeuille_etat_1.jourFr)(autre.dateDebut)} au ${(0, portefeuille_etat_1.jourFr)(autre.dateFin)} couvre aussi la période de la liquidation · ` +
                        'elle ne forme qu’un exercice (AUDCIF art. 7 al. 4).'
                    : `L'exercice du ${(0, portefeuille_etat_1.jourFr)(autre.dateDebut)} au ${(0, portefeuille_etat_1.jourFr)(autre.dateFin)} est encore ouvert · clôturez-le d’abord, ` +
                        'sa clôture reportant ses soldes au premier jour de l’exercice qui suit.');
            }
            const passee = await ouvertureDejaPassee(tx, tenantId, exercice);
            const issueOuverture = issueOuvertureQuiSeDeplace(passee, options.ouvertureAnnuleeNonRessaisie === true);
            if (issueOuverture === 'A_CONFIRMER')
                throw new common_1.BadRequestException(refusOuvertureAnnuleeHorsDuPremierJour(passee, exercice.dateDebut));
            if (issueOuverture === 'REFUS') {
                throw new common_1.BadRequestException(`L'ouverture passée au ${(0, portefeuille_etat_1.jourFr)(exercice.dateDebut)} (${piecesLisibles(passee.ecritures)}) ne serait plus celle du ` +
                    `premier jour de l'exercice de liquidation, le ${(0, portefeuille_etat_1.jourFr)(lendemain)} · au brouillard, supprimez-la ; validée, ` +
                    'inscrivez-la en négatif (AUDCIF art. 20, al. 2), puis repassez le bilan d’ouverture à cette date.');
            }
            const actesRetires = await this.actesDeLaPeriodeLevesOuRefuses(tx, tenantId, [exercice], options);
            await retirerANouveauProvisoire(tx, tenantId, exercice.id);
            const rattache = await tx.exercice.update({ where: { id: exercice.id }, data: { dateDebut: lendemain } });
            return { ...rattache, actesRetires, relevesARevoir: await relevesUnitesOeuvre(tx, tenantId, [exercice.id]) };
        }, "Un autre geste a modifié l'exercice · relancez-le.");
    }
    async modifierFinDeLiquidation(tenantId, exerciceId, dto) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        const { dateDissolution } = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { dateDissolution: true },
        });
        if (!(0, liquidation_societe_1.estExerciceDeLiquidation)(exercice, dateDissolution)) {
            throw new common_1.BadRequestException('Seul l’exercice de liquidation, ouvert le lendemain de la dissolution déclarée, voit sa fin reportée ou ' +
                'avancée · tout autre exercice coïncide avec l’année civile (AUDCIF art. 7).');
        }
        if (exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException('Cet exercice est clôturé · ses dates ne changent plus.');
        }
        const fin = (0, date_effacable_1.jourSaisiOuEffacement)(dto.dateFin);
        if (!fin)
            throw new common_1.BadRequestException('La date de fin de l’exercice de liquidation est requise.');
        if (fin.getTime() < exercice.dateDebut.getTime()) {
            throw new common_1.BadRequestException(`La fin de l'exercice de liquidation ne peut pas précéder son début, le ${(0, portefeuille_etat_1.jourFr)(exercice.dateDebut)}.`);
        }
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const chevauche = await tx.exercice.findFirst({
                where: { tenantId, id: { not: exercice.id }, dateDebut: { lte: fin }, dateFin: { gte: exercice.dateDebut } },
                select: { dateDebut: true, dateFin: true },
            });
            if (chevauche) {
                throw new common_1.BadRequestException(`L'exercice du ${(0, portefeuille_etat_1.jourFr)(chevauche.dateDebut)} au ${(0, portefeuille_etat_1.jourFr)(chevauche.dateFin)} couvre déjà une partie de ` +
                    'cette période · une période n’est couverte que par un seul exercice.');
            }
            const apres = await tx.ecriture.count({ where: { tenantId, exerciceId: exercice.id, date: { gt: fin } } });
            if (apres > 0) {
                throw new common_1.BadRequestException(`${apres} écriture(s) de l'exercice sont datées après le ${(0, portefeuille_etat_1.jourFr)(fin)} · la fin ne peut pas les laisser ` +
                    'hors de leur exercice.');
            }
            return tx.exercice.update({ where: { id: exercice.id }, data: { dateFin: fin } });
        }, "Un autre geste a modifié l'exercice pendant le report de sa fin · relancez-le.");
    }
    async trouverExercice(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice) {
            throw new common_1.NotFoundException('Exercice introuvable pour ce tenant');
        }
        return exercice;
    }
    async clorePartielle(tenantId, exerciceId, userId, dto) {
        await this.trouverExercice(tenantId, exerciceId);
        const journal = await this.journalService.trouver(tenantId, dto.journalId);
        if ((0, ecritures_de_situation_1.estJournalDeSituation)(journal))
            throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifJournalDeSituationNonCloturable)(journal.code));
        await this.refuserSiNonImprime(tenantId, exerciceId, journal.id, new Date(dto.dateLimite));
        return this.prisma.cloture.create({
            data: {
                tenantId,
                exerciceId,
                granularite: client_1.GranulariteCloture.PARTIELLE,
                journalId: journal.id,
                dateLimite: new Date(dto.dateLimite),
                annulable: true,
                createdBy: userId,
            },
        });
    }
    async cloreTotale(tenantId, exerciceId, userId, dto) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        const journal = await this.journalService.trouver(tenantId, dto.journalId);
        if ((0, ecritures_de_situation_1.estJournalDeSituation)(journal))
            throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifJournalDeSituationNonCloturable)(journal.code));
        const dateLimite = dto.dateLimite ? new Date(dto.dateLimite) : exercice.dateFin;
        if (dateLimite < exercice.dateDebut || dateLimite > exercice.dateFin) {
            throw new common_1.BadRequestException("La date de la clôture totale tombe hors de l'exercice.");
        }
        await this.refuserSiNonImprime(tenantId, exerciceId, journal.id, dateLimite);
        const dejaClos = await this.prisma.cloture.findFirst({
            where: {
                tenantId,
                journalId: journal.id,
                granularite: client_1.GranulariteCloture.TOTALE,
                annuleeAt: null,
                dateLimite: { gte: dateLimite },
            },
        });
        if (dejaClos) {
            throw new common_1.ConflictException(`Le journal ${journal.code} est déjà clôturé totalement jusqu'au ${dejaClos.dateLimite.toISOString().slice(0, 10)}`);
        }
        return this.prisma.cloture.create({
            data: {
                tenantId,
                exerciceId,
                granularite: client_1.GranulariteCloture.TOTALE,
                journalId: journal.id,
                dateLimite,
                annulable: false,
                createdBy: userId,
            },
        });
    }
    async clorePeriode(tenantId, exerciceId, userId, dto) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        const dateLimite = new Date(dto.dateLimite);
        if (dateLimite < exercice.dateDebut || dateLimite > exercice.dateFin) {
            throw new common_1.BadRequestException("La date de la clôture de période tombe hors de l'exercice. Elle est définitive et fige tous les journaux · " +
                "posez-la depuis l'exercice qui contient cette date.");
        }
        await this.refuserSiNonImprime(tenantId, exerciceId, null, dateLimite);
        return this.prisma.cloture.create({
            data: {
                tenantId,
                exerciceId,
                granularite: client_1.GranulariteCloture.PERIODE,
                journalId: null,
                dateLimite,
                annulable: false,
                createdBy: userId,
            },
        });
    }
    async refuserSiNonImprime(tenantId, exerciceId, journalId, jusquau) {
        const dossier = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { refusClotureJournalNonImprime: true } });
        if (dossier?.refusClotureJournalNonImprime !== true)
            return;
        const nonImprimes = await (0, impressions_journal_1.moisNonImprimes)(this.prisma, { tenantId, exerciceId, journalId, jusquau });
        if (nonImprimes.total > 0)
            throw new common_1.BadRequestException((0, impressions_journal_1.motifClotureNonImprimee)(nonImprimes));
    }
    async listerClotures(tenantId, exerciceId) {
        await this.trouverExercice(tenantId, exerciceId);
        return this.prisma.cloture.findMany({
            where: { tenantId, exerciceId },
            include: { journal: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async annulerCloture(tenantId, clotureId, userId) {
        const cloture = await this.prisma.cloture.findFirst({ where: { id: clotureId, tenantId } });
        if (!cloture) {
            throw new common_1.NotFoundException('Clôture introuvable pour ce tenant');
        }
        if (!cloture.annulable) {
            throw new common_1.ForbiddenException('Cette clôture est définitive et ne peut pas être annulée (Totale/Période)');
        }
        if (cloture.annuleeAt) {
            throw new common_1.ForbiddenException('Cette clôture est déjà annulée');
        }
        return this.prisma.cloture.update({
            where: { id: cloture.id },
            data: { annuleeAt: new Date(), annuleeBy: userId },
        });
    }
    async actesDeLaPeriodeLevesOuRefuses(tx, tenantId, exercices, options) {
        let actes = await lireActesDeLaPeriode(tx, tenantId, exercices);
        let retires = [];
        if (options.retirerActesDeLaPeriode && actes.some((a) => a.retirable)) {
            retires = await this.retirerActesDeLaPeriode(tx, tenantId, options.userId ?? 'arret-dissolution', actes);
            actes = await lireActesDeLaPeriode(tx, tenantId, exercices);
        }
        const motif = (0, arret_dissolution_1.motifActesDeLaPeriode)(actes);
        if (motif)
            throw new common_1.BadRequestException(motif);
        return retires;
    }
    async retirerActesDeLaPeriode(tx, tenantId, userId, actes) {
        const delegues = tx;
        const faits = [];
        for (const a of actes.filter((x) => x.retirable)) {
            const origine = a.ecritureId
                ? await tx.ecriture.findFirst({
                    where: { id: a.ecritureId, tenantId },
                    include: { lignes: { include: { ventilations: true } }, journal: true, exercice: true, correction: { select: { id: true } } },
                })
                : null;
            if (origine && origine.statut !== client_1.StatutEcriture.BROUILLARD) {
                const tenues = (0, lignes_tenues_1.motifLignesTenues)(origine.lignes, `l'écriture ${a.piece}`, 'annuler');
                if (tenues)
                    throw new common_1.BadRequestException(`${a.libelle} · ${tenues}`);
                if (origine.correction) {
                    throw new common_1.BadRequestException(`L'écriture ${a.piece} de la ${a.libelle} est déjà inscrite en négatif · retirez l'acte de son module.`);
                }
            }
            await delegues[a.modele].delete({ where: { id: a.id } });
            if (!origine) {
                faits.push(`${a.libelle} (${a.piece}) retirée`);
                continue;
            }
            if (origine.statut === client_1.StatutEcriture.BROUILLARD) {
                await tx.ligneEcriture.deleteMany({ where: { ecritureId: origine.id, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } } });
                const { count } = await tx.ecriture.deleteMany({ where: { id: origine.id, tenantId, statut: client_1.StatutEcriture.BROUILLARD } });
                if (count !== 1) {
                    throw new common_1.ConflictException(`L'écriture ${a.piece} a été validée pendant le retrait · relancez le geste.`);
                }
                faits.push(`${a.libelle} (${a.piece}) retirée avec son écriture au brouillard`);
                continue;
            }
            let date = origine.date;
            let dateValeur = null;
            const premier = await this.premierJourOuvert(tenantId, origine.journalId, date);
            if (premier.getTime() !== date.getTime()) {
                if (premier > origine.exercice.dateFin) {
                    throw new common_1.BadRequestException(`Le journal ${origine.journal.code} est clôturé jusqu'à la fin de l'exercice · l'écriture ${a.piece} de la ${a.libelle} ` +
                        'ne s’y inscrit plus en négatif (AUDCIF art. 22, 4°).');
                }
                dateValeur = date;
                date = premier;
            }
            const numeroPiece = await this.journalService.prochainNumeroPiece(tenantId, origine.journal, origine.exerciceId, date, tx);
            const maintenant = new Date();
            const negatif = await tx.ecriture.create({
                data: {
                    tenantId,
                    exerciceId: origine.exerciceId,
                    journalId: origine.journalId,
                    numeroPiece,
                    date,
                    dateValeur,
                    libelle: `Annulation (inscription en négatif) · ${origine.libelle}`.slice(0, 250),
                    reference: origine.reference,
                    createdBy: userId,
                    corrigeEcritureId: origine.id,
                    motifCorrection: 'Arrêt de l’exercice à la dissolution · acte calculé sur la période de l’exercice, à refaire sur chaque exercice (AUDCIF art. 59).',
                    statut: client_1.StatutEcriture.VALIDEE,
                    valideeBy: userId,
                    valideeAt: maintenant,
                    lignes: { create: (0, lignes_en_negatif_1.lignesEnNegatif)(origine.lignes) },
                },
                select: { numeroPiece: true },
            });
            faits.push(`${a.libelle} (${a.piece}) annulée par inscription en négatif (${origine.journal.code} n° ${negatif.numeroPiece ?? '·'})`);
        }
        return faits;
    }
    async premierJourOuvert(tenantId, journalId, date, db) {
        return (0, report_periode_close_1.premierJourNonCloture)(await this.cloturesApplicables(tenantId, journalId, db), journalId, date);
    }
    async verifierEcritureAutorisee(tenantId, journalId, date) {
        refuserSiPeriodeClose(await this.cloturesApplicables(tenantId, journalId), journalId, date);
    }
    async cloturesApplicables(tenantId, journalId, db) {
        const client = db ?? this.prisma;
        const journal = await client.journal.findFirst({ where: { id: journalId, tenantId }, select: { type: true } });
        const situation = journal ? (0, ecritures_de_situation_1.estJournalDeSituation)(journal) : false;
        return client.cloture.findMany({
            where: { tenantId, annuleeAt: null, OR: situation ? [{ journalId }] : [{ journalId }, { journalId: null }] },
        });
    }
    async trouverCompteResultat(tenantId, tx, deficitaire, referentiel) {
        const mots = libellesResultat(referentiel);
        const numero = deficitaire ? '13900000' : '13100000';
        const intitule = deficitaire ? mots.deficit : mots.excedent;
        const compte = await tx.compte.findUnique({ where: { tenantId_numero: { tenantId, numero } } });
        if (!compte) {
            throw new common_1.BadRequestException(`Compte ${numero} (${intitule}) introuvable pour ce dossier · nécessaire pour clôturer l'exercice. Le plan de comptes ${mots.plan} de ce dossier semble incomplet ou avoir été modifié.`);
        }
        return compte;
    }
    async cloturer(tenantId, exerciceId, userId, options = {}) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        const dossier = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: {
                referentiel: true,
                dateDissolution: true,
                regimeLiquidation: true,
                associeUniquePersonneMorale: true,
                dateClotureLiquidation: true,
                formeJuridiqueSyscohada: true,
                systemeComptableSyscohada: true,
                jeuEtatsFinanciersSycebnl: true,
                dossierMereId: true,
                _count: { select: { cellules: true } },
                refusClotureJournalNonImprime: true,
            },
        });
        const { referentiel } = dossier;
        const mots = libellesResultat(referentiel);
        if (exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.ForbiddenException('Cet exercice est déjà clôturé');
        }
        const finDeLiquidation = (0, liquidation_societe_1.estExerciceDeLiquidation)(exercice, dossier.dateDissolution);
        const finSansLiquidation = (0, liquidation_societe_1.estFinSansLiquidation)(exercice, dossier);
        if (finDeLiquidation) {
            const cloture = dossier.dateClotureLiquidation;
            if (!cloture || cloture.getTime() !== exercice.dateFin.getTime()) {
                throw new common_1.BadRequestException((cloture
                    ? `La clôture de la liquidation est déclarée au ${(0, portefeuille_etat_1.jourFr)(cloture)} et l'exercice de liquidation finit le ${(0, portefeuille_etat_1.jourFr)(exercice.dateFin)} · `
                    : `L'exercice de liquidation finit le ${(0, portefeuille_etat_1.jourFr)(exercice.dateFin)} sans clôture de la liquidation déclarée · `) +
                    'il ne se clôture qu’à la clôture de la liquidation (AUDCIF art. 7 al. 4), les 31 décembre qu’il traverse ' +
                    'étant des situations annuelles provisoires. Déclarez la date de clôture dans Paramètres du dossier et ' +
                    'portez la fin de l’exercice à cette date.');
            }
        }
        const [precedentOuvert, suivantClos] = await Promise.all([
            this.prisma.exercice.findFirst({
                where: { tenantId, dateFin: { lt: exercice.dateDebut }, statut: { not: client_1.StatutExercice.CLOTURE } },
                orderBy: { dateDebut: 'asc' },
                select: { dateDebut: true, dateFin: true },
            }),
            this.prisma.exercice.findFirst({
                where: { tenantId, dateDebut: { gt: exercice.dateFin }, statut: client_1.StatutExercice.CLOTURE },
                select: { dateDebut: true },
            }),
        ]);
        if (precedentOuvert) {
            throw new common_1.BadRequestException(`L'exercice ${periodeLisible(precedentOuvert)} n'est pas clôturé. Les exercices se clôturent dans l'ordre : ` +
                'son report à-nouveau fait le bilan d’ouverture de celui-ci.');
        }
        if (suivantClos) {
            throw new common_1.BadRequestException("Un exercice postérieur est déjà clôturé : le report à-nouveau de celui-ci ne pourrait plus y entrer.");
        }
        const enBrouillard = await this.prisma.ecriture.count({
            where: { tenantId, exerciceId, statut: client_1.StatutEcriture.BROUILLARD },
        });
        if (enBrouillard > 0) {
            const enSituation = await this.prisma.ecriture.count({
                where: { tenantId, exerciceId, statut: client_1.StatutEcriture.BROUILLARD, journal: { type: client_1.TypeJournal.SITUATION } },
            });
            throw new common_1.BadRequestException(`${enBrouillard} écriture(s) sont encore en brouillard sur cet exercice. Validez-les ou supprimez-les avant ` +
                "de clôturer : la clôture ne lit que le livre-journal, et ce qui reste en brouillard serait perdu du résultat." +
                (enSituation > 0
                    ? ` Dont ${enSituation} dans un journal de situation, où elles ne se valident pas · transférez-les dans ` +
                        'un journal ordinaire (Brouillard, « Transférer »), où elles se valident comme toute pièce, leurs ' +
                        'lignes, lettrage, pointage et liens aux modules gardés tels quels.'
                    : ''));
        }
        if (dossier.refusClotureJournalNonImprime === true) {
            const nonImprimes = await (0, impressions_journal_1.moisNonImprimes)(this.prisma, { tenantId, exerciceId, journalId: null, jusquau: exercice.dateFin });
            if (nonImprimes.total > 0)
                throw new common_1.BadRequestException((0, impressions_journal_1.motifClotureNonImprimee)(nonImprimes));
        }
        const enSouffrance = (0, ecarts_non_constates_1.motifClotureEcartsNonConstates)(await (0, ecarts_non_constates_1.ecartsRealisesNonConstates)(this.prisma, { tenantId, exerciceId }));
        if (enSouffrance)
            throw new common_1.BadRequestException(enSouffrance);
        await this.refuserBilanDesequilibre(tenantId, exerciceId, dossier, exercice);
        const precedent = await this.prisma.exercice.findFirst({
            where: { tenantId, dateFin: { lt: exercice.dateDebut } },
            orderBy: { dateFin: 'desc' },
            select: { id: true },
        });
        const partielsALire = await this.prisma.lettrage.count({
            where: {
                tenantId,
                statut: client_1.StatutLettrage.PARTIEL,
                lignes: { some: { ecriture: { tenantId, exerciceId: { in: [exerciceId, ...(precedent ? [precedent.id] : [])] } } } },
            },
        });
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const orphelines = (0, creances_douteuses_1.motifClotureDepreciationsOrphelines)(await (0, depreciations_orphelines_1.depreciationsOrphelines)(tx, { tenantId, exerciceId }));
            if (orphelines)
                throw new common_1.BadRequestException(orphelines);
            let comptes = await lireComptesDuReport(tx, tenantId, { tenantId, exerciceId, ...ecritures_de_situation_1.HORS_SITUATION }, referentiel);
            const solde = (c) => auCentime((0, report_a_nouveau_1.soldeDuCompte)(c));
            const journal = (await tx.journal.findFirst({ where: { tenantId, code: 'OD' } })) ??
                (await tx.journal.findFirst({ where: { tenantId, type: client_1.TypeJournal.GENERAL } }));
            if (!journal) {
                throw new common_1.BadRequestException("Aucun journal de type Général disponible pour enregistrer les écritures de clôture (journal 'OD' attendu).");
            }
            const virement = await this.virementDuResultatNonAffecte(tx, tenantId, comptes, dossier);
            const messagesVirement = [];
            if (virement.lignes.length > 0) {
                const numeroPieceVirement = await this.journalService.prochainNumeroPiece(tenantId, journal, exerciceId, exercice.dateFin, tx);
                await tx.ecriture.create({
                    data: {
                        tenantId,
                        exerciceId,
                        journalId: journal.id,
                        numeroPiece: numeroPieceVirement,
                        date: exercice.dateFin,
                        libelle: `Résultat de l'exercice précédent non affecté viré au report à nouveau · exercice ${(0, libelle_exercice_1.libelleExercice)(exercice)}`,
                        createdBy: userId,
                        estGenereeParCloture: true,
                        estSoldeDesComptesDeGestion: false,
                        ...validationParLaCloture(userId),
                        lignes: { create: virement.lignes },
                    },
                });
                comptes = await lireComptesDuReport(tx, tenantId, { tenantId, exerciceId, ...ecritures_de_situation_1.HORS_SITUATION }, referentiel);
                if (virement.compteDestination) {
                    messagesVirement.push(`Résultat de l'exercice précédent non affecté viré au report à nouveau · ${libelleDuSens(referentiel, virement.montant)} de ` +
                        `${(0, virement_resultat_non_affecte_1.montantFr)(Math.abs(virement.montant))} au compte ${virement.compteDestination} (${articleDuVirement(referentiel)}). ` +
                        `AVERTISSEMENT · si l'assemblée en décide une autre affectation, elle reste à passer dans l'exercice suivant depuis le compte ` +
                        `${virement.compteDestination}.`);
                }
            }
            const comptesAucun = comptes.filter((c) => c.modeReportANouveau === client_1.ModeReportANouveau.AUCUN && Math.abs(solde(c)) > EPSILON);
            let totalDebitResultat = 0;
            let totalCreditResultat = 0;
            const lignesCloture = [];
            for (const c of comptesAucun) {
                const s = solde(c);
                if (s > 0) {
                    lignesCloture.push({ compteId: c.id, debit: 0, credit: s, libelle: `Clôture ${c.numero} · ${c.intitule}` });
                    totalDebitResultat += s;
                }
                else {
                    lignesCloture.push({ compteId: c.id, debit: -s, credit: 0, libelle: `Clôture ${c.numero} · ${c.intitule}` });
                    totalCreditResultat += -s;
                }
            }
            let deltaResultat = 0;
            let compteResultatId = null;
            if (lignesCloture.length > 0) {
                deltaResultat = auCentime(totalDebitResultat - totalCreditResultat);
                if (Math.abs(deltaResultat) > EPSILON) {
                    const compteResultat = await this.trouverCompteResultat(tenantId, tx, deltaResultat > 0, referentiel);
                    compteResultatId = compteResultat.id;
                    lignesCloture.push({
                        compteId: compteResultat.id,
                        debit: deltaResultat > 0 ? deltaResultat : 0,
                        credit: deltaResultat < 0 ? -deltaResultat : 0,
                        libelle: deltaResultat > 0 ? mots.ligneDeficit : mots.ligneExcedent,
                    });
                }
                const totalDebit = lignesCloture.reduce((s, l) => s + l.debit, 0);
                const totalCredit = lignesCloture.reduce((s, l) => s + l.credit, 0);
                if (Math.abs(totalDebit - totalCredit) > EPSILON) {
                    throw new common_1.InternalServerErrorException("Écriture de clôture déséquilibrée · anomalie interne, clôture annulée.");
                }
                const numeroPiece = await this.journalService.prochainNumeroPiece(tenantId, journal, exerciceId, exercice.dateFin, tx);
                await tx.ecriture.create({
                    data: {
                        tenantId,
                        exerciceId,
                        journalId: journal.id,
                        numeroPiece,
                        date: exercice.dateFin,
                        libelle: `Clôture des charges/produits · exercice ${(0, libelle_exercice_1.libelleExercice)(exercice)}`,
                        createdBy: userId,
                        estGenereeParCloture: true,
                        estSoldeDesComptesDeGestion: true,
                        ...validationParLaCloture(userId),
                        lignes: { create: lignesCloture },
                    },
                });
            }
            if (finDeLiquidation || finSansLiquidation) {
                const soldes = new Map();
                for (const c of comptes) {
                    if (c.modeReportANouveau === client_1.ModeReportANouveau.AUCUN)
                        continue;
                    soldes.set(c.id, { numero: c.numero, solde: solde(c) });
                }
                if (compteResultatId && Math.abs(deltaResultat) > EPSILON) {
                    const r = soldes.get(compteResultatId);
                    if (r)
                        r.solde = auCentime(r.solde + deltaResultat);
                    else
                        soldes.set(compteResultatId, { numero: 'résultat', solde: deltaResultat });
                }
                const nonSoldes = [...soldes.values()].filter((c) => Math.abs(c.solde) > EPSILON).map((c) => c.numero).sort();
                const clos = await tx.exercice.update({ where: { id: exerciceId }, data: { statut: client_1.StatutExercice.CLOTURE } });
                const liste = `${nonSoldes.slice(0, 20).join(', ')}${nonSoldes.length > 20 ? '…' : ''}`;
                return {
                    ...clos,
                    virementResultatNonAffecte: virement.compteDestination
                        ? { montant: virement.montant, compte: virement.compteDestination }
                        : null,
                    issueOuverture: [
                        ...messagesVirement,
                        finSansLiquidation
                            ? `Dernier exercice de la société, dissoute sans liquidation le ${(0, portefeuille_etat_1.jourFr)(exercice.dateFin)} · son patrimoine est transmis universellement à l'associé unique personne morale (AUSCGIE art. 201 al. 4) ; aucun exercice ne suit et aucun report à-nouveau n'est passé.` +
                                (nonSoldes.length
                                    ? ` ${nonSoldes.length} compte(s) de bilan restent soldés (${liste}) · ils disent ce que la transmission du patrimoine n'a pas encore porté à l'associé, dans la comptabilité duquel ils se reprennent ; aucun texte lu ne fixe l'écriture de la transmission, que le cabinet passe lui-même.`
                                    : ' Tous les comptes de bilan sont soldés.')
                            : `Liquidation clôturée le ${(0, portefeuille_etat_1.jourFr)(exercice.dateFin)} · aucun exercice ne suit et aucun report à-nouveau n'est passé (AUDCIF art. 7 al. 4 ; AUSCGIE art. 205).` +
                                (nonSoldes.length
                                    ? ` ${nonSoldes.length} compte(s) de bilan restent soldés (${liste}) · après le règlement des associés, tous les comptes de la société sont soldés (AUDCIF Titre VIII ch. 40 § 2.2.2.3).`
                                    : ' Tous les comptes de bilan sont soldés.'),
                    ],
                };
            }
            let exerciceSuivant = await tx.exercice.findFirst({
                where: { tenantId, dateDebut: { gt: exercice.dateFin } },
                orderBy: { dateDebut: 'asc' },
            });
            if (exerciceSuivant && !(0, exercice_contigu_1.estContigu)(exercice.dateFin, exerciceSuivant.dateDebut)) {
                throw new common_1.BadRequestException((0, exercice_contigu_1.motifSuivantNonContigu)(exercice.dateFin, exerciceSuivant));
            }
            if (!exerciceSuivant) {
                refuserSuivantCivilApresDissolution(exercice, dossier);
                const { dateDebut, dateFin } = exerciceSuivantApres(exercice.dateFin);
                exerciceSuivant = await tx.exercice.create({ data: { tenantId, dateDebut, dateFin } });
            }
            const report = (0, report_a_nouveau_1.lignesReportANouveau)(comptes, compteResultatId ? { compteId: compteResultatId, montant: deltaResultat } : null);
            const dejaPassee = await ouvertureDejaPassee(tx, tenantId, exerciceSuivant);
            const issue = await issueDeLOuverture(tx, {
                tenantId,
                exerciceId,
                referentiel,
                report,
                dejaPassee,
                choix: options.ouvertureImportee ?? null,
                motifConservation: options.motifConservation ?? null,
            });
            const rectification = issue.rectification;
            const lignesRan = issue.lignes;
            const issueOuverture = [...issue.messages];
            const { numeroPiece: numeroProvisoire, tenues } = await retirerANouveauProvisoire(tx, tenantId, exerciceSuivant.id, {
                reporterLesTenues: true,
            });
            const groupesPartiels = [];
            await (0, reconduction_lettrage_1.parcourirGroupesPartiels)(tx, { tenantId, exerciceId }, async (lot) => {
                groupesPartiels.push(...lot);
            });
            const anciens = (await (0, reconduction_lettrage_1.groupesNonReconduits)(tx, { tenantId, exerciceSuivantId: exerciceId, plafond: Number.MAX_SAFE_INTEGER })).groupes;
            const lignesDesGroupes = new Set([
                ...groupesPartiels.flatMap((g) => g.lignes.map((l) => l.id)),
                ...anciens.filter((g) => g.etat === 'A_RECONDUIRE').flatMap((g) => g.accueil.flatMap((id) => (id ? [id] : []))),
            ]);
            const accueilDe = new Map();
            const lignesAEcrire = lignesRan.map((l) => {
                if (!l.origineId || !lignesDesGroupes.has(l.origineId))
                    return (0, report_a_nouveau_1.ligneAEcrire)(l);
                const id = (0, crypto_1.randomUUID)();
                accueilDe.set(l.origineId, id);
                return (0, report_a_nouveau_1.ligneAEcrire)(l, id);
            });
            let lignesCreees = [];
            if (lignesRan.length > 0) {
                const totalDebit = lignesRan.reduce((s, l) => s + l.debit, 0);
                const totalCredit = lignesRan.reduce((s, l) => s + l.credit, 0);
                if (Math.abs(totalDebit - totalCredit) > EPSILON) {
                    throw new common_1.InternalServerErrorException("Report à-nouveau déséquilibré · anomalie interne (identité partie double violée), clôture annulée.");
                }
                const numeroPieceRan = numeroProvisoire ??
                    (await this.journalService.prochainNumeroPiece(tenantId, journal, exerciceSuivant.id, exerciceSuivant.dateDebut, tx));
                const creee = await tx.ecriture.create({
                    data: {
                        tenantId,
                        exerciceId: exerciceSuivant.id,
                        journalId: journal.id,
                        numeroPiece: numeroPieceRan,
                        date: exerciceSuivant.dateDebut,
                        libelle: rectification
                            ? `Report à-nouveau · ouverture exercice ${(0, libelle_exercice_1.libelleExercice)(exerciceSuivant)} · rectifie ${piecesLisibles(dejaPassee.ecritures)}`.slice(0, 250)
                            : `Report à-nouveau · ouverture exercice ${(0, libelle_exercice_1.libelleExercice)(exerciceSuivant)}`,
                        createdBy: userId,
                        estGenereeParCloture: true,
                        ...(rectification
                            ? {
                                motifCorrection: `Bilan d'ouverture importé (${piecesLisibles(dejaPassee.ecritures)}) différent du bilan de clôture · ` +
                                    `${articleCorrespondance(referentiel)}, AUDCIF art. 20.`,
                            }
                            : {}),
                        ...validationParLaCloture(userId),
                        lignes: { create: lignesAEcrire },
                    },
                    select: { lignes: { select: { id: true, compteId: true, debit: true, credit: true, dateEcheance: true, deviseId: true, montantDevise: true } } },
                });
                lignesCreees = creee.lignes.map((l) => ({
                    id: l.id,
                    compteId: l.compteId,
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                    dateEcheance: l.dateEcheance,
                    deviseId: l.deviseId,
                    montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
                }));
            }
            if (rectification) {
                issueOuverture.push(...(await lettrerNegatifsAvecLeursOrigines(tx, tenantId, userId, rectification.negatifs, lignesCreees)));
            }
            const candidates = [
                ...lignesCreees.filter((l) => l.debit >= 0 && l.credit >= 0),
                ...dejaPassee.lignes
                    .filter((l) => l.lettrageId === null && l.rapprochementId === null && !rectification?.comptesRectifies.includes(l.compteId))
                    .map((l) => ({ id: l.id, compteId: l.compteId, debit: l.debit, credit: l.credit, dateEcheance: l.dateEcheance, deviseId: l.deviseId, montantDevise: l.montantDevise })),
            ];
            const reporte = await reporterLesTenues(tx, tenantId, exerciceSuivant.id, tenues, candidates);
            issueOuverture.push(...reporte.messages);
            const reconduction = await reconduireLesGroupesPartiels(tx, {
                tenantId,
                userId,
                groupes: groupesPartiels,
                accueilDe,
                ouvertureLibre: dejaPassee.lignes
                    .filter((l) => l.lettrageId === null && l.rapprochementId === null && !rectification?.comptesRectifies.includes(l.compteId))
                    .map((l) => ({
                    id: l.id,
                    compteId: l.compteId,
                    debit: l.debit,
                    credit: l.credit,
                    dateEcheance: l.dateEcheance,
                    deviseId: l.deviseId,
                    montantDevise: l.montantDevise,
                    libelle: l.libelle,
                })),
            });
            issueOuverture.push(...(0, reconduction_lettrage_1.messagesDeReconduction)(reconduction));
            issueOuverture.push(...(await reconduireLesAnciens(tx, { tenantId, userId, anciens, accueilDe })));
            const clos = await tx.exercice.update({
                where: { id: exerciceId },
                data: {
                    statut: client_1.StatutExercice.CLOTURE,
                    ...(reporte.defaits.length > 0 ? { defaitsParLaCloture: reporte.defaits } : {}),
                    ...(issue.conservation
                        ? { motifOuvertureSuivanteConservee: issue.conservation.motif, ecartsOuvertureSuivanteConservee: issue.conservation.ecarts }
                        : {}),
                },
            });
            return {
                ...clos,
                issueOuverture: [...messagesVirement, ...issueOuverture],
                lettragesPartiels: {
                    reconduits: reconduction.filter((r) => r.codeReconduit !== null).length,
                    nonReconduits: reconduction.filter((r) => r.codeReconduit === null).length,
                },
                virementResultatNonAffecte: virement.compteDestination
                    ? { montant: virement.montant, compte: virement.compteDestination }
                    : null,
            };
        }, "Trop d'opérations simultanées sur cet exercice · veuillez réessayer.", { operations: (0, reconduction_lettrage_1.operationsDeLaCloture)(partielsALire) });
    }
    async confrontationOuvertureSuivante(tenantId, exerciceId) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        const vide = {
            exerciceSuivant: null,
            pieces: null,
            auBrouillard: false,
            ouvertureNulle: false,
            exerciceSansEcriture: false,
            ecarts: [],
            total: 0,
            tronque: false,
            lignesTenues: [],
            declarationRequise: false,
            negatifsTardifs: [],
            lettragesPartielsAReconduire: null,
        };
        if (exercice.statut === client_1.StatutExercice.CLOTURE)
            return vide;
        const suivant = await this.prisma.exercice.findFirst({
            where: { tenantId, dateDebut: { gt: exercice.dateFin } },
            orderBy: { dateDebut: 'asc' },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        if (!suivant || !(0, exercice_contigu_1.estContigu)(exercice.dateFin, suivant.dateDebut))
            return vide;
        const tx = this.prisma;
        const dejaPassee = await ouvertureDejaPassee(tx, tenantId, suivant);
        {
            const r = await (0, reconduction_lettrage_1.groupesQueLaClotureReconduira)(this.prisma, { tenantId, exerciceId });
            vide.lettragesPartielsAReconduire = { ...r, annonce: (0, reconduction_lettrage_1.annonceDeReconduction)(r, { ouvertureDejaPassee: dejaPassee.ecritures.length > 0 }) };
        }
        const dossier = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, formeJuridiqueSyscohada: true },
        });
        const { referentiel } = dossier;
        if (dejaPassee.ecritures.length === 0)
            return { ...vide, exerciceSuivant: suivant };
        const base = {
            ...vide,
            exerciceSuivant: suivant,
            pieces: piecesLisibles(dejaPassee.ecritures),
            auBrouillard: dejaPassee.ecritures.some((e) => e.statut === client_1.StatutEcriture.BROUILLARD),
            negatifsTardifs: dejaPassee.negatifsTardifs.map((t) => ({ piece: t.piece, date: t.date.toISOString().slice(0, 10) })),
        };
        const nulle = (0, report_a_nouveau_1.ouvertureNulle)(dejaPassee.lignes);
        if (nulle && dejaPassee.negatifsTardifs.length === 0)
            return { ...base, ouvertureNulle: true };
        const comptes = await lireComptesDuReport(tx, tenantId, { tenantId, exerciceId, ...ecritures_de_situation_1.HORS_SITUATION }, referentiel);
        const delta = (0, report_a_nouveau_1.resultatDesComptesDeGestion)(comptes);
        const resultat = Math.abs(delta) > EPSILON ? { compteId: (await this.trouverCompteResultat(tenantId, tx, delta > 0, referentiel)).id, montant: delta } : null;
        const virement = await this.virementDuResultatNonAffecte(tx, tenantId, comptes, dossier);
        const report = (0, virement_resultat_non_affecte_1.appliquerVirementAuReport)((0, report_a_nouveau_1.lignesReportANouveau)(comptes, resultat), virement.lignes);
        const { ecarts, tenues } = await confrontationNommee(tx, tenantId, report, dejaPassee);
        if (nulle) {
            return {
                ...base,
                ouvertureNulle: true,
                ecarts: ecarts.slice(0, PLAFOND_ECARTS_SERVIS),
                total: ecarts.length,
                tronque: ecarts.length > PLAFOND_ECARTS_SERVIS,
                declarationRequise: report.length > 0,
            };
        }
        const ecrituresDeN = await this.prisma.ecriture.count({
            where: { tenantId, exerciceId, estSoldeDesComptesDeGestion: false, ...ecritures_de_situation_1.HORS_SITUATION },
        });
        return {
            ...base,
            exerciceSansEcriture: ecrituresDeN === 0,
            ecarts: ecarts.slice(0, PLAFOND_ECARTS_SERVIS),
            total: ecarts.length,
            tronque: ecarts.length > PLAFOND_ECARTS_SERVIS,
            lignesTenues: tenues.slice(0, PLAFOND_ECARTS_SERVIS),
            declarationRequise: ecarts.length > 0 && ecrituresDeN > 0,
        };
    }
    async genererANouveauxProvisoires(tenantId, exerciceId, userId, options = {}) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        if (exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("Cet exercice est clôturé · son report à-nouveau est DÉFINITIF et a été passé par la clôture.");
        }
        const dossier = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, dateDissolution: true, regimeLiquidation: true, associeUniquePersonneMorale: true, formeJuridiqueSyscohada: true },
        });
        const { referentiel } = dossier;
        if ((0, liquidation_societe_1.estFinSansLiquidation)(exercice, dossier)) {
            throw new common_1.BadRequestException('Cet exercice est le dernier de la société, dissoute sans liquidation · son patrimoine est transmis à l’associé ' +
                'unique personne morale (AUSCGIE art. 201 al. 4), aucun exercice ne suit et aucun report à-nouveau n’est dû.');
        }
        if ((0, liquidation_societe_1.estExerciceDeLiquidation)(exercice, dossier.dateDissolution)) {
            throw new common_1.BadRequestException('L’exercice de liquidation n’a pas d’exercice suivant · la société s’éteint à la clôture de la liquidation, ' +
                'et aucun report à-nouveau n’est dû.');
        }
        const brouillardNonRepris = await this.prisma.ecriture.count({
            where: { tenantId, exerciceId, statut: client_1.StatutEcriture.BROUILLARD },
        });
        const resultat = await (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const ran = await lireComptesDuReport(tx, tenantId, { tenantId, exerciceId, statut: client_1.StatutEcriture.VALIDEE }, referentiel);
            const journal = (await tx.journal.findFirst({ where: { tenantId, code: 'OD' } })) ??
                (await tx.journal.findFirst({ where: { tenantId, type: client_1.TypeJournal.GENERAL } }));
            if (!journal) {
                throw new common_1.BadRequestException("Aucun journal de type Général disponible pour le report à-nouveau (journal 'OD' attendu).");
            }
            let exerciceSuivant = await tx.exercice.findFirst({
                where: { tenantId, dateDebut: { gt: exercice.dateFin } },
                orderBy: { dateDebut: 'asc' },
            });
            if (exerciceSuivant && !(0, exercice_contigu_1.estContigu)(exercice.dateFin, exerciceSuivant.dateDebut)) {
                throw new common_1.BadRequestException((0, exercice_contigu_1.motifSuivantNonContigu)(exercice.dateFin, exerciceSuivant));
            }
            if (!exerciceSuivant) {
                refuserSuivantCivilApresDissolution(exercice, dossier);
                const { dateDebut, dateFin } = exerciceSuivantApres(exercice.dateFin);
                exerciceSuivant = await tx.exercice.create({ data: { tenantId, dateDebut, dateFin } });
            }
            if (exerciceSuivant.statut === client_1.StatutExercice.CLOTURE) {
                throw new common_1.BadRequestException("L'exercice suivant est clôturé · il ne reçoit plus de report.");
            }
            const delta = (0, report_a_nouveau_1.resultatDesComptesDeGestion)(ran);
            let resultatCompte = null;
            if (Math.abs(delta) > EPSILON) {
                const compte = await this.trouverCompteResultat(tenantId, tx, delta > 0, referentiel);
                resultatCompte = { compteId: compte.id, montant: delta };
            }
            const virement = await this.virementDuResultatNonAffecte(tx, tenantId, ran, dossier);
            const report = (0, virement_resultat_non_affecte_1.appliquerVirementAuReport)((0, report_a_nouveau_1.lignesReportANouveau)(ran, resultatCompte), virement.lignes);
            const dejaPassee = await ouvertureDejaPassee(tx, tenantId, exerciceSuivant);
            const nulleSansDoute = (0, report_a_nouveau_1.ouvertureNulle)(dejaPassee.lignes) && dejaPassee.negatifsTardifs.length === 0;
            const ecartsOuverture = dejaPassee.ecritures.length > 0 && !nulleSansDoute ? (0, report_a_nouveau_1.confrontationDeLOuverture)(report, dejaPassee.lignes) : null;
            const lignes = ecartsOuverture ? [] : report;
            const debit = lignes.reduce((t, l) => t + l.debit, 0);
            const credit = lignes.reduce((t, l) => t + l.credit, 0);
            if (Math.abs(debit - credit) > EPSILON) {
                throw new common_1.InternalServerErrorException('Report à-nouveau provisoire déséquilibré · anomalie interne, rien n’a été passé.');
            }
            const { numeroPiece: numeroProvisoire } = await retirerANouveauProvisoire(tx, tenantId, exerciceSuivant.id);
            const aReconduire = await (0, reconduction_lettrage_1.groupesQueLaClotureReconduira)(tx, { tenantId, exerciceId });
            if (lignes.length > 0) {
                const numeroPiece = numeroProvisoire ??
                    (await this.journalService.prochainNumeroPiece(tenantId, journal, exerciceSuivant.id, exerciceSuivant.dateDebut, tx));
                await tx.ecriture.create({
                    data: {
                        tenantId,
                        exerciceId: exerciceSuivant.id,
                        journalId: journal.id,
                        numeroPiece,
                        date: exerciceSuivant.dateDebut,
                        libelle: `Report à-nouveau PROVISOIRE · ouverture exercice ${(0, libelle_exercice_1.libelleExercice)(exerciceSuivant)}`,
                        createdBy: userId,
                        estGenereeParCloture: true,
                        estANouveauProvisoire: true,
                        lignes: { create: lignes.map((l) => (0, report_a_nouveau_1.ligneAEcrire)(l)) },
                    },
                });
            }
            return {
                exerciceSuivantId: exerciceSuivant.id,
                lignes: lignes.length,
                resultat: delta,
                lettragesPartielsAReconduire: { ...aReconduire, annonce: (0, reconduction_lettrage_1.annonceDeReconduction)(aReconduire, { ouvertureDejaPassee: dejaPassee.ecritures.length > 0 }) },
                ouvertureDejaPassee: ecartsOuverture
                    ? { pieces: piecesLisibles(dejaPassee.ecritures), comptesDivergents: ecartsOuverture.length }
                    : null,
            };
        }, "Trop d'opérations simultanées sur cet exercice · veuillez réessayer.");
        const budgets = options.reporterBudgets ? await this.reporterBudgets(tenantId, exerciceId) : null;
        return { ...resultat, brouillardNonRepris, budgetsReportes: budgets?.reportes ?? null };
    }
    async reporterBudgets(tenantId, exerciceId) {
        const exercice = await this.trouverExercice(tenantId, exerciceId);
        const suivant = await this.prisma.exercice.findFirst({
            where: { tenantId, dateDebut: { gt: exercice.dateFin } },
            orderBy: { dateDebut: 'asc' },
        });
        if (!suivant)
            throw new common_1.BadRequestException("L'exercice suivant n'existe pas encore · ouvrez-le avant d'y reporter les budgets.");
        if (!(0, exercice_contigu_1.estContigu)(exercice.dateFin, suivant.dateDebut)) {
            throw new common_1.BadRequestException((0, exercice_contigu_1.motifSuivantNonContigu)(exercice.dateFin, suivant));
        }
        (0, exercice_budgetaire_clos_1.refuserSiExerciceBudgetaireClos)(suivant.statut);
        const [budgets, dejaDotes, sections] = await Promise.all([
            this.prisma.budgetSection.findMany({ where: { exerciceId, section: { tenantId } } }),
            this.prisma.budgetSection.findMany({ where: { exerciceId: suivant.id, section: { tenantId } } }),
            this.prisma.sectionAnalytique.findMany({ where: { tenantId }, select: { id: true, dateFin: true } }),
        ]);
        const closes = new Set(sections.filter((x) => x.dateFin && x.dateFin < suivant.dateDebut).map((x) => x.id));
        const aReporter = (0, report_a_nouveau_1.budgetsAReporter)(budgets.map((b) => ({ sectionId: b.sectionId, mois: b.mois, montant: Number(b.montant) })), dejaDotes, closes);
        if (aReporter.length) {
            await this.prisma.budgetSection.createMany({
                data: aReporter.map((b) => ({ sectionId: b.sectionId, exerciceId: suivant.id, mois: b.mois, montant: b.montant })),
            });
        }
        return { reportes: aReporter.length, dejaDotes: dejaDotes.length, sectionsCloses: closes.size };
    }
};
exports.ExerciceService = ExerciceService;
exports.ExerciceService = ExerciceService = ExerciceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        journal_service_1.JournalService,
        core_1.ModuleRef])
], ExerciceService);
const SELECT_LIGNE_RAN = {
    debit: true,
    credit: true,
    lettre: true,
    libelle: true,
    dateEcheance: true,
    deviseId: true,
    montantDevise: true,
    coursApplique: true,
    ecriture: { select: { libelle: true } },
};
function versLigneRan(l) {
    return {
        debit: Number(l.debit),
        credit: Number(l.credit),
        lettre: l.lettre,
        libelle: l.libelle ?? l.ecriture.libelle,
        dateEcheance: l.dateEcheance,
        deviseId: l.deviseId,
        montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
        coursApplique: l.coursApplique === null ? null : Number(l.coursApplique),
    };
}
async function lireComptesDuReport(tx, tenantId, ecriture, referentiel) {
    const ecritureLue = (0, ecritures_de_situation_1.avecStatut)(ecriture);
    const enDevise = {
        ecriture: ecritureLue,
        deviseId: { not: null },
        OR: [{ montantDevise: { gt: 0 } }, { montantDevise: { lt: 0 } }],
    };
    const credit = tx.ligneEcriture.fields.credit;
    const [plan, totaux, positifs, negatifs] = await Promise.all([
        tx.compte.findMany({
            where: { tenantId },
            select: { id: true, numero: true, intitule: true, modeReportANouveau: true },
            orderBy: { numero: 'asc' },
        }),
        tx.ligneEcriture.groupBy({ by: ['compteId'], where: { ecriture: ecritureLue }, _sum: { debit: true, credit: true } }),
        tx.ligneEcriture.groupBy({
            by: ['compteId', 'deviseId'],
            where: { ...enDevise, debit: { gte: credit } },
            _sum: { debit: true, credit: true, montantDevise: true },
        }),
        tx.ligneEcriture.groupBy({
            by: ['compteId', 'deviseId'],
            where: { ...enDevise, debit: { lt: credit } },
            _sum: { debit: true, credit: true, montantDevise: true },
        }),
    ]);
    const nombre = (x) => (x === null ? 0 : Number(x));
    const sommes = new Map();
    const sommesDe = (compteId) => {
        const s = sommes.get(compteId) ?? { debit: 0, credit: 0, enDevise: [] };
        sommes.set(compteId, s);
        return s;
    };
    for (const t of totaux) {
        const s = sommesDe(t.compteId);
        s.debit = nombre(t._sum.debit);
        s.credit = nombre(t._sum.credit);
    }
    for (const [groupes, sens] of [
        [positifs, 1],
        [negatifs, -1],
    ]) {
        for (const g of groupes) {
            if (!g.deviseId)
                continue;
            sommesDe(g.compteId).enDevise.push({
                deviseId: g.deviseId,
                sens,
                debit: nombre(g._sum.debit),
                credit: nombre(g._sum.credit),
                montantDevise: nombre(g._sum.montantDevise),
            });
        }
    }
    const lignes = new Map();
    await (0, lecture_par_lots_1.lireParLots)((curseur) => tx.ligneEcriture.findMany({
        where: (0, lignes_reportees_au_detail_1.lignesReporteesAuDetail)(ecritureLue),
        select: { id: true, compteId: true, ...SELECT_LIGNE_RAN },
        ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
    }), (l) => {
        const duCompte = lignes.get(l.compteId) ?? [];
        duCompte.push({ ...versLigneRan(l), id: l.id, lettre: null });
        lignes.set(l.compteId, duCompte);
    }, lecture_par_lots_1.LOT_LECTURE);
    return plan.filter((c) => !(0, report_a_nouveau_1.horsDuReport)(c.numero, referentiel)).map((c) => c.modeReportANouveau === client_1.ModeReportANouveau.DETAIL
        ? { ...c, lignes: lignes.get(c.id) ?? [] }
        : { ...c, sommes: sommes.get(c.id) ?? { debit: 0, credit: 0, enDevise: [] } });
}
async function reconduireLesGroupesPartiels(tx, p) {
    const issues = [];
    const codes = new Map();
    const prises = new Set();
    for (const g of p.groupes) {
        let accueil = g.lignes.map((l) => p.accueilDe.get(l.id) ?? null);
        if (accueil.every((a) => a === null)) {
            accueil = (0, reconduction_lettrage_1.apparierAuReport)(g.lignes.map((l) => ({ ...l, compteNumero: g.compte.numero })), p.ouvertureLibre.filter((c) => !prises.has(c.id)));
        }
        const groupeN = { id: g.id, code: g.code, compte: g.compte.numero, reste: (0, reconduction_lettrage_1.resteDuGroupe)(g) };
        if (accueil.some((a) => a === null)) {
            issues.push({
                groupeN,
                codeReconduit: null,
                motif: "une de ses lignes n'a pas de ligne d'à-nouveau qui la reporte telle quelle (ouverture passée à part, sans équivalent sûr)",
            });
            continue;
        }
        accueil.forEach((a) => prises.add(a));
        if (!codes.has(g.compteId))
            codes.set(g.compteId, await (0, lettrage_service_1.prochaineLettreDuCompte)(tx, p.tenantId, g.compteId));
        const pose = await (0, reconduction_lettrage_1.poserGroupeReconduit)(tx, {
            tenantId: p.tenantId,
            groupe: g,
            accueil: accueil,
            userId: p.userId,
            code: codes.get(g.compteId)(),
        });
        issues.push({ groupeN, codeReconduit: pose.code, motif: pose.motif });
    }
    return issues;
}
async function reconduireLesAnciens(tx, p) {
    const messages = [];
    let codes = null;
    let compteDesCodes = null;
    for (const g of p.anciens) {
        const tete = `Lettrage partiel ${g.code} de l'exercice ouvert le ${g.exerciceDebut.toISOString().slice(0, 10)} (compte ${g.compteNumero}, ` +
            `reste ${(0, reconduction_lettrage_1.resteLisible)(g.reste)}), jamais reconduit dans l'exercice qui se clôture`;
        const accueil = g.etat === 'A_RECONDUIRE' ? g.accueil.map((id) => (id ? (p.accueilDe.get(id) ?? null) : null)) : [];
        if (g.etat !== 'A_RECONDUIRE' || accueil.some((a) => a === null)) {
            messages.push(`${tete} · ${(0, reconduction_lettrage_1.detailNonReconduit)(g)} · la clôture ne le suit pas dans l'exercice suivant · relettrez-y ses lignes à la main ` +
                'avant de régler la facture, qui s’y lirait due en entier.');
            continue;
        }
        if (compteDesCodes !== g.compteId) {
            codes = await (0, lettrage_service_1.prochaineLettreDuCompte)(tx, p.tenantId, g.compteId);
            compteDesCodes = g.compteId;
        }
        const pose = await (0, reconduction_lettrage_1.poserGroupeReconduit)(tx, {
            tenantId: p.tenantId,
            groupe: { id: g.lettrageId, code: g.code.toUpperCase(), compteId: g.compteId, ecartChange: g.ecartChange },
            accueil: accueil,
            userId: p.userId,
            code: codes(),
        });
        messages.push(pose.code
            ? `${tete} · ses lignes d'à-nouveau sont reportées et réunies par cette clôture dans l'exercice suivant (lettrage ${pose.code.toLowerCase()}).`
            : `${tete} · ${pose.motif} · relettrez ses lignes à la main dans l'exercice suivant avant de régler la facture.`);
    }
    return messages;
}
async function retirerANouveauProvisoire(tx, tenantId, exerciceId, options = {}) {
    const provisoire = await tx.ecriture.findFirst({
        where: { tenantId, exerciceId, estANouveauProvisoire: true },
        include: {
            lignes: {
                select: {
                    id: true,
                    compteId: true,
                    debit: true,
                    credit: true,
                    dateEcheance: true,
                    deviseId: true,
                    montantDevise: true,
                    lettre: true,
                    lettrageId: true,
                    rapprochementId: true,
                    ligneReleveId: true,
                },
            },
        },
    });
    if (!provisoire)
        return { numeroPiece: null, tenues: [] };
    const tenues = provisoire.lignes.filter((l) => (0, ligne_lettree_1.estTenueParUnLettrage)(l) || l.rapprochementId);
    if (tenues.length > 0 && !options.reporterLesTenues) {
        throw new common_1.BadRequestException("Des lignes du report à-nouveau provisoire ont été lettrées ou pointées sur le nouvel exercice · délettrez-les " +
            "(ou dépointez-les) avant de relancer le report. Le remplacer effacerait ce travail sans le dire. " +
            "La clôture de l'exercice précédent, elle, reporte ce lettrage sur l'à-nouveau définitif.");
    }
    const figees = tenues.length > 0 ? await (0, gel_cloture_1.lignesFigees)(tx, tenantId, tenues.map((l) => l.id)) : new Map();
    await tx.ligneEcriture.deleteMany({ where: { ecritureId: provisoire.id } });
    await tx.ecriture.delete({ where: { id: provisoire.id } });
    return {
        numeroPiece: provisoire.numeroPiece,
        tenues: tenues.map((l) => ({
            figee: figees.has(l.id),
            compteId: l.compteId,
            debit: Number(l.debit),
            credit: Number(l.credit),
            dateEcheance: l.dateEcheance,
            deviseId: l.deviseId,
            montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
            lettre: l.lettre,
            lettrageId: l.lettrageId,
            rapprochementId: l.rapprochementId,
            ligneReleveId: l.ligneReleveId,
        })),
    };
}
async function reporterLesTenues(tx, tenantId, exerciceSuivantId, tenues, candidates) {
    if (tenues.length === 0)
        return { messages: [], defaits: [] };
    const messages = [];
    const defaits = [];
    const cibles = (0, report_a_nouveau_1.apparierTenues)(tenues, candidates);
    const orphelins = new Map();
    const pointees = tenues.filter((t, i) => cibles[i] === null && t.rapprochementId);
    const rapprochements = pointees.length
        ? await tx.rapprochementBancaire.findMany({
            where: { tenantId, id: { in: pointees.map((t) => t.rapprochementId) } },
            select: { id: true, statut: true, dateReleve: true, compte: { select: { numero: true } } },
        })
        : [];
    const rapprochement = new Map(rapprochements.map((r) => [r.id, r]));
    const MOTIF = "ligne d'à-nouveau provisoire remplacée par la clôture sans équivalent sûr dans le report définitif";
    for (let i = 0; i < tenues.length; i++) {
        const t = tenues[i];
        const cible = cibles[i];
        if (cible) {
            await tx.ligneEcriture.update({
                where: { id: cible },
                data: { lettre: t.lettre, lettrageId: t.lettrageId, rapprochementId: t.rapprochementId, ligneReleveId: t.ligneReleveId },
            });
            continue;
        }
        if (t.rapprochementId) {
            const r = rapprochement.get(t.rapprochementId);
            const releve = r ? ` du relevé du ${r.dateReleve.toISOString().slice(0, 10)}` : '';
            defaits.push({ type: 'POINTAGE', compte: r?.compte.numero ?? null, releve: r?.dateReleve.toISOString().slice(0, 10) ?? null, montant: t.debit - t.credit, motif: MOTIF });
            messages.push(`Pointage défait · la ligne d'à-nouveau provisoire (${montantLisible(t)}) quitte le rapprochement${releve}` +
                `${r?.statut === client_1.StatutRapprochement.CLOTURE ? ' (clos)' : ''}, sans équivalent sûr dans le report définitif · pointez la ligne d'à-nouveau définitif s'il y a lieu.`);
        }
        if (t.lettrageId)
            orphelins.set(t.lettrageId, [...(orphelins.get(t.lettrageId) ?? []), t]);
    }
    if (cibles.some((c) => c !== null)) {
        messages.push(`${cibles.filter((c) => c !== null).length} ligne(s) lettrée(s) ou pointée(s) du report provisoire ont été reportées sur l'à-nouveau définitif, ` +
            'au même montant · leurs lettrages sont inchangés.');
    }
    const maintenant = new Date();
    for (const [lettrageId, lignes] of orphelins) {
        const groupe = await tx.lettrage.findFirst({
            where: { id: lettrageId, tenantId },
            select: { code: true, compteId: true, compte: { select: { numero: true, intitule: true } } },
        });
        const restantes = await tx.ligneEcriture.findMany({
            where: { lettrageId, ecriture: { tenantId } },
            select: { id: true, debit: true, credit: true, deviseId: true, montantDevise: true, ecriture: { select: { date: true } } },
        });
        await tx.ligneEcriture.updateMany({
            where: { lettrageId, ecriture: { tenantId } },
            data: { lettre: null, lettrageId: null, aRelettrerDepuis: maintenant },
        });
        if (groupe)
            await tx.lettrage.delete({ where: { id: lettrageId } });
        const decrites = restantes.map((l) => ({ date: l.ecriture.date.toISOString().slice(0, 10), montant: auCentime(Number(l.debit) - Number(l.credit)) }));
        defaits.push({ type: 'LETTRAGE', compte: groupe?.compte.numero ?? null, groupe: groupe?.code ?? null, ligneProvisoire: lignes[0].debit - lignes[0].credit, lignes: decrites, motif: MOTIF });
        let candidatesRelettrage = 0;
        for (const l of restantes) {
            const d = Number(l.debit);
            const c = Number(l.credit);
            candidatesRelettrage += await tx.ligneEcriture.count({
                where: {
                    compteId: groupe?.compteId,
                    lettrageId: null,
                    id: { notIn: restantes.map((x) => x.id) },
                    debit: c,
                    credit: d,
                    deviseId: l.deviseId,
                    ecriture: { tenantId, exerciceId: exerciceSuivantId, estANouveauProvisoire: false, ...ecritures_de_situation_1.HORS_SITUATION },
                },
            });
        }
        messages.push(`Lettrage ${groupe?.code ?? ''} DÉLETTRÉ par la clôture · compte ${groupe?.compte.numero ?? ''} ${groupe?.compte.intitule ?? ''}, ` +
            decrites.map((l) => `${l.montant < 0 ? 'paiement' : 'ligne'} du ${l.date} (${Math.abs(l.montant).toFixed(2)})`).join(', ') +
            ` · sa ligne d'à-nouveau provisoire (${montantLisible(lignes[0])}) n'a pas d'équivalent sûr dans le report définitif. À relettrer · ` +
            (candidatesRelettrage > 0
                ? `${candidatesRelettrage} ligne(s) de même montant proposée(s) au pré-lettrage, à confirmer.`
                : 'aucune ligne de même montant dans l’exercice suivant, lettrez-le à la main quand sa facture sera connue.'));
    }
    return { messages, defaits };
}
function montantLisible(t) {
    return t.debit > 0 ? `débit ${t.debit.toFixed(2)}` : `crédit ${t.credit.toFixed(2)}`;
}
const PLAFOND_LIGNES_OUVERTURE = 50_000;
const PLAFOND_ECARTS_SERVIS = 200;
async function ouvertureDejaPassee(tx, tenantId, exercice) {
    const filtre = (0, ouverture_passee_1.filtreOuverturePasseeAuPremierJour)(tenantId, exercice);
    const nombre = await tx.ligneEcriture.count({ where: { ecriture: filtre } });
    if (nombre > PLAFOND_LIGNES_OUVERTURE) {
        throw new common_1.BadRequestException(`Les écritures du premier jour de l'exercice suivant portent ${nombre.toLocaleString('fr-FR')} lignes, au-delà de ce que la clôture ` +
            `confronte en une fois (${PLAFOND_LIGNES_OUVERTURE.toLocaleString('fr-FR')}). Une confrontation amputée dirait concordant ce qui ne l'est pas · ` +
            'passez le bilan d’ouverture en mode Solde sur les comptes de tiers, ou contactez l’éditeur.');
    }
    if (nombre === 0) {
        return {
            ecritures: [],
            lignes: [],
            negatifsTardifs: [],
        };
    }
    const lues = await tx.ecriture.findMany({
        where: { ...filtre, tenantId },
        select: {
            id: true,
            numeroPiece: true,
            statut: true,
            date: true,
            dateValeur: true,
            corrigeEcritureId: true,
            journal: { select: { code: true } },
            reevaluationContrePassationDeclaree: {
                select: { annuleeLe: true, ecritureEcarts: { select: { lignes: { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } } } } },
            },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: PLAFOND_LIGNES_OUVERTURE,
    });
    const horsOuverture = (0, ouverture_passee_1.lignesDeContrePassationDeclaree)(lues);
    const pieceDe = new Map(lues.map((e) => [e.id, `${e.journal.code} n° ${e.numeroPiece ?? '·'}`]));
    const retenues = new Set();
    const lignes = [];
    await (0, lecture_par_lots_1.lireParLots)((curseur) => tx.ligneEcriture.findMany({
        where: { ecriture: filtre },
        select: {
            id: true,
            ecritureId: true,
            compteId: true,
            compte: { select: { numero: true } },
            debit: true,
            credit: true,
            libelle: true,
            dateEcheance: true,
            deviseId: true,
            montantDevise: true,
            coursApplique: true,
            lettrageId: true,
            rapprochementId: true,
        },
        ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
    }), (l) => {
        if (horsOuverture.get(l.ecritureId)?.has(l.compteId))
            return;
        retenues.add(l.ecritureId);
        lignes.push({
            id: l.id,
            compteId: l.compteId,
            numero: l.compte.numero,
            piece: pieceDe.get(l.ecritureId) ?? '·',
            debit: Number(l.debit),
            credit: Number(l.credit),
            libelle: l.libelle,
            dateEcheance: l.dateEcheance,
            deviseId: l.deviseId,
            montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
            coursApplique: l.coursApplique === null ? null : Number(l.coursApplique),
            lettrageId: l.lettrageId,
            rapprochementId: l.rapprochementId,
        });
    }, lecture_par_lots_1.LOT_LECTURE);
    const gardees = lues.filter((e) => !horsOuverture.has(e.id) || retenues.has(e.id));
    const ecritures = gardees.map(({ id, numeroPiece, statut, journal }) => ({ id, numeroPiece, statut, journal }));
    return { ecritures, lignes, negatifsTardifs: (0, ouverture_passee_1.negatifsTardifs)(gardees, exercice.dateDebut) };
}
exports.ACCORD_OUVERTURE_NON_RESSAISIE = 'en confirmant que l’ouverture annulée n’est pas ressaisie';
function issueOuvertureQuiSeDeplace(passee, accordNonRessaisie) {
    if (passee.ecritures.length === 0)
        return 'PASSE';
    if (passee.ecritures.some((e) => e.statut === client_1.StatutEcriture.BROUILLARD))
        return 'REFUS';
    if (!(0, report_a_nouveau_1.ouvertureNulle)(passee.lignes))
        return 'REFUS';
    return passee.negatifsTardifs.length > 0 && !accordNonRessaisie ? 'A_CONFIRMER' : 'PASSE';
}
function refusOuvertureAnnuleeHorsDuPremierJour(passee, premierJour) {
    return (`L'ouverture passée au ${(0, portefeuille_etat_1.jourFr)(premierJour)} (${piecesLisibles(passee.ecritures)}) se solde à zéro, mais son négatif est ` +
        `inscrit après ce jour (${(0, ouverture_passee_1.negatifsTardifsLisibles)(passee.negatifsTardifs)}). Si la position exacte a été ressaisie ce jour-là, ` +
        'elle resterait dans l’exercice, et le report que la clôture de l’exercice précédent passera au premier jour la compterait ' +
        'deux fois (AUDCIF art. 34) · inscrivez aussi cette ressaisie en négatif (AUDCIF art. 20, al. 2). Sinon, relancez le geste ' +
        `${exports.ACCORD_OUVERTURE_NON_RESSAISIE}.`);
}
function piecesLisibles(ecritures) {
    const noms = ecritures.slice(0, 5).map((e) => `${e.journal.code} n° ${e.numeroPiece ?? '·'}`);
    return noms.join(', ') + (ecritures.length > 5 ? ` et ${ecritures.length - 5} autre(s)` : '');
}
function libelleDuSens(referentiel, montant) {
    if (referentiel === client_1.Referentiel.SYCEBNL)
        return montant >= 0 ? 'excédent' : 'déficit';
    return montant >= 0 ? 'bénéfice' : 'perte';
}
function articleDuVirement(referentiel) {
    return referentiel === client_1.Referentiel.SYCEBNL
        ? 'SYCEBNL, Partie 2 ch. 3, compte 13'
        : 'AUDCIF, Titre VII, compte 13';
}
function articleCorrespondance(referentiel) {
    return referentiel === client_1.Referentiel.SYCEBNL ? 'SYCEBNL art. 16, 4)' : 'AUDCIF art. 34';
}
async function confrontationNommee(tx, tenantId, report, dejaPassee) {
    const ecarts = (0, report_a_nouveau_1.confrontationDeLOuverture)(report, dejaPassee.lignes);
    const comptesIds = [...new Set(ecarts.map((e) => e.compteId))];
    const devisesIds = [...new Set(ecarts.map((e) => e.deviseId).filter((d) => d !== null))];
    const [comptes, devises] = await Promise.all([
        comptesIds.length ? tx.compte.findMany({ where: { tenantId, id: { in: comptesIds } }, select: { id: true, numero: true, intitule: true } }) : [],
        devisesIds.length ? tx.devise.findMany({ where: { tenantId, id: { in: devisesIds } }, select: { id: true, code: true } }) : [],
    ]);
    const compte = new Map(comptes.map((c) => [c.id, c]));
    const devise = new Map(devises.map((d) => [d.id, d.code]));
    const nommes = ecarts.map((e) => ({
        compteId: e.compteId,
        numero: compte.get(e.compteId)?.numero ?? null,
        intitule: compte.get(e.compteId)?.intitule ?? null,
        devise: e.deviseId ? (devise.get(e.deviseId) ?? null) : null,
        cloture: e.cloture,
        ouverture: e.ouverture,
        clotureDevise: e.clotureDevise,
        ouvertureDevise: e.ouvertureDevise,
    }));
    const rectifies = new Set(comptesIds);
    const tenues = dejaPassee.lignes
        .filter((l) => rectifies.has(l.compteId) && (l.lettrageId !== null || l.rapprochementId !== null))
        .map((l) => ({ numero: l.numero, piece: l.piece, debit: l.debit, credit: l.credit, lettree: l.lettrageId !== null, pointee: l.rapprochementId !== null }));
    return { ecarts: nommes, tenues };
}
function positionLisible(e) {
    const enDevise = e.devise ? ` en ${e.devise} (clôture ${(e.clotureDevise ?? 0).toFixed(2)}, ouverture ${(e.ouvertureDevise ?? 0).toFixed(2)})` : '';
    return `${e.numero ?? '?'}${e.devise ? '' : ''} (clôture ${e.cloture.toFixed(2)}, ouverture ${e.ouverture.toFixed(2)})${enDevise}`;
}
function listeLisible(items, lire, n = 5) {
    return items.slice(0, n).map(lire).join(', ') + (items.length > n ? ` et ${items.length - n} autre(s)` : '');
}
function motifDeConservation(motifConservation) {
    const motif = (motifConservation ?? '').trim();
    if (motif.length < 3 || motif.length > 500) {
        throw new common_1.BadRequestException("Conserver l'ouverture déjà passée exige un motif écrit (3 à 500 caractères) · il dit pourquoi les livres légaux de cet " +
            "exercice ne sont pas ceux d'OmegaX, et il reste au journal d'audit.");
    }
    return motif;
}
function ecartsGardes(ecarts) {
    return {
        total: ecarts.length,
        tronque: ecarts.length > PLAFOND_ECARTS_SERVIS,
        ecarts: ecarts.slice(0, PLAFOND_ECARTS_SERVIS).map(({ compteId: _c, ...e }) => e),
    };
}
async function issueDeLOuverture(tx, p) {
    const { dejaPassee, referentiel } = p;
    const rien = { rectification: null, conservation: null };
    if (dejaPassee.ecritures.length === 0)
        return { ...rien, lignes: p.report, messages: [] };
    const pieces = piecesLisibles(dejaPassee.ecritures);
    const article = articleCorrespondance(referentiel);
    const auBrouillard = dejaPassee.ecritures.filter((e) => e.statut === client_1.StatutEcriture.BROUILLARD);
    if (auBrouillard.length > 0) {
        throw new common_1.BadRequestException(`L'exercice suivant porte au premier jour (ou en correction d'une écriture du premier jour) des écritures au brouillard (${piecesLisibles(auBrouillard)}) · une ouverture qui n'est pas ` +
            `le report d'OmegaX. Le bilan d'ouverture correspond au bilan de clôture de l'exercice précédent (${article}), et la clôture ` +
            "doit le confronter à ce qui est au livre-journal. Validez-les (fenêtre Brouillard), ou, s'il s'agit d'opérations de l'exercice, " +
            'supprimez-les ou redatez-les au lendemain, puis clôturez.');
    }
    if ((0, report_a_nouveau_1.ouvertureNulle)(dejaPassee.lignes)) {
        const tardifs = dejaPassee.negatifsTardifs;
        if (tardifs.length === 0 || p.report.length === 0) {
            return {
                ...rien,
                lignes: p.report,
                messages: [`Les écritures du premier jour de l'exercice suivant (${pieces}) se soldent à zéro sur chaque compte · le report entier est passé.`],
            };
        }
        const nommes = (0, ouverture_passee_1.negatifsTardifsLisibles)(tardifs);
        if (p.choix === 'RECTIFIER') {
            return {
                ...rien,
                lignes: p.report,
                messages: [
                    `Les écritures du premier jour de l'exercice suivant (${pieces}) sont annulées par leur négatif inscrit après le premier jour ` +
                        `(${nommes}), et déclarées non ressaisies · le report entier est passé (${article} ; AUDCIF art. 20, al. 2).`,
                ],
            };
        }
        if (p.choix === 'CONSERVER') {
            const motif = motifDeConservation(p.motifConservation);
            const { ecarts } = await confrontationNommee(tx, p.tenantId, p.report, dejaPassee);
            return {
                rectification: null,
                lignes: [],
                messages: [
                    `Les écritures du premier jour de l'exercice suivant (${pieces}) sont annulées par leur négatif inscrit après le premier jour ` +
                        `(${nommes}) · leur position exacte est déclarée ressaisie dans l'exercice, aucun report n'est passé, et le contrôle de ` +
                        "l'exercice suivant le rappellera.",
                ],
                conservation: {
                    motif,
                    ecarts: {
                        ...ecartsGardes(ecarts),
                        negatifsTardifs: tardifs.map((t) => ({ piece: t.piece, date: t.date.toISOString().slice(0, 10) })),
                    },
                },
            };
        }
        throw new common_1.BadRequestException(`Les écritures du premier jour de l'exercice suivant (${pieces}) se soldent à zéro, mais leur négatif est inscrit après le ` +
            `premier jour (${nommes}) · OmegaX ne sait pas si la position exacte de l'ouverture a été ressaisie ce jour-là, hors du ` +
            `premier jour. Le bilan d'ouverture correspond au bilan de clôture (${article}), et le report passé par-dessus une ` +
            'ressaisie compterait l’ouverture deux fois. Déclarez-le · « Conserver » avec son motif si la position exacte a été ' +
            'ressaisie (rien n’est passé, la ressaisie fait l’ouverture) ; « Rectifier » si elle ne l’a pas été (le report entier ' +
            'est passé, AUDCIF art. 20, al. 2).');
    }
    const { ecarts, tenues } = await confrontationNommee(tx, p.tenantId, p.report, dejaPassee);
    if (ecarts.length === 0) {
        return {
            ...rien,
            lignes: [],
            messages: [`L'ouverture déjà passée dans l'exercice suivant (${pieces}) correspond au bilan de clôture, par compte et par devise · aucun report n'est ajouté.`],
        };
    }
    const ecrituresDeN = await tx.ecriture.count({
        where: { tenantId: p.tenantId, exerciceId: p.exerciceId, estSoldeDesComptesDeGestion: false, ...ecritures_de_situation_1.HORS_SITUATION },
    });
    if (ecrituresDeN === 0) {
        return {
            ...rien,
            lignes: [],
            messages: [`Cet exercice ne porte aucune écriture · il n'a rien à reporter, et l'ouverture déjà passée dans l'exercice suivant (${pieces}) fait foi.`],
        };
    }
    const detail = listeLisible(ecarts, positionLisible);
    if (p.choix === 'RECTIFIER') {
        const rectification = (0, report_a_nouveau_1.rectificationDeLOuverture)(p.report, dejaPassee.lignes);
        const messages = [
            `L'ouverture déjà passée dans l'exercice suivant (${pieces}) différait du bilan de clôture sur ${ecarts.length} position(s) · ` +
                `ses lignes y sont inscrites en négatif et le report exact est passé (${article} ; AUDCIF art. 20). Les autres comptes gardent leur ouverture.`,
        ];
        if (tenues.length > 0) {
            messages.push(`Lignes inscrites en négatif alors qu'elles sont lettrées ou pointées (elles le restent, leur négatif reste ouvert) · ` +
                listeLisible(tenues, (t) => `${t.numero} ${t.piece} ${montantLisible(t)}${t.lettree ? ', lettrée' : ''}${t.pointee ? ', pointée' : ''}`) +
                '.');
        }
        return { rectification, lignes: rectification.lignes, messages, conservation: null };
    }
    if (p.choix === 'CONSERVER') {
        const motif = motifDeConservation(p.motifConservation);
        return {
            rectification: null,
            lignes: [],
            messages: [
                `L'ouverture déjà passée dans l'exercice suivant (${pieces}) est conservée, déclarée faire foi · elle diffère du bilan de clôture ` +
                    `d'OmegaX sur ${ecarts.length} position(s) (${detail}), aucun report n'est passé, et le contrôle de l'exercice suivant le rappellera.`,
            ],
            conservation: { motif, ecarts: ecartsGardes(ecarts) },
        };
    }
    throw new common_1.BadRequestException(`L'exercice suivant porte déjà une ouverture (${pieces}) qui diffère du bilan de clôture de cet exercice sur ${ecarts.length} ` +
        `position(s) · ${detail}. Les deux doivent correspondre (${article}), et OmegaX ne sait pas lequel est faux. Déclarez-le · ` +
        "« Rectifier l'import » si les livres de cet exercice sont tenus dans OmegaX (l'ouverture est inscrite en négatif là où elle diffère, " +
        "puis le report exact est passé, AUDCIF art. 20), ou « Conserver l'import » avec son motif si cet exercice n'y est tenu que pour " +
        'les comparatifs (rien n’est passé).' +
        (dejaPassee.negatifsTardifs.length > 0
            ? ` Négatif(s) inscrit(s) après le premier jour · ${(0, ouverture_passee_1.negatifsTardifsLisibles)(dejaPassee.negatifsTardifs)} ; si la position ` +
                'exacte a été ressaisie ce jour-là, « Rectifier l’import » la compterait deux fois.'
            : ''));
}
async function lettrerNegatifsAvecLeursOrigines(tx, tenantId, userId, negatifs, lignesCreees) {
    const origines = negatifs.map((n) => n.origine).filter((o) => o.id && o.lettrageId === null && o.rapprochementId === null);
    if (origines.length === 0)
        return [];
    const lettrables = new Set((await tx.compte.findMany({ where: { tenantId, id: { in: [...new Set(origines.map((o) => o.compteId))] }, lettrable: true }, select: { id: true } })).map((c) => c.id));
    const prises = new Set();
    const paires = [];
    for (const o of origines) {
        if (!lettrables.has(o.compteId))
            continue;
        const n = lignesCreees.find((l) => !prises.has(l.id) && l.compteId === o.compteId && Math.abs(l.debit + o.debit) <= EPSILON && Math.abs(l.credit + o.credit) <= EPSILON);
        if (!n)
            continue;
        prises.add(n.id);
        paires.push({ compteId: o.compteId, ids: [o.id, n.id] });
    }
    const figees = await (0, gel_cloture_1.lignesFigees)(tx, tenantId, paires.flatMap((p) => p.ids));
    const libres = paires.filter((p) => !p.ids.some((id) => figees.has(id)));
    const codeSuivant = new Map();
    let posees = 0;
    for (const p of libres) {
        if (!codeSuivant.has(p.compteId))
            codeSuivant.set(p.compteId, await (0, lettrage_service_1.prochaineLettreDuCompte)(tx, tenantId, p.compteId));
        if (await (0, lettrage_service_1.poserGroupeSoldeDuModule)(tx, { tenantId, compteId: p.compteId, ligneIds: p.ids, userId, code: codeSuivant.get(p.compteId)() }))
            posees++;
    }
    const messages = [];
    if (posees > 0)
        messages.push(`${posees} ligne(s) d'ouverture lettrée(s) avec leur inscription en négatif.`);
    if (paires.length > libres.length) {
        messages.push(`${paires.length - libres.length} paire(s) ligne d'ouverture et négatif non lettrée(s) · une clôture fige le premier jour.`);
    }
    return messages;
}
function refuserSiPeriodeClose(clotures, journalId, date) {
    for (const c of clotures) {
        if (c.granularite === client_1.GranulariteCloture.TOTALE && c.journalId === journalId && date <= c.dateLimite) {
            throw new common_1.ForbiddenException(`Ce journal est clôturé totalement jusqu'au ${c.dateLimite.toISOString().slice(0, 10)} · aucune écriture n'y est plus possible à cette date. ` +
                AIDE_REPORT_ART_22);
        }
        if (c.granularite === client_1.GranulariteCloture.PARTIELLE && c.journalId === journalId && date <= c.dateLimite) {
            throw new common_1.ForbiddenException(`Ce journal est clôturé partiellement jusqu'au ${c.dateLimite.toISOString().slice(0, 10)} · aucune écriture ne peut plus y être datée à cette période ou avant. ` +
                AIDE_REPORT_ART_22);
        }
        if (c.granularite === client_1.GranulariteCloture.PERIODE && date <= c.dateLimite) {
            throw new common_1.ForbiddenException(`La période jusqu'au ${c.dateLimite.toISOString().slice(0, 10)} est clôturée pour tous les journaux. ` +
                AIDE_REPORT_ART_22);
        }
    }
}
async function lireEtatAvantArret(client, tenantId, exercice, dossier) {
    const dissolution = dossier.dateDissolution;
    const sans = (0, liquidation_societe_1.sansLiquidation)({
        forme: dossier.formeJuridiqueSyscohada,
        regimeLiquidation: dossier.regimeLiquidation,
        associeUniquePersonneMorale: dossier.associeUniquePersonneMorale,
    });
    const [posterieurs, aDeplacer] = await Promise.all([
        client.exercice.findMany({
            where: { tenantId, dateDebut: { gt: exercice.dateFin } },
            orderBy: { dateDebut: 'asc' },
            select: { id: true, dateDebut: true, dateFin: true, statut: true },
        }),
        dissolution
            ? client.ecriture.findMany({
                where: { tenantId, exerciceId: exercice.id, date: { gt: dissolution } },
                select: { id: true, date: true, numeroPiece: true, journal: { select: { code: true } } },
                orderBy: [{ date: 'asc' }, { id: 'asc' }],
            })
            : Promise.resolve([]),
    ]);
    const changent = [exercice, ...(!sans && posterieurs.length === 1 ? [posterieurs[0]] : [])];
    const actes = await lireActesDeLaPeriode(client, tenantId, changent);
    const occupations = sans ? await Promise.all(posterieurs.map((p) => usagesDeLExercice(client, tenantId, p.id))) : [];
    const etat = {
        exercice: { dateDebut: exercice.dateDebut, dateFin: exercice.dateFin, clos: exercice.statut === client_1.StatutExercice.CLOTURE },
        dissolution,
        posterieurs: posterieurs.map((p, i) => ({
            dateDebut: p.dateDebut,
            dateFin: p.dateFin,
            clos: p.statut === client_1.StatutExercice.CLOTURE,
            usages: occupations[i] ?? null,
        })),
        sansLiquidation: sans,
        ecrituresApres: aDeplacer.length,
        actesDeLaPeriode: actes,
    };
    return { etat, posterieurs, aDeplacer, actes };
}
const CLE_IMPRESSION_VERS_EXERCICE = 'ImpressionJournal.exerciceId';
async function usagesDeLExercice(client, tenantId, exerciceId) {
    const [references, provisoires] = await Promise.all([
        (0, references_1.referencesVers)(client, 'Exercice', exerciceId, tenantId, [CLE_IMPRESSION_VERS_EXERCICE]),
        client.ecriture.count({ where: { tenantId, exerciceId, estANouveauProvisoire: true } }),
    ]);
    const reelles = references
        .map((r) => (r.modele === 'Ecriture' && r.champ === 'exerciceId' ? { ...r, nombre: r.nombre - provisoires } : r))
        .filter((r) => r.nombre > 0);
    return reelles.length ? reelles.map(references_1.libelleReference).join(', ') : null;
}
async function relevesUnitesOeuvre(client, tenantId, exerciceIds) {
    const releves = await client.consommationUniteOeuvre.findMany({
        where: { tenantId, exerciceId: { in: exerciceIds } },
        select: { unitesConsommees: true, immobilisation: { select: { designation: true } }, exercice: { select: { dateDebut: true, dateFin: true } } },
        orderBy: { id: 'asc' },
        take: 200,
    });
    return releves.map((r) => `${r.immobilisation.designation} · ${Number(r.unitesConsommees)} unités relevées sur l'exercice ${periodeLisible(r.exercice)}, ` +
        'à ressaisir pour sa période nouvelle');
}
async function lireActesDeLaPeriode(client, tenantId, exercices) {
    const delegues = client;
    const periodes = new Map(exercices.map((e) => [e.id, periodeLisible(e)]));
    const ids = exercices.map((e) => e.id);
    const lus = [];
    for (const acte of arret_dissolution_1.ACTES_DE_LA_PERIODE) {
        const borne = acte.parLeBien ? { immobilisation: { tenantId } } : { tenantId };
        const lignes = await delegues[acte.modele].findMany({
            where: { ...borne, exerciceId: { in: ids }, ...(acte.actif ?? {}) },
            orderBy: { id: 'asc' },
        });
        for (const ligne of lignes)
            lus.push({ acte, ligne });
    }
    if (lus.length === 0)
        return [];
    const ecritureIds = [...new Set(lus.map((l) => l.ligne[l.acte.colonne]).filter((v) => typeof v === 'string'))];
    const bienIds = [...new Set(lus.map((l) => l.ligne.immobilisationId).filter((v) => typeof v === 'string'))];
    const [ecritures, biens] = await Promise.all([
        ecritureIds.length
            ? client.ecriture.findMany({
                where: { tenantId, id: { in: ecritureIds } },
                select: { id: true, statut: true, numeroPiece: true, journal: { select: { code: true } } },
            })
            : Promise.resolve([]),
        bienIds.length
            ? client.immobilisation.findMany({ where: { tenantId, id: { in: bienIds } }, select: { id: true, statut: true } })
            : Promise.resolve([]),
    ]);
    const parEcriture = new Map(ecritures.map((e) => [e.id, e]));
    const sortis = new Set(biens.filter((b) => b.statut !== client_1.StatutImmobilisation.EN_SERVICE).map((b) => b.id));
    return lus.map(({ acte, ligne }) => {
        const ecritureId = typeof ligne[acte.colonne] === 'string' ? ligne[acte.colonne] : null;
        const e = ecritureId ? parEcriture.get(ecritureId) : undefined;
        const bienSorti = typeof ligne.immobilisationId === 'string' && sortis.has(ligne.immobilisationId);
        const auBrouillard = !e || e.statut === client_1.StatutEcriture.BROUILLARD;
        return {
            modele: acte.modele,
            id: ligne.id,
            libelle: acte.libelle,
            piece: e ? `${e.journal.code} n° ${e.numeroPiece ?? '·'}` : 'sans écriture',
            periode: periodes.get(String(ligne.exerciceId)) ?? '·',
            retirable: !!acte.retirable && !bienSorti,
            ecritureId,
            issue: (0, arret_dissolution_1.issueActeDeLaPeriode)(acte, { auBrouillard, bienSorti }),
        };
    });
}
async function rattacherALExercice(tx, tenantId, r) {
    for (const e of r.ecritures) {
        await tx.ecriture.update({ where: { id: e.id }, data: { exerciceId: r.vers } });
    }
    const piece = new Map(r.ecritures.map((e) => [e.id, `${e.journal.code} n° ${e.numeroPiece ?? '·'}`]));
    const ids = r.ecritures.map((e) => e.id);
    let actes = 0;
    const client = tx;
    for (let i = 0; i < ids.length; i += 1000) {
        const tranche = ids.slice(i, i + 1000);
        for (const acte of arret_dissolution_1.ACTES_QUI_SUIVENT_LEUR_ECRITURE) {
            const delegue = client[acte.modele];
            const borne = acte.parLeBien ? { immobilisation: { tenantId } } : { tenantId };
            const lignes = await delegue.findMany({ where: { ...borne, exerciceId: r.depuis, [acte.colonne]: { in: tranche } } });
            for (const ligne of lignes) {
                if (acte.unicite) {
                    const deja = await delegue.findFirst({
                        where: { ...borne, exerciceId: r.vers, ...Object.fromEntries(acte.unicite.map((c) => [c, ligne[c]])) },
                        select: { id: true },
                    });
                    if (deja) {
                        throw new common_1.BadRequestException((0, arret_dissolution_1.motifActeQuiNePeutSuivre)(acte, piece.get(String(ligne[acte.colonne])) ?? '·'));
                    }
                }
                await delegue.update({ where: { id: ligne.id }, data: { exerciceId: r.vers } });
                actes++;
            }
        }
    }
    for (const acte of arret_dissolution_1.ACTES_DATES_QUI_SUIVENT_LEUR_DATE) {
        const delegue = client[acte.modele];
        const lignes = await delegue.findMany({ where: { tenantId, exerciceId: r.depuis, [acte.colonne]: r.dates } });
        for (const ligne of lignes) {
            if (acte.unicite) {
                const deja = await delegue.findFirst({
                    where: { tenantId, exerciceId: r.vers, ...Object.fromEntries(acte.unicite.map((c) => [c, ligne[c]])) },
                    select: { id: true },
                });
                if (deja) {
                    throw new common_1.BadRequestException(`L'${acte.libelle} « ${String(ligne.reference ?? '·')} » du ${(0, portefeuille_etat_1.jourFr)(ligne[acte.colonne])} doit suivre sa ` +
                        'date dans l’autre exercice, qui en porte déjà un sous la même référence · renommez l’un des deux, puis relancez.');
                }
            }
            await delegue.update({ where: { id: ligne.id }, data: { exerciceId: r.vers } });
            actes++;
        }
    }
    const clotures = await tx.cloture.findMany({
        where: { tenantId, exerciceId: r.depuis, ...r.clotures },
        select: { id: true },
    });
    for (const c of clotures) {
        await tx.cloture.update({ where: { id: c.id }, data: { exerciceId: r.vers } });
    }
    return { ecrituresRattachees: r.ecritures.length, actesRattaches: actes, cloturesRattachees: clotures.length };
}
//# sourceMappingURL=exercice.service.js.map