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
var QuestionnaireService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionnaireService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const catalogue_questionnaire_1 = require("./catalogue-questionnaire");
let QuestionnaireService = QuestionnaireService_1 = class QuestionnaireService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    static itemsInterrogatifsCpcc() {
        return catalogue_questionnaire_1.ITEMS_QUESTIONNAIRE.filter((i) => i.origine === 'CPCC' && i.forme !== 'TRAVAIL');
    }
    static itemsRetenus(cycles, referentiel) {
        const tousLesCycles = cycles.length === 0;
        return catalogue_questionnaire_1.ITEMS_QUESTIONNAIRE.filter((i) => (tousLesCycles || cycles.includes(i.cycle)) && (!i.referentiel || i.referentiel === referentiel));
    }
    static estException(item, reponse) {
        if (item.forme !== 'OUI_NON' || reponse === null)
            return false;
        const polarite = item.polariteException ?? 'NON';
        return polarite === 'OUI' ? reponse === client_1.ReponseItem.OUI : reponse === client_1.ReponseItem.NON;
    }
    static estOuvert(item, reponses) {
        if (!item.ouvertPar)
            return true;
        return reponses.get(item.ouvertPar.code) === client_1.ReponseItem[item.ouvertPar.reponse];
    }
    static reponsesDesItemsOuverts(items, reponses) {
        const reponsesFermees = new Map(reponses.map((r) => [r.code, r.reponse]));
        const ouverts = new Set(items.filter((i) => QuestionnaireService_1.estOuvert(i, reponsesFermees)).map((i) => i.code));
        return reponses.filter((r) => ouverts.has(r.code));
    }
    static motifsRefusCloture(items, reponses) {
        const parCode = new Map(reponses.map((r) => [r.code, r]));
        const reponsesFermees = new Map(reponses.map((r) => [r.code, r.reponse]));
        const motifs = [];
        const sansReponse = items.filter((i) => {
            if (!QuestionnaireService_1.estOuvert(i, reponsesFermees))
                return false;
            const r = parCode.get(i.code);
            if (!r)
                return true;
            if (i.forme === 'OUI_NON')
                return r.reponse === null;
            if (i.forme === 'TRAVAIL')
                return !r.renvoiTravaux?.trim();
            return !r.valeur?.trim();
        });
        if (sansReponse.length > 0) {
            motifs.push(`${sansReponse.length} item(s) ouvert(s) sans réponse (${sansReponse.slice(0, 8).map((i) => i.code).join(', ')}${sansReponse.length > 8 ? '…' : ''}) · ` +
                "un questionnaire à trous ne se distingue pas d'un questionnaire favorable.");
        }
        const exceptionsNues = QuestionnaireService_1.reponsesDesItemsOuverts(items, reponses).filter((r) => r.estException && !r.commentaire?.trim());
        if (exceptionsNues.length > 0) {
            motifs.push(`${exceptionsNues.length} exception(s) sans commentaire (${exceptionsNues.map((r) => r.code).join(', ')}) · ` +
                "une case rouge sans phrase ne dit rien à celui qui reprendra le dossier, et c'est lui que le CPCC envoie « faire le suivi des faiblesses relevées lors de l'audit précédent ».");
        }
        return motifs;
    }
    async questionnaire(tenantId, id, statutsAdmis) {
        const q = await this.prisma.questionnaireRevision.findFirst({ where: { id, tenantId } });
        if (!q)
            throw new common_1.NotFoundException('Questionnaire de révision introuvable.');
        if (statutsAdmis && !statutsAdmis.includes(q.statut)) {
            throw new common_1.ForbiddenException(`Ce questionnaire est au statut ${q.statut} · l'opération demandée n'est possible qu'en ${statutsAdmis.join(' ou ')}.`);
        }
        return q;
    }
    async referentielDuDossier(tenantId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
        return tenant?.referentiel ?? client_1.Referentiel.SYCEBNL;
    }
    async creer(tenantId, userId, dto) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable.');
        return this.prisma.questionnaireRevision.create({
            data: {
                tenantId,
                exerciceId: dto.exerciceId,
                libelle: dto.libelle.trim(),
                cycles: dto.cycles ?? [],
                createdBy: userId,
            },
        });
    }
    async repondre(tenantId, questionnaireId, userId, dto) {
        await this.questionnaire(tenantId, questionnaireId, [client_1.StatutQuestionnaire.OUVERT]);
        const item = catalogue_questionnaire_1.ITEM_PAR_CODE.get(dto.code);
        if (!item)
            throw new common_1.NotFoundException(`Item ${dto.code} inconnu du catalogue.`);
        const referentiel = await this.referentielDuDossier(tenantId);
        if (item.referentiel && item.referentiel !== referentiel) {
            throw new common_1.BadRequestException(`L'item ${item.code} ne se pose qu'en ${item.referentiel} · le poser ici serait un contresens, pas une question de plus.`);
        }
        if (item.ouvertPar) {
            const parent = await this.prisma.reponseQuestionnaire.findUnique({
                where: { questionnaireId_code: { questionnaireId, code: item.ouvertPar.code } },
            });
            const attendue = client_1.ReponseItem[item.ouvertPar.reponse];
            if (parent?.reponse !== attendue) {
                throw new common_1.BadRequestException(`L'item ${item.code} n'est ouvert que si ${item.ouvertPar.code} a reçu « ${item.ouvertPar.reponse} » · son libellé le dit lui-même. ` +
                    "Répondre quand même produirait une réponse orpheline, qui compterait dans le taux sans rien vouloir dire.");
            }
        }
        if (item.forme === 'OUI_NON') {
            if (!dto.reponse) {
                throw new common_1.BadRequestException(`L'item ${item.code} est une question fermée · répondre OUI, NON ou SANS_OBJET.`);
            }
        }
        else if (dto.reponse) {
            const attendu = item.forme === 'DONNEE'
                ? 'une donnée · une date, un nombre'
                : item.forme === 'TEXTE_LIBRE'
                    ? 'une description'
                    : 'un renvoi au papier de travail';
            throw new common_1.BadRequestException(`L'item ${item.code} n'est pas une question fermée : il appelle ${attendu}. ` +
                "Un « Oui » y serait un acquiescement qui ne répond pas à la question posée.");
        }
        if (item.forme === 'TRAVAIL' && !dto.renvoiTravaux?.trim()) {
            throw new common_1.BadRequestException(`L'item ${item.code} est un travail à conduire, pas une question · indiquer le renvoi au papier de travail.`);
        }
        if ((item.forme === 'DONNEE' || item.forme === 'TEXTE_LIBRE') && !dto.valeur?.trim()) {
            throw new common_1.BadRequestException(`L'item ${item.code} appelle une réponse écrite, pas une case.`);
        }
        const estException = QuestionnaireService_1.estException(item, dto.reponse ?? null);
        const donnees = {
            reponse: dto.reponse ?? null,
            valeur: dto.valeur?.trim() || null,
            renvoiTravaux: dto.renvoiTravaux?.trim() || null,
            commentaire: dto.commentaire?.trim() || null,
            estException,
            reponduLe: new Date(),
            reponduPar: userId,
        };
        return this.prisma.reponseQuestionnaire.upsert({
            where: { questionnaireId_code: { questionnaireId, code: item.code }, tenantId },
            create: { tenantId, questionnaireId, code: item.code, ...donnees },
            update: donnees,
        });
    }
    async clore(tenantId, questionnaireId, userId, dto) {
        const q = await this.questionnaire(tenantId, questionnaireId, [client_1.StatutQuestionnaire.OUVERT]);
        const referentiel = await this.referentielDuDossier(tenantId);
        const items = QuestionnaireService_1.itemsRetenus(q.cycles, referentiel);
        const reponses = await this.prisma.reponseQuestionnaire.findMany({ where: { tenantId, questionnaireId } });
        const motifs = QuestionnaireService_1.motifsRefusCloture(items, reponses);
        if (motifs.length > 0)
            throw new common_1.ForbiddenException(motifs.join(' · '));
        return this.prisma.questionnaireRevision.update({
            where: { id: questionnaireId },
            data: {
                statut: client_1.StatutQuestionnaire.CLOS,
                closLe: new Date(),
                closPar: userId,
                motifCloture: dto.motifCloture?.trim() || null,
            },
        });
    }
    async lister(tenantId, exerciceId) {
        return this.prisma.questionnaireRevision.findMany({
            where: { tenantId, ...(exerciceId ? { exerciceId } : {}) },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { reponses: true } } },
        });
    }
    async consulter(tenantId, questionnaireId) {
        const q = await this.prisma.questionnaireRevision.findFirst({
            where: { id: questionnaireId, tenantId },
            include: { reponses: true },
        });
        if (!q)
            throw new common_1.NotFoundException('Questionnaire de révision introuvable.');
        const referentiel = await this.referentielDuDossier(tenantId);
        const items = QuestionnaireService_1.itemsRetenus(q.cycles, referentiel);
        const parCode = new Map(q.reponses.map((r) => [r.code, r]));
        const reponsesFermees = new Map(q.reponses.map((r) => [r.code, r.reponse]));
        const lignes = items.map((i) => ({
            ...i,
            ouvert: QuestionnaireService_1.estOuvert(i, reponsesFermees),
            reponse: parCode.get(i.code) ?? null,
        }));
        const questions = lignes.filter((l) => l.forme !== 'TRAVAIL' && l.ouvert);
        const repondues = questions.filter((l) => l.reponse && (l.reponse.reponse !== null || l.reponse.valeur));
        const travaux = lignes.filter((l) => l.forme === 'TRAVAIL' && l.ouvert);
        const travauxFaits = travaux.filter((l) => l.reponse?.renvoiTravaux);
        const exceptions = QuestionnaireService_1.reponsesDesItemsOuverts(items, q.reponses).filter((r) => r.estException);
        return {
            ...q,
            lignes,
            synthese: {
                questions: questions.length,
                repondues: repondues.length,
                tauxReponse: questions.length > 0 ? Number(((repondues.length / questions.length) * 100).toFixed(1)) : 0,
                travaux: travaux.length,
                travauxFaits: travauxFaits.length,
                exceptions: exceptions.length,
                exceptionsSansCommentaire: exceptions.filter((r) => !r.commentaire?.trim()).length,
                itemsCpcc: lignes.filter((l) => l.origine === 'CPCC').length,
                itemsVmg: lignes.filter((l) => l.origine === 'VMG').length,
            },
            motifsRefusCloture: QuestionnaireService_1.motifsRefusCloture(items, q.reponses),
        };
    }
};
exports.QuestionnaireService = QuestionnaireService;
QuestionnaireService.ITEMS = catalogue_questionnaire_1.ITEMS_QUESTIONNAIRE;
exports.QuestionnaireService = QuestionnaireService = QuestionnaireService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QuestionnaireService);
//# sourceMappingURL=questionnaire.service.js.map