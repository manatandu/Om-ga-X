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
exports.LocationAcquisitionService = void 0;
const common_1 = require("@nestjs/common");
const ecritures_de_situation_1 = require("../../comptabilite/ecritures-de-situation");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../common/prisma.service");
const immobilisation_dto_1 = require("../dto/immobilisation.dto");
const immobilisation_service_1 = require("../immobilisation.service");
const ecriture_service_1 = require("../../comptabilite/ecriture.service");
const echeancier_location_acquisition_1 = require("./echeancier-location-acquisition");
const nomenclature_location_acquisition_1 = require("./nomenclature-location-acquisition");
const cloture_location_acquisition_1 = require("./cloture-location-acquisition");
const EPSILON = 0.005;
const n = (v) => Number(v ?? 0);
const centimes = (x) => Math.round(x * 100) / 100;
let LocationAcquisitionService = class LocationAcquisitionService {
    constructor(prisma, ecritures, immobilisations) {
        this.prisma = prisma;
        this.ecritures = ecritures;
        this.immobilisations = immobilisations;
    }
    async contrat(tenantId, id) {
        const c = await this.prisma.contratLocationAcquisition.findFirst({
            where: { id, tenantId },
            include: { immobilisation: { select: { designation: true, statut: true, dateSortie: true } }, clotures: true },
        });
        if (!c)
            throw new common_1.NotFoundException('Contrat de location-acquisition introuvable');
        return c;
    }
    echeancierDe(c) {
        const saisi = {
            nature: c.nature,
            datePriseEffet: c.datePriseEffet,
            dureeMois: c.dureeMois,
            periodicite: c.periodicite,
            termeAEchoir: c.termeAEchoir,
            loyer: n(c.loyer),
            prixOption: n(c.prixOption),
            optionRaisonnablementCertaine: c.optionRaisonnablementCertaine,
            bienDeFaibleValeur: c.bienDeFaibleValeur,
            tauxAnnuel: c.tauxAnnuel != null ? n(c.tauxAnnuel) : null,
            valeurContrat: c.valeurContrat != null ? n(c.valeurContrat) : null,
            garantieValeurResiduelle: n(c.garantieValeurResiduelle),
            loyerIndexe: c.loyerIndexe,
            indiceLoyer: c.indiceLoyer,
            valeurIndiceCommencement: c.valeurIndiceCommencement != null ? n(c.valeurIndiceCommencement) : null,
        };
        return (0, echeancier_location_acquisition_1.construireEcheancier)(saisi);
    }
    async compte(tenantId, numero) {
        const c = await this.prisma.compte.findUnique({ where: { tenantId_numero: { tenantId, numero } }, select: { id: true } });
        if (!c)
            throw new common_1.BadRequestException(`Compte ${numero} absent du plan du dossier · ouvrez-le avant la clôture du contrat.`);
        return c.id;
    }
    async lister(tenantId, exerciceId) {
        const contrats = await this.prisma.contratLocationAcquisition.findMany({
            where: { tenantId },
            include: {
                immobilisation: { select: { designation: true, statut: true, dateSortie: true } },
                clotures: { where: { exerciceId }, select: { id: true, loyers: true, interetsCourus: true } },
            },
            orderBy: { datePriseEffet: 'asc' },
            take: 500,
        });
        return contrats.map((c) => ({
            id: c.id,
            prixOption: n(c.prixOption),
            optionLevee: c.optionLevee,
            dateOption: n(c.prixOption) > 0 ? (this.echeancierDe({ ...c, clotures: [] }).lignes.find((l) => l.option)?.date ?? null) : null,
            garantieValeurResiduelle: n(c.garantieValeurResiduelle),
            garantieAppelee: c.garantieAppelee,
            dateGarantie: n(c.garantieValeurResiduelle) > 0 ? (this.echeancierDe({ ...c, clotures: [] }).lignes.find((l) => l.garantie)?.date ?? null) : null,
            loyerIndexe: c.loyerIndexe,
            indiceLoyer: c.indiceLoyer,
            valeurIndiceCommencement: c.valeurIndiceCommencement != null ? n(c.valeurIndiceCommencement) : null,
            reference: c.reference,
            nature: c.nature,
            designation: c.immobilisation.designation,
            immobilisationId: c.immobilisationId,
            bienSorti: c.immobilisation.statut !== 'EN_SERVICE',
            datePriseEffet: c.datePriseEffet,
            dette: n(c.dette),
            cloture: c.clotures[0] ? { loyers: n(c.clotures[0].loyers), interetsCourus: n(c.clotures[0].interetsCourus) } : null,
        }));
    }
    async proposer(tenantId, contratId, exerciceId) {
        const c = await this.contrat(tenantId, contratId);
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        const comptes = nomenclature_location_acquisition_1.COMPTES_LOCATION_ACQUISITION[referentiel][c.nature];
        if (!comptes)
            throw new common_1.BadRequestException("Ce référentiel n'ouvre aucun compte pour cette nature de contrat.");
        const echeancier = this.echeancierDe(c);
        const ventilation = (0, cloture_location_acquisition_1.ventilerExercice)(echeancier.lignes, c.datePriseEffet, echeancier.dette, echeancier.tauxPeriodique, exercice, c.optionLevee, c.garantieAppelee);
        const refus = [];
        if (c.clotures.some((cl) => cl.exerciceId === exerciceId))
            refus.push('La clôture de ce contrat est déjà passée pour cet exercice.');
        if (exercice.statut !== client_1.StatutExercice.OUVERT)
            refus.push('Exercice clôturé · aucune écriture ne peut y entrer (AUDCIF art. 20).');
        if (ventilation.optionNonDeclaree) {
            refus.push("L'option d'achat échoit dans l'exercice · déclarez sa levée ou sa non-levée avant la clôture (AUDCIF Titre VIII ch. 8 § 2.1.9).");
        }
        if (ventilation.garantieNonDeclaree) {
            refus.push("La garantie de valeur résiduelle échoit dans l'exercice · déclarez si le bailleur l'a appelée avant la clôture (AUDCIF Titre VIII ch. 8 § 2.1.2).");
        }
        const avertissements = [];
        if (ventilation.garantieNonAppelee > EPSILON) {
            avertissements.push(`Garantie de valeur résiduelle non appelée · ${ventilation.garantieNonAppelee.toFixed(2)} restent à la dette de ` +
                "location-acquisition, que le texte ne dit pas comment éteindre (AUDCIF Titre VIII ch. 8 § 2.1.2) · écriture du cabinet.");
        }
        if (exercice.dateFin < c.datePriseEffet)
            refus.push("L'exercice s'achève avant la prise d'effet du contrat · rien à clôturer.");
        const anterieurs = await this.prisma.exercice.findMany({
            where: { tenantId, dateFin: { gte: c.datePriseEffet }, dateDebut: { lt: exercice.dateDebut } },
            select: { id: true, dateDebut: true, dateFin: true },
            orderBy: { dateDebut: 'asc' },
            take: 100,
        });
        const nonClotures = anterieurs.filter((e) => !c.clotures.some((cl) => cl.exerciceId === e.id));
        if (nonClotures.length) {
            refus.push(`Clôturez d'abord le contrat sur l'exercice ${nonClotures[0].dateDebut.toISOString().slice(0, 10)} · ` +
                `${nonClotures[0].dateFin.toISOString().slice(0, 10)} · les exercices se traitent dans l'ordre.`);
        }
        const precedent = anterieurs[anterieurs.length - 1];
        const cloturePrecedente = precedent ? c.clotures.find((cl) => cl.exerciceId === precedent.id) : undefined;
        const extourne = cloturePrecedente ? n(cloturePrecedente.interetsCourus) : 0;
        const id623 = await this.prisma.compte.findUnique({
            where: { tenantId_numero: { tenantId, numero: comptes.redevances } },
            select: { id: true },
        });
        let porte623 = 0;
        if (id623) {
            const dejaVires = await this.prisma.clotureLocationAcquisition.findMany({
                where: { tenantId, exerciceId },
                select: { ecritureId: true },
                take: 500,
            });
            const agg = await this.prisma.ligneEcriture.aggregate({
                where: {
                    compteId: id623.id,
                    ecriture: {
                        tenantId,
                        exerciceId,
                        estSoldeDesComptesDeGestion: false,
                        id: { notIn: dejaVires.map((d) => d.ecritureId) },
                        ...ecritures_de_situation_1.HORS_SITUATION,
                    },
                },
                _sum: { debit: true, credit: true },
            });
            porte623 = centimes(n(agg._sum.debit) - n(agg._sum.credit));
        }
        const virementsAutres = await this.prisma.clotureLocationAcquisition.aggregate({
            where: { tenantId, exerciceId, contrat: { nature: c.nature } },
            _sum: { loyers: true },
        });
        const disponible623 = centimes(porte623 - n(virementsAutres._sum.loyers));
        if (ventilation.loyers > EPSILON && disponible623 + EPSILON < ventilation.loyers) {
            refus.push(`Le compte ${comptes.redevances} ne porte que ${disponible623.toFixed(2)} pour ${ventilation.loyers.toFixed(2)} de loyers échus · ` +
                'saisissez les redevances de l’exercice avant la clôture (AUDCIF Titre VIII ch. 8 § 2.1.8.1).');
        }
        return {
            contrat: { id: c.id, reference: c.reference, designation: c.immobilisation.designation },
            exercice: { id: exercice.id, dateDebut: exercice.dateDebut, dateFin: exercice.dateFin },
            comptes,
            ventilation,
            extourne,
            porte623,
            disponible623,
            refus,
            avertissements,
        };
    }
    async passer(tenantId, userId, contratId, dto) {
        const p = await this.proposer(tenantId, contratId, dto.exerciceId);
        if (p.refus.length)
            throw new common_1.BadRequestException(p.refus.join(' '));
        const v = p.ventilation;
        if (v.loyers <= EPSILON && v.interetsCourus <= EPSILON && p.extourne <= EPSILON) {
            throw new common_1.BadRequestException("Aucun loyer échu ni intérêt couru sur cet exercice · rien à passer.");
        }
        const [id17, id176, id672, id623] = await Promise.all([
            this.compte(tenantId, p.comptes.dette),
            this.compte(tenantId, p.comptes.interetsCourus),
            this.compte(tenantId, p.comptes.interets),
            this.compte(tenantId, p.comptes.redevances),
        ]);
        const nom = p.contrat.reference ? `${p.contrat.designation} (${p.contrat.reference})` : p.contrat.designation;
        const crees = [];
        try {
            let ecritureExtourneId = null;
            if (p.extourne > EPSILON) {
                const e = await this.ecritures.creer(tenantId, userId, {
                    exerciceId: dto.exerciceId,
                    journalId: dto.journalId,
                    date: p.exercice.dateDebut.toISOString().slice(0, 10),
                    libelle: `Extourne des intérêts courus · ${nom}`.slice(0, 190),
                    lignes: [
                        { compteId: id176, debit: p.extourne, credit: 0 },
                        { compteId: id672, debit: 0, credit: p.extourne },
                    ],
                });
                ecritureExtourneId = e.id;
                crees.push(e.id);
            }
            const lignes = [
                ...(v.capital > EPSILON ? [{ compteId: id17, debit: v.capital, credit: 0 }] : []),
                ...(v.interets + v.interetsCourus > EPSILON ? [{ compteId: id672, debit: centimes(v.interets + v.interetsCourus), credit: 0 }] : []),
                ...(v.loyers > EPSILON ? [{ compteId: id623, debit: 0, credit: v.loyers }] : []),
                ...(v.interetsCourus > EPSILON ? [{ compteId: id176, debit: 0, credit: v.interetsCourus }] : []),
            ];
            let ecritureId;
            if (lignes.length) {
                const e = await this.ecritures.creer(tenantId, userId, {
                    exerciceId: dto.exerciceId,
                    journalId: dto.journalId,
                    date: p.exercice.dateFin.toISOString().slice(0, 10),
                    libelle: `Redevances de location-acquisition · ${nom}`.slice(0, 190),
                    lignes,
                });
                ecritureId = e.id;
                crees.push(e.id);
            }
            else {
                ecritureId = ecritureExtourneId;
                ecritureExtourneId = null;
            }
            return await this.prisma.clotureLocationAcquisition.create({
                data: {
                    tenantId,
                    contratId,
                    exerciceId: dto.exerciceId,
                    loyers: v.loyers,
                    capital: v.capital,
                    interets: v.interets,
                    interetsCourus: v.interetsCourus,
                    ecritureId,
                    ecritureExtourneId,
                    createdBy: userId,
                },
            });
        }
        catch (err) {
            for (const id of crees.reverse())
                await this.ecritures.retirerCompensation(tenantId, id);
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('La clôture de ce contrat est déjà passée pour cet exercice.');
            }
            throw err;
        }
    }
    async declarerGarantie(tenantId, contratId, appelee) {
        const c = await this.contrat(tenantId, contratId);
        if (!(n(c.garantieValeurResiduelle) > 0)) {
            throw new common_1.BadRequestException('Ce contrat ne porte pas de garantie de valeur résiduelle · rien à déclarer.');
        }
        try {
            return await this.prisma.contratLocationAcquisition.update({
                where: { id: c.id, tenantId, garantieAppelee: null },
                data: { garantieAppelee: appelee },
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                throw new common_1.ConflictException("L'appel de la garantie est déjà déclaré pour ce contrat.");
            }
            throw err;
        }
    }
    async declarerOption(tenantId, userId, contratId, dto) {
        const c = await this.contrat(tenantId, contratId);
        if (!(n(c.prixOption) > 0)) {
            throw new common_1.BadRequestException("Ce contrat ne porte pas d'option d'achat · rien à déclarer.");
        }
        if (c.optionLevee !== null)
            throw new common_1.ConflictException("La levée de l'option est déjà déclarée pour ce contrat.");
        const option = this.echeancierDe(c).lignes.find((l) => l.option);
        const reclamer = (valeur, date) => this.prisma.contratLocationAcquisition.update({
            where: { id: c.id, tenantId, optionLevee: null },
            data: { optionLevee: valeur, dateDecisionOption: date },
        });
        if (dto.levee) {
            try {
                return await reclamer(true, new Date());
            }
            catch (err) {
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                    throw new common_1.ConflictException("La levée de l'option est déjà déclarée pour ce contrat.");
                }
                throw err;
            }
        }
        if (c.immobilisation.statut !== 'EN_SERVICE') {
            try {
                const declare = await reclamer(false, option.date);
                return {
                    ...declare,
                    sortieDejaPassee: {
                        dateSortie: c.immobilisation.dateSortie ? c.immobilisation.dateSortie.toISOString().slice(0, 10) : null,
                        motif: `« ${c.immobilisation.designation} » est déjà sorti${c.immobilisation.dateSortie ? ` le ${c.immobilisation.dateSortie.toISOString().slice(0, 10)}` : ''} ` +
                            'par une sortie ordinaire · la non-levée est déclarée sans seconde cession, et le capital restant dû au 17 ' +
                            'envers le bailleur reste à solder par le cabinet (AUDCIF Titre VIII ch. 8 § 2.1.9).',
                    },
                };
            }
            catch (err) {
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                    throw new common_1.ConflictException("La levée de l'option est déjà déclarée pour ce contrat.");
                }
                throw err;
            }
        }
        if (!dto.exerciceId || !dto.journalId) {
            throw new common_1.BadRequestException("Indiquez l'exercice et le journal de la sortie du bien.");
        }
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        const comptes = nomenclature_location_acquisition_1.COMPTES_LOCATION_ACQUISITION[referentiel][c.nature];
        if (!comptes)
            throw new common_1.BadRequestException("Ce référentiel n'ouvre aucun compte pour cette nature de contrat.");
        const id17 = await this.compte(tenantId, comptes.dette);
        try {
            await reclamer(false, option.date);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                throw new common_1.ConflictException("La levée de l'option est déjà déclarée pour ce contrat.");
            }
            throw err;
        }
        try {
            return await this.immobilisations.sortir(tenantId, userId, c.immobilisationId, {
                dateSortie: option.date.toISOString().slice(0, 10),
                type: immobilisation_dto_1.TypeSortie.CESSION,
                exerciceId: dto.exerciceId,
                journalId: dto.journalId,
                prixCession: option.capital,
                compteContrepartieId: id17,
                cessionCourante: !!dto.cessionCourante,
                compteReserveEcartId: dto.compteReserveEcartId,
            });
        }
        catch (err) {
            await this.prisma.contratLocationAcquisition.update({
                where: { id: c.id, tenantId },
                data: { optionLevee: null, dateDecisionOption: null },
            });
            throw err;
        }
    }
};
exports.LocationAcquisitionService = LocationAcquisitionService;
exports.LocationAcquisitionService = LocationAcquisitionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService,
        immobilisation_service_1.ImmobilisationService])
], LocationAcquisitionService);
//# sourceMappingURL=location-acquisition.service.js.map