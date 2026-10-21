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
exports.DeclarationDeviseANouveauService = exports.REFERENCE_DECLARATION_DEVISE = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const libelle_exercice_1 = require("../../common/libelle-exercice");
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const numerotation_piece_1 = require("../journaux/numerotation-piece");
const gel_cloture_1 = require("../exercice/gel-cloture");
const lettrage_service_1 = require("../lettrage/lettrage.service");
const devises_service_1 = require("./devises.service");
const perimetre_reevaluation_1 = require("./perimetre-reevaluation");
const declaration_devise_a_nouveau_1 = require("./declaration-devise-a-nouveau");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
exports.REFERENCE_DECLARATION_DEVISE = 'DECLARATION-DEVISE';
const PLAFOND_LISTE = 500;
const PLAFOND_LECTURE_PAR_EXERCICE = 20_000;
const PLAFOND_REEVALUATIONS_LUES = 200;
const MOUVEMENTS_NOMMES = 10;
const SELECT_LIGNE = {
    id: true,
    compteId: true,
    libelle: true,
    debit: true,
    credit: true,
    deviseId: true,
    lettre: true,
    lettrageId: true,
    rapprochementId: true,
    dateEcheance: true,
    ecritureId: true,
    _count: { select: { ventilations: true } },
    compte: { select: { numero: true, intitule: true } },
    ecriture: {
        select: {
            id: true,
            tenantId: true,
            exerciceId: true,
            journalId: true,
            date: true,
            numeroPiece: true,
            reference: true,
            libelle: true,
            statut: true,
            estGenereeParCloture: true,
            estANouveauProvisoire: true,
            estSoldeDesComptesDeGestion: true,
            exercice: { select: { id: true, statut: true, dateDebut: true, dateFin: true } },
        },
    },
};
function versLigneDeReport(l) {
    return {
        id: l.id,
        compteId: l.compteId,
        debit: Number(l.debit),
        credit: Number(l.credit),
        libelle: l.libelle ?? l.ecriture?.libelle ?? null,
        dateEcheance: l.dateEcheance,
    };
}
function versLigneADeclarer(l) {
    return {
        numero: l.compte.numero,
        debit: Number(l.debit),
        credit: Number(l.credit),
        deviseId: l.deviseId,
        lettre: l.lettre,
        lettrageId: l.lettrageId,
        rapprochementId: l.rapprochementId,
        aDesVentilations: l._count.ventilations > 0,
        ecriture: {
            estGenereeParCloture: l.ecriture.estGenereeParCloture,
            estANouveauProvisoire: l.ecriture.estANouveauProvisoire,
            estSoldeDesComptesDeGestion: l.ecriture.estSoldeDesComptesDeGestion,
            statut: l.ecriture.statut,
            exercice: l.ecriture.exercice,
        },
    };
}
let DeclarationDeviseANouveauService = class DeclarationDeviseANouveauService {
    constructor(prisma, ecritureService, devises) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
        this.devises = devises;
    }
    async ecrituresHorsMouvements(tenantId) {
        const [reevaluations, declarations] = await Promise.all([
            this.prisma.reevaluation.findMany({
                where: { tenantId },
                orderBy: [{ dateReevaluation: 'desc' }, { id: 'asc' }],
                take: PLAFOND_REEVALUATIONS_LUES + 1,
                select: {
                    ecritureEcartsId: true,
                    ecritureProvisionId: true,
                    ecritureExtourneId: true,
                    contrePassationDeclareeId: true,
                    annulation: true,
                    annulationsContrePassation: true,
                },
            }),
            this.prisma.declarationDeviseANouveau.findMany({
                where: { tenantId, ecritureCorrectionId: { not: null } },
                select: { ecritureCorrectionId: true },
            }),
        ]);
        const ids = new Set();
        const ajouter = (x) => {
            if (typeof x === 'string')
                ids.add(x);
        };
        const lireTraces = (j) => {
            for (const a of Array.isArray(j) ? j : []) {
                if (!a || typeof a !== 'object' || Array.isArray(a))
                    continue;
                ajouter(a.ecritureId);
                ajouter(a.negatifId);
            }
        };
        for (const r of reevaluations.slice(0, PLAFOND_REEVALUATIONS_LUES)) {
            ajouter(r.ecritureEcartsId);
            ajouter(r.ecritureProvisionId);
            ajouter(r.ecritureExtourneId);
            ajouter(r.contrePassationDeclareeId);
            lireTraces(r.annulation);
            lireTraces(r.annulationsContrePassation);
        }
        for (const d of declarations)
            ajouter(d.ecritureCorrectionId);
        return { ids: [...ids], tronque: reevaluations.length > PLAFOND_REEVALUATIONS_LUES };
    }
    async contexteDeLExercice(tenantId, ex, dateLigne) {
        const [reevaluation, precedent] = await Promise.all([
            this.prisma.reevaluation.findFirst({
                where: { tenantId, annuleeLe: null, dateReevaluation: { gte: dateLigne }, exercice: { dateDebut: { gte: ex.dateDebut } } },
                orderBy: { dateReevaluation: 'desc' },
                select: { dateReevaluation: true, exercice: { select: { id: true, dateDebut: true, dateFin: true } } },
            }),
            this.prisma.exercice.findFirst({
                where: { tenantId, dateFin: { lt: ex.dateDebut }, statut: { not: client_1.StatutExercice.CLOTURE } },
                orderBy: { dateFin: 'desc' },
                select: { dateDebut: true, dateFin: true },
            }),
        ]);
        return {
            reevaluationLue: reevaluation
                ? {
                    date: reevaluation.dateReevaluation,
                    exercice: (0, libelle_exercice_1.libelleExercice)(reevaluation.exercice),
                    memeExercice: reevaluation.exercice.id === ex.id,
                }
                : null,
            exercicePrecedentOuvert: precedent ? { libelle: (0, libelle_exercice_1.libelleExercice)(precedent) } : null,
        };
    }
    async reglementsEnFrancs(tenantId, l, horsMouvements) {
        const sens = Math.sign(Number(l.debit) - Number(l.credit));
        if (sens === 0)
            return { lignes: [], total: 0 };
        const where = {
            compteId: l.compteId,
            deviseId: null,
            lettrageId: null,
            id: { not: l.id },
            ecriture: {
                tenantId,
                estANouveauProvisoire: false,
                estSoldeDesComptesDeGestion: false,
                ...ecritures_de_situation_1.HORS_SITUATION,
                ...(horsMouvements.length > 0 ? { id: { notIn: horsMouvements } } : {}),
                OR: [
                    { estGenereeParCloture: false, date: { gte: l.ecriture.date } },
                    ...(l.ecriture.reference !== 'IMPORT'
                        ? [{ estGenereeParCloture: true, exerciceId: l.ecriture.exerciceId, NOT: { reference: 'IMPORT' } }]
                        : []),
                ],
            },
        };
        const somme = await this.prisma.ligneEcriture.aggregate({ where, _sum: { debit: true, credit: true } });
        const regle = sens < 0 ? Number(somme._sum.debit ?? 0) : Number(somme._sum.credit ?? 0);
        if (regle < 0.005)
            return { lignes: [], total: 0 };
        const contraire = sens < 0 ? { debit: { gt: 0 } } : { credit: { gt: 0 } };
        const whereContraire = { AND: [where, contraire] };
        const [lus, total] = await Promise.all([
            this.prisma.ligneEcriture.findMany({
                where: whereContraire,
                orderBy: [{ ecriture: { date: 'asc' } }, { id: 'asc' }],
                take: MOUVEMENTS_NOMMES,
                select: { debit: true, credit: true, ecriture: { select: { numeroPiece: true, date: true } } },
            }),
            this.prisma.ligneEcriture.count({ where: whereContraire }),
        ]);
        const lignes = lus.map((m) => ({
            piece: m.ecriture.numeroPiece,
            date: m.ecriture.date,
            montant: Math.abs(Number(m.debit) - Number(m.credit)),
        }));
        return { lignes, total };
    }
    async prolongeUneLigneDeclaree(tenantId, l) {
        if (l.ecriture.reference === 'IMPORT')
            return false;
        const precedent = await this.prisma.exercice.findFirst({
            where: { tenantId, dateFin: { lt: l.ecriture.exercice.dateDebut } },
            orderBy: { dateFin: 'desc' },
            select: { id: true },
        });
        if (!precedent)
            return false;
        const declarations = await this.prisma.declarationDeviseANouveau.findMany({
            where: { tenantId, exerciceId: precedent.id, compteId: l.compteId },
            select: { ligneOrigineId: true, lignesResultantes: true },
        });
        const ids = new Set();
        for (const d of declarations) {
            ids.add(d.ligneOrigineId);
            for (const id of Array.isArray(d.lignesResultantes) ? d.lignesResultantes : [])
                ids.add(id);
        }
        if (ids.size === 0)
            return false;
        const enFrancs = await this.prisma.ligneEcriture.findMany({
            where: { id: { in: [...ids] }, deviseId: null, ecriture: { tenantId } },
            select: {
                id: true,
                compteId: true,
                debit: true,
                credit: true,
                libelle: true,
                dateEcheance: true,
                ecriture: { select: { libelle: true } },
            },
        });
        const cle = (0, declaration_devise_a_nouveau_1.cleDeLigne)(versLigneDeReport(l));
        return enFrancs.some((d) => (0, declaration_devise_a_nouveau_1.cleDuReport)(versLigneDeReport(d), l.compte.numero) === cle);
    }
    async contexte(tenantId, l) {
        const horsMouvements = await this.ecrituresHorsMouvements(tenantId);
        const [declaree, exercice, reglements, prolonge] = await Promise.all([
            this.prisma.declarationDeviseANouveau.findFirst({ where: { tenantId, ligneOrigineId: l.id }, select: { id: true } }),
            this.contexteDeLExercice(tenantId, l.ecriture.exercice, l.ecriture.date),
            this.reglementsEnFrancs(tenantId, l, horsMouvements.ids),
            this.prolongeUneLigneDeclaree(tenantId, l),
        ]);
        return { dejaDeclaree: declaree !== null, ...exercice, reglementsEnFrancs: reglements, prolongeUneLigneDeclaree: prolonge };
    }
    async restantADeclarer(tenantId) {
        const devises = await this.prisma.devise.findMany({ where: { tenantId }, select: { id: true, code: true } });
        const etrangeres = devises.filter((d) => d.code.toUpperCase() !== monnaie_de_tenue_1.MONNAIE_DE_TENUE);
        if (etrangeres.length === 0) {
            return {
                sansDeviseEtrangere: true,
                lignes: [],
                total: 0,
                tronque: false,
                nonRetrouvees: [],
            };
        }
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
        if (!tenant)
            throw new common_1.NotFoundException('Dossier introuvable');
        const [exercices, declarations, horsMouvements] = await Promise.all([
            this.prisma.exercice.findMany({
                where: { tenantId },
                orderBy: { dateDebut: 'asc' },
                select: { id: true, statut: true, dateDebut: true, dateFin: true },
            }),
            this.prisma.declarationDeviseANouveau.findMany({
                where: { tenantId },
                select: { ligneOrigineId: true, lignesResultantes: true, ecritureCorrectionId: true },
            }),
            this.ecrituresHorsMouvements(tenantId),
        ]);
        const declarees = new Set();
        const corrections = new Set();
        for (const d of declarations) {
            declarees.add(d.ligneOrigineId);
            for (const id of Array.isArray(d.lignesResultantes) ? d.lignesResultantes : [])
                declarees.add(id);
            if (d.ecritureCorrectionId)
                corrections.add(d.ecritureCorrectionId);
        }
        const sortie = [];
        const nonRetrouvees = [];
        let total = 0;
        let lectureTronquee = horsMouvements.tronque;
        let enAttente = [];
        let precedent = null;
        for (const ex of exercices) {
            const lignes = await this.prisma.ligneEcriture.findMany({
                where: {
                    deviseId: null,
                    ecriture: {
                        tenantId,
                        exerciceId: ex.id,
                        estGenereeParCloture: true,
                        estANouveauProvisoire: false,
                        estSoldeDesComptesDeGestion: false,
                        ...(corrections.size > 0 ? { id: { notIn: [...corrections] } } : {}),
                    },
                    OR: [{ debit: { not: 0 } }, { credit: { not: 0 } }],
                },
                select: SELECT_LIGNE,
                orderBy: [{ compte: { numero: 'asc' } }, { id: 'asc' }],
                take: PLAFOND_LECTURE_PAR_EXERCICE,
            });
            if (lignes.length === PLAFOND_LECTURE_PAR_EXERCICE)
                lectureTronquee = true;
            const ouvertes = lignes.filter((l) => !declarees.has(l.id) && Math.abs(Number(l.debit) - Number(l.credit)) >= 0.005);
            const importees = ouvertes.filter((l) => l.ecriture.reference === 'IMPORT' && (0, perimetre_reevaluation_1.seReevalueALaCloture)(l.compte.numero, tenant.referentiel));
            let herites = [];
            if (enAttente.length > 0 && precedent?.statut === client_1.StatutExercice.CLOTURE) {
                const appariement = (0, declaration_devise_a_nouveau_1.apparierReports)(enAttente.map((o) => ({ ligne: o, cle: (0, declaration_devise_a_nouveau_1.cleDuReport)(versLigneDeReport(o), o.compte.numero) })), ouvertes
                    .filter((r) => r.ecriture.reference !== 'IMPORT')
                    .map((r) => ({ ligne: r, cle: (0, declaration_devise_a_nouveau_1.cleDeLigne)(versLigneDeReport(r)) })));
                herites = appariement.herites;
                for (const [o, motif] of [
                    ...appariement.nonRetrouvees.map((o) => [o, 'NON_RETROUVE']),
                    ...appariement.ambigues.map((o) => [o, 'AMBIGU']),
                ]) {
                    if (nonRetrouvees.length >= PLAFOND_LISTE) {
                        lectureTronquee = true;
                        break;
                    }
                    nonRetrouvees.push({
                        exercice: precedent.libelle,
                        exerciceSuivant: (0, libelle_exercice_1.libelleExercice)(ex),
                        compteNumero: o.compte.numero,
                        montant: Math.round((Number(o.debit) - Number(o.credit)) * 100) / 100,
                        motif,
                    });
                }
            }
            const candidates = [...importees, ...herites];
            enAttente = candidates.filter((l) => !l.lettre);
            precedent = { statut: ex.statut, libelle: (0, libelle_exercice_1.libelleExercice)(ex) };
            if (ex.statut === client_1.StatutExercice.CLOTURE || candidates.length === 0)
                continue;
            const contexteExercice = await this.contexteDeLExercice(tenantId, ex, candidates[0].ecriture.date);
            const reglementsLus = new Map();
            for (const l of candidates) {
                total++;
                if (sortie.length >= PLAFOND_LISTE)
                    continue;
                const cle = `${l.compteId}|${Math.sign(Number(l.debit) - Number(l.credit))}|${l.ecriture.reference === 'IMPORT'}`;
                let reglements = reglementsLus.get(cle);
                if (!reglements) {
                    reglements = await this.reglementsEnFrancs(tenantId, l, horsMouvements.ids);
                    reglementsLus.set(cle, reglements);
                }
                sortie.push({
                    ligneId: l.id,
                    exerciceId: ex.id,
                    exercice: (0, libelle_exercice_1.libelleExercice)(ex),
                    date: l.ecriture.date.toISOString().slice(0, 10),
                    piece: l.ecriture.numeroPiece,
                    origine: l.ecriture.reference === 'IMPORT' ? 'IMPORT' : 'REPORT',
                    statut: l.ecriture.statut,
                    compteNumero: l.compte.numero,
                    compteIntitule: l.compte.intitule,
                    montant: Math.round((Number(l.debit) - Number(l.credit)) * 100) / 100,
                    motifRefus: (0, declaration_devise_a_nouveau_1.motifRefusLigne)(versLigneADeclarer(l), tenant.referentiel, {
                        ...contexteExercice,
                        dejaDeclaree: false,
                        prolongeUneLigneDeclaree: false,
                        reglementsEnFrancs: reglements,
                    }),
                });
            }
        }
        return {
            sansDeviseEtrangere: false,
            lignes: sortie,
            total,
            tronque: lectureTronquee || total > sortie.length,
            nonRetrouvees,
        };
    }
    async declarer(tenantId, userId, entree) {
        return this.devises.sousVerrouDuDossier(tenantId, 'DÉCLARATION DE LA DEVISE D’UN À-NOUVEAU', () => this.declarerSousVerrou(tenantId, userId, entree));
    }
    async declarerSousVerrou(tenantId, userId, entree) {
        const source = (entree.source ?? '').trim();
        if (source.length < 3 || source.length > 500) {
            throw new common_1.BadRequestException('La source est exigée (3 à 500 caractères) · la pièce qui établit la devise et le montant en devise (facture, contrat, relevé).');
        }
        const ligne = await this.prisma.ligneEcriture.findFirst({
            where: { id: entree.ligneId, ecriture: { tenantId } },
            select: SELECT_LIGNE,
        });
        if (!ligne)
            throw new common_1.NotFoundException('Ligne introuvable');
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
        if (!tenant)
            throw new common_1.NotFoundException('Dossier introuvable');
        const lue = versLigneADeclarer(ligne);
        const refus = (0, declaration_devise_a_nouveau_1.motifRefusLigne)(lue, tenant.referentiel, await this.contexte(tenantId, ligne));
        if (refus)
            throw new common_1.ConflictException(refus);
        const montantLigne = Math.abs(lue.debit - lue.credit);
        const devises = await this.prisma.devise.findMany({ where: { tenantId }, select: { id: true, code: true } });
        const parts = entree.parts ?? [];
        const refusParts = (0, declaration_devise_a_nouveau_1.motifRefusParts)(parts, montantLigne, new Map(devises.map((d) => [d.id, d])));
        if (refusParts)
            throw new common_1.BadRequestException(refusParts);
        const exactes = (0, declaration_devise_a_nouveau_1.lignesExactes)(lue, parts);
        const detailParts = parts.map((p, i) => ({
            deviseId: p.deviseId,
            devise: devises.find((d) => d.id === p.deviseId)?.code ?? '',
            montantDevise: p.montantDevise,
            coursApplique: exactes[i].coursApplique,
            montant: exactes[i].montant,
        }));
        const resteEnFrancs = Math.round((montantLigne - detailParts.reduce((s, p) => s + p.montant, 0)) * 100) / 100;
        const base = {
            tenantId,
            exerciceId: ligne.ecriture.exerciceId,
            ecritureOrigineId: ligne.ecritureId,
            ligneOrigineId: ligne.id,
            compteId: ligne.compteId,
            montantLigne: Math.round(montantLigne * 100) / 100,
            parts: detailParts,
            resteEnFrancs,
            source,
            createdBy: userId,
        };
        if (parts.length === 0) {
            const d = await this.prisma.declarationDeviseANouveau.create({ data: { ...base, mode: 'EN_FRANCS' } });
            return { declaration: d, ecritureCorrectionId: null, messages: ['Ligne déclarée en francs · rien n’est changé.'] };
        }
        if (ligne.ecriture.statut === client_1.StatutEcriture.BROUILLARD) {
            return this.declarerAuBrouillard(tenantId, ligne, exactes, base);
        }
        return this.declarerParCorrection(tenantId, userId, ligne, exactes, base);
    }
    async declarerAuBrouillard(tenantId, ligne, exactes, base) {
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const encore = await tx.ecriture.count({
                where: { id: ligne.ecritureId, tenantId, statut: client_1.StatutEcriture.BROUILLARD },
            });
            if (encore !== 1) {
                throw new common_1.ConflictException("L'à-nouveau a été validé entre-temps · refaites la déclaration, elle s'inscrira en négatif.");
            }
            const [premiere, ...suivantes] = exactes;
            const montants = (m, sensDebit) => (sensDebit ? { debit: m, credit: 0 } : { debit: 0, credit: m });
            const { count } = await tx.ligneEcriture.updateMany({
                where: { id: ligne.id, deviseId: null, lettrageId: null, rapprochementId: null, debit: ligne.debit, credit: ligne.credit },
                data: {
                    ...montants(premiere.montant, premiere.sensDebit),
                    deviseId: premiere.deviseId,
                    montantDevise: premiere.montantDevise,
                    coursApplique: premiere.coursApplique,
                },
            });
            if (count !== 1)
                throw new common_1.ConflictException('La ligne a changé entre la lecture et la déclaration · relisez-la.');
            const creees = [];
            for (const p of suivantes) {
                const c = await tx.ligneEcriture.create({
                    data: {
                        ecritureId: ligne.ecritureId,
                        compteId: ligne.compteId,
                        libelle: ligne.libelle,
                        dateEcheance: ligne.dateEcheance,
                        ...montants(p.montant, p.sensDebit),
                        deviseId: p.deviseId,
                        montantDevise: p.montantDevise,
                        coursApplique: p.coursApplique,
                    },
                    select: { id: true },
                });
                creees.push(c.id);
            }
            const declaration = await tx.declarationDeviseANouveau.create({
                data: { ...base, mode: 'BROUILLARD', lignesResultantes: [ligne.id, ...creees] },
            });
            return {
                declaration,
                ecritureCorrectionId: null,
                messages: [`À-nouveau au brouillard complété en place · ${exactes.length} ligne(s) sur le compte ${ligne.compte.numero}.`],
            };
        });
    }
    async declarerParCorrection(tenantId, userId, ligne, exactes, base) {
        const debitOrigine = Number(ligne.debit);
        const creditOrigine = Number(ligne.credit);
        const lignesCorrection = [
            { compteId: ligne.compteId, debit: -debitOrigine, credit: -creditOrigine },
            ...exactes.map((p) => ({
                compteId: ligne.compteId,
                debit: p.sensDebit ? p.montant : 0,
                credit: p.sensDebit ? 0 : p.montant,
                deviseId: p.deviseId,
                montantDevise: p.montantDevise,
                coursApplique: p.coursApplique,
            })),
        ];
        const { journal, date, dateValeur } = await this.ecritureService.controlesDEntree(tenantId, {
            exerciceId: ligne.ecriture.exerciceId,
            journalId: ligne.ecriture.journalId,
            date: ligne.ecriture.date,
            lignes: lignesCorrection,
            reporterAuPremierJourOuvert: true,
            exigerVentilationObligatoire: false,
        });
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { doubleRegardValidation: true } });
        const doubleRegard = tenant?.doubleRegardValidation === true;
        const messages = [];
        const resultat = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const encore = await tx.ligneEcriture.count({
                where: { id: ligne.id, deviseId: null, lettrageId: null, rapprochementId: null, ecriture: { tenantId } },
            });
            if (encore !== 1)
                throw new common_1.ConflictException('La ligne a été lettrée ou pointée entre la lecture et la déclaration · relisez-la.');
            const numeroPiece = await (0, numerotation_piece_1.prochainNumeroPiece)(tx, tenantId, journal, ligne.ecriture.exerciceId, date);
            const ecriture = await tx.ecriture.create({
                data: {
                    tenantId,
                    exerciceId: ligne.ecriture.exerciceId,
                    journalId: ligne.ecriture.journalId,
                    numeroPiece,
                    date,
                    dateValeur,
                    libelle: `Devise déclarée · à-nouveau ${ligne.compte.numero}`.slice(0, 250),
                    reference: exports.REFERENCE_DECLARATION_DEVISE,
                    motifCorrection: `Devise de la ligne d'à-nouveau ${ligne.compte.numero} déclarée · ${String(base.source)}`.slice(0, 500) +
                        ' · AUDCIF art. 20, al. 2.',
                    createdBy: userId,
                    ...(doubleRegard
                        ? { statut: client_1.StatutEcriture.BROUILLARD }
                        : { statut: client_1.StatutEcriture.VALIDEE, valideeAt: new Date(), valideeBy: userId }),
                    lignes: { create: lignesCorrection.map((l) => ({ ...l, libelle: ligne.libelle, dateEcheance: ligne.dateEcheance })) },
                },
                select: { id: true, lignes: { select: { id: true, debit: true, credit: true, deviseId: true } } },
            });
            const negatif = ecriture.lignes.find((l) => Number(l.debit) === -debitOrigine && Number(l.credit) === -creditOrigine && !l.deviseId);
            const lettrable = await tx.compte.findFirst({ where: { id: ligne.compteId, tenantId, lettrable: true }, select: { id: true } });
            if (negatif && lettrable) {
                const figees = await (0, gel_cloture_1.lignesFigees)(tx, tenantId, [ligne.id, negatif.id]);
                if (figees.size === 0) {
                    const code = (await (0, lettrage_service_1.prochaineLettreDuCompte)(tx, tenantId, ligne.compteId))();
                    if (await (0, lettrage_service_1.poserGroupeSoldeDuModule)(tx, { tenantId, compteId: ligne.compteId, ligneIds: [ligne.id, negatif.id], userId, code })) {
                        messages.push(`Ligne d'origine lettrée (${code}) avec son inscription en négatif.`);
                    }
                }
                else {
                    messages.push("Ligne d'origine et inscription en négatif non lettrées · une clôture fige le premier jour.");
                }
            }
            const declaration = await tx.declarationDeviseANouveau.create({
                data: {
                    ...base,
                    mode: 'CORRECTION',
                    ecritureCorrectionId: ecriture.id,
                    lignesResultantes: ecriture.lignes.map((l) => l.id),
                },
            });
            return { declaration, ecritureCorrectionId: ecriture.id };
        });
        messages.unshift(`Pièce de correction passée · la ligne validée inscrite en négatif puis ses ${exactes.length} part(s) exacte(s) (AUDCIF art. 20, al. 2).`, ...(doubleRegard
            ? ['Double regard actif · la pièce de correction reste au brouillard, à valider par un autre utilisateur que vous.']
            : []));
        return { ...resultat, messages };
    }
};
exports.DeclarationDeviseANouveauService = DeclarationDeviseANouveauService;
exports.DeclarationDeviseANouveauService = DeclarationDeviseANouveauService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService,
        devises_service_1.DevisesService])
], DeclarationDeviseANouveauService);
//# sourceMappingURL=declaration-devise-a-nouveau.service.js.map