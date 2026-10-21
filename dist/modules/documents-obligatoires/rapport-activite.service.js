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
exports.RapportActiviteService = void 0;
exports.tableauTresorerieDuDossier = tableauTresorerieDuDossier;
exports.tresorerieFigee = tresorerieFigee;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const etats_financiers_service_1 = require("../etats-financiers/etats-financiers.service");
const etats_financiers_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.service");
const donation_service_1 = require("../registre-donateurs/donation.service");
const correspondance_inventaire_1 = require("./correspondance-inventaire");
const correspondance_inventaire_syscohada_1 = require("./correspondance-inventaire-syscohada");
const forme_applicable_1 = require("../tenant/forme-applicable");
function articleDeLaRegle(source) {
    return source.split(' (')[0];
}
function tableauTresorerieDuDossier(tenant) {
    if (tenant.referentiel === client_1.Referentiel.SYSCOHADA) {
        return tenant.systemeComptableSyscohada === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE ? null : 'TFT_SYSCOHADA_NORMAL';
    }
    return tenant.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS
        ? 'TFT_ASSOCIATIONS'
        : null;
}
function tresorerieFigee(stockee, attendu) {
    if (!stockee || attendu === null)
        return null;
    const t = stockee;
    return (t.tableau ?? 'TFT_ASSOCIATIONS') === attendu ? t : null;
}
let RapportActiviteService = class RapportActiviteService {
    constructor(prisma, etatsFinanciers, donationService, etatsSyscohada) {
        this.prisma = prisma;
        this.etatsFinanciers = etatsFinanciers;
        this.donationService = donationService;
        this.etatsSyscohada = etatsSyscohada;
    }
    async lister(tenantId, exerciceId) {
        await this.exercice(tenantId, exerciceId);
        return this.prisma.rapportActivite.findMany({ where: { tenantId, exerciceId }, orderBy: { version: 'desc' } });
    }
    async courant(tenantId, exerciceId) {
        await this.exercice(tenantId, exerciceId);
        return this.prisma.rapportActivite.findFirst({ where: { tenantId, exerciceId }, orderBy: { version: 'desc' } });
    }
    async regimeRapport(tenantId, exercice) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: {
                referentiel: true,
                formeJuridiqueSyscohada: true,
                formeJuridiqueSyscohadaAnterieure: true,
                dateTransformationForme: true,
            },
        });
        if (tenant.referentiel !== client_1.Referentiel.SYSCOHADA) {
            return { syscohada: false, regle: null };
        }
        return { syscohada: true, regle: (0, correspondance_inventaire_syscohada_1.regleRapportGestion)((0, forme_applicable_1.formeApplicable)(tenant, exercice.dateFin)) };
    }
    async etablir(tenantId, userId, dto) {
        const exercice = await this.exercice(tenantId, dto.exerciceId);
        const etabliLe = new Date(dto.etabliLe);
        const regime = await this.regimeRapport(tenantId, exercice);
        if (etabliLe < exercice.dateFin) {
            const texte = regime.syscohada
                ? regime.regle.genre === 'EXIGE'
                    ? articleDeLaRegle(regime.regle.source)
                    : 'Le rapport'
                : "L'article 16-3";
            const demandeEvenementsPosterieurs = !regime.syscohada ||
                (regime.regle.genre === 'EXIGE' && regime.regle.sections.some((s) => s.cle === 'evenementsPosterieurs'));
            throw new common_1.BadRequestException(`La date d'établissement (${etabliLe.toLocaleDateString('fr-FR')}) est antérieure à la clôture de l'exercice (${exercice.dateFin.toLocaleDateString('fr-FR')}). ${texte} rend compte de l'exercice écoulé : il s'établit après sa clôture${demandeEvenementsPosterieurs ? ", et les événements postérieurs se comptent à partir d'elle" : ''}.`);
        }
        if (regime.syscohada && regime.regle.genre === 'AUCUNE_REGLE_LUE') {
            throw new common_1.BadRequestException(regime.regle.motif);
        }
        const tresorerie = await this.tresorerieDuTft(tenantId, exercice.id);
        const dernier = await this.prisma.rapportActivite.findFirst({
            where: { tenantId, exerciceId: exercice.id },
            orderBy: { version: 'desc' },
            select: { version: true },
        });
        return this.prisma.rapportActivite.create({
            data: {
                tenantId,
                exerciceId: exercice.id,
                version: (dernier?.version ?? 0) + 1,
                etabliLe,
                etabliPar: userId,
                situationExerciceEcoule: dto.situationExerciceEcoule?.trim() || null,
                perspectivesDeveloppement: dto.perspectivesDeveloppement?.trim() || null,
                evolutionTresorerie: dto.evolutionTresorerie?.trim() || null,
                evenementsPosterieurs: dto.evenementsPosterieurs?.trim() || null,
                entiteAvecAuditeur: dto.entiteAvecAuditeur ?? false,
                declarationDirigeants: dto.declarationDirigeants?.trim() || null,
                sections: regime.syscohada ? (dto.sections ?? {}) : client_1.Prisma.DbNull,
                sourceRegle: regime.syscohada && regime.regle.genre === 'EXIGE' ? regime.regle.source : null,
                tresorerie: tresorerie ? tresorerie : client_1.Prisma.DbNull,
            },
        });
    }
    async conformiteRapportGestion(tenantId, exerciceId) {
        const exercice = await this.exercice(tenantId, exerciceId);
        const courant = await this.courant(tenantId, exerciceId);
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { formeJuridiqueSyscohada: true, formeJuridiqueSyscohadaAnterieure: true, dateTransformationForme: true },
        });
        const regle = (0, correspondance_inventaire_syscohada_1.regleRapportGestion)((0, forme_applicable_1.formeApplicable)(tenant, exercice.dateFin));
        const mentionTransformation = (0, forme_applicable_1.exerciceDeTransformation)(tenant, exercice)
            ? `La société a changé de forme le ${tenant.dateTransformationForme.toLocaleDateString('fr-FR')} · « Le rapport ` +
                'de gestion est établi par les anciens et les nouveaux organes de gestion, chacun de ses organes pour sa ' +
                'période de gestion » (AUSCGIE art. 185).'
            : null;
        if (regle.genre === 'AUCUNE_REGLE_LUE') {
            return {
                exercice: { id: exercice.id, dateDebut: exercice.dateDebut, dateFin: exercice.dateFin },
                regleLue: false,
                motif: regle.motif,
                exigence: null,
                etabli: courant !== null,
                version: null,
                etabliLe: null,
                sections: [],
                fenetreEvenementsPosterieurs: null,
                tresorerie: null,
                mentionTransformation,
                modificationsDeMethodeEnregistrees: 0,
                complet: false,
            };
        }
        const modificationsDeMethodeEnregistrees = await this.prisma.ecriture.count({
            where: { tenantId, exerciceId: exercice.id, motifImputationOuverture: 'CHANGEMENT_METHODE', ...ecritures_de_situation_1.HORS_SITUATION },
        });
        const enregistrees = (courant?.sections ?? {});
        const sections = regle.sections.map((section) => ({
            ...section,
            renseignee: Boolean(enregistrees[section.cle]?.trim()),
        }));
        return {
            exercice: { id: exercice.id, dateDebut: exercice.dateDebut, dateFin: exercice.dateFin },
            regleLue: true,
            motif: null,
            exigence: `${regle.source} · établi par ${regle.organe}.`,
            etabli: courant !== null,
            version: courant?.version ?? null,
            etabliLe: courant?.etabliLe ?? null,
            sections,
            fenetreEvenementsPosterieurs: courant && regle.sections.some((s) => s.cle === 'evenementsPosterieurs')
                ? { du: exercice.dateFin, au: courant.etabliLe, article: articleDeLaRegle(regle.source) }
                : null,
            tresorerie: tresorerieFigee(courant?.tresorerie, await this.tableauDuDossier(tenantId)),
            mentionTransformation,
            modificationsDeMethodeEnregistrees,
            complet: courant !== null && sections.every((s) => s.renseignee),
        };
    }
    async conformite(tenantId, exerciceId) {
        const exercice = await this.exercice(tenantId, exerciceId);
        const courant = await this.courant(tenantId, exerciceId);
        const registre = await this.donationService.rapportConformite(tenantId, exerciceId);
        const sections = correspondance_inventaire_1.SECTIONS_RAPPORT_ACTIVITE.map((s) => ({
            ...s,
            renseignee: Boolean(courant?.[s.cle]?.trim()),
        }));
        return {
            exercice: { id: exercice.id, dateDebut: exercice.dateDebut, dateFin: exercice.dateFin },
            exigence: "Art. 16-3 : « à la clôture de chaque exercice, les organes d'administration ou de direction, selon le cas, dressent l'inventaire et les états financiers […] et établissent un rapport d'activité ». Art. 24 : sanction pénale à défaut.",
            etabli: courant !== null,
            version: courant?.version ?? null,
            etabliLe: courant?.etabliLe ?? null,
            sections,
            fenetreEvenementsPosterieurs: courant
                ? { du: exercice.dateFin, au: courant.etabliLe, article: 'art. 16-3' }
                : null,
            tresorerie: tresorerieFigee(courant?.tresorerie, await this.tableauDuDossier(tenantId)),
            declarationRegistreDonateurs: {
                exigence: "Art. 18 : « S'il n'existe pas d'auditeur, une déclaration des dirigeants attestant de la tenue conforme du registre des donateurs est annexée audit rapport ou soumise à l'assemblée générale ou l'instance qui en tient lieu. »",
                remarque: "[texte officiel] « audit rapport » est ambigu : la phrase figure dans la branche « s'il n'existe pas d'auditeur », où aucun rapport d'auditeur n'existe. Le seul autre rapport prévu par le texte est celui de l'art. 16-3, d'où son rattachement ici.",
                entiteAvecAuditeur: courant?.entiteAvecAuditeur ?? false,
                attendue: courant !== null && !courant.entiteAvecAuditeur,
                renseignee: Boolean(courant?.declarationDirigeants?.trim()),
                registreConforme: registre.numerotation.continue &&
                    registre.signature.lignesNonSignees.length === 0 &&
                    registre.completude.lignesIncompletes.length === 0 &&
                    registre.rapprochement.rapproche,
            },
            complet: courant !== null &&
                sections.every((s) => s.renseignee) &&
                (courant.entiteAvecAuditeur || Boolean(courant.declarationDirigeants?.trim())),
        };
    }
    async tresorerieDuTft(tenantId, exerciceId) {
        const tableau = await this.tableauDuDossier(tenantId);
        if (tableau === null)
            return null;
        const tft = tableau === 'TFT_SYSCOHADA_NORMAL'
            ? await this.etatsSyscohada.tableauFluxTresorerie(tenantId, exerciceId)
            : await this.etatsFinanciers.tableauFluxTresorerie(tenantId, exerciceId);
        const raisons = [...new Set((tft.postesNonCalculables ?? []).filter((p) => (tft.postesVides ?? []).includes(p.ref)).map((p) => p.raison))];
        return {
            tableau,
            ouverture: tft.controle.tresorerieOuverture,
            variation: tft.controle.variation,
            cloture: tft.controle.tresorerieClotureParBilan,
            boucle: tft.controle.coherent,
            ...(tft.controle.motifNonControlable ? { motifNonControlable: [tft.controle.motifNonControlable, ...raisons].join(' ') } : {}),
        };
    }
    async tableauDuDossier(tenantId) {
        return tableauTresorerieDuDossier(await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, jeuEtatsFinanciersSycebnl: true, systemeComptableSyscohada: true },
        }));
    }
    async exercice(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        return exercice;
    }
};
exports.RapportActiviteService = RapportActiviteService;
exports.RapportActiviteService = RapportActiviteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        etats_financiers_service_1.EtatsFinanciersService,
        donation_service_1.DonationService,
        etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService])
], RapportActiviteService);
//# sourceMappingURL=rapport-activite.service.js.map