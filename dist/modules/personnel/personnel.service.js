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
exports.PersonnelService = exports.LOT_CONFRONTATION = exports.PLAFOND_CONFRONTATION = exports.PLAFOND_REGISTRE_PERSONNEL = exports.PLAFOND_AVANCES_DECOMPTE = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const decimal_exact_1 = require("../../common/decimal-exact");
const assiettes_paie_1 = require("./assiettes-paie");
const bareme_irpp_1 = require("./bareme-irpp");
const cotisations_paie_1 = require("./cotisations-paie");
const passation_paie_1 = require("./passation-paie");
const avances_salaire_1 = require("./avances-salaire");
const quotite_saisissable_1 = require("./quotite-saisissable");
const decompte_retenues_stipulations_1 = require("./decompte-retenues-stipulations");
exports.PLAFOND_AVANCES_DECOMPTE = 200;
const indemnite_logement_kinshasa_1 = require("./indemnite-logement-kinshasa");
const conversion_usd_1 = require("./conversion-usd");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const bulletin_paie_1 = require("./bulletin-paie");
const retenues_autorisees_1 = require("./retenues-autorisees");
const livre_de_paie_1 = require("./livre-de-paie");
const bareme_smig_1 = require("./bareme-smig");
const baremes_dossier_1 = require("./baremes-dossier");
const effectif_registre_1 = require("./effectif-registre");
const decompte_final_emis_1 = require("./decompte-final-emis");
const decompte_final_1 = require("./decompte-final");
const regles_contrat_travail_1 = require("./regles-contrat-travail");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const bornes_registre_1 = require("./bornes-registre");
const conges_service_1 = require("./conges.service");
const majorations_heures_service_1 = require("./majorations-heures.service");
const salaire_pendant_le_conge_1 = require("./salaire-pendant-le-conge");
exports.PLAFOND_REGISTRE_PERSONNEL = 1000;
exports.PLAFOND_CONFRONTATION = 500;
exports.LOT_CONFRONTATION = 200;
const INCLURE_FICHE = client_1.Prisma.validator()({
    enfants: { orderBy: [{ dateNaissance: 'asc' }, { id: 'asc' }], take: bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE },
    contrats: {
        orderBy: [{ dateFin: { sort: 'desc', nulls: 'first' } }, { dateEntreeEnVigueur: 'desc' }, { id: 'desc' }],
        take: bornes_registre_1.PLAFOND_CONTRATS_PAR_FICHE,
    },
    _count: { select: { enfants: true, contrats: true } },
});
const cleEnfants = (enfants) => enfants
    .map((e) => JSON.stringify([e.nom, e.postNom, e.prenoms, e.dateNaissance ? e.dateNaissance.toISOString() : null]))
    .sort()
    .join('\n');
