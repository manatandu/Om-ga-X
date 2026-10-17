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
exports.AffectationService = void 0;
const resultat_en_instance_1 = require("./resultat-en-instance");
const common_1 = require("@nestjs/common");
const exercice_contigu_1 = require("../exercice/exercice-contigu");
const resultat_de_l_exercice_1 = require("../etats-financiers/resultat-de-l-exercice");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const regles_affectation_1 = require("./regles-affectation");
const forme_applicable_1 = require("../tenant/forme-applicable");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const mentions_societe_1 = require("../tenant/mentions-societe");
const libelle_exercice_1 = require("../../common/libelle-exercice");
const EPSILON = 0.005;
let AffectationService = class AffectationService {
    constructor(prisma, ecritureService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
    }
    async preparer(tenantId, exerciceId) {
        const { exercice, referentiel, forme } = await this.contexte(tenantId, exerciceId);
        const regles = regles_affectation_1.REGLES[referentiel];
        const soldes = await this.soldesDuBilan(tenantId, exerciceId, referentiel, forme);
        const reserveLegale = (0, regles_affectation_1.dotationReserveLegale)({
            referentiel,
            forme,
            benefice: soldes.estBenefice ? soldes.montant : 0,
            pertesAnterieures: soldes.pertesAnterieures,
            reserveExistante: soldes.reserveLegale,
            capitalSocial: soldes.capitalSocial,
        });
        const sens = (0, regles_affectation_1.destinationsDuSens)(regles, soldes.estBenefice);
        const destinationsBrutes = await this.prisma.compte.findMany({
            where: {
                tenantId,
                estActif: true,
                typeCompte: 'DETAIL',
                OR: sens.racines.map((r) => ({ numero: { startsWith: r } })),
            },
            select: { id: true, numero: true, intitule: true },
            orderBy: { numero: 'asc' },
        });
        const destinations = destinationsBrutes.filter((c) => !regles.interdits.some((i) => c.numero.startsWith(i.racine)));
        const existante = await this.prisma.affectationResultat.findUnique({
            where: { exerciceId },
            include: { lignes: { include: { compte: { select: { numero: true, intitule: true } } } } },
        });
        return {
            exercice: { id: exercice.id, dateDebut: exercice.dateDebut, dateFin: exercice.dateFin },
            referentiel,
            formeJuridiqueSyscohada: forme,
            capitalRacine: soldes.capitalRacine,
            montant: soldes.montant,
            estBenefice: soldes.estBenefice,
            pertesAnterieures: soldes.pertesAnterieures,
            capitalSocial: soldes.capitalSocial,
            reserveLegaleExistante: soldes.reserveLegale,
            reserveLegale,
            destinations,
            avertissementCapital: referentiel === client_1.Referentiel.SYSCOHADA ? (0, regles_affectation_1.avertissementLigneCapital)(forme, soldes.estBenefice) : null,
            existante,
        };
    }
    async lister(tenantId) {
        return this.prisma.affectationResultat.findMany({
            where: { tenantId },
            orderBy: { dateDecision: 'desc' },
            include: {
                exercice: { select: { id: true, dateDebut: true, dateFin: true } },
                ecriture: { select: { id: true, numeroPiece: true, date: true, statut: true } },
                lignes: { include: { compte: { select: { numero: true, intitule: true } } } },
            },
        });
    }
    async enregistrer(tenantId, createdBy, dto) {
        const { exercice, referentiel, forme, formeDuJour, dateTransformation } = await this.contexte(tenantId, dto.exerciceId);
        const regles = regles_affectation_1.REGLES[referentiel];
        const dejaFaite = await this.prisma.affectationResultat.findUnique({
            where: { exerciceId: dto.exerciceId },
        });
        if (dejaFaite) {
            throw new common_1.ConflictException(`Le résultat de cet exercice a déjà été affecté le ${dejaFaite.dateDecision.toISOString().slice(0, 10)}. ` +
                'Une seconde décision modifie la première : supprimez l’affectation existante avant de la refaire.');
        }
        const soldes = await this.soldesDuBilan(tenantId, dto.exerciceId, referentiel, forme);
        if (soldes.montant < EPSILON) {
            throw new common_1.BadRequestException("Cet exercice ne dégage aucun résultat à affecter : le compte 13 n'a pas bougé.");
        }
        const suivant = await this.prisma.exercice.findFirst({
            where: { tenantId, dateDebut: { gt: exercice.dateFin } },
            orderBy: { dateDebut: 'asc' },
        });
        if (!suivant) {
            throw new common_1.BadRequestException("Aucun exercice ne suit celui-ci. L'affectation se décide « au cours de l'exercice suivant » " +
                "(AUDCIF, Titre VII, compte 13) et son écriture s'y enregistre : ouvrez-le d'abord.");
        }
        if (!(0, exercice_contigu_1.estContigu)(exercice.dateFin, suivant.dateDebut)) {
            throw new common_1.BadRequestException((0, exercice_contigu_1.motifSuivantNonContigu)(exercice.dateFin, suivant));
        }
        if (suivant.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("L'exercice qui doit recevoir l'écriture d'affectation est clôturé : elle ne peut plus y être passée.");
        }
        const dateDecision = new Date(dto.dateDecision);
        if (dateDecision < suivant.dateDebut || dateDecision > suivant.dateFin) {
            throw new common_1.BadRequestException(`La date de décision doit tomber dans l'exercice qui reçoit l'écriture ` +
                `(${suivant.dateDebut.toISOString().slice(0, 10)} au ${suivant.dateFin.toISOString().slice(0, 10)}).`);
        }
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, id: { in: dto.lignes.map((l) => l.compteId) } },
            select: { id: true, numero: true, intitule: true, typeCompte: true },
        });
        const parId = new Map(comptes.map((c) => [c.id, c]));
        for (const ligne of dto.lignes) {
            const compte = parId.get(ligne.compteId);
            if (!compte)
                throw new common_1.BadRequestException('Compte de destination introuvable dans ce dossier.');
            if (compte.typeCompte === 'TOTAL') {
                throw new common_1.BadRequestException(`Le compte ${compte.numero} est un compte de totalisation : il ne reçoit jamais d'écriture.`);
            }
            const interdit = regles.interdits.find((i) => compte.numero.startsWith(i.racine));
            if (interdit)
                throw new common_1.BadRequestException(interdit.motif);
            const sens = (0, regles_affectation_1.destinationsDuSens)(regles, soldes.estBenefice);
            if (!sens.racines.some((r) => compte.numero.startsWith(r))) {
                throw new common_1.BadRequestException(`Le compte ${compte.numero} « ${compte.intitule} » n'est pas une destination admise ` +
                    `${soldes.estBenefice ? 'd’un bénéfice' : 'd’une perte'}. Le texte solde le compte 13 par les ` +
                    `comptes ${sens.racines.join(', ')} (${sens.source}).`);
            }
        }
        const total = Math.round(dto.lignes.reduce((s, l) => s + l.montant, 0) * 100) / 100;
        if (Math.abs(total - soldes.montant) > EPSILON) {
            throw new common_1.BadRequestException(`L'affectation porte ${total.toFixed(2)} alors que le résultat à affecter est de ` +
                `${soldes.montant.toFixed(2)}. Le compte 13 doit être SOLDÉ par l'affectation : ` +
                `il reste ${(soldes.montant - total).toFixed(2)} à affecter.`);
        }
        const avertissementsForme = [];
        let formeReserve = forme;
        if (dateTransformation &&
            forme !== formeDuJour &&
            dateDecision >= dateTransformation &&
            (0, regles_affectation_1.regimeReserveLegale)(forme).exigee !== (0, regles_affectation_1.regimeReserveLegale)(formeDuJour).exigee) {
            formeReserve = null;
            avertissementsForme.push('Cet exercice s’est clos sous l’ancienne forme de la société, et son affectation est décidée après la ' +
                'transformation (AUSCGIE art. 182 à 184) · les deux formes ne soumettent pas la réserve légale aux mêmes ' +
                'règles, et aucun texte lu ne dit laquelle régit cette décision. Le logiciel ne bloque pas · vérifiez la ' +
                `dotation au regard de ${(0, regles_affectation_1.regimeReserveLegale)(forme).source} et de ${(0, regles_affectation_1.regimeReserveLegale)(formeDuJour).source}.`);
        }
        if (soldes.estBenefice && regles.reserveLegale && formeReserve !== null) {
            const exigee = (0, regles_affectation_1.dotationReserveLegale)({
                referentiel,
                forme: formeReserve,
                benefice: soldes.montant,
                pertesAnterieures: soldes.pertesAnterieures,
                reserveExistante: soldes.reserveLegale,
                capitalSocial: soldes.capitalSocial,
            });
            if (exigee.dotation !== null) {
                const dotee = dto.lignes
                    .filter((l) => parId.get(l.compteId).numero.startsWith(regles.reserveLegale))
                    .reduce((s, l) => s + l.montant, 0);
                if (dotee + EPSILON < exigee.dotation) {
                    throw new common_1.BadRequestException(`La réserve légale doit recevoir au moins ${exigee.dotation.toFixed(2)} et n'en reçoit que ` +
                        `${dotee.toFixed(2)}. ${exigee.motif} Une délibération contraire est NULLE : le logiciel ne peut ` +
                        'pas l’enregistrer.');
                }
            }
        }
        const avertissements = [
            ...avertissementsForme,
            ...this.avertissements(referentiel, forme, soldes, dto.lignes, parId, regles.reserveLegale),
        ];
        const balanceAccueil = await this.ecritureService.balance(tenantId, suivant.id, true);
        const { parts, reste } = (0, resultat_en_instance_1.partsAuResultatEnInstance)(balanceAccueil.lignes, soldes.estBenefice, soldes.montant);
        const aSolder = parts.map((p) => ({ compteId: p.compteId, montant: p.montant }));
        if (reste > 0) {
            const compteResultat = await this.compteResultat(tenantId, soldes.estBenefice);
            aSolder.push({ compteId: compteResultat.id, montant: reste });
        }
        const journal = await this.journalGeneral(tenantId);
        const lignesEcriture = [
            ...aSolder.map((s) => soldes.estBenefice
                ? { compteId: s.compteId, debit: s.montant, libelle: 'Affectation du résultat' }
                : { compteId: s.compteId, credit: s.montant, libelle: 'Imputation de la perte' }),
            ...dto.lignes.map((l) => ({
                compteId: l.compteId,
                ...(soldes.estBenefice ? { credit: l.montant } : { debit: l.montant }),
                libelle: l.libelle || undefined,
            })),
        ];
        const ecriture = await this.ecritureService.creer(tenantId, createdBy, {
            exerciceId: suivant.id,
            journalId: journal.id,
            date: dto.dateDecision,
            libelle: `Affectation du résultat de l'exercice ${(0, libelle_exercice_1.libelleExercice)(exercice)} · ${dto.organe}`,
            reference: dto.reference,
            lignes: lignesEcriture,
        });
        try {
            const affectation = await this.prisma.affectationResultat.create({
                data: {
                    tenantId,
                    exerciceId: dto.exerciceId,
                    dateDecision,
                    organe: dto.organe,
                    reference: dto.reference,
                    montant: new client_1.Prisma.Decimal(soldes.montant),
                    estBenefice: soldes.estBenefice,
                    ecritureId: ecriture.id,
                    createdBy,
                    lignes: {
                        create: dto.lignes.map((l) => ({
                            compteId: l.compteId,
                            montant: new client_1.Prisma.Decimal(l.montant),
                            libelle: l.libelle,
                        })),
                    },
                },
                include: {
                    lignes: { include: { compte: { select: { numero: true, intitule: true } } } },
                    ecriture: { select: { id: true, numeroPiece: true, date: true, statut: true } },
                },
            });
            return { ...affectation, avertissements };
        }
        catch (erreur) {
            await this.prisma.ligneEcriture.deleteMany({ where: { ecritureId: ecriture.id } });
            await this.prisma.ecriture.delete({ where: { id: ecriture.id } });
            throw erreur;
        }
    }
    async supprimer(tenantId, id) {
        const affectation = await this.prisma.affectationResultat.findFirst({
            where: { id, tenantId },
            include: { ecriture: { select: { id: true, statut: true, numeroPiece: true } } },
        });
        if (!affectation)
            throw new common_1.NotFoundException('Affectation introuvable pour ce dossier');
        if (affectation.ecriture && affectation.ecriture.statut !== client_1.StatutEcriture.BROUILLARD) {
            throw new common_1.BadRequestException(`L'écriture d'affectation (pièce n° ${affectation.ecriture.numeroPiece ?? '·'}) est validée : elle est ` +
                "entrée au livre-journal. Corrigez-la par inscription en négatif (AUDCIF art. 20) plutôt que de " +
                'supprimer la décision.');
        }
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.affectationResultat.delete({ where: { id } });
            if (affectation.ecriture) {
                await tx.ligneEcriture.deleteMany({
                    where: { ecritureId: affectation.ecriture.id, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } },
                });
                const r = await tx.ecriture.deleteMany({ where: { id: affectation.ecriture.id, tenantId, statut: client_1.StatutEcriture.BROUILLARD } });
                if (r.count !== 1) {
                    throw new common_1.ConflictException(`L'écriture d'affectation (pièce n° ${affectation.ecriture.numeroPiece ?? '·'}) a été validée ou retirée pendant la ` +
                        "suppression · rien n'est supprimé. Validée, elle se corrige par inscription en négatif (AUDCIF art. 20).");
                }
            }
        });
        return { supprime: true };
    }
    avertissements(referentiel, forme, soldes, lignes, parId, racineReserveLegale) {
        if (referentiel !== client_1.Referentiel.SYSCOHADA)
            return [];
        const avertissements = [];
        const somme = (racine) => Math.round(lignes.filter((l) => parId.get(l.compteId).numero.startsWith(racine)).reduce((s, l) => s + l.montant, 0) * 100) / 100;
        const capital = (0, regles_affectation_1.avertissementLigneCapital)(forme, soldes.estBenefice);
        if (capital && somme('101') > EPSILON)
            avertissements.push(capital);
        const dividendes = somme('465');
        if (soldes.estBenefice && dividendes > EPSILON && forme && mentions_societe_1.FORMES_SOCIETES_COMMERCIALES.includes(forme)) {
            const reserveLegale = racineReserveLegale ? somme(racineReserveLegale) : 0;
            const distribuableConnu = Math.round((soldes.montant + soldes.reportBeneficiaire - soldes.pertesAnterieures - reserveLegale) * 100) / 100;
            avertissements.push((dividendes > distribuableConnu + EPSILON
                ? `Les dividendes (${dividendes.toFixed(2)}) excèdent le bénéfice distribuable que le logiciel connaît ` +
                    `(${distribuableConnu.toFixed(2)} : résultat, augmenté du report bénéficiaire, diminué des pertes ` +
                    'antérieures et de la dotation à la réserve légale de cette décision). Ils ne sont réguliers que si ' +
                    'l’assemblée distribue en outre des réserves disponibles, en indiquant expressément les postes ' +
                    '(AUSCGIE art. 143, al. 2 et 3) · sinon c’est un dividende fictif (art. 144). '
                : '') +
                'Le logiciel ne connaît ni les réserves statutaires ni les dividendes partiels déjà distribués, qui ' +
                'diminuent aussi le bénéfice distribuable (AUSCGIE art. 143, al. 1) · ils ne sont pas contrôlés ici.');
        }
        return avertissements;
    }
    async contexte(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier');
        if (exercice.statut !== client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("Le résultat ne s'affecte qu'après la clôture de l'exercice : c'est elle qui le porte au compte 13.");
        }
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: {
                referentiel: true,
                formeJuridiqueSyscohada: true,
                formeJuridiqueSyscohadaAnterieure: true,
                dateTransformationForme: true,
            },
        });
        return {
            exercice,
            referentiel: tenant.referentiel,
            forme: (0, forme_applicable_1.formeApplicable)(tenant, exercice.dateFin),
            formeDuJour: (tenant.formeJuridiqueSyscohada ?? null),
            dateTransformation: tenant.dateTransformationForme ?? null,
        };
    }
    async soldesDuBilan(tenantId, exerciceId, referentiel, forme) {
        const balance = await this.ecritureService.balance(tenantId, exerciceId, false);
        const parRacine = (racine) => balance.lignes.filter((l) => l.numero.startsWith(racine));
        const solde = (racine) => parRacine(racine).reduce((s, l) => s + l.solde, 0);
        const racine = (0, regles_affectation_1.racineCapital)(referentiel, forme);
        const net = Math.round(-balance.lignes
            .filter((l) => (0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(l.numero))
            .reduce((s, l) => s + l.clotureDebit - l.clotureCredit, 0) * 100) / 100;
        const anterieurs13 = balance.lignes
            .filter((l) => l.numero.startsWith('13'))
            .reduce((s, l) => s + l.solde - (l.clotureDebit - l.clotureCredit), 0);
        const anterieurs = Math.round((solde('12') + anterieurs13) * 100) / 100;
        return {
            montant: Math.abs(net),
            estBenefice: net >= 0,
            pertesAnterieures: Math.max(0, anterieurs),
            reportBeneficiaire: Math.max(0, -anterieurs),
            reserveLegale: Math.max(0, Math.round(-solde('111') * 100) / 100),
            capitalRacine: racine,
            capitalSocial: racine ? Math.max(0, Math.round(-solde(racine) * 100) / 100) : 0,
        };
    }
    async compteResultat(tenantId, estBenefice) {
        const racine = estBenefice ? '131' : '139';
        const compte = await this.prisma.compte.findFirst({
            where: { tenantId, numero: { startsWith: racine }, typeCompte: 'DETAIL' },
            orderBy: { numero: 'asc' },
        });
        if (!compte) {
            throw new common_1.BadRequestException(`Aucun compte ${racine} dans le plan de ce dossier · l'affectation ne peut pas solder le résultat.`);
        }
        return compte;
    }
    async journalGeneral(tenantId) {
        const journal = (await this.prisma.journal.findFirst({ where: { tenantId, code: 'OD' } })) ??
            (await this.prisma.journal.findFirst({ where: { tenantId, type: 'GENERAL' } }));
        if (!journal) {
            throw new common_1.BadRequestException("Aucun journal général (code OD) pour recevoir l'écriture d'affectation.");
        }
        return journal;
    }
};
exports.AffectationService = AffectationService;
exports.AffectationService = AffectationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], AffectationService);
//# sourceMappingURL=affectation.service.js.map