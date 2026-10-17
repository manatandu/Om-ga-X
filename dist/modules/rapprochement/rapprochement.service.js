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
exports.RapprochementService = exports.MOTIF_POINTAGE_SITUATION = exports.PLAFOND_LIGNES_RAPPROCHEMENT = void 0;
exports.estANouveauEcarte = estANouveauEcarte;
exports.filtreANouveauEcarte = filtreANouveauEcarte;
exports.estFondueDansLeDepart = estFondueDansLeDepart;
exports.estEcarteeDuPointage = estEcarteeDuPointage;
exports.filtreEcarteDuPointage = filtreEcarteDuPointage;
exports.motifRefusANouveau = motifRefusANouveau;
exports.motifRefusFondue = motifRefusFondue;
exports.motifRefusPointage = motifRefusPointage;
exports.ecartDOuverture = ecartDOuverture;
exports.aNouveauEnTrop = aNouveauEnTrop;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const client_1 = require("@prisma/client");
const lecture_fichier_1 = require("../import/lecture-fichier");
const releve_bancaire_1 = require("./releve-bancaire");
const prisma_retry_util_1 = require("../../common/prisma-retry.util");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const gel_cloture_1 = require("../exercice/gel-cloture");
const EPSILON = 0.005;
const JOUR_MS = 86_400_000;
const jour = (d) => d.toISOString().slice(0, 10);
exports.PLAFOND_LIGNES_RAPPROCHEMENT = 5000;
function estANouveauEcarte(ecriture) {
    return ecriture.estGenereeParCloture && !ecriture.estSoldeDesComptesDeGestion;
}
function filtreANouveauEcarte() {
    return { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false };
}
function estFondueDansLeDepart(ecriture, regle) {
    return regle.dateDepart !== null && ecriture.date.getTime() < regle.dateDepart.getTime();
}
function estEcarteeDuPointage(ecriture, regle) {
    return ecriture.statut === client_1.StatutEcriture.SITUATION || estANouveauEcarte(ecriture) || estFondueDansLeDepart(ecriture, regle);
}
function filtreEcarteDuPointage(regle) {
    const situation = { statut: client_1.StatutEcriture.SITUATION };
    return regle.dateDepart === null
        ? { OR: [filtreANouveauEcarte(), situation] }
        : { OR: [filtreANouveauEcarte(), situation, { date: { lt: regle.dateDepart } }] };
}
exports.MOTIF_POINTAGE_SITUATION = "Une écriture de situation n'est pas une opération de la banque · elle n'enregistre aucune opération et n'est pas au " +
    'livre-journal (AUDCIF art. 19 ; art. 22, 1°). Pointez la pièce réelle.';
