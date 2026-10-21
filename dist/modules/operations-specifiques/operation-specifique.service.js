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
exports.OperationSpecifiqueService = exports.CATALOGUE = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const catalogue_operations_1 = require("./catalogue-operations");
const catalogue_operations_dons_1 = require("./catalogue-operations-dons");
exports.CATALOGUE = [...catalogue_operations_1.OPERATIONS_FONDS_PROPRES, ...catalogue_operations_dons_1.OPERATIONS_DONS_ET_AUTRES];
const EPSILON = 0.005;
function auCentime(v) {
    return Math.round(v * 100) / 100;
}
let OperationSpecifiqueService = class OperationSpecifiqueService {
    constructor(prisma, ecritureService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
    }
    async catalogue(tenantId) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { jeuEtatsFinanciersSycebnl: true, methodeCotisations: true },
        });
        const jeu = tenant.jeuEtatsFinanciersSycebnl === 'PROJETS_DEVELOPPEMENT' ? 'PROJETS' : 'ASSOCIATIONS';
        return {
            jeu,
            methodeCotisations: tenant.methodeCotisations,
            operations: exports.CATALOGUE.filter((o) => o.portee === 'TOUS' || o.portee === jeu),
            operationsAutreJeu: exports.CATALOGUE.filter((o) => o.portee !== 'TOUS' && o.portee !== jeu),
        };
    }
    trouverModele(codeModele) {
        for (const operation of exports.CATALOGUE) {
            const modele = operation.modeles.find((m) => m.code === codeModele);
            if (modele)
                return { operation, modele };
        }
        throw new common_1.NotFoundException(`Modèle d'écriture « ${codeModele} » inconnu du catalogue.`);
    }
    async verifierDroitDAgir(modele, tenantId) {
        if (!modele.exigeDroitDAgir)
            return;
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { methodeCotisations: true },
        });
        if (tenant.methodeCotisations === client_1.MethodeCotisations.ENCAISSEMENT) {
            throw new common_1.BadRequestException(`Ce dossier constate ses cotisations à l'ENCAISSEMENT : il ne peut pas justifier d'un droit d'agir en ` +
                `recouvrement (cadre conceptuel § 5.4.2.1). Le modèle « ${modele.libelle} » débite le 411 Adhérents ` +
                `pour constater la créance dès l'appel · il inscrirait à l'actif une créance non recouvrable. ` +
                `Comptabiliser le produit à l'encaissement, ou corriger la méthode dans Structure > Paramètres du dossier.`);
        }
    }
    montantDeLaLigne(ligne, valeurs, codeModele) {
        const lire = (nom) => {
            const v = valeurs[nom];
            if (v === undefined || v === null || Number.isNaN(v)) {
                throw new common_1.BadRequestException(`Le paramètre « ${nom} » est requis par le modèle ${codeModele}.`);
            }
            return v;
        };
        switch (ligne.montant.mode) {
            case 'PARAMETRE':
                return auCentime(lire(ligne.montant.parametre));
            case 'PROPORTION': {
                const taux = typeof ligne.montant.taux === 'number' ? ligne.montant.taux : lire(ligne.montant.taux);
                return auCentime(lire(ligne.montant.parametre) * taux);
            }
            case 'ANNUITE': {
                const duree = lire(ligne.montant.parametreDuree);
                if (duree <= 0)
                    throw new common_1.BadRequestException(`La durée du modèle ${codeModele} doit être supérieure à zéro.`);
                const mois = ligne.montant.parametreMois ? lire(ligne.montant.parametreMois) : 12;
                return auCentime((lire(ligne.montant.parametre) / duree) * (mois / 12));
            }
            case 'COMPLEMENT':
                return null;
        }
    }
    async resoudreComptes(tenantId) {
        return this.prisma.compte.findMany({
            where: { tenantId, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true },
            select: { id: true, numero: true, intitule: true },
            orderBy: { numero: 'asc' },
        });
    }
    async proposer(tenantId, dto) {
        const { modele } = this.trouverModele(dto.codeModele);
        if (modele.renvoiModule) {
            throw new common_1.BadRequestException(`« ${modele.libelle} » se passe dans la fenêtre ${modele.renvoiModule.fenetre} · ${modele.renvoiModule.geste}. ` +
                (modele.renvoiModule.motif ??
                    "Le bien a sa fiche, qui calcule et retient l'écriture ; passée ici, elle échapperait au plan d'amortissement et la reprise serait proposée deux fois."));
        }
        await this.verifierDroitDAgir(modele, tenantId);
        const valeurs = dto.parametres ?? {};
        const choix = dto.comptesChoisis ?? {};
        const comptes = await this.resoudreComptes(tenantId);
        const montants = modele.lignes.map((l) => this.montantDeLaLigne(l, valeurs, modele.code));
        const indexComplement = modele.lignes.findIndex((l) => l.montant.mode === 'COMPLEMENT');
        if (modele.lignes.filter((l) => l.montant.mode === 'COMPLEMENT').length > 1) {
            throw new common_1.BadRequestException(`Le modèle ${modele.code} déclare plusieurs compléments : la répartition serait indéterminée.`);
        }
        if (indexComplement !== -1) {
            const somme = (sens) => modele.lignes.reduce((s, l, i) => (l.sens === sens && montants[i] !== null ? s + montants[i] : s), 0);
            const sensComplement = modele.lignes[indexComplement].sens;
            const autre = sensComplement === 'DEBIT' ? somme('CREDIT') : somme('DEBIT');
            const dejaPose = somme(sensComplement);
            const complement = auCentime(autre - dejaPose);
            if (complement < 0) {
                throw new common_1.BadRequestException(`Les parts saisies dépassent le montant global : le complément du modèle ${modele.code} serait négatif (${complement}).`);
            }
            montants[indexComplement] = complement;
        }
        const introuvables = [];
        const lignes = [];
        for (let i = 0; i < modele.lignes.length; i++) {
            const l = modele.lignes[i];
            const montant = montants[i] ?? 0;
            if (Math.abs(montant) < EPSILON)
                continue;
            const candidats = comptes.filter((c) => c.numero.startsWith(l.compte) && !(l.exclusions ?? []).some((e) => c.numero.startsWith(e)));
            if (candidats.length === 0) {
                introuvables.push({ compte: l.compte, libelle: l.libelle });
                continue;
            }
            const impose = choix[l.compte];
            const choisi = impose ? candidats.find((c) => c.id === impose || c.numero === impose) : undefined;
            if (impose && !choisi) {
                throw new common_1.BadRequestException(`Le compte choisi pour « ${l.libelle} » ne commence pas par ${l.compte} : il ne convient pas à cette ligne.`);
            }
            const resolu = choisi ?? (candidats.length === 1 ? candidats[0] : undefined);
            lignes.push({
                compteId: resolu?.id ?? null,
                numero: resolu?.numero ?? '',
                intitule: resolu?.intitule ?? '',
                libelle: l.libelle,
                debit: l.sens === 'DEBIT' ? montant : 0,
                credit: l.sens === 'CREDIT' ? montant : 0,
                note: l.note,
                choixRequis: resolu ? undefined : { racine: l.compte, candidats },
            });
        }
        const totalDebit = auCentime(lignes.reduce((s, l) => s + l.debit, 0));
        const totalCredit = auCentime(lignes.reduce((s, l) => s + l.credit, 0));
        return {
            modele: modele.code,
            libelle: modele.libelle,
            objet: modele.objet,
            source: modele.source,
            applicationGuide: modele.applicationGuide,
            anomalie: modele.anomalie,
            aExtourner: modele.aExtourner,
            lignes,
            totalDebit,
            totalCredit,
            equilibree: Math.abs(totalDebit - totalCredit) < EPSILON,
            comptesIntrouvables: introuvables,
        };
    }
    async appliquer(tenantId, userId, dto) {
        const proposition = await this.proposer(tenantId, dto);
        if (proposition.comptesIntrouvables.length > 0) {
            throw new common_1.BadRequestException(`Ce modèle suppose des comptes que le dossier ne possède pas : ${proposition.comptesIntrouvables
                .map((c) => `${c.compte} (${c.libelle})`)
                .join(', ')}. Créez-les au plan de comptes avant d'appliquer le modèle.`);
        }
        const enAttente = proposition.lignes.filter((l) => l.choixRequis);
        if (enAttente.length > 0) {
            throw new common_1.BadRequestException(`Un compte reste à choisir pour : ${enAttente.map((l) => l.libelle).join(', ')}. Plusieurs comptes du dossier conviennent · le modèle ne tranche pas à votre place.`);
        }
        if (!proposition.equilibree) {
            throw new common_1.BadRequestException(`L'écriture proposée n'est pas équilibrée (débit ${proposition.totalDebit}, crédit ${proposition.totalCredit}).`);
        }
        return this.ecritureService.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date: dto.date,
            libelle: dto.libelle?.trim() || proposition.libelle,
            reference: dto.reference,
            lignes: proposition.lignes.map((l) => ({
                compteId: l.compteId,
                libelle: l.libelle,
                debit: l.debit,
                credit: l.credit,
            })),
        });
    }
};
exports.OperationSpecifiqueService = OperationSpecifiqueService;
exports.OperationSpecifiqueService = OperationSpecifiqueService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], OperationSpecifiqueService);
//# sourceMappingURL=operation-specifique.service.js.map