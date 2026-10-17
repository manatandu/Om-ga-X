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
exports.EmballagesService = void 0;
const common_1 = require("@nestjs/common");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const consignation_1 = require("./consignation");
const nomenclature_emballages_1 = require("./nomenclature-emballages");
const rattachement_ecriture_1 = require("../comptabilite/rattachement-ecriture");
const ETAT_PAR_MODE = {
    RESTITUTION: client_1.EtatConsignation.RESTITUEE,
    CONSERVATION: client_1.EtatConsignation.CONSERVEE,
    REPRISE_PRIX_INFERIEUR: client_1.EtatConsignation.REPRISE_SOUS_PRIX,
};
let EmballagesService = class EmballagesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId) {
        const [consignations, tenant] = await Promise.all([
            this.prisma.consignation.findMany({
                where: { tenantId },
                include: { tiers: { select: { code: true, nom: true } } },
                orderBy: [{ etat: 'asc' }, { dateConsignation: 'desc' }],
            }),
            this.prisma.tenant.findUniqueOrThrow({
                where: { id: tenantId },
                select: { referentiel: true },
            }),
        ]);
        const enCours = consignations.filter((c) => c.etat === client_1.EtatConsignation.EN_COURS);
        const somme = (sens) => enCours
            .filter((c) => c.sens === sens)
            .reduce((t, c) => t + Number(c.montant), 0);
        return {
            referentiel: tenant.referentiel,
            consignations: consignations.map((c) => ({
                id: c.id,
                tiers: c.tiers,
                sens: c.sens,
                nature: c.nature,
                designation: c.designation,
                quantite: c.quantite === null ? null : Number(c.quantite),
                dateConsignation: c.dateConsignation.toISOString().slice(0, 10),
                montant: Number(c.montant),
                etat: c.etat,
                dateDenouement: c.dateDenouement?.toISOString().slice(0, 10) ?? null,
                prixDeReprise: c.prixDeReprise === null ? null : Number(c.prixDeReprise),
                ecritureConsignationId: c.ecritureConsignationId,
                ecritureDenouementId: c.ecritureDenouementId,
            })),
            enAttente: {
                nombre: enCours.length,
                detteEmise: somme(client_1.SensConsignation.EMISE),
                creanceRecue: somme(client_1.SensConsignation.RECUE),
            },
        };
    }
    async creer(tenantId, userId, dto) {
        const tiers = await this.prisma.tiers.findFirst({
            where: { id: dto.tiersId, tenantId },
            select: {
                id: true,
                nom: true,
                comptesRattaches: { select: { estPrincipal: true, compte: { select: { numero: true, intitule: true } } } },
            },
        });
        if (!tiers)
            throw new common_1.NotFoundException('Tiers introuvable dans ce dossier.');
        const principal = this.comptePrincipal(tiers);
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        const avant = (0, consignation_1.lignesDeLaConsignation)({
            sens: dto.sens === client_1.SensConsignation.EMISE ? 'EMISE' : 'RECUE',
            nature: dto.nature === 'EMBALLAGE' ? 'EMBALLAGE' : 'MATERIEL',
            compteTiers: principal.compte.numero,
            intituleTiers: principal.compte.intitule,
            montant: Number(dto.montant),
            designation: dto.designation.trim(),
        }, referentiel);
        if (avant.refus)
            throw new common_1.BadRequestException(avant.refus.explication);
        const consignation = await this.prisma.consignation.create({
            data: {
                tenantId,
                tiersId: dto.tiersId,
                sens: dto.sens,
                nature: dto.nature,
                designation: dto.designation.trim(),
                quantite: dto.quantite ?? null,
                dateConsignation: new Date(dto.dateConsignation),
                montant: dto.montant,
                createdBy: userId,
            },
        });
        return { consignation, proposition: await this.propositionOuverture(tenantId, consignation.id) };
    }
    async supprimer(tenantId, consignationId) {
        const c = await this.prisma.consignation.findFirst({
            where: { id: consignationId, tenantId },
            select: { id: true, etat: true, ecritureConsignationId: true, ecritureDenouementId: true },
        });
        if (!c)
            throw new common_1.NotFoundException('Consignation introuvable dans ce dossier.');
        if (c.etat !== client_1.EtatConsignation.EN_COURS) {
            throw new common_1.BadRequestException('Cette consignation est dénouée · elle reste au registre avec son dénouement.');
        }
        if (c.ecritureConsignationId || c.ecritureDenouementId) {
            throw new common_1.BadRequestException("Cette consignation est rattachée à une écriture · détachez-la d'abord, sans quoi le compte d'attente " +
                "garderait une écriture que plus rien ne justifie au registre.");
        }
        await this.prisma.consignation.delete({ where: { id: c.id } });
        return { supprimee: true };
    }
    async propositionOuverture(tenantId, consignationId) {
        const { calcul, referentiel } = await this.chargerPourCalcul(tenantId, consignationId);
        return (0, consignation_1.lignesDeLaConsignation)(calcul, referentiel);
    }
    async propositionDenouement(tenantId, consignationId, mode, prixDeReprise) {
        const { calcul, referentiel } = await this.chargerPourCalcul(tenantId, consignationId);
        return (0, consignation_1.lignesDuDenouement)(calcul, mode, referentiel, prixDeReprise);
    }
    async denouer(tenantId, consignationId, dto) {
        const { calcul, referentiel, etat } = await this.chargerPourCalcul(tenantId, consignationId);
        if (etat !== client_1.EtatConsignation.EN_COURS) {
            throw new common_1.BadRequestException(`Cette consignation est déjà dénouée (${etat}). Un dénouement ne se rejoue pas · il ` +
                "faudrait d'abord défaire l'écriture passée, ce qui appartient au journal.");
        }
        const proposition = (0, consignation_1.lignesDuDenouement)(calcul, dto.mode, referentiel, dto.prixDeReprise);
        if (proposition.refus) {
            throw new common_1.BadRequestException(proposition.refus.explication);
        }
        const consignation = await this.prisma.consignation.update({
            where: { id: consignationId },
            data: {
                etat: ETAT_PAR_MODE[dto.mode],
                dateDenouement: new Date(dto.dateDenouement),
                prixDeReprise: dto.mode === 'REPRISE_PRIX_INFERIEUR' ? (dto.prixDeReprise ?? null) : null,
            },
        });
        return { consignation, proposition };
    }
    comptePrincipal(tiers) {
        const rattaches = tiers.comptesRattaches;
        const principal = rattaches.find((r) => r.estPrincipal) ?? rattaches[0];
        if (!principal) {
            throw new common_1.BadRequestException(`Le tiers « ${tiers.nom} » n'a aucun compte rattaché. Une consignation s'ouvre CONTRE ` +
                "un tiers : sans son compte, il n'y a pas d'écriture à proposer. Rattachez-lui un " +
                'compte au plan des tiers.');
        }
        return principal;
    }
    async chargerPourCalcul(tenantId, consignationId) {
        const c = await this.prisma.consignation.findFirst({
            where: { id: consignationId, tenantId },
            include: {
                tiers: {
                    select: {
                        nom: true,
                        comptesRattaches: {
                            select: { estPrincipal: true, compte: { select: { numero: true, intitule: true } } },
                        },
                    },
                },
            },
        });
        if (!c)
            throw new common_1.NotFoundException('Consignation introuvable dans ce dossier.');
        const principal = this.comptePrincipal(c.tiers);
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        const calcul = {
            sens: c.sens === client_1.SensConsignation.EMISE ? 'EMISE' : 'RECUE',
            nature: c.nature === 'EMBALLAGE' ? 'EMBALLAGE' : 'MATERIEL',
            compteTiers: principal.compte.numero,
            intituleTiers: principal.compte.intitule,
            montant: Number(c.montant),
            designation: c.designation,
        };
        return {
            calcul,
            referentiel,
            etat: c.etat,
            prixDeReprise: c.prixDeReprise === null ? null : Number(c.prixDeReprise),
            liens: {
                OUVERTURE: c.ecritureConsignationId,
                DENOUEMENT: c.ecritureDenouementId,
            },
        };
    }
    async lignesAttendues(tenantId, consignationId, role) {
        const charge = await this.chargerPourCalcul(tenantId, consignationId);
        if (role === 'OUVERTURE') {
            return { charge, proposition: (0, consignation_1.lignesDeLaConsignation)(charge.calcul, charge.referentiel) };
        }
        if (charge.etat === client_1.EtatConsignation.EN_COURS) {
            throw new common_1.BadRequestException("Cette consignation n'est pas dénouée au registre · une écriture de dénouement ne se rattache " +
                "qu'à un dénouement enregistré, sans quoi le registre dirait la consignation ouverte pendant " +
                'que son compte d\'attente est déjà soldé.');
        }
        return {
            charge,
            proposition: (0, consignation_1.lignesDuDenouement)(charge.calcul, MODE_PAR_ETAT[charge.etat], charge.referentiel, charge.prixDeReprise),
        };
    }
    async ecrituresCandidates(tenantId, consignationId, roleBrut) {
        const role = roleEcriture(roleBrut);
        const { charge, proposition } = await this.lignesAttendues(tenantId, consignationId, role);
        if (proposition.refus)
            return [];
        const attente = proposition.lignes.find((l) => l.compte === compteDAttente(charge.calcul, charge.referentiel));
        if (!attente)
            return [];
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: {
                ecriture: { tenantId, estGenereeParCloture: false, ...ecritures_de_situation_1.HORS_SITUATION },
                compte: { numero: { startsWith: attente.compte } },
                ...(attente.sens === 'DEBIT' ? { debit: attente.montant } : { credit: attente.montant }),
            },
            select: { ecritureId: true },
            take: 200,
        });
        const ids = [...new Set(lignes.map((l) => l.ecritureId))];
        if (ids.length === 0)
            return [];
        const [ecritures, dejaPrises] = await Promise.all([
            this.prisma.ecriture.findMany({
                where: { tenantId, id: { in: ids }, ...ecritures_de_situation_1.HORS_SITUATION },
                orderBy: [{ date: 'desc' }],
                select: {
                    id: true,
                    date: true,
                    numeroPiece: true,
                    libelle: true,
                    statut: true,
                    lignes: { select: { debit: true, credit: true, compte: { select: { numero: true } } } },
                },
            }),
            this.prisma.consignation.findMany({
                where: {
                    tenantId,
                    OR: [{ ecritureConsignationId: { in: ids } }, { ecritureDenouementId: { in: ids } }],
                },
                select: { ecritureConsignationId: true, ecritureDenouementId: true },
            }),
        ]);
        const prises = new Set(dejaPrises.flatMap((c) => [c.ecritureConsignationId, c.ecritureDenouementId]));
        return ecritures
            .filter((e) => !prises.has(e.id))
            .filter((e) => (0, rattachement_ecriture_1.lignesManquantes)(proposition.lignes, lignesDe(e.lignes)).length === 0)
            .map((e) => ({
            id: e.id,
            date: e.date.toISOString().slice(0, 10),
            numeroPiece: e.numeroPiece,
            libelle: e.libelle,
            statut: e.statut,
        }));
    }
    async rattacherEcriture(tenantId, consignationId, roleBrut, ecritureId) {
        const role = roleEcriture(roleBrut);
        const { charge, proposition } = await this.lignesAttendues(tenantId, consignationId, role);
        if (proposition.refus)
            throw new common_1.BadRequestException(proposition.refus.explication);
        if (charge.liens[role] !== null) {
            throw new common_1.BadRequestException(`Une écriture ${LIBELLE_ROLE[role]} est déjà rattachée à cette consignation · détachez-la d'abord.`);
        }
        const ecriture = await this.prisma.ecriture.findFirst({
            where: { id: ecritureId, tenantId },
            select: {
                id: true,
                estGenereeParCloture: true,
                statut: true,
                numeroPiece: true,
                lignes: { select: { debit: true, credit: true, compte: { select: { numero: true } } } },
            },
        });
        if (!ecriture)
            throw new common_1.NotFoundException("L'écriture indiquée n'existe pas dans ce dossier.");
        if (ecriture.statut === client_1.StatutEcriture.SITUATION) {
            throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifSimulationNonRattachable)(`n° ${ecriture.numeroPiece ?? '·'}`, 'une consignation'));
        }
        if (ecriture.estGenereeParCloture) {
            throw new common_1.BadRequestException('Une écriture de clôture ou de report à nouveau ne passe aucune consignation · elle reprend des soldes.');
        }
        const manquantes = (0, rattachement_ecriture_1.lignesManquantes)(proposition.lignes, lignesDe(ecriture.lignes));
        if (manquantes.length > 0) {
            throw new common_1.BadRequestException(`Cette écriture ne passe pas l'écriture ${LIBELLE_ROLE[role]} proposée · il lui manque ` +
                `${manquantes.map(rattachement_ecriture_1.decrireLigne).join(', ')}. Rattachée quand même, le registre se dirait ` +
                'comptabilisé sur une pièce qui passe autre chose.');
        }
        const autre = await this.prisma.consignation.count({
            where: { tenantId, OR: [{ ecritureConsignationId: ecritureId }, { ecritureDenouementId: ecritureId }] },
        });
        if (autre > 0) {
            throw new common_1.BadRequestException("Cette écriture est déjà rattachée à une consignation · une même ligne au compte d'attente ne " +
                'justifie pas deux consignations.');
        }
        const { count } = await this.prisma.consignation.updateMany({
            where: role === 'OUVERTURE'
                ? { id: consignationId, tenantId, ecritureConsignationId: null }
                : { id: consignationId, tenantId, ecritureDenouementId: null },
            data: role === 'OUVERTURE' ? { ecritureConsignationId: ecritureId } : { ecritureDenouementId: ecritureId },
        });
        if (count === 0) {
            throw new common_1.BadRequestException(`Une écriture ${LIBELLE_ROLE[role]} vient d'être rattachée à cette consignation par une autre demande.`);
        }
        return { rattache: true, role, ecritureId };
    }
    async detacherEcriture(tenantId, consignationId, roleBrut) {
        const role = roleEcriture(roleBrut);
        const c = await this.prisma.consignation.findFirst({
            where: { id: consignationId, tenantId },
            select: { ecritureConsignationId: true, ecritureDenouementId: true },
        });
        if (!c)
            throw new common_1.NotFoundException('Consignation introuvable dans ce dossier.');
        const ecritureId = role === 'OUVERTURE' ? c.ecritureConsignationId : c.ecritureDenouementId;
        if (ecritureId === null) {
            throw new common_1.BadRequestException(`Aucune écriture ${LIBELLE_ROLE[role]} n'est rattachée à cette consignation.`);
        }
        const ecriture = await this.prisma.ecriture.findFirst({
            where: { id: ecritureId, tenantId },
            select: { statut: true },
        });
        if (ecriture && ecriture.statut === client_1.StatutEcriture.VALIDEE) {
            throw new common_1.BadRequestException("L'écriture rattachée est validée · elle est entrée au livre-journal (AUDCIF art. 22, 2°), et " +
                'son lien est la trace de ce qui a passé la consignation. Il ne se défait plus.');
        }
        const { count } = await this.prisma.consignation.updateMany({
            where: role === 'OUVERTURE'
                ? { id: consignationId, tenantId, ecritureConsignationId: ecritureId }
                : { id: consignationId, tenantId, ecritureDenouementId: ecritureId },
            data: role === 'OUVERTURE' ? { ecritureConsignationId: null } : { ecritureDenouementId: null },
        });
        if (count === 0) {
            throw new common_1.BadRequestException('Le lien a changé entre-temps · rechargez le registre.');
        }
        return { detache: true, role };
    }
};
exports.EmballagesService = EmballagesService;
exports.EmballagesService = EmballagesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EmballagesService);
const LIBELLE_ROLE = {
    OUVERTURE: "d'ouverture",
    DENOUEMENT: 'de dénouement',
};
const MODE_PAR_ETAT = {
    RESTITUEE: 'RESTITUTION',
    CONSERVEE: 'CONSERVATION',
    REPRISE_SOUS_PRIX: 'REPRISE_PRIX_INFERIEUR',
};
function roleEcriture(brut) {
    const role = String(brut).toUpperCase();
    if (role !== 'OUVERTURE' && role !== 'DENOUEMENT') {
        throw new common_1.BadRequestException("Le rôle de l'écriture est « ouverture » ou « denouement ».");
    }
    return role;
}
function compteDAttente(c, referentiel) {
    return (0, nomenclature_emballages_1.compteDuRole)(c.sens === 'EMISE' ? 'DETTE_CONSIGNATION' : 'CREANCE_CONSIGNATION', referentiel).numero;
}
function lignesDe(lignes) {
    return lignes.map((l) => ({ numero: l.compte.numero, debit: Number(l.debit), credit: Number(l.credit) }));
}
//# sourceMappingURL=emballages.service.js.map