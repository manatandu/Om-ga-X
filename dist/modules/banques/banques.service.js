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
exports.BanquesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const banques_1 = require("./banques");
const vide = (v) => (v === undefined ? undefined : v.trim() === '' ? null : v.trim());
let BanquesService = class BanquesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    lister(tenantId) {
        return this.prisma.banque.findMany({
            where: { tenantId },
            orderBy: { intitule: 'asc' },
            include: { ribs: { orderBy: { abrege: 'asc' }, include: { journal: { select: { id: true, code: true, intitule: true } } } } },
        });
    }
    async doublon(promesse, message) {
        try {
            return await promesse;
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
                throw new common_1.ConflictException(message);
            throw e;
        }
    }
    async banqueDuDossier(tenantId, id) {
        const b = await this.prisma.banque.findFirst({ where: { id, tenantId } });
        if (!b)
            throw new common_1.NotFoundException('Banque introuvable');
        return b;
    }
    creer(tenantId, dto) {
        return this.doublon(this.prisma.banque.create({
            data: {
                tenantId,
                intitule: dto.intitule.trim(),
                adresse: vide(dto.adresse),
                codePostal: vide(dto.codePostal),
                ville: vide(dto.ville),
                pays: vide(dto.pays),
                telephone: vide(dto.telephone),
                email: vide(dto.email),
                contact: vide(dto.contact),
            },
        }), `Une banque « ${dto.intitule.trim()} » existe déjà dans ce dossier.`);
    }
    async modifier(tenantId, id, dto) {
        await this.banqueDuDossier(tenantId, id);
        return this.doublon(this.prisma.banque.update({
            where: { id },
            data: {
                intitule: dto.intitule?.trim(),
                adresse: vide(dto.adresse),
                codePostal: vide(dto.codePostal),
                ville: vide(dto.ville),
                pays: vide(dto.pays),
                telephone: vide(dto.telephone),
                email: vide(dto.email),
                contact: vide(dto.contact),
            },
        }), `Une banque « ${dto.intitule?.trim()} » existe déjà dans ce dossier.`);
    }
    async supprimer(tenantId, id) {
        await this.banqueDuDossier(tenantId, id);
        await this.prisma.banque.delete({ where: { id } });
        return { supprime: true };
    }
    async champsRib(tenantId, dto, ribId) {
        let iban = vide(dto.iban);
        if (iban) {
            if (!(0, banques_1.ibanValide)(iban))
                throw new common_1.BadRequestException(`IBAN « ${iban} » invalide · la clé de contrôle ne correspond pas (ISO 13616).`);
            iban = (0, banques_1.normaliserIban)(iban);
        }
        let journalId = vide(dto.journalId);
        if (journalId) {
            const journal = await this.prisma.journal.findFirst({
                where: { id: journalId, tenantId },
                select: { code: true, type: true, compteTresorerie: { select: { numero: true } } },
            });
            const motif = (0, banques_1.motifRefusJournalBanque)(journal);
            if (motif)
                throw new common_1.BadRequestException(motif);
            const pris = await this.prisma.ribBanque.findFirst({
                where: { tenantId, journalId, ...(ribId ? { id: { not: ribId } } : {}) },
                select: { abrege: true },
            });
            if (pris)
                throw new common_1.ConflictException(`Le journal ${journal.code} porte déjà le RIB ${pris.abrege} · un journal de banque n'a qu'un RIB.`);
        }
        return {
            abrege: dto.abrege?.trim(),
            devise: vide(dto.devise)?.toUpperCase() ?? (dto.devise === undefined ? undefined : null),
            codeBic: vide(dto.codeBic)?.toUpperCase() ?? (dto.codeBic === undefined ? undefined : null),
            codeBanque: vide(dto.codeBanque),
            codeGuichet: vide(dto.codeGuichet),
            numeroCompte: vide(dto.numeroCompte),
            cle: vide(dto.cle),
            iban,
            commentaire: vide(dto.commentaire),
            journalId,
        };
    }
    async creerRib(tenantId, banqueId, dto) {
        await this.banqueDuDossier(tenantId, banqueId);
        if (!dto.abrege?.trim())
            throw new common_1.BadRequestException("L'abrégé du RIB est obligatoire · c'est lui qui le désigne.");
        const champs = await this.champsRib(tenantId, dto);
        return this.doublon(this.prisma.ribBanque.create({ data: { ...champs, abrege: dto.abrege.trim(), tenantId, banqueId } }), `Un RIB « ${dto.abrege.trim()} » existe déjà dans ce dossier.`);
    }
    async modifierRib(tenantId, ribId, dto) {
        const rib = await this.prisma.ribBanque.findFirst({ where: { id: ribId, tenantId } });
        if (!rib)
            throw new common_1.NotFoundException('RIB introuvable');
        const champs = await this.champsRib(tenantId, dto, ribId);
        return this.doublon(this.prisma.ribBanque.update({ where: { id: ribId }, data: champs }), `Un RIB « ${dto.abrege?.trim()} » existe déjà dans ce dossier.`);
    }
    async supprimerRib(tenantId, ribId) {
        const rib = await this.prisma.ribBanque.findFirst({ where: { id: ribId, tenantId } });
        if (!rib)
            throw new common_1.NotFoundException('RIB introuvable');
        await this.prisma.ribBanque.delete({ where: { id: ribId } });
        return { supprime: true };
    }
    listerLibelles(tenantId) {
        return this.prisma.libelleEcriture.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
    }
    creerLibelle(tenantId, dto) {
        const code = dto.code.trim().toUpperCase();
        return this.doublon(this.prisma.libelleEcriture.create({ data: { tenantId, code, intitule: dto.intitule.trim() } }), `Un libellé de code ${code} existe déjà dans ce dossier.`);
    }
    async modifierLibelle(tenantId, id, dto) {
        const l = await this.prisma.libelleEcriture.findFirst({ where: { id, tenantId } });
        if (!l)
            throw new common_1.NotFoundException('Libellé introuvable');
        const code = dto.code?.trim().toUpperCase();
        return this.doublon(this.prisma.libelleEcriture.update({ where: { id }, data: { code, intitule: dto.intitule?.trim() } }), `Un libellé de code ${code} existe déjà dans ce dossier.`);
    }
    async supprimerLibelle(tenantId, id) {
        const l = await this.prisma.libelleEcriture.findFirst({ where: { id, tenantId } });
        if (!l)
            throw new common_1.NotFoundException('Libellé introuvable');
        await this.prisma.libelleEcriture.delete({ where: { id } });
        return { supprime: true };
    }
};
exports.BanquesService = BanquesService;
exports.BanquesService = BanquesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BanquesService);
//# sourceMappingURL=banques.service.js.map