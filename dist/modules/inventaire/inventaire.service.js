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
var InventaireService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventaireService = void 0;
const common_1 = require("@nestjs/common");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const rattachement_ecriture_1 = require("../comptabilite/rattachement-ecriture");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const immobilisation_en_cours_1 = require("../immobilisations/immobilisation-en-cours");
const solde_caisse_au_comptage_1 = require("./solde-caisse-au-comptage");
const lieu_sur_fiche_1 = require("./lieu-sur-fiche");
const editions_inventaire_1 = require("./editions-inventaire");
let InventaireService = InventaireService_1 = class InventaireService {
    constructor(prisma, ecritures) {
        this.prisma = prisma;
        this.ecritures = ecritures;
    }
    static noteContrepartieManquant(numeroCompte, modeInventaireStocks) {
        if (numeroCompte.startsWith('3') && modeInventaireStocks === client_1.MethodeInventaireStocks.PERMANENT) {
            return ("Sur un STOCK tenu en inventaire PERMANENT, la contrepartie n'est pas libre, et elle " +
                "dépend de la QUALIFICATION de l'écart. Si la quantité comptée est inférieure à celle des " +
                "livres, c'est un MALI D'INVENTAIRE : la contrepartie est le compte de VARIATION du stock, " +
                'que les deux textes désignent (AUDCIF Titre VII, compte 603 · SYCEBNL Partie 2 ch. 3, ' +
                "comptes 31 à 36), et la fenêtre Magasin le chiffre article par article. Si c'est la " +
                "VALEUR qui a baissé à quantité égale, c'est une DÉPRÉCIATION (compte 39), et non une " +
                'variation. Les deux voies ne se remplacent pas : porter un mali en charge diverse ' +
                "laisserait la ligne « Variation des stocks » du compte de résultat fausse du montant de " +
                "l'écart, sur une écriture parfaitement équilibrée.");
        }
        return "Contrepartie à choisir selon la nature du manquant · le référentiel n'en impose aucune.";
    }
    static motifRefusExcedent(numeroCompte, modeInventaireStocks) {
        if (numeroCompte.startsWith('3') && modeInventaireStocks === client_1.MethodeInventaireStocks.PERMANENT) {
            return ("Sur un STOCK tenu en inventaire PERMANENT, l'art. 43 ne couvre que la moitié du cas. Il " +
                "s'applique bien à une baisse de VALEUR à quantité égale : « si la valeur d'inventaire est " +
                "supérieure à la valeur d'entrée, cette dernière est maintenue dans les comptes ». Mais si " +
                "c'est la QUANTITÉ comptée qui dépasse celle des livres, il s'agit d'un BONI " +
                "D'INVENTAIRE, et les deux textes disent de le comptabiliser · le compte de stock est " +
                'débité par le crédit de son compte de VARIATION (AUDCIF Titre VII, compte 603 · SYCEBNL ' +
                'Partie 2 ch. 3, comptes 31 à 36). La qualification décide, et elle appartient à la ' +
                "sous-commission : c'est la fenêtre Magasin qui chiffre un boni, article par article, " +
                "parce qu'elle seule connaît les quantités.");
        }
        if (numeroCompte.startsWith('57')) {
            return ("Sur une CAISSE, l'AUDCIF art. 43 ne tranche pas : il oppose deux VALEURS du même bien et débouche sur " +
                "un amortissement ou une dépréciation, là où un excédent d'espèces est une variation de QUANTITÉ. La " +
                'fiche du compte 57 dit même l\'inverse, dans les deux plans : « le solde du compte caisse doit toujours ' +
                'correspondre exactement à la somme disponible réellement ». Aucune source ne dit pour autant ce qu\'il ' +
                "faut créditer · ni produit, ni dette, ni compte d'attente, et aucun plan ne porte de compte « écart de " +
                "caisse ». La décision et la contrepartie appartiennent donc à la commission (CPCC, étape 5 : l'excédent " +
                "s'explique devant la sous-commission, qui propose à la commission principale).");
        }
        return ("AUDCIF art. 43 : « si la valeur d'inventaire est supérieure à la valeur d'entrée, cette dernière est " +
            'maintenue dans les comptes, sauf cas expressément prévus par la législation ».');
    }
    static sanctionApplicable(referentiel) {
        return referentiel === client_1.Referentiel.SYCEBNL
            ? {
                texte: 'Acte uniforme SYCEBNL',
                article: "art. 24, premier tiret · « n'ont pas, pour un exercice, dressé l'inventaire et établi les états financiers annuels, ainsi que le rapport d'activité »",
            }
            : {
                texte: 'AUDCIF',
                article: "art. 111 · « n'auront pas, pour chaque exercice, dressé l'inventaire et établi les états financiers annuels, consolidés ou combinés ainsi que le rapport de gestion »",
            };
    }
    async campagneOuverte(tenantId, id, statutsAdmis, db = this.prisma) {
        const campagne = await db.campagneInventaire.findFirst({ where: { id, tenantId } });
        if (!campagne)
            throw new common_1.NotFoundException("Campagne d'inventaire introuvable.");
        if (!statutsAdmis.includes(campagne.statut)) {
            throw new common_1.ForbiddenException(`Cette campagne est au statut ${campagne.statut} · l'opération demandée n'est possible qu'en ${statutsAdmis.join(' ou ')}.`);
        }
        return campagne;
    }
    async creer(tenantId, userId, dto) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable.');
        if (exercice.statut === 'CLOTURE') {
            throw new common_1.ForbiddenException("L'exercice est clos · l'inventaire se dresse AVANT les écritures d'inventaire, pas après (CPCC, étape 4 : la comparaison se fait sur la balance provisoire).");
        }
        const dateInventaire = new Date(dto.dateInventaire);
        if (dateInventaire < exercice.dateDebut) {
            throw new common_1.BadRequestException("La date d'inventaire est antérieure à l'ouverture de l'exercice.");
        }
        return this.prisma.campagneInventaire.create({
            data: {
                tenantId,
                exerciceId: dto.exerciceId,
                dateInventaire,
                libelle: dto.libelle.trim(),
                instructions: dto.instructions?.trim() || null,
                createdBy: userId,
            },
        });
    }
    async modifier(tenantId, id, dto) {
        await this.campagneOuverte(tenantId, id, [
            client_1.StatutCampagneInventaire.PREPARATION,
            client_1.StatutCampagneInventaire.RECENSEMENT,
        ]);
        return this.prisma.campagneInventaire.update({
            where: { id },
            data: {
                ...(dto.libelle !== undefined ? { libelle: dto.libelle.trim() } : {}),
                ...(dto.instructions !== undefined ? { instructions: dto.instructions?.trim() || null } : {}),
            },
        });
    }
    async ajouterSousCommission(tenantId, campagneId, dto) {
        await this.campagneOuverte(tenantId, campagneId, [
            client_1.StatutCampagneInventaire.PREPARATION,
            client_1.StatutCampagneInventaire.RECENSEMENT,
        ]);
        return this.prisma.sousCommissionInventaire.create({
            data: { tenantId, campagneId, nom: dto.nom.trim(), perimetre: dto.perimetre?.trim() || null },
        });
    }
    async ajouterMembre(tenantId, sousCommissionId, dto) {
        const sc = await this.prisma.sousCommissionInventaire.findFirst({
            where: { id: sousCommissionId, tenantId },
            include: { campagne: true },
        });
        if (!sc)
            throw new common_1.NotFoundException('Sous-commission introuvable.');
        if (sc.campagne.statut === client_1.StatutCampagneInventaire.CLOTUREE) {
            throw new common_1.ForbiddenException('La campagne est close · sa composition ne se modifie plus.');
        }
        return this.prisma.membreSousCommission.create({
            data: {
                tenantId,
                sousCommissionId,
                nom: dto.nom.trim(),
                fonction: dto.fonction?.trim() || null,
                role: dto.role,
            },
        });
    }
    async engendrerFichesImmobilisations(tenantId, campagneId) {
        const campagne = await this.campagneOuverte(tenantId, campagneId, [
            client_1.StatutCampagneInventaire.PREPARATION,
            client_1.StatutCampagneInventaire.RECENSEMENT,
        ]);
        const [biens, dejaFichees] = await Promise.all([
            this.prisma.immobilisation.findMany({
                where: { tenantId, statut: client_1.StatutImmobilisation.EN_SERVICE },
                include: { lieu: { select: { code: true, intitule: true } } },
                orderBy: { designation: 'asc' },
            }),
            this.prisma.ficheInventaire.findMany({
                where: { tenantId, campagneId, immobilisationId: { not: null } },
                select: { id: true, immobilisationId: true, emplacement: true },
            }),
        ]);
        const connues = new Set(dejaFichees.map((f) => f.immobilisationId));
        const aCreer = biens.filter((b) => !connues.has(b.id));
        const lieuParBien = new Map(biens.map((b) => [b.id, (0, lieu_sur_fiche_1.libelleLieuBien)(b.lieu)]));
        const aCompleter = dejaFichees.filter((f) => !f.emplacement && f.immobilisationId && lieuParBien.get(f.immobilisationId));
        for (const f of aCompleter) {
            await this.prisma.ficheInventaire.updateMany({
                where: { id: f.id, tenantId, emplacement: null },
                data: { emplacement: lieuParBien.get(f.immobilisationId) },
            });
        }
        if (aCreer.length === 0)
            return { creees: 0, deja: connues.size, lieuxRecopies: aCompleter.length };
        await this.prisma.ficheInventaire.createMany({
            data: aCreer.map((b) => ({
                tenantId,
                campagneId,
                compteId: (0, immobilisation_en_cours_1.compteInscritALaDate)(b, campagne.dateInventaire),
                immobilisationId: b.id,
                designation: b.numeroInventaire ? `${b.numeroInventaire} · ${b.designation}` : b.designation,
                emplacement: (0, lieu_sur_fiche_1.libelleLieuBien)(b.lieu),
                uniteMesure: 'unité',
            })),
        });
        return { creees: aCreer.length, deja: connues.size, lieuxRecopies: aCompleter.length };
    }
    async creerFiche(tenantId, campagneId, dto) {
        await this.campagneOuverte(tenantId, campagneId, [
            client_1.StatutCampagneInventaire.PREPARATION,
            client_1.StatutCampagneInventaire.RECENSEMENT,
        ]);
        const compte = await this.prisma.compte.findFirst({ where: { id: dto.compteId, tenantId } });
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable.');
        if (compte.typeCompte === 'TOTAL') {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} est un compte Total · il n'a pas de solde propre à rapprocher. Choisir un compte d'imputation.`);
        }
        if (dto.sousCommissionId)
            await this.sousCommissionDeLaCampagne(tenantId, campagneId, dto.sousCommissionId);
        return this.prisma.ficheInventaire.create({
            data: {
                tenantId,
                campagneId,
                compteId: dto.compteId,
                sousCommissionId: dto.sousCommissionId ?? null,
                designation: dto.designation.trim(),
                emplacement: dto.emplacement?.trim() || null,
                uniteMesure: dto.uniteMesure?.trim() || null,
            },
        });
    }
    async sousCommissionDeLaCampagne(tenantId, campagneId, sousCommissionId) {
        const sc = await this.prisma.sousCommissionInventaire.findFirst({
            where: { id: sousCommissionId, tenantId, campagneId },
            select: { id: true },
        });
        if (!sc)
            throw new common_1.BadRequestException("Cette sous-commission n'appartient pas à la campagne de la fiche.");
    }
    async saisirComptage(tenantId, ficheId, dto) {
        const fiche = await this.prisma.ficheInventaire.findFirst({
            where: { id: ficheId, tenantId },
            include: { campagne: true },
        });
        if (!fiche)
            throw new common_1.NotFoundException('Fiche introuvable.');
        if (fiche.campagne.statut === client_1.StatutCampagneInventaire.ARBITRAGE ||
            fiche.campagne.statut === client_1.StatutCampagneInventaire.CLOTUREE) {
            throw new common_1.ForbiddenException("Les écarts de cette campagne sont déjà figés · rouvrir le comptage après le rapprochement ferait porter l'arbitrage sur un chiffre périmé.");
        }
        if (dto.sousCommissionId)
            await this.sousCommissionDeLaCampagne(tenantId, fiche.campagneId, dto.sousCommissionId);
        const miseAJour = await this.prisma.ficheInventaire.update({
            where: { id: ficheId },
            data: {
                ...(dto.quantiteComptee !== undefined ? { quantiteComptee: dto.quantiteComptee } : {}),
                ...(dto.valeurInventaire !== undefined ? { valeurInventaire: dto.valeurInventaire } : {}),
                ...(dto.referencePiece !== undefined ? { referencePiece: dto.referencePiece?.trim() || null } : {}),
                ...(dto.emplacement !== undefined ? { emplacement: dto.emplacement?.trim() || null } : {}),
                ...(dto.sousCommissionId !== undefined ? { sousCommissionId: dto.sousCommissionId } : {}),
            },
        });
        if (dto.quantiteComptee !== undefined || dto.valeurInventaire !== undefined) {
            await this.entrerEnRecensement(tenantId, fiche.campagneId);
        }
        return miseAJour;
    }
    async entrerEnRecensement(tenantId, campagneId) {
        await this.prisma.campagneInventaire.updateMany({
            where: { id: campagneId, tenantId, statut: client_1.StatutCampagneInventaire.PREPARATION },
            data: { statut: client_1.StatutCampagneInventaire.RECENSEMENT },
        });
    }
    async supprimerFiche(tenantId, ficheId) {
        const fiche = await this.prisma.ficheInventaire.findFirst({
            where: { id: ficheId, tenantId },
            include: { campagne: { select: { statut: true } } },
        });
        if (!fiche)
            throw new common_1.NotFoundException('Fiche introuvable.');
        if (fiche.campagne.statut !== client_1.StatutCampagneInventaire.PREPARATION &&
            fiche.campagne.statut !== client_1.StatutCampagneInventaire.RECENSEMENT) {
            throw new common_1.ForbiddenException("Les écarts de cette campagne sont déjà figés · retirer une fiche après le rapprochement ferait mentir l'écart du compte, qui en porte le nombre.");
        }
        await this.prisma.ficheInventaire.deleteMany({ where: { id: fiche.id, tenantId } });
        return { supprimee: true };
    }
    async rapprocher(tenantId, campagneId) {
        const campagne = await this.campagneOuverte(tenantId, campagneId, [
            client_1.StatutCampagneInventaire.PREPARATION,
            client_1.StatutCampagneInventaire.RECENSEMENT,
        ]);
        const fiches = await this.prisma.ficheInventaire.findMany({
            where: { tenantId, campagneId },
            include: { compte: { select: { numero: true, intitule: true } } },
        });
        if (fiches.length === 0) {
            throw new common_1.BadRequestException('Aucune fiche à rapprocher. Une campagne qui ne compte que des caisses, par leurs procès-verbaux sans écart, ' +
                'se clôt sans rapprochement (« Clore la campagne »).');
        }
        const nonValorisees = fiches.filter((f) => f.valeurInventaire === null);
        if (nonValorisees.length > 0) {
            throw new common_1.BadRequestException(`${nonValorisees.length} fiche(s) sans valeur d'inventaire · les valoriser, ou retirer celles qui n'ont pas lieu d'être, avant de rapprocher. ` +
                "Une fiche non valorisée comptée pour zéro produirait un manquant que personne n'a constaté.");
        }
        const lignesAuBrouillard = await this.prisma.ligneEcriture.count({
            where: {
                compteId: { in: [...new Set(fiches.map((f) => f.compteId))] },
                ecriture: { tenantId, exerciceId: campagne.exerciceId, statut: client_1.StatutEcriture.BROUILLARD },
            },
        });
        if (lignesAuBrouillard > 0) {
            throw new common_1.BadRequestException(`${lignesAuBrouillard} ligne(s) au brouillard sur les comptes inventoriés · les valider ou les supprimer avant de rapprocher. ` +
                "L'écart se mesure contre le livre-journal, et un solde figé sur du provisoire ferait constater un écart que personne n'a enregistré.");
        }
        const { lignes } = await this.ecritures.balance(tenantId, campagne.exerciceId, false);
        const soldeParCompte = new Map(lignes.map((l) => [l.compteId, l.solde]));
        const parCompte = new Map();
        for (const f of fiches) {
            const cumul = parCompte.get(f.compteId) ?? { valeur: 0, nombre: 0 };
            cumul.valeur += Number(f.valeurInventaire);
            cumul.nombre += 1;
            parCompte.set(f.compteId, cumul);
        }
        const maintenant = new Date();
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.ecartInventaire.deleteMany({ where: { tenantId, campagneId } });
            for (const [compteId, { valeur, nombre }] of parCompte.entries()) {
                const solde = Math.abs(soldeParCompte.get(compteId) ?? 0);
                await tx.ecartInventaire.create({
                    data: {
                        tenantId,
                        campagneId,
                        compteId,
                        valeurInventaire: valeur,
                        soldeComptable: solde,
                        ecart: Number((valeur - solde).toFixed(2)),
                        nombreFiches: nombre,
                        rapprocheLe: maintenant,
                    },
                });
            }
            await tx.campagneInventaire.update({
                where: { id: campagneId },
                data: { statut: client_1.StatutCampagneInventaire.ARBITRAGE },
            });
        });
        return this.consulter(tenantId, campagneId);
    }
    async arbitrer(tenantId, ecartId, userId, dto) {
        const ecart = await this.prisma.ecartInventaire.findFirst({
            where: { id: ecartId, tenantId },
            include: { campagne: true, compte: { select: { numero: true, intitule: true } } },
        });
        if (!ecart)
            throw new common_1.NotFoundException('Écart introuvable.');
        if (ecart.campagne.statut !== client_1.StatutCampagneInventaire.ARBITRAGE) {
            throw new common_1.ForbiddenException("L'arbitrage n'est ouvert qu'après le rapprochement et avant la clôture de la campagne.");
        }
        const { methodeInventaireStocks: modeStocks } = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { methodeInventaireStocks: true },
        });
        const montant = Number(ecart.ecart);
        if (dto.decision === client_1.DecisionEcartInventaire.A_REDRESSER && montant > 0) {
            throw new common_1.BadRequestException(`L'écart du compte ${ecart.compte.numero} est un EXCÉDENT (+${montant}) · il ne se redresse pas. ` +
                InventaireService_1.motifRefusExcedent(ecart.compte.numero, modeStocks) +
                ' Le classer en EXCEDENT_NON_COMPTABILISE, ou le renvoyer à la commission principale.');
        }
        if (dto.decision === client_1.DecisionEcartInventaire.EXCEDENT_NON_COMPTABILISE && montant < 0) {
            throw new common_1.BadRequestException(`L'écart du compte ${ecart.compte.numero} est un MANQUANT (${montant}) · il n'y a pas d'excédent à laisser au bilan.`);
        }
        if (dto.decision === client_1.DecisionEcartInventaire.A_REDRESSER && !dto.responsable?.trim()) {
            throw new common_1.BadRequestException("Un écart négatif est à la charge de l'entité : la sous-commission doit désigner le responsable (CPCC, étape 5).");
        }
        if (dto.decision !== client_1.DecisionEcartInventaire.A_REDRESSER && !dto.explication?.trim()) {
            throw new common_1.BadRequestException("Un écart non redressé doit porter son explication · sans elle, il est indiscernable d'un écart effacé.");
        }
        return this.prisma.ecartInventaire.update({
            where: { id: ecartId },
            data: {
                decision: dto.decision,
                responsable: dto.responsable?.trim() || null,
                explication: dto.explication?.trim() || null,
                arbitreLe: new Date(),
                arbitrePar: userId,
            },
        });
    }
    async propositionRedressement(tenantId, ecartId) {
        const ecart = await this.prisma.ecartInventaire.findFirst({
            where: { id: ecartId, tenantId },
            include: { compte: { select: { numero: true, intitule: true } } },
        });
        if (!ecart)
            throw new common_1.NotFoundException('Écart introuvable.');
        const { methodeInventaireStocks: modeStocks } = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { methodeInventaireStocks: true },
        });
        const montant = Number(ecart.ecart);
        if (montant >= 0) {
            return {
                proposable: false,
                motif: "Aucune écriture proposée : l'écart n'est pas un manquant. AUDCIF art. 43 · une valeur d'inventaire supérieure à la valeur d'entrée laisse cette dernière au bilan, elle ne devient pas un produit.",
            };
        }
        if (ecart.decision !== client_1.DecisionEcartInventaire.A_REDRESSER) {
            return {
                proposable: false,
                motif: "L'écart n'a pas été arbitré en « à redresser » · la comptabilisation suit la décision de la sous-commission (CPCC, étape 6), elle ne la précède pas.",
            };
        }
        return {
            proposable: true,
            lignes: [
                {
                    compte: null,
                    libelle: `Manquant d'inventaire · ${ecart.compte.numero} ${ecart.compte.intitule}`,
                    sens: 'DEBIT',
                    montant: Math.abs(montant),
                    note: InventaireService_1.noteContrepartieManquant(ecart.compte.numero, modeStocks),
                },
                {
                    compte: ecart.compte.numero,
                    libelle: `Manquant d'inventaire · ${ecart.compte.intitule}`,
                    sens: 'CREDIT',
                    montant: Math.abs(montant),
                },
            ],
            responsable: ecart.responsable,
        };
    }
    async ecartARattacher(tenantId, ecartId) {
        const ecart = await this.prisma.ecartInventaire.findFirst({
            where: { id: ecartId, tenantId },
            include: {
                campagne: { select: { exerciceId: true } },
                compte: { select: { numero: true } },
            },
        });
        if (!ecart)
            throw new common_1.NotFoundException('Écart introuvable.');
        if (ecart.decision !== client_1.DecisionEcartInventaire.A_REDRESSER) {
            throw new common_1.BadRequestException("Seul un écart arbitré « à redresser » porte une écriture de redressement · l'arbitrage de la " +
                'sous-commission précède la comptabilisation (CPCC, étape 6), et un excédent ne se comptabilise ' +
                "pas d'office (AUDCIF art. 43).");
        }
        const attendue = { compte: ecart.compte.numero, sens: 'CREDIT', montant: Math.abs(Number(ecart.ecart)) };
        return { ecart, attendue };
    }
    async ecrituresCandidatesRedressement(tenantId, ecartId) {
        const { ecart, attendue } = await this.ecartARattacher(tenantId, ecartId);
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: {
                ecriture: { tenantId, exerciceId: ecart.campagne.exerciceId, estGenereeParCloture: false, ...ecritures_de_situation_1.HORS_SITUATION },
                compte: { numero: { startsWith: attendue.compte } },
                credit: attendue.montant,
            },
            select: { ecritureId: true },
            take: 200,
        });
        const ids = [...new Set(lignes.map((l) => l.ecritureId))];
        if (ids.length === 0)
            return [];
        const [ecritures, prises] = await Promise.all([
            this.prisma.ecriture.findMany({
                where: { tenantId, id: { in: ids }, ...ecritures_de_situation_1.HORS_SITUATION },
                orderBy: [{ date: 'desc' }],
                select: { id: true, date: true, numeroPiece: true, libelle: true, statut: true },
            }),
            this.prisma.ecartInventaire.findMany({
                where: { tenantId, compteId: ecart.compteId, ecritureId: { in: ids } },
                select: { ecritureId: true },
            }),
        ]);
        const dejaPrises = new Set(prises.map((p) => p.ecritureId));
        return ecritures
            .filter((e) => !dejaPrises.has(e.id))
            .map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) }));
    }
    async rattacherEcritureRedressement(tenantId, ecartId, ecritureId) {
        const { ecart, attendue } = await this.ecartARattacher(tenantId, ecartId);
        if (ecart.ecritureId !== null) {
            throw new common_1.BadRequestException("Une écriture de redressement est déjà rattachée à cet écart · détachez-la d'abord.");
        }
        const ecriture = await this.prisma.ecriture.findFirst({
            where: { id: ecritureId, tenantId },
            select: {
                exerciceId: true,
                estGenereeParCloture: true,
                statut: true,
                numeroPiece: true,
                lignes: { select: { debit: true, credit: true, compte: { select: { numero: true } } } },
            },
        });
        if (!ecriture)
            throw new common_1.NotFoundException("L'écriture indiquée n'existe pas dans ce dossier.");
        if (ecriture.statut === client_1.StatutEcriture.SITUATION) {
            throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifSimulationNonRattachable)(`n° ${ecriture.numeroPiece ?? '·'}`, 'un manquant d’inventaire'));
        }
        if (ecriture.exerciceId !== ecart.campagne.exerciceId || ecriture.estGenereeParCloture) {
            throw new common_1.BadRequestException("L'écriture de redressement appartient à l'exercice inventorié, et ce n'est pas une écriture de " +
                'clôture · le manquant constaté à la clôture grève le résultat de cet exercice-là (AUDCIF art. 42).');
        }
        const manquantes = (0, rattachement_ecriture_1.lignesManquantes)([attendue], ecriture.lignes.map((l) => ({ numero: l.compte.numero, debit: Number(l.debit), credit: Number(l.credit) })));
        if (manquantes.length > 0) {
            throw new common_1.BadRequestException(`Cette écriture ne redresse pas le manquant · il lui manque ${manquantes.map(rattachement_ecriture_1.decrireLigne).join(', ')}. ` +
                'Rattachée quand même, le registre dirait le manquant passé sur une pièce qui passe autre chose.');
        }
        const autre = await this.prisma.ecartInventaire.count({
            where: { tenantId, compteId: ecart.compteId, ecritureId },
        });
        if (autre > 0) {
            throw new common_1.BadRequestException(`Cette écriture redresse déjà un autre écart du compte ${ecart.compte.numero} · sa ligne de crédit ` +
                'ne justifie pas deux manquants.');
        }
        const { count } = await this.prisma.ecartInventaire.updateMany({
            where: { id: ecartId, tenantId, ecritureId: null },
            data: { ecritureId },
        });
        if (count === 0) {
            throw new common_1.BadRequestException("Une écriture vient d'être rattachée à cet écart par une autre demande.");
        }
        return { rattache: true, ecritureId };
    }
    async detacherEcritureRedressement(tenantId, ecartId) {
        const ecart = await this.prisma.ecartInventaire.findFirst({
            where: { id: ecartId, tenantId },
            select: { ecritureId: true },
        });
        if (!ecart)
            throw new common_1.NotFoundException('Écart introuvable.');
        if (ecart.ecritureId === null) {
            throw new common_1.BadRequestException("Aucune écriture de redressement n'est rattachée à cet écart.");
        }
        const ecriture = await this.prisma.ecriture.findFirst({
            where: { id: ecart.ecritureId, tenantId },
            select: { statut: true },
        });
        if (ecriture && ecriture.statut === client_1.StatutEcriture.VALIDEE) {
            throw new common_1.BadRequestException("L'écriture de redressement est validée · elle est entrée au livre-journal (AUDCIF art. 22, 2°), " +
                'et son lien est la trace du redressement. Il ne se défait plus.');
        }
        const { count } = await this.prisma.ecartInventaire.updateMany({
            where: { id: ecartId, tenantId, ecritureId: ecart.ecritureId },
            data: { ecritureId: null },
        });
        if (count === 0)
            throw new common_1.BadRequestException("Le lien a changé entre-temps · rechargez la campagne.");
        return { detache: true };
    }
    async etablirProcesVerbal(tenantId, campagneId, userId, dto) {
        const campagne = await this.campagneOuverte(tenantId, campagneId, [
            client_1.StatutCampagneInventaire.RECENSEMENT,
            client_1.StatutCampagneInventaire.ARBITRAGE,
        ]);
        const membres = await this.prisma.membreSousCommission.findMany({
            where: { tenantId, sousCommission: { campagneId } },
            select: { role: true },
        });
        const aCompte = membres.some((m) => m.role === client_1.RoleMembreInventaire.INVENTORIANT);
        const aAssiste = membres.some((m) => m.role === client_1.RoleMembreInventaire.TEMOIN);
        if (!aCompte || !aAssiste) {
            throw new common_1.BadRequestException("Le procès-verbal se signe par ceux qui ont inventorié ET par ceux qui ont assisté (CPCC, étape 2). " +
                `Il manque ${!aCompte ? 'un inventoriant' : ''}${!aCompte && !aAssiste ? ' et ' : ''}${!aAssiste ? 'un témoin' : ''}.`);
        }
        return this.prisma.campagneInventaire.update({
            where: { id: campagne.id },
            data: { procesVerbalEtabliLe: dto.dateEtablissement ? new Date(dto.dateEtablissement) : new Date(), procesVerbalPar: userId },
        });
    }
    async etablirPvCaisse(tenantId, campagneId, userId, dto) {
        const campagne = await this.campagneOuverte(tenantId, campagneId, [
            client_1.StatutCampagneInventaire.PREPARATION,
            client_1.StatutCampagneInventaire.RECENSEMENT,
            client_1.StatutCampagneInventaire.ARBITRAGE,
        ]);
        const compte = await this.prisma.compte.findFirst({ where: { id: dto.compteId, tenantId } });
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable pour ce dossier.');
        if (!compte.numero.startsWith('57')) {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} n'est pas une caisse · les deux plans logent la caisse au 57 et nulle part ` +
                "ailleurs. Un solde de banque ne se compte pas, il se confirme auprès de la banque (circularisation).");
        }
        const sousCommission = await this.prisma.sousCommissionInventaire.findFirst({
            where: { id: dto.sousCommissionId, tenantId, campagneId },
            include: { membres: { select: { role: true } } },
        });
        if (!sousCommission) {
            throw new common_1.NotFoundException('Sous-commission introuvable sur cette campagne.');
        }
        const manque = InventaireService_1.signaturesManquantes(sousCommission.membres);
        if (manque) {
            throw new common_1.BadRequestException(`Le procès-verbal de comptage se signe par ceux qui ont inventorié ET par ceux qui ont assisté ` +
                `(CPCC, étape 2). Dans la sous-commission « ${sousCommission.nom} », il manque ${manque}.`);
        }
        const coupures = dto.coupures ?? [];
        const totalCoupures = coupures.reduce((t, c) => t + c.valeurUnitaire * c.nombre, 0);
        if (coupures.length > 0 && Math.abs(totalCoupures - dto.especesComptees) > 0.005) {
            throw new common_1.BadRequestException(`La ventilation par coupure totalise ${totalCoupures.toFixed(2)} alors que le comptage annonce ` +
                `${dto.especesComptees.toFixed(2)}. Le détail doit égaler le montant qu'il justifie · autrement c'est ` +
                'le détail que le lecteur croira, et le total sera faux sans que rien ne le dise.');
        }
        if (dto.attestationEtablieLe && !dto.attestationPar?.trim()) {
            throw new common_1.BadRequestException("Une attestation est signée par quelqu'un · nommez-le. Le CPCC demande si « une attestation a-t-elle été " +
                "établie », et une attestation sans signataire n'atteste de rien.");
        }
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: campagne.exerciceId, tenantId },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        if (!exercice)
            throw new common_1.NotFoundException("Exercice de la campagne introuvable.");
        const dateComptage = InventaireService_1.lireDateComptage(dto.dateComptage);
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const lecture = await (0, solde_caisse_au_comptage_1.lireSoldeCaisseAuComptage)(tx, tenantId, compte.id, exercice, dateComptage);
                if (!lecture.lisible)
                    throw new common_1.BadRequestException(lecture.motif);
                const etabliLe = new Date();
                const deviseLue = lecture.unite.devise?.id ?? null;
                if (dto.modeComparaison !== lecture.unite.mode || (dto.deviseId ?? null) !== deviseLue) {
                    throw new common_1.ConflictException("La caisse a changé depuis l'aperçu, relisez · l'aperçu annonçait une comparaison " +
                        `${InventaireService_1.unitePourMessage(dto.modeComparaison)}, le livre-journal en rend une ` +
                        `${InventaireService_1.unitePourMessage(lecture.unite.mode, lecture.unite.devise?.code)}. Les espèces ` +
                        "comptées s'entendent dans l'unité de l'aperçu · figées contre un solde d'une autre unité, l'écart serait faux.");
                }
                const r = lecture.reconstitution;
                const ecart = Number((dto.especesComptees - lecture.soldeComptable).toFixed(2));
                const pv = await tx.procesVerbalComptageCaisse.create({
                    data: {
                        tenantId,
                        campagneId: campagne.id,
                        compteId: dto.compteId,
                        sousCommissionId: dto.sousCommissionId,
                        dateComptage,
                        heureComptage: dto.heureComptage?.trim() || null,
                        soldeComptableFige: lecture.soldeComptable,
                        modeComparaison: lecture.unite.mode,
                        deviseId: lecture.unite.devise?.id ?? null,
                        soldeALaCloture: r ? r.soldeALaCloture : null,
                        mouvementsValeurAvantCloture: r ? r.mouvementsValeurAvantCloture : null,
                        encaissementsPosterieurs: r ? r.encaissementsPosterieurs : null,
                        decaissementsPosterieurs: r ? r.decaissementsPosterieurs : null,
                        mouvementsPosterieurs: r ? r.mouvementsPosterieurs : null,
                        especesComptees: dto.especesComptees,
                        ecart,
                        attestationEtablieLe: dto.attestationEtablieLe ? new Date(dto.attestationEtablieLe) : null,
                        attestationPar: dto.attestationPar?.trim() || null,
                        observations: dto.observations?.trim() || null,
                        etabliPar: userId,
                        etabliLe,
                        coupures: {
                            create: coupures.map((c) => ({
                                tenantId,
                                valeurUnitaire: c.valeurUnitaire,
                                nombre: c.nombre,
                            })),
                        },
                    },
                    include: {
                        coupures: true,
                        compte: { select: { numero: true, intitule: true } },
                        devise: { select: { code: true } },
                    },
                });
                await tx.campagneInventaire.updateMany({
                    where: { id: campagne.id, tenantId, statut: client_1.StatutCampagneInventaire.PREPARATION },
                    data: { statut: client_1.StatutCampagneInventaire.RECENSEMENT },
                });
                return pv;
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException('Un procès-verbal existe déjà pour cette caisse dans cette campagne · il est unique et définitif.');
            }
            throw e;
        }
    }
    static lireDateComptage(texte) {
        if (!solde_caisse_au_comptage_1.FORMAT_DATE_COMPTAGE.test(texte ?? '') || Number.isNaN(new Date(`${texte}T00:00:00.000Z`).getTime())) {
            throw new common_1.BadRequestException('La date du comptage s’écrit AAAA-MM-JJ, sans heure ni fuseau.');
        }
        return new Date(`${texte}T00:00:00.000Z`);
    }
    async apercuPvCaisse(tenantId, campagneId, compteId, dateComptageTexte) {
        const campagne = await this.prisma.campagneInventaire.findFirst({
            where: { id: campagneId, tenantId },
            select: { exerciceId: true },
        });
        if (!campagne)
            throw new common_1.NotFoundException("Campagne d'inventaire introuvable.");
        const compte = await this.prisma.compte.findFirst({
            where: { id: compteId, tenantId },
            select: { id: true, numero: true },
        });
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable pour ce dossier.');
        if (!compte.numero.startsWith('57'))
            throw new common_1.BadRequestException(`Le compte ${compte.numero} n'est pas une caisse.`);
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: campagne.exerciceId, tenantId },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        if (!exercice)
            throw new common_1.NotFoundException("Exercice de la campagne introuvable.");
        const dateComptage = InventaireService_1.lireDateComptage(dateComptageTexte);
        const lecture = await (0, solde_caisse_au_comptage_1.lireSoldeCaisseAuComptage)(this.prisma, tenantId, compte.id, exercice, dateComptage);
        if (!lecture.lisible)
            return { lisible: false, motif: lecture.motif };
        const r = lecture.reconstitution;
        return {
            lisible: true,
            soldeComptable: lecture.soldeComptable,
            modeComparaison: lecture.unite.mode,
            deviseId: lecture.unite.devise?.id ?? null,
            devise: lecture.unite.devise?.code ?? null,
            dateCloture: exercice.dateFin,
            reconstitution: r,
            mentions: (0, solde_caisse_au_comptage_1.mentionsDuPv)({
                dateComptage,
                dateCloture: exercice.dateFin,
                mode: lecture.unite.mode,
                soldeComptable: lecture.soldeComptable,
                soldeALaCloture: r ? r.soldeALaCloture : null,
                mouvementsValeurAvantCloture: r ? r.mouvementsValeurAvantCloture : null,
                especesReconstituees: null,
            }),
        };
    }
    static signaturesManquantes(membres) {
        const aCompte = membres.some((m) => m.role === client_1.RoleMembreInventaire.INVENTORIANT);
        const aAssiste = membres.some((m) => m.role === client_1.RoleMembreInventaire.TEMOIN);
        if (aCompte && aAssiste)
            return null;
        if (!aCompte && !aAssiste)
            return 'un inventoriant et un témoin';
        return aCompte ? 'un témoin' : 'un inventoriant';
    }
    async caissesNonComptees(tenantId, campagneId, db = this.prisma) {
        const campagne = await db.campagneInventaire.findFirst({
            where: { id: campagneId, tenantId },
            select: { id: true, exerciceId: true },
        });
        if (!campagne)
            throw new common_1.NotFoundException('Campagne introuvable.');
        const lignes = await db.ligneEcriture.findMany({
            where: {
                compte: { tenantId, numero: { startsWith: '57' } },
                ecriture: { tenantId, exerciceId: campagne.exerciceId, ...ecritures_de_situation_1.HORS_SITUATION },
            },
            select: { debit: true, credit: true, compte: { select: { id: true, numero: true, intitule: true } } },
        });
        const soldes = new Map();
        for (const l of lignes) {
            const acc = soldes.get(l.compte.id) ?? { numero: l.compte.numero, intitule: l.compte.intitule, solde: 0 };
            acc.solde += Number(l.debit) - Number(l.credit);
            soldes.set(l.compte.id, acc);
        }
        const pv = await db.procesVerbalComptageCaisse.findMany({
            where: { tenantId, campagneId },
            select: { compteId: true },
        });
        const comptees = new Set(pv.map((p) => p.compteId));
        return [...soldes.entries()]
            .filter(([id, v]) => Math.abs(v.solde) > 0.005 && !comptees.has(id))
            .map(([compteId, v]) => ({ compteId, numero: v.numero, intitule: v.intitule, solde: Number(v.solde.toFixed(2)) }))
            .sort((a, b) => a.numero.localeCompare(b.numero));
    }
    async clore(tenantId, campagneId, userId) {
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$queryRaw `SELECT "id" FROM "campagnes_inventaire" WHERE "id" = ${campagneId} AND "tenantId" = ${tenantId} FOR UPDATE`;
            const campagne = await this.campagneOuverte(tenantId, campagneId, [client_1.StatutCampagneInventaire.RECENSEMENT, client_1.StatutCampagneInventaire.ARBITRAGE], tx);
            if (campagne.statut === client_1.StatutCampagneInventaire.RECENSEMENT) {
                await this.verifierCampagneDeCaissesSeules(tenantId, campagneId, tx);
            }
            const enSuspens = await tx.ecartInventaire.count({
                where: { tenantId, campagneId, decision: null },
            });
            if (enSuspens > 0) {
                throw new common_1.ForbiddenException(`${enSuspens} écart(s) sans décision · la sous-commission doit trancher chacun avant la clôture (CPCC, étape 5).`);
            }
            const caissesOubliees = await this.caissesNonComptees(tenantId, campagneId, tx);
            if (caissesOubliees.length > 0) {
                throw new common_1.ForbiddenException(`${caissesOubliees.length} caisse(s) à solde non nul sans procès-verbal de comptage ` +
                    `(${caissesOubliees.map((c) => c.numero).join(', ')}). Le CPCC demande « a-t-on tenu compte de la ` +
                    'caisse siège, de la caisse agence, de la caisse de secours ? » · un « oui » global ne dit rien de ' +
                    "celle qu'on a oubliée, et une caisse non comptée à la clôture ne se recompte plus jamais.");
            }
            try {
                return await tx.campagneInventaire.update({
                    where: { id: campagneId, tenantId, statut: campagne.statut },
                    data: { statut: client_1.StatutCampagneInventaire.CLOTUREE, clotureeLe: new Date(), clotureePar: userId },
                });
            }
            catch (err) {
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                    throw new common_1.ConflictException(`Cette campagne a quitté le statut ${campagne.statut} pendant sa clôture · un autre geste est passé ` +
                        'entre-temps. Rechargez la campagne pour voir son état, puis relancez la clôture si elle reste à faire.');
                }
                throw err;
            }
        });
    }
    async verifierCampagneDeCaissesSeules(tenantId, campagneId, db = this.prisma) {
        const [fiches, pvs, campagne] = await Promise.all([
            db.ficheInventaire.count({ where: { tenantId, campagneId } }),
            db.procesVerbalComptageCaisse.findMany({
                where: { tenantId, campagneId },
                select: {
                    ecart: true,
                    dateComptage: true,
                    especesComptees: true,
                    soldeALaCloture: true,
                    encaissementsPosterieurs: true,
                    decaissementsPosterieurs: true,
                    modeComparaison: true,
                    devise: { select: { code: true } },
                    compte: { select: { numero: true } },
                },
            }),
            db.campagneInventaire.findFirst({
                where: { id: campagneId, tenantId },
                select: { exercice: { select: { dateFin: true } } },
            }),
        ]);
        if (fiches > 0) {
            throw new common_1.ForbiddenException(`${fiches} fiche(s) de comptage à rapprocher · la campagne passe par le rapprochement avec la balance, puis ` +
                "l'arbitrage des écarts, avant la clôture (CPCC, étapes 4 et 5). Seule une campagne qui ne compte que des " +
                'caisses, par leurs procès-verbaux, se clôt sans rapprochement.');
        }
        if (pvs.length === 0) {
            throw new common_1.ForbiddenException("Rien n'a été compté dans cette campagne · ni fiche ni procès-verbal de comptage de caisse. Une campagne " +
                "ne se clôt qu'une fois l'inventaire dressé (AUDCIF art. 42).");
        }
        const avecEcart = pvs.filter((pv) => Math.abs(Number(pv.ecart)) > 0.005);
        if (avecEcart.length > 0) {
            const dateCloture = campagne?.exercice?.dateFin ?? null;
            const valeurs = avecEcart.map((pv) => (0, solde_caisse_au_comptage_1.valeurAPorterSurLaFiche)({
                numero: pv.compte.numero,
                dateComptage: pv.dateComptage,
                especesComptees: Number(pv.especesComptees),
                soldeALaCloture: pv.soldeALaCloture != null ? Number(pv.soldeALaCloture) : null,
                encaissementsPosterieurs: pv.encaissementsPosterieurs != null ? Number(pv.encaissementsPosterieurs) : null,
                decaissementsPosterieurs: pv.decaissementsPosterieurs != null ? Number(pv.decaissementsPosterieurs) : null,
                unite: pv.modeComparaison === client_1.ModeComparaisonCaisse.DEVISE ? (pv.devise?.code ?? null) : null,
            }, dateCloture));
            throw new common_1.ForbiddenException(`${avecEcart.length} caisse(s) à l'écart non arbitré (${avecEcart.map((pv) => pv.compte.numero).join(', ')}) · ` +
                "« les écarts négatifs sont à la charge de l'entreprise, et la sous-commission doit déterminer le " +
                "responsable » (CPCC, étape 5). L'écart d'une caisse s'arbitre comme celui de tout compte · portez sur une " +
                "fiche de la caisse la valeur dite ci-après, rapprochez-la de la balance, puis arbitrez l'écart avant la " +
                `clôture. ${valeurs.join(' ; ')}.`);
        }
    }
    async lister(tenantId, exerciceId) {
        return this.prisma.campagneInventaire.findMany({
            where: { tenantId, ...(exerciceId ? { exerciceId } : {}) },
            orderBy: { dateInventaire: 'desc' },
            include: { _count: { select: { fiches: true, ecarts: true, sousCommissions: true } } },
        });
    }
    async consulter(tenantId, campagneId) {
        const campagne = await this.prisma.campagneInventaire.findFirst({
            where: { id: campagneId, tenantId },
            include: {
                exercice: { select: { dateFin: true } },
                pvComptageCaisse: {
                    include: {
                        compte: { select: { numero: true, intitule: true } },
                        coupures: true,
                        devise: { select: { code: true } },
                    },
                    orderBy: { dateComptage: 'asc' },
                },
                sousCommissions: { include: { membres: true }, orderBy: { nom: 'asc' } },
                fiches: {
                    include: { compte: { select: { numero: true, intitule: true } } },
                    orderBy: { designation: 'asc' },
                },
                ecarts: {
                    include: { compte: { select: { numero: true, intitule: true } } },
                    orderBy: { compte: { numero: 'asc' } },
                },
            },
        });
        if (!campagne)
            throw new common_1.NotFoundException("Campagne d'inventaire introuvable.");
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        const { exercice, pvComptageCaisse, ...reste } = campagne;
        return {
            ...reste,
            pvComptageCaisse: pvComptageCaisse.map((pv) => InventaireService_1.presenterPvCaisse(pv, exercice.dateFin)),
            sanction: InventaireService_1.sanctionApplicable(tenant.referentiel),
        };
    }
    static presenterPvCaisse(pv, dateCloture) {
        const apres = (0, solde_caisse_au_comptage_1.compteApresLaCloture)(pv.dateComptage, dateCloture);
        const figee = pv.soldeALaCloture != null && pv.encaissementsPosterieurs != null && pv.decaissementsPosterieurs != null
            ? {
                soldeALaCloture: Number(pv.soldeALaCloture),
                encaissementsPosterieurs: Number(pv.encaissementsPosterieurs),
                decaissementsPosterieurs: Number(pv.decaissementsPosterieurs),
            }
            : null;
        const especesReconstituees = figee ? (0, solde_caisse_au_comptage_1.especesReconstitueesALaCloture)(Number(pv.especesComptees), figee) : null;
        return {
            ...pv,
            dateCloture,
            unite: pv.modeComparaison === client_1.ModeComparaisonCaisse.DEVISE && pv.devise ? pv.devise.code : null,
            compteApresLaCloture: apres,
            reconstitutionManquante: apres && figee === null,
            especesReconstitueesALaCloture: especesReconstituees,
            mentions: (0, solde_caisse_au_comptage_1.mentionsDuPv)({
                dateComptage: pv.dateComptage,
                dateCloture,
                mode: pv.modeComparaison,
                soldeComptable: Number(pv.soldeComptableFige),
                soldeALaCloture: figee ? figee.soldeALaCloture : null,
                mouvementsValeurAvantCloture: pv.mouvementsValeurAvantCloture != null ? Number(pv.mouvementsValeurAvantCloture) : null,
                especesReconstituees,
            }),
        };
    }
    async mouvementsReconstitution(tenantId, pvId) {
        const pv = await this.prisma.procesVerbalComptageCaisse.findFirst({
            where: { id: pvId, tenantId },
            include: { campagne: { select: { exerciceId: true } }, devise: { select: { id: true, code: true } } },
        });
        if (!pv)
            throw new common_1.NotFoundException('Procès-verbal de comptage introuvable.');
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: pv.campagne.exerciceId, tenantId },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        if (!exercice)
            throw new common_1.NotFoundException("Exercice de la campagne introuvable.");
        if (!(0, solde_caisse_au_comptage_1.compteApresLaCloture)(pv.dateComptage, exercice.dateFin)) {
            return { applicable: false, motif: 'Comptage au plus tard à la clôture · rien à reconstituer.' };
        }
        const suivants = await this.prisma.exercice.findMany({
            where: (0, solde_caisse_au_comptage_1.filtreExercicesSuivants)(tenantId, exercice.dateFin, pv.dateComptage),
            select: { id: true, dateDebut: true, dateFin: true },
            orderBy: { dateDebut: 'asc' },
        });
        const couverture = (0, solde_caisse_au_comptage_1.exercicesDuComptage)(exercice.dateFin, pv.dateComptage, suivants);
        if ('motif' in couverture)
            return { applicable: false, motif: couverture.motif };
        const unite = { mode: pv.modeComparaison, devise: pv.devise ?? null };
        const enDevise = unite.mode === client_1.ModeComparaisonCaisse.DEVISE;
        const f = (0, solde_caisse_au_comptage_1.fenetresDuComptage)(tenantId, exercice, pv.dateComptage, couverture.ids);
        if (!f.intercales || !f.valeurAvantCloture || !f.suivants) {
            return { applicable: false, motif: 'Comptage au plus tard à la clôture · rien à reconstituer.' };
        }
        const lus = (e) => (0, solde_caisse_au_comptage_1.luesParLePv)(e, pv.etabliLe);
        const where = { compteId: pv.compteId, ecriture: lus(f.intercales) };
        const [lignes, total, intercales, avant, cloture, depuisExercice, depuisSuivants] = await Promise.all([
            this.prisma.ligneEcriture.findMany({
                where,
                select: {
                    id: true,
                    libelle: true,
                    debit: true,
                    credit: true,
                    montantDevise: true,
                    ecriture: {
                        select: { id: true, date: true, dateValeur: true, numeroPiece: true, libelle: true, journal: { select: { code: true } } },
                    },
                },
                orderBy: [{ ecriture: { date: 'asc' } }, { id: 'asc' }],
                take: InventaireService_1.PLAFOND_MOUVEMENTS_RECONSTITUTION,
            }),
            this.prisma.ligneEcriture.count({ where }),
            (0, solde_caisse_au_comptage_1.sommesDansLUnite)(this.prisma, pv.compteId, lus(f.intercales), unite),
            (0, solde_caisse_au_comptage_1.sommesDansLUnite)(this.prisma, pv.compteId, lus(f.valeurAvantCloture), unite),
            (0, solde_caisse_au_comptage_1.sommesDansLUnite)(this.prisma, pv.compteId, lus(f.exercice), unite),
            (0, solde_caisse_au_comptage_1.sommesDansLUnite)(this.prisma, pv.compteId, (0, solde_caisse_au_comptage_1.valideesDepuisLePv)(f.exercice, pv.etabliLe), unite),
            (0, solde_caisse_au_comptage_1.sommesDansLUnite)(this.prisma, pv.compteId, (0, solde_caisse_au_comptage_1.valideesDepuisLePv)(f.suivants, pv.etabliLe), unite),
        ]);
        const a = (n) => Number(n.toFixed(2));
        const relus = {
            soldeALaCloture: a(cloture.debit - cloture.credit),
            mouvementsValeurAvantCloture: a(avant.debit - avant.credit),
            encaissements: a(intercales.debit),
            decaissements: a(intercales.credit),
        };
        const figes = pv.soldeALaCloture != null && pv.encaissementsPosterieurs != null && pv.decaissementsPosterieurs != null
            ? {
                soldeALaCloture: Number(pv.soldeALaCloture),
                mouvementsValeurAvantCloture: Number(pv.mouvementsValeurAvantCloture ?? 0),
                encaissements: Number(pv.encaissementsPosterieurs),
                decaissements: Number(pv.decaissementsPosterieurs),
            }
            : null;
        return {
            applicable: true,
            unite: enDevise && unite.devise ? unite.devise.code : null,
            lignes: lignes.map((l) => {
                const debit = Number(l.debit);
                const credit = Number(l.credit);
                const auDebit = debit !== 0;
                const brut = auDebit ? debit : credit;
                const montant = enDevise ? Math.sign(brut) * Number(l.montantDevise ?? 0) : brut;
                return {
                    id: l.id,
                    date: l.ecriture.dateValeur ?? l.ecriture.date,
                    journal: l.ecriture.journal.code,
                    numeroPiece: l.ecriture.numeroPiece,
                    libelle: l.libelle ?? l.ecriture.libelle,
                    encaissement: auDebit ? montant : 0,
                    decaissement: auDebit ? 0 : montant,
                };
            }),
            total,
            tronque: total > lignes.length,
            ...relus,
            concorde: figes
                ? figes.soldeALaCloture === relus.soldeALaCloture &&
                    figes.mouvementsValeurAvantCloture === relus.mouvementsValeurAvantCloture &&
                    figes.encaissements === relus.encaissements &&
                    figes.decaissements === relus.decaissements
                : null,
            saisiesDepuisLePv: {
                nombre: depuisExercice.nombre + depuisSuivants.nombre,
                net: a(depuisExercice.debit - depuisExercice.credit + depuisSuivants.debit - depuisSuivants.credit),
            },
        };
    }
    static unitePourMessage(mode, code) {
        if (mode === client_1.ModeComparaisonCaisse.DEVISE)
            return code ? `en ${code}` : 'en devise';
        if (mode === client_1.ModeComparaisonCaisse.FRANCS_COURS_HISTORIQUES)
            return 'en francs au cours historique';
        return 'en francs';
    }
    async campagnePourEdition(tenantId, campagneId) {
        const c = await this.prisma.campagneInventaire.findFirst({
            where: { id: campagneId, tenantId },
            include: { exercice: { select: { dateDebut: true, dateFin: true, dateArreteComptes: true } } },
        });
        if (!c)
            throw new common_1.NotFoundException("Campagne d'inventaire introuvable.");
        return {
            id: c.id,
            libelle: c.libelle,
            dateInventaire: c.dateInventaire,
            statut: c.statut,
            instructions: c.instructions,
            exercice: c.exercice,
        };
    }
    async courrielDe(tenantId, userId) {
        const u = await this.prisma.user.findFirst({ where: { id: userId, tenantId }, select: { email: true } });
        return u?.email ?? 'utilisateur retiré du dossier';
    }
    sousCommissionsAvecMembres(tenantId, campagneId) {
        return this.prisma.sousCommissionInventaire.findMany({
            where: { tenantId, campagneId },
            include: { membres: { select: { nom: true, fonction: true, role: true }, orderBy: { createdAt: 'asc' } } },
            orderBy: { nom: 'asc' },
        });
    }
    fichesPourEdition(tenantId, campagneId) {
        return this.prisma.ficheInventaire.findMany({
            where: { tenantId, campagneId },
            include: { compte: { select: { numero: true, intitule: true } } },
            orderBy: { designation: 'asc' },
        });
    }
    async editionFichesVierges(tenantId, campagneId, sousCommissionId) {
        const [campagne, sousCommissions, fiches] = await Promise.all([
            this.campagnePourEdition(tenantId, campagneId),
            this.sousCommissionsAvecMembres(tenantId, campagneId),
            this.fichesPourEdition(tenantId, campagneId),
        ]);
        if (sousCommissionId && !sousCommissions.some((sc) => sc.id === sousCommissionId)) {
            throw new common_1.BadRequestException("Cette sous-commission n'appartient pas à la campagne.");
        }
        return (0, editions_inventaire_1.editionFichesVierges)({ campagne, sousCommissions, fiches, sousCommissionId: sousCommissionId || null });
    }
    async editionProcesVerbal(tenantId, campagneId) {
        const campagne = await this.campagnePourEdition(tenantId, campagneId);
        const [enTete, sousCommissions, fiches, ecarts, pvCaisses] = await Promise.all([
            this.prisma.campagneInventaire.findFirst({
                where: { id: campagneId, tenantId },
                select: { procesVerbalEtabliLe: true, procesVerbalPar: true },
            }),
            this.sousCommissionsAvecMembres(tenantId, campagneId),
            this.fichesPourEdition(tenantId, campagneId),
            this.prisma.ecartInventaire.findMany({
                where: { tenantId, campagneId },
                include: { compte: { select: { numero: true, intitule: true } } },
            }),
            this.prisma.procesVerbalComptageCaisse.findMany({
                where: { tenantId, campagneId },
                include: {
                    compte: { select: { numero: true, intitule: true } },
                    sousCommission: { select: { nom: true } },
                    devise: { select: { code: true } },
                },
            }),
        ]);
        const etabli = enTete?.procesVerbalEtabliLe
            ? {
                le: enTete.procesVerbalEtabliLe,
                par: enTete.procesVerbalPar ? await this.courrielDe(tenantId, enTete.procesVerbalPar) : 'non renseigné',
            }
            : null;
        return (0, editions_inventaire_1.editionPvInventaire)({
            campagne,
            etabli,
            sousCommissions,
            fiches,
            ecarts,
            pvCaisses: pvCaisses.map((p) => ({
                ...p,
                unite: p.modeComparaison === client_1.ModeComparaisonCaisse.DEVISE && p.devise ? p.devise.code : null,
            })),
        });
    }
    async editionPvCaisse(tenantId, pvId) {
        const pv = await this.prisma.procesVerbalComptageCaisse.findFirst({
            where: { id: pvId, tenantId },
            include: {
                compte: { select: { numero: true, intitule: true } },
                coupures: true,
                devise: { select: { code: true } },
                sousCommission: {
                    include: { membres: { select: { nom: true, fonction: true, role: true }, orderBy: { createdAt: 'asc' } } },
                },
            },
        });
        if (!pv)
            throw new common_1.NotFoundException('Procès-verbal de comptage introuvable.');
        const campagne = await this.campagnePourEdition(tenantId, pv.campagneId);
        const presente = InventaireService_1.presenterPvCaisse(pv, campagne.exercice.dateFin);
        return (0, editions_inventaire_1.editionPvCaisse)({
            campagne,
            pv: presente,
            sousCommission: pv.sousCommission,
            etabliPar: await this.courrielDe(tenantId, pv.etabliPar),
        });
    }
    async resumePourLivreInventaire(tenantId, exerciceId) {
        const campagnes = await this.prisma.campagneInventaire.findMany({
            where: { tenantId, exerciceId },
            include: { ecarts: { include: { compte: { select: { numero: true, intitule: true } } } }, _count: { select: { fiches: true } } },
            orderBy: { dateInventaire: 'asc' },
        });
        return campagnes.map((c) => {
            const ecarts = c.ecarts.map((e) => Number(e.ecart));
            return {
                campagneId: c.id,
                libelle: c.libelle,
                dateInventaire: c.dateInventaire,
                statut: c.statut,
                procesVerbalEtabliLe: c.procesVerbalEtabliLe,
                fiches: c._count.fiches,
                comptesRapproches: c.ecarts.length,
                manquants: ecarts.filter((m) => m < 0).length,
                excedents: ecarts.filter((m) => m > 0).length,
                sansEcart: ecarts.filter((m) => m === 0).length,
                totalManquants: Number(ecarts.filter((m) => m < 0).reduce((s, m) => s + m, 0).toFixed(2)),
                totalExcedents: Number(ecarts.filter((m) => m > 0).reduce((s, m) => s + m, 0).toFixed(2)),
                ecartsSansDecision: c.ecarts.filter((e) => e.decision === null).length,
            };
        });
    }
};
exports.InventaireService = InventaireService;
InventaireService.PLAFOND_MOUVEMENTS_RECONSTITUTION = 500;
exports.InventaireService = InventaireService = InventaireService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], InventaireService);
//# sourceMappingURL=inventaire.service.js.map