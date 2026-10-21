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
exports.CumulService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const lecture_fichier_1 = require("../import/lecture-fichier");
const cumul_consolidation_1 = require("./cumul-consolidation");
const perimetre_service_1 = require("./perimetre.service");
const exercice_requis_1 = require("../../common/exercice-requis");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const n = (v) => (v == null ? null : Number(v));
const diff = (d, c) => (d === null || c === null ? null : d - c);
function colonne(colonnes, motif) {
    return colonnes.findIndex((c) => motif.test(c
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()));
}
let CumulService = class CumulService {
    constructor(prisma, ecritures, perimetre) {
        this.prisma = prisma;
        this.ecritures = ecritures;
        this.perimetre = perimetre;
    }
    async entite(tenantId, id) {
        const e = await this.prisma.entitePerimetreConsolidation.findFirst({ where: { id, tenantId } });
        if (!e)
            throw new common_1.NotFoundException('Entité introuvable dans ce dossier.');
        return e;
    }
    async exerciceDuDossier(tenantId, exerciceId) {
        (0, exercice_requis_1.exigerExercice)(exerciceId);
        const ex = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true } });
        if (!ex)
            throw new common_1.NotFoundException('Exercice introuvable dans ce dossier.');
        return ex;
    }
    async entiteDeLExercice(tenantId, exerciceId, id) {
        const e = await this.prisma.entitePerimetreConsolidation.findFirst({
            where: { id, tenantId },
            select: { id: true, nom: true, exerciceId: true },
        });
        if (!e)
            throw new common_1.NotFoundException('Entité introuvable dans ce dossier.');
        if (e.exerciceId !== exerciceId) {
            throw new common_1.BadRequestException(`« ${e.nom} » figure au périmètre d’un autre exercice · le périmètre se déclare par exercice, et une déclaration ` +
                'ne vise que les entités du périmètre de SON exercice.');
        }
        return e;
    }
    async importerBalance(tenantId, entiteId, dto) {
        await this.entite(tenantId, entiteId);
        const tableau = await (0, lecture_fichier_1.lireFichier)(dto.nomFichier, dto.contenuBase64);
        const iNum = colonne(tableau.colonnes, /num|compte|code/);
        const iInt = colonne(tableau.colonnes, /intitul|libell/);
        const norm = tableau.colonnes.map((c) => c
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase());
        const trouver = (sens, qualif) => norm.findIndex((c) => sens.test(c) && (qualif ? qualif.test(c) : !/mouvement|solde|report|ouverture|nouveau/.test(c)));
        const iMvtDeb = trouver(/debit/, /mouvement/);
        const iMvtCre = trouver(/credit/, /mouvement/);
        const iSolDeb = trouver(/debit/, /solde/);
        const iSolCre = trouver(/credit/, /solde/);
        const iRepDeb = trouver(/debit/, /report|ouverture|nouveau/);
        const iRepCre = trouver(/credit/, /report|ouverture|nouveau/);
        const iDeb = trouver(/debit/, null);
        const iCre = trouver(/credit/, null);
        const avecMouvements = iMvtDeb >= 0 && iMvtCre >= 0;
        const lireSolde = iSolDeb >= 0 && iSolCre >= 0
            ? (l) => diff((0, lecture_fichier_1.lireMontant)(l[iSolDeb] ?? ''), (0, lecture_fichier_1.lireMontant)(l[iSolCre] ?? ''))
            : iDeb >= 0 && iCre >= 0
                ? (l) => diff((0, lecture_fichier_1.lireMontant)(l[iDeb] ?? ''), (0, lecture_fichier_1.lireMontant)(l[iCre] ?? ''))
                : avecMouvements && iRepDeb >= 0 && iRepCre >= 0
                    ? (l) => {
                        const r = diff((0, lecture_fichier_1.lireMontant)(l[iRepDeb] ?? ''), (0, lecture_fichier_1.lireMontant)(l[iRepCre] ?? ''));
                        const m = diff((0, lecture_fichier_1.lireMontant)(l[iMvtDeb] ?? ''), (0, lecture_fichier_1.lireMontant)(l[iMvtCre] ?? ''));
                        return r === null || m === null ? null : r + m;
                    }
                    : null;
        if (iNum < 0 || !lireSolde) {
            throw new common_1.BadRequestException('Le fichier ne suit pas le canevas de la balance agrégée · il faut au moins les colonnes Numéro, Débit et Crédit, ' +
                'ou une balance à six colonnes (report, mouvements, solde).');
        }
        const soldes = new Map();
        const anomalies = [];
        tableau.lignes.forEach((l, i) => {
            const numero = (l[iNum] ?? '').trim();
            if (!numero)
                return;
            if (!/^\d+$/.test(numero))
                return void anomalies.push(`ligne ${i + 2} · numéro de compte illisible « ${numero} »`);
            if (numero.startsWith('9'))
                return void anomalies.push(`ligne ${i + 2} · compte ${numero} de classe 9, hors balance générale`);
            const solde = lireSolde(l);
            const md = avecMouvements ? (0, lecture_fichier_1.lireMontant)(l[iMvtDeb] ?? '') : 0;
            const mc = avecMouvements ? (0, lecture_fichier_1.lireMontant)(l[iMvtCre] ?? '') : 0;
            if (solde === null || md === null || mc === null)
                return void anomalies.push(`ligne ${i + 2} · montant illisible sur le compte ${numero}`);
            if (solde === 0 && md === 0 && mc === 0)
                return;
            if (avecMouvements && iRepDeb >= 0 && iRepCre >= 0 && (iSolDeb >= 0 || iDeb >= 0)) {
                const r = diff((0, lecture_fichier_1.lireMontant)(l[iRepDeb] ?? ''), (0, lecture_fichier_1.lireMontant)(l[iRepCre] ?? ''));
                if (r !== null && Math.abs(r + md - mc - solde) > 0.005) {
                    return void anomalies.push(`ligne ${i + 2} · sur le compte ${numero}, report + mouvements ne donnent pas le solde`);
                }
            }
            const prec = soldes.get(numero);
            soldes.set(numero, {
                intitule: prec?.intitule || (iInt >= 0 ? (l[iInt] ?? '').trim() : '') || numero,
                solde: Math.round(((prec?.solde ?? 0) + solde) * 100) / 100,
                mouvementDebit: avecMouvements ? Math.round(((prec?.mouvementDebit ?? 0) + md) * 100) / 100 : null,
                mouvementCredit: avecMouvements ? Math.round(((prec?.mouvementCredit ?? 0) + mc) * 100) / 100 : null,
            });
        });
        if (anomalies.length > 0) {
            throw new common_1.BadRequestException(`Balance refusée, rien n’est enregistré · ${anomalies.slice(0, 10).join(' ; ')}.`);
        }
        const ecart = Math.round([...soldes.values()].reduce((s, l) => s + l.solde, 0) * 100) / 100;
        if (Math.abs(ecart) > 0.005) {
            throw new common_1.BadRequestException(`La balance n’est pas équilibrée (écart de ${ecart}) · rien n’est enregistré.`);
        }
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.ligneBalanceConsolidation.deleteMany({ where: { tenantId, entiteId } });
            await tx.ligneBalanceConsolidation.createMany({
                data: [...soldes.entries()].map(([numero, l]) => ({
                    tenantId,
                    entiteId,
                    numero,
                    intitule: l.intitule,
                    solde: l.solde,
                    mouvementDebit: l.mouvementDebit,
                    mouvementCredit: l.mouvementCredit,
                })),
            });
            await tx.entitePerimetreConsolidation.update({
                where: { id: entiteId },
                data: { balanceImporteeLe: new Date(), fichierBalance: dto.nomFichier },
            });
        });
        return { lignes: soldes.size, avecMouvements };
    }
    async declarerAcquisition(tenantId, lienId, dto) {
        const lien = await this.prisma.lienParticipationConsolidation.findFirst({ where: { id: lienId, tenantId }, select: { id: true } });
        if (!lien)
            throw new common_1.NotFoundException('Participation introuvable dans ce dossier.');
        if (dto.modeDureeEcart === 'LIMITEE' && !dto.dureeEcartAnnees) {
            throw new common_1.BadRequestException('Une durée d’utilité limitée se déclare avec sa durée · sinon, choisissez « non déterminable » (dix ans).');
        }
        if ((dto.dividendesExercice ?? 0) > 0 && !dto.compteDividendes) {
            throw new common_1.BadRequestException('Des dividendes se déclarent avec le compte qui les porte chez la détentrice.');
        }
        return this.prisma.lienParticipationConsolidation.update({
            where: { id: lienId },
            data: {
                coutAcquisition: dto.coutAcquisition,
                compteTitres: dto.compteTitres,
                dateEntree: new Date(dto.dateEntree),
                capitauxPropresEntree: dto.capitauxPropresEntree,
                modeDureeEcart: dto.modeDureeEcart,
                dureeEcartAnnees: dto.modeDureeEcart === 'LIMITEE' ? dto.dureeEcartAnnees : null,
                depreciationEcartOuverture: dto.depreciationEcartOuverture ?? 0,
                depreciationEcartCloture: dto.depreciationEcartCloture ?? 0,
                dividendesExercice: dto.dividendesExercice ?? null,
                compteDividendes: dto.compteDividendes ?? null,
                obligationNonDesengagement: dto.obligationNonDesengagement ?? false,
            },
        });
    }
    async ajouterReciproque(tenantId, dto) {
        const ex = await this.exerciceDuDossier(tenantId, dto.exerciceId);
        for (const id of [dto.entiteAId, dto.entiteBId])
            if (id)
                await this.entiteDeLExercice(tenantId, ex.id, id);
        if ((dto.entiteAId ?? null) === (dto.entiteBId ?? null)) {
            throw new common_1.BadRequestException('Une opération réciproque relie deux entités DIFFÉRENTES du périmètre.');
        }
        return this.prisma.operationReciproqueConsolidation.create({
            data: {
                tenantId,
                exerciceId: ex.id,
                entiteAId: dto.entiteAId ?? null,
                compteA: dto.compteA,
                entiteBId: dto.entiteBId ?? null,
                compteB: dto.compteB,
                montant: dto.montant,
                libelle: dto.libelle.trim(),
            },
        });
    }
    async ajouterResultatInterne(tenantId, dto) {
        const ex = await this.exerciceDuDossier(tenantId, dto.exerciceId);
        for (const id of [dto.vendeuseId, dto.acheteuseId])
            if (id)
                await this.entiteDeLExercice(tenantId, ex.id, id);
        if ((dto.vendeuseId ?? null) === (dto.acheteuseId ?? null)) {
            throw new common_1.BadRequestException('Un résultat interne relie une vendeuse et une acheteuse DIFFÉRENTES du périmètre.');
        }
        const classe = dto.nature === 'STOCK' ? '3' : '2';
        if (!dto.compteActif.startsWith(classe)) {
            throw new common_1.BadRequestException(`${dto.nature === 'STOCK' ? 'Un stock' : 'Une immobilisation'} s’inscrit en classe ${classe}.`);
        }
        return this.prisma.resultatInterneConsolidation.create({
            data: {
                tenantId,
                exerciceId: ex.id,
                vendeuseId: dto.vendeuseId ?? null,
                acheteuseId: dto.acheteuseId ?? null,
                nature: dto.nature,
                compteActif: dto.compteActif,
                margeOuverture: dto.margeOuverture,
                margeCloture: dto.margeCloture,
                libelle: dto.libelle.trim(),
            },
        });
    }
    async supprimerResultatInterne(tenantId, id) {
        const o = await this.prisma.resultatInterneConsolidation.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!o)
            throw new common_1.NotFoundException('Résultat interne introuvable dans ce dossier.');
        await this.prisma.resultatInterneConsolidation.delete({ where: { id } });
        return { supprime: true };
    }
    async ajouterEcartEvaluation(tenantId, lienId, dto) {
        const lien = await this.prisma.lienParticipationConsolidation.findFirst({
            where: { id: lienId, tenantId },
            select: { id: true, exerciceId: true, dateEntree: true },
        });
        if (!lien)
            throw new common_1.NotFoundException('Participation introuvable dans ce dossier.');
        const ev = {
            compte: dto.compte.trim(),
            compteAmortissement: dto.compteAmortissement?.trim() || null,
            libelle: dto.libelle.trim(),
            montant: dto.montant,
            mode: dto.mode,
            dureeAnnees: dto.dureeAnnees ?? null,
            dateRealisation: dto.dateRealisation ? new Date(dto.dateRealisation) : null,
        };
        const refus = (0, cumul_consolidation_1.motifRefusEcartEvaluation)(ev, lien.dateEntree);
        if (refus)
            throw new common_1.BadRequestException(refus);
        return this.prisma.ecartEvaluationConsolidation.create({
            data: { tenantId, exerciceId: lien.exerciceId, lienId: lien.id, ...ev },
        });
    }
    async supprimerEcartEvaluation(tenantId, id) {
        const o = await this.prisma.ecartEvaluationConsolidation.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!o)
            throw new common_1.NotFoundException('Écart d’évaluation introuvable dans ce dossier.');
        await this.prisma.ecartEvaluationConsolidation.delete({ where: { id } });
        return { supprime: true };
    }
    async ajouterProvisionChange(tenantId, dto) {
        const ex = await this.exerciceDuDossier(tenantId, dto.exerciceId);
        if (dto.entiteId)
            await this.entiteDeLExercice(tenantId, ex.id, dto.entiteId);
        const compte = dto.compteProvision.trim();
        if (!cumul_consolidation_1.FAMILLES_PROVISION_CHANGE.some((f) => compte.startsWith(f.provision))) {
            throw new common_1.BadRequestException('La provision pour pertes de change se loge au 194, au 4991 ou au 4997 (AUDCIF Titre VIII ch. 22 § 2.3).');
        }
        if (dto.cloture - dto.dotation + dto.reprise < -0.005) {
            throw new common_1.BadRequestException('Clôture − dotation + reprise donne une provision d’ouverture négative · vérifiez les trois montants.');
        }
        return this.prisma.provisionChangeConsolidation.create({
            data: { tenantId, exerciceId: ex.id, entiteId: dto.entiteId ?? null, compteProvision: compte, cloture: dto.cloture, dotation: dto.dotation, reprise: dto.reprise },
        });
    }
    async supprimerProvisionChange(tenantId, id) {
        const o = await this.prisma.provisionChangeConsolidation.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!o)
            throw new common_1.NotFoundException('Provision introuvable dans ce dossier.');
        await this.prisma.provisionChangeConsolidation.delete({ where: { id } });
        return { supprime: true };
    }
    async enregistrerFiscalite(tenantId, dto) {
        const ex = await this.exerciceDuDossier(tenantId, dto.exerciceId);
        if (dto.tauxImpotDiffere != null && !dto.sourceTauxImpot?.trim()) {
            throw new common_1.BadRequestException('Le taux d’impôt se déclare AVEC sa source · c’est celui « en vigueur à la clôture » (D4C ch. XII-3 § 3), et OmegaX n’en écrit aucun.');
        }
        if (((dto.idaOuverture ?? 0) > 0 || (dto.idaCloture ?? 0) > 0) && !dto.justificationIda?.trim()) {
            throw new common_1.BadRequestException('Un impôt différé actif n’est comptabilisé que s’il est probable qu’un bénéfice imposable permettra de l’imputer (D4C ch. XII-3 § 3) · écrivez pourquoi.');
        }
        const data = {
            tauxImpotDiffere: dto.tauxImpotDiffere ?? null,
            sourceTauxImpot: dto.sourceTauxImpot?.trim() || null,
            idaOuverture: dto.idaOuverture ?? null,
            idaCloture: dto.idaCloture ?? null,
            idpOuverture: dto.idpOuverture ?? null,
            idpCloture: dto.idpCloture ?? null,
            justificationIda: dto.justificationIda?.trim() || null,
            ecartConversionActifN1: dto.ecartConversionActifN1 ?? null,
            ecartConversionPassifN1: dto.ecartConversionPassifN1 ?? null,
        };
        if (dto.entiteId) {
            const e = await this.entiteDeLExercice(tenantId, ex.id, dto.entiteId);
            return this.prisma.entitePerimetreConsolidation.update({ where: { id: e.id }, data });
        }
        const faits = await this.prisma.faitsConsolidationExercice.findFirst({ where: { tenantId, exerciceId: ex.id }, select: { id: true } });
        return faits
            ? this.prisma.faitsConsolidationExercice.update({ where: { id: faits.id }, data })
            : this.prisma.faitsConsolidationExercice.create({ data: { tenantId, exerciceId: ex.id, ...data } });
    }
    async enregistrerMonnaie(tenantId, entiteId, dto) {
        const e = await this.prisma.entitePerimetreConsolidation.findFirst({ where: { id: entiteId, tenantId }, select: { id: true } });
        if (!e)
            throw new common_1.NotFoundException('Entité introuvable dans ce dossier.');
        const { presentation } = await this.monnaiePresentation(tenantId);
        const monnaie = dto.monnaieBalance?.trim().toUpperCase() || null;
        if (monnaie && monnaie !== presentation && !dto.justificationMonnaie?.trim()) {
            throw new common_1.BadRequestException(`Une balance en ${monnaie} quand les états sont présentés en ${presentation} · dites ce qui en fait la monnaie FONCTIONNELLE de l’entité ` +
                '(monnaie des prix de vente, des coûts, du financement, D4C ch. XII-4 § 1). Une comptabilité tenue dans une autre monnaie se convertit ' +
                'd’abord par la méthode temporelle (§ 2), avant l’import.');
        }
        for (const [k, v] of [['cours de clôture', dto.coursCloture], ['cours des charges et produits', dto.coursProduitsCharges], ['cours d’entrée', dto.coursEntree]]) {
            if (v != null && !(v > 0))
                throw new common_1.BadRequestException(`Le ${k} se déclare strictement positif.`);
        }
        return this.prisma.entitePerimetreConsolidation.update({
            where: { id: e.id },
            data: {
                monnaieBalance: monnaie,
                justificationMonnaie: dto.justificationMonnaie?.trim() || null,
                hyperinflation: dto.hyperinflation ?? false,
                coursCloture: dto.coursCloture ?? null,
                coursProduitsCharges: dto.coursProduitsCharges ?? null,
                coursEntree: dto.coursEntree ?? null,
                capitauxPropresHistoriques: dto.capitauxPropresHistoriques ?? null,
            },
        });
    }
    async monnaiePresentation(tenantId) {
        const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { devise: true, deviseFonctionnelle: true } });
        return {
            presentation: (t.devise ?? 'CDF').trim().toUpperCase(),
            fonctionnelle: t.deviseFonctionnelle?.trim().toUpperCase() || null,
        };
    }
    async supprimerReciproque(tenantId, id) {
        const o = await this.prisma.operationReciproqueConsolidation.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!o)
            throw new common_1.NotFoundException('Opération réciproque introuvable dans ce dossier.');
        await this.prisma.operationReciproqueConsolidation.delete({ where: { id } });
        return { supprime: true };
    }
    async lignesConsolidante(tenantId, exerciceId) {
        return (0, etats_financiers_communs_1.chargerLignes)(this.ecritures, tenantId, exerciceId);
    }
    async cumul(tenantId, exerciceId) {
        const etat = await this.perimetre.etat(tenantId, exerciceId);
        const ex = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { dateDebut: true, dateFin: true } });
        const retenus = etat.resultats.filter((r) => r.estConsolidante || r.methode === 'IG' || r.methode === 'IP' || r.methode === 'ME');
        const idsRetenus = new Set(retenus.map((r) => r.id));
        const consolidanteId = etat.consolidante.id;
        const versMoteur = (id) => id ?? consolidanteId;
        const exclues = new Set(etat.resultats.filter((r) => r.methode === 'EXCLUE').map((r) => r.id));
        for (const l of etat.liens) {
            if (idsRetenus.has(l.detenueId) && l.detentriceId && exclues.has(l.detentriceId)) {
                const nom = (id) => etat.resultats.find((r) => r.id === id)?.nom ?? id;
                throw new common_1.BadRequestException(`« ${nom(l.detenueId)} » est retenue mais détenue par « ${nom(l.detentriceId)} », exclue (art. 96) · aucun texte lu ne dit ` +
                    'comment intégrer une entité dont la détentrice n’est pas consolidée.');
            }
        }
        const liensUtiles = etat.liens.filter((l) => idsRetenus.has(l.detenueId) && idsRetenus.has(versMoteur(l.detentriceId)) && l.detenueId !== consolidanteId);
        const liensBruts = await this.prisma.lienParticipationConsolidation.findMany({ where: { tenantId, exerciceId } });
        const parLien = new Map(liensBruts.map((l) => [l.id, l]));
        const sansAcquisition = liensUtiles.filter((l) => parLien.get(l.id)?.coutAcquisition == null);
        if (sansAcquisition.length > 0) {
            const nom = (id) => etat.resultats.find((r) => r.id === id)?.nom ?? id;
            throw new common_1.BadRequestException('Coût d’acquisition non déclaré pour · ' +
                sansAcquisition.map((l) => `${nom(versMoteur(l.detentriceId))} → ${nom(l.detenueId)}`).join(', ') +
                ' · sans lui, les titres ne se substituent pas et l’écart d’acquisition ne se calcule pas (art. 81 et 82).');
        }
        const lignesImportees = await this.prisma.ligneBalanceConsolidation.findMany({
            where: { tenantId, entiteId: { in: retenus.filter((r) => !r.estConsolidante).map((r) => r.id) } },
        });
        const balanceDossier = await (0, etats_financiers_communs_1.chargerLignes)(this.ecritures, tenantId, exerciceId);
        const entites = retenus.map((r) => {
            const balance = r.estConsolidante
                ? balanceDossier.map((l) => ({
                    numero: l.numero,
                    intitule: l.intitule,
                    solde: Number(l.solde),
                    mouvementDebit: n(l.mouvementDebit),
                    mouvementCredit: n(l.mouvementCredit),
                }))
                : lignesImportees
                    .filter((l) => l.entiteId === r.id)
                    .map((l) => ({
                    numero: l.numero,
                    intitule: l.intitule,
                    solde: Number(l.solde),
                    mouvementDebit: n(l.mouvementDebit),
                    mouvementCredit: n(l.mouvementCredit),
                }));
            return {
                id: r.id,
                nom: r.nom,
                estConsolidante: r.estConsolidante,
                methode: r.estConsolidante ? 'IG' : r.methode,
                pctInteret: r.pctInteret,
                balance: balance.length > 0 ? balance : null,
            };
        });
        const ecartsStockes = await this.prisma.ecartEvaluationConsolidation.findMany({ where: { tenantId, exerciceId } });
        const acquisitions = liensUtiles.map((l) => {
            const b = parLien.get(l.id);
            return {
                ecartsEvaluation: ecartsStockes
                    .filter((e) => e.lienId === l.id)
                    .map((e) => ({
                    compte: e.compte,
                    compteAmortissement: e.compteAmortissement,
                    libelle: e.libelle,
                    montant: Number(e.montant),
                    mode: e.mode,
                    dureeAnnees: e.dureeAnnees,
                    dateRealisation: e.dateRealisation,
                })),
                detentriceId: versMoteur(l.detentriceId),
                detenueId: l.detenueId,
                pctCapital: Number(b.pctCapital),
                coutAcquisition: n(b.coutAcquisition),
                compteTitres: b.compteTitres ?? '',
                dateEntree: b.dateEntree,
                capitauxPropresEntree: n(b.capitauxPropresEntree),
                modeDureeEcart: b.modeDureeEcart ?? 'NON_DETERMINABLE',
                dureeEcartAnnees: b.dureeEcartAnnees,
                depreciationEcartOuverture: Number(b.depreciationEcartOuverture),
                depreciationEcartCloture: Number(b.depreciationEcartCloture),
                dividendesExercice: b.dividendesExercice == null ? null : Number(b.dividendesExercice),
                compteDividendes: b.compteDividendes,
                obligationNonDesengagement: b.obligationNonDesengagement,
            };
        });
        const operations = await this.prisma.operationReciproqueConsolidation.findMany({ where: { tenantId, exerciceId } });
        const reciproques = operations.map((o) => ({
            entiteAId: versMoteur(o.entiteAId),
            compteA: o.compteA,
            entiteBId: versMoteur(o.entiteBId),
            compteB: o.compteB,
            montant: Number(o.montant),
            libelle: o.libelle,
        }));
        const internes = await this.prisma.resultatInterneConsolidation.findMany({ where: { tenantId, exerciceId } });
        const duPerimetre = new Set(etat.entites.map((e) => e.id));
        const horsPerimetre = (ids) => ids.some((id) => id !== null && !duPerimetre.has(id));
        const egarees = [
            ...operations.filter((o) => horsPerimetre([o.entiteAId, o.entiteBId])).map((o) => `l’opération réciproque « ${o.libelle} »`),
            ...internes.filter((o) => horsPerimetre([o.vendeuseId, o.acheteuseId])).map((o) => `le résultat interne « ${o.libelle} »`),
        ];
        if (egarees.length > 0) {
            const plusieurs = egarees.length > 1;
            throw new common_1.BadRequestException(`Déclaration hors du périmètre · ${egarees.join(', ')} ${plusieurs ? 'visent des entités qui ne figurent' : 'vise une entité qui ne figure'} ` +
                'pas au périmètre de cet exercice, qui se déclare par exercice. Retirez chaque déclaration nommée et saisissez-la de ' +
                'nouveau sur les entités de l’exercice.');
        }
        const resultatsInternes = internes.map((o) => ({
            vendeuseId: versMoteur(o.vendeuseId),
            acheteuseId: versMoteur(o.acheteuseId),
            nature: o.nature,
            compteActif: o.compteActif,
            margeOuverture: Number(o.margeOuverture),
            margeCloture: Number(o.margeCloture),
            libelle: o.libelle,
        }));
        const precedent = await this.prisma.exercice.findFirst({
            where: { tenantId, dateDebut: { lt: ex.dateDebut } },
            orderBy: { dateDebut: 'desc' },
            select: { id: true },
        });
        const tauxN1ParNom = new Map();
        let tauxN1Consolidante = null;
        if (precedent) {
            const [entitesN1, faitsN1] = await Promise.all([
                this.prisma.entitePerimetreConsolidation.findMany({
                    where: { tenantId, exerciceId: precedent.id },
                    select: { nom: true, tauxImpotDiffere: true },
                }),
                this.prisma.faitsConsolidationExercice.findFirst({
                    where: { tenantId, exerciceId: precedent.id },
                    select: { tauxImpotDiffere: true },
                }),
            ]);
            for (const e of entitesN1)
                tauxN1ParNom.set(e.nom, n(e.tauxImpotDiffere));
            tauxN1Consolidante = n(faitsN1?.tauxImpotDiffere);
        }
        const fisc = (id, f, tauxOuverture) => ({
            entiteId: id,
            tauxImpot: n(f?.tauxImpotDiffere),
            tauxImpotOuverture: tauxOuverture,
            idaOuverture: n(f?.idaOuverture),
            idaCloture: n(f?.idaCloture),
            idpOuverture: n(f?.idpOuverture),
            idpCloture: n(f?.idpCloture),
            justificationIda: f?.justificationIda ?? null,
        });
        const fiscalites = [
            fisc(consolidanteId, etat.faits, tauxN1Consolidante),
            ...etat.entites.map((e) => fisc(e.id, e, tauxN1ParNom.get(e.nom) ?? null)),
        ];
        const provisionsChange = await this.prisma.provisionChangeConsolidation.findMany({ where: { tenantId, exerciceId } });
        const declarationConversion = (id, stockId, f) => {
            const actif = n(f?.ecartConversionActifN1);
            const passif = n(f?.ecartConversionPassifN1);
            if (actif === null || passif === null)
                return null;
            return {
                entiteId: id,
                actifN1: actif,
                passifN1: passif,
                provisions: provisionsChange
                    .filter((p) => p.entiteId === stockId)
                    .map((p) => ({ compteProvision: p.compteProvision, cloture: Number(p.cloture), dotation: Number(p.dotation), reprise: Number(p.reprise) })),
            };
        };
        const conversions = [
            declarationConversion(consolidanteId, null, etat.faits),
            ...etat.entites.map((e) => declarationConversion(e.id, e.id, e)),
        ].filter((c) => c !== null);
        const { presentation, fonctionnelle } = await this.monnaiePresentation(tenantId);
        const reserveMonnaie = fonctionnelle && fonctionnelle !== presentation
            ? [
                `Monnaie de présentation (${presentation}) différente de la monnaie fonctionnelle déclarée de la consolidante (${fonctionnelle}) · ` +
                    'à mentionner en Notes annexes consolidées avec sa justification, l’art. 87 imposant l’unité monétaire ayant cours légal (D4C ch. XII-4 § 5).',
            ]
            : [];
        const monnaies = etat.entites.map((e) => ({
            entiteId: e.id,
            monnaie: e.monnaieBalance,
            hyperinflation: e.hyperinflation,
            coursCloture: n(e.coursCloture),
            coursProduitsCharges: n(e.coursProduitsCharges),
            coursEntree: n(e.coursEntree),
            capitauxPropresHistoriques: n(e.capitauxPropresHistoriques),
        }));
        try {
            return {
                ...(0, cumul_consolidation_1.cumulerConsolidation)({ dateDebut: ex.dateDebut, dateFin: ex.dateFin }, entites, acquisitions, reciproques, resultatsInternes, fiscalites, conversions, { presentation, entites: monnaies }),
                reserves: [
                    'Les balances des filiales sont réputées RETRAITÉES aux règles d’évaluation et de présentation du groupe (D4C, ch. XII-3) · OmegaX ne fait pas l’homogénéisation. Les éliminations de nature fiscale, elles, sont jouées ici (ci-dessous).',
                    'Écarts d’évaluation (art. 82, ch. XII-6) · DÉCLARÉS élément par élément, ils passent en priorité et l’écart d’acquisition n’est que le reste. Chacun porte son impôt différé, au taux déclaré de la détenue · jamais l’écart d’acquisition (ch. XII-3 § 3).',
                    'Impôts différés (art. 92) · écarts d’évaluation, marges internes éliminées (au taux de la vendeuse) et impôts différés DÉCLARÉS des comptes individuels. Actif et passif ne sont pas compensés, le D4C n’en disant rien, et aucune actualisation n’est faite (ch. XII-3 § 3).',
                    'Éliminations de nature fiscale (art. 86, 3°, D4C ch. XII-3 § 2) · provisions réglementées (15) contre-passées, l’exercice au résultat (851 et 861) et l’antérieur aux réserves, avec leur impôt différé passif. Écarts de conversion individuels (478, 479) retraités sur DÉCLARATION de la position N-1 et de la provision pour pertes de change · leur impôt différé éventuel se déclare avec ceux de l’entité. Les subventions d’investissement restent sur leur ligne, hors capitaux propres (ch. XII-8 § 2).',
                    'Résultats internes inclus dans les stocks et immobilisations (art. 86, 4°) · éliminés sur DÉCLARATION de la marge, pertes comprises (marge négative, D4C ch. XII-3 § 2), totalement entre entités intégrées globalement, au pourcentage d’intégration de l’entité intégrée proportionnellement, au plus faible des deux entre deux entités intégrées proportionnellement (D4C ch. XII-5 § 5). Sur une immobilisation, la marge est retranchée en valeur nette · brut et amortissements du cédant ne sont pas reconstitués, et l’état le dit. Le texte ne dit pas qui la supporte · OmegaX retraite le résultat de la VENDEUSE, qui se partage à son pourcentage d’intérêt (art. 85, résultat consolidé bâti des éléments du résultat de chaque entité). Une marge d’incidence négligeable peut ne pas être déclarée (art. 86, dernier alinéa).',
                    `Conversion des entités étrangères (art. 87, D4C ch. XII-4 § 3) · méthode du COURS DE CLÔTURE vers la monnaie de présentation (${presentation}), aux cours DÉCLARÉS · actifs et passifs au cours de clôture, charges et produits au cours déclaré pour eux, capitaux propres au cours historique déclaré en montant. L’écart se partage au pourcentage d’intérêt et reste sur sa ligne. La balance importée doit être dans la monnaie FONCTIONNELLE · la méthode temporelle (§ 2) et le retraitement d’une monnaie hyperinflationniste (§ 4) ne sont pas joués. Les montants déclarés ailleurs (coût et capitaux propres d’entrée, marges internes, impôts différés, 478 et 479, opérations réciproques) le sont en monnaie de présentation.`,
                    'Impôts différés au report variable (D4C ch. XII-3 § 3) · l’ouverture est aux réserves au taux de la consolidation N-1, et l’effet d’un changement de taux passe au résultat.',
                    'Changements de méthodes comptables (D4C ch. XII-3 § 2) · en consolidé, leur impact va toujours en report à nouveau, net d’impôt. Celui qu’une entité, consolidante comprise, a passé au résultat de ses comptes individuels n’est pas reclassé par OmegaX · il se retraite dans la balance importée, ou dans les comptes de la consolidante.',
                    'Impositions sur distributions prévues (art. 86, 5°) · la charge d’impôt non récupérable et les réductions d’impôt ne sont pas constatées par OmegaX. Seule une incidence négligeable permet de les omettre (art. 86, dernier alinéa).',
                    ...reserveMonnaie,
                    'Amortissement de l’écart · prorata au mois, du premier jour du mois d’entrée, convention reprise du module des immobilisations · le D4C dit « linéairement » sans fixer de prorata.',
                ],
            };
        }
        catch (e) {
            if (e instanceof cumul_consolidation_1.RefusConsolidation)
                throw new common_1.BadRequestException(e.message);
            throw e;
        }
    }
};
exports.CumulService = CumulService;
exports.CumulService = CumulService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService,
        perimetre_service_1.PerimetreService])
], CumulService);
//# sourceMappingURL=cumul.service.js.map