function motifRefusANouveau(regle) {
    return regle.ancre
        ? "Un report à-nouveau n'est pas une opération de la banque · le solde de départ, repris du rapprochement précédent, le contient déjà, et le pointer compterait l'ouverture deux fois."
        : "Un report à-nouveau n'est pas une opération de la banque · le premier rapprochement part du solde de départ lu sur le relevé, et le pointer compterait l'ouverture deux fois. Ce que la banque n'avait pas encore passé à la date de départ se déclare en en-cours d'ouverture.";
}
function motifRefusFondue(date, dateDepart) {
    return (`La ligne du ${jour(date)} précède la date de départ du ${jour(dateDepart)} · elle est fondue dans le solde de départ, ` +
        "et la pointer compterait l'ouverture deux fois. Si la banque ne l'avait pas encore passée ce jour-là, déclarez-la en en-cours d'ouverture.");
}
function motifRefusPointage(ecriture, regle) {
    if (ecriture.statut === client_1.StatutEcriture.SITUATION)
        return exports.MOTIF_POINTAGE_SITUATION;
    if (estANouveauEcarte(ecriture))
        return motifRefusANouveau(regle);
    if (regle.dateDepart !== null && estFondueDansLeDepart(ecriture, regle))
        return motifRefusFondue(ecriture.date, regle.dateDepart);
    return null;
}
function ecartDOuverture(soldeLivre, soldeDepart, encours) {
    return (0, releve_bancaire_1.arrondi)(soldeLivre - (soldeDepart + encours));
}
function aNouveauEnTrop(ecriture, place) {
    if (!estANouveauEcarte(ecriture))
        return false;
    if (place.ancre || place.departDeclare)
        return true;
    return ecriture.exerciceId !== place.premierExerciceId;
}
let RapprochementService = class RapprochementService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async trouverCompteTresorerie(tenantId, compteId) {
        const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId } });
        if (!compte) {
            throw new common_1.NotFoundException('Compte introuvable pour ce tenant');
        }
        if (compte.classe !== client_1.ClasseCompte.CLASSE_5) {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} n'est pas un compte de trésorerie (classe 5) · le rapprochement bancaire ne porte que sur ces comptes`);
        }
        if (compte.typeCompte === client_1.TypeCompteDetailTotal.TOTAL) {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} est un compte Total (regroupement) · il ne reçoit jamais d'écriture directement, le rapprochement bancaire ne porte que sur un compte Détail`);
        }
        return compte;
    }
    async depart(tenantId, r) {
        const dernier = await this.prisma.rapprochementBancaire.findFirst({
            where: { tenantId, compteId: r.compteId, statut: client_1.StatutRapprochement.CLOTURE, clotureAt: { lt: r.clotureAt ?? new Date() } },
            orderBy: { clotureAt: 'desc' },
        });
        if (!dernier) {
            return {
                soldeDepart: r.soldeDepartDeclare == null ? null : Number(r.soldeDepartDeclare),
                regle: { ancre: false, dateDepart: r.dateDepart ?? null },
                premier: true,
            };
        }
        const tete = await this.prisma.rapprochementBancaire.findFirst({
            where: { tenantId, compteId: r.compteId, statut: client_1.StatutRapprochement.CLOTURE },
            orderBy: { clotureAt: 'asc' },
            select: { dateDepart: true },
        });
        return {
            soldeDepart: Number(dernier.soldeReleve),
            regle: { ancre: true, dateDepart: tete?.dateDepart ?? null },
            premier: false,
        };
    }
    async ouverture(tenantId, r) {
        const declares = await this.prisma.encoursOuvertureRapprochement.findMany({
            where: { tenantId, declareSurId: r.id },
            select: { debit: true, credit: true },
        });
        const encours = (0, releve_bancaire_1.arrondi)(declares.reduce((acc, e) => acc + Number(e.debit) - Number(e.credit), 0));
        const soldeDepart = r.soldeDepartDeclare == null ? null : Number(r.soldeDepartDeclare);
        const dateDepart = r.dateDepart ?? null;
        const base = { soldeDepart, dateDepart, encours };
        if (soldeDepart === null || dateDepart === null) {
            return { ...base, soldeLivre: null, ecart: null, motif: 'Solde de départ non déclaré.' };
        }
        const veille = new Date(dateDepart.getTime() - JOUR_MS);
        const exercice = (await this.prisma.exercice.findFirst({ where: { tenantId, dateDebut: { lte: veille }, dateFin: { gte: veille } } })) ??
            (await this.prisma.exercice.findFirst({ where: { tenantId, dateDebut: { lte: dateDepart }, dateFin: { gte: dateDepart } } }));
        if (!exercice) {
            return { ...base, soldeLivre: null, ecart: null, motif: `Aucun exercice du dossier ne couvre le ${jour(dateDepart)}.` };
        }
        const livre = await this.prisma.ligneEcriture.aggregate({
            where: {
                compteId: r.compteId,
                ecriture: {
                    tenantId,
                    exerciceId: exercice.id,
                    statut: client_1.StatutEcriture.VALIDEE,
                    estSoldeDesComptesDeGestion: false,
                    OR: [{ date: { lt: dateDepart } }, { estGenereeParCloture: true }],
                },
            },
            _sum: { debit: true, credit: true },
        });
        const soldeLivre = (0, releve_bancaire_1.arrondi)(Number(livre._sum.debit ?? 0) - Number(livre._sum.credit ?? 0));
        return { ...base, soldeLivre, ecart: ecartDOuverture(soldeLivre, soldeDepart, encours), motif: null };
    }
    async trouverRapprochement(tenantId, id) {
        const r = await this.prisma.rapprochementBancaire.findFirst({ where: { id, tenantId } });
        if (!r) {
            throw new common_1.NotFoundException('Rapprochement introuvable pour ce tenant');
        }
        return r;
    }
    async lister(tenantId, compteId) {
        return this.prisma.rapprochementBancaire.findMany({
            where: { tenantId, ...(compteId ? { compteId } : {}) },
            include: { compte: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async ouvrir(tenantId, userId, dto) {
        await this.trouverCompteTresorerie(tenantId, dto.compteId);
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const enCours = await tx.rapprochementBancaire.findFirst({
                where: { tenantId, compteId: dto.compteId, statut: client_1.StatutRapprochement.EN_COURS },
            });
            if (enCours) {
                throw new common_1.ConflictException(`Un rapprochement est déjà en cours sur ce compte (ouvert le ${enCours.createdAt.toISOString().slice(0, 10)}, id ${enCours.id}) · clôturez-le ou annulez-le avant d'en ouvrir un nouveau`);
            }
            return tx.rapprochementBancaire.create({
                data: {
                    tenantId,
                    compteId: dto.compteId,
                    dateReleve: new Date(dto.dateReleve),
                    soldeReleve: dto.soldeReleve,
                    createdBy: userId,
                },
            });
        }, 'Trop d\'ouvertures de rapprochement simultanées sur ce compte · veuillez réessayer.');
    }
    async obtenir(tenantId, id) {
        const rapprochement = await this.trouverRapprochement(tenantId, id);
        const { soldeDepart, regle, premier } = await this.depart(tenantId, rapprochement);
        const ecartees = filtreEcarteDuPointage(regle);
        const whereLignes = {
            compteId: rapprochement.compteId,
            ecriture: { tenantId },
            OR: [{ rapprochementId: id }, { rapprochementId: null, NOT: { ecriture: ecartees } }],
        };
        const [lignes, total, pointe, aNouveauEcartes, fonduesDansLeDepart, encours] = await Promise.all([
            this.prisma.ligneEcriture.findMany({
                where: whereLignes,
                include: { ecriture: { include: { journal: true } } },
                orderBy: [{ ecriture: { date: 'asc' } }, { id: 'asc' }],
                take: exports.PLAFOND_LIGNES_RAPPROCHEMENT,
            }),
            this.prisma.ligneEcriture.count({ where: whereLignes }),
            this.prisma.ligneEcriture.aggregate({
                where: { compteId: rapprochement.compteId, ecriture: { tenantId }, rapprochementId: id },
                _sum: { debit: true, credit: true },
            }),
            this.prisma.ligneEcriture.count({
                where: { compteId: rapprochement.compteId, rapprochementId: null, ecriture: { tenantId, ...filtreANouveauEcarte() } },
            }),
            regle.dateDepart === null
                ? Promise.resolve(0)
                : this.prisma.ligneEcriture.count({
                    where: {
                        compteId: rapprochement.compteId,
                        rapprochementId: null,
                        ecriture: { tenantId, date: { lt: regle.dateDepart }, NOT: filtreANouveauEcarte(), ...ecritures_de_situation_1.HORS_SITUATION },
                    },
                }),
            this.prisma.encoursOuvertureRapprochement.findMany({
                where: { tenantId, declareSur: { compteId: rapprochement.compteId }, OR: [{ pointeSurId: id }, { pointeSurId: null }] },
                orderBy: [{ date: 'asc' }, { id: 'asc' }],
            }),
        ]);
        const encoursPointes = encours
            .filter((e) => e.pointeSurId === id)
            .reduce((acc, e) => acc + Number(e.debit) - Number(e.credit), 0);
        const soldePointe = soldeDepart === null
            ? null
            : (0, releve_bancaire_1.arrondi)(soldeDepart + Number(pointe._sum.debit ?? 0) - Number(pointe._sum.credit ?? 0) + encoursPointes);
        const ecart = soldePointe === null ? null : (0, releve_bancaire_1.arrondi)(soldePointe - Number(rapprochement.soldeReleve));
        const releve = await this.prisma.ligneReleveBancaire.findMany({
            where: { tenantId, rapprochementId: id },
            orderBy: { rang: 'asc' },
        });
        const correspondances = releve.length === 0
            ? []
            : await this.prisma.ligneEcriture.findMany({
                where: { ecriture: { tenantId }, ligneReleveId: { in: releve.map((r) => r.id) } },
                select: { id: true, ligneReleveId: true },
            });
        const ecartReleve = releve.length === 0 || soldeDepart === null
            ? null
            : (0, releve_bancaire_1.arrondi)(soldeDepart +
                releve.reduce((acc, r) => acc + Number(r.credit) - Number(r.debit), 0) -
                Number(rapprochement.soldeReleve));
        return {
            rapprochement,
            premier,
            soldeDepart,
            soldePointe,
            ecart,
            equilibre: ecart !== null && Math.abs(ecart) < EPSILON,
            ecartReleve,
            ouverture: premier ? await this.ouverture(tenantId, rapprochement) : null,
            releve: releve.map((r) => ({
                id: r.id,
                rang: r.rang,
                date: r.date,
                libelle: r.libelle,
                reference: r.reference,
                debit: Number(r.debit),
                credit: Number(r.credit),
                ligneEcritureIds: correspondances.filter((l) => l.ligneReleveId === r.id).map((l) => l.id),
                encoursIds: encours.filter((e) => e.ligneReleveId === r.id).map((e) => e.id),
            })),
            tronque: total > lignes.length,
            totalLignes: total,
            aNouveauEcartes,
            fonduesDansLeDepart,
            lignes: lignes.map((l) => ({
                id: l.id,
                date: l.ecriture.date,
                journalCode: l.ecriture.journal.code,
                libelle: l.libelle ?? l.ecriture.libelle,
                reference: l.ecriture.reference,
                debit: Number(l.debit),
                credit: Number(l.credit),
                pointee: l.rapprochementId === id,
                ligneReleveId: l.ligneReleveId,
            })),
            encours: encours.map((e) => ({
                id: e.id,
                date: e.date,
                libelle: e.libelle,
                debit: Number(e.debit),
                credit: Number(e.credit),
                pointee: e.pointeSurId === id,
                ligneReleveId: e.ligneReleveId,
                declareIci: e.declareSurId === id,
            })),
        };
    }
    async assurerEnCours(tenantId, id) {
        const rapprochement = await this.trouverRapprochement(tenantId, id);
        if (rapprochement.statut !== client_1.StatutRapprochement.EN_COURS) {
            throw new common_1.BadRequestException('Ce rapprochement est déjà clôturé · plus aucun pointage possible');
        }
        return rapprochement;
    }
    async pointer(tenantId, id, ligneIds) {
        const rapprochement = await this.assurerEnCours(tenantId, id);
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: { id: { in: ligneIds } },
            include: { ecriture: true },
        });
        if (lignes.length !== ligneIds.length) {
            throw new common_1.NotFoundException('Une ou plusieurs lignes sont introuvables');
        }
        for (const l of lignes) {
            if (l.compteId !== rapprochement.compteId || l.ecriture.tenantId !== tenantId) {
                throw new common_1.BadRequestException('Toutes les lignes doivent appartenir au compte rapproché et au tenant indiqué');
            }
            if (l.rapprochementId && l.rapprochementId !== id) {
                throw new common_1.BadRequestException('Une des lignes est déjà pointée sur un autre rapprochement');
            }
        }
        const libres = lignes.filter((l) => l.rapprochementId !== id);
        if (libres.length > 0) {
            const { regle } = await this.depart(tenantId, rapprochement);
            for (const l of libres) {
                const motif = motifRefusPointage(l.ecriture, regle);
                if (motif)
                    throw new common_1.BadRequestException(motif);
            }
        }
        await this.prisma.ligneEcriture.updateMany({ where: { id: { in: ligneIds } }, data: { rapprochementId: id } });
        return { nombreLignes: ligneIds.length };
    }
    async depointer(tenantId, id, ligneIds) {
        await this.assurerEnCours(tenantId, id);
        const resultat = await this.prisma.ligneEcriture.updateMany({
            where: { id: { in: ligneIds }, rapprochementId: id, ecriture: { tenantId } },
            data: { rapprochementId: null, ligneReleveId: null },
        });
        return { nombreLignes: resultat.count };
    }
    async assurerPremierEnCours(tenantId, id) {
        const r = await this.assurerEnCours(tenantId, id);
        const { premier } = await this.depart(tenantId, r);
        if (!premier) {
            throw new common_1.BadRequestException("Un rapprochement clos précède celui-ci sur ce compte · son solde de relevé sert de départ, et l'ouverture ne se déclare que sur le premier rapprochement du compte.");
        }
        return r;
    }
    async declarerDepart(tenantId, id, dto) {
        const r = await this.assurerPremierEnCours(tenantId, id);
        const dateDepart = new Date(dto.dateDepart);
        if (dateDepart.getTime() > r.dateReleve.getTime()) {
            throw new common_1.BadRequestException(`La date de départ (${jour(dateDepart)}) est postérieure à la date du relevé (${jour(r.dateReleve)}) · le relevé couvre la période qui suit le départ.`);
        }
        const [anterieuresPointees, encoursTardifs] = await Promise.all([
            this.prisma.ligneEcriture.count({
                where: { compteId: r.compteId, rapprochementId: id, ecriture: { tenantId, date: { lt: dateDepart } } },
            }),
            this.prisma.encoursOuvertureRapprochement.count({ where: { tenantId, declareSurId: id, date: { gte: dateDepart } } }),
        ]);
        if (anterieuresPointees > 0) {
            throw new common_1.BadRequestException(`${anterieuresPointees} ligne(s) pointée(s) sur ce rapprochement précèdent le ${jour(dateDepart)} · elles seraient fondues dans le solde de départ et comptées deux fois. Dépointez-les, et déclarez en en-cours d'ouverture celles que la banque n'avait pas encore passées.`);
        }
        if (encoursTardifs > 0) {
            throw new common_1.BadRequestException(`${encoursTardifs} en-cours d'ouverture ne précède(nt) pas le ${jour(dateDepart)} · un en-cours est une opération du livre antérieure au départ. Retirez-le ou choisissez une date de départ plus tardive.`);
        }
        return this.prisma.rapprochementBancaire.update({
            where: { id: r.id },
            data: { soldeDepartDeclare: dto.soldeDepart, dateDepart },
        });
    }
    async declarerEncours(tenantId, userId, id, dto) {
        const r = await this.assurerPremierEnCours(tenantId, id);
        if (!r.dateDepart) {
            throw new common_1.BadRequestException("Déclarez d'abord le solde de départ et sa date · un en-cours se situe avant elle.");
        }
        const date = new Date(dto.date);
        if (date.getTime() >= r.dateDepart.getTime()) {
            throw new common_1.BadRequestException(`L'en-cours du ${jour(date)} ne précède pas la date de départ du ${jour(r.dateDepart)} · une opération postérieure se pointe comme une écriture du compte.`);
        }
        const libelle = dto.libelle.trim();
        if (!libelle)
            throw new common_1.BadRequestException("Le libellé de l'en-cours est obligatoire.");
        if (!(dto.montant > 0))
            throw new common_1.BadRequestException("Le montant de l'en-cours doit être positif · le sens dit s'il entre ou sort.");
        return this.prisma.encoursOuvertureRapprochement.create({
            data: {
                tenantId,
                declareSurId: id,
                libelle,
                date,
                debit: dto.sens === 'DEBIT' ? dto.montant : 0,
                credit: dto.sens === 'CREDIT' ? dto.montant : 0,
                createdBy: userId,
            },
        });
    }
    async retirerEncours(tenantId, id, encoursId) {
        await this.assurerEnCours(tenantId, id);
        const e = await this.prisma.encoursOuvertureRapprochement.findFirst({ where: { id: encoursId, tenantId, declareSurId: id } });
        if (!e)
            throw new common_1.NotFoundException("En-cours d'ouverture introuvable sur ce rapprochement.");
        if (e.pointeSurId)
            throw new common_1.BadRequestException("Cet en-cours est pointé · dépointez-le avant de le retirer.");
        await this.prisma.encoursOuvertureRapprochement.delete({ where: { id: e.id } });
        return { supprime: true };
    }
    async pointerEncours(tenantId, id, encoursIds) {
        const r = await this.assurerEnCours(tenantId, id);
        const encours = await this.prisma.encoursOuvertureRapprochement.findMany({
            where: { id: { in: encoursIds }, tenantId, declareSur: { compteId: r.compteId } },
        });
        if (encours.length !== encoursIds.length) {
            throw new common_1.NotFoundException("Un en-cours d'ouverture est introuvable sur ce compte.");
        }
        if (encours.some((e) => e.pointeSurId && e.pointeSurId !== id)) {
            throw new common_1.BadRequestException("Un des en-cours est déjà pointé sur un autre rapprochement.");
        }
        await this.prisma.encoursOuvertureRapprochement.updateMany({
            where: { id: { in: encoursIds }, tenantId, pointeSurId: null },
            data: { pointeSurId: id },
        });
        return { nombreEncours: encoursIds.length };
    }
    async depointerEncours(tenantId, id, encoursIds) {
        await this.assurerEnCours(tenantId, id);
        const r = await this.prisma.encoursOuvertureRapprochement.updateMany({
            where: { id: { in: encoursIds }, tenantId, pointeSurId: id },
            data: { pointeSurId: null, ligneReleveId: null },
        });
        return { nombreEncours: r.count };
    }
    async cloturer(tenantId, id) {
        const rapprochement = await this.assurerEnCours(tenantId, id);
        const { ecart, equilibre, premier, ouverture } = await this.obtenir(tenantId, id);
        if (premier && ouverture) {
            if (ouverture.soldeDepart === null || ouverture.dateDepart === null) {
                throw new common_1.BadRequestException("Premier rapprochement de ce compte · déclarez le solde de départ lu sur le relevé et sa date avant de clôturer. Il ne se déduit pas de l'à-nouveau, qui est un solde comptable.");
            }
            if (ouverture.ecart === null) {
                throw new common_1.BadRequestException(`L'écart d'ouverture ne se calcule pas · ${ouverture.motif ?? ''}`.trim());
            }
            if (Math.abs(ouverture.ecart) >= EPSILON) {
                throw new common_1.BadRequestException(`L'écart d'ouverture n'est pas nul (${ouverture.ecart.toFixed(2)}) · le solde du compte au livre-journal à la veille du ${jour(ouverture.dateDepart)} ` +
                    `(${(ouverture.soldeLivre ?? 0).toFixed(2)}) doit valoir le solde de départ déclaré (${ouverture.soldeDepart.toFixed(2)}) plus les en-cours d'ouverture (${ouverture.encours.toFixed(2)}).`);
            }
        }
        if (!equilibre || ecart === null) {
            throw new common_1.BadRequestException(`L'écart n'est pas nul (${(ecart ?? 0).toFixed(2)}) · pointez ou dépointez des lignes jusqu'à ce que le solde pointé corresponde exactement au solde du relevé avant de clôturer`);
        }
        return this.prisma.rapprochementBancaire.update({
            where: { id: rapprochement.id },
            data: { statut: client_1.StatutRapprochement.CLOTURE, clotureAt: new Date() },
        });
    }
    async annuler(tenantId, id) {
        const rapprochement = await this.assurerEnCours(tenantId, id);
        if (rapprochement.rouvertAt) {
            throw new common_1.BadRequestException("Ce rapprochement a été clos puis rouvert · il ne s'annule pas, il se reclôt une fois corrigé.");
        }
        await this.prisma.ligneEcriture.updateMany({
            where: { rapprochementId: rapprochement.id },
            data: { rapprochementId: null, ligneReleveId: null },
        });
        await this.prisma.encoursOuvertureRapprochement.updateMany({
            where: { tenantId, pointeSurId: rapprochement.id },
            data: { pointeSurId: null, ligneReleveId: null },
        });
        try {
            await this.prisma.rapprochementBancaire.delete({ where: { id: rapprochement.id } });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                throw new common_1.NotFoundException('Ce rapprochement a déjà été annulé');
            }
            throw err;
        }
        return { supprime: true };
    }
    async rouvrir(tenantId, userId, id, motif) {
        const m = (motif ?? '').trim();
        if (!m)
            throw new common_1.BadRequestException('Le motif de la réouverture est obligatoire · il reste sur le rapprochement.');
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const r = await tx.rapprochementBancaire.findFirst({ where: { id, tenantId } });
            if (!r)
                throw new common_1.NotFoundException('Rapprochement introuvable pour ce tenant');
            if (r.statut !== client_1.StatutRapprochement.CLOTURE) {
                throw new common_1.BadRequestException('Seul un rapprochement clos se rouvre.');
            }
            const suivant = await tx.rapprochementBancaire.findFirst({
                where: {
                    tenantId,
                    compteId: r.compteId,
                    statut: client_1.StatutRapprochement.CLOTURE,
                    clotureAt: { gt: r.clotureAt ?? new Date(0) },
                },
            });
            if (suivant) {
                throw new common_1.BadRequestException(`Seul le dernier rapprochement clos du compte se rouvre · celui du relevé du ${jour(suivant.dateReleve)} le suit, et part de son solde de relevé. Rouvrez d'abord le plus récent.`);
            }
            const enCours = await tx.rapprochementBancaire.findFirst({
                where: { tenantId, compteId: r.compteId, statut: client_1.StatutRapprochement.EN_COURS },
            });
            if (enCours) {
                throw new common_1.ConflictException("Un rapprochement est en cours sur ce compte · il part du solde de celui-ci. Annulez-le ou clôturez-le avant de rouvrir.");
            }
            const gel = await this.motifGel(tx, tenantId, r);
            if (gel)
                throw new common_1.BadRequestException(`Réouverture impossible : ${gel}.`);
            return tx.rapprochementBancaire.update({
                where: { id: r.id },
                data: { statut: client_1.StatutRapprochement.EN_COURS, clotureAt: null, rouvertAt: new Date(), rouvertBy: userId, motifReouverture: m },
            });
        }, 'Trop de réouvertures simultanées sur ce compte · veuillez réessayer.');
    }
    async motifGel(tx, tenantId, r) {
        const [exercice, clotures, journaux] = await Promise.all([
            tx.exercice.findFirst({ where: { tenantId, dateDebut: { lte: r.dateReleve }, dateFin: { gte: r.dateReleve } } }),
            tx.cloture.findMany({
                where: { tenantId, annuleeAt: null, granularite: { not: client_1.GranulariteCloture.PARTIELLE } },
                select: { granularite: true, journalId: true, dateLimite: true },
            }),
            tx.journal.findMany({ where: { tenantId, compteTresorerieId: r.compteId }, select: { id: true, code: true } }),
        ]);
        if (exercice?.statut === client_1.StatutExercice.CLOTURE) {
            return (0, gel_cloture_1.motifLigneFigee)({ journalId: '', date: r.dateReleve, exerciceClos: true }, []);
        }
        for (const j of [{ id: '', code: '' }, ...journaux]) {
            const motif = (0, gel_cloture_1.motifLigneFigee)({ journalId: j.id, journalCode: j.code || undefined, date: r.dateReleve, exerciceClos: false }, clotures);
            if (motif)
                return motif;
        }
        return null;
    }
    async correspondancesDuReleve(tenantId, id) {
        const [lignes, encours] = await Promise.all([
            this.prisma.ligneEcriture.count({ where: { ecriture: { tenantId }, ligneReleve: { rapprochementId: id, tenantId } } }),
            this.prisma.encoursOuvertureRapprochement.count({ where: { tenantId, ligneReleve: { rapprochementId: id, tenantId } } }),
        ]);
        return lignes + encours;
    }
    async importerReleve(tenantId, id, dto) {
        const rapprochement = await this.assurerEnCours(tenantId, id);
        const tableau = await (0, lecture_fichier_1.lireFichier)(dto.nomFichier, dto.contenuBase64);
        const index = (0, releve_bancaire_1.reconnaitreColonnes)(tableau.colonnes, (dto.colonnes ?? {}));
        const { lignes, anomalies } = (0, releve_bancaire_1.lireReleve)(tableau, index);
        const fin = rapprochement.dateReleve.getTime();
        lignes.forEach((l) => {
            if (l.date.getTime() > fin) {
                anomalies.push(`Opération du ${l.date.toISOString().slice(0, 10)} (« ${l.libelle} ») postérieure à la date du relevé · elle appartient au relevé suivant.`);
            }
        });
        if (anomalies.length > 0) {
            const reste = anomalies.length > 10 ? ` Et ${anomalies.length - 10} autre(s).` : '';
            throw new common_1.BadRequestException(`Relevé non importé · ${anomalies.slice(0, 10).join(' ')}${reste} Colonnes du fichier : ${tableau.colonnes.join(', ')}.`);
        }
        if (lignes.length === 0) {
            throw new common_1.BadRequestException('Le relevé ne contient aucune opération.');
        }
        if ((await this.correspondancesDuReleve(tenantId, id)) > 0) {
            throw new common_1.ConflictException('Des lignes du relevé actuel sont déjà rapprochées · dissociez-les avant de réimporter le relevé.');
        }
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.ligneReleveBancaire.deleteMany({ where: { tenantId, rapprochementId: id } });
            await tx.ligneReleveBancaire.createMany({
                data: lignes.map((l) => ({
                    tenantId,
                    rapprochementId: id,
                    rang: l.rang,
                    date: l.date,
                    libelle: l.libelle,
                    reference: l.reference,
                    debit: l.debit,
                    credit: l.credit,
                })),
            });
        });
        return { nombreLignes: lignes.length };
    }
    async retirerReleve(tenantId, id) {
        await this.assurerEnCours(tenantId, id);
        if ((await this.correspondancesDuReleve(tenantId, id)) > 0) {
            throw new common_1.ConflictException('Des lignes du relevé sont rapprochées · dissociez-les avant de retirer le relevé.');
        }
        const r = await this.prisma.ligneReleveBancaire.deleteMany({ where: { tenantId, rapprochementId: id } });
        return { nombreLignes: r.count };
    }
    async proposer(tenantId, id, fenetreJours = releve_bancaire_1.FENETRE_JOURS_DEFAUT) {
        const rapprochement = await this.assurerEnCours(tenantId, id);
        const releve = await this.prisma.ligneReleveBancaire.findMany({
            where: { tenantId, rapprochementId: id, lignesEcriture: { none: {} }, encoursOuverture: { none: {} } },
            orderBy: { rang: 'asc' },
        });
        const instants = releve.map((r) => r.date.getTime());
        const regle = releve.length === 0 ? null : (await this.depart(tenantId, rapprochement)).regle;
        const fenetre = regle === null
            ? null
            : {
                gte: new Date(instants.reduce((a, b) => Math.min(a, b)) - fenetreJours * JOUR_MS),
                lte: new Date(instants.reduce((a, b) => Math.max(a, b)) + fenetreJours * JOUR_MS),
            };
        const [compte, encours] = regle === null || fenetre === null
            ? [[], []]
            : await Promise.all([
                this.prisma.ligneEcriture.findMany({
                    where: {
                        compteId: rapprochement.compteId,
                        ecriture: {
                            tenantId,
                            NOT: filtreEcarteDuPointage(regle),
                            date: fenetre,
                        },
                        rapprochementId: null,
                        ligneReleveId: null,
                    },
                    include: { ecriture: { select: { date: true, reference: true } } },
                }),
                this.prisma.encoursOuvertureRapprochement.findMany({
                    where: {
                        tenantId,
                        declareSur: { compteId: rapprochement.compteId },
                        pointeSurId: null,
                        ligneReleveId: null,
                        date: fenetre,
                    },
                }),
            ]);
        const idsEncours = new Set(encours.map((e) => e.id));
        const propositions = (0, releve_bancaire_1.proposerCorrespondances)(releve.map((r) => ({
            id: r.id,
            rang: r.rang,
            date: r.date,
            libelle: r.libelle,
            reference: r.reference,
            debit: Number(r.debit),
            credit: Number(r.credit),
        })), [
            ...compte.map((l) => ({
                id: l.id,
                date: l.ecriture.date,
                reference: l.ecriture.reference,
                debit: Number(l.debit),
                credit: Number(l.credit),
            })),
            ...encours.map((e) => ({ id: e.id, date: e.date, reference: null, debit: Number(e.debit), credit: Number(e.credit) })),
        ], fenetreJours).map((p) => ({
            ...p,
            ligneEcritureIds: p.ligneEcritureIds.filter((x) => !idsEncours.has(x)),
            encoursIds: p.ligneEcritureIds.filter((x) => idsEncours.has(x)),
        }));
        return {
            fenetreJours,
            propositions,
            lignesReleveSansProposition: releve.length - propositions.length,
        };
    }
    async confirmer(tenantId, id, dto) {
        const rapprochement = await this.assurerEnCours(tenantId, id);
        const idsReleve = dto.correspondances.map((c) => c.ligneReleveId);
        const idsCompte = dto.correspondances.flatMap((c) => c.ligneEcritureIds ?? []);
        const idsEncours = dto.correspondances.flatMap((c) => c.encoursIds ?? []);
        if (dto.correspondances.some((c) => (c.ligneEcritureIds ?? []).length + (c.encoursIds ?? []).length === 0)) {
            throw new common_1.BadRequestException('Une correspondance réunit au moins une ligne du compte ou un en-cours d’ouverture.');
        }
        if (new Set(idsReleve).size !== idsReleve.length ||
            new Set(idsCompte).size !== idsCompte.length ||
            new Set(idsEncours).size !== idsEncours.length) {
            throw new common_1.BadRequestException('Une même ligne figure dans deux correspondances.');
        }
        const releve = await this.prisma.ligneReleveBancaire.findMany({
            where: { tenantId, rapprochementId: id, id: { in: idsReleve } },
            include: { lignesEcriture: { select: { id: true } }, encoursOuverture: { select: { id: true } } },
        });
        if (releve.length !== idsReleve.length) {
            throw new common_1.NotFoundException('Une ligne du relevé est introuvable dans ce rapprochement.');
        }
        const compte = idsCompte.length === 0
            ? []
            : await this.prisma.ligneEcriture.findMany({
                where: { id: { in: idsCompte }, ecriture: { tenantId } },
                include: {
                    ecriture: { select: { estGenereeParCloture: true, estSoldeDesComptesDeGestion: true, exerciceId: true, date: true, statut: true } },
                },
            });
        if (compte.length !== idsCompte.length) {
            throw new common_1.NotFoundException('Une ligne d\'écriture est introuvable.');
        }
        const encours = idsEncours.length === 0
            ? []
            : await this.prisma.encoursOuvertureRapprochement.findMany({
                where: { id: { in: idsEncours }, tenantId, declareSur: { compteId: rapprochement.compteId } },
            });
        if (encours.length !== idsEncours.length) {
            throw new common_1.NotFoundException("Un en-cours d'ouverture est introuvable sur ce compte.");
        }
        const libres = compte.filter((l) => l.rapprochementId !== id);
        if (libres.length > 0) {
            const { regle } = await this.depart(tenantId, rapprochement);
            for (const l of libres) {
                const motif = motifRefusPointage(l.ecriture, regle);
                if (motif)
                    throw new common_1.BadRequestException(motif);
            }
        }
        for (const c of dto.correspondances) {
            const r = releve.find((x) => x.id === c.ligneReleveId);
            if (r.lignesEcriture.length > 0 || (r.encoursOuverture ?? []).length > 0) {
                throw new common_1.BadRequestException(`La ligne du relevé « ${r.libelle} » est déjà rapprochée.`);
            }
            const lignes = compte.filter((l) => (c.ligneEcritureIds ?? []).includes(l.id));
            for (const l of lignes) {
                if (l.compteId !== rapprochement.compteId) {
                    throw new common_1.BadRequestException('Toutes les lignes doivent appartenir au compte rapproché.');
                }
                if ((l.rapprochementId && l.rapprochementId !== id) || l.ligneReleveId) {
                    throw new common_1.BadRequestException('Une des lignes est déjà pointée ou rapprochée.');
                }
            }
            const enc = encours.filter((e) => (c.encoursIds ?? []).includes(e.id));
            if (enc.some((e) => (e.pointeSurId && e.pointeSurId !== id) || e.ligneReleveId)) {
                throw new common_1.BadRequestException("Un des en-cours d'ouverture est déjà pointé ou rapproché.");
            }
            const attendu = (0, releve_bancaire_1.montantVuDuCompte)({ debit: Number(r.debit), credit: Number(r.credit) });
            const obtenu = (0, releve_bancaire_1.arrondi)(lignes.reduce((acc, l) => acc + Number(l.debit) - Number(l.credit), 0) +
                enc.reduce((acc, e) => acc + Number(e.debit) - Number(e.credit), 0));
            if (Math.abs(attendu - obtenu) >= EPSILON) {
                throw new common_1.BadRequestException(`« ${r.libelle} » : le relevé porte ${attendu.toFixed(2)} vu du compte, les lignes choisies ${obtenu.toFixed(2)} · ` +
                    'un écart ne se rapproche pas, il se comptabilise.');
            }
        }
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            for (const c of dto.correspondances) {
                if ((c.ligneEcritureIds ?? []).length > 0) {
                    await tx.ligneEcriture.updateMany({
                        where: { id: { in: c.ligneEcritureIds }, ecriture: { tenantId }, ligneReleveId: null },
                        data: { rapprochementId: id, ligneReleveId: c.ligneReleveId },
                    });
                }
                if ((c.encoursIds ?? []).length > 0) {
                    await tx.encoursOuvertureRapprochement.updateMany({
                        where: { id: { in: c.encoursIds }, tenantId, ligneReleveId: null },
                        data: { pointeSurId: id, ligneReleveId: c.ligneReleveId },
                    });
                }
            }
        });
        return { nombreCorrespondances: dto.correspondances.length };
    }
    async dissocier(tenantId, id, ligneReleveId) {
        await this.assurerEnCours(tenantId, id);
        const r = await this.prisma.ligneReleveBancaire.findFirst({ where: { id: ligneReleveId, tenantId, rapprochementId: id } });
        if (!r)
            throw new common_1.NotFoundException('Ligne du relevé introuvable dans ce rapprochement.');
        const res = await this.prisma.ligneEcriture.updateMany({
            where: { ligneReleveId, ecriture: { tenantId } },
            data: { ligneReleveId: null, rapprochementId: null },
        });
        const enc = await this.prisma.encoursOuvertureRapprochement.updateMany({
            where: { ligneReleveId, tenantId },
            data: { ligneReleveId: null, pointeSurId: null },
        });
        return { nombreLignes: res.count + enc.count };
    }
};
exports.RapprochementService = RapprochementService;
exports.RapprochementService = RapprochementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RapprochementService);
//# sourceMappingURL=rapprochement.service.js.map