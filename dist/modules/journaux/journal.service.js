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
exports.JournalService = void 0;
const comptes_proposes_1 = require("../comptes/comptes-proposes");
const common_1 = require("@nestjs/common");
const references_1 = require("../../common/suppression/references");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const journal_seed_1 = require("./journal-seed");
const numerotation_piece_1 = require("./numerotation-piece");
const subdivisions_du_plan_1 = require("../comptes/subdivisions-du-plan");
const collectifs_tiers_1 = require("../tiers/collectifs-tiers");
const compte_propre_du_journal_1 = require("./compte-propre-du-journal");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
function conflitDuCompteOuvert(e, numero, code, numeroChoisi) {
    if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const cible = e.meta?.target;
        const colonnes = Array.isArray(cible) ? cible.map(String) : typeof cible === 'string' ? [cible] : [];
        const sur = (col) => colonnes.some((c) => c === col || c.endsWith(`_${col}_key`) || c.includes(`_${col}_`));
        if (sur('numero')) {
            throw new common_1.ConflictException(numeroChoisi
                ? `Le compte ${numero} existe déjà dans ce dossier · choisissez un autre numéro, ou relisez la proposition.`
                : `Le compte ${numero} vient d'être ouvert par une autre saisie · relancez la création, le numéro suivant sera proposé.`);
        }
        if (sur('code'))
            throw new common_1.ConflictException(`Le journal ${code} vient d'être créé par une autre saisie · relancez la demande.`);
    }
    throw e;
}
let JournalService = class JournalService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async seedJournauxDefaut(tenantId, referentiel, client = this.prisma) {
        for (const j of (0, journal_seed_1.journauxDefaut)(referentiel)) {
            let compteTresorerieId;
            if (j.numeroCompteTresorerie) {
                const compte = await client.compte.findUnique({
                    where: { tenantId_numero: { tenantId, numero: j.numeroCompteTresorerie } },
                });
                compteTresorerieId = compte?.id;
            }
            await client.journal.upsert({
                where: { tenantId_code: { tenantId, code: j.code } },
                update: {},
                create: {
                    tenantId,
                    code: j.code,
                    intitule: j.intitule,
                    type: j.type,
                    numerotation: j.numerotation,
                    compteTresorerieId,
                },
            });
        }
    }
    async lister(tenantId, actifsSeuls) {
        return this.prisma.journal.findMany({
            where: { tenantId, ...(actifsSeuls ? { estActif: true } : {}) },
            include: { compteTresorerie: true },
            orderBy: { code: 'asc' },
        });
    }
    async trouver(tenantId, journalId) {
        const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId } });
        if (!journal) {
            throw new common_1.NotFoundException('Journal introuvable pour ce tenant');
        }
        return journal;
    }
    async creer(tenantId, dto) {
        if (dto.ouvrirCompteSousId && dto.compteTresorerieId) {
            throw new common_1.BadRequestException('Choisissez un compte existant OU ouvrez le compte propre du journal, pas les deux.');
        }
        if (dto.ouvrirCompteSousId && dto.type !== client_1.TypeJournal.TRESORERIE) {
            throw new common_1.BadRequestException('Seul un journal de trésorerie (banque, caisse) ouvre son compte propre.');
        }
        if (dto.numeroCompte !== undefined && !dto.ouvrirCompteSousId) {
            throw new common_1.BadRequestException("Un numéro de compte ne se choisit qu'avec le compte du plan sous lequel ouvrir le compte du journal.");
        }
        if (dto.type === client_1.TypeJournal.TRESORERIE && !dto.compteTresorerieId && !dto.ouvrirCompteSousId) {
            throw new common_1.BadRequestException('Un journal de type Trésorerie doit avoir un compte de trésorerie associé');
        }
        if (dto.type === client_1.TypeJournal.SITUATION && dto.numerotation === client_1.NumerotationPiece.CONTINUE_FICHIER) {
            throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifSituationHorsSequenceDuFichier)(dto.code));
        }
        const existant = await this.prisma.journal.findUnique({ where: { tenantId_code: { tenantId, code: dto.code } } });
        if (existant) {
            throw new common_1.ConflictException(`Le journal ${dto.code} existe déjà pour ce tenant`);
        }
        if (dto.compteTresorerieId)
            await this.verifierCompteTresorerie(tenantId, dto.compteTresorerieId);
        const donnees = {
            tenantId,
            code: dto.code,
            intitule: dto.intitule,
            type: dto.type,
            numerotation: dto.numerotation ?? numerotation_piece_1.NUMEROTATION_PAR_DEFAUT,
            contrepartieChaqueLigne: dto.type === client_1.TypeJournal.TRESORERIE && dto.contrepartieChaqueLigne === true,
        };
        if (!dto.ouvrirCompteSousId) {
            return this.prisma.journal.create({ data: { ...donnees, compteTresorerieId: dto.compteTresorerieId } });
        }
        const ouvert = await this.compteAOuvrir(tenantId, dto.ouvrirCompteSousId);
        const juger = (numero) => {
            if (numero === null)
                throw new common_1.BadRequestException(ouvert.motif ?? 'Aucun numéro libre sous ce compte du plan.');
            const motif = (0, compte_propre_du_journal_1.motifRefusNumeroDuJournal)(numero, ouvert.parent.numero, ouvert.racine, ouvert.longueur, ouvert.referentiel);
            if (motif)
                throw new common_1.BadRequestException(motif);
            return numero;
        };
        const numeroChoisi = dto.numeroCompte !== undefined;
        let numeroRetenu = numeroChoisi ? juger(dto.numeroCompte ?? null) : juger(ouvert.propose);
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`panoplie:${tenantId}`}))`;
            if (!numeroChoisi) {
                const existants = await tx.compte.findMany({
                    where: { tenantId, numero: { startsWith: ouvert.racine } },
                    select: { numero: true },
                });
                numeroRetenu = juger((0, collectifs_tiers_1.prochainNumeroIndividuel)(ouvert.racine, ouvert.longueur, [ouvert.parent.numero, ...existants.map((c) => c.numero)]));
            }
            const compte = await tx.compte.create({
                data: {
                    tenantId,
                    numero: numeroRetenu,
                    intitule: dto.intitule,
                    classe: ouvert.parent.classe,
                    typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                    modeReportANouveau: ouvert.parent.modeReportANouveau,
                    lettrable: ouvert.parent.lettrable,
                    estRetenu: true,
                },
                select: { id: true },
            });
            return tx.journal.create({ data: { ...donnees, compteTresorerieId: compte.id } });
        }).catch((e) => conflitDuCompteOuvert(e, numeroRetenu, dto.code, numeroChoisi));
    }
    async comptesDuPlanPourJournal(tenantId) {
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        return this.prisma.compte.findMany({
            where: {
                tenantId,
                numero: { in: (0, subdivisions_du_plan_1.comptesDImputationSemes)(referentiel, '5').filter((n) => (0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)(n, referentiel) === null) },
                estActif: true,
            },
            select: { id: true, numero: true, intitule: true },
            orderBy: { numero: 'asc' },
        });
    }
    async compteDuJournalPropose(tenantId, sousId) {
        const ouvert = await this.compteAOuvrir(tenantId, sousId);
        return {
            numero: ouvert.propose,
            racine: ouvert.racine,
            longueur: ouvert.longueur,
            compteDuPlan: { numero: ouvert.parent.numero, intitule: ouvert.parent.intitule },
            motif: ouvert.motif,
        };
    }
    async compteAOuvrir(tenantId, sousId) {
        const [dossier, parent] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true, longueurCompte: true } }),
            this.prisma.compte.findFirst({
                where: { id: sousId, tenantId },
                select: {
                    numero: true,
                    intitule: true,
                    classe: true,
                    typeCompte: true,
                    estActif: true,
                    modeReportANouveau: true,
                    lettrable: true,
                },
            }),
        ]);
        if (!parent)
            throw new common_1.NotFoundException('Compte du plan introuvable pour ce dossier.');
        const racine = (0, subdivisions_du_plan_1.racineDuCompteSeme)(dossier.referentiel, parent.numero);
        if (racine === null || parent.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL) {
            throw new common_1.BadRequestException(`Le compte ${parent.numero} n'est pas un compte d'imputation du plan · le compte propre d'un journal de ` +
                "banque ou de caisse s'ouvre sous l'un d'eux.");
        }
        const horsDesFonds = (0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)(parent.numero, dossier.referentiel);
        if (horsDesFonds)
            throw new common_1.BadRequestException(horsDesFonds);
        if (!parent.estActif) {
            throw new common_1.BadRequestException(`Le compte ${parent.numero} est en sommeil · réactivez-le dans le plan comptable.`);
        }
        const existants = await this.prisma.compte.findMany({
            where: { tenantId, numero: { startsWith: racine } },
            select: { numero: true },
        });
        const propose = (0, collectifs_tiers_1.prochainNumeroIndividuel)(racine, dossier.longueurCompte, [parent.numero, ...existants.map((c) => c.numero)]);
        return {
            parent,
            racine,
            referentiel: dossier.referentiel,
            longueur: dossier.longueurCompte,
            propose,
            motif: propose
                ? null
                : `Plus aucun numéro libre sous le compte ${parent.numero} à ${dossier.longueurCompte} chiffres · allongez ` +
                    'les numéros de compte (Structure > Paramètres du dossier).',
        };
    }
    async verifierCompteTresorerie(tenantId, compteId, journalId) {
        const compte = await this.prisma.compte.findFirst({
            where: { id: compteId, tenantId },
            select: { numero: true, typeCompte: true },
        });
        if (!compte)
            throw new common_1.BadRequestException('Compte de trésorerie introuvable pour ce dossier.');
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        const horsDesFonds = (0, compte_propre_du_journal_1.motifRefusCompteDeTresorerie)(compte.numero, referentiel);
        if (horsDesFonds)
            throw new common_1.BadRequestException(horsDesFonds);
        if (compte.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL) {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} est un compte Total · il ne reçoit aucune écriture, choisissez un compte de détail.`);
        }
        const motifPersonnalise = (0, comptes_proposes_1.motifComptesNonPersonnalises)(await (0, comptes_proposes_1.comptesNonPersonnalises)(this.prisma, tenantId, [compteId]), 'le rattachement à un journal');
        if (motifPersonnalise)
            throw new common_1.BadRequestException(motifPersonnalise);
        const autre = await this.prisma.journal.findFirst({
            where: { tenantId, compteTresorerieId: compteId, ...(journalId ? { id: { not: journalId } } : {}) },
            select: { code: true },
        });
        if (autre) {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} est déjà celui du journal ${autre.code} · chaque journal de banque ou de caisse a son ` +
                'propre compte. Ouvrez dans le Plan comptable un compte de détail pour cette banque ou cette caisse, puis choisissez-le.');
        }
    }
    async supprimer(tenantId, journalId) {
        const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId } });
        if (!journal)
            throw new common_1.NotFoundException('Journal introuvable pour ce dossier.');
        (0, references_1.refuserSiReferences)(`Le journal ${journal.code}`, await (0, references_1.referencesVers)(this.prisma, 'Journal', journal.id, tenantId));
        await this.prisma.journal.delete({ where: { id: journal.id } });
        return { supprime: true };
    }
    async modifier(tenantId, journalId, dto) {
        const journal = await this.trouver(tenantId, journalId);
        if (journal.type === client_1.TypeJournal.TRESORERIE && dto.compteTresorerieId === null) {
            throw new common_1.BadRequestException('Un journal de type Trésorerie doit avoir un compte de trésorerie associé');
        }
        if (dto.compteTresorerieId && dto.compteTresorerieId !== journal.compteTresorerieId) {
            await this.verifierCompteTresorerie(tenantId, dto.compteTresorerieId, journal.id);
        }
        if (journal.type === client_1.TypeJournal.SITUATION && dto.numerotation === client_1.NumerotationPiece.CONTINUE_FICHIER) {
            throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifSituationHorsSequenceDuFichier)(journal.code));
        }
        if (dto.contrepartieChaqueLigne === true && journal.type !== client_1.TypeJournal.TRESORERIE) {
            throw new common_1.BadRequestException(`La contrepartie à chaque ligne ne vaut que pour un journal de trésorerie · ${journal.code} est un journal ${journal.type.toLowerCase()}.`);
        }
        return this.prisma.journal.update({ where: { id: journal.id }, data: dto });
    }
    async prochainNumeroPiece(tenantId, journal, exerciceId, date, tx = this.prisma) {
        return (0, numerotation_piece_1.prochainNumeroPiece)(tx, tenantId, journal, exerciceId, date);
    }
};
exports.JournalService = JournalService;
exports.JournalService = JournalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], JournalService);
//# sourceMappingURL=journal.service.js.map