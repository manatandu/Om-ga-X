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
var DossierRevisionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DossierRevisionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const regles_comptes_sycebnl_1 = require("./regles-comptes-sycebnl");
const regles_comptes_syscohada_1 = require("./regles-comptes-syscohada");
let DossierRevisionService = DossierRevisionService_1 = class DossierRevisionService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    static regleDe(numero, table) {
        let choisie = null;
        for (const r of table) {
            if (!numero.startsWith(r.numero))
                continue;
            if (!choisie || r.numero.length > choisie.numero.length)
                choisie = r;
        }
        return choisie;
    }
    regles(referentiel) {
        if (referentiel === client_1.Referentiel.SYCEBNL)
            return regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL;
        if (referentiel === client_1.Referentiel.SYSCOHADA)
            return regles_comptes_syscohada_1.REGLES_COMPTES_SYSCOHADA;
        return [];
    }
    async dossier(tenantId, exerciceId, referentiel) {
        const table = this.regles(referentiel);
        const mouvements = await this.prisma.ligneEcriture.groupBy({
            by: ['compteId'],
            where: { ecriture: { tenantId, exerciceId, statut: client_1.StatutEcriture.VALIDEE, estSoldeDesComptesDeGestion: false } },
            _sum: { debit: true, credit: true },
        });
        if (!mouvements.length)
            return { comptes: [] };
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, id: { in: mouvements.map((m) => m.compteId) } },
            select: { id: true, numero: true, intitule: true },
            orderBy: { numero: 'asc' },
        });
        const parId = new Map(mouvements.map((m) => [m.compteId, m]));
        return {
            comptes: comptes.map((c) => {
                const m = parId.get(c.id);
                const debit = Number(m._sum.debit ?? 0);
                const credit = Number(m._sum.credit ?? 0);
                const regle = DossierRevisionService_1.regleDe(c.numero, table);
                return {
                    compteId: c.id,
                    numero: c.numero,
                    intitule: c.intitule,
                    debit,
                    credit,
                    solde: debit - credit,
                    ficheNumero: regle?.numero ?? null,
                    elementsDeControle: regle?.elementsDeControle ?? null,
                    exclusions: regle?.exclusions ?? null,
                };
            }),
        };
    }
};
exports.DossierRevisionService = DossierRevisionService;
exports.DossierRevisionService = DossierRevisionService = DossierRevisionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DossierRevisionService);
//# sourceMappingURL=dossier-revision.service.js.map