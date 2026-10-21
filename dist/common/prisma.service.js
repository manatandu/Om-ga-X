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
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const extension_audit_1 = require("./audit/extension-audit");
const extension_cloisonnement_1 = require("./cloisonnement/extension-cloisonnement");
const extension_perimetre_journaux_1 = require("./perimetre/extension-perimetre-journaux");
const extension_journal_de_situation_1 = require("./journal-de-situation/extension-journal-de-situation");
const pooling_base_1 = require("./pooling-base");
let PrismaService = PrismaService_1 = class PrismaService extends client_1.PrismaClient {
    constructor() {
        super();
        const nu = this;
        const etendu = this.$extends((0, extension_cloisonnement_1.extensionCloisonnement)(this))
            .$extends((0, extension_perimetre_journaux_1.extensionPerimetreJournaux)(this))
            .$extends((0, extension_journal_de_situation_1.extensionJournalDeSituation)(this))
            .$extends((0, extension_audit_1.extensionAudit)(this));
        Object.defineProperty(etendu, 'clientNu', { value: nu, enumerable: false });
        return etendu;
    }
    async onModuleInit() {
        await this.$connect();
        new common_1.Logger(PrismaService_1.name).log((0, pooling_base_1.messageDePooling)((0, pooling_base_1.lireEtatDuPooling)(process.env.DATABASE_URL)));
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map