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
var LettrageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LettrageService = exports.MOTIF_LETTRAGE_SITUATION = exports.PLAFOND_LIGNES_LETTRAGE = exports.MOTIF_DELETTRAGE_MODULE = void 0;
exports.prochaineLettreDuCompte = prochaineLettreDuCompte;
exports.poserGroupeSoldeDuModule = poserGroupeSoldeDuModule;
exports.estRelettrageDeCloture = estRelettrageDeCloture;
exports.motifLettrageANouveauProvisoire = motifLettrageANouveauProvisoire;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const lettre_choisie_1 = require("./lettre-choisie");
const prisma_retry_util_1 = require("../../common/prisma-retry.util");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const gel_cloture_1 = require("../exercice/gel-cloture");
const ecart_change_realise_1 = require("../reglements/ecart-change-realise");
const compte_ecart_change_1 = require("../reglements/compte-ecart-change");
const lettrages_a_cheval_1 = require("./lettrages-a-cheval");
const reconduction_lettrage_1 = require("./reconduction-lettrage");
const ligne_de_reclassement_1 = require("./ligne-de-reclassement");
const EPSILON = 0.005;
const MOTIF_DELETTRAGE_MODULE = (code) => `Le lettrage ${code} a été posé par le module « Créances douteuses ou litigieuses » sur les lignes d'une créance éteinte · ` +
    "il ne se défait pas d'ici. Annulez ou retirez le mouvement de la créance (recouvrement, perte) dans ce module · il défait " +
    'lui-même ce lettrage.';
exports.MOTIF_DELETTRAGE_MODULE = MOTIF_DELETTRAGE_MODULE;
function indexVersLettre(n) {
    let s = '';
    while (n > 0) {
        const reste = (n - 1) % 26;
        s = String.fromCharCode(65 + reste) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}
function lettreVersIndex(lettre) {
    let n = 0;
    for (const ch of lettre.toUpperCase()) {
        n = n * 26 + (ch.charCodeAt(0) - 64);
    }
    return n;
}
async function prochaineLettreDuCompte(tx, tenantId, compteId) {
    const [groupes, lignes] = await Promise.all([
        tx.lettrage.findMany({ where: { compteId, tenantId }, select: { code: true } }),
        tx.ligneEcriture.findMany({ where: { compteId, lettre: { not: null }, ecriture: { tenantId } }, select: { lettre: true }, distinct: ['lettre'] }),
    ]);
    const codes = [...groupes.map((g) => g.code), ...lignes.map((l) => l.lettre)];
    let index = codes.reduce((max, c) => Math.max(max, lettreVersIndex(c)), 0) + 1;
    return () => indexVersLettre(index++);
}
async function poserGroupeSoldeDuModule(tx, p) {
    const lignes = await tx.ligneEcriture.findMany({
        where: { id: { in: p.ligneIds }, compteId: p.compteId, lettrageId: null, ecriture: { tenantId: p.tenantId } },
        select: { id: true, debit: true, credit: true },
    });
    if (lignes.length !== new Set(p.ligneIds).size)
        throw lignesPrisesEntreTemps();
    const solde = lignes.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0);
    if (Math.abs(solde) > EPSILON)
        return null;
    const groupe = await tx.lettrage.create({
        data: {
            tenantId: p.tenantId,
            compteId: p.compteId,
            code: p.code,
            statut: client_1.StatutLettrage.SOLDE,
            solde: 0,
            origine: client_1.OrigineLettrage.MODULE,
            createdBy: p.userId,
            soldeAt: new Date(),
        },
    });
    const { count } = await tx.ligneEcriture.updateMany({ where: { id: { in: p.ligneIds }, lettrageId: null }, data: { lettrageId: groupe.id, lettre: p.code } });
    if (count !== lignes.length)
        throw lignesPrisesEntreTemps();
    return p.code;
}
function estRelettrageDeCloture(lignes) {
    const marquees = lignes.filter((l) => l.aRelettrerDepuis);
    if (marquees.length === 0)
        return false;
    return lignes.every((l) => l.aRelettrerDepuis || (l.ecriture.estGenereeParCloture === true && !l.ecriture.estANouveauProvisoire && l.ecriture.estSoldeDesComptesDeGestion !== true));
}
function motifLettrageANouveauProvisoire() {
    return ("La ligne choisie appartient au report à-nouveau PROVISOIRE · l'exercice précédent n'est pas clôturé, et ce report n'est " +
        "jamais validé, donc jamais au livre-journal (AUDCIF art. 22, 2°) · sa clôture le remplace par le report définitif. " +
        "Lettré, il serait figé par la prochaine clôture de période et la clôture de l'exercice précédent n'aurait plus d'issue. " +
        "Clôturez l'exercice précédent, puis lettrez avec la ligne d'à-nouveau définitif, avant la clôture de la période qui porte " +
        "le règlement (elle figerait aussi le règlement).");
}
function cumulDuRealise(garde, ajoute) {
    if (garde === null)
        return ajoute;
    if (ajoute === null)
        return garde;
    return Math.round((garde + ajoute) * 100) / 100;
}
function lignesPrisesEntreTemps() {
    return new common_1.ConflictException("Une des lignes a été lettrée entre-temps par un autre utilisateur · rien n'a été lettré. Rechargez et recommencez.");
}
exports.PLAFOND_LIGNES_LETTRAGE = 5000;
function soldeEnDevise(lignes, deviseId, sens) {
    const signe = sens === 'DEBIT' ? 1 : -1;
    const total = lignes.reduce((t, l) => {
        if (l.deviseId !== deviseId || l.montantDevise === null)
            return t;
        return t + signe * Math.sign(Number(l.debit) - Number(l.credit)) * Math.abs(Number(l.montantDevise));
    }, 0);
    return Math.round(total * 100) / 100;
}
exports.MOTIF_LETTRAGE_SITUATION = "Une ligne d'une écriture de situation ne se lettre pas · elle n'enregistre aucune opération et n'est pas au " +
    "livre-journal (AUDCIF art. 19 ; art. 22, 1°). Lettrez les pièces réelles qui se répondent.";
