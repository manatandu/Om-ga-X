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
exports.CreationDepuisEcrituresService = void 0;
exports.filtreLignesDeBienSansFiche = filtreLignesDeBienSansFiche;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const immobilisation_service_1 = require("./immobilisation.service");
const compte_du_bien_1 = require("./compte-du-bien");
const reprise_subvention_1 = require("./reprise-subvention");
const reserve_propriete_1 = require("./reserve-propriete");
const creation_depuis_ecritures_1 = require("./creation-depuis-ecritures");
const PLAFOND_LIGNES = 200;
const DETENTEURS_QUI_NE_REFUSENT_PAS = new Set([
    ecriture_service_1.DETENTEUR_ACQUISITION_IMMOBILISATION,
    ecriture_service_1.DETENTEUR_DONATION,
    ecriture_service_1.DETENTEUR_EXECUTION_ENGAGEMENT,
]);
const JOURNAUX_D_ACQUISITION = new Set([client_1.TypeJournal.ACHATS, client_1.TypeJournal.TRESORERIE]);
const n = (x) => Number(x ?? 0);
const jourIso = (d) => d.toISOString().slice(0, 10);
function filtreLignesDeBienSansFiche(tenantId, referentiel, borne) {
    const racines = referentiel === client_1.Referentiel.SYCEBNL ? ['20', '21', '22', '23', '24'] : ['21', '22', '23', '24'];
    return {
        debit: { gt: 0 },
        immobilisationAcquise: null,
        compte: { tenantId, OR: racines.map((r) => ({ numero: { startsWith: r } })) },
        ecriture: {
            tenantId,
            statut: borne.valideesDesExercicesOuverts ? client_1.StatutEcriture.VALIDEE : ecritures_de_situation_1.HORS_SITUATION.statut,
            ...(borne.exerciceId ? { exerciceId: borne.exerciceId } : {}),
            ...(borne.valideesDesExercicesOuverts ? { exercice: { statut: client_1.StatutExercice.OUVERT } } : {}),
            estGenereeParCloture: false,
            estANouveauProvisoire: false,
            correction: null,
            immobilisationsAcquisition: { none: { ligneAcquisitionId: null } },
            immobilisationMiseEnService: null,
            reclassementImmobilisation: null,
            reevaluationBilan: null,
            coutEmpruntIncorpore: null,
            mouvementDemantelement: null,
            annulationTraitementOrigine: null,
            annulationTraitementNegatif: null,
        },
    };
}
const SELECTION_LIGNE = {
    id: true,
    debit: true,
    credit: true,
    libelle: true,
    compteId: true,
    compte: { select: { numero: true, intitule: true } },
    immobilisationAcquise: { select: { designation: true } },
    ecriture: {
        select: {
            id: true,
            statut: true,
            date: true,
            numeroPiece: true,
            libelle: true,
            journalId: true,
            exerciceId: true,
            estGenereeParCloture: true,
            estANouveauProvisoire: true,
            journal: { select: { code: true, type: true } },
            exercice: { select: { statut: true, dateDebut: true, dateFin: true } },
            correction: { select: { numeroPiece: true } },
            immobilisationsAcquisition: { select: { designation: true, ligneAcquisitionId: true }, take: 50 },
            lignes: { select: { debit: true, credit: true, compte: { select: { numero: true } } }, take: 200 },
        },
    },
};
let CreationDepuisEcrituresService = class CreationDepuisEcrituresService {
    constructor(prisma, immobilisations, ecritures) {
        this.prisma = prisma;
        this.immobilisations = immobilisations;
        this.ecritures = ecritures;
    }
    async lignes(tenantId) {
        const referentiel = await this.referentiel(tenantId);
        const where = filtreLignesDeBienSansFiche(tenantId, referentiel, { valideesDesExercicesOuverts: true });
        const [lues, total] = await Promise.all([
            this.prisma.ligneEcriture.findMany({
                where,
                select: SELECTION_LIGNE,
                orderBy: [{ ecriture: { date: 'desc' } }, { id: 'asc' }],
                take: PLAFOND_LIGNES,
            }),
            this.prisma.ligneEcriture.count({ where }),
        ]);
        const [tenues, negatifs] = await Promise.all([
            this.tenuesParUnAutreModule(tenantId, lues.map((l) => l.ecriture.id)),
            this.negatifsAilleurs(tenantId, lues),
        ]);
        return {
            total,
            tronque: total > lues.length,
            lignes: lues.map((l) => {
                const jugee = this.jugement(referentiel, l, tenues.get(l.ecriture.id) ?? [], negatifs);
                const motifRefus = (0, creation_depuis_ecritures_1.motifRefusLigneACreer)(jugee);
                return {
                    ligneId: l.id,
                    ecritureId: l.ecriture.id,
                    numeroPiece: l.ecriture.numeroPiece,
                    journal: l.ecriture.journal.code,
                    date: jourIso(l.ecriture.date),
                    libelle: l.libelle || l.ecriture.libelle,
                    compte: { numero: l.compte.numero, intitule: l.compte.intitule },
                    montant: n(l.debit),
                    motifRefus,
                    avertissements: motifRefus ? [] : (0, creation_depuis_ecritures_1.avertissementsLigneACreer)(jugee),
                    confirmationRequise: motifRefus ? null : (0, creation_depuis_ecritures_1.confirmationPremierJour)(jugee),
                };
            }),
        };
    }
    async creer(tenantId, userId, dto) {
        const referentiel = await this.referentiel(tenantId);
        const l = await this.prisma.ligneEcriture.findFirst({ where: { id: dto.ligneId, ecriture: { tenantId } }, select: SELECTION_LIGNE });
        if (!l)
            throw new common_1.NotFoundException('Ligne introuvable dans ce dossier.');
        const autres = (await this.ecritures.detenteursDeLEcriture(tenantId, l.ecriture.id)).filter((d) => !DETENTEURS_QUI_NE_REFUSENT_PAS.has(d));
        const jugee = this.jugement(referentiel, l, autres, await this.negatifsAilleurs(tenantId, [l]));
        const motif = (0, creation_depuis_ecritures_1.motifRefusLigneACreer)(jugee);
        if (motif)
            throw new common_1.BadRequestException(motif);
        const aConfirmer = (0, creation_depuis_ecritures_1.confirmationPremierJour)(jugee);
        if (aConfirmer && dto.confirmerPremierJour !== true)
            throw new common_1.BadRequestException(aConfirmer);
        const reserve = l.ecriture.lignes.some((x) => n(x.credit) > 0 && x.compte.numero.startsWith(reserve_propriete_1.RACINE_DETTE_RESERVE_PROPRIETE));
        try {
            return await this.immobilisations.creer(tenantId, userId, {
                compteImmobilisationId: l.compteId,
                designation: (dto.designation?.trim() || l.libelle || l.ecriture.libelle).slice(0, 500),
                numeroInventaire: dto.numeroInventaire?.trim() || undefined,
                lieuId: dto.lieuId,
                dateAcquisition: jourIso(l.ecriture.date),
                dateMiseEnService: dto.dateMiseEnService ?? undefined,
                natureFiscaleCle: dto.natureFiscaleCle ?? undefined,
                valeurOrigine: n(l.debit),
                valeurResiduelle: dto.valeurResiduelle,
                dureeAmortissementAns: dto.dureeAmortissementAns,
                modeAmortissement: dto.modeAmortissement,
                unitesOeuvrePrevues: dto.unitesOeuvrePrevues,
                uniteOeuvreLibelle: dto.uniteOeuvreLibelle,
                exerciceId: l.ecriture.exerciceId,
                journalId: l.ecriture.journalId,
                ...(reserve ? { reserveDePropriete: true } : {}),
            }, { ecritureExistante: { ecritureId: l.ecriture.id, ligneId: l.id } });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('Cette ligne vient de faire naître une fiche · une ligne, un bien.');
            }
            throw err;
        }
    }
    async tenuesParUnAutreModule(tenantId, ecritureIds) {
        const tenues = new Map();
        const explorer = async (lot) => {
            if (lot.length === 0)
                return;
            const autres = (await this.ecritures.detenteursDesEcritures(tenantId, lot)).filter((d) => !DETENTEURS_QUI_NE_REFUSENT_PAS.has(d));
            if (autres.length === 0)
                return;
            if (lot.length === 1) {
                tenues.set(lot[0], autres);
                return;
            }
            const milieu = Math.ceil(lot.length / 2);
            await explorer(lot.slice(0, milieu));
            await explorer(lot.slice(milieu));
        };
        await explorer([...new Set(ecritureIds)]);
        return tenues;
    }
    async negatifsAilleurs(tenantId, lignes) {
        const comptes = [...new Set(lignes.map((l) => l.compteId))];
        const parCle = new Map();
        if (comptes.length === 0)
            return parCle;
        const negatifs = await this.prisma.ligneEcriture.findMany({
            where: {
                compteId: { in: comptes },
                debit: { lt: 0 },
                ecriture: {
                    tenantId,
                    statut: client_1.StatutEcriture.VALIDEE,
                    exercice: { statut: client_1.StatutExercice.OUVERT },
                    corrigeEcritureId: null,
                    correction: null,
                },
            },
            select: { compteId: true, debit: true, ecriture: { select: { id: true, numeroPiece: true } } },
            take: 2000,
        });
        for (const x of negatifs) {
            const cle = `${x.compteId}|${Math.round(-n(x.debit) * 100)}`;
            parCle.set(cle, [...(parCle.get(cle) ?? []), { ecritureId: x.ecriture.id, numeroPiece: x.ecriture.numeroPiece }]);
        }
        return parCle;
    }
    jugement(referentiel, l, autresModules, negatifs) {
        const duModule = l.ecriture.immobilisationsAcquisition.find((i) => i.ligneAcquisitionId === null);
        const ref = referentiel === client_1.Referentiel.SYCEBNL ? 'SYCEBNL' : 'SYSCOHADA';
        const ailleurs = (negatifs.get(`${l.compteId}|${Math.round(n(l.debit) * 100)}`) ?? []).find((x) => x.ecritureId !== l.ecriture.id);
        const premierJour = jourIso(l.ecriture.date) === jourIso(l.ecriture.exercice.dateDebut);
        return {
            referentiel,
            statutEcriture: l.ecriture.statut,
            exerciceClos: l.ecriture.exercice.statut === client_1.StatutExercice.CLOTURE,
            estANouveau: l.ecriture.estGenereeParCloture || l.ecriture.estANouveauProvisoire,
            debit: n(l.debit),
            numeroCompte: l.compte.numero,
            dejaRattacheeA: l.immobilisationAcquise?.designation ?? null,
            acquisitionDuModule: duModule?.designation ?? null,
            autresModules,
            lignesDeBien: l.ecriture.lignes.filter((x) => n(x.debit) > 0 && (0, compte_du_bien_1.estCompteDeBien)(referentiel, x.compte.numero)).length,
            fondsAuCredit: [
                ...new Set(l.ecriture.lignes.filter((x) => n(x.credit) > 0 && !!(0, reprise_subvention_1.fondsDuCompte)(ref, x.compte.numero)).map((x) => x.compte.numero)),
            ],
            corrigeeParLaPiece: l.ecriture.correction ? String(l.ecriture.correction.numeroPiece ?? '·') : null,
            credits: [...new Set(l.ecriture.lignes.filter((x) => n(x.credit) > 0).map((x) => x.compte.numero))],
            negatifSurUnCompteDeBien: l.ecriture.lignes.some((x) => (n(x.debit) < 0 || n(x.credit) < 0) && (0, compte_du_bien_1.estCompteDeBien)(referentiel, x.compte.numero)),
            premierJourHorsAchats: premierJour && !JOURNAUX_D_ACQUISITION.has(l.ecriture.journal.type) ? l.ecriture.journal.code : null,
            memeMontantEnNegatifAilleurs: ailleurs ? String(ailleurs.numeroPiece ?? '·') : null,
        };
    }
    async referentiel(tenantId) {
        const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        return t.referentiel;
    }
};
exports.CreationDepuisEcrituresService = CreationDepuisEcrituresService;
exports.CreationDepuisEcrituresService = CreationDepuisEcrituresService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        immobilisation_service_1.ImmobilisationService,
        ecriture_service_1.EcritureService])
], CreationDepuisEcrituresService);
//# sourceMappingURL=creation-depuis-ecritures.service.js.map