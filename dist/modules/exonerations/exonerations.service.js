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
exports.PLAFOND_LISTE_EXONERATIONS = exports.ExonerationsService = void 0;
exports.filtreEnAlerte = filtreEnAlerte;
exports.motifRefusAccorde = motifRefusAccorde;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const correspondance_exonerations_1 = require("./correspondance-exonerations");
const ajouter_mois_1 = require("../../common/ajouter-mois");
const periode_de_liste_1 = require("../../common/periode-de-liste");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
function filtreEnAlerte(aujourdhui) {
    return {
        statut: client_1.StatutExoneration.ACCORDE,
        dateFinValidite: { lte: new Date(aujourdhui.getTime() + correspondance_exonerations_1.JOURS_ALERTE_RENOUVELLEMENT * MS_PAR_JOUR) },
    };
}
function motifRefusAccorde(d) {
    const manques = [
        !d.referenceArrete?.trim() ? 'la référence de l’arrêté' : null,
        !d.dateArrete ? 'la date de l’arrêté' : null,
        d.validiteMois && !d.dateDebutValidite ? 'le début de validité' : null,
    ].filter((m) => m !== null);
    return manques.length === 0
        ? null
        : `Un dossier ACCORDÉ se dit par son arrêté · il manque ${manques.join(', ')} (loi n° 004/2001, art. 39).`;
}
let ExonerationsService = class ExonerationsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    referentiel() {
        return {
            modeles: correspondance_exonerations_1.MODELES_DEMANDE,
            franchisesDouanieres: correspondance_exonerations_1.FRANCHISES_DOUANIERES_EBNL,
            joursAlerteRenouvellement: correspondance_exonerations_1.JOURS_ALERTE_RENOUVELLEMENT,
            avertissement: correspondance_exonerations_1.AVERTISSEMENT_FRANCHISE,
        };
    }
    enrichir(dossier, aujourdhui) {
        const modele = correspondance_exonerations_1.MODELES_DEMANDE.find((m) => m.type === dossier.type);
        const fournies = new Set(dossier.piecesFournies);
        const pieces = modele.pieces.map((p) => ({ ...p, fournie: fournies.has(p.cle) }));
        const manquantes = pieces.filter((p) => !p.fournie && !p.conditionnelle);
        const conditionnellesAVerifier = pieces.filter((p) => !p.fournie && p.conditionnelle);
        let joursAvantExpiration = null;
        let alerte = null;
        if (dossier.dateFinValidite && dossier.statut === client_1.StatutExoneration.ACCORDE) {
            joursAvantExpiration = Math.ceil((dossier.dateFinValidite.getTime() - aujourdhui.getTime()) / MS_PAR_JOUR);
            if (joursAvantExpiration < 0)
                alerte = 'EXPIRE';
            else if (joursAvantExpiration <= correspondance_exonerations_1.JOURS_ALERTE_RENOUVELLEMENT)
                alerte = 'A_RENOUVELER';
        }
        return {
            modele: { libelle: modele.libelle, objet: modele.objet, baseLegale: modele.baseLegale, validiteMois: modele.validiteMois },
            pieces,
            nombrePiecesFournies: pieces.filter((p) => p.fournie).length,
            nombrePiecesRequises: modele.pieces.filter((p) => !p.conditionnelle).length,
            piecesManquantes: manquantes.map((p) => p.libelle),
            conditionnellesAVerifier: conditionnellesAVerifier.map((p) => ({ libelle: p.libelle, condition: p.conditionnelle })),
            complet: manquantes.length === 0,
            joursAvantExpiration,
            alerte,
        };
    }
    async lister(tenantId, dateReference, filtre = {}) {
        const periode = (0, periode_de_liste_1.lirePeriodeDeListe)(filtre);
        const aujourdhui = dateReference ? new Date(dateReference) : new Date();
        let aRenouveler = 0;
        let expires = 0;
        let incomplets = 0;
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.exoneration.findMany({
            where: { tenantId },
            select: { id: true, type: true, statut: true, dateFinValidite: true, piecesFournies: true },
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
        }), (d) => {
            const e = this.enrichir(d, aujourdhui);
            if (e.alerte === 'A_RENOUVELER')
                aRenouveler++;
            if (e.alerte === 'EXPIRE')
                expires++;
            if (!e.complet && d.statut === client_1.StatutExoneration.EN_PREPARATION)
                incomplets++;
        });
        const perimetre = periode.bornes
            ? { OR: [{ createdAt: periode.bornes }, filtreEnAlerte(aujourdhui)] }
            : {};
        const [dossiers, total] = await Promise.all([
            this.prisma.exoneration.findMany({
                where: { tenantId, ...perimetre },
                orderBy: [{ dateFinValidite: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
                take: exports.PLAFOND_LISTE_EXONERATIONS,
            }),
            this.prisma.exoneration.count({ where: { tenantId, ...perimetre } }),
        ]);
        const enrichis = dossiers.map((d) => ({
            ...d,
            valeurBiens: d.valeurBiens === null ? null : Number(d.valeurBiens),
            ...this.enrichir(d, aujourdhui),
        }));
        return {
            dateReference: aujourdhui,
            periode: { du: periode.du, au: periode.au },
            total,
            plafond: exports.PLAFOND_LISTE_EXONERATIONS,
            tronque: total > dossiers.length,
            dossiers: enrichis,
            aRenouveler,
            expires,
            incomplets,
            avertissement: correspondance_exonerations_1.AVERTISSEMENT_FRANCHISE,
        };
    }
    async creer(tenantId, userId, dto) {
        const modele = correspondance_exonerations_1.MODELES_DEMANDE.find((m) => m.type === dto.type);
        let dateFin = dto.dateFinValidite ? new Date(dto.dateFinValidite) : null;
        if (!dateFin && dto.dateDebutValidite && modele.validiteMois) {
            dateFin = (0, ajouter_mois_1.ajouterMois)(new Date(dto.dateDebutValidite), modele.validiteMois);
        }
        if (dto.statut === client_1.StatutExoneration.ACCORDE) {
            const refus = motifRefusAccorde({
                referenceArrete: dto.referenceArrete ?? null,
                dateArrete: dto.dateArrete ? new Date(dto.dateArrete) : null,
                dateDebutValidite: dto.dateDebutValidite ? new Date(dto.dateDebutValidite) : null,
                validiteMois: modele.validiteMois,
            });
            if (refus)
                throw new common_1.BadRequestException(refus);
        }
        return this.prisma.exoneration.create({
            data: {
                tenantId,
                createdBy: userId,
                type: dto.type,
                objet: dto.objet,
                statut: dto.statut ?? client_1.StatutExoneration.EN_PREPARATION,
                referenceArrete: dto.referenceArrete ?? null,
                dateArrete: dto.dateArrete ? new Date(dto.dateArrete) : null,
                dateDebutValidite: dto.dateDebutValidite ? new Date(dto.dateDebutValidite) : null,
                dateFinValidite: dateFin,
                lettreTransport: dto.lettreTransport ?? null,
                valeurBiens: dto.valeurBiens ?? null,
                franchiseDouaniere: dto.franchiseDouaniere ?? null,
                piecesFournies: dto.piecesFournies ?? [],
                observations: dto.observations ?? null,
            },
        });
    }
    async modifier(tenantId, id, dto) {
        const existant = await this.prisma.exoneration.findFirst({ where: { id, tenantId } });
        if (!existant)
            throw new common_1.NotFoundException('Dossier d’exonération introuvable');
        const dates = ['dateArrete', 'dateDebutValidite', 'dateFinValidite'];
        const data = {};
        for (const [cle, valeur] of Object.entries(dto)) {
            if (valeur === undefined)
                continue;
            data[cle] = dates.includes(cle) && valeur ? new Date(valeur) : valeur;
        }
        const modele = correspondance_exonerations_1.MODELES_DEMANDE.find((m) => m.type === existant.type);
        const apres = { ...existant, ...data };
        if (modele.validiteMois && apres.dateDebutValidite && data.dateFinValidite === undefined && (data.dateDebutValidite !== undefined || !existant.dateFinValidite)) {
            data.dateFinValidite = (0, ajouter_mois_1.ajouterMois)(apres.dateDebutValidite, modele.validiteMois);
        }
        const toucheLArrete = ['referenceArrete', 'dateArrete', 'dateDebutValidite'].some((c) => c in data);
        if (data.statut === client_1.StatutExoneration.ACCORDE || (apres.statut === client_1.StatutExoneration.ACCORDE && toucheLArrete)) {
            const refus = motifRefusAccorde({
                referenceArrete: apres.referenceArrete,
                dateArrete: apres.dateArrete,
                dateDebutValidite: apres.dateDebutValidite,
                validiteMois: modele.validiteMois,
            });
            if (refus)
                throw new common_1.BadRequestException(refus);
        }
        return this.prisma.exoneration.update({ where: { id }, data });
    }
    async supprimer(tenantId, id) {
        const existant = await this.prisma.exoneration.findFirst({ where: { id, tenantId } });
        if (!existant)
            throw new common_1.NotFoundException('Dossier d’exonération introuvable');
        await this.prisma.exoneration.delete({ where: { id } });
        return { supprime: true };
    }
};
exports.ExonerationsService = ExonerationsService;
exports.ExonerationsService = ExonerationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExonerationsService);
exports.PLAFOND_LISTE_EXONERATIONS = 500;
//# sourceMappingURL=exonerations.service.js.map