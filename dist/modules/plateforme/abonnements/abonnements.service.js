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
exports.AbonnementsService = exports.FORMULES_INITIALES = exports.LOT_ABONNEMENTS_A_FACTURER = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../common/prisma.service");
const facturation_service_1 = require("../../facturation/facturation.service");
const plateforme_service_1 = require("../plateforme.service");
const conversion_usd_1 = require("../../personnel/conversion-usd");
const courriels_editeur_service_1 = require("./courriels-editeur.service");
const facturation_abonnements_1 = require("./facturation-abonnements");
const echeance_1 = require("../../../common/echeance");
const lecture_par_lots_1 = require("../../../common/lecture-par-lots");
const plafond_console_1 = require("../plafond-console");
exports.LOT_ABONNEMENTS_A_FACTURER = 500;
exports.FORMULES_INITIALES = [
    { code: 'ESSENTIEL', libelle: 'Essentiel', type: 'FORMULE', contenu: '1 dossier, 2 utilisateurs · tenue, états financiers, notes' },
    { code: 'STANDARD', libelle: 'Standard', type: 'FORMULE', contenu: 'Essentiel + analytique et budgets, paie, TVA, immobilisations · 5 utilisateurs' },
    { code: 'CABINET', libelle: 'Cabinet', type: 'FORMULE', contenu: 'Paquet de dossiers, utilisateurs illimités' },
    { code: 'PAIE', libelle: 'Option paie', type: 'OPTION', contenu: 'La paie en supplément de la formule Essentiel' },
    { code: 'GROUPE', libelle: 'Option groupe', type: 'OPTION', contenu: 'Consolidation et IFRS, en supplément de Standard ou Cabinet' },
    { code: 'DOSSIER_SUPPLEMENTAIRE', libelle: 'Dossier supplémentaire', type: 'OPTION', contenu: 'Au-delà du paquet de la formule Cabinet, prix par dossier' },
];
const aujourdhuiKinshasa = () => (0, echeance_1.jourDeKinshasaIso)(new Date());
const nombre = (d) => (d === null ? null : Number(d));
const jour = (d) => (d ? d.toISOString().slice(0, 10) : null);
let AbonnementsService = class AbonnementsService {
    constructor(prisma, facturation, plateforme, courriels) {
        this.prisma = prisma;
        this.facturation = facturation;
        this.plateforme = plateforme;
        this.courriels = courriels;
    }
    async formules() {
        const n = await this.prisma.formuleAbonnement.count();
        if (n === 0) {
            await this.prisma.formuleAbonnement.createMany({ data: exports.FORMULES_INITIALES, skipDuplicates: true });
        }
        const f = await this.prisma.formuleAbonnement.findMany({ orderBy: [{ type: 'asc' }, { code: 'asc' }] });
        return f.map((x) => ({ ...x, prixMensuelUsd: nombre(x.prixMensuelUsd), prixAnnuelUsd: nombre(x.prixAnnuelUsd) }));
    }
    async fixerPrix(code, prixMensuelUsd, prixAnnuelUsd) {
        for (const p of [prixMensuelUsd, prixAnnuelUsd]) {
            if (p !== null && !(Number.isFinite(p) && p > 0))
                throw new common_1.BadRequestException('Un prix est positif, ou laissé vide tant qu’il n’est pas arrêté.');
        }
        const f = await this.prisma.formuleAbonnement.findUnique({ where: { code }, select: { id: true } });
        if (!f)
            throw new common_1.NotFoundException('Formule introuvable.');
        await this.prisma.formuleAbonnement.update({
            where: { code },
            data: {
                prixMensuelUsd: prixMensuelUsd === null ? null : new client_1.Prisma.Decimal(prixMensuelUsd),
                prixAnnuelUsd: prixAnnuelUsd === null ? null : new client_1.Prisma.Decimal(prixAnnuelUsd),
            },
        });
        return this.formules();
    }
    async dossierEditeur() {
        const id = await this.plateforme.dossierEditeurId();
        if (!id)
            throw new common_1.BadRequestException('Aucun dossier n’est désigné comme dossier de l’éditeur · les factures d’abonnement n’ont nulle part où naître.');
        return id;
    }
    async lister() {
        const [a, total] = await Promise.all([
            this.prisma.abonnementCabinet.findMany({
                orderBy: { createdAt: 'asc' },
                take: plafond_console_1.PLAFOND_LISTE_CONSOLE,
                include: {
                    cabinet: { select: { nom: true, licence: { select: { dateExpiration: true, statut: true } } } },
                    formule: { select: { code: true, libelle: true } },
                    options: { select: { formule: { select: { code: true, libelle: true } } } },
                    tiers: { select: { nom: true } },
                    factures: {
                        orderBy: { periode: 'desc' },
                        take: 24,
                        select: { id: true, periode: true, montantUsd: true, payeeLe: true, facture: { select: { numeroSerie: true, dateFacture: true } } },
                    },
                },
            }),
            this.prisma.abonnementCabinet.count(),
        ]);
        const abonnements = a.map((x) => ({
            id: x.id,
            cabinetId: x.cabinetId,
            cabinet: x.cabinet.nom,
            formule: x.formule,
            options: x.options.map((o) => o.formule),
            dossiersSupplementaires: x.dossiersSupplementaires,
            periodicite: x.periodicite,
            debut: jour(x.debut),
            finEssai: jour(x.finEssai),
            tiers: x.tiers.nom,
            actif: x.actif,
            echeanceLicence: jour(x.cabinet.licence?.dateExpiration ?? null),
            licenceSuspendue: x.cabinet.licence?.statut === 'SUSPENDUE',
            factures: x.factures.map((f) => ({
                id: f.id,
                periode: f.periode,
                montantUsd: Number(f.montantUsd),
                numero: f.facture.numeroSerie,
                emiseLe: jour(f.facture.dateFacture),
                payeeLe: jour(f.payeeLe),
                joursImpayee: f.payeeLe ? null : (0, facturation_abonnements_1.joursDepuis)(jour(f.facture.dateFacture), aujourdhuiKinshasa()),
            })),
        }));
        return { abonnements, ...(0, plafond_console_1.tranche)(abonnements.length, total) };
    }
    async enregistrer(d) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d.debut))
            throw new common_1.BadRequestException('Date de début illisible.');
        if (!Number.isInteger(d.dossiersSupplementaires) || d.dossiersSupplementaires < 0) {
            throw new common_1.BadRequestException('Le nombre de dossiers supplémentaires est un entier positif ou nul.');
        }
        const editeur = await this.dossierEditeur();
        if (d.cabinetId === editeur)
            throw new common_1.BadRequestException('Le dossier de l’éditeur ne s’abonne pas à lui-même.');
        const cabinet = await this.prisma.tenant.findUnique({ where: { id: d.cabinetId }, select: { id: true } });
        if (!cabinet)
            throw new common_1.NotFoundException('Cabinet introuvable.');
        const tiers = await this.prisma.tiers.findFirst({ where: { id: d.tiersId, tenantId: editeur }, select: { id: true } });
        if (!tiers)
            throw new common_1.BadRequestException('Le client facturé doit être un tiers du dossier de l’éditeur.');
        const formule = await this.prisma.formuleAbonnement.findUnique({ where: { code: d.formuleCode } });
        if (!formule || formule.type !== 'FORMULE')
            throw new common_1.BadRequestException('Formule introuvable.');
        const options = await this.prisma.formuleAbonnement.findMany({ where: { code: { in: d.options } } });
        if (options.length !== new Set(d.options).size || options.some((o) => o.type !== 'OPTION')) {
            throw new common_1.BadRequestException('Une option demandée n’existe pas.');
        }
        const data = {
            formuleId: formule.id,
            dossiersSupplementaires: d.dossiersSupplementaires,
            periodicite: d.periodicite,
            debut: new Date(`${d.debut}T00:00:00Z`),
            finEssai: d.essai ? new Date(`${(0, facturation_abonnements_1.finEssaiDepuis)(d.debut)}T00:00:00Z`) : null,
            tiersId: d.tiersId,
        };
        await this.plateforme.echeanceAbonnement(d.cabinetId, (0, facturation_abonnements_1.expirationInitiale)(d.debut, data.finEssai ? (0, facturation_abonnements_1.finEssaiDepuis)(d.debut) : null));
        const existant = await this.prisma.abonnementCabinet.findUnique({ where: { cabinetId: d.cabinetId }, select: { id: true } });
        const a = existant
            ? await this.prisma.abonnementCabinet.update({ where: { id: existant.id }, data })
            : await this.prisma.abonnementCabinet.create({ data: { ...data, cabinetId: d.cabinetId } });
        await this.prisma.optionAbonnement.deleteMany({ where: { abonnementId: a.id } });
        if (options.length) {
            await this.prisma.optionAbonnement.createMany({ data: options.map((o) => ({ abonnementId: a.id, formuleId: o.id })) });
        }
        return { id: a.id };
    }
    async marquerPayee(factureAbonnementId, payeeLe) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(payeeLe))
            throw new common_1.BadRequestException('Date d’encaissement illisible.');
        const fa = await this.prisma.factureAbonnement.findUnique({
            where: { id: factureAbonnementId },
            select: { id: true, periode: true, payeeLe: true, facture: { select: { dateFacture: true } }, abonnement: { select: { cabinetId: true, periodicite: true, cabinet: { select: { licence: { select: { dateExpiration: true } } } } } } },
        });
        if (!fa)
            throw new common_1.NotFoundException('Facture d’abonnement introuvable.');
        if (fa.payeeLe)
            throw new common_1.BadRequestException(`Cette facture est déjà déclarée payée le ${jour(fa.payeeLe)}.`);
        if (payeeLe > aujourdhuiKinshasa())
            throw new common_1.BadRequestException('Un encaissement ne se déclare pas dans le futur.');
        if (payeeLe < jour(fa.facture.dateFacture))
            throw new common_1.BadRequestException('L’encaissement ne peut précéder la facture.');
        const echeance = (0, facturation_abonnements_1.expirationApresPaiement)(fa.periode, fa.abonnement.periodicite, jour(fa.abonnement.cabinet.licence?.dateExpiration ?? null));
        const { count } = await this.prisma.factureAbonnement.updateMany({ where: { id: fa.id, payeeLe: null }, data: { payeeLe: new Date(`${payeeLe}T00:00:00Z`) } });
        if (count === 0)
            throw new common_1.BadRequestException('Cette facture vient d’être déclarée payée.');
        const retenue = await this.plateforme.echeanceAbonnement(fa.abonnement.cabinetId, echeance);
        return { echeanceLicence: retenue };
    }
    async activer(id, actif) {
        await this.prisma.abonnementCabinet.update({ where: { id }, data: { actif } });
        return { id, actif };
    }
    async facturer(operateurTenantId, periode, dateFacture, tauxTvaId, envoi = null) {
        const editeur = await this.dossierEditeur();
        if (operateurTenantId !== editeur) {
            throw new common_1.BadRequestException('Connectez-vous au dossier de l’éditeur pour facturer les abonnements.');
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFacture))
            throw new common_1.BadRequestException('Date de facture illisible.');
        const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: editeur }, select: { assujettiTva: true } });
        let taux = null;
        if (t.assujettiTva) {
            if (!tauxTvaId)
                throw new common_1.BadRequestException('Le dossier de l’éditeur est assujetti à la TVA · choisissez le taux à appliquer.');
            const x = await this.prisma.tauxTva.findFirst({ where: { id: tauxTvaId, tenantId: editeur }, select: { id: true, taux: true } });
            if (!x)
                throw new common_1.BadRequestException('Taux de TVA introuvable dans le dossier de l’éditeur.');
            taux = { id: x.id, taux: Number(x.taux) };
        }
        const jourCours = new Date(`${dateFacture}T00:00:00Z`);
        const cote = await this.prisma.coursDevise.findFirst({
            where: { date: jourCours, devise: { tenantId: editeur, code: 'USD' } },
            select: { cours: true },
        });
        if (!cote) {
            throw new common_1.BadRequestException(`Aucun cours du dollar américain (USD) n'est renseigné au ${(0, conversion_usd_1.jourLisible)(jourCours)} dans le dossier de l'éditeur · ` +
                'les prix en dollars se convertissent au cours du jour de la facture, à saisir dans Devises. Le cours d’un autre jour n’est jamais repris.');
        }
        const cours = Number(cote.cours);
        const annee = dateFacture.slice(0, 4);
        const numeroLibre = async () => (0, facturation_abonnements_1.numeroFactureSuivant)(annee, (await this.prisma.facture.findMany({
            where: { tenantId: editeur, sens: client_1.SensFacture.VENTE, numeroSerie: { startsWith: `VMG-${annee}-` } },
            select: { numeroSerie: true },
        })).map((e) => e.numeroSerie));
        let numero = await numeroLibre();
        const resultats = [];
        const lire = (apres) => this.prisma.abonnementCabinet.findMany({
            ...(0, lecture_par_lots_1.pageApres)(apres, exports.LOT_ABONNEMENTS_A_FACTURER),
            include: { cabinet: { select: { nom: true } }, formule: true, options: { include: { formule: true } }, factures: { where: { periode }, select: { id: true } } },
        });
        let curseur;
        for (;;) {
            const lot = await lire(curseur);
            for (const a of lot) {
                if (a.factures.length) {
                    resultats.push({ cabinet: a.cabinet.nom, statut: 'DEJA_FACTURE' });
                    continue;
                }
                const prix = (f) => ({
                    code: f.code,
                    libelle: f.libelle,
                    type: f.type,
                    prixMensuelUsd: nombre(f.prixMensuelUsd),
                    prixAnnuelUsd: nombre(f.prixAnnuelUsd),
                });
                const entree = {
                    formule: prix(a.formule),
                    options: a.options.map((o) => prix(o.formule)),
                    dossiersSupplementaires: a.dossiersSupplementaires,
                    periodicite: a.periodicite,
                    debut: jour(a.debut),
                    finEssai: jour(a.finEssai),
                    actif: a.actif,
                };
                const v = (0, facturation_abonnements_1.verdictPeriode)(entree, periode);
                if (!v.du) {
                    resultats.push({ cabinet: a.cabinet.nom, statut: 'NON_DU', motif: v.motif });
                    continue;
                }
                const lignes = v.lignes.map((l) => {
                    const pu = (0, conversion_usd_1.usdEnFc)(l.prixUnitaireUsd, cours);
                    const ht = Math.round(pu * l.quantite * 100) / 100;
                    return {
                        designation: `${l.designation} · ${l.prixUnitaireUsd} USD au cours de ${cours} FC du ${dateFacture}`,
                        quantite: l.quantite,
                        prixUnitaire: pu,
                        montantHT: ht,
                        imposable: taux !== null,
                        tauxTvaId: taux?.id,
                        tauxApplique: taux?.taux,
                        montantTva: taux ? Math.round(ht * taux.taux) / 100 : 0,
                    };
                });
                const piece = { sens: client_1.SensFacture.VENTE, dateFacture, tiersId: a.tiersId, lignes };
                let f;
                try {
                    f = await this.facturation.enregistrer(editeur, { ...piece, numeroSerie: numero });
                }
                catch (e) {
                    if (!(e instanceof common_1.BadRequestException))
                        throw e;
                    const libre = await numeroLibre();
                    if (libre === numero)
                        throw e;
                    numero = libre;
                    f = await this.facturation.enregistrer(editeur, { ...piece, numeroSerie: numero });
                }
                let fa;
                try {
                    fa = await this.prisma.factureAbonnement.create({
                        data: { abonnementId: a.id, periode, factureId: f.id, montantUsd: new client_1.Prisma.Decimal(v.totalUsd), cours: new client_1.Prisma.Decimal(cours) },
                        select: { id: true },
                    });
                }
                catch (e) {
                    if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                        await this.facturation.supprimer(editeur, f.id);
                        resultats.push({ cabinet: a.cabinet.nom, statut: 'DEJA_FACTURE' });
                        continue;
                    }
                    throw e;
                }
                const numeroGarde = numero;
                numero = (0, facturation_abonnements_1.numeroFactureSuivant)(annee, [numeroGarde]);
                let courriel;
                if (envoi && this.courriels) {
                    try {
                        const r = await this.courriels.envoyerFacture({ tenantId: editeur, userId: envoi.userId }, fa.id);
                        courriel = r.statut === 'ENVOYE' ? 'Envoyée par courriel' : `Courriel en file (${r.statut})`;
                    }
                    catch (e) {
                        courriel = `Courriel non envoyé · ${e instanceof Error ? e.message : String(e)}`;
                    }
                }
                resultats.push({ cabinet: a.cabinet.nom, statut: 'FACTURE', numero: numeroGarde, totalUsd: v.totalUsd, ...(courriel ? { courriel } : {}) });
            }
            if (lot.length < exports.LOT_ABONNEMENTS_A_FACTURER)
                break;
            curseur = lot[lot.length - 1].id;
        }
        return { periode, cours, assujetti: t.assujettiTva, resultats };
    }
};
exports.AbonnementsService = AbonnementsService;
exports.AbonnementsService = AbonnementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        facturation_service_1.FacturationService,
        plateforme_service_1.PlateformeService,
        courriels_editeur_service_1.CourrielsEditeurService])
], AbonnementsService);
//# sourceMappingURL=abonnements.service.js.map