function refusNomme(message, motifs) {
    return new common_1.BadRequestException({ message: `${message} · ${motifs.join(' · ')}`, motifs: [...motifs] });
}
let PersonnelService = class PersonnelService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId, inclureInactifs = false, aCompleter = false) {
        const perimetre = aCompleter
            ? { contrats: { some: regles_contrat_travail_1.CONTRAT_A_COMPLETER } }
            : inclureInactifs
                ? {}
                : { actif: true };
        const [salaries, total, contratsACompleter] = await Promise.all([
            this.prisma.salarie.findMany({
                where: { tenantId, ...perimetre },
                orderBy: [{ nom: 'asc' }, { postNom: 'asc' }, { id: 'asc' }],
                take: exports.PLAFOND_REGISTRE_PERSONNEL,
                include: INCLURE_FICHE,
            }),
            this.prisma.salarie.count({ where: { tenantId, ...perimetre } }),
            this.prisma.contratTravail.count({ where: { tenantId, ...regles_contrat_travail_1.CONTRAT_A_COMPLETER } }),
        ]);
        return {
            contratsACompleter,
            salaries: salaries.map((s) => this.presenterFiche(s)),
            total,
            plafond: exports.PLAFOND_REGISTRE_PERSONNEL,
            tronque: total > salaries.length,
            plafondEnfantsParFiche: bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE,
            plafondContratsParFiche: bornes_registre_1.PLAFOND_CONTRATS_PAR_FICHE,
        };
    }
    presenterFiche(s) {
        const { _count, ...fiche } = s;
        const contrats = [...s.contrats].sort((a, b) => b.dateEntreeEnVigueur.getTime() - a.dateEntreeEnVigueur.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
        return {
            ...fiche,
            contrats,
            contratEnCours: contrats.find((c) => c.dateFin === null) ?? null,
            nombreContrats: _count.contrats,
            contratsTronques: _count.contrats > contrats.length,
            nombreEnfants: _count.enfants,
            enfantsTronques: _count.enfants > s.enfants.length,
        };
    }
    async creerSalarie(tenantId, userId, dto) {
        await this.verifierMatriculeLibre(tenantId, dto.matricule, null);
        return this.prisma.salarie.create({
            data: {
                tenantId,
                createdBy: userId,
                ...this.champsSalarie(dto),
                ...(dto.enfants
                    ? {
                        enfants: {
                            create: dto.enfants.map((e) => ({
                                tenantId,
                                nom: e.nom,
                                postNom: e.postNom ?? null,
                                prenoms: e.prenoms ?? null,
                                dateNaissance: e.dateNaissance ? new Date(e.dateNaissance) : null,
                            })),
                        },
                    }
                    : {}),
            },
            include: { enfants: true },
        });
    }
    async modifierSalarie(tenantId, salarieId, dto) {
        const existant = await this.prisma.salarie.findFirst({
            where: { id: salarieId, tenantId },
            select: { id: true },
        });
        if (!existant)
            throw new common_1.NotFoundException('Salarié introuvable dans ce dossier.');
        await this.verifierMatriculeLibre(tenantId, dto.matricule, salarieId);
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            if (dto.enfants) {
                const anciens = await tx.enfantACharge.findMany({
                    where: { tenantId, salarieId },
                    select: { id: true, nom: true, postNom: true, prenoms: true, dateNaissance: true },
                    orderBy: { id: 'asc' },
                    take: bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE + 1,
                });
                if (anciens.length > bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE) {
                    throw new common_1.BadRequestException(`Cette fiche porte plus de ${bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE} enfants à charge, plus que l'écran n'en montre · ` +
                        'les remplacer en bloc effacerait ceux qui n’y paraissent pas. Enregistrez la fiche sans toucher à ses enfants.');
                }
                const nouveaux = dto.enfants.map((e) => ({
                    nom: e.nom,
                    postNom: e.postNom ?? null,
                    prenoms: e.prenoms ?? null,
                    dateNaissance: e.dateNaissance ? new Date(e.dateNaissance) : null,
                }));
                if (cleEnfants(anciens) !== cleEnfants(nouveaux)) {
                    for (const e of anciens)
                        await tx.enfantACharge.delete({ where: { id: e.id, tenantId } });
                    for (const e of nouveaux)
                        await tx.enfantACharge.create({ data: { tenantId, salarieId, ...e } });
                }
            }
            const fiche = await tx.salarie.update({
                where: { id: salarieId, tenantId },
                data: this.champsSalarie(dto),
                include: INCLURE_FICHE,
            });
            return this.presenterFiche(fiche);
        });
    }
    champsSalarie(dto) {
        return {
            matricule: dto.matricule?.trim() || null,
            nom: dto.nom.trim(),
            postNom: dto.postNom?.trim() || null,
            prenoms: dto.prenoms?.trim() || null,
            sexe: dto.sexe,
            numeroAffiliationCnss: dto.numeroAffiliationCnss?.trim() || null,
            dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : null,
            millesimeNaissance: dto.millesimeNaissance ?? null,
            lieuNaissance: dto.lieuNaissance?.trim() || null,
            nationalite: dto.nationalite?.trim() || null,
            nomConjoint: dto.nomConjoint?.trim() || null,
            aptitudeConstateeLe: dto.aptitudeConstateeLe ? new Date(dto.aptitudeConstateeLe) : null,
            aptitudeConstateePar: dto.aptitudeConstateePar?.trim() || null,
            aptitudeProvisoire: dto.aptitudeProvisoire ?? false,
            declarationEngagementLe: dto.declarationEngagementLe
                ? new Date(dto.declarationEngagementLe)
                : null,
            declarationDepartLe: dto.declarationDepartLe ? new Date(dto.declarationDepartLe) : null,
            actif: dto.actif ?? true,
        };
    }
    async verifierMatriculeLibre(tenantId, matricule, sauf) {
        const valeur = matricule?.trim();
        if (!valeur)
            return;
        const autre = await this.prisma.salarie.findFirst({
            where: { tenantId, matricule: valeur, ...(sauf ? { NOT: { id: sauf } } : {}) },
            select: { nom: true, postNom: true },
        });
        if (autre) {
            throw new common_1.BadRequestException(`Le matricule « ${valeur} » est déjà porté par ${autre.nom} ${autre.postNom ?? ''}`.trim() +
                ". Le matricule est « éventuel » au sens de l'article 212, point 4 · laissez-le vide plutôt que de le dédoubler.");
        }
    }
    async creerContrat(tenantId, userId, salarieId, dto) {
        const monnaieManquante = (0, regles_contrat_travail_1.motifMonnaieExigee)(dto.remunerationBase, dto.deviseRemuneration);
        if (monnaieManquante)
            throw new common_1.BadRequestException(monnaieManquante);
        const salarie = await this.prisma.salarie.findFirst({
            where: { id: salarieId, tenantId },
            select: { id: true },
        });
        if (!salarie)
            throw new common_1.NotFoundException('Salarié introuvable dans ce dossier.');
        if (dto.renouvelleDeId) {
            const source = await this.prisma.contratTravail.findFirst({
                where: { id: dto.renouvelleDeId, tenantId, salarieId },
                select: { id: true },
            });
            if (!source) {
                throw new common_1.BadRequestException("Le contrat renouvelé est introuvable pour ce salarié dans ce dossier. Un renouvellement se rattache au contrat qu'il prolonge, et à lui seul.");
            }
        }
        return this.prisma.contratTravail.create({
            data: {
                tenantId,
                salarieId,
                createdBy: userId,
                type: dto.type,
                constateParEcrit: dto.constateParEcrit ?? true,
                dateEntreeEnVigueur: new Date(dto.dateEntreeEnVigueur),
                dateConclusion: dto.dateConclusion ? new Date(dto.dateConclusion) : null,
                lieuConclusion: dto.lieuConclusion?.trim() || null,
                dateFinPrevue: dto.dateFinPrevue ? new Date(dto.dateFinPrevue) : null,
                separeDeSaFamille: dto.separeDeSaFamille ?? false,
                ouvrageDetermine: dto.ouvrageDetermine?.trim() || null,
                motifRemplacement: dto.motifRemplacement?.trim() || null,
                emploiPermanent: dto.emploiPermanent ?? false,
                natureTravail: dto.natureTravail?.trim() || null,
                lieuExecution: dto.lieuExecution?.trim() || null,
                categorieProfessionnelle: dto.categorieProfessionnelle?.trim() || null,
                classeProfessionnelle: dto.classeProfessionnelle ?? null,
                periodiciteRemuneration: dto.periodiciteRemuneration ?? null,
                manoeuvreSansSpecialite: dto.manoeuvreSansSpecialite ?? false,
                remunerationBase: dto.remunerationBase ?? null,
                deviseRemuneration: dto.deviseRemuneration ?? null,
                avantagesConvenus: dto.avantagesConvenus?.trim() || null,
                clauseEssai: dto.clauseEssai ?? false,
                essaiConstateParEcrit: dto.essaiConstateParEcrit ?? false,
                essaiDureeJours: dto.essaiDureeJours ?? null,
                dureePreavisJours: dto.dureePreavisJours ?? null,
                viseParOnem: dto.viseParOnem ?? false,
                dateVisaOnem: dto.dateVisaOnem ? new Date(dto.dateVisaOnem) : null,
                renouvelleDeId: dto.renouvelleDeId ?? null,
            },
        });
    }
    async declarerDeviseRemuneration(tenantId, contratId, devise) {
        const contrat = await this.prisma.contratTravail.findFirst({
            where: { id: contratId, tenantId },
            select: { id: true, deviseRemuneration: true },
        });
        if (!contrat)
            throw new common_1.NotFoundException('Contrat introuvable dans ce dossier.');
        const refus = (deja) => new common_1.ConflictException(`La monnaie de la rémunération de ce contrat est déjà déclarée${deja ? ` (${deja})` : ''}. ` +
            'Elle se complète quand elle manque, elle ne se change pas · le registre ne modifie pas un contrat.');
        if (contrat.deviseRemuneration !== null)
            throw refus(contrat.deviseRemuneration);
        try {
            return await this.prisma.contratTravail.update({
                where: { id: contratId, tenantId, deviseRemuneration: null },
                data: { deviseRemuneration: devise },
            });
        }
        catch (erreur) {
            if (erreur instanceof client_1.Prisma.PrismaClientKnownRequestError && erreur.code === 'P2025')
                throw refus(null);
            throw erreur;
        }
    }
    async terminerContrat(tenantId, contratId, dto) {
        const contrat = await this.prisma.contratTravail.findFirst({
            where: { id: contratId, tenantId },
            select: { id: true, dateEntreeEnVigueur: true, dateFin: true },
        });
        if (!contrat)
            throw new common_1.NotFoundException('Contrat introuvable dans ce dossier.');
        const fin = new Date(dto.dateFin);
        if (fin.getTime() < contrat.dateEntreeEnVigueur.getTime()) {
            throw new common_1.BadRequestException("La date de fin est antérieure à l'entrée en vigueur du contrat.");
        }
        return this.prisma.contratTravail.update({
            where: { id: contratId, tenantId },
            data: { dateFin: fin, motifFin: dto.motifFin?.trim() || null },
        });
    }
    async confronter(tenantId, aujourdhui = new Date()) {
        const [tenant, grilles] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({
                where: { id: tenantId },
                select: { nom: true, numeroAffiliationCnssEmployeur: true },
            }),
            this.grillesSmigDeLaConfrontation(tenantId, aujourdhui),
        ]);
        const employeur = {
            nom: tenant.nom,
            numeroAffiliationCnssEmployeur: tenant.numeroAffiliationCnssEmployeur,
        };
        const fichesDe = (s) => {
            const pourControle = {
                nom: s.nom,
                postNom: s.postNom,
                prenoms: s.prenoms,
                sexe: s.sexe,
                numeroAffiliationCnss: s.numeroAffiliationCnss,
                dateNaissance: s.dateNaissance,
                millesimeNaissance: s.millesimeNaissance,
                lieuNaissance: s.lieuNaissance,
                nationalite: s.nationalite,
                nomConjoint: s.nomConjoint,
                aptitudeConstateeLe: s.aptitudeConstateeLe,
                enfantsSansDateNaissance: s._count.enfants,
            };
            let rangCdd = 0;
            return s.contrats.map((c) => {
                if (c.type === client_1.TypeContratTravail.DUREE_DETERMINEE)
                    rangCdd += 1;
                const contrat = {
                    type: c.type,
                    constateParEcrit: c.constateParEcrit,
                    viseParOnem: c.viseParOnem,
                    dateEntreeEnVigueur: c.dateEntreeEnVigueur,
                    dateConclusion: c.dateConclusion,
                    lieuConclusion: c.lieuConclusion,
                    dateFinPrevue: c.dateFinPrevue,
                    ouvrageDetermine: c.ouvrageDetermine,
                    motifRemplacement: c.motifRemplacement,
                    emploiPermanent: c.emploiPermanent,
                    natureTravail: c.natureTravail,
                    lieuExecution: c.lieuExecution,
                    remunerationBase: c.remunerationBase === null ? null : Number(c.remunerationBase),
                    avantagesConvenus: c.avantagesConvenus,
                    dureePreavisJours: c.dureePreavisJours,
                    separeDeSaFamille: c.separeDeSaFamille,
                    manoeuvreSansSpecialite: c.manoeuvreSansSpecialite,
                    clauseEssai: c.clauseEssai,
                    essaiConstateParEcrit: c.essaiConstateParEcrit,
                    essaiDureeJours: c.essaiDureeJours,
                    classeProfessionnelle: c.classeProfessionnelle,
                    periodiciteRemuneration: c.periodiciteRemuneration,
                    deviseRemuneration: c.deviseRemuneration,
                };
                const nombreRenouvellements = this.longueurChaineRenouvellement(s.contrats, c.id);
                const journeesJourLeJour = c.type === client_1.TypeContratTravail.JOUR_LE_JOUR ? (0, regles_contrat_travail_1.journeesJourLeJourAvant)(s.contrats, c) : undefined;
                const moisDeReference = (c.dateFin ?? aujourdhui).toISOString().slice(0, 7);
                return {
                    salarieId: s.id,
                    salarie: [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' '),
                    contratId: c.id,
                    type: c.type,
                    dateEntreeEnVigueur: c.dateEntreeEnVigueur,
                    dateFin: c.dateFin,
                    mentionsManquantes: (0, regles_contrat_travail_1.mentionsManquantes)(employeur, pourControle, contrat),
                    requalifications: (0, regles_contrat_travail_1.requalifications)(contrat, {
                        nombreCdd: rangCdd,
                        nombreRenouvellements,
                        journeesJourLeJour,
                    }),
                    jourLeJourNonCompte: c.type === client_1.TypeContratTravail.JOUR_LE_JOUR && journeesJourLeJour === null
                        ? "Engagement au jour le jour · les journées des deux mois précédents ne se comptent pas sur le registre (engagements de plusieurs jours ou sans fin), et la requalification de l'article 40, alinéa 2 n'est pas examinée."
                        : null,
                    essai: (0, regles_contrat_travail_1.verdictEssai)(contrat),
                    declarations: (0, regles_contrat_travail_1.declarationsDues)({
                        dateEntreeEnVigueur: c.dateEntreeEnVigueur,
                        declarationEngagementLe: s.declarationEngagementLe,
                        dateFin: c.dateFin,
                        declarationDepartLe: s.declarationDepartLe,
                    }, aujourdhui),
                    aptitudeProvisoirePerimee: (0, regles_contrat_travail_1.aptitudeProvisoirePerimee)({ aptitudeProvisoire: s.aptitudeProvisoire }, contrat, aujourdhui),
                    visaOnemManquant: c.type !== client_1.TypeContratTravail.APPRENTISSAGE && c.constateParEcrit && !c.viseParOnem,
                    moisDeReference,
                    remunerationMinimale: (0, regles_contrat_travail_1.verdictRemunerationMinimale)(contrat, moisDeReference, grilles.annexes, grilles.nonLues),
                };
            });
        };
        const fiches = new lecture_par_lots_1.PremiersSelon(exports.PLAFOND_CONFRONTATION, (a, b) => a.salarie.localeCompare(b.salarie, 'fr') ||
            a.salarieId.localeCompare(b.salarieId) ||
            a.dateEntreeEnVigueur.getTime() - b.dateEntreeEnVigueur.getTime() ||
            a.contratId.localeCompare(b.contratId));
        let totalSignalements = 0;
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.salarie.findMany({
            where: { tenantId },
            include: {
                contrats: { orderBy: { dateEntreeEnVigueur: 'asc' } },
                _count: { select: { enfants: { where: { dateNaissance: null } } } },
            },
            ...(0, lecture_par_lots_1.pageApres)(curseur, exports.LOT_CONFRONTATION),
        }), (s) => {
            for (const f of fichesDe(s)) {
                totalSignalements +=
                    f.mentionsManquantes.length +
                        f.requalifications.length +
                        f.declarations.filter((d) => d.enRetard).length +
                        (f.remunerationMinimale.conforme === false ? 1 : 0);
                fiches.ajouter(f);
            }
        }, exports.LOT_CONFRONTATION);
        return {
            employeur,
            manqueEmployeur: tenant.numeroAffiliationCnssEmployeur === null,
            fiches: fiches.elements(),
            totalFiches: fiches.nombre,
            plafond: exports.PLAFOND_CONFRONTATION,
            tronque: fiches.tronquee,
            totalSignalements,
            grillesSmig: {
                lues: grilles.annexes.length,
                total: grilles.total,
                plafond: bornes_registre_1.PLAFOND_GRILLES_SMIG,
                tronque: grilles.nonLues !== null,
            },
        };
    }
    async grillesSmigDeLaConfrontation(tenantId, aujourdhui) {
        const { _max } = await this.prisma.contratTravail.aggregate({
            where: { tenantId },
            _max: { dateFin: true },
        });
        const dernierMois = [aujourdhui, _max.dateFin]
            .filter((d) => d !== null)
            .map((d) => d.toISOString().slice(0, 7))
            .sort()
            .pop();
        const [annee, mois] = dernierMois.split('-').map(Number);
        const moisSuivant = new Date(Date.UTC(annee, mois, 1)).toISOString().slice(0, 10);
        const [lignes, decompte] = await Promise.all([
            this.prisma.versionBaremePaie.findMany({
                where: { tenantId, bareme: 'SMIG', aPartirDu: { lt: moisSuivant } },
                orderBy: { aPartirDu: 'desc' },
                take: bornes_registre_1.PLAFOND_GRILLES_SMIG,
                select: { bareme: true, aPartirDu: true, reference: true, valeurs: true },
            }),
            this.prisma.versionBaremePaie.aggregate({
                where: { tenantId, bareme: 'SMIG', aPartirDu: { lt: moisSuivant } },
                _count: { _all: true },
                _min: { aPartirDu: true },
            }),
        ]);
        const total = decompte._count._all;
        const nonLues = total > lignes.length && decompte._min.aPartirDu !== null && lignes.length > 0
            ? { du: decompte._min.aPartirDu.slice(0, 7), avant: lignes[lignes.length - 1].aPartirDu.slice(0, 7) }
            : null;
        return { annexes: (0, baremes_dossier_1.annexesSmigDuDossier)(lignes), total, nonLues };
    }
    async versionsBaremesDuMois(tenantId, moisDePaie) {
        const [annee, mois] = moisDePaie.split('-').map(Number);
        const moisSuivant = new Date(Date.UTC(annee, mois, 1)).toISOString().slice(0, 10);
        const lignes = await Promise.all(baremes_dossier_1.BAREMES_SERVIS.map((bareme) => this.prisma.versionBaremePaie.findFirst({
            where: { tenantId, bareme, aPartirDu: { lt: moisSuivant } },
            orderBy: { aPartirDu: 'desc' },
            select: { bareme: true, aPartirDu: true, reference: true, valeurs: true },
        })));
        return lignes.filter((l) => l !== null);
    }
    tauxLegalAllocationsFamiliales(dto, annexesSmig = []) {
        if (typeof dto.tauxLegalAllocationsFamilialesFc === 'number') {
            return dto.tauxLegalAllocationsFamilialesFc;
        }
        const enfants = dto.enfantsBeneficiairesAllocations;
        if (typeof enfants !== 'number')
            return null;
        const a = (0, bareme_smig_1.allocationFamilialeJournaliere)(dto.moisDePaie, enfants, annexesSmig);
        if (!a.valeur)
            return null;
        return (0, decompte_final_emis_1.auCentime)(a.valeur.totalFc * (dto.joursAllocationsFamiliales ?? bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.MOIS));
    }
    tauxLegalNonCalcule(dto, annexesSmig = []) {
        if (typeof dto.tauxLegalAllocationsFamilialesFc === 'number')
            return null;
        const grille = (0, bareme_smig_1.annexeApplicable)(dto.moisDePaie, annexesSmig);
        if (!grille.valeur)
            return { cause: 'MOIS_SANS_GRILLE_DU_SMIG', raison: grille.explication };
        if (typeof dto.enfantsBeneficiairesAllocations !== 'number')
            return { cause: 'ENFANTS_BENEFICIAIRES_NON_RENSEIGNES' };
        return null;
    }
    reserveTauxLegalAllocations(dto, tauxFc) {
        if (typeof dto.tauxLegalAllocationsFamilialesFc === 'number' || tauxFc === null)
            return null;
        if (typeof dto.joursAllocationsFamiliales === 'number') {
            return `Plafond de l'article 69, 1 calculé sur ${dto.joursAllocationsFamiliales} jour(s) ouvrant droit aux allocations familiales (mention 28 de l'arrêté du 8 août 2008).`;
        }
        const incomplet = typeof dto.joursPayes === 'number' && dto.joursPayes < bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.MOIS;
        return ("Plafond de l'article 69, 1 mensualisé à 26 jours (décret n° 25/22, art. 7) · valable pour un mois entier. " +
            (incomplet
                ? `Le mois est déclaré incomplet (${dto.joursPayes} jours payés) : déclarez les jours ouvrant droit aux allocations (jours payés à 100 %, de congé payé et payés aux deux tiers, mention 28), sans quoi le plafond est trop haut.`
                : 'Sur un mois incomplet, déclarez les jours ouvrant droit aux allocations (mention 28).'));
    }
    async convertirEnFrancs(tenantId, dto, maintenant) {
        if ((dto.deviseStipulation ?? 'CDF') === 'CDF') {
            const sansFc = dto.elements.filter((e) => typeof e.montantFc !== 'number');
            if (sansFc.length > 0) {
                throw new common_1.BadRequestException(`Élément(s) sans montant en francs : ${sansFc.map((e) => e.libelle).join(', ')} · un montant en dollars ` +
                    'suppose de déclarer la rémunération stipulée en USD.');
            }
            return { dtoFc: dto, conversion: null };
        }
        const sansUsd = dto.elements.filter((e) => typeof e.montantUsd !== 'number');
        if (sansUsd.length > 0) {
            throw new common_1.BadRequestException(`Rémunération stipulée en USD · élément(s) sans montant en dollars : ${sansUsd.map((e) => e.libelle).join(', ')}.`);
        }
        const declaree = dto.dateMiseADisposition ? dto.dateMiseADisposition.slice(0, 10) : null;
        const jour = declaree ? new Date(declaree + 'T00:00:00.000Z') : (0, conversion_usd_1.jourDeKinshasa)(maintenant);
        if (Number.isNaN(jour.getTime())) {
            throw new common_1.BadRequestException('La date de mise à disposition doit être écrite AAAA-MM-JJ.');
        }
        const cote = await this.prisma.coursDevise.findFirst({
            where: { date: jour, devise: { tenantId, code: 'USD' } },
            select: { cours: true, source: true },
        });
        if (!cote)
            throw new common_1.BadRequestException((0, conversion_usd_1.messageCoursManquant)(jour, declaree !== null));
        const cours = Number(cote.cours);
        return {
            dtoFc: {
                ...dto,
                elements: dto.elements.map((e) => ({ ...e, montantFc: (0, conversion_usd_1.usdEnFc)(e.montantUsd, cours) })),
            },
            conversion: {
                devise: 'USD',
                cours,
                dateCours: jour.toISOString().slice(0, 10),
                origineDateCours: declaree ? 'MISE_A_DISPOSITION' : 'JOUR_DU_CALCUL',
                sourceCours: cote.source ?? null,
                elements: dto.elements.map((e) => ({
                    libelle: e.libelle,
                    montantUsd: e.montantUsd,
                    montantFc: (0, conversion_usd_1.usdEnFc)(e.montantUsd, cours),
                })),
                avertissement: conversion_usd_1.AVERTISSEMENT_ARTICLE_89,
                avertissementDate: declaree ? null : conversion_usd_1.AVERTISSEMENT_DATE_DU_CALCUL,
            },
        };
    }
    async resoudreSaisie(tenantId, salarieId, dto) {
        const idsRubriques = [...new Set(dto.elements.map((e) => e.rubriqueId).filter((x) => !!x))];
        let elements = dto.elements;
        if (idsRubriques.length) {
            const rubriques = await this.prisma.rubriquePaie.findMany({ where: { tenantId, id: { in: idsRubriques } } });
            elements = dto.elements.map((e) => {
                if (!e.rubriqueId)
                    return e;
                const r = rubriques.find((x) => x.id === e.rubriqueId);
                if (!r)
                    throw new common_1.BadRequestException('Rubrique de paie introuvable dans ce dossier.');
                if (!r.actif)
                    throw new common_1.BadRequestException(`La rubrique ${r.code} est désactivée · réactivez-la ou retirez l'élément.`);
                return { ...e, nature: r.nature, libelle: e.libelle?.trim() ? e.libelle : r.libelle };
            });
        }
        const demandeesConges = dto.allocationsConge ?? [];
        let allocationsCongePortees = dto.allocationsCongePortees ?? [];
        if (demandeesConges.length) {
            if (!salarieId)
                throw new common_1.BadRequestException("Une allocation de congé se rapporte à un salarié · choisissez-le.");
            if (!(0, bulletin_paie_1.moisValide)(dto.moisDePaie))
                throw new common_1.BadRequestException('Mois de paie illisible · la forme attendue est AAAA-MM.');
            const devise = dto.deviseStipulation ?? 'CDF';
            allocationsCongePortees = await (0, conges_service_1.allocationsAPorter)(this.prisma, tenantId, salarieId, dto.moisDePaie, demandeesConges.map((a) => a.congeId), devise, conges_service_1.lireAbsencesPourConges);
            elements = [
                ...elements,
                ...allocationsCongePortees.map((a) => devise === 'USD'
                    ? { nature: conges_service_1.NATURE_ALLOCATION_CONGE, libelle: (0, conges_service_1.libelleAllocation)(a), montantUsd: a.montant, montantFc: undefined }
                    : { nature: conges_service_1.NATURE_ALLOCATION_CONGE, libelle: (0, conges_service_1.libelleAllocation)(a), montantFc: a.montant }),
            ];
        }
        const demandeesHeures = dto.heuresMajorees ?? [];
        let heuresPortees = dto.heuresPortees ?? [];
        if (demandeesHeures.length) {
            if (!(0, bulletin_paie_1.moisValide)(dto.moisDePaie))
                throw new common_1.BadRequestException('Mois de paie illisible · la forme attendue est AAAA-MM.');
            heuresPortees = await (0, majorations_heures_service_1.heuresAPorter)(this.prisma, tenantId, dto.moisDePaie, demandeesHeures);
            const devise = dto.deviseStipulation ?? 'CDF';
            elements = [
                ...elements,
                ...heuresPortees.map((h) => devise === 'USD'
                    ? { nature: 'PRESTATION_SUPPLEMENTAIRE', libelle: h.libelle, montantUsd: h.montant, montantFc: undefined }
                    : { nature: 'PRESTATION_SUPPLEMENTAIRE', libelle: h.libelle, montantFc: h.montant }),
            ];
        }
        const demandees = dto.retenuesAvances ?? [];
        const retenuesAvances = [];
        if (demandees.length) {
            if (!salarieId)
                throw new common_1.BadRequestException("Une retenue d'avance se rapporte à un salarié · choisissez-le.");
            const ids = demandees.map((r) => r.avanceId);
            if (new Set(ids).size !== ids.length)
                throw new common_1.BadRequestException('Une même avance figure deux fois dans les retenues.');
            const avances = await this.prisma.avanceSalaire.findMany({
                where: { tenantId, id: { in: ids } },
                include: { retenues: { select: { montantFc: true, bulletin: { select: { statut: true } } } } },
            });
            for (const r of demandees) {
                const a = avances.find((x) => x.id === r.avanceId);
                if (!a || a.salarieId !== salarieId) {
                    throw new common_1.BadRequestException("Avance introuvable pour ce salarié · une retenue ne vise que les avances du salarié payé.");
                }
                const solde = (0, avances_salaire_1.soldeAvance)(Number(a.montantFc), a.retenues.map((x) => ({ montantFc: Number(x.montantFc), bulletinAnnule: x.bulletin.statut !== client_1.StatutBulletinPaie.EMIS })));
                const libelle = a.type === 'SAISIE_ARRET'
                    ? `Saisie-arrêt notifiée le ${a.dateOctroi.toISOString().slice(0, 10)} (acte ${a.referenceActe ?? '·'}) · ${a.objet}`
                    : `${a.type === 'PRET' ? 'Prêt' : a.type === 'ACOMPTE' ? 'Acompte' : 'Avance'} du ${a.dateOctroi.toISOString().slice(0, 10)} · ${a.objet}`;
                const refus = (0, avances_salaire_1.motifRefusRetenue)(r.montantFc, solde, libelle);
                if (refus)
                    throw new common_1.BadRequestException(refus);
                if (a.type === 'SAISIE_ARRET' && (0, bulletin_paie_1.moisValide)(dto.moisDePaie)) {
                    const refusMois = (0, avances_salaire_1.motifRefusMoisSaisie)(dto.moisDePaie, a.dateOctroi, a.dateFin);
                    if (refusMois)
                        throw new common_1.BadRequestException(refusMois);
                }
                retenuesAvances.push({
                    avanceId: a.id,
                    type: a.type,
                    categoriePret: a.categoriePret ?? null,
                    littera: avances_salaire_1.LITTERA_ARTICLE_112[a.type],
                    libelle,
                    montantFc: r.montantFc,
                    soldeAvantFc: solde,
                });
            }
        }
        const horsChamp = elements.find((e) => e.enNature === true && !assiettes_paie_1.NATURES_FOURNIES_EN_NATURE.includes(e.nature));
        if (horsChamp) {
            throw new common_1.BadRequestException(`« ${horsChamp.libelle} » · seuls le logement, le transport et les soins se déclarent fournis en nature.`);
        }
        return {
            dto: { ...dto, elements, allocationsConge: undefined, allocationsCongePortees, heuresMajorees: undefined, heuresPortees },
            retenuesAvances,
        };
    }
    async simulerPaie(tenantId, salarieId, dtoSaisi, maintenant = new Date()) {
        if (!(0, bulletin_paie_1.moisValide)(dtoSaisi.moisDePaie)) {
            throw new common_1.BadRequestException('Mois de paie illisible · la forme attendue est AAAA-MM.');
        }
        const { dto: dtoStipule, retenuesAvances } = await this.resoudreSaisie(tenantId, salarieId, dtoSaisi);
        const retenuesAvancesExactes = (0, decimal_exact_1.somme)(retenuesAvances.map((r) => (0, decimal_exact_1.depuisNombre)(r.montantFc)));
        const { dtoFc: dto, conversion } = await this.convertirEnFrancs(tenantId, dtoStipule, maintenant);
        const borne = (0, bareme_irpp_1.baremeApplicableAuMois)(dto.moisDePaie);
        const versionsBaremes = await this.versionsBaremesDuMois(tenantId, dto.moisDePaie);
        const annexesSmig = (0, baremes_dossier_1.annexesSmigDuDossier)(versionsBaremes);
        let propositionPersonnesACharge = null;
        let sourceProposition = null;
        let regimeCnss = null;
        if (salarieId) {
            const salarie = await this.prisma.salarie.findFirst({
                where: { id: salarieId, tenantId },
                select: {
                    nom: true,
                    nomConjoint: true,
                    _count: { select: { enfants: true } },
                    contrats: { select: { id: true, type: true, dateEntreeEnVigueur: true, dateFin: true } },
                },
            });
            if (!salarie)
                throw new common_1.NotFoundException('Salarié introuvable dans ce dossier.');
            const contratDuMois = (0, bulletin_paie_1.contratCouvrantLeMois)(salarie.contrats ?? [], dto.moisDePaie);
            if (contratDuMois) {
                regimeCnss = contratDuMois.type === client_1.TypeContratTravail.APPRENTISSAGE ? 'APPRENTI' : 'TRAVAILLEUR';
            }
            const conjoint = salarie.nomConjoint ? 1 : 0;
            propositionPersonnesACharge = conjoint + salarie._count.enfants;
            sourceProposition =
                `Registre du personnel · ${conjoint} conjoint et ${salarie._count.enfants} enfant(s) à charge. ` +
                    "L'article 124 y ajoute les ascendants des deux conjoints faisant partie du ménage, que le registre ne tient pas, " +
                    "et il écarte les enfants et ascendants qui ont disposé, pendant l'année précédant celle de la réalisation des revenus, de ressources nettes supérieures à la première tranche du barème (1 944 000 FC). " +
                    "L'article 125 fige la situation au 1er janvier de l'année. La lettre de l'art. 124, al. 2 est inversée (double négation) · la lecture retenue est celle de l'éditeur. Le nombre retenu appartient donc au cabinet.";
        }
        const elements = dto.elements.map((e) => ({
            nature: e.nature,
            libelle: e.libelle,
            montantFc: e.montantFc,
            remboursementDeDepenseProfessionnelleEffective: e.remboursementDeDepenseProfessionnelleEffective,
            conditionArticle69Attestee: e.conditionArticle69Attestee ?? null,
            enNature: e.enNature === true,
        }));
        const tauxLegalAllocationsFamilialesFc = this.tauxLegalAllocationsFamiliales(dto, annexesSmig);
        const tauxLegalAllocationsNonCalcule = tauxLegalAllocationsFamilialesFc === null ? this.tauxLegalNonCalcule(dto, annexesSmig) : null;
        const premierPassage = (0, assiettes_paie_1.assiettesExactes)(elements, {
            tauxLegalAllocationsFamilialesFc,
            tauxLegalAllocationsNonCalcule,
        });
        const { verdict: lesCotisations, totalTravailleurExact } = (0, cotisations_paie_1.cotisationsExactes)(premierPassage.socialeExacte, {
            moisDePaie: dto.moisDePaie,
            versionsDossier: (0, baremes_dossier_1.versionsDuDossier)(versionsBaremes),
            natureEmployeurInpp: dto.natureEmployeurInpp ?? null,
            effectif: dto.effectif ?? null,
            reductionTauxInppPoints: dto.reductionTauxInppPoints ?? null,
            referenceReductionInpp: dto.referenceReductionInpp ?? null,
            majorationRisquesProfessionnelsPourCent: dto.majorationRisquesProfessionnelsPourCent ?? null,
            regimeCnss,
            joursPayes: dto.joursPayes ?? null,
            dateMiseADisposition: dto.dateMiseADisposition ? dto.dateMiseADisposition.slice(0, 10) : null,
            annexesSmig,
        });
        const retenuesArticle71 = (0, decimal_exact_1.plus)(totalTravailleurExact, (0, decimal_exact_1.depuisNombre)(Math.max(0, dto.retenuesArticle71Fc ?? 0)));
        const secondPassage = (0, assiettes_paie_1.assiettesExactes)(elements, {
            tauxLegalAllocationsFamilialesFc,
            tauxLegalAllocationsNonCalcule,
            retenuesArticle71,
            quotePartOuvriereNonChiffree: lesCotisations.quotePartOuvriereNonChiffree,
        });
        const deuxAssiettes = secondPassage.verdict;
        const regime = (0, bareme_irpp_1.regimeApplicable)(dto.regimeSalarial ?? 'BAREME_ARTICLE_118');
        const retenue = borne.applicable && regime.calculable && secondPassage.netteExacte !== null
            ? (0, bareme_irpp_1.retenueMensuelle)(dto.moisDePaie, secondPassage.netteExacte, dto.personnesACharge ?? 0)
            : null;
        const totalVerse = (0, decimal_exact_1.somme)(elements
            .filter((e) => (0, passation_paie_1.estVerseEnEspeces)(e.nature, e.enNature))
            .map((e) => (0, decimal_exact_1.depuisNombre)(Math.max(0, e.montantFc))));
        const { verdict: net, netExact } = (0, cotisations_paie_1.netAPayerExact)(totalVerse, lesCotisations.quotePartOuvriereNonChiffree ? null : totalTravailleurExact, retenue ? retenue.retenueFc : null, retenuesAvancesExactes);
        if (netExact !== null && (0, cotisations_paie_1.netNegatifAuCentime)(netExact)) {
            throw new common_1.BadRequestException(`Les retenues d'avance et de prêt (${(0, decimal_exact_1.versNombre)(retenuesAvancesExactes).toFixed(2)} FC) dépassent ce qui reste dû au travailleur ce mois-ci · réduisez-les.`);
        }
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, ville: true },
        });
        const passation = (0, passation_paie_1.passationPaie)({
            referentiel: tenant.referentiel,
            elements: dto.elements.map((e) => ({
                nature: e.nature,
                libelle: e.libelle,
                montantFc: e.montantFc,
                enNature: e.enNature === true,
            })),
            cotisations: lesCotisations.lignes.map((l) => ({
                cle: l.cle,
                charge: l.charge,
                montantFc: l.montantFc,
            })),
            abstentionsCotisations: lesCotisations.abstentions,
            irppFc: retenue ? retenue.retenueFc : null,
            netAPayerFc: net.netAPayerFc,
            retenuesAvances: retenuesAvances.map((r) => ({
                type: r.type,
                categoriePret: r.categoriePret,
                libelle: r.libelle,
                montantFc: r.montantFc,
            })),
        });
        const quotite = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: dto.moisDePaie,
            annexesSmig,
            remunerationFc: deuxAssiettes.assietteSocialeFc,
            classeProfessionnelle: dto.classeProfessionnelle ?? null,
            retenuesFiscalesFc: retenue ? retenue.retenueFc : null,
            retenuesSocialesFc: lesCotisations.lignes.some((l) => l.charge === 'TRAVAILLEUR')
                ? lesCotisations.totalTravailleurFc
                : null,
            logementFourniEnNature: dto.logementFourniEnNature === true ||
                elements.some((e) => e.nature === 'LOGEMENT_OU_SON_INDEMNITE' && e.enNature === true && e.montantFc > 0),
            logementEnNatureDejaDefalque: dto.logementEnNatureDejaDefalque,
            indemniteDeLogementVersee: elements.some((e) => e.nature === 'LOGEMENT_OU_SON_INDEMNITE' && e.montantFc > 0 && e.enNature !== true),
            obligationAlimentaireLegale: dto.obligationAlimentaireLegale,
        });
        return {
            moisDePaie: dto.moisDePaie,
            referentiel: tenant.referentiel,
            conversion,
            passation,
            quotite,
            retenuesAvances,
            allocationsConge: dtoStipule.allocationsCongePortees ?? [],
            reserveRetenuesAvances: retenuesAvances.length ? avances_salaire_1.RESERVE_QUOTITE_AVANCES : null,
            reserveSaisies: (0, avances_salaire_1.reserveQuotiteSaisies)(retenuesAvances.filter((r) => r.type === 'SAISIE_ARRET').reduce((s, r) => s + r.montantFc, 0), quotite.quotiteCumuleeFc ?? quotite.quotiteAlimentaireFc ?? quotite.quotiteOrdinaireFc),
            retenuesAutorisees: {
                liste: retenues_autorisees_1.RETENUES_ARTICLE_112,
                sanction: retenues_autorisees_1.SANCTION_ARTICLE_112,
                cotisationSyndicale: retenues_autorisees_1.REPONSE_COTISATION_SYNDICALE,
                cessionSyndicale: retenues_autorisees_1.RESERVE_CESSION_SYNDICALE,
                litteraeDatees: retenues_autorisees_1.RESERVE_LITTERAE_DATEES,
            },
            tauxLegalAllocationsFamilialesFc,
            reserveTauxLegalAllocations: this.reserveTauxLegalAllocations(dto, tauxLegalAllocationsFamilialesFc),
            tauxJournalierAllocationsFamilialesFc: typeof dto.tauxLegalAllocationsFamilialesFc !== 'number' && typeof dto.enfantsBeneficiairesAllocations === 'number'
                ? ((0, bareme_smig_1.allocationFamilialeJournaliere)(dto.moisDePaie, 1, annexesSmig).valeur?.parEnfantFc ?? null)
                : null,
            reserveIndemniteLogement: (0, indemnite_logement_kinshasa_1.reserveIndemniteLogementKinshasa)(elements, tenant.ville, dto.moisDePaie),
            cotisations: lesCotisations,
            net,
            baremeApplicable: borne.applicable,
            motifBaremeInapplicable: borne.motif,
            regimeSalarial: {
                regime: dto.regimeSalarial ?? 'BAREME_ARTICLE_118',
                declare: dto.regimeSalarial !== undefined,
                calculable: regime.calculable,
                motif: dto.regimeSalarial === undefined ? bareme_irpp_1.RESERVE_REGIME_NON_DECLARE : regime.motif,
            },
            assiettes: deuxAssiettes,
            personnesAChargeRetenues: dto.personnesACharge ?? 0,
            propositionPersonnesACharge,
            sourceProposition,
            retenue,
            avertissement: "Ceci n'est PAS un bulletin de paie et ne tient PAS lieu de livre de paie des articles 213 à 215. " +
                "OmegaX rend ici les deux assiettes, les cotisations des deux côtés, la retenue de l'article 119, " +
                "le net, la quotité saisissable de l'article 114 et une PROPOSITION d'écriture · il ne conserve " +
                "rien, ne poste rien et ne remet aucun décompte écrit au sens de l'article 103. " +
                "Le décompte écrit s'obtient en ÉMETTANT le bulletin, qui fige ce calcul et lui donne un numéro. " +
                "La retenue rendue est un ACOMPTE sur l'impôt annuel de l'article 116, jamais un solde.",
        };
    }
    livreDePaie(_tenantId, dto) {
        return {
            ...(0, livre_de_paie_1.livreDePaie)({
                siegeDExploitation: dto.siegeDExploitation ?? null,
                formeDuDocument: dto.formeDuDocument ?? null,
                autorisationInspecteurDuTravail: dto.autorisationInspecteurDuTravail ?? null,
                effectifHabituel: dto.effectifHabituel ?? null,
                exclusivementPersonnelDomestique: dto.exclusivementPersonnelDomestique,
                mentionsPortees: dto.mentionsPortees ?? [],
            }),
            mentions: livre_de_paie_1.MENTIONS_MODELE_2008,
            formules: livre_de_paie_1.FORMULES_DU_MODELE,
            destinationDesDoubles: livre_de_paie_1.DESTINATION_DES_DOUBLES,
            texteSecondDouble: livre_de_paie_1.TEXTE_ARTICLE_2_SECOND_DOUBLE,
            arrete1422018: {
                reference: livre_de_paie_1.REFERENCE_ARRETE_142_2018,
                mentions: livre_de_paie_1.MENTIONS_ARRETE_142_2018,
                ecarts: livre_de_paie_1.ECARTS_2008_2018,
            },
            arreteDuModele: livre_de_paie_1.ARRETE_DU_MODELE,
            doublesDetachablesMinimum: livre_de_paie_1.DOUBLES_DETACHABLES_MINIMUM,
            sanctionArticle103: livre_de_paie_1.SANCTION_ARTICLE_103,
            reserveArticle104: livre_de_paie_1.RESERVE_ARTICLE_104,
        };
    }
    async decompteFinal(tenantId, dto) {
        const initiative = dto.initiative;
        const motif = dto.motif;
        const typeContrat = dto.typeContrat;
        const executionPreavis = dto.executionPreavis ?? null;
        const refus = (0, decompte_final_1.motifRefusDecompte)({ initiative, motif, typeContrat, executionPreavis });
        if (refus)
            throw new common_1.BadRequestException(refus);
        let allocationFamilialeParEnfantFc = null;
        let explicationAllocationFamiliale = null;
        if (dto.moisDeCessation !== undefined) {
            if (!(0, bulletin_paie_1.moisValide)(dto.moisDeCessation)) {
                throw new common_1.BadRequestException('Le mois de cessation doit être écrit AAAA-MM.');
            }
            const annexesSmig = (0, baremes_dossier_1.annexesSmigDuDossier)(await this.versionsBaremesDuMois(tenantId, dto.moisDeCessation));
            const a = (0, bareme_smig_1.allocationFamilialeJournaliere)(dto.moisDeCessation, 1, annexesSmig);
            allocationFamilialeParEnfantFc = a.valeur?.parEnfantFc ?? null;
            explicationAllocationFamiliale = a.explication;
        }
        return (0, decompte_final_1.decompteFinal)({
            anneesAnciennete: dto.anneesAnciennete,
            moisNonCouvertsParUnConge: dto.moisNonCouvertsParUnConge,
            moinsDeDixHuitAns: dto.moinsDeDixHuitAns ?? false,
            initiative,
            motif,
            typeContrat,
            periodeDEssai: dto.periodeDEssai ?? false,
            joursDEssaiEcoules: dto.joursDEssaiEcoules ?? null,
            delegueSyndical: dto.delegueSyndical,
            dateNotification: dto.dateNotification ? dto.dateNotification.slice(0, 10) : null,
            preavisRetenuJours: dto.preavisRetenuJours ?? null,
            forceMajeureConstateeParInspecteur: dto.forceMajeureConstateeParInspecteur ?? false,
            deuxMoisDeSuspension: dto.deuxMoisDeSuspension ?? false,
            executionPreavis,
            joursPreavisNonObserves: dto.joursPreavisNonObserves ?? null,
            avantagesEnNatureRestantsFc: dto.avantagesEnNatureRestantsFc ?? null,
            nouvelEmploiJustifie: dto.nouvelEmploiJustifie ?? null,
            delaiDepartNouvelEmploiJours: dto.delaiDepartNouvelEmploiJours ?? null,
            partieResponsable: dto.partieResponsable ?? null,
            remunerationJournaliereFc: dto.remunerationJournaliereFc ?? null,
            remunerationMensuelleFc: dto.remunerationMensuelleFc ?? null,
            moyenneMensuelleArticle66Fc: dto.moyenneMensuelleArticle66Fc ?? null,
            moyenneMensuelleArticle142Fc: dto.moyenneMensuelleArticle142Fc ?? null,
            avantagesPendantPreavisFc: dto.avantagesPendantPreavisFc ?? null,
            dateRuptureContrat: dto.dateRuptureContrat ? dto.dateRuptureContrat.slice(0, 10) : null,
            dateTermeContrat: dto.dateTermeContrat ? dto.dateTermeContrat.slice(0, 10) : null,
            avantagesJusquAuTermeFc: dto.avantagesJusquAuTermeFc ?? null,
            montantConvenuCommunAccordFc: dto.montantConvenuCommunAccordFc ?? null,
            arrieresFc: dto.arrieresFc ?? null,
            gratificationFc: dto.gratificationFc ?? null,
            gratificationStipulee: dto.gratificationStipulee
                ? {
                    montantAnnuelFc: dto.gratificationStipulee.montantAnnuelFc,
                    source: dto.gratificationStipulee.source,
                    debutPeriode: dto.gratificationStipulee.debutPeriode.slice(0, 10),
                    finPeriode: dto.gratificationStipulee.finPeriode.slice(0, 10),
                }
                : null,
            indemniteStipulee: dto.indemniteStipulee
                ? { montantFc: dto.indemniteStipulee.montantFc, source: dto.indemniteStipulee.source }
                : null,
            enfantsBeneficiairesAllocations: dto.enfantsBeneficiairesAllocations ?? null,
            joursAllocationsFamiliales: dto.joursAllocationsFamiliales ?? null,
            allocationFamilialeParEnfantFc,
            explicationAllocationFamiliale,
        });
    }
    longueurChaineRenouvellement(contrats, id) {
        const parId = new Map(contrats.map((c) => [c.id, c]));
        let n = 0;
        let courant = parId.get(id);
        while (courant?.renouvelleDeId && n <= contrats.length) {
            n += 1;
            courant = parId.get(courant.renouvelleDeId);
        }
        return n;
    }
    async effectif(tenantId, ala) {
        return (0, effectif_registre_1.effectifDuRegistre)(this.prisma, tenantId, ala);
    }
    async emettreBulletin(tenantId, userId, salarieId, dto, maintenant = new Date()) {
        if (!(0, bulletin_paie_1.moisValide)(dto.moisDePaie)) {
            throw new common_1.BadRequestException('Mois de paie illisible · la forme attendue est AAAA-MM.');
        }
        const salarie = await this.prisma.salarie.findFirst({
            where: { id: salarieId, tenantId },
            select: {
                id: true,
                nom: true,
                postNom: true,
                prenoms: true,
                matricule: true,
                numeroAffiliationCnss: true,
                contrats: {
                    select: {
                        id: true,
                        dateEntreeEnVigueur: true,
                        dateFin: true,
                        natureTravail: true,
                        categorieProfessionnelle: true,
                        remunerationBase: true,
                        periodiciteRemuneration: true,
                        deviseRemuneration: true,
                    },
                },
            },
        });
        if (!salarie)
            throw new common_1.NotFoundException('Salarié introuvable dans ce dossier.');
        const contrat = (0, bulletin_paie_1.contratCouvrantLeMois)(salarie.contrats, dto.moisDePaie);
        if (!contrat) {
            throw new common_1.BadRequestException(`Aucun contrat de ce salarié n'est en cours en ${dto.moisDePaie} · la paie exécute un contrat, et le bulletin doit dire lequel.`);
        }
        const { dto: saisie } = await this.resoudreSaisie(tenantId, salarieId, dto);
        const conge = await this.motifSalairePendantLeConge(tenantId, salarieId, contrat, dto.moisDePaie, saisie);
        if (conge.refus)
            throw new common_1.BadRequestException(`Bulletin non émis · ${conge.refus}`);
        const simulation = await this.simulerPaie(tenantId, salarieId, saisie, maintenant);
        const motifs = (0, bulletin_paie_1.motifsRefusEmission)(simulation);
        if (motifs.length > 0) {
            throw new common_1.BadRequestException({
                message: `Bulletin non émis · ${motifs.length} montant(s) non calculé(s). ${bulletin_paie_1.TEXTE_ARTICLE_103}`,
                motifs,
            });
        }
        const cree = await this.figerBulletin(tenantId, userId, {
            salarieId,
            salarie,
            contrat,
            moisDePaie: dto.moisDePaie,
            nature: client_1.NatureBulletinPaie.MOIS,
            simulation,
            entree: saisie,
            calculEnPlus: {},
        });
        const emis = await this.lireBulletin(tenantId, cree.id);
        return conge.avertissements.length ? { ...emis, avertissements: conge.avertissements } : emis;
    }
    async motifSalairePendantLeConge(tenantId, salarieId, contrat, mois, saisie) {
        const devise = saisie.deviseStipulation ?? 'CDF';
        const salaire = saisie.elements
            .filter((e) => e.nature === 'SALAIRE_OU_TRAITEMENT')
            .reduce((n, e) => n + Number((devise === 'USD' ? e.montantUsd : e.montantFc) ?? 0), 0);
        const avertissements = [];
        const r = await (0, salaire_pendant_le_conge_1.confronterSalaireAuxConges)(this.prisma, tenantId, salarieId, { mois, salaire, devise, contrat });
        if (r.refus)
            return { refus: r.refus, avertissements };
        if (r.avertissement)
            avertissements.push(r.avertissement);
        const portees = saisie.allocationsCongePortees ?? [];
        if (portees.length) {
            const conges = await this.prisma.congeSalarie.findMany({
                where: { tenantId, salarieId, id: { in: portees.map((a) => a.congeId) } },
                take: portees.length,
                select: { id: true, du: true, au: true, joursVoyage: true, remunerationJournaliere: true, deviseAllocation: true },
            });
            for (const c of conges) {
                const autres = await (0, salaire_pendant_le_conge_1.confronterLesBulletinsEmis)(this.prisma, tenantId, salarieId, {
                    id: c.id,
                    du: c.du.toISOString().slice(0, 10),
                    au: c.au.toISOString().slice(0, 10),
                    joursVoyage: c.joursVoyage,
                    remunerationJournaliere: c.remunerationJournaliere === null ? null : Number(c.remunerationJournaliere),
                    deviseAllocation: c.deviseAllocation,
                }, { saufMois: mois, issue: (numero) => `annulez le bulletin n° ${numero} et réémettez-le, puis émettez celui-ci.` });
                avertissements.push(...autres.avertissements);
            }
        }
        return { refus: null, avertissements };
    }
    async figerBulletin(tenantId, userId, p) {
        const { salarieId, salarie, contrat, simulation } = p;
        const chiffres = (0, bulletin_paie_1.chiffresFigeables)(simulation);
        if ('motifs' in chiffres) {
            throw new common_1.BadRequestException({
                message: `Rien n'est émis · ${chiffres.motifs.join(' · ')}`,
                motifs: chiffres.motifs,
            });
        }
        const creer = () => (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`bulletins-paie:${tenantId}`}))`;
            const actif = await tx.bulletinPaie.findFirst({
                where: { tenantId, salarieId, moisDePaie: p.moisDePaie, statut: client_1.StatutBulletinPaie.EMIS },
                select: { numero: true, nature: true },
            });
            if (actif) {
                const quoi = actif.nature === client_1.NatureBulletinPaie.DECOMPTE_FINAL ? 'Le décompte final' : 'Le bulletin';
                const remplace = p.nature === client_1.NatureBulletinPaie.DECOMPTE_FINAL || actif.nature === client_1.NatureBulletinPaie.DECOMPTE_FINAL
                    ? ' Le décompte final remplace le bulletin du mois de cessation · un seul des deux est actif.'
                    : '';
                throw new common_1.BadRequestException(`${quoi} n° ${actif.numero} est déjà émis pour ce salarié en ${p.moisDePaie}. Annulez-le d'abord s'il est faux.${remplace} ${bulletin_paie_1.LIMITE_UN_BULLETIN_PAR_MOIS}`);
            }
            const dernier = await tx.bulletinPaie.aggregate({ where: { tenantId }, _max: { numero: true } });
            const cree = await tx.bulletinPaie.create({
                data: {
                    tenantId,
                    salarieId,
                    contratId: contrat.id,
                    numero: (dernier._max.numero ?? 0) + 1,
                    moisDePaie: p.moisDePaie,
                    nature: p.nature,
                    nomComplet: (0, bulletin_paie_1.nomCompletMajuscules)(salarie),
                    matricule: salarie.matricule,
                    emploi: contrat.natureTravail,
                    categorieProfessionnelle: contrat.categorieProfessionnelle,
                    numeroAffiliationCnss: salarie.numeroAffiliationCnss,
                    totalVerseFc: simulation.net.totalVerseFc,
                    assietteSocialeFc: chiffres.assietteSocialeFc,
                    cotisationsTravailleurFc: simulation.cotisations.totalTravailleurFc,
                    cotisationsEmployeurFc: simulation.cotisations.totalEmployeurFc,
                    irppFc: chiffres.irppFc,
                    netAPayerFc: chiffres.netAPayerFc,
                    entree: JSON.parse(JSON.stringify(p.entree)),
                    calcul: JSON.parse(JSON.stringify({
                        ...simulation,
                        ...p.calculEnPlus,
                        contrat: {
                            remunerationBase: contrat.remunerationBase === null ? null : Number(contrat.remunerationBase),
                            periodiciteRemuneration: contrat.periodiciteRemuneration,
                            deviseRemuneration: contrat.deviseRemuneration,
                        },
                    })),
                    emisPar: userId,
                },
            });
            for (const r of simulation.retenuesAvances) {
                const lignes = await tx.retenueAvanceBulletin.findMany({
                    where: { tenantId, avanceId: r.avanceId },
                    select: { montantFc: true, bulletin: { select: { statut: true } } },
                });
                const avance = await tx.avanceSalaire.findFirstOrThrow({ where: { id: r.avanceId, tenantId }, select: { montantFc: true } });
                const solde = (0, avances_salaire_1.soldeAvance)(Number(avance.montantFc), lignes.map((x) => ({ montantFc: Number(x.montantFc), bulletinAnnule: x.bulletin.statut !== client_1.StatutBulletinPaie.EMIS })));
                const refus = (0, avances_salaire_1.motifRefusRetenue)(r.montantFc, solde, r.libelle);
                if (refus)
                    throw new common_1.BadRequestException(refus);
                await tx.retenueAvanceBulletin.create({
                    data: { tenantId, avanceId: r.avanceId, bulletinId: cree.id, montantFc: r.montantFc },
                });
            }
            if (simulation.allocationsConge.length) {
                await (0, conges_service_1.lierCongesAuBulletin)(tx, tenantId, cree.id, simulation.allocationsConge);
            }
            return cree;
        });
        try {
            return await creer();
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                try {
                    return await creer();
                }
                catch (e2) {
                    if (e2 instanceof client_1.Prisma.PrismaClientKnownRequestError && e2.code === 'P2002') {
                        throw new common_1.ConflictException('Deux bulletins ont été émis au même instant · réessayez.');
                    }
                    throw e2;
                }
            }
            throw e;
        }
    }
    async emettreDecompteFinal(tenantId, userId, salarieId, dto, maintenant = new Date()) {
        const p = await this.preparerDecompteFinal(tenantId, salarieId, dto, maintenant, true);
        if (p.etat !== 'CHIFFRE')
            throw refusNomme('Décompte final non émis', p.motifs);
        const { mois, salarie, contrat, paieComplete, simulation, verdict, faits, indemnites } = p;
        const avertissements = (0, decompte_final_emis_1.avertissementsPassation)(indemnites, passation_paie_1.NATURES_SANS_IMPUTATION);
        const { avances } = await this.avancesARetenir(tenantId, salarieId);
        const retenuesDuDecompte = Object.fromEntries(simulation.retenuesAvances.map((r) => [r.avanceId, r.montantFc]));
        avertissements.push(...(0, decompte_retenues_stipulations_1.avertissementsSoldesRestants)(avances, retenuesDuDecompte));
        const reservesDecompteEmis = [decompte_final_emis_1.RESERVE_VERSEMENT_UNIQUE, decompte_final_emis_1.RESERVE_DU_PAR_LE_TRAVAILLEUR, livre_de_paie_1.DECOMPTE_A_LA_RUPTURE];
        if (indemnites.some((e) => e.reserve === decompte_final_emis_1.FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE)) {
            reservesDecompteEmis.push(decompte_final_emis_1.FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE);
        }
        if (simulation.retenuesAvances.some((r) => r.type === 'PRET'))
            reservesDecompteEmis.push(decompte_retenues_stipulations_1.RESERVE_PRET_EXIGIBILITE);
        const cree = await this.figerBulletin(tenantId, userId, {
            salarieId,
            salarie,
            contrat,
            moisDePaie: mois,
            nature: client_1.NatureBulletinPaie.DECOMPTE_FINAL,
            simulation,
            entree: { ...paieComplete, decompte: faits, ventilationAvantages: dto.ventilationAvantages ?? [] },
            calculEnPlus: {
                decompte: verdict,
                reservesDecompteEmis,
                avertissementsDecompteEmis: avertissements,
            },
        });
        return { ...(await this.lireBulletin(tenantId, cree.id)), avertissements: [...avertissements, ...p.avertissementsConge] };
    }
    async proposerRetenuesDecompte(tenantId, salarieId, dto, maintenant = new Date()) {
        const sansRetenues = { ...dto, paie: { ...dto.paie, retenuesAvances: [] } };
        const p = await this.preparerDecompteFinal(tenantId, salarieId, sansRetenues, maintenant, false);
        const { avances, tronque } = await this.avancesARetenir(tenantId, salarieId);
        const net = p.etat === 'CHIFFRE' ? p.simulation.net.netAPayerFc : null;
        const proposition = (0, decompte_retenues_stipulations_1.propositionRetenuesDecompte)(avances, net);
        return {
            ...proposition,
            fondement: decompte_retenues_stipulations_1.FONDEMENT_RETENUES_DECOMPTE,
            motifsNetNonChiffre: p.etat === 'CHIFFRE' ? [] : p.motifs,
            tronque,
        };
    }
    async avancesARetenir(tenantId, salarieId) {
        const lignes = await this.prisma.avanceSalaire.findMany({
            where: { tenantId, salarieId },
            orderBy: [{ dateOctroi: 'asc' }, { id: 'asc' }],
            take: exports.PLAFOND_AVANCES_DECOMPTE + 1,
            include: { retenues: { select: { montantFc: true, bulletin: { select: { statut: true } } } } },
        });
        const tronque = lignes.length > exports.PLAFOND_AVANCES_DECOMPTE;
        const avances = lignes.slice(0, exports.PLAFOND_AVANCES_DECOMPTE).map((a) => ({
            avanceId: a.id,
            type: a.type,
            dateOctroi: a.dateOctroi.toISOString().slice(0, 10),
            libelle: a.type === 'SAISIE_ARRET'
                ? `Saisie-arrêt notifiée le ${a.dateOctroi.toISOString().slice(0, 10)} (acte ${a.referenceActe ?? '·'}) · ${a.objet}`
                : `${a.type === 'PRET' ? 'Prêt' : a.type === 'ACOMPTE' ? 'Acompte' : 'Avance'} du ${a.dateOctroi.toISOString().slice(0, 10)} · ${a.objet}`,
            soldeFc: (0, avances_salaire_1.soldeAvance)(Number(a.montantFc), a.retenues.map((x) => ({ montantFc: Number(x.montantFc), bulletinAnnule: x.bulletin.statut !== client_1.StatutBulletinPaie.EMIS }))),
        }));
        return { avances, tronque };
    }
    async preparerDecompteFinal(tenantId, salarieId, dto, maintenant, pourEmettre) {
        const mois = dto.paie.moisDePaie;
        if (!(0, bulletin_paie_1.moisValide)(mois)) {
            throw new common_1.BadRequestException('Mois de paie illisible · la forme attendue est AAAA-MM.');
        }
        if (dto.decompte.moisDeCessation !== undefined && dto.decompte.moisDeCessation !== mois) {
            throw new common_1.BadRequestException(`Le mois de cessation (${dto.decompte.moisDeCessation}) et le mois de paie (${mois}) diffèrent · le décompte final remplace le bulletin du mois de cessation.`);
        }
        if ((dto.paie.deviseStipulation ?? 'CDF') !== 'CDF') {
            throw new common_1.BadRequestException(decompte_final_emis_1.RESERVE_EN_FRANCS);
        }
        const salarie = await this.prisma.salarie.findFirst({
            where: { id: salarieId, tenantId },
            select: {
                id: true,
                nom: true,
                postNom: true,
                prenoms: true,
                matricule: true,
                numeroAffiliationCnss: true,
                contrats: {
                    select: {
                        id: true,
                        type: true,
                        dateEntreeEnVigueur: true,
                        dateFin: true,
                        natureTravail: true,
                        categorieProfessionnelle: true,
                        remunerationBase: true,
                        periodiciteRemuneration: true,
                        deviseRemuneration: true,
                    },
                },
            },
        });
        if (!salarie)
            throw new common_1.NotFoundException('Salarié introuvable dans ce dossier.');
        const contrat = (0, bulletin_paie_1.contratCouvrantLeMois)(salarie.contrats, mois);
        if (!contrat) {
            throw new common_1.BadRequestException(`Aucun contrat de ce salarié n'est en cours en ${mois} · le décompte final se rapporte au contrat résilié, et doit dire lequel.`);
        }
        const refusContrat = (0, decompte_final_emis_1.motifRefusMoisDeCessation)(contrat.dateFin, mois) ?? (0, decompte_final_emis_1.motifRefusTypeContrat)(contrat.type, dto.decompte.typeContrat);
        if (refusContrat)
            throw new common_1.BadRequestException(refusContrat);
        const { dto: saisie } = await this.resoudreSaisie(tenantId, salarieId, dto.paie);
        const negatifs = (0, decompte_final_emis_1.motifsElementsNegatifs)(saisie.elements);
        if (negatifs.length > 0)
            throw refusNomme('Décompte final non émis', negatifs);
        const conge = await this.motifSalairePendantLeConge(tenantId, salarieId, contrat, mois, saisie);
        if (conge.refus) {
            if (!pourEmettre)
                return { etat: 'NON_CHIFFRE', motifs: [conge.refus] };
            throw refusNomme('Décompte final non émis', [conge.refus]);
        }
        const elementsDuMois = saisie.elements.map((e) => ({
            nature: e.nature,
            montantFc: e.montantFc,
            enNature: e.enNature === true,
        }));
        if (elementsDuMois.length === 0 && dto.decompte.arrieresFc !== 0) {
            throw new common_1.BadRequestException("Le décompte final remplace le bulletin du mois de cessation · saisissez les éléments du mois (salaire des jours prestés, sommes restant dues), ou déclarez zéro arriéré si rien n'est dû.");
        }
        const arrieresFc = (0, decompte_final_emis_1.arrieresDesElements)(elementsDuMois);
        if (typeof dto.decompte.arrieresFc === 'number' && Math.abs(dto.decompte.arrieresFc - arrieresFc) >= 0.005) {
            throw new common_1.BadRequestException(`Les arriérés déclarés (${dto.decompte.arrieresFc.toFixed(2)} FC) diffèrent des éléments du mois versés (${arrieresFc.toFixed(2)} FC) · au décompte émis, les arriérés SONT ces éléments.`);
        }
        const finContrat = contrat.dateFin.toISOString().slice(0, 10);
        const finGratification = dto.decompte.gratificationStipulee?.finPeriode?.slice(0, 10);
        if (finGratification && finGratification > finContrat) {
            throw new common_1.BadRequestException(`La période de référence de la gratification finit le ${finGratification}, après la fin du contrat (${finContrat}) · le prorata ne compte que les mois de service.`);
        }
        const faits = { ...dto.decompte, moisDeCessation: mois, arrieresFc };
        const verdict = await this.decompteFinal(tenantId, faits);
        const { elements: indemnites, refus } = (0, decompte_final_emis_1.elementsDuDecompte)(verdict, dto.ventilationAvantages ?? []);
        if (refus.length > 0) {
            if (!pourEmettre)
                return { etat: 'NON_CHIFFRE', motifs: refus };
            throw refusNomme(`Décompte final non émis · un solde partiel se lit comme un solde. ${bulletin_paie_1.TEXTE_ARTICLE_103}`, refus);
        }
        const doubles = (0, decompte_final_emis_1.motifsDoubleCompte)(elementsDuMois, indemnites);
        if (doubles.length > 0)
            throw refusNomme('Décompte final non émis', doubles);
        const allocationsDecompte = (0, decompte_final_emis_1.auCentime)(indemnites.filter((e) => e.nature === 'ALLOCATIONS_FAMILIALES_LEGALES').reduce((n, e) => n + e.montantFc, 0));
        let tauxLegalAllocationsFamilialesFc = saisie.tauxLegalAllocationsFamilialesFc;
        if (allocationsDecompte > 0) {
            if (typeof saisie.tauxLegalAllocationsFamilialesFc === 'number') {
                throw refusNomme('Décompte final non émis', [
                    "Un taux légal des allocations familiales est déclaré alors que le décompte calcule ces allocations (colonne 19 du décret n° 25/22) · retirez le taux déclaré, le décompte le pose lui-même (article 69, 1).",
                ]);
            }
            tauxLegalAllocationsFamilialesFc = allocationsDecompte;
        }
        const paieComplete = {
            ...saisie,
            tauxLegalAllocationsFamilialesFc,
            elements: [
                ...saisie.elements,
                ...indemnites.map((e) => ({
                    nature: e.nature,
                    libelle: e.libelle,
                    montantFc: e.montantFc,
                    ...(typeof e.conditionArticle69Attestee === 'boolean' ? { conditionArticle69Attestee: e.conditionArticle69Attestee } : {}),
                })),
            ],
        };
        const simulation = await this.simulerPaie(tenantId, salarieId, paieComplete, maintenant);
        const motifs = (0, bulletin_paie_1.motifsRefusEmission)(simulation);
        if (motifs.length > 0) {
            if (!pourEmettre)
                return { etat: 'NON_CHIFFRE', motifs };
            throw refusNomme(`Décompte final non émis · ${motifs.length} montant(s) non calculé(s). ${bulletin_paie_1.TEXTE_ARTICLE_103}`, motifs);
        }
        const duArrondi = (0, decompte_final_emis_1.auCentime)(arrieresFc + indemnites.reduce((n, e) => n + e.montantFc, 0));
        const duAuTravailleur = verdict.totalDuAuTravailleurFc;
        const toleranceArrondi = 0.005 * (indemnites.length + 1) + 1e-9;
        if (Math.abs(duArrondi - duAuTravailleur) > toleranceArrondi || Math.abs(simulation.net.totalVerseFc - duArrondi) >= 0.005) {
            throw new common_1.BadRequestException(`Le décompte doit ${duArrondi.toFixed(2)} FC au travailleur et la paie en verserait ${simulation.net.totalVerseFc.toFixed(2)} FC · rien n'est émis.`);
        }
        return {
            etat: 'CHIFFRE',
            mois,
            salarie,
            contrat,
            paieComplete,
            simulation,
            verdict,
            faits,
            indemnites,
            avertissementsConge: conge.avertissements,
        };
    }
    async listerBulletins(tenantId, moisDePaie) {
        if (moisDePaie !== undefined && !(0, bulletin_paie_1.moisValide)(moisDePaie)) {
            throw new common_1.BadRequestException('Mois de paie illisible · la forme attendue est AAAA-MM.');
        }
        const PLAFOND = 500;
        const [lignes, total, sommes] = await Promise.all([
            this.prisma.bulletinPaie.findMany({
                where: { tenantId, moisDePaie },
                orderBy: { numero: 'desc' },
                take: PLAFOND,
                select: {
                    id: true,
                    numero: true,
                    moisDePaie: true,
                    statut: true,
                    nature: true,
                    nomComplet: true,
                    matricule: true,
                    salarieId: true,
                    totalVerseFc: true,
                    irppFc: true,
                    netAPayerFc: true,
                    emisLe: true,
                    remisLe: true,
                    annuleLe: true,
                },
            }),
            this.prisma.bulletinPaie.count({ where: { tenantId, moisDePaie } }),
            this.prisma.bulletinPaie.aggregate({
                where: { tenantId, moisDePaie, statut: client_1.StatutBulletinPaie.EMIS },
                _sum: {
                    totalVerseFc: true,
                    cotisationsTravailleurFc: true,
                    cotisationsEmployeurFc: true,
                    irppFc: true,
                    netAPayerFc: true,
                },
                _count: true,
            }),
        ]);
        const n = (d) => (d === null ? 0 : Number(d));
        return {
            bulletins: lignes.map((b) => ({
                ...b,
                totalVerseFc: Number(b.totalVerseFc),
                irppFc: Number(b.irppFc),
                netAPayerFc: Number(b.netAPayerFc),
            })),
            total,
            tronque: total > lignes.length,
            totauxEmis: {
                nombre: sommes._count,
                totalVerseFc: n(sommes._sum.totalVerseFc),
                cotisationsTravailleurFc: n(sommes._sum.cotisationsTravailleurFc),
                cotisationsEmployeurFc: n(sommes._sum.cotisationsEmployeurFc),
                irppFc: n(sommes._sum.irppFc),
                netAPayerFc: n(sommes._sum.netAPayerFc),
            },
            textes: { numerotation: bulletin_paie_1.TEXTE_NUMEROTATION, inalterabilite: bulletin_paie_1.TEXTE_INALTERABILITE, article103: bulletin_paie_1.TEXTE_ARTICLE_103 },
        };
    }
    async lireBulletin(tenantId, id) {
        const b = await this.prisma.bulletinPaie.findFirst({ where: { id, tenantId } });
        if (!b)
            throw new common_1.NotFoundException('Bulletin introuvable dans ce dossier.');
        const versements = b.statut === client_1.StatutBulletinPaie.ANNULE ? await this.versementsDuBulletinAnnule(tenantId, b) : null;
        return {
            ...b,
            versements,
            totalVerseFc: Number(b.totalVerseFc),
            assietteSocialeFc: Number(b.assietteSocialeFc),
            cotisationsTravailleurFc: Number(b.cotisationsTravailleurFc),
            cotisationsEmployeurFc: Number(b.cotisationsEmployeurFc),
            irppFc: Number(b.irppFc),
            netAPayerFc: Number(b.netAPayerFc),
            enonciations: (0, bulletin_paie_1.enonciationsDuBulletin)(b),
            reserves: b.nature === client_1.NatureBulletinPaie.DECOMPTE_FINAL
                ? [bulletin_paie_1.TEXTE_ARTICLE_103, bulletin_paie_1.TEXTE_INALTERABILITE, bulletin_paie_1.RESERVE_MODELE, livre_de_paie_1.DECOMPTE_A_LA_RUPTURE, decompte_final_emis_1.RESERVE_VERSEMENT_UNIQUE, decompte_final_emis_1.RESERVE_DU_PAR_LE_TRAVAILLEUR]
                : [bulletin_paie_1.TEXTE_ARTICLE_103, bulletin_paie_1.TEXTE_INALTERABILITE, bulletin_paie_1.RESERVE_MODELE],
        };
    }
    async versementsDuBulletinAnnule(tenantId, b) {
        const [lignes, successeur] = await Promise.all([
            this.prisma.lignePaiementSalaire.findMany({
                where: { tenantId, bulletinId: b.id, annuleLe: null },
                orderBy: { paiement: { date: 'asc' } },
                take: 50,
                select: { montant: true, paiement: { select: { date: true, piecePassee: true } } },
            }),
            this.prisma.bulletinPaie.findFirst({
                where: { tenantId, salarieId: b.salarieId, moisDePaie: b.moisDePaie, statut: client_1.StatutBulletinPaie.EMIS },
                select: { numero: true },
            }),
        ]);
        if (lignes.length === 0)
            return null;
        const montant = lignes.reduce((n, l) => n + Math.round(Number(l.montant) * 100), 0) / 100;
        const pieces = lignes.map((l) => `pièce ${l.paiement.piecePassee ?? '·'} du ${l.paiement.date.toISOString().slice(0, 10)}`).join(', ');
        return {
            montant,
            pieces: lignes.map((l) => ({ date: l.paiement.date, piece: l.paiement.piecePassee })),
            avertissement: successeur
                ? `Ce bulletin a été payé (${montant.toFixed(2)}, ${pieces}) · le versement s'impute sur le bulletin n° ${successeur.numero} du même mois, qui ne propose que le reste à payer.`
                : `Ce bulletin a été payé (${montant.toFixed(2)}, ${pieces}), et aucun bulletin émis du mois ne le remplace · le versement reste au journal sans bulletin. Réémettez le bulletin du mois, sur lequel il s'imputera, ou annulez le paiement (Paiement des salaires).`,
        };
    }
    async annulerBulletin(tenantId, userId, id, motif) {
        const texte = (motif ?? '').trim();
        if (texte.length < 5) {
            throw new common_1.BadRequestException("Le motif d'annulation est obligatoire · il est la seule trace de la correction.");
        }
        const b = await this.prisma.bulletinPaie.findFirst({
            where: { id, tenantId },
            select: { statut: true, ecritureId: true },
        });
        if (!b)
            throw new common_1.NotFoundException('Bulletin introuvable dans ce dossier.');
        if (b.statut !== client_1.StatutBulletinPaie.EMIS)
            throw new common_1.BadRequestException('Ce bulletin est déjà annulé.');
        if (b.ecritureId) {
            const ecriture = await this.prisma.ecriture.findFirst({
                where: { id: b.ecritureId, tenantId },
                select: { statut: true, numeroPiece: true },
            });
            if (ecriture && ecriture.statut !== client_1.StatutEcriture.VALIDEE) {
                throw new common_1.BadRequestException(`Ce bulletin est passé dans l'écriture de paie n° ${ecriture.numeroPiece ?? ''}, encore au brouillard. ` +
                    "Annulez d'abord la comptabilisation du mois, puis le bulletin, puis repassez la paie.");
            }
        }
        await this.prisma.bulletinPaie.update({
            where: { id },
            data: { statut: client_1.StatutBulletinPaie.ANNULE, annuleLe: new Date(), annulePar: userId, motifAnnulation: texte },
        });
        return this.lireBulletin(tenantId, id);
    }
    async declarerRemise(tenantId, id, remisLe) {
        const b = await this.prisma.bulletinPaie.findFirst({
            where: { id, tenantId },
            select: { statut: true, remisLe: true, emisLe: true },
        });
        if (!b)
            throw new common_1.NotFoundException('Bulletin introuvable dans ce dossier.');
        if (b.statut !== client_1.StatutBulletinPaie.EMIS)
            throw new common_1.BadRequestException("Un bulletin annulé ne se remet pas.");
        if (b.remisLe)
            throw new common_1.BadRequestException('La remise de ce bulletin est déjà déclarée · elle ne se corrige pas.');
        const date = new Date(remisLe);
        const refus = (0, bulletin_paie_1.motifRefusRemise)(date, b.emisLe, new Date());
        if (refus)
            throw new common_1.BadRequestException(refus);
        await this.prisma.bulletinPaie.update({ where: { id }, data: { remisLe: date } });
        return this.lireBulletin(tenantId, id);
    }
};
exports.PersonnelService = PersonnelService;
exports.PersonnelService = PersonnelService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PersonnelService);
//# sourceMappingURL=personnel.service.js.map