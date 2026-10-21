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
var FaiblessesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaiblessesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
let FaiblessesService = FaiblessesService_1 = class FaiblessesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    static regimeDeReport(qualification, statut) {
        if (statut === client_1.StatutFaiblesse.REMEDIEE || statut === client_1.StatutFaiblesse.SANS_OBJET)
            return 'LIBRE';
        return qualification === client_1.QualificationFaiblesse.SIGNIFICATIVE ? 'REFUS_DU_REPORT_MUET' : 'LIBRE';
    }
    static manquesDuReport(f, reconduction) {
        if (FaiblessesService_1.regimeDeReport(f.qualification, f.statut) === 'LIBRE')
            return [];
        const manques = [];
        if (!reconduction.communicationReconduite?.trim()) {
            manques.push("la communication reconduite · § A17 laisse le choix entre RÉPÉTER la description de l'exercice précédent et RÉFÉRENCER la communication antérieure, mais pas celui de ne rien dire");
        }
        return manques;
    }
    static motifsRefusCloture(origine, faiblesses) {
        if (origine === client_1.OrigineFaiblesse.RECOMMANDATION_EXTERNE)
            return [];
        const motifs = [];
        const nonQualifiees = faiblesses.filter((f) => f.qualification === client_1.QualificationFaiblesse.NON_QUALIFIEE);
        if (nonQualifiees.length > 0) {
            motifs.push(`${nonQualifiees.length} faiblesse(s) non qualifiée(s) (${nonQualifiees.map((f) => f.reference).join(', ')}) · ` +
                "ISA 265 § 8 : l'auditeur « SHALL determine […] whether, individually or in combination, they constitute significant deficiencies ». " +
                "Tant que le jugement n'a pas été porté, il ne l'a pas été.");
        }
        const significativesMuettes = faiblesses.filter((f) => f.qualification === client_1.QualificationFaiblesse.SIGNIFICATIVE && !f.communiqueeLe);
        if (significativesMuettes.length > 0) {
            motifs.push(`${significativesMuettes.length} faiblesse(s) significative(s) jamais communiquée(s) par écrit ` +
                `(${significativesMuettes.map((f) => f.reference).join(', ')}) · ` +
                "ISA 265 § 9 : « the auditor SHALL communicate IN WRITING significant deficiencies in internal control […] on a timely basis ». " +
                "Un registre décrit, recommandé et suivi, mais jamais sorti par écrit, se lit exactement comme un registre tenu.");
        }
        return motifs;
    }
    static refuserSiLettreRecue(origine) {
        if (origine === client_1.OrigineFaiblesse.RECOMMANDATION_EXTERNE) {
            throw new common_1.ForbiddenException("OmegaX est ici le porte-documents de la direction · la qualification appartient à celui qui a écrit la lettre, et le cabinet ne la refait pas. " +
                'Pour porter un jugement propre au cabinet, ouvrir un registre de révision interne.');
        }
    }
    static motifRefusReport(source, cible) {
        if (source.origine !== cible.origine) {
            return ('Le registre cible n’est pas de la même origine · une faiblesse reportée garde sa qualification et son ' +
                'auteur, et la lettre d’un tiers ne devient pas un constat du cabinet (ni l’inverse).');
        }
        if (cible.debutExercice <= source.debutExercice) {
            return 'Le registre cible ne porte pas sur un exercice postérieur · un report va vers l’exercice qui suit.';
        }
        return null;
    }
    async registre(tenantId, id, statutsAdmis) {
        const r = await this.prisma.registreFaiblesses.findFirst({ where: { id, tenantId } });
        if (!r)
            throw new common_1.NotFoundException('Registre des faiblesses introuvable.');
        if (statutsAdmis && !statutsAdmis.includes(r.statut)) {
            throw new common_1.ForbiddenException(`Ce registre est au statut ${r.statut} · l'opération demandée n'est possible qu'en ${statutsAdmis.join(' ou ')}.`);
        }
        return r;
    }
    async faiblesse(tenantId, id) {
        const f = await this.prisma.faiblesseControleInterne.findFirst({
            where: { id, tenantId },
            include: { registre: true },
        });
        if (!f)
            throw new common_1.NotFoundException('Faiblesse introuvable.');
        if (f.registre.statut === client_1.StatutRegistreFaiblesses.CLOS) {
            throw new common_1.ForbiddenException('Ce registre est clos · rouvrir un exercice clos n’est pas une modification de faiblesse.');
        }
        return f;
    }
    async creer(tenantId, userId, dto) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable.');
        if (dto.origine === client_1.OrigineFaiblesse.RECOMMANDATION_EXTERNE) {
            if (!dto.emetteur?.trim() || !dto.dateLettre) {
                throw new common_1.BadRequestException("Une recommandation reçue vient de quelqu'un, à une date · l'émetteur et la date de la lettre sont exigés. " +
                    "Sans eux, le registre ne dit plus si le constat vient d'un réviseur ou du cabinet lui-même, " +
                    'et c’est précisément la distinction que ce mode existe pour tenir.');
            }
        }
        else if (dto.emetteur?.trim() || dto.dateLettre || dto.referenceLettre?.trim()) {
            throw new common_1.BadRequestException("Un registre de révision interne n'a pas d'émetteur tiers · le cabinet ne se cite pas lui-même comme auteur d'une lettre reçue.");
        }
        return this.prisma.registreFaiblesses.create({
            data: {
                tenantId,
                exerciceId: dto.exerciceId,
                origine: dto.origine,
                libelle: dto.libelle.trim(),
                emetteur: dto.emetteur?.trim() || null,
                dateLettre: dto.dateLettre ? new Date(dto.dateLettre) : null,
                referenceLettre: dto.referenceLettre?.trim() || null,
                createdBy: userId,
            },
        });
    }
    async ajouter(tenantId, registreId, userId, dto) {
        const registre = await this.registre(tenantId, registreId, [client_1.StatutRegistreFaiblesses.OUVERT]);
        const inconnus = (dto.indicateursA7 ?? []).filter((i) => !FaiblessesService_1.INDICATEURS_A7.includes(i));
        if (inconnus.length > 0) {
            throw new common_1.BadRequestException(`Indicateur(s) hors § A7 : ${inconnus.join(', ')}. La liste du § A7 est celle de la norme · l'élargir ici la ferait passer pour plus large qu'elle.`);
        }
        const externe = registre.origine === client_1.OrigineFaiblesse.RECOMMANDATION_EXTERNE;
        if (externe && dto.constatePar?.trim()) {
            throw new common_1.BadRequestException("En mode « recommandation reçue », le constat n'est pas celui du cabinet · le champ « constaté par » reste vide, et l'auteur du constat est l'émetteur de la lettre.");
        }
        return this.prisma.faiblesseControleInterne.create({
            data: {
                tenantId,
                registreId,
                reference: dto.reference.trim(),
                intitule: dto.intitule.trim(),
                description: dto.description.trim(),
                effetPotentiel: dto.effetPotentiel.trim(),
                recommandation: dto.recommandation?.trim() || null,
                indicateursA7: dto.indicateursA7 ?? [],
                qualification: externe ? (dto.qualification ?? client_1.QualificationFaiblesse.NON_QUALIFIEE) : client_1.QualificationFaiblesse.NON_QUALIFIEE,
                constatePar: externe ? null : (dto.constatePar?.trim() || userId),
                constateLe: externe ? null : new Date(),
                echeanceRemediation: dto.echeanceRemediation ? new Date(dto.echeanceRemediation) : null,
            },
        });
    }
    async qualifier(tenantId, faiblesseId, userId, dto) {
        const f = await this.faiblesse(tenantId, faiblesseId);
        FaiblessesService_1.refuserSiLettreRecue(f.registre.origine);
        if (dto.qualification === client_1.QualificationFaiblesse.NON_QUALIFIEE) {
            throw new common_1.BadRequestException("« Non qualifiée » est l'état de départ, pas une décision · on ne dé-qualifie pas une faiblesse déjà jugée.");
        }
        if (!dto.justification?.trim()) {
            throw new common_1.BadRequestException('ISA 265 § 8 · la détermination se fait « on the basis of the audit work performed ». La justification écrite est ce qui distingue un jugement d’une case cochée.');
        }
        return this.prisma.faiblesseControleInterne.update({
            where: { id: faiblesseId },
            data: {
                qualification: dto.qualification,
                qualifiePar: userId,
                qualifieLe: new Date(),
                justificationQualification: dto.justification.trim(),
            },
        });
    }
    async communiquer(tenantId, faiblesseId, dto) {
        const f = await this.faiblesse(tenantId, faiblesseId);
        if (f.qualification === client_1.QualificationFaiblesse.NON_QUALIFIEE) {
            throw new common_1.BadRequestException("Qualifier d'abord · § 9 vise les significatives et § 10 b) les autres faiblesses. Le destinataire de l'écrit dépend de la qualification.");
        }
        return this.prisma.faiblesseControleInterne.update({
            where: { id: faiblesseId },
            data: { communiqueeLe: new Date(dto.communiqueeLe), communiqueeA: dto.communiqueeA.trim() },
        });
    }
    async reponseDirection(tenantId, faiblesseId, userId, dto) {
        const f = await this.faiblesse(tenantId, faiblesseId);
        const auteurReponse = dto.reponseDirectionPar?.trim() || userId;
        if (f.constatePar && f.constatePar === auteurReponse) {
            throw new common_1.ForbiddenException("L'auteur du constat ne peut pas signer la réponse de la direction · ISA 265 § A28 range cette réponse du côté de « MANAGEMENT », " +
                "et un registre où le cabinet se répond à lui-même ne porte plus qu'une seule voix.");
        }
        return this.prisma.faiblesseControleInterne.update({
            where: { id: faiblesseId },
            data: {
                reponseDirection: dto.reponseDirection.trim(),
                reponseDirectionPar: auteurReponse,
                reponseDirectionLe: new Date(),
            },
        });
    }
    async suivre(tenantId, faiblesseId, dto) {
        await this.faiblesse(tenantId, faiblesseId);
        if (dto.statut === client_1.StatutFaiblesse.REMEDIEE && !dto.verificationCabinet?.trim()) {
            throw new common_1.BadRequestException("Dire si le cabinet a vérifié, ou non, que la remédiation a bien été mise en œuvre · ISA 265 § A28. " +
                "« Non vérifiée par le cabinet, déclaration de la direction » est une réponse recevable ; le silence n'en est pas une, " +
                "parce qu'il se lit comme une vérification.");
        }
        if (dto.statut === client_1.StatutFaiblesse.NON_REMEDIEE_ASSUMEE && !dto.motifNonRemediation?.trim()) {
            throw new common_1.BadRequestException("ISA 265 § A24 admet que la direction choisisse de ne pas y remédier « for cost or other reasons » · encore faut-il que la raison soit écrite. " +
                "§ A17 ajoute qu'« a failure to act, in the absence of a rational explanation, may in itself represent a significant deficiency ».");
        }
        return this.prisma.faiblesseControleInterne.update({
            where: { id: faiblesseId },
            data: {
                statut: dto.statut,
                ...(dto.verificationCabinet !== undefined
                    ? { verificationCabinet: dto.verificationCabinet?.trim() || null }
                    : {}),
                ...(dto.motifNonRemediation !== undefined
                    ? { motifNonRemediation: dto.motifNonRemediation?.trim() || null }
                    : {}),
                remedieeLe: dto.statut === client_1.StatutFaiblesse.REMEDIEE ? new Date() : null,
            },
        });
    }
    async reporter(tenantId, faiblesseId, dto) {
        const source = await this.prisma.faiblesseControleInterne.findFirst({
            where: { id: faiblesseId, tenantId },
            include: { registre: true, reconduction: true },
        });
        if (!source)
            throw new common_1.NotFoundException('Faiblesse introuvable.');
        if (source.reconduction) {
            throw new common_1.ForbiddenException(`Cette faiblesse est déjà reportée sous la référence ${source.reconduction.reference} · une faiblesse ne se suit pas sur deux fils à la fois.`);
        }
        const cible = await this.registre(tenantId, dto.registreCibleId, [client_1.StatutRegistreFaiblesses.OUVERT]);
        if (cible.id === source.registreId) {
            throw new common_1.BadRequestException("Le registre cible est celui d'origine · un report va vers l'exercice suivant.");
        }
        const exercices = await this.prisma.exercice.findMany({
            where: { tenantId, id: { in: [source.registre.exerciceId, cible.exerciceId] } },
            select: { id: true, dateDebut: true },
        });
        const debut = new Map(exercices.map((e) => [e.id, e.dateDebut]));
        const debutSource = debut.get(source.registre.exerciceId);
        const debutCible = debut.get(cible.exerciceId);
        if (!debutSource || !debutCible)
            throw new common_1.NotFoundException('Exercice du registre introuvable.');
        const refus = FaiblessesService_1.motifRefusReport({ origine: source.registre.origine, debutExercice: debutSource }, { origine: cible.origine, debutExercice: debutCible });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const manques = FaiblessesService_1.manquesDuReport(source, dto);
        if (manques.length > 0) {
            throw new common_1.ForbiddenException(`Report d'une faiblesse SIGNIFICATIVE non remédiée · ISA 265 § A17 : « the fact that the auditor communicated a significant deficiency […] in a previous audit does NOT eliminate the need for the auditor to REPEAT the communication if remedial action has not yet been taken ». ` +
                `Manque : ${manques.join(' ; ')}.`);
        }
        return this.prisma.faiblesseControleInterne.create({
            data: {
                tenantId,
                registreId: cible.id,
                faiblesseAnterieureId: source.id,
                reference: dto.reference?.trim() || source.reference,
                intitule: source.intitule,
                description: dto.communicationReconduite?.trim() || source.description,
                effetPotentiel: source.effetPotentiel,
                recommandation: source.recommandation,
                indicateursA7: source.indicateursA7,
                qualification: source.qualification,
                qualifiePar: source.qualifiePar,
                qualifieLe: source.qualifieLe,
                justificationQualification: source.justificationQualification,
                constatePar: source.constatePar,
                constateLe: source.constateLe,
                statut: client_1.StatutFaiblesse.OUVERTE,
                motifNonRemediation: dto.motifNonRemediation?.trim() || source.motifNonRemediation,
                echeanceRemediation: dto.echeanceRemediation ? new Date(dto.echeanceRemediation) : null,
            },
        });
    }
    async escalader(tenantId, faiblesseId, userId, dto) {
        const f = await this.faiblesse(tenantId, faiblesseId);
        FaiblessesService_1.refuserSiLettreRecue(f.registre.origine);
        if (f.qualification !== client_1.QualificationFaiblesse.AUTRE) {
            throw new common_1.BadRequestException("L'escalade du § A24 ne concerne que les AUTRES faiblesses non remédiées · une significative l'est déjà, une non qualifiée se qualifie.");
        }
        if (f.statut === client_1.StatutFaiblesse.REMEDIEE || f.statut === client_1.StatutFaiblesse.SANS_OBJET) {
            throw new common_1.BadRequestException("§ A24 vise « the FAILURE of management to remedy » · une faiblesse remédiée ou sans objet n'a rien à escalader.");
        }
        if (!dto.motif?.trim()) {
            throw new common_1.BadRequestException("§ A24 : « Whether this is the case depends on the auditor's JUDGMENT in the circumstances. » Le motif est le jugement.");
        }
        return this.prisma.faiblesseControleInterne.update({
            where: { id: faiblesseId },
            data: {
                qualification: client_1.QualificationFaiblesse.SIGNIFICATIVE,
                qualifiePar: userId,
                qualifieLe: new Date(),
                justificationQualification: dto.motif.trim(),
                escaladeeLe: new Date(),
                escaladeeMotif: dto.motif.trim(),
                communiqueeLe: null,
                communiqueeA: null,
            },
        });
    }
    async clore(tenantId, registreId, userId, dto) {
        const registre = await this.registre(tenantId, registreId, [client_1.StatutRegistreFaiblesses.OUVERT]);
        const faiblesses = await this.prisma.faiblesseControleInterne.findMany({
            where: { tenantId, registreId },
            select: { reference: true, qualification: true, communiqueeLe: true },
        });
        const motifs = FaiblessesService_1.motifsRefusCloture(registre.origine, faiblesses);
        if (motifs.length > 0)
            throw new common_1.ForbiddenException(motifs.join(' · '));
        return this.prisma.registreFaiblesses.update({
            where: { id: registreId },
            data: {
                statut: client_1.StatutRegistreFaiblesses.CLOS,
                closLe: new Date(),
                closPar: userId,
                motifCloture: dto.motifCloture?.trim() || null,
            },
        });
    }
    async lister(tenantId, exerciceId) {
        return this.prisma.registreFaiblesses.findMany({
            where: { tenantId, ...(exerciceId ? { exerciceId } : {}) },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { faiblesses: true } } },
        });
    }
    async consulter(tenantId, registreId) {
        const registre = await this.prisma.registreFaiblesses.findFirst({
            where: { id: registreId, tenantId },
            include: {
                faiblesses: {
                    orderBy: { reference: 'asc' },
                    include: {
                        faiblesseAnterieure: { select: { id: true, reference: true, registreId: true } },
                        reconduction: { select: { id: true, reference: true, registreId: true } },
                    },
                },
            },
        });
        if (!registre)
            throw new common_1.NotFoundException('Registre des faiblesses introuvable.');
        const f = registre.faiblesses;
        const nonSoldees = (x) => x.statut !== client_1.StatutFaiblesse.REMEDIEE && x.statut !== client_1.StatutFaiblesse.SANS_OBJET;
        const significativesAReporter = f.filter((x) => x.qualification === client_1.QualificationFaiblesse.SIGNIFICATIVE && nonSoldees(x) && !x.reconduction);
        return {
            ...registre,
            mentionsContexte: FaiblessesService_1.MENTIONS_CONTEXTE,
            synthese: {
                total: f.length,
                significatives: f.filter((x) => x.qualification === client_1.QualificationFaiblesse.SIGNIFICATIVE).length,
                autres: f.filter((x) => x.qualification === client_1.QualificationFaiblesse.AUTRE).length,
                nonQualifiees: f.filter((x) => x.qualification === client_1.QualificationFaiblesse.NON_QUALIFIEE).length,
                remediees: f.filter((x) => x.statut === client_1.StatutFaiblesse.REMEDIEE).length,
                nonRemedieesAssumees: f.filter((x) => x.statut === client_1.StatutFaiblesse.NON_REMEDIEE_ASSUMEE).length,
                reconduites: f.filter((x) => x.faiblesseAnterieureId).length,
                escaladees: f.filter((x) => x.escaladeeLe).length,
                significativesSansEcrit: f.filter((x) => x.qualification === client_1.QualificationFaiblesse.SIGNIFICATIVE && !x.communiqueeLe).length,
                significativesAReporter: significativesAReporter.length,
                referencesAReporter: significativesAReporter.map((x) => x.reference),
            },
            motifsRefusCloture: FaiblessesService_1.motifsRefusCloture(registre.origine, f.map((x) => ({ reference: x.reference, qualification: x.qualification, communiqueeLe: x.communiqueeLe }))),
        };
    }
};
exports.FaiblessesService = FaiblessesService;
FaiblessesService.INDICATEURS_A7 = [
    'ENVIRONNEMENT_DE_CONTROLE_INEFFICACE',
    'FRAUDE_DE_LA_DIRECTION_NON_PREVENUE',
    'REMEDIATION_ANTERIEURE_NON_MISE_EN_OEUVRE',
    'ABSENCE_DE_PROCESSUS_D_EVALUATION_DES_RISQUES',
    'PROCESSUS_D_EVALUATION_DES_RISQUES_INEFFICACE',
    'REPONSE_INEFFICACE_A_UN_RISQUE_SIGNIFICATIF',
    'ANOMALIES_NON_DETECTEES_PAR_LE_CONTROLE_INTERNE',
    'RETRAITEMENT_D_ETATS_FINANCIERS_DEJA_PUBLIES',
    'INCAPACITE_A_SUPERVISER_L_ETABLISSEMENT_DES_ETATS',
];
FaiblessesService.MENTIONS_CONTEXTE = [
    "Ce registre est tenu au titre de la révision du dossier. Ce n'est pas un audit et aucune opinion sur les états financiers n'en sort.",
    "L'examen du contrôle interne y est celui qui sert à orienter les travaux, non celui qui permettrait d'exprimer une opinion sur son efficacité (§ 11 b) ii).",
    "Les faiblesses portées ici sont celles qui ont été relevées au cours des travaux et jugées d'une importance suffisante pour être rapportées · le registre ne prétend pas les recenser toutes (§ 11 b) iii).",
];
exports.FaiblessesService = FaiblessesService = FaiblessesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FaiblessesService);
//# sourceMappingURL=faiblesses.service.js.map