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
exports.EXERCICE_D_UNE_CELLULE = exports.EXERCICE_FACULTATIF = exports.EXERCICE_REQUIS = exports.ExerciceFacultatifDuDossier = exports.ExerciceRequisDuDossier = exports.MESSAGE_EXERCICE_HORS_DOSSIER = exports.MESSAGE_EXERCICE_ILLISIBLE = exports.MESSAGE_EXERCICE_REQUIS = void 0;
exports.dossierDeLaSession = dossierDeLaSession;
exports.exigerExerciceDuDossier = exigerExerciceDuDossier;
exports.exigerExercice = exigerExercice;
const common_1 = require("@nestjs/common");
const contexte_audit_1 = require("./audit/contexte-audit");
const prisma_service_1 = require("./prisma.service");
exports.MESSAGE_EXERCICE_REQUIS = "Le paramètre exerciceId est requis et doit être un identifiant d'exercice valide · chaque état et chaque lecture portent sur un seul exercice.";
exports.MESSAGE_EXERCICE_ILLISIBLE = "Le paramètre exerciceId, quand il est donné, doit être un identifiant d'exercice valide · un identifiant illisible n'est jamais lu comme « tous les exercices » ni comme un exercice vide.";
exports.MESSAGE_EXERCICE_HORS_DOSSIER = 'Exercice introuvable dans ce dossier.';
const FORMAT_REQUIS = new common_1.ParseUUIDPipe({
    exceptionFactory: () => new common_1.BadRequestException(exports.MESSAGE_EXERCICE_REQUIS),
});
const FORMAT_FACULTATIF = new common_1.ParseUUIDPipe({
    optional: true,
    exceptionFactory: () => new common_1.BadRequestException(exports.MESSAGE_EXERCICE_ILLISIBLE),
});
function dossierDeLaSession() {
    const tenantId = (0, contexte_audit_1.acteurCourant)()?.tenantId;
    if (!tenantId) {
        throw new Error("Aucun dossier de session pour juger l'appartenance d'un identifiant · la route doit être derrière JwtAuthGuard (exercice-requis.ts).");
    }
    return tenantId;
}
async function exigerExerciceDuDossier(prisma, exerciceId) {
    const tenantId = dossierDeLaSession();
    const exercice = await prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true } });
    if (!exercice)
        throw new common_1.NotFoundException(exports.MESSAGE_EXERCICE_HORS_DOSSIER);
}
let ExerciceRequisDuDossier = class ExerciceRequisDuDossier {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async transform(valeur, metadata) {
        const id = await FORMAT_REQUIS.transform(valeur, metadata);
        await exigerExerciceDuDossier(this.prisma, id);
        return id;
    }
};
exports.ExerciceRequisDuDossier = ExerciceRequisDuDossier;
ExerciceRequisDuDossier.format = FORMAT_REQUIS;
exports.ExerciceRequisDuDossier = ExerciceRequisDuDossier = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExerciceRequisDuDossier);
let ExerciceFacultatifDuDossier = class ExerciceFacultatifDuDossier {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async transform(valeur, metadata) {
        const id = await FORMAT_FACULTATIF.transform(valeur, metadata);
        if (id === undefined || id === null)
            return id;
        await exigerExerciceDuDossier(this.prisma, id);
        return id;
    }
};
exports.ExerciceFacultatifDuDossier = ExerciceFacultatifDuDossier;
ExerciceFacultatifDuDossier.format = FORMAT_FACULTATIF;
exports.ExerciceFacultatifDuDossier = ExerciceFacultatifDuDossier = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExerciceFacultatifDuDossier);
exports.EXERCICE_REQUIS = ExerciceRequisDuDossier;
exports.EXERCICE_FACULTATIF = ExerciceFacultatifDuDossier;
exports.EXERCICE_D_UNE_CELLULE = new common_1.ParseUUIDPipe({
    exceptionFactory: () => new common_1.BadRequestException(exports.MESSAGE_EXERCICE_REQUIS),
});
function exigerExercice(exerciceId) {
    if (typeof exerciceId !== 'string' || exerciceId.trim() === '')
        throw new common_1.BadRequestException(exports.MESSAGE_EXERCICE_REQUIS);
}
//# sourceMappingURL=exercice-requis.js.map