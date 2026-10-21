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
exports.ComptabilisationFactureService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const ecriture_facture_1 = require("./ecriture-facture");
const date_reception_1 = require("./date-reception");
const echeance_1 = require("../../common/echeance");
const routage_tva_1 = require("../tva/routage-tva");
let ComptabilisationFactureService = class ComptabilisationFactureService {
    constructor(prisma, ecritures) {
        this.prisma = prisma;
        this.ecritures = ecritures;
    }
    async comptabiliser(tenantId, userId, factureId, d) {
        const f = await this.prisma.facture.findFirst({
            where: { id: factureId, tenantId },
            include: {
                lignes: { orderBy: { ordre: 'asc' }, include: { tauxTva: { select: { tenantId: true, taux: true, compteCollecteId: true, compteDeductibleId: true } } } },
                tiers: { select: { comptesRattaches: { where: { estPrincipal: true }, select: { compteId: true }, take: 1 } } },
            },
        });
        if (!f)
            throw new common_1.NotFoundException('Facture introuvable dans ce dossier.');
        if (f.ecritureId)
            throw new common_1.BadRequestException('Cette facture est déjà liée à une écriture · elle ne se passe pas deux fois.');
        if (f.lignes.some((l) => l.tauxTva && l.tauxTva.tenantId !== tenantId)) {
            throw new common_1.NotFoundException('Taux de taxe introuvable dans ce dossier.');
        }
        const journal = await this.prisma.journal.findFirst({ where: { id: d.journalId, tenantId }, select: { type: true } });
        const typeAttendu = f.sens === client_1.SensFacture.VENTE ? client_1.TypeJournal.VENTES : client_1.TypeJournal.ACHATS;
        if (!journal)
            throw new common_1.NotFoundException('Journal introuvable dans ce dossier.');
        if (journal.type !== typeAttendu) {
            throw new common_1.BadRequestException(`Une facture ${f.sens === client_1.SensFacture.VENTE ? 'de vente' : 'd’achat'} se passe dans un journal ${f.sens === client_1.SensFacture.VENTE ? 'de ventes' : 'd’achats'}.`);
        }
        const choisis = [d.compteGestionId, ...Object.values(d.comptesParLigne ?? {})].filter((x) => !!x);
        const comptes = await this.prisma.compte.findMany({ where: { id: { in: choisis }, tenantId }, select: { id: true, numero: true } });
        for (const id of choisis) {
            const c = comptes.find((x) => x.id === id);
            if (!c)
                throw new common_1.NotFoundException('Compte introuvable dans ce dossier.');
            const ok = f.sens === client_1.SensFacture.VENTE ? c.numero.startsWith('7') : c.numero.startsWith('6') || c.numero.startsWith('2');
            if (!ok) {
                throw new common_1.BadRequestException(`Le compte ${c.numero} n’est pas ${f.sens === client_1.SensFacture.VENTE ? 'un compte de produit (classe 7)' : 'un compte de charge (classe 6) ni d’immobilisation (classe 2)'}.`);
            }
        }
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        const sensTva = f.sens === client_1.SensFacture.VENTE ? 'recette' : 'depense';
        const numeroDe = new Map(comptes.map((c) => [c.id, c.numero]));
        const candidats = [
            ...new Set(f.lignes
                .map((l) => numeroDe.get(d.comptesParLigne?.[l.id] ?? d.compteGestionId ?? ''))
                .filter((n) => !!n)
                .map((n) => (sensTva === 'recette' ? (0, routage_tva_1.compteTvaCollectee)(n) : (0, routage_tva_1.compteTvaRecuperable)(n)))
                .filter((n) => !!n)),
        ];
        const ouverts = candidats.length
            ? await this.prisma.compte.findMany({ where: { tenantId, numero: { in: candidats } }, select: { id: true, numero: true } })
            : [];
        const idDuNumero = new Map(ouverts.map((c) => [c.numero, c.id]));
        const numerosDuPlan = new Set(ouverts.map((c) => c.numero));
        const compteTvaDe = (l) => {
            const gestion = numeroDe.get(d.comptesParLigne?.[l.id] ?? d.compteGestionId ?? '');
            const route = gestion ? (0, routage_tva_1.compteTvaPourContrepartie)(referentiel, sensTva, gestion, numerosDuPlan) : null;
            return (route ? idDuNumero.get(route) : undefined) ?? (f.sens === client_1.SensFacture.VENTE ? l.tauxTva?.compteCollecteId : l.tauxTva?.compteDeductibleId) ?? null;
        };
        const p = (0, ecriture_facture_1.ecritureDeFacture)({
            sens: f.sens,
            nature: f.nature,
            numeroSerie: f.numeroSerie,
            dateFacture: f.dateFacture,
            contrepartieNom: f.sens === client_1.SensFacture.ACHAT ? f.emetteurNom : f.contrepartieNom,
            compteTiersId: f.tiers?.comptesRattaches[0]?.compteId ?? null,
            autresImpotsEtTaxes: f.autresImpotsEtTaxes === null ? null : Number(f.autresImpotsEtTaxes),
            lignes: f.lignes.map((l) => ({
                designation: l.designation,
                montantHT: Number(l.montantHT),
                montantTva: Number(l.montantTva),
                tauxTvaId: l.tauxTvaId,
                compteTvaId: compteTvaDe(l),
                tauxZero: l.imposable && l.tauxTva !== null && (0, routage_tva_1.estTauxZero)(Number(l.tauxTva.taux)),
                compteGestionId: d.comptesParLigne?.[l.id] ?? null,
            })),
        }, d.compteGestionId);
        if ('refus' in p)
            throw new common_1.BadRequestException(p.refus);
        const declaree = d.dateReception ? new Date(d.dateReception) : null;
        if (declaree && Number.isNaN(declaree.getTime()))
            throw new common_1.BadRequestException('Date de réception illisible.');
        if (declaree && f.dateReception && declaree.toISOString().slice(0, 10) !== f.dateReception.toISOString().slice(0, 10)) {
            throw new common_1.BadRequestException(`La facture porte déjà sa date de réception (${f.dateReception.toISOString().slice(0, 10)}) · elle ne se change pas au passage de l’écriture.`);
        }
        const nouvelleReception = declaree && !f.dateReception ? declaree : null;
        const piece = { sens: f.sens, dateFacture: f.dateFacture, dateReception: f.dateReception ?? nouvelleReception };
        const motif = (0, date_reception_1.motifRefusDateReception)(piece, (0, echeance_1.jourDeKinshasa)(new Date()));
        if (motif)
            throw new common_1.BadRequestException(motif);
        const valeur = (0, date_reception_1.dateDeValeurComptable)(piece);
        if ('refus' in valeur)
            throw new common_1.BadRequestException(valeur.refus);
        const date = valeur.date.toISOString().slice(0, 10);
        const exercice = await this.prisma.exercice.findFirst({
            where: { tenantId, dateDebut: { lte: valeur.date }, dateFin: { gte: valeur.date } },
            select: { id: true },
        });
        if (!exercice) {
            throw new common_1.BadRequestException(`Aucun exercice ne couvre le ${date}, ${f.sens === client_1.SensFacture.VENTE ? 'date de la facture' : 'date de réception de la facture'}.`);
        }
        const exerciceDeLaFacture = valeur.date.getTime() === f.dateFacture.getTime()
            ? null
            : await this.prisma.exercice.findFirst({
                where: { tenantId, dateDebut: { lte: f.dateFacture }, dateFin: { gte: f.dateFacture } },
                select: { dateDebut: true, dateFin: true },
            });
        const avertissement = (0, date_reception_1.avertissementExerciceDeLaFacture)(f.dateFacture, valeur.date, exerciceDeLaFacture);
        const e = (await this.ecritures.creer(tenantId, userId, {
            exerciceId: exercice.id,
            journalId: d.journalId,
            date,
            libelle: p.libelle,
            reference: f.numeroSerie,
            lignes: p.lignes,
        }));
        const { count } = nouvelleReception
            ? await this.prisma.facture.updateMany({
                where: { id: f.id, tenantId, ecritureId: null, dateReception: null },
                data: { ecritureId: e.id, dateReception: nouvelleReception },
            })
            : await this.prisma.facture.updateMany({ where: { id: f.id, tenantId, ecritureId: null }, data: { ecritureId: e.id } });
        if (count === 0) {
            await this.ecritures.retirerCompensation(tenantId, e.id);
            throw new common_1.BadRequestException('Cette facture vient d’être liée à une autre écriture · rien n’a été passé.');
        }
        return { ecritureId: e.id, lignes: p.lignes.length, date, ...(avertissement ? { avertissement } : {}) };
    }
};
exports.ComptabilisationFactureService = ComptabilisationFactureService;
exports.ComptabilisationFactureService = ComptabilisationFactureService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], ComptabilisationFactureService);
//# sourceMappingURL=comptabilisation-facture.service.js.map