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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportController = void 0;
const common_1 = require("@nestjs/common");
const recherche_ecritures_1 = require("../comptabilite/recherche-ecritures");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const export_service_1 = require("./export.service");
const envoi_en_flux_1 = require("./envoi-en-flux");
const export_fpm_service_1 = require("./export-fpm.service");
const paiements_en_instance_1 = require("../etats-financiers/paiements-en-instance");
const exercice_requis_1 = require("../../common/exercice-requis");
const journal_du_dossier_1 = require("../../common/journal-du-dossier");
const compte_du_dossier_1 = require("../../common/compte-du-dossier");
const client_2 = require("@prisma/client");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const extraits_periode_service_1 = require("./extraits-periode/extraits-periode.service");
function envoyerXlsx(res, classeur) {
    res.set({
        'Content-Type': envoi_en_flux_1.TYPE_XLSX,
        'Content-Disposition': `attachment; filename="${classeur.nomFichier}"`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.send(classeur.buffer);
}
function formatOuRefus(format) {
    if (format === undefined || format === '' || format === 'fpm')
        return 'fpm';
    if (format === 'plat')
        return 'plat';
    throw new common_1.BadRequestException('Format du grand livre inconnu · « fpm » (présentation du cabinet) ou « plat ».');
}
function grandsLivresOuRefus(valeur) {
    if (valeur === undefined || valeur === '' || valeur === 'oui')
        return true;
    if (valeur === 'non')
        return false;
    throw new common_1.BadRequestException('Paramètre grandsLivres · « oui » ou « non ».');
}
let ExportController = class ExportController {
    constructor(exportService, exportFpm, ecritureService, extraits) {
        this.exportService = exportService;
        this.exportFpm = exportFpm;
        this.ecritureService = ecritureService;
        this.extraits = extraits;
    }
    async journal(user, res, exerciceId, journalId, dateDebut, dateFin, recherche, compte, montant, montantMax, numeroPiece, reference, inclureBrouillard) {
        const criteres = (0, recherche_ecritures_1.criteresOuRefus)({ compte, montant, montantMax, numeroPiece, reference });
        await (0, envoi_en_flux_1.envoyerXlsxEnFlux)(res, (ouvrir) => this.exportService.journalExcelEnFlux(user.tenantId, {
            exerciceId,
            journalId,
            dateDebut,
            dateFin,
            recherche,
            inclureBrouillard: inclureBrouillard !== 'false',
            ...criteres,
        }, ouvrir, user.userId));
    }
    async grandLivreComplet(user, res, exerciceId, format, du, au, compteId) {
        const presentation = formatOuRefus(format);
        const periode = await this.ecritureService.periodeDemandee(user.tenantId, exerciceId, { du, au });
        if (presentation === 'plat' && (periode || compteId)) {
            throw new common_1.BadRequestException("Le grand livre « à plat » couvre l'exercice entier · un extrait de période, ou le grand livre d'un seul compte, s'exporte dans la présentation du cabinet.");
        }
        if (presentation === 'plat') {
            await (0, envoi_en_flux_1.envoyerXlsxEnFlux)(res, (ouvrir) => this.exportService.grandLivreCompletExcelEnFlux(user.tenantId, exerciceId, ouvrir));
            return;
        }
        if (!periode) {
            await (0, envoi_en_flux_1.envoyerXlsxEnFlux)(res, (ouvrir) => this.exportFpm.grandLivreEnFlux(user.tenantId, exerciceId, ouvrir, { compteId }));
            return;
        }
        const libelle = await this.extraits.libelleDe(user.tenantId, client_2.NatureExtraitPeriode.GRAND_LIVRE, { compteId });
        await this.extraits.refuserSiVide(user.tenantId, exerciceId, periode, compteId);
        await (0, envoi_en_flux_1.envoyerXlsxEnFlux)(res, (ouvrir) => this.extraits.produire({ tenantId: user.tenantId, nature: client_2.NatureExtraitPeriode.GRAND_LIVRE, libelle, periode, etabliPar: user.userId }, (numeroter) => this.exportFpm.grandLivreEnFlux(user.tenantId, exerciceId, ouvrir, { extrait: { periode, numeroter }, compteId })));
    }
    async grandLivreTiers(user, res, exerciceId, type) {
        const famille = (0, export_fpm_service_1.familleOuRefus)(type);
        await (0, envoi_en_flux_1.envoyerXlsxEnFlux)(res, (ouvrir) => this.exportFpm.grandLivreTiersEnFlux(user.tenantId, exerciceId, famille, ouvrir));
    }
    async grandLivre(user, compteId, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.grandLivreExcel(user.tenantId, compteId, exerciceId));
    }
    async balance(user, res, exerciceId, grandsLivres, du, au) {
        const avec = grandsLivresOuRefus(grandsLivres);
        const periode = await this.ecritureService.periodeDemandee(user.tenantId, exerciceId, { du, au });
        if (!periode) {
            await (0, envoi_en_flux_1.envoyerXlsxEnFlux)(res, (ouvrir) => this.exportFpm.balanceGeneraleEnFlux(user.tenantId, exerciceId, avec, ouvrir));
            return;
        }
        const libelle = await this.extraits.libelleDe(user.tenantId, client_2.NatureExtraitPeriode.BALANCE, { avecGrandsLivres: avec });
        await this.extraits.refuserSiVide(user.tenantId, exerciceId, periode);
        await (0, envoi_en_flux_1.envoyerXlsxEnFlux)(res, (ouvrir) => this.extraits.produire({ tenantId: user.tenantId, nature: client_2.NatureExtraitPeriode.BALANCE, libelle, periode, etabliPar: user.userId }, (numeroter) => this.exportFpm.balanceGeneraleEnFlux(user.tenantId, exerciceId, avec, ouvrir, { periode, numeroter })));
    }
    async balanceAuxiliaire(user, res, exerciceId, type, grandsLivres) {
        const famille = (0, export_fpm_service_1.familleOuRefus)(type);
        const avec = grandsLivresOuRefus(grandsLivres);
        await (0, envoi_en_flux_1.envoyerXlsxEnFlux)(res, (ouvrir) => this.exportFpm.balanceTiersEnFlux(user.tenantId, exerciceId, famille, avec, ouvrir));
    }
    async balanceAgee(user, res, exerciceId, dateReference, type) {
        envoyerXlsx(res, await this.exportService.balanceAgeeExcel(user.tenantId, exerciceId, { dateReference, type }));
    }
    async justificatifSolde(user, res, compteId, exerciceId, dateArret, masquerLettrees) {
        envoyerXlsx(res, await this.exportService.justificatifSoldeExcel(user.tenantId, compteId, exerciceId, {
            dateArret,
            masquerLettrees: masquerLettrees === 'true',
        }));
    }
    async evolutionSoldes(user, res, nbExercices) {
        envoyerXlsx(res, await this.exportService.evolutionSoldesExcel(user.tenantId, nbExercices ? Number(nbExercices) : undefined));
    }
    async tableauImmobilisations(user, res, dateArret) {
        envoyerXlsx(res, await this.exportService.tableauImmobilisationsExcel(user.tenantId, dateArret));
    }
    async tableauAmortissements(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.tableauAmortissementsExcel(user.tenantId, exerciceId));
    }
    async tableauxImmobilisations(user, res, exerciceId, dateArret) {
        envoyerXlsx(res, await this.exportService.tableauxImmobilisationsExcel(user.tenantId, exerciceId, dateArret));
    }
    async liasseComplete(user, res, exerciceId, paiementsEnInstance) {
        const paiements = (0, paiements_en_instance_1.lirePaiementsEnInstance)(paiementsEnInstance);
        envoyerXlsx(res, await this.exportService.liasseCompleteExcel(user.tenantId, exerciceId, paiements));
    }
    async bilan(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.bilanExcel(user.tenantId, exerciceId));
    }
    async compteDeResultat(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.compteDeResultatExcel(user.tenantId, exerciceId));
    }
    async tableauFluxTresorerie(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.tableauFluxTresorerieExcel(user.tenantId, exerciceId));
    }
    async bilanProjet(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.bilanProjetExcel(user.tenantId, exerciceId));
    }
    async compteExploitationProjet(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.compteExploitationProjetExcel(user.tenantId, exerciceId));
    }
    async noteBailleur(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.noteBailleurExcel(user.tenantId, exerciceId));
    }
    async emploisRessources(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.emploisRessourcesExcel(user.tenantId, exerciceId));
    }
    async executionBudgetaire(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.executionBudgetaireExcel(user.tenantId, exerciceId));
    }
    async reconciliationTresorerie(user, res, exerciceId, paiementsEnInstance) {
        const paiements = (0, paiements_en_instance_1.lirePaiementsEnInstance)(paiementsEnInstance);
        envoyerXlsx(res, await this.exportService.reconciliationTresorerieExcel(user.tenantId, exerciceId, paiements));
    }
    async bilanSmt(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.bilanSmtExcel(user.tenantId, exerciceId));
    }
    async compteDeResultatSmt(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.compteDeResultatSmtExcel(user.tenantId, exerciceId));
    }
    async journalTresorerieSmt(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.journalTresorerieSmtExcel(user.tenantId, exerciceId));
    }
    async notesSmt(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.notesSmtExcel(user.tenantId, exerciceId));
    }
    async eligibiliteSmt(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.eligibiliteSmtExcel(user.tenantId, exerciceId));
    }
    async notesAssociations(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.notesAssociationsExcel(user.tenantId, exerciceId));
    }
    async registreDonateurs(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.registreDonateursExcel(user.tenantId, exerciceId));
    }
    async testEcrituresJournal(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.testEcrituresJournalExcel(user.tenantId, exerciceId));
    }
    async livreInventaire(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.livreInventaireExcel(user.tenantId, exerciceId));
    }
    async rapportActivite(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.rapportActiviteExcel(user.tenantId, exerciceId));
    }
    async notesProjet(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.notesProjetExcel(user.tenantId, exerciceId));
    }
    async liasseCompleteSyscohada(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.liasseCompleteExcel(user.tenantId, exerciceId));
    }
    async bilanSyscohada(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.bilanSyscohadaExcel(user.tenantId, exerciceId));
    }
    async compteDeResultatSyscohada(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.compteDeResultatSyscohadaExcel(user.tenantId, exerciceId));
    }
    async tableauFluxTresorerieSyscohada(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.tableauFluxTresorerieSyscohadaExcel(user.tenantId, exerciceId));
    }
    async notesSyscohada(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.notesSyscohadaExcel(user.tenantId, exerciceId));
    }
    async bilanSmtSyscohada(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.bilanSmtSyscohadaExcel(user.tenantId, exerciceId));
    }
    async compteDeResultatSmtSyscohada(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.compteDeResultatSmtSyscohadaExcel(user.tenantId, exerciceId));
    }
    async journalTresorerieSmtSyscohada(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.journalTresorerieSmtSyscohadaExcel(user.tenantId, exerciceId));
    }
    async notesSmtSyscohada(user, res, exerciceId) {
        envoyerXlsx(res, await this.exportService.notesSmtSyscohadaExcel(user.tenantId, exerciceId));
    }
};
exports.ExportController = ExportController;
__decorate([
    (0, common_1.Get)('journal'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_FACULTATIF)),
    __param(3, (0, common_1.Query)('journalId', journal_du_dossier_1.JOURNAL_FACULTATIF)),
    __param(4, (0, common_1.Query)('dateDebut')),
    __param(5, (0, common_1.Query)('dateFin')),
    __param(6, (0, common_1.Query)('recherche')),
    __param(7, (0, common_1.Query)('compte')),
    __param(8, (0, common_1.Query)('montant')),
    __param(9, (0, common_1.Query)('montantMax')),
    __param(10, (0, common_1.Query)('numeroPiece')),
    __param(11, (0, common_1.Query)('reference')),
    __param(12, (0, common_1.Query)('inclureBrouillard')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "journal", null);
__decorate([
    (0, common_1.Get)('grand-livre'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('format')),
    __param(4, (0, common_1.Query)('du')),
    __param(5, (0, common_1.Query)('au')),
    __param(6, (0, common_1.Query)('compteId', compte_du_dossier_1.COMPTE_FACULTATIF)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "grandLivreComplet", null);
__decorate([
    (0, common_1.Get)('grand-livre-tiers'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "grandLivreTiers", null);
__decorate([
    (0, common_1.Get)('grand-livre/:compteId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId')),
    __param(2, (0, common_1.Res)()),
    __param(3, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "grandLivre", null);
__decorate([
    (0, common_1.Get)('balance'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('grandsLivres')),
    __param(4, (0, common_1.Query)('du')),
    __param(5, (0, common_1.Query)('au')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "balance", null);
__decorate([
    (0, common_1.Get)('balance-auxiliaire'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('type')),
    __param(4, (0, common_1.Query)('grandsLivres')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "balanceAuxiliaire", null);
__decorate([
    (0, common_1.Get)('balance-agee'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('dateReference')),
    __param(4, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "balanceAgee", null);
__decorate([
    (0, common_1.Get)('justificatif-solde/:compteId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Param)('compteId')),
    __param(3, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(4, (0, common_1.Query)('dateArret')),
    __param(5, (0, common_1.Query)('masquerLettrees')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "justificatifSolde", null);
__decorate([
    (0, common_1.Get)('evolution-soldes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('nbExercices')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "evolutionSoldes", null);
__decorate([
    (0, common_1.Get)('tableau-immobilisations'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('dateArret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "tableauImmobilisations", null);
__decorate([
    (0, common_1.Get)('tableau-amortissements'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "tableauAmortissements", null);
__decorate([
    (0, common_1.Get)('tableaux-immobilisations'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('dateArret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "tableauxImmobilisations", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/liasse-complete'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('paiementsEnInstance')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "liasseComplete", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/bilan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "bilan", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/compte-de-resultat'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "compteDeResultat", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/tableau-flux-tresorerie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "tableauFluxTresorerie", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/projet/bilan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "bilanProjet", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/projet/compte-exploitation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "compteExploitationProjet", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/projet/note-bailleur'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "noteBailleur", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/projet/emplois-ressources'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "emploisRessources", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/projet/execution-budgetaire'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "executionBudgetaire", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/projet/reconciliation-tresorerie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('paiementsEnInstance')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "reconciliationTresorerie", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/smt/bilan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "bilanSmt", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/smt/compte-de-resultat'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "compteDeResultatSmt", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/smt/journal-tresorerie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "journalTresorerieSmt", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/smt/notes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "notesSmt", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('etats-financiers/smt/eligibilite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "eligibiliteSmt", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('notes-annexes/associations'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "notesAssociations", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('registre-donateurs'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "registreDonateurs", null);
__decorate([
    (0, common_1.Get)('test-ecritures-journal'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "testEcrituresJournal", null);
__decorate([
    (0, common_1.Get)('livre-inventaire'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "livreInventaire", null);
__decorate([
    (0, common_1.Get)('rapport-activite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "rapportActivite", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('notes-annexes/projet'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "notesProjet", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Get)('etats-financiers-syscohada/liasse-complete'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "liasseCompleteSyscohada", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Get)('etats-financiers-syscohada/bilan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "bilanSyscohada", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Get)('etats-financiers-syscohada/compte-de-resultat'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "compteDeResultatSyscohada", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Get)('etats-financiers-syscohada/tableau-flux-tresorerie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "tableauFluxTresorerieSyscohada", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Get)('etats-financiers-syscohada/notes-annexes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "notesSyscohada", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Get)('etats-financiers-syscohada/smt/bilan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "bilanSmtSyscohada", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Get)('etats-financiers-syscohada/smt/compte-de-resultat'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "compteDeResultatSmtSyscohada", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Get)('etats-financiers-syscohada/smt/journal-tresorerie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "journalTresorerieSmtSyscohada", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Get)('etats-financiers-syscohada/smt/notes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "notesSmtSyscohada", null);
exports.ExportController = ExportController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, common_1.Controller)('exports'),
    __metadata("design:paramtypes", [export_service_1.ExportService,
        export_fpm_service_1.ExportFpmService,
        ecriture_service_1.EcritureService,
        extraits_periode_service_1.ExtraitsPeriodeService])
], ExportController);
//# sourceMappingURL=export.controller.js.map