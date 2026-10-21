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
exports.DonationService = void 0;
exports.manquementsArticle17 = manquementsArticle17;
const common_1 = require("@nestjs/common");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const correspondance_registre_1 = require("./correspondance-registre");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const EPSILON = 0.005;
function versDonation(d) {
    return { ...d, montant: Number(d.montant) };
}
let DonationService = class DonationService {
    constructor(prisma, ecritureService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
    }
    async lister(tenantId, filtre = {}) {
        const where = { tenantId };
        if (filtre.exerciceId) {
            const exercice = await this.exercice(tenantId, filtre.exerciceId);
            where.dateOperation = { gte: exercice.dateDebut, lte: exercice.dateFin };
        }
        if (filtre.masquerAnnulees)
            where.annulee = false;
        if (filtre.recherche?.trim()) {
            const q = filtre.recherche.trim();
            where.OR = [
                { nom: { contains: q, mode: 'insensitive' } },
                { prenoms: { contains: q, mode: 'insensitive' } },
                { denomination: { contains: q, mode: 'insensitive' } },
                { numeroImmatriculation: { contains: q, mode: 'insensitive' } },
                { numeroIdentificationFiscale: { contains: q, mode: 'insensitive' } },
            ];
        }
        const lignes = await this.prisma.donation.findMany({
            where,
            orderBy: { numero: 'asc' },
            include: { ecriture: { select: { id: true, date: true, libelle: true, numeroPiece: true } } },
        });
        return lignes.map(versDonation);
    }
    async inscrire(tenantId, userId, dto) {
        this.verifierCoherenceDonateur(dto);
        if (dto.ecritureId) {
            const ecriture = await this.prisma.ecriture.findFirst({ where: { id: dto.ecritureId, tenantId } });
            if (!ecriture)
                throw new common_1.BadRequestException('Écriture introuvable pour ce dossier (ecritureId).');
            if (ecriture.statut === 'SITUATION') {
                throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifSimulationNonRattachable)(`n° ${ecriture.numeroPiece ?? '·'}`, 'un don du registre'));
            }
        }
        const TENTATIVES = 5;
        for (let essai = 1; essai <= TENTATIVES; essai++) {
            try {
                const cree = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                    const dernier = await tx.donation.findFirst({
                        where: { tenantId },
                        orderBy: { numero: 'desc' },
                        select: { numero: true },
                    });
                    return tx.donation.create({
                        data: {
                            tenantId,
                            numero: (dernier?.numero ?? 0) + 1,
                            dateOperation: new Date(dto.dateOperation),
                            nature: dto.nature,
                            typeDonateur: dto.typeDonateur,
                            nom: dto.nom ?? null,
                            prenoms: dto.prenoms ?? null,
                            domicile: dto.domicile ?? null,
                            denomination: dto.denomination ?? null,
                            numeroImmatriculation: dto.numeroImmatriculation ?? null,
                            numeroIdentificationFiscale: dto.numeroIdentificationFiscale ?? null,
                            adresseSiegeSocial: dto.adresseSiegeSocial ?? null,
                            adresseElectronique: dto.adresseElectronique ?? null,
                            montant: new client_1.Prisma.Decimal(dto.montant),
                            modeLiberation: dto.modeLiberation,
                            designationNature: dto.designationNature ?? null,
                            ecritureId: dto.ecritureId ?? null,
                            createdBy: userId,
                        },
                    });
                });
                return versDonation(cree);
            }
            catch (err) {
                const collision = err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
                if (!collision || essai === TENTATIVES)
                    throw err;
            }
        }
        throw new common_1.ConflictException("Numérotation du registre indisponible, réessayez l'inscription.");
    }
    async modifier(tenantId, id, dto) {
        const ligne = await this.ligne(tenantId, id);
        if (ligne.annulee)
            throw new common_1.BadRequestException('Cette ligne est annulée : elle ne peut plus être modifiée.');
        if (ligne.signeeLe) {
            throw new common_1.BadRequestException('Cette ligne est signée par le représentant légal (art. 17) : la corriger sans annulation reviendrait à modifier une écriture déjà signée. Annulez-la et réinscrivez-la.');
        }
        if (dto.ecritureId) {
            const ecriture = await this.prisma.ecriture.findFirst({ where: { id: dto.ecritureId, tenantId } });
            if (!ecriture)
                throw new common_1.BadRequestException('Écriture introuvable pour ce dossier (ecritureId).');
            if (ecriture.statut === 'SITUATION') {
                throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifSimulationNonRattachable)(`n° ${ecriture.numeroPiece ?? '·'}`, 'un don du registre'));
            }
        }
        this.verifierCoherenceDonateur({ ...ligne, ...dto });
        const maj = await this.prisma.donation.update({ where: { id }, data: { ...dto } });
        return versDonation(maj);
    }
    async signer(tenantId, id, dto) {
        const ligne = await this.ligne(tenantId, id);
        if (ligne.annulee)
            throw new common_1.BadRequestException('Une ligne annulée n’a pas à être signée.');
        const maj = await this.prisma.donation.update({
            where: { id },
            data: { signeePar: dto.signeePar.trim(), signeeLe: new Date() },
        });
        return versDonation(maj);
    }
    async annuler(tenantId, id, dto) {
        const ligne = await this.ligne(tenantId, id);
        if (ligne.annulee)
            throw new common_1.BadRequestException('Cette ligne est déjà annulée.');
        const maj = await this.prisma.donation.update({
            where: { id },
            data: { annulee: true, motifAnnulation: dto.motifAnnulation.trim(), annuleeLe: new Date() },
        });
        return versDonation(maj);
    }
    async rapportConformite(tenantId, exerciceId) {
        const exercice = await this.exercice(tenantId, exerciceId);
        const [toutes, lignesBalance] = await Promise.all([
            this.prisma.donation.findMany({ where: { tenantId }, orderBy: { numero: 'asc' } }),
            (0, etats_financiers_communs_1.chargerLignes)(this.ecritureService, tenantId, exerciceId),
        ]);
        const surExercice = toutes.filter((d) => d.dateOperation >= exercice.dateDebut && d.dateOperation <= exercice.dateFin);
        const actives = surExercice.filter((d) => !d.annulee);
        const totalRegistre = actives.reduce((s, d) => s + Number(d.montant), 0);
        const liberalites = correspondance_registre_1.COMPTES_LIBERALITE.map((c) => this.montantDuCompte(c, lignesBalance));
        const totalComptable = liberalites.reduce((s, c) => s + c.montant, 0);
        const ecart = totalComptable - totalRegistre;
        return {
            exercice: { id: exercice.id, dateDebut: exercice.dateDebut, dateFin: exercice.dateFin },
            existence: {
                registreOuvert: toutes.length > 0,
                lignesTotalRegistre: toutes.length,
                lignesSurExercice: surExercice.length,
                lignesAnnuleesSurExercice: surExercice.length - actives.length,
            },
            numerotation: this.constaterNumerotation(toutes),
            signature: {
                exigence: 'Art. 17 : « Toutes les écritures contenues dans ce registre doivent être signées par le représentant légal de l’entité à but non lucratif. »',
                lignesNonSignees: actives
                    .filter((d) => !d.signeeLe)
                    .map((d) => ({ id: d.id, numero: d.numero, dateOperation: d.dateOperation, montant: Number(d.montant) })),
            },
            completude: {
                lignesIncompletes: actives
                    .map((d) => ({
                    id: d.id,
                    numero: d.numero,
                    dateOperation: d.dateOperation,
                    manquements: manquementsArticle17(d),
                }))
                    .filter((l) => l.manquements.length > 0),
            },
            rapprochement: {
                totalRegistre,
                totalComptable,
                ecart,
                rapproche: Math.abs(ecart) < EPSILON,
                lecture: Math.abs(ecart) < EPSILON
                    ? 'Le total du registre égale le total comptabilisé sur les comptes de libéralité de l’exercice.'
                    : ecart > 0
                        ? 'Des libéralités sont comptabilisées sans être inscrites au registre (art. 24 : défaut de tenue et de mise à jour).'
                        : 'Des libéralités sont inscrites au registre sans contrepartie comptable sur l’exercice.',
                comptesLiberalite: liberalites,
                comptesFrontiere: correspondance_registre_1.COMPTES_FRONTIERE.map((c) => this.montantDuCompte(c, lignesBalance)),
                comptesHorsPerimetre: correspondance_registre_1.COMPTES_HORS_PERIMETRE.map((c) => this.montantDuCompte(c, lignesBalance)),
                avertissement: 'Aucun tableau de correspondance officiel n’existe entre le registre des donateurs et le plan des comptes : le périmètre retenu est construit compte par compte à partir des définitions du référentiel, citées dans chaque ligne. Les comptes « frontière » ne sont pas rapprochés · le texte ne tranche pas s’ils relèvent de l’art. 17.',
            },
        };
    }
    constaterNumerotation(toutes) {
        const numeros = toutes.map((d) => d.numero).sort((a, b) => a - b);
        const trous = [];
        const doublons = [];
        for (let attendu = 1; attendu <= (numeros.at(-1) ?? 0); attendu++) {
            const occurrences = numeros.filter((n) => n === attendu).length;
            if (occurrences === 0)
                trous.push(attendu);
            if (occurrences > 1)
                doublons.push(attendu);
        }
        return {
            exigence: 'Art. 17 : « Le registre des donateurs est coté, paraphé et numéroté de façon continue par la juridiction compétente de chaque État partie concerné. »',
            premier: numeros[0] ?? null,
            dernier: numeros.at(-1) ?? null,
            trous,
            doublons,
            continue: trous.length === 0 && doublons.length === 0,
        };
    }
    montantDuCompte(spec, lignes) {
        const comptes = lignes
            .filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, [spec.numero]))
            .map((l) => ({
            numero: l.numero,
            intitule: l.intitule,
            montant: spec.lecture === 'CREDIT_SEUL' ? l.mouvementCredit : l.mouvementCredit - l.mouvementDebit,
        }))
            .filter((c) => c.montant !== 0);
        return { ...spec, comptes, montant: comptes.reduce((s, c) => s + c.montant, 0) };
    }
    async ligne(tenantId, id) {
        const ligne = await this.prisma.donation.findFirst({ where: { id, tenantId } });
        if (!ligne)
            throw new common_1.NotFoundException('Ligne de registre introuvable pour ce dossier.');
        return ligne;
    }
    async exercice(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        return exercice;
    }
    verifierCoherenceDonateur(d) {
        const champsMorale = ['denomination', 'numeroImmatriculation', 'numeroIdentificationFiscale', 'adresseSiegeSocial'];
        const champsPhysique = ['nom', 'prenoms', 'domicile'];
        if (d.typeDonateur === client_1.TypeDonateur.PERSONNE_PHYSIQUE) {
            const intrus = champsMorale.filter((c) => d[c]);
            if (intrus.length > 0) {
                throw new common_1.BadRequestException(`Donateur personne physique : ${intrus.join(', ')} relève des personnes morales (art. 17, point 3).`);
            }
            if (!d.nom?.trim()) {
                throw new common_1.BadRequestException('Le nom du donateur est requis (art. 17, point 2) : un registre des donateurs nomme ses donateurs.');
            }
        }
        else {
            const intrus = champsPhysique.filter((c) => d[c]);
            if (intrus.length > 0) {
                throw new common_1.BadRequestException(`Donateur personne morale : ${intrus.join(', ')} relève des personnes physiques (art. 17, point 2).`);
            }
            if (!d.denomination?.trim()) {
                throw new common_1.BadRequestException('La dénomination du donateur est requise (art. 17, point 3).');
            }
        }
        if (d.modeLiberation === client_1.ModeLiberation.NATURE && !d.designationNature?.trim()) {
            throw new common_1.BadRequestException('Libération en nature (art. 17, point 4) : la désignation du bien reçu est requise, le montant seul ne dit pas ce qui a été donné.');
        }
    }
};
exports.DonationService = DonationService;
exports.DonationService = DonationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], DonationService);
function manquementsArticle17(d) {
    const manque = [];
    const exiger = (valeur, champ, exigence) => {
        if (!valeur?.trim())
            manque.push({ champ, exigence });
    };
    if (d.typeDonateur === client_1.TypeDonateur.PERSONNE_PHYSIQUE) {
        const point2 = 'Art. 17, point 2 : « les nom et prénoms, le domicile et l’adresse électronique des personnes physiques donatrices ».';
        exiger(d.nom, 'nom', point2);
        exiger(d.prenoms, 'prenoms', point2);
        exiger(d.domicile, 'domicile', point2);
        exiger(d.adresseElectronique, 'adresseElectronique', point2);
    }
    else {
        const point3 = 'Art. 17, point 3 : « la dénomination, le numéro d’immatriculation, le numéro d’identification fiscale, l’adresse du siège social et l’adresse électronique des personnes morales donatrices ».';
        exiger(d.denomination, 'denomination', point3);
        exiger(d.numeroImmatriculation, 'numeroImmatriculation', point3);
        exiger(d.numeroIdentificationFiscale, 'numeroIdentificationFiscale', point3);
        exiger(d.adresseSiegeSocial, 'adresseSiegeSocial', point3);
        exiger(d.adresseElectronique, 'adresseElectronique', point3);
    }
    return manque;
}
//# sourceMappingURL=donation.service.js.map