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
exports.MOTIF_PIECE_RETIREE = exports.PiecesJointesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma.service");
const transaction_journalisee_1 = require("../audit/transaction-journalisee");
const pieces_jointes_1 = require("./pieces-jointes");
const table_des_pieces_1 = require("./table-des-pieces");
const SANS_CONTENU = {
    id: true,
    nomFichier: true,
    typeMime: true,
    taille: true,
    empreinte: true,
    commentaire: true,
    deposePar: true,
    createdAt: true,
};
let PiecesJointesService = class PiecesJointesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    delegue(db, objet) {
        return db[table_des_pieces_1.TABLES_DES_PIECES[objet].delegue];
    }
    async objetDuDossier(db, tenantId, regle, objetId) {
        const objet = await regle.lireObjet(db, tenantId, objetId);
        if (!objet)
            throw new common_1.NotFoundException(`${majuscule(regle.designation)} introuvable pour ce dossier.`);
        return objet;
    }
    async lister(tenantId, regle, objetId) {
        const objet = await this.objetDuDossier(this.prisma, tenantId, regle, objetId);
        const where = { tenantId, [table_des_pieces_1.TABLES_DES_PIECES[regle.objet].colonne]: objetId };
        const table = this.delegue(this.prisma, regle.objet);
        const [pieces, total] = await Promise.all([
            table.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: table_des_pieces_1.PLAFOND_PIECES_PAR_LISTE, select: SANS_CONTENU }),
            table.count({ where }),
        ]);
        const horsPerimetre = objet.motifHorsPerimetre ?? null;
        const depot = horsPerimetre ?? objet.motifRefusDepot;
        const retrait = horsPerimetre ?? objet.motifRefusRetrait;
        return {
            description: objet.description,
            pieces,
            total,
            tronque: total > pieces.length,
            depot: { permis: depot === null, motif: depot },
            retrait: { permis: retrait === null, motif: retrait },
        };
    }
    async deposer(tenantId, regle, objetId, fichier, commentaire, auteur) {
        const objet = await this.objetDuDossier(this.prisma, tenantId, regle, objetId);
        if (objet.motifHorsPerimetre)
            throw new common_1.ForbiddenException(objet.motifHorsPerimetre);
        if (objet.motifRefusDepot)
            throw new common_1.BadRequestException(objet.motifRefusDepot);
        if (!fichier)
            throw new common_1.BadRequestException('Aucun fichier reçu.');
        const nomRecu = (0, pieces_jointes_1.decoderNomMultipart)(fichier.originalname);
        const refus = (0, pieces_jointes_1.motifRefusDocument)({ nom: nomRecu, contenu: fichier.buffer, commentaire });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const nomFichier = (0, pieces_jointes_1.nettoyerNomFichier)(nomRecu);
        const type = (0, pieces_jointes_1.identifierType)(fichier.buffer, nomFichier);
        if ('refus' in type)
            throw new common_1.BadRequestException(type.refus);
        const commun = {
            tenantId,
            nomFichier,
            typeMime: type.typeMime,
            taille: fichier.buffer.length,
            empreinte: (0, pieces_jointes_1.empreinteDocument)(fichier.buffer),
            commentaire: commentaire?.trim() || null,
            contenu: fichier.buffer,
            deposePar: auteur,
        };
        try {
            return await this.creer(regle.objet, objetId, objet.description, commun);
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException(`Ce fichier est déjà joint à ${regle.designation} (même contenu).`);
            }
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
                throw new common_1.ConflictException(`${majuscule(regle.designation)} a été retiré pendant le dépôt · rien n'a été joint. Rechargez.`);
            }
            throw e;
        }
    }
    creer(objet, objetId, description, commun) {
        switch (objet) {
            case 'ECRITURE':
                return this.prisma.pieceJointeEcriture.create({
                    data: { ...commun, ecritureId: objetId, ecritureDecrite: description },
                    select: { ...SANS_CONTENU, ecritureId: true, ecritureDecrite: true },
                });
            case 'SECTION':
                return this.prisma.pieceJointeSection.create({
                    data: { ...commun, sectionId: objetId },
                    select: { ...SANS_CONTENU, sectionId: true },
                });
            case 'IMMOBILISATION':
                return this.prisma.pieceJointeImmobilisation.create({
                    data: { ...commun, immobilisationId: objetId },
                    select: { ...SANS_CONTENU, immobilisationId: true },
                });
            case 'SALARIE':
                return this.prisma.pieceJointeSalarie.create({
                    data: { ...commun, salarieId: objetId },
                    select: { ...SANS_CONTENU, salarieId: true },
                });
        }
    }
    async telecharger(tenantId, objet, id) {
        const piece = (await this.delegue(this.prisma, objet).findFirst({
            where: { id, tenantId },
            select: { nomFichier: true, typeMime: true, contenu: true },
        }));
        if (!piece)
            throw new common_1.NotFoundException('Pièce introuvable pour ce dossier.');
        return piece;
    }
    async modifierCommentaire(tenantId, objet, id, commentaire) {
        const texte = (commentaire ?? '').trim();
        if (texte.length > pieces_jointes_1.LONGUEUR_MAX_COMMENTAIRE) {
            throw new common_1.BadRequestException(`Le commentaire dépasse ${pieces_jointes_1.LONGUEUR_MAX_COMMENTAIRE} caractères (${texte.length}).`);
        }
        const table = this.delegue(this.prisma, objet);
        const piece = await table.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!piece)
            throw new common_1.NotFoundException('Pièce introuvable pour ce dossier.');
        try {
            return await table.update({ where: { id }, data: { commentaire: texte || null }, select: SANS_CONTENU });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2025')
                throw new common_1.ConflictException(exports.MOTIF_PIECE_RETIREE);
            throw e;
        }
    }
    async retirer(tenantId, regle, id) {
        const colonne = table_des_pieces_1.TABLES_DES_PIECES[regle.objet].colonne;
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const table = this.delegue(tx, regle.objet);
            const piece = await table.findFirst({ where: { id, tenantId }, select: { id: true, [colonne]: true } });
            if (!piece)
                throw new common_1.NotFoundException('Pièce introuvable pour ce dossier.');
            const objetId = piece[colonne];
            let objet = null;
            if (objetId) {
                if (regle.verrouiller)
                    await regle.verrouiller(tx, tenantId, objetId);
                const relue = await table.findFirst({ where: { id, tenantId }, select: { id: true, [colonne]: true } });
                if (!relue)
                    throw new common_1.ConflictException(exports.MOTIF_PIECE_RETIREE);
                const maintenant = relue[colonne];
                if (maintenant !== null && maintenant !== objetId) {
                    throw new common_1.ConflictException("Cette pièce a été reportée ailleurs pendant le retrait (ce qui la portait a été remplacé) · rien n'est retiré, rechargez la liste.");
                }
                if (maintenant !== null)
                    objet = await regle.lireObjet(tx, tenantId, objetId);
            }
            if (objet) {
                if (objet.motifHorsPerimetre)
                    throw new common_1.ForbiddenException(objet.motifHorsPerimetre);
                if (objet.motifRefusRetrait)
                    throw new common_1.ConflictException(objet.motifRefusRetrait);
            }
            else {
                const horsPerimetre = regle.motifHorsPerimetreDetachee?.() ?? null;
                if (horsPerimetre)
                    throw new common_1.ForbiddenException(horsPerimetre);
            }
            try {
                await table.delete({ where: { id }, select: { id: true } });
            }
            catch (e) {
                if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2025')
                    throw new common_1.ConflictException(exports.MOTIF_PIECE_RETIREE);
                throw e;
            }
        });
        return { retire: true };
    }
    async listerDetachees(tenantId) {
        const [pieces, total] = await Promise.all([
            this.prisma.pieceJointeEcriture.findMany({
                where: { tenantId, ecritureId: null },
                orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
                take: table_des_pieces_1.PLAFOND_PIECES_PAR_LISTE,
                select: { ...SANS_CONTENU, ecritureDecrite: true },
            }),
            this.prisma.pieceJointeEcriture.count({ where: { tenantId, ecritureId: null } }),
        ]);
        return { pieces, total, tronque: total > pieces.length };
    }
    async decompteParEcriture(tenantId, exerciceId) {
        const PLAFOND = 20_000;
        const groupes = await this.prisma.pieceJointeEcriture.groupBy({
            by: ['ecritureId'],
            where: { tenantId, ecriture: { is: { tenantId, exerciceId } } },
            _count: { _all: true },
            orderBy: { ecritureId: 'asc' },
            take: PLAFOND + 1,
        });
        const retenus = groupes.slice(0, PLAFOND);
        return {
            parEcriture: Object.fromEntries(retenus.filter((g) => g.ecritureId).map((g) => [g.ecritureId, g._count._all])),
            tronque: groupes.length > PLAFOND,
        };
    }
};
exports.PiecesJointesService = PiecesJointesService;
exports.PiecesJointesService = PiecesJointesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PiecesJointesService);
exports.MOTIF_PIECE_RETIREE = 'Cette pièce a été retirée par un autre geste pendant le vôtre · rechargez la liste.';
function majuscule(texte) {
    return texte.charAt(0).toUpperCase() + texte.slice(1);
}
//# sourceMappingURL=pieces-jointes.service.js.map