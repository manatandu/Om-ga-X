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
exports.OrdresVirementService = exports.PLAFOND_ORDRES_LISTES = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const ribs_tiers_1 = require("../tiers/ribs-tiers");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const echeance_1 = require("../../common/echeance");
const mentions_societe_1 = require("../tenant/mentions-societe");
const modeles_impression_service_1 = require("../tiers/modeles-impression.service");
const modeles_impression_1 = require("../tiers/modeles-impression");
const avis_reglement_1 = require("./avis-reglement");
const round2 = (n) => Math.round(n * 100) / 100;
exports.PLAFOND_ORDRES_LISTES = 500;
let OrdresVirementService = class OrdresVirementService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async preparer(tenantId, journalId, compteIds) {
        const donneur = await this.donneurDuJournal(tenantId, journalId);
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, id: { in: compteIds } },
            select: {
                id: true,
                numero: true,
                tiersCompte: { select: { tiers: { select: { id: true, code: true, nom: true, ribs: { where: { tenantId, estPrincipal: true } } } } } },
            },
        });
        const beneficiaires = new Map();
        const manques = [];
        for (const id of compteIds) {
            const c = comptes.find((x) => x.id === id);
            const tiers = c?.tiersCompte?.tiers;
            if (!c || !tiers) {
                manques.push(`le compte ${c?.numero ?? id} n'est rattaché à aucun tiers`);
                continue;
            }
            const principal = tiers.ribs[0];
            if (!principal) {
                manques.push(`${tiers.code} · ${tiers.nom} n'a pas de RIB principal`);
                continue;
            }
            beneficiaires.set(id, {
                tiersId: tiers.id,
                salarieId: null,
                beneficiaire: principal.titulaire ?? tiers.nom,
                banque: principal.banque,
                coordonnees: (0, ribs_tiers_1.coordonneesImprimees)(principal),
                codeBic: principal.codeBic,
            });
        }
        if (manques.length) {
            throw new common_1.BadRequestException(`Ordre de virement impossible · ${manques.join(' ; ')}. Renseignez les coordonnées bancaires dans la fiche du tiers, ou décochez l'ordre de virement.`);
        }
        return { donneur, beneficiaires };
    }
    async preparerSalaries(tenantId, journalId, salaries) {
        const donneur = await this.donneurDuJournal(tenantId, journalId);
        const ribs = await this.prisma.ribSalarie.findMany({
            where: { tenantId, estPrincipal: true, salarieId: { in: salaries.map((s) => s.id) } },
        });
        const beneficiaires = new Map();
        const manques = [];
        const enDevise = [];
        for (const s of salaries) {
            const principal = ribs.find((r) => r.salarieId === s.id);
            if (!principal) {
                manques.push(s.nomComplet);
                continue;
            }
            const devise = (principal.devise ?? '').trim().toUpperCase();
            if (devise && devise !== monnaie_de_tenue_1.MONNAIE_DE_TENUE) {
                enDevise.push(`${s.nomComplet} (${devise})`);
                continue;
            }
            beneficiaires.set(s.id, {
                tiersId: null,
                salarieId: s.id,
                beneficiaire: principal.titulaire ?? s.nomComplet,
                banque: principal.banque,
                coordonnees: (0, ribs_tiers_1.coordonneesImprimees)(principal),
                codeBic: principal.codeBic,
            });
        }
        if (manques.length) {
            throw new common_1.BadRequestException(`Ordre de virement impossible · aucun RIB principal pour ${manques.join(', ')}. Renseignez les coordonnées bancaires dans le Registre du personnel (administrateur), ou payez ces salariés par un autre mode.`);
        }
        if (enDevise.length) {
            throw new common_1.BadRequestException(`Ordre de virement impossible · le RIB principal de ${enDevise.join(', ')} est tenu hors de la monnaie de tenue, quand l'ordre des salaires est en ${monnaie_de_tenue_1.MONNAIE_DE_TENUE} · la banque convertirait à un cours que le bulletin ne dit pas. Désignez un RIB principal en ${monnaie_de_tenue_1.MONNAIE_DE_TENUE} (Registre du personnel, administrateur), ou payez ces salariés par un autre mode.`);
        }
        return { donneur, beneficiaires };
    }
    async donneurDuJournal(tenantId, journalId) {
        const rib = await this.prisma.ribBanque.findFirst({
            where: { tenantId, journalId },
            include: { banque: { select: { intitule: true } }, journal: { select: { code: true } } },
        });
        if (!rib) {
            const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { code: true } });
            throw new common_1.BadRequestException(`Aucun RIB n'est rattaché au journal ${journal?.code ?? ''} (Structure > Banques) · l'ordre de virement n'aurait pas de compte à débiter.`);
        }
        const refusDevise = (0, ribs_tiers_1.motifRefusDeviseDonneur)(rib.devise, rib.journal?.code ?? '');
        if (refusDevise)
            throw new common_1.BadRequestException(refusDevise);
        const donneur = { banque: rib.banque.intitule, coordonnees: (0, ribs_tiers_1.coordonneesImprimees)({ ...rib, banque: rib.banque.intitule }), codeBic: rib.codeBic };
        if (!donneur.coordonnees) {
            throw new common_1.BadRequestException(`Le RIB ${rib.abrege} ne porte ni IBAN ni numéro de compte · complétez-le dans Structure > Banques.`);
        }
        return donneur;
    }
    async creer(tenantId, email, journalId, date, preparation, lignes) {
        const creer = () => (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, (tx) => this.creerDans(tx, tenantId, email, journalId, date, preparation, lignes));
        for (let essai = 0;; essai++) {
            try {
                return await creer();
            }
            catch (e) {
                if (essai < 2 && e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
                    continue;
                throw e;
            }
        }
    }
    async creerDans(tx, tenantId, email, journalId, date, preparation, lignes) {
        const total = round2(lignes.reduce((s, l) => s + l.montant, 0));
        const dernier = await tx.ordreVirement.aggregate({ where: { tenantId }, _max: { numero: true } });
        return tx.ordreVirement.create({
            data: {
                tenantId,
                numero: (dernier._max.numero ?? 0) + 1,
                date: new Date(date),
                journalId,
                donneurBanque: preparation.donneur.banque,
                donneurCoordonnees: preparation.donneur.coordonnees,
                donneurBic: preparation.donneur.codeBic,
                total,
                creePar: email,
                lignes: {
                    create: lignes.map((l) => {
                        const cle = l.salarieId ?? l.compteId ?? '';
                        const b = preparation.beneficiaires.get(cle);
                        if (!b)
                            throw new common_1.BadRequestException(`Bénéficiaire non préparé pour la ligne ${cle} · l'ordre n'est pas créé.`);
                        return {
                            tenantId,
                            tiersId: b.tiersId,
                            salarieId: b.salarieId,
                            beneficiaire: b.beneficiaire,
                            banque: b.banque,
                            coordonnees: b.coordonnees,
                            codeBic: b.codeBic,
                            montant: round2(l.montant),
                            reference: l.reference,
                            pieceReglement: l.pieceReglement,
                            imputationDeclaree: l.imputationDeclaree ?? null,
                            ecritureId: l.ecritureId,
                        };
                    }),
                },
            },
            select: { id: true, numero: true, total: true },
        });
    }
    async lister(tenantId, statut, personnelOuvert = true) {
        if (statut !== undefined && !Object.values(client_1.StatutOrdreVirement).includes(statut)) {
            throw new common_1.BadRequestException(`État d'ordre de virement inconnu : ${String(statut)}. États admis : ${Object.values(client_1.StatutOrdreVirement).join(', ')}.`);
        }
        const parEtat = statut === undefined ? {} : { statut };
        const horsPaie = personnelOuvert ? {} : { lignes: { none: { salarieId: { not: null } } } };
        const [ordres, total, enAttenteImpression] = await Promise.all([
            this.prisma.ordreVirement.findMany({
                where: { tenantId, ...parEtat, ...horsPaie },
                orderBy: { numero: 'desc' },
                take: exports.PLAFOND_ORDRES_LISTES,
                include: { journal: { select: { code: true, intitule: true } }, _count: { select: { lignes: true } } },
            }),
            this.prisma.ordreVirement.count({ where: { tenantId, ...parEtat, ...horsPaie } }),
            this.prisma.ordreVirement.count({ where: { tenantId, statut: client_1.StatutOrdreVirement.A_IMPRIMER, ...horsPaie } }),
        ]);
        return { ordres, total, tronque: total > ordres.length, enAttenteImpression, statut: statut ?? null };
    }
    async detail(tenantId, id, personnelOuvert = true) {
        const ordre = await this.prisma.ordreVirement.findFirst({
            where: { id, tenantId },
            include: {
                journal: { select: { code: true, intitule: true } },
                lignes: { orderBy: { beneficiaire: 'asc' } },
            },
        });
        if (!ordre)
            throw new common_1.NotFoundException('Ordre de virement introuvable pour ce dossier.');
        if (!personnelOuvert && ordre.lignes.some((l) => l.salarieId !== null)) {
            throw new common_1.ForbiddenException("Cet ordre de virement paie des salaires · le personnel n'est pas ouvert à votre rôle.");
        }
        return ordre;
    }
    async imprimer(tenantId, id, email, personnelOuvert = true) {
        const ordre = await this.detail(tenantId, id, personnelOuvert);
        const refus = (0, ribs_tiers_1.motifRefusImpression)(ordre.statut);
        if (refus)
            throw new common_1.BadRequestException(refus);
        const premiere = ordre.statut === client_1.StatutOrdreVirement.A_IMPRIMER;
        await this.prisma.ordreVirement.update({
            where: { id: ordre.id },
            data: {
                nombreImpressions: { increment: 1 },
                ...(premiere ? { statut: client_1.StatutOrdreVirement.IMPRIME, premiereImpressionLe: new Date(), premiereImpressionPar: email } : {}),
            },
        });
        return this.detail(tenantId, id);
    }
    async avisReglement(tenantId, id, personnelOuvert = true) {
        const ordre = await this.detail(tenantId, id, personnelOuvert);
        const refus = (0, avis_reglement_1.motifRefusAvis)(ordre.statut);
        if (refus)
            throw new common_1.BadRequestException(refus);
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        const jour = (0, echeance_1.jourDeKinshasa)(new Date());
        const entite = [tenant?.nom ?? '', tenant ? (0, mentions_societe_1.mentionsEmetteur)((0, mentions_societe_1.identiteSociete)(tenant), jour).ligne : null].filter((x) => x).join('\n');
        const lignesTiers = ordre.lignes.filter((l) => l.tiersId !== null);
        const cadres = await (0, modeles_impression_service_1.cadresDesTiers)(this.prisma, tenantId, lignesTiers.map((l) => l.tiersId), 'REGLEMENT', { entite, jour }, avis_reglement_1.CADRE_AVIS_PAR_DEFAUT);
        return {
            ordre: { id: ordre.id, numero: ordre.numero, date: ordre.date, statut: ordre.statut },
            avis: lignesTiers.map((l) => {
                const cadre = cadres.get(l.tiersId) ?? null;
                const document = (0, avis_reglement_1.documentAvisReglement)({ montant: Number(l.montant), banque: l.banque, reference: l.reference, imputationDeclaree: l.imputationDeclaree }, ordre, entite);
                return { ligneId: l.id, beneficiaire: l.beneficiaire, montant: Number(l.montant), modele: cadre?.modele ?? null, texte: (0, modeles_impression_1.habiller)(cadre, document) };
            }),
            lignesDeSalaires: ordre.lignes.length - lignesTiers.length,
        };
    }
    async annuler(tenantId, id, email, motif, personnelOuvert = true) {
        const ordre = await this.detail(tenantId, id, personnelOuvert);
        const refus = (0, ribs_tiers_1.motifRefusAnnulation)(ordre.statut, motif);
        if (refus)
            throw new common_1.BadRequestException(refus);
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, (tx) => this.annulerDans(tx, tenantId, ordre.id, email, motif));
        return this.detail(tenantId, id, personnelOuvert);
    }
    async annulerDans(tx, tenantId, ordreId, email, motif) {
        await tx.ligneOrdreVirement.updateMany({ where: { tenantId, ordreId }, data: { ecritureId: null } });
        await tx.ordreVirement.update({
            where: { id: ordreId },
            data: { statut: client_1.StatutOrdreVirement.ANNULE, annuleLe: new Date(), annulePar: email, motifAnnulation: motif.trim() },
        });
    }
};
exports.OrdresVirementService = OrdresVirementService;
exports.OrdresVirementService = OrdresVirementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrdresVirementService);
//# sourceMappingURL=ordres-virement.service.js.map