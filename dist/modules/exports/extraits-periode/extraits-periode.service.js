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
var ExtraitsPeriodeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtraitsPeriodeService = void 0;
exports.motifInterruption = motifInterruption;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../common/prisma.service");
const transaction_journalisee_1 = require("../../../common/audit/transaction-journalisee");
const periode_extrait_1 = require("../../comptabilite/periode-extrait");
const ecritures_de_situation_1 = require("../../comptabilite/ecritures-de-situation");
function motifInterruption(e) {
    const brut = e instanceof Error ? e.message : String(e);
    return `Production interrompue · ${brut}`.slice(0, 500);
}
let ExtraitsPeriodeService = ExtraitsPeriodeService_1 = class ExtraitsPeriodeService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(ExtraitsPeriodeService_1.name);
    }
    async numeroter(d) {
        const cree = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`extraits-periode:${d.tenantId}`}))`;
            const max = await tx.extraitPeriode.aggregate({ where: { tenantId: d.tenantId }, _max: { numero: true } });
            return tx.extraitPeriode.create({
                data: {
                    tenantId: d.tenantId,
                    numero: (max._max.numero ?? 0) + 1,
                    nature: d.nature,
                    libelle: d.libelle,
                    dateDebut: d.periode.du,
                    dateFin: d.periode.au,
                    etabliPar: d.etabliPar,
                    termineLe: null,
                },
            });
        });
        return { id: cree.id, numero: cree.numero, etabliLe: cree.etabliLe, periode: d.periode };
    }
    async produire(d, travail) {
        let id = null;
        const numeroter = async () => {
            if (id)
                throw new Error('Un extrait de période ne se numérote qu’une fois.');
            const e = await this.numeroter(d);
            id = e.id;
            return e;
        };
        let resultat;
        try {
            resultat = await travail(numeroter);
        }
        catch (e) {
            if (id) {
                await this.prisma.extraitPeriode
                    .update({ where: { id }, data: { motifEchec: motifInterruption(e) } })
                    .catch((err) => this.logger.error(`Extrait de période ${id} · interruption non écrite (${err instanceof Error ? err.message : String(err)})`));
            }
            throw e;
        }
        if (id) {
            await this.prisma.extraitPeriode
                .update({ where: { id }, data: { termineLe: new Date() } })
                .catch((err) => this.logger.error(`Extrait de période ${id} · fichier remis, fin non écrite (${err instanceof Error ? err.message : String(err)})`));
        }
        return resultat;
    }
    async refuserSiVide(tenantId, exerciceId, periode, compteId) {
        const lignes = await this.prisma.ligneEcriture.count({
            where: {
                ...(compteId ? { compteId } : {}),
                ecriture: { tenantId, exerciceId, ...ecritures_de_situation_1.HORS_SITUATION, date: { lt: periode.finExclue } },
            },
        });
        if (lignes === 0) {
            throw new common_1.BadRequestException(`Aucune écriture jusqu'au ${(0, periode_extrait_1.jourFr)(periode.au)}${compteId ? ' sur ce compte' : ''} · ni report ni mouvement, rien à numéroter.`);
        }
    }
    async libelleDe(tenantId, nature, o = {}) {
        if (nature === client_1.NatureExtraitPeriode.BALANCE) {
            return o.avecGrandsLivres ? 'Balance des comptes, avec le grand livre de chaque compte' : 'Balance des comptes';
        }
        if (!o.compteId)
            return 'Grand livre des comptes';
        const compte = await this.prisma.compte.findFirst({ where: { id: o.compteId, tenantId }, select: { numero: true, intitule: true } });
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable dans ce dossier.');
        return `Grand livre du compte ${compte.numero} · ${compte.intitule}`;
    }
};
exports.ExtraitsPeriodeService = ExtraitsPeriodeService;
exports.ExtraitsPeriodeService = ExtraitsPeriodeService = ExtraitsPeriodeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExtraitsPeriodeService);
//# sourceMappingURL=extraits-periode.service.js.map