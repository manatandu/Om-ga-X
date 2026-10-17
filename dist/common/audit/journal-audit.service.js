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
exports.JournalAuditService = exports.CARACTERE_NUL = exports.TAILLE_PAGE_JOURNAL_MAX = exports.TAILLE_PAGE_JOURNAL_DEFAUT = void 0;
exports.instantTransmissible = instantTransmissible;
exports.motifFiltreIllisible = motifFiltreIllisible;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const empreinte_audit_1 = require("./empreinte-audit");
const LOT_VERIFICATION = 5_000;
exports.TAILLE_PAGE_JOURNAL_DEFAUT = 50;
exports.TAILLE_PAGE_JOURNAL_MAX = 200;
function instantTransmissible(date) {
    return !Number.isNaN(date.getTime()) && /^\d{4}-/.test(date.toISOString());
}
exports.CARACTERE_NUL = '\u0000';
function motifFiltreIllisible(filtre) {
    const nombres = [
        ['Numéro de page', filtre.page],
        ['Taille de page', filtre.taille],
    ];
    for (const [nom, valeur] of nombres) {
        if (valeur !== undefined && !Number.isSafeInteger(valeur))
            return `${nom} illisible.`;
    }
    const dates = [
        ['Date de début', filtre.depuis],
        ['Date de fin', filtre.jusqua],
    ];
    for (const [nom, valeur] of dates) {
        if (valeur !== undefined && !(valeur instanceof Date && instantTransmissible(valeur))) {
            return `${nom} illisible.`;
        }
    }
    const textes = [
        ['Objet', filtre.entite],
        ['Identifiant d’objet', filtre.entiteId],
        ['Auteur', filtre.acteurEmail],
    ];
    for (const [nom, valeur] of textes) {
        if (valeur !== undefined && (typeof valeur !== 'string' || valeur.includes(exports.CARACTERE_NUL))) {
            return `${nom} illisible.`;
        }
    }
    return null;
}
let JournalAuditService = class JournalAuditService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId, filtre) {
        const motif = motifFiltreIllisible(filtre);
        if (motif)
            throw new common_1.BadRequestException(motif);
        const taille = Math.min(Math.max(filtre.taille ?? exports.TAILLE_PAGE_JOURNAL_DEFAUT, 1), exports.TAILLE_PAGE_JOURNAL_MAX);
        const page = Math.max(filtre.page ?? 1, 1);
        const where = {
            tenantId,
            ...(filtre.entite ? { entite: filtre.entite } : {}),
            ...(filtre.entiteId ? { entiteId: filtre.entiteId } : {}),
            ...(filtre.acteurEmail ? { acteurEmail: filtre.acteurEmail } : {}),
            ...(filtre.depuis || filtre.jusqua
                ? { horodatage: { ...(filtre.depuis ? { gte: filtre.depuis } : {}), ...(filtre.jusqua ? { lte: filtre.jusqua } : {}) } }
                : {}),
        };
        const [total, evenements] = await Promise.all([
            this.prisma.evenementAudit.count({ where }),
            this.prisma.evenementAudit.findMany({
                where,
                orderBy: { rang: 'desc' },
                skip: (page - 1) * taille,
                take: taille,
            }),
        ]);
        return { total, page, taille, evenements };
    }
    async verifier(tenantId) {
        const ruptures = [];
        let attendue = empreinte_audit_1.EMPREINTE_ORIGINE;
        let rangAttendu = 1;
        let compte = 0;
        let apres = 0;
        while (true) {
            const lot = await this.prisma.evenementAudit.findMany({
                where: { tenantId, rang: { gt: apres } },
                orderBy: { rang: 'asc' },
                take: LOT_VERIFICATION,
            });
            if (lot.length === 0)
                break;
            const dernier = lot[lot.length - 1].rang;
            if (dernier <= apres)
                break;
            compte += lot.length;
            apres = dernier;
            this.verifierLot(lot, ruptures, () => attendue, (v) => { attendue = v; }, () => rangAttendu, (v) => { rangAttendu = v; });
        }
        return { evenements: compte, intacte: ruptures.length === 0, ruptures };
    }
    verifierLot(evenements, ruptures, lireAttendue, ecrireAttendue, lireRangAttendu, ecrireRangAttendu) {
        let attendue = lireAttendue();
        let rangAttendu = lireRangAttendu();
        for (const e of evenements) {
            if (e.rang !== rangAttendu) {
                ruptures.push({ rang: e.rang, id: e.id, motif: 'RANG_MANQUANT' });
                rangAttendu = e.rang;
            }
            if (e.empreintePrecedente !== attendue) {
                ruptures.push({ rang: e.rang, id: e.id, motif: 'CHAINAGE_ROMPU' });
            }
            const recalculee = (0, empreinte_audit_1.calculerEmpreinte)({
                rang: e.rang,
                tenantId: e.tenantId,
                horodatage: e.horodatage,
                acteurId: e.acteurId,
                acteurEmail: e.acteurEmail,
                adresseIp: e.adresseIp,
                action: e.action,
                entite: e.entite,
                entiteId: e.entiteId,
                avant: e.avant,
                apres: e.apres,
                empreintePrecedente: e.empreintePrecedente,
            });
            if (recalculee !== e.empreinte) {
                ruptures.push({ rang: e.rang, id: e.id, motif: 'EMPREINTE_INVALIDE' });
            }
            attendue = e.empreinte;
            rangAttendu = e.rang + 1;
        }
        ecrireAttendue(attendue);
        ecrireRangAttendu(rangAttendu);
    }
};
exports.JournalAuditService = JournalAuditService;
exports.JournalAuditService = JournalAuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], JournalAuditService);
//# sourceMappingURL=journal-audit.service.js.map