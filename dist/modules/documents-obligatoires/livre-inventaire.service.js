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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LivreInventaireService = void 0;
exports.fondementInventaire = fondementInventaire;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const etats_financiers_service_1 = require("../etats-financiers/etats-financiers.service");
const etats_financiers_projet_service_1 = require("../etats-financiers/etats-financiers-projet.service");
const etats_financiers_smt_service_1 = require("../etats-financiers/etats-financiers-smt.service");
const etats_financiers_projet_budget_service_1 = require("../etats-financiers/etats-financiers-projet-budget.service");
const correspondance_inventaire_1 = require("./correspondance-inventaire");
const correspondance_inventaire_syscohada_1 = require("./correspondance-inventaire-syscohada");
const etats_financiers_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.service");
const etats_financiers_smt_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-smt-syscohada.service");
const inventaire_service_1 = require("../inventaire/inventaire.service");
function fondementInventaire(tenant) {
    const sanction = inventaire_service_1.InventaireService.sanctionApplicable(tenant.referentiel);
    const sanctionTexte = `${sanction.texte}, ${sanction.article}`;
    if (tenant.referentiel === client_1.Referentiel.SYSCOHADA) {
        return {
            article: 'AUDCIF art. 19',
            perimetre: tenant.systemeComptableSyscohada === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE
                ? 'Système minimal de trésorerie.'
                : 'Système normal.',
            sanction: sanctionTexte,
        };
    }
    switch (tenant.jeuEtatsFinanciersSycebnl) {
        case client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT:
            return {
                article: 'Art. 14, point 2',
                perimetre: 'Entités ayant pour objet la gestion ou l’administration de projets de développement.',
                sanction: sanctionTexte,
            };
        case client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE:
            return {
                article: 'Art. 14, point 1',
                perimetre: "Système minimal de trésorerie · l'article ne le nomme pas ; le point 1 restreint au bilan et au compte de résultat (lecture d'OmegaX).",
                sanction: sanctionTexte,
            };
        default:
            return { article: 'Art. 14, point 1', perimetre: 'Associations et ordres professionnels.', sanction: sanctionTexte };
    }
}
let LivreInventaireService = class LivreInventaireService {
    constructor(prisma, etatsFinanciers, etatsFinanciersProjet, etatsFinanciersSmt, etatsFinanciersProjetBudget, etatsSyscohada, etatsSmtSyscohada) {
        this.prisma = prisma;
        this.etatsFinanciers = etatsFinanciers;
        this.etatsFinanciersProjet = etatsFinanciersProjet;
        this.etatsFinanciersSmt = etatsFinanciersSmt;
        this.etatsFinanciersProjetBudget = etatsFinanciersProjetBudget;
        this.etatsSyscohada = etatsSyscohada;
        this.etatsSmtSyscohada = etatsSmtSyscohada;
    }
    async regimeInventaire(tenantId) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, jeuEtatsFinanciersSycebnl: true, systemeComptableSyscohada: true },
        });
        const syscohada = tenant.referentiel === client_1.Referentiel.SYSCOHADA;
        return {
            syscohada,
            jeu: syscohada ? null : tenant.jeuEtatsFinanciersSycebnl,
            systeme: syscohada ? tenant.systemeComptableSyscohada : null,
            exiges: syscohada
                ? (0, correspondance_inventaire_syscohada_1.etatsExigesParSysteme)(tenant.systemeComptableSyscohada)
                : (0, correspondance_inventaire_1.etatsExigesPar)(tenant.jeuEtatsFinanciersSycebnl),
            exigence: syscohada
                ? "AUDCIF art. 19 : « le livre d'inventaire, sur lequel sont transcrits le Bilan, le Compte de résultat et le Tableau des flux de trésorerie de chaque exercice, ainsi que le résumé de l'opération d'inventaire. »"
                : "Art. 14 : « Le livre d'inventaire est un document obligatoire sur lequel sont transcrits [les états financiers] de chaque exercice ainsi que le résumé de l'opération d'inventaire. »",
            fondement: fondementInventaire(tenant),
        };
    }
    async lister(tenantId, exerciceId) {
        await this.exercice(tenantId, exerciceId);
        return this.prisma.transcriptionInventaire.findMany({
            where: { tenantId, exerciceId },
            orderBy: { version: 'desc' },
        });
    }
    async courante(tenantId, exerciceId) {
        await this.exercice(tenantId, exerciceId);
        return this.prisma.transcriptionInventaire.findFirst({
            where: { tenantId, exerciceId },
            orderBy: { version: 'desc' },
        });
    }
    async transcrire(tenantId, userId, dto) {
        const exercice = await this.exercice(tenantId, dto.exerciceId);
        const regime = await this.regimeInventaire(tenantId);
        const etats = {};
        const manquants = [];
        for (const etat of regime.exiges) {
            if (!etat.disponible) {
                manquants.push({ cle: etat.cle, libelle: etat.libelle, motif: etat.motifIndisponibilite });
                continue;
            }
            etats[etat.cle] = regime.syscohada
                ? await this.produireSyscohada(etat.cle, regime.systeme, tenantId, exercice.id)
                : await this.produire(etat.cle, regime.jeu, tenantId, exercice.id);
        }
        const dernier = await this.prisma.transcriptionInventaire.findFirst({
            where: { tenantId, exerciceId: exercice.id },
            orderBy: { version: 'desc' },
            select: { version: true },
        });
        return this.prisma.transcriptionInventaire.create({
            data: {
                tenantId,
                exerciceId: exercice.id,
                version: (dernier?.version ?? 0) + 1,
                jeu: regime.jeu,
                systemeSyscohada: regime.systeme,
                etats: etats,
                documentsManquants: manquants,
                resumeOperationInventaire: dto.resumeOperationInventaire?.trim() || null,
                transcritPar: userId,
            },
        });
    }
    async renseignerResume(tenantId, id, dto) {
        const transcription = await this.prisma.transcriptionInventaire.findFirst({ where: { id, tenantId } });
        if (!transcription)
            throw new common_1.NotFoundException('Transcription introuvable pour ce dossier.');
        return this.prisma.transcriptionInventaire.update({
            where: { id },
            data: { resumeOperationInventaire: dto.resumeOperationInventaire.trim() },
        });
    }
    async conformite(tenantId, exerciceId) {
        const exercice = await this.exercice(tenantId, exerciceId);
        const regime = await this.regimeInventaire(tenantId);
        const courante = await this.courante(tenantId, exerciceId);
        const exiges = regime.exiges;
        const manquants = (courante?.documentsManquants ?? []);
        return {
            exercice: { id: exercice.id, dateDebut: exercice.dateDebut, dateFin: exercice.dateFin },
            jeu: regime.jeu,
            systemeSyscohada: regime.systeme,
            exigence: regime.exigence,
            fondement: regime.fondement,
            transcrit: courante !== null,
            version: courante?.version ?? null,
            transcritLe: courante?.transcritLe ?? null,
            etatsExiges: exiges.map((e) => ({
                cle: e.cle,
                libelle: e.libelle,
                transcrit: courante ? Object.prototype.hasOwnProperty.call(courante.etats, e.cle) : false,
                motifIndisponibilite: e.motifIndisponibilite ?? null,
            })),
            documentsManquants: manquants,
            resume: {
                exigence: regime.syscohada
                    ? "AUDCIF art. 19 : « … ainsi que le résumé de l'opération d'inventaire »."
                    : "Art. 14 : « … ainsi que le résumé de l'opération d'inventaire ».",
                renseigne: Boolean(courante?.resumeOperationInventaire?.trim()),
                remarque: "Le référentiel exige ce résumé mais n'en définit ni le contenu ni la forme. Il relève de la rédaction du dossier.",
            },
            complete: courante !== null &&
                manquants.length === 0 &&
                Boolean(courante.resumeOperationInventaire?.trim()),
        };
    }
    async produireSyscohada(cle, systeme, tenantId, exerciceId) {
        const smt = systeme === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE;
        switch (cle) {
            case 'bilan':
                return smt ? this.etatsSmtSyscohada.bilan(tenantId, exerciceId) : this.etatsSyscohada.bilan(tenantId, exerciceId);
            case 'compteDeResultat':
                return smt
                    ? this.etatsSmtSyscohada.compteDeResultat(tenantId, exerciceId)
                    : this.etatsSyscohada.compteDeResultat(tenantId, exerciceId);
            case 'tableauFluxTresorerie':
                return this.etatsSyscohada.tableauFluxTresorerie(tenantId, exerciceId);
            default:
                throw new common_1.BadRequestException(`L'article 19 de l'AUDCIF n'énumère pas l'état « ${cle} » · il ne se transcrit pas sur ce chemin.`);
        }
    }
    async produire(cle, jeu, tenantId, exerciceId) {
        const projet = jeu === client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT;
        const smt = jeu === client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE;
        switch (cle) {
            case 'bilan':
                if (projet)
                    return this.etatsFinanciersProjet.bilan(tenantId, exerciceId);
                if (smt)
                    return this.etatsFinanciersSmt.bilan(tenantId, exerciceId);
                return this.etatsFinanciers.bilan(tenantId, exerciceId);
            case 'compteDeResultat':
                return smt
                    ? this.etatsFinanciersSmt.compteDeResultat(tenantId, exerciceId)
                    : this.etatsFinanciers.compteDeResultat(tenantId, exerciceId);
            case 'tableauFluxTresorerie':
                return this.etatsFinanciers.tableauFluxTresorerie(tenantId, exerciceId);
            case 'compteExploitation':
                return this.etatsFinanciersProjet.compteExploitation(tenantId, exerciceId);
            case 'tableauEmploisRessources':
                return this.etatsFinanciersProjet.tableauEmploisRessources(tenantId, exerciceId);
            case 'tableauExecutionBudgetaire':
                return this.etatsFinanciersProjetBudget.executionBudgetaire(tenantId, exerciceId);
            case 'tableauReconciliationTresorerie':
                return this.etatsFinanciersProjetBudget.reconciliationTresorerie(tenantId, exerciceId, null);
            default:
                throw new common_1.BadRequestException(`État « ${cle} » non producible par cette version de l'application.`);
        }
    }
    async exercice(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        return exercice;
    }
};
exports.LivreInventaireService = LivreInventaireService;
exports.LivreInventaireService = LivreInventaireService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        etats_financiers_service_1.EtatsFinanciersService,
        etats_financiers_projet_service_1.EtatsFinanciersProjetService,
        etats_financiers_smt_service_1.EtatsFinanciersSmtService,
        etats_financiers_projet_budget_service_1.EtatsFinanciersProjetBudgetService,
        etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService,
        etats_financiers_smt_syscohada_service_1.EtatsFinanciersSmtSyscohadaService])
], LivreInventaireService);
//# sourceMappingURL=livre-inventaire.service.js.map