let LettrageService = LettrageService_1 = class LettrageService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async trouverCompte(tenantId, compteId) {
        const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId } });
        if (!compte) {
            throw new common_1.NotFoundException('Compte introuvable pour ce tenant');
        }
        return compte;
    }
    async trouverCompteLettrable(tenantId, compteId) {
        const compte = await this.trouverCompte(tenantId, compteId);
        if (!compte.lettrable) {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} n'est pas déclaré lettrable. Ouvrez-le au lettrage depuis le plan comptable ` +
                "(« liberté de définir la liste des comptes auxquels s'applique le lettrage », CPCC, ch. 6).");
        }
        return compte;
    }
    async lister(tenantId, compteId, nonLettreesSeulement) {
        const compte = await this.trouverCompte(tenantId, compteId);
        const where = {
            compteId,
            ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION },
            ...(nonLettreesSeulement ? { lettre: null } : {}),
        };
        const [lignes, total, agregat] = await Promise.all([
            this.prisma.ligneEcriture.findMany({
                where,
                include: { ecriture: { include: { journal: true } }, lettrage: true, devise: true },
                orderBy: [{ ecriture: { date: 'asc' } }, { id: 'asc' }],
                take: exports.PLAFOND_LIGNES_LETTRAGE,
            }),
            this.prisma.ligneEcriture.count({ where }),
            this.prisma.ligneEcriture.aggregate({ where, _sum: { debit: true, credit: true } }),
        ]);
        const tronque = total > lignes.length;
        const [lettrages, prochaineLettre] = await Promise.all([
            this.prisma.lettrage.findMany({
                where: {
                    compteId,
                    tenantId,
                    ...(tronque
                        ? {
                            OR: [
                                { statut: client_1.StatutLettrage.PARTIEL },
                                { id: { in: [...new Set(lignes.map((l) => l.lettrageId).filter((id) => id !== null))] } },
                            ],
                        }
                        : {}),
                },
                orderBy: { createdAt: 'asc' },
            }),
            this.prochaineLettre(this.prisma, tenantId, compteId),
        ]);
        return {
            tronque,
            total,
            plafond: exports.PLAFOND_LIGNES_LETTRAGE,
            totaux: { debit: Number(agregat._sum.debit ?? 0), credit: Number(agregat._sum.credit ?? 0) },
            prochaineLettre,
            compte: { id: compte.id, numero: compte.numero, intitule: compte.intitule, lettrable: compte.lettrable },
            lignes: lignes.map((l) => ({
                id: l.id,
                date: l.ecriture.date,
                journalCode: l.ecriture.journal.code,
                libelle: l.libelle ?? l.ecriture.libelle,
                reference: l.ecriture.reference,
                debit: Number(l.debit),
                credit: Number(l.credit),
                lettre: l.lettre,
                lettrageId: l.lettrageId,
                codeLettrage: l.lettrage ? (l.lettrage.statut === client_1.StatutLettrage.SOLDE ? l.lettrage.code : l.lettrage.code.toLowerCase()) : null,
                devise: l.devise?.code ?? null,
                montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
            })),
            lettrages: lettrages.map((g) => ({
                id: g.id,
                code: g.statut === client_1.StatutLettrage.SOLDE ? g.code : g.code.toLowerCase(),
                statut: g.statut,
                solde: Number(g.solde),
                origine: g.origine,
                verrouille: g.verrouille,
                ecartChange: g.ecartChange === null ? null : Number(g.ecartChange),
                createdAt: g.createdAt,
                createdBy: g.createdBy,
                soldeAt: g.soldeAt,
            })),
        };
    }
    async listerGroupesDuDossier(tenantId, statut) {
        const groupes = await this.prisma.lettrage.findMany({
            where: { tenantId, ...(statut ? { statut } : {}) },
            include: {
                compte: { select: { id: true, numero: true, intitule: true } },
                _count: { select: { lignes: true } },
            },
            orderBy: [{ compte: { numero: 'asc' } }, { createdAt: 'asc' }],
        });
        return groupes.map((g) => ({
            id: g.id,
            compteId: g.compteId,
            compteNumero: g.compte.numero,
            compteIntitule: g.compte.intitule,
            code: g.statut === client_1.StatutLettrage.SOLDE ? g.code : g.code.toLowerCase(),
            statut: g.statut,
            solde: Number(g.solde),
            origine: g.origine,
            verrouille: g.verrouille,
            ecartChange: g.ecartChange === null ? null : Number(g.ecartChange),
            nombreLignes: g._count.lignes,
            createdAt: g.createdAt,
            createdBy: g.createdBy,
            soldeAt: g.soldeAt,
        }));
    }
    async prochaineLettre(tx, tenantId, compteId) {
        const [groupes, lignes] = await Promise.all([
            tx.lettrage.findMany({ where: { compteId, tenantId }, select: { code: true } }),
            tx.ligneEcriture.findMany({
                where: { compteId, lettre: { not: null } },
                select: { lettre: true },
                distinct: ['lettre'],
            }),
        ]);
        const codes = [...groupes.map((g) => g.code), ...lignes.map((l) => l.lettre)];
        const maxIndex = codes.reduce((max, c) => Math.max(max, lettreVersIndex(c)), 0);
        return indexVersLettre(maxIndex + 1);
    }
    async refuserLettreEmployee(tx, tenantId, compte, lettre) {
        const [groupe, ligne] = await Promise.all([
            tx.lettrage.findFirst({ where: { tenantId, compteId: compte.id, code: lettre }, select: { statut: true } }),
            tx.ligneEcriture.findFirst({ where: { compteId: compte.id, lettre, ecriture: { tenantId } }, select: { id: true } }),
        ]);
        if (!groupe && !ligne)
            return;
        throw new common_1.BadRequestException((0, lettre_choisie_1.motifLettreDejaEmployee)({
            lettre,
            compteNumero: compte.numero,
            statutGroupe: groupe ? (groupe.statut === client_1.StatutLettrage.SOLDE ? 'SOLDE' : 'PARTIEL') : null,
            lettreProposee: await this.prochaineLettre(tx, tenantId, compte.id),
        }));
    }
    async lettresDuLot(tx, tenantId, compteId) {
        let index = lettreVersIndex(await this.prochaineLettre(tx, tenantId, compteId));
        return () => indexVersLettre(index++);
    }
    static ecartCumule(dejaRealise, auDenouement, soldeNul) {
        if (!soldeNul)
            return dejaRealise;
        if (dejaRealise === null)
            return auDenouement;
        return Math.round((dejaRealise + (auDenouement ?? 0)) * 100) / 100;
    }
    ecartChangeRealise(lignes) {
        const enDevise = lignes.filter((l) => l.deviseId !== null && l.montantDevise !== null);
        if (enDevise.length === 0)
            return null;
        if (new Set(enDevise.map((l) => l.deviseId)).size !== 1)
            return null;
        const soldeDevise = enDevise.reduce((s, l) => {
            const sens = Number(l.debit) - Number(l.credit) >= 0 ? 1 : -1;
            return s + sens * Number(l.montantDevise);
        }, 0);
        if (Math.abs(soldeDevise) > EPSILON)
            return null;
        const soldeLocal = enDevise.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
        return soldeLocal;
    }
    async creerGroupe(tx, params, prochaineLettre) {
        const lignes = await tx.ligneEcriture.findMany({
            where: { id: { in: params.ligneIds }, compteId: params.compteId, lettrageId: null },
            select: { id: true, debit: true, credit: true, deviseId: true, montantDevise: true },
        });
        if (lignes.length !== new Set(params.ligneIds).size)
            throw lignesPrisesEntreTemps();
        const solde = lignes.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
        const soldeNul = Math.abs(solde) <= EPSILON;
        const statut = soldeNul ? client_1.StatutLettrage.SOLDE : client_1.StatutLettrage.PARTIEL;
        const code = prochaineLettre ? prochaineLettre() : await this.prochaineLettre(tx, params.tenantId, params.compteId);
        const groupe = await tx.lettrage.create({
            data: {
                tenantId: params.tenantId,
                compteId: params.compteId,
                code,
                statut,
                solde: soldeNul ? 0 : solde,
                origine: params.origine,
                createdBy: params.userId,
                soldeAt: soldeNul ? new Date() : null,
                ecartChange: LettrageService_1.ecartCumule(params.ecartChangeRealise ?? null, soldeNul ? this.ecartChangeRealise(lignes) : null, soldeNul),
            },
        });
        const { count } = await tx.ligneEcriture.updateMany({
            where: { id: { in: params.ligneIds }, lettrageId: null },
            data: { lettrageId: groupe.id, lettre: soldeNul ? code : null },
        });
        if (count !== lignes.length)
            throw lignesPrisesEntreTemps();
        return groupe;
    }
    verifierLignes(lignes, attendu) {
        if (lignes.length !== attendu.nombre) {
            throw new common_1.NotFoundException('Une ou plusieurs lignes sont introuvables');
        }
        for (const l of lignes) {
            if (l.compteId !== attendu.compteId || l.ecriture.tenantId !== attendu.tenantId) {
                throw new common_1.BadRequestException('Toutes les lignes doivent appartenir au compte et au tenant indiqués');
            }
            if (l.ecriture.estANouveauProvisoire) {
                throw new common_1.BadRequestException(motifLettrageANouveauProvisoire());
            }
            if (l.ecriture.statut === client_1.StatutEcriture.SITUATION) {
                throw new common_1.BadRequestException(exports.MOTIF_LETTRAGE_SITUATION);
            }
            if (l.lettrageId) {
                const jour = l.ecriture.date.toISOString().slice(0, 10);
                throw new common_1.BadRequestException(`La ligne du ${jour} appartient déjà à un lettrage · délettrez-le d'abord, ou complétez-le.`);
            }
        }
    }
    async lettrerManuel(tenantId, compteId, ligneIds, userId, options = {}) {
        const compte = await this.trouverCompteLettrable(tenantId, compteId);
        const lettreChoisie = options.lettre ? (0, lettre_choisie_1.normaliserLettre)(options.lettre) : null;
        if (lettreChoisie !== null && !(0, lettre_choisie_1.lettreBienFormee)(lettreChoisie))
            throw new common_1.BadRequestException(lettre_choisie_1.MOTIF_FORMAT_LETTRE);
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const lignes = await tx.ligneEcriture.findMany({
                where: { id: { in: ligneIds } },
                include: { ecriture: true },
            });
            this.verifierLignes(lignes, { compteId, tenantId, nombre: ligneIds.length });
            await (0, ligne_de_reclassement_1.refuserLignesDuCompteClientReclasse)(tx, tenantId, ligneIds);
            const aCheval = (0, lettrages_a_cheval_1.motifLettrageADeuxExercices)(lignes, compte);
            if (aCheval)
                throw new common_1.BadRequestException(aCheval);
            await (0, gel_cloture_1.refuserSiLignesFigees)(tx, tenantId, ligneIds, 'lettrer');
            const solde = lignes.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
            if (Math.abs(solde) > EPSILON && !options.autoriserPartiel) {
                const change = (0, ecart_change_realise_1.ecartDuGroupe)(lignes.map((l) => ({
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                    deviseId: l.deviseId,
                    montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
                })));
                if (change !== null) {
                    throw new common_1.BadRequestException(`Les lignes sélectionnées sont soldées dans leur devise mais pas en francs · l'écart de ${Math.abs(change.ecart).toFixed(2)} ` +
                        `est ${change.ecart > 0 ? 'une perte de change réalisée' : 'un gain de change réalisé'} (AUDCIF art. 55). Lettrez en partiel, puis passez ` +
                        "l'écart proposé sur le groupe (« Écart de change »).");
                }
                throw new common_1.BadRequestException(`Le solde des lignes sélectionnées n'est pas nul (${solde.toFixed(2)}). ` +
                    "Cochez « lettrage partiel » si l'opération est effectivement réglée en partie seulement.");
            }
            if (lettreChoisie !== null)
                await this.refuserLettreEmployee(tx, tenantId, compte, lettreChoisie);
            const groupe = await this.creerGroupe(tx, {
                tenantId,
                compteId,
                ligneIds,
                origine: client_1.OrigineLettrage.MANUEL,
                userId,
                ecartChangeRealise: options.ecartChangeRealise,
            }, lettreChoisie !== null ? () => lettreChoisie : undefined);
            return {
                lettre: groupe.statut === client_1.StatutLettrage.SOLDE ? groupe.code : groupe.code.toLowerCase(),
                statut: groupe.statut,
                solde: Number(groupe.solde),
                ecartChange: groupe.ecartChange === null ? null : Number(groupe.ecartChange),
                nombreLignes: ligneIds.length,
            };
        }, `Trop de lettrages effectués au même instant sur ce compte · veuillez réessayer.`);
    }
    async completer(tenantId, lettrageId, ligneIds, options = {}) {
        const tolere = (options.groupeTolere ?? null) !== null && options.groupeTolere === lettrageId;
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const groupe = await tx.lettrage.findFirst({ where: { id: lettrageId, tenantId } });
            if (!groupe)
                throw new common_1.NotFoundException('Lettrage introuvable pour ce dossier');
            if (groupe.verrouille) {
                throw new common_1.BadRequestException(`Le lettrage ${groupe.code} est verrouillé · déverrouillez-le avant de le compléter.`);
            }
            if (groupe.statut === client_1.StatutLettrage.SOLDE) {
                throw new common_1.BadRequestException(`Le lettrage ${groupe.code} est déjà soldé · il n'y a rien à compléter.`);
            }
            const nouvelles = await tx.ligneEcriture.findMany({
                where: { id: { in: ligneIds } },
                include: { ecriture: true },
            });
            this.verifierLignes(nouvelles, { compteId: groupe.compteId, tenantId, nombre: ligneIds.length });
            const dejaDuGroupe = await tx.ligneEcriture.findMany({
                where: { lettrageId },
                select: {
                    id: true,
                    debit: true,
                    credit: true,
                    deviseId: true,
                    montantDevise: true,
                    ecriture: { select: { exerciceId: true, date: true, exercice: { select: { statut: true } } } },
                },
            });
            if (options.borne) {
                const avant = dejaDuGroupe.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0);
                if (Math.abs(avant - options.borne.soldeAttendu) > EPSILON) {
                    throw new common_1.ConflictException(`Le lettrage ${groupe.code.toLowerCase()} a changé depuis la préparation du règlement (reste lu ${options.borne.soldeAttendu.toFixed(2)}, ` +
                        `reste actuel ${avant.toFixed(2)}) · un autre règlement l'a complété. Relancez le règlement sur le reste actuel.`);
                }
                const deviseId = options.borne.deviseId ?? null;
                if (deviseId !== null) {
                    const avantDevise = soldeEnDevise(dejaDuGroupe, deviseId, options.borne.sensDesFactures);
                    const apresDevise = avantDevise + soldeEnDevise(nouvelles, deviseId, options.borne.sensDesFactures);
                    if (apresDevise < -EPSILON) {
                        throw new common_1.ConflictException(`Le règlement dépasse le reste en devise du lettrage ${groupe.code.toLowerCase()} (${avantDevise.toFixed(2)}) · l'excédent est une ` +
                            'avance ou un trop-perçu, à comptabiliser à part.');
                    }
                }
                else {
                    const ajoute = nouvelles.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0);
                    const apres = avant + ajoute;
                    const franchit = options.borne.sensDesFactures === 'DEBIT' ? apres < -EPSILON : apres > EPSILON;
                    if (franchit) {
                        throw new common_1.ConflictException(`Le règlement dépasse le reste du lettrage ${groupe.code.toLowerCase()} (${Math.abs(avant).toFixed(2)}) · l'excédent est une avance ou ` +
                            'un trop-perçu, à comptabiliser à part.');
                    }
                }
            }
            const compte = await this.trouverCompte(tenantId, groupe.compteId);
            const exercicesDuGroupe = new Set(dejaDuGroupe.map((l) => l.ecriture.exerciceId));
            const ajouteUnExercice = nouvelles.some((l) => !exercicesDuGroupe.has(l.ecriture.exerciceId));
            if (!tolere || ajouteUnExercice) {
                const aCheval = (0, lettrages_a_cheval_1.motifLettrageADeuxExercices)([...nouvelles, ...dejaDuGroupe], compte);
                if (aCheval)
                    throw new common_1.BadRequestException(aCheval);
            }
            await (0, ligne_de_reclassement_1.refuserLignesDuCompteClientReclasse)(tx, tenantId, ligneIds, dejaDuGroupe.map((l) => l.id));
            await (0, gel_cloture_1.refuserSiLignesFigees)(tx, tenantId, tolere ? ligneIds : [...ligneIds, ...dejaDuGroupe.map((l) => l.id)], 'compléter ce lettrage');
            const dExerciceClos = dejaDuGroupe.filter((l) => l.ecriture.exercice?.statut === client_1.StatutExercice.CLOTURE).map((l) => l.id);
            await tx.ligneEcriture.updateMany({ where: { id: { in: ligneIds } }, data: { lettrageId } });
            const toutes = await tx.ligneEcriture.findMany({
                where: { lettrageId },
                select: { id: true, debit: true, credit: true, deviseId: true, montantDevise: true },
            });
            const solde = toutes.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
            const soldeNul = Math.abs(solde) <= EPSILON;
            await tx.lettrage.update({
                where: { id: lettrageId },
                data: {
                    statut: soldeNul ? client_1.StatutLettrage.SOLDE : client_1.StatutLettrage.PARTIEL,
                    solde: soldeNul ? 0 : solde,
                    soldeAt: soldeNul ? new Date() : null,
                    ecartChange: LettrageService_1.ecartCumule(cumulDuRealise(groupe.ecartChange === null ? null : Number(groupe.ecartChange), options.ecartChangeRealise ?? null), soldeNul ? this.ecartChangeRealise(toutes) : null, soldeNul),
                },
            });
            if (soldeNul) {
                await tx.ligneEcriture.updateMany({
                    where: { lettrageId, ...(dExerciceClos.length > 0 ? { id: { notIn: dExerciceClos } } : {}) },
                    data: { lettre: groupe.code },
                });
            }
            return {
                lettre: soldeNul ? groupe.code : groupe.code.toLowerCase(),
                statut: soldeNul ? client_1.StatutLettrage.SOLDE : client_1.StatutLettrage.PARTIEL,
                solde: soldeNul ? 0 : solde,
                nombreLignes: toutes.length,
            };
        }, 'Trop de lettrages effectués au même instant sur ce compte · veuillez réessayer.');
    }
    async propositionEcartChange(tenantId, lettrageId, compteId) {
        const groupe = await this.prisma.lettrage.findFirst({
            where: { id: lettrageId, tenantId, ...(compteId ? { compteId } : {}) },
            include: { compte: { select: { id: true, numero: true, intitule: true, modeReportANouveau: true } } },
        });
        if (!groupe)
            throw new common_1.NotFoundException('Lettrage introuvable pour ce dossier');
        const base = { lettrageId, code: groupe.code, compteId: groupe.compteId, compteNumero: groupe.compte.numero };
        if (groupe.statut === client_1.StatutLettrage.SOLDE) {
            return { ...base, ecart: null, motif: `Le lettrage ${groupe.code} est déjà soldé · il n'y a plus d'écart à passer.` };
        }
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: { lettrageId, ecriture: { tenantId } },
            select: {
                id: true,
                debit: true,
                credit: true,
                deviseId: true,
                montantDevise: true,
                devise: { select: { code: true } },
                ecriture: { select: { date: true, exerciceId: true } },
            },
        });
        const aCheval = new Set(lignes.map((l) => l.ecriture.exerciceId)).size > 1;
        const figees = await (0, gel_cloture_1.lignesFigees)(this.prisma, tenantId, lignes.map((l) => l.id));
        const fige = figees.size > 0;
        const change = (0, ecart_change_realise_1.ecartDuGroupe)(lignes.map((l) => ({
            debit: Number(l.debit),
            credit: Number(l.credit),
            deviseId: l.deviseId,
            montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
        })));
        if (change === null) {
            return {
                ...base,
                ecart: null,
                motif: "Ce lettrage n'est pas soldé dans sa devise · il reste à régler, et l'écart de change ne se mesure qu'au " +
                    'dénouement (AUDCIF art. 55).',
            };
        }
        const derniere = lignes.reduce((d, l) => (l.ecriture.date > d.ecriture.date ? l : d), lignes[0]);
        const referentiel = await (0, compte_ecart_change_1.referentielDuDossier)(this.prisma, tenantId);
        const nature = (0, ecart_change_realise_1.natureDuCompte)(groupe.compte.numero, referentiel);
        const prescrits = (0, ecart_change_realise_1.comptesPrescrits)(referentiel, nature);
        const numeroPrescrit = prescrits.perte === null || change.ecart === 0 ? null : change.ecart > 0 ? prescrits.perte : prescrits.gain;
        const lu = numeroPrescrit
            ? await this.prisma.compte.findFirst({
                where: { tenantId, numero: numeroPrescrit },
                select: { id: true, numero: true, intitule: true, typeCompte: true, estActif: true },
            })
            : null;
        const comptePrescrit = lu && lu.typeCompte === 'DETAIL' && lu.estActif !== false ? { id: lu.id, numero: lu.numero, intitule: lu.intitule } : null;
        return {
            ...base,
            aCheval,
            fige,
            ecart: change.ecart,
            sens: change.ecart > 0 ? 'PERTE' : 'GAIN',
            devise: lignes.find((l) => l.deviseId === change.deviseId)?.devise?.code ?? null,
            deviseId: change.deviseId,
            date: derniere.ecriture.date,
            exerciceId: derniere.ecriture.exerciceId,
            nature,
            comptePrescrit,
            numeroPrescrit,
            motif: prescrits.perte === null
                ? prescrits.motif
                : comptePrescrit === null && numeroPrescrit !== null
                    ? lu
                        ? `Le compte ${numeroPrescrit} que le texte donne ${lu.typeCompte === 'DETAIL' ? 'est en sommeil' : 'est un compte de regroupement'} · choisissez l'un de ses sous-comptes de détail.`
                        : `Le compte ${numeroPrescrit} que le texte donne n'est pas ouvert dans le plan du dossier · ouvrez-le, ou un sous-compte, dans Plan comptable.`
                    : null,
        };
    }
    async verrouiller(tenantId, lettrageId, verrouille) {
        const groupe = await this.prisma.lettrage.findFirst({ where: { id: lettrageId, tenantId } });
        if (!groupe)
            throw new common_1.NotFoundException('Lettrage introuvable pour ce dossier');
        await this.prisma.lettrage.update({ where: { id: lettrageId }, data: { verrouille } });
        return { code: groupe.code, verrouille };
    }
    async delettrer(tenantId, compteId, lettre) {
        await this.trouverCompte(tenantId, compteId);
        const code = lettre.toUpperCase();
        const groupe = await this.prisma.lettrage.findFirst({ where: { tenantId, compteId, code } });
        if (groupe) {
            if (groupe.verrouille) {
                throw new common_1.BadRequestException(`Le lettrage ${groupe.code} est verrouillé · déverrouillez-le avant de le défaire.`);
            }
            if (groupe.origine === client_1.OrigineLettrage.MODULE) {
                throw new common_1.BadRequestException((0, exports.MOTIF_DELETTRAGE_MODULE)(groupe.code));
            }
            return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const duGroupe = await tx.ligneEcriture.findMany({ where: { lettrageId: groupe.id }, select: { id: true } });
                await (0, gel_cloture_1.refuserSiLignesFigees)(tx, tenantId, duGroupe.map((l) => l.id), 'délettrer');
                const { count } = await tx.ligneEcriture.updateMany({
                    where: { lettrageId: groupe.id },
                    data: { lettre: null, lettrageId: null },
                });
                await tx.lettrage.delete({ where: { id: groupe.id } });
                return { lettre: groupe.code, nombreLignes: count };
            });
        }
        const anciennes = await this.prisma.ligneEcriture.findMany({
            where: { compteId, lettre: code, ecriture: { tenantId } },
            select: { id: true },
        });
        await (0, gel_cloture_1.refuserSiLignesFigees)(this.prisma, tenantId, anciennes.map((l) => l.id), 'délettrer');
        const resultat = await this.prisma.ligneEcriture.updateMany({
            where: { compteId, lettre: code, ecriture: { tenantId } },
            data: { lettre: null, lettrageId: null },
        });
        if (resultat.count === 0) {
            throw new common_1.NotFoundException(`Aucune ligne lettrée "${code}" trouvée sur ce compte`);
        }
        return { lettre: code, nombreLignes: resultat.count };
    }
    trouverSousEnsemble(lignes, cible) {
        const trie = [...lignes].sort((a, b) => b.montant - a.montant);
        const centimes = trie.map((l) => Math.round(l.montant * 100));
        const cibleCentimes = Math.round(cible * 100);
        const n = centimes.length;
        const sommeSuffixe = new Array(n + 1).fill(0);
        for (let i = n - 1; i >= 0; i--)
            sommeSuffixe[i] = sommeSuffixe[i + 1] + centimes[i];
        const choisis = [];
        const backtrack = (i, reste) => {
            if (reste === 0)
                return true;
            if (i >= n || reste < 0 || sommeSuffixe[i] < reste)
                return false;
            choisis.push(i);
            if (backtrack(i + 1, reste - centimes[i]))
                return true;
            choisis.pop();
            return backtrack(i + 1, reste);
        };
        if (!backtrack(0, cibleCentimes))
            return null;
        return choisis.map((i) => trie[i].id);
    }
    sommesAtteignables(lignes) {
        const centimes = lignes.map((l) => Math.round(l.montant * 100));
        const resultat = new Map();
        const n = lignes.length;
        for (let masque = 1; masque < 1 << n; masque++) {
            let somme = 0;
            const ids = [];
            for (let i = 0; i < n; i++) {
                if (masque & (1 << i)) {
                    somme += centimes[i];
                    ids.push(lignes[i].id);
                }
            }
            if (!resultat.has(somme))
                resultat.set(somme, ids);
        }
        return resultat;
    }
    trouverPartitionGenerale(debits, credits) {
        const sommesDebits = this.sommesAtteignables(debits);
        const sommesCredits = this.sommesAtteignables(credits);
        let meilleur = null;
        for (const [somme, debitIds] of sommesDebits) {
            const creditIds = sommesCredits.get(somme);
            if (!creditIds)
                continue;
            if (!meilleur || debitIds.length + creditIds.length < meilleur.debits.length + meilleur.credits.length) {
                meilleur = { debits: debitIds, credits: creditIds };
            }
        }
        return meilleur;
    }
    apparierParReference(lignes) {
        const parReference = new Map();
        for (const l of lignes) {
            const ref = l.reference?.trim();
            if (!ref)
                continue;
            const existantes = parReference.get(ref) ?? [];
            existantes.push(l);
            parReference.set(ref, existantes);
        }
        const groupes = [];
        const consommees = new Set();
        for (const [, groupe] of parReference) {
            if (groupe.length !== 2)
                continue;
            const [a, b] = groupe;
            if (Math.sign(a.net) === Math.sign(b.net))
                continue;
            if (Math.abs(a.net + b.net) > EPSILON)
                continue;
            groupes.push([a.id, b.id]);
            consommees.add(a.id);
            consommees.add(b.id);
        }
        return { groupes, restantes: new Set(lignes.filter((l) => !consommees.has(l.id)).map((l) => l.id)) };
    }
    async calculerPropositions(tenantId, compte, db = this.prisma) {
        const compteId = compte.id;
        const candidates = await db.ligneEcriture.findMany({
            where: { compteId, lettrageId: null, ecriture: { tenantId, estANouveauProvisoire: false, ...ecritures_de_situation_1.HORS_SITUATION } },
            include: { ecriture: { select: { reference: true, date: true, exerciceId: true } } },
            orderBy: { ecriture: { date: 'asc' } },
        });
        const figees = await (0, gel_cloture_1.lignesFigees)(db, tenantId, candidates.map((l) => l.id));
        const reclassees = await (0, ligne_de_reclassement_1.lignesReclasseesDuCompte)(db, tenantId, compteId);
        const miseDeCote = (0, ligne_de_reclassement_1.lignesMisesDeCote)(candidates, reclassees);
        const nonLettrees = candidates.filter((l) => !figees.has(l.id));
        const { parPiece, parMontant, ecarteesDesMontants } = this.apparierParExercice(nonLettrees, compte, miseDeCote);
        const sansReclassement = (g) => !g.some((id) => reclassees.has(id));
        return {
            parPiece: parPiece.filter(sansReclassement),
            parMontant: parMontant.filter(sansReclassement),
            lignes: nonLettrees.filter((l) => !reclassees.has(l.id)),
            ecarteesReclassement: ecarteesDesMontants,
            passesParMontantSuspendues: miseDeCote.passesParMontantSuspendues,
        };
    }
    apparierParExercice(nonLettrees, compte, miseDeCote) {
        const auDetail = compte.modeReportANouveau === 'DETAIL';
        const parExercice = new Map();
        for (const l of nonLettrees) {
            const cle = auDetail ? l.ecriture.exerciceId : 'compte';
            const lot = parExercice.get(cle);
            if (lot)
                lot.push(l);
            else
                parExercice.set(cle, [l]);
        }
        const parPiece = [];
        const parMontant = [];
        let ecarteesDesMontants = 0;
        for (const lot of parExercice.values()) {
            const r = this.apparier(lot, miseDeCote);
            parPiece.push(...r.parPiece);
            parMontant.push(...r.parMontant);
            ecarteesDesMontants += r.ecarteesDesMontants;
        }
        return { parPiece, parMontant, ecarteesDesMontants };
    }
    apparier(nonLettrees, miseDeCote) {
        const LIMITE_LIGNES_SUBSET_SUM = 25;
        const LIMITE_LIGNES_PARTITION = 16;
        const net = (l) => Number(l.debit) - Number(l.credit);
        let debitsRestants = nonLettrees
            .filter((l) => net(l) > EPSILON)
            .map((l) => ({ id: l.id, montant: net(l) }));
        let creditsRestants = nonLettrees
            .filter((l) => net(l) < -EPSILON)
            .map((l) => ({ id: l.id, montant: -net(l) }));
        const toutesNonNulles = nonLettrees
            .filter((l) => Math.abs(net(l)) > EPSILON)
            .map((l) => ({ id: l.id, reference: l.ecriture.reference, net: net(l) }));
        const parPiece = this.apparierParReference(toutesNonNulles);
        debitsRestants = debitsRestants.filter((d) => parPiece.restantes.has(d.id));
        creditsRestants = creditsRestants.filter((c) => parPiece.restantes.has(c.id));
        const avant = debitsRestants.length + creditsRestants.length;
        if (miseDeCote.passesParMontantSuspendues) {
            return { parPiece: parPiece.groupes, parMontant: [], ecarteesDesMontants: avant };
        }
        debitsRestants = debitsRestants.filter((d) => !miseDeCote.ecartees.has(d.id));
        creditsRestants = creditsRestants.filter((c) => !miseDeCote.ecartees.has(c.id));
        const ecarteesDesMontants = avant - debitsRestants.length - creditsRestants.length;
        const groupes = [];
        for (const debit of [...debitsRestants]) {
            const idx = creditsRestants.findIndex((c) => Math.abs(c.montant - debit.montant) <= EPSILON);
            if (idx !== -1) {
                const [credit] = creditsRestants.splice(idx, 1);
                debitsRestants = debitsRestants.filter((d) => d.id !== debit.id);
                groupes.push([debit.id, credit.id]);
            }
        }
        if (debitsRestants.length <= LIMITE_LIGNES_SUBSET_SUM) {
            for (const credit of [...creditsRestants]) {
                const sousEnsemble = this.trouverSousEnsemble(debitsRestants, credit.montant);
                if (sousEnsemble) {
                    groupes.push([credit.id, ...sousEnsemble]);
                    debitsRestants = debitsRestants.filter((d) => !sousEnsemble.includes(d.id));
                    creditsRestants = creditsRestants.filter((c) => c.id !== credit.id);
                }
            }
        }
        if (creditsRestants.length <= LIMITE_LIGNES_SUBSET_SUM) {
            for (const debit of [...debitsRestants]) {
                const sousEnsemble = this.trouverSousEnsemble(creditsRestants, debit.montant);
                if (sousEnsemble) {
                    groupes.push([debit.id, ...sousEnsemble]);
                    creditsRestants = creditsRestants.filter((c) => !sousEnsemble.includes(c.id));
                    debitsRestants = debitsRestants.filter((d) => d.id !== debit.id);
                }
            }
        }
        while (debitsRestants.length >= 2 &&
            creditsRestants.length >= 2 &&
            debitsRestants.length <= LIMITE_LIGNES_PARTITION &&
            creditsRestants.length <= LIMITE_LIGNES_PARTITION) {
            const partition = this.trouverPartitionGenerale(debitsRestants, creditsRestants);
            if (!partition)
                break;
            groupes.push([...partition.debits, ...partition.credits]);
            debitsRestants = debitsRestants.filter((d) => !partition.debits.includes(d.id));
            creditsRestants = creditsRestants.filter((c) => !partition.credits.includes(c.id));
        }
        return { parPiece: parPiece.groupes, parMontant: groupes, ecarteesDesMontants };
    }
    async preLettrage(tenantId, compteId) {
        const compte = await this.trouverCompteLettrable(tenantId, compteId);
        const { parPiece, parMontant, lignes, ecarteesReclassement, passesParMontantSuspendues } = await this.calculerPropositions(tenantId, compte);
        const parId = new Map(lignes.map((l) => [l.id, l]));
        const decrire = (ligneIds, origine) => {
            const detail = ligneIds
                .map((id) => parId.get(id))
                .filter((l) => Boolean(l))
                .map((l) => ({
                ligneId: l.id,
                date: l.ecriture.date.toISOString().slice(0, 10),
                libelle: l.libelle ?? '',
                reference: l.ecriture.reference ?? '',
                debit: Number(l.debit),
                credit: Number(l.credit),
            }));
            return {
                origine,
                ligneIds,
                lignes: detail,
                montant: detail.reduce((t, l) => t + l.debit, 0),
                solde: detail.reduce((t, l) => t + l.debit - l.credit, 0),
            };
        };
        const aRelettrer = await this.prisma.ligneEcriture.findMany({
            where: { compteId, lettrageId: null, aRelettrerDepuis: { not: null }, ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION } },
            select: { id: true, debit: true, credit: true, deviseId: true, libelle: true, ecriture: { select: { date: true, exerciceId: true, libelle: true } } },
            orderBy: { id: 'asc' },
            take: 200,
        });
        const relettrages = [];
        for (const l of aRelettrer) {
            const candidates = await this.prisma.ligneEcriture.findMany({
                where: {
                    compteId,
                    lettrageId: null,
                    id: { not: l.id },
                    debit: l.credit,
                    credit: l.debit,
                    deviseId: l.deviseId,
                    ecriture: { tenantId, exerciceId: l.ecriture.exerciceId, estANouveauProvisoire: false, ...ecritures_de_situation_1.HORS_SITUATION },
                },
                select: { id: true, debit: true, credit: true, libelle: true, dateEcheance: true, ecriture: { select: { date: true, libelle: true } } },
                take: 20,
            });
            const decrireLigne = (x) => ({
                ligneId: x.id,
                date: x.ecriture.date.toISOString().slice(0, 10),
                libelle: x.libelle ?? x.ecriture.libelle,
                debit: Number(x.debit),
                credit: Number(x.credit),
            });
            relettrages.push({ ligne: decrireLigne(l), candidates: candidates.map(decrireLigne) });
        }
        const nonReconduits = await (0, reconduction_lettrage_1.groupesNonReconduits)(this.prisma, { tenantId, compteId });
        const idsAccueil = [...new Set(nonReconduits.groupes.flatMap((g) => g.accueil.filter((id) => id !== null)))];
        const accueils = idsAccueil.length
            ? await this.prisma.ligneEcriture.findMany({
                where: { id: { in: idsAccueil }, ecriture: { tenantId } },
                select: { id: true, debit: true, credit: true, libelle: true, ecriture: { select: { date: true, libelle: true } } },
            })
            : [];
        const accueilDe = new Map(accueils.map((l) => [l.id, l]));
        const reconductions = nonReconduits.groupes.map((g) => ({
            lettrageId: g.lettrageId,
            code: g.code,
            reste: g.reste,
            etat: g.etat,
            detail: (0, reconduction_lettrage_1.detailNonReconduit)(g),
            lignes: g.accueil.flatMap((id) => {
                const l = id ? accueilDe.get(id) : undefined;
                return l
                    ? [{ ligneId: l.id, date: l.ecriture.date.toISOString().slice(0, 10), libelle: l.libelle ?? l.ecriture.libelle, debit: Number(l.debit), credit: Number(l.credit) }]
                    : [];
            }),
        }));
        return {
            relettrages,
            reconductions,
            reconductionsTotal: nonReconduits.total,
            reconductionsTronque: nonReconduits.tronque,
            propositions: [
                ...parPiece.map((g) => decrire(g, client_1.OrigineLettrage.AUTOMATIQUE_PIECE)),
                ...parMontant.map((g) => decrire(g, client_1.OrigineLettrage.AUTOMATIQUE_MONTANT)),
            ],
            nonProposees: lignes.filter((l) => ![...parPiece, ...parMontant].flat().includes(l.id)).length,
            ecarteesReclassement,
            passesParMontantSuspendues,
            miseDeCote: (0, ligne_de_reclassement_1.messageMiseDeCote)(ecarteesReclassement, passesParMontantSuspendues),
            avertissement: "Un rapprochement par MONTANT est une présomption du logiciel : deux sommes égales ne prouvent pas qu'elles se soldent l'une l'autre. Un rapprochement par RÉFÉRENCE DE PIÈCE s'appuie sur une donnée saisie par un humain. Rien n'est écrit tant que vous n'avez pas confirmé.",
        };
    }
    async confirmerPreLettrage(tenantId, compteId, userId, groupes) {
        const compte = await this.trouverCompteLettrable(tenantId, compteId);
        if (groupes.length === 0) {
            throw new common_1.BadRequestException('Aucun groupe à confirmer.');
        }
        for (const g of groupes) {
            if (g.origine === client_1.OrigineLettrage.MANUEL) {
                throw new common_1.BadRequestException("Un groupe composé à la main se pose par le lettrage manuel, qui porte son origine propre. La confirmation d'un pré-lettrage conserve l'origine de la passe qui l'a trouvé.");
            }
            if (g.origine !== client_1.OrigineLettrage.AUTOMATIQUE_PIECE && g.origine !== client_1.OrigineLettrage.AUTOMATIQUE_MONTANT) {
                throw new common_1.BadRequestException("La confirmation d'un pré-lettrage ne porte que l'une des deux origines automatiques (référence de pièce, montant).");
            }
            if (g.ligneIds.length < 2) {
                throw new common_1.BadRequestException('Un groupe de lettrage porte au moins deux lignes.');
            }
        }
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const lettres = [];
            const prochaine = await this.lettresDuLot(tx, tenantId, compteId);
            for (const g of groupes) {
                const lignes = await tx.ligneEcriture.findMany({
                    where: { id: { in: g.ligneIds } },
                    include: {
                        ecriture: {
                            select: {
                                tenantId: true,
                                date: true,
                                exerciceId: true,
                                statut: true,
                                estANouveauProvisoire: true,
                                estGenereeParCloture: true,
                                estSoldeDesComptesDeGestion: true,
                                exercice: { select: { statut: true } },
                            },
                        },
                    },
                });
                this.verifierLignes(lignes, { compteId, tenantId, nombre: g.ligneIds.length });
                await (0, ligne_de_reclassement_1.refuserLignesDuCompteClientReclasse)(tx, tenantId, g.ligneIds);
                const aCheval = (0, lettrages_a_cheval_1.motifLettrageADeuxExercices)(lignes, compte);
                if (aCheval)
                    throw new common_1.BadRequestException(aCheval);
                const relettrage = estRelettrageDeCloture(lignes) && lignes.every((l) => l.ecriture.exercice?.statut !== client_1.StatutExercice.CLOTURE);
                if (!relettrage)
                    await (0, gel_cloture_1.refuserSiLignesFigees)(tx, tenantId, g.ligneIds, 'lettrer');
                const solde = lignes.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0);
                if (Math.abs(solde) > EPSILON) {
                    throw new common_1.BadRequestException(`Ce groupe ne solde pas (écart de ${solde.toFixed(2)}). Les propositions du pré-lettrage sont toujours soldées : un groupe qui ne l'est pas n'en vient pas, et se pose par le lettrage manuel.`);
                }
                const groupe = await this.creerGroupe(tx, {
                    tenantId,
                    compteId,
                    ligneIds: g.ligneIds,
                    origine: g.origine,
                    userId,
                }, prochaine);
                lettres.push(groupe.code);
            }
            return { groupes: groupes.length, lettres };
        }, 'Trop de lettrages effectués au même instant sur ce compte · veuillez réessayer.', { operations: groupes.length });
    }
    async reconduire(tenantId, compteId, lettrageId, userId) {
        await this.trouverCompteLettrable(tenantId, compteId);
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const { groupes } = await (0, reconduction_lettrage_1.groupesNonReconduits)(tx, { tenantId, compteId });
            const g = groupes.find((x) => x.lettrageId === lettrageId);
            if (!g) {
                throw new common_1.BadRequestException("Ce lettrage partiel n'est pas à reconduire · il l'est déjà, ses lignes d'à-nouveau sont relettrées ensemble, ou l'exercice qui " +
                    "les porte n'est plus ouvert. Relancez le pré-lettrage du compte.");
            }
            if (g.etat !== 'A_RECONDUIRE')
                throw new common_1.BadRequestException(`Ce lettrage ne se reconduit pas d'office · ${(0, reconduction_lettrage_1.detailNonReconduit)(g)}`);
            const groupe = await tx.lettrage.findFirst({
                where: { id: lettrageId, tenantId, compteId },
                select: { id: true, code: true, compteId: true, ecartChange: true },
            });
            if (!groupe)
                throw new common_1.NotFoundException('Lettrage introuvable pour ce dossier');
            const pose = await (0, reconduction_lettrage_1.poserGroupeReconduit)(tx, {
                tenantId,
                groupe,
                accueil: g.accueil,
                userId,
                code: await this.prochaineLettre(tx, tenantId, compteId),
            });
            if (!pose.code)
                throw new common_1.ConflictException(`Ce lettrage n'a pas été reconduit · ${pose.motif}. Relancez le pré-lettrage du compte.`);
            return { lettre: pose.code.toLowerCase(), reconduitDe: g.code, reste: g.reste };
        }, 'Trop de lettrages effectués au même instant sur ce compte · veuillez réessayer.');
    }
    async lettrageAutomatique(tenantId, compteId, userId) {
        const compte = await this.trouverCompteLettrable(tenantId, compteId);
        const ouvertes = await this.prisma.ligneEcriture.count({ where: { compteId, lettrageId: null, ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION } } });
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const { parPiece, parMontant, ecarteesReclassement, passesParMontantSuspendues } = await this.calculerPropositions(tenantId, compte, tx);
            const parPieceGroupes = parPiece;
            const groupes = parMontant;
            const miseDeCote = {
                ecarteesReclassement,
                passesParMontantSuspendues,
                miseDeCote: (0, ligne_de_reclassement_1.messageMiseDeCote)(ecarteesReclassement, passesParMontantSuspendues),
            };
            if (groupes.length === 0 && parPieceGroupes.length === 0) {
                return { groupes: 0, parPiece: 0, parMontant: 0, lettres: [], ...miseDeCote };
            }
            const lettres = [];
            const prochaine = await this.lettresDuLot(tx, tenantId, compteId);
            for (const [origine, lots] of [
                [client_1.OrigineLettrage.AUTOMATIQUE_PIECE, parPieceGroupes],
                [client_1.OrigineLettrage.AUTOMATIQUE_MONTANT, groupes],
            ]) {
                for (const ligneIds of lots) {
                    const groupe = await this.creerGroupe(tx, { tenantId, compteId, ligneIds, origine, userId }, prochaine);
                    lettres.push(groupe.code);
                }
            }
            return {
                groupes: parPieceGroupes.length + groupes.length,
                parPiece: parPieceGroupes.length,
                parMontant: groupes.length,
                lettres,
                ...miseDeCote,
            };
        }, 'Trop de lettrages effectués au même instant sur ce compte · veuillez réessayer.', { operations: ouvertes });
    }
    async lettrerLignesDuModule(tenantId, compteId, ligneIds, userId) {
        const compte = await this.trouverCompte(tenantId, compteId);
        if (!compte.lettrable) {
            return { motif: `Le compte ${compte.numero} n'est pas déclaré lettrable · ses lignes ne sont pas lettrées.` };
        }
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, (tx) => this.poserGroupeDuModule(tx, tenantId, compteId, ligneIds, userId), 'Trop de lettrages effectués au même instant sur ce compte · veuillez réessayer.');
    }
    async lettrerLignesDuModuleDansTx(tx, tenantId, compteId, ligneIds, userId) {
        const compte = await tx.compte.findFirst({ where: { id: compteId, tenantId }, select: { numero: true, lettrable: true } });
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable pour ce dossier.');
        if (!compte.lettrable) {
            return { motif: `Le compte ${compte.numero} n'est pas déclaré lettrable · ses lignes ne sont pas lettrées, et personne ne les lettre.`, nonLettrable: true };
        }
        return this.poserGroupeDuModule(tx, tenantId, compteId, ligneIds, userId);
    }
    async poserGroupeDuModule(tx, tenantId, compteId, ligneIds, userId) {
        const figees = await (0, gel_cloture_1.lignesFigees)(tx, tenantId, ligneIds);
        const figee = [...figees.values()][0];
        if (figee)
            return { motif: `La ligne du ${figee.date.toISOString().slice(0, 10)} est figée, ${figee.motif} · rien n'est lettré.` };
        const lignes = await tx.ligneEcriture.findMany({ where: { id: { in: ligneIds } }, include: { ecriture: true } });
        const prise = lignes.find((l) => l.lettrageId !== null);
        if (prise)
            return { motif: `Une des lignes est déjà lettrée (${prise.lettre ?? 'groupe partiel'}) · rien n'est lettré.` };
        this.verifierLignes(lignes, { compteId, tenantId, nombre: ligneIds.length });
        const solde = lignes.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
        if (Math.abs(solde) > EPSILON)
            return { motif: `Les lignes ne soldent pas (écart de ${solde.toFixed(2)}) · rien n'est lettré.` };
        const groupe = await this.creerGroupe(tx, { tenantId, compteId, ligneIds, origine: client_1.OrigineLettrage.MODULE, userId });
        return { code: groupe.code };
    }
    async defaireLettrageDuModule(tx, tenantId, lettrageId) {
        const groupe = await tx.lettrage.findFirst({ where: { id: lettrageId, tenantId } });
        if (!groupe)
            return;
        if (groupe.origine !== client_1.OrigineLettrage.MODULE) {
            throw new common_1.BadRequestException(`Le lettrage ${groupe.code} n'a pas été posé par le module · délettrez-le dans « Lettrage » avant de défaire le mouvement.`);
        }
        if (groupe.verrouille) {
            throw new common_1.BadRequestException(`Le lettrage ${groupe.code} est verrouillé · déverrouillez-le avant de défaire le mouvement.`);
        }
        const duGroupe = await tx.ligneEcriture.findMany({ where: { lettrageId: groupe.id }, select: { id: true } });
        await (0, gel_cloture_1.refuserSiLignesFigees)(tx, tenantId, duGroupe.map((l) => l.id), 'défaire le lettrage de la créance');
        await tx.ligneEcriture.updateMany({ where: { lettrageId: groupe.id }, data: { lettre: null, lettrageId: null } });
        await tx.lettrage.delete({ where: { id: groupe.id } });
    }
};
exports.LettrageService = LettrageService;
exports.LettrageService = LettrageService = LettrageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LettrageService);
//# sourceMappingURL=lettrage.service.js.map