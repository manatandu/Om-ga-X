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
exports.JOURNAL_FACULTATIF = exports.JournalFacultatifDuDossier = exports.MESSAGE_JOURNAL_HORS_DOSSIER = exports.MESSAGE_JOURNAL_ILLISIBLE = void 0;
const common_1 = require("@nestjs/common");
const exercice_requis_1 = require("./exercice-requis");
const prisma_service_1 = require("./prisma.service");
exports.MESSAGE_JOURNAL_ILLISIBLE = "Le paramètre journalId, quand il est donné, doit être un identifiant de journal valide · un identifiant illisible n'est jamais lu comme un journal vide.";
exports.MESSAGE_JOURNAL_HORS_DOSSIER = 'Journal introuvable dans ce dossier.';
const FORMAT_FACULTATIF = new common_1.ParseUUIDPipe({
    optional: true,
    exceptionFactory: () => new common_1.BadRequestException(exports.MESSAGE_JOURNAL_ILLISIBLE),
});
let JournalFacultatifDuDossier = class JournalFacultatifDuDossier {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async transform(valeur, metadata) {
        const id = await FORMAT_FACULTATIF.transform(valeur, metadata);
        if (id === undefined || id === null)
            return id;
        const tenantId = (0, exercice_requis_1.dossierDeLaSession)();
        const journal = await this.prisma.journal.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!journal)
            throw new common_1.NotFoundException(exports.MESSAGE_JOURNAL_HORS_DOSSIER);
        return id;
    }
};
exports.JournalFacultatifDuDossier = JournalFacultatifDuDossier;
JournalFacultatifDuDossier.format = FORMAT_FACULTATIF;
exports.JournalFacultatifDuDossier = JournalFacultatifDuDossier = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], JournalFacultatifDuDossier);
exports.JOURNAL_FACULTATIF = JournalFacultatifDuDossier;
//# sourceMappingURL=journal-du-dossier.js.map