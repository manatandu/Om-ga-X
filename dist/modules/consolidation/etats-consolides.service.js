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
exports.EtatsConsolidesService = exports.NOTES_D4C_NON_PRODUITES = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const etats_financiers_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.service");
const cumul_service_1 = require("./cumul.service");
const etats_consolides_1 = require("./etats-consolides");
const flux_capitaux_consolides_1 = require("./flux-capitaux-consolides");
const note_perimetre_1 = require("./note-perimetre");
const perimetre_service_1 = require("./perimetre.service");
exports.NOTES_D4C_NON_PRODUITES = 'Notes annexes consolidées non produites hormis la note du périmètre (D4C ch. XII-8 § 6) · déclaration de conformité, résumé des méthodes, ' +
    'information sectorielle, informations sur les postes (dont la note sur l’impôt · composantes, preuve d’impôt, changements de taux, ' +
    'déficits non activés, ch. XII-3 § 3), autres informations, acquisitions et cessions de l’exercice.';
let EtatsConsolidesService = class EtatsConsolidesService {
    constructor(prisma, cumuls, perimetre, etatsIndividuels) {
        this.prisma = prisma;
        this.cumuls = cumuls;
        this.perimetre = perimetre;
        this.etatsIndividuels = etatsIndividuels;
    }
    resolveurs() {
        return {
            bilan: (l) => this.etatsIndividuels.resoudreBilanSurLignes(l),
            compteResultat: (l) => this.etatsIndividuels.resoudreCompteResultatSurLignes(l),
        };
    }
    async etats(tenantId, exerciceId) {
        const cumulN = await this.cumuls.cumul(tenantId, exerciceId);
        const etatN = await this.perimetre.etat(tenantId, exerciceId);
        const n = (0, etats_consolides_1.construireEtatsConsolides)(cumulN, this.resolveurs());
        const ex = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { dateDebut: true } });
        const precedent = ex
            ? await this.prisma.exercice.findFirst({
                where: { tenantId, dateDebut: { lt: ex.dateDebut } },
                orderBy: { dateDebut: 'desc' },
                select: { id: true },
            })
            : null;
        let n1 = null;
        let cumulN1 = null;
        let resultatsN1 = null;
        let motifSansComparatif = null;
        if (!precedent) {
            motifSansComparatif = 'Premier exercice du dossier · aucun comparatif.';
        }
        else {
            const etatN1 = await this.perimetre.etat(tenantId, precedent.id);
            if (etatN1.entites.length === 0) {
                motifSansComparatif = 'Aucun périmètre déclaré pour l’exercice précédent · la colonne N-1 ne se déduit pas des comptes de la seule consolidante.';
            }
            else {
                resultatsN1 = etatN1.resultats;
                try {
                    cumulN1 = await this.cumuls.cumul(tenantId, precedent.id);
                    n1 = (0, etats_consolides_1.construireEtatsConsolides)(cumulN1, this.resolveurs());
                }
                catch (e) {
                    if (!(e instanceof common_1.BadRequestException))
                        throw e;
                    motifSansComparatif = `L’exercice précédent ne se consolide pas · ${e.message}`;
                }
            }
        }
        let tft;
        let tvcp = null;
        if (!cumulN1 || !precedent || !resultatsN1) {
            tft = { lignes: null, obstacles: [motifSansComparatif ?? 'Aucune consolidation de l’exercice précédent.'], controle: null };
        }
        else {
            const [consolidanteN, consolidanteN1] = await Promise.all([
                this.cumuls.lignesConsolidante(tenantId, exerciceId),
                this.cumuls.lignesConsolidante(tenantId, precedent.id),
            ]);
            tft = (0, flux_capitaux_consolides_1.construireTableauFluxConsolide)({ cumulN, cumulN1, consolidanteN, consolidanteN1, variationsPerimetre: (0, flux_capitaux_consolides_1.variationsDuPerimetre)(etatN.resultats, resultatsN1) }, (ln, ln1) => this.etatsIndividuels.resoudreFluxSurLignes(ln, ln1));
            tvcp = (0, flux_capitaux_consolides_1.construireVariationCapitauxPropres)(cumulN, cumulN1, consolidanteN);
        }
        const motifsJeu = [];
        if (resultatsN1) {
            for (const c of (0, flux_capitaux_consolides_1.changementsDuPerimetre)(etatN.resultats, resultatsN1).filter((x) => x.nature !== 'ENTREE')) {
                motifsJeu.push(`Variation de périmètre ou de pourcentage d’intérêt non jouée (D4C ch. XII-7) · ${c.motif} Transaction entre actionnaires, ` +
                    'résultat de cession sur la dernière valeur consolidée et virement des écarts de conversion ne sont pas calculés.');
            }
        }
        if (!tft.lignes)
            motifsJeu.push('Tableau consolidé des flux de trésorerie non établi · le jeu complet est indissociable (D4C ch. XII-8 § 1).');
        if (!tvcp)
            motifsJeu.push('Tableau de variation des capitaux propres consolidés non établi (D4C ch. XII-8 § 1 et § 5).');
        motifsJeu.push(exports.NOTES_D4C_NON_PRODUITES);
        const secteurs = new Map(etatN.entites.map((e) => [e.id, e.secteurActivite ?? null]));
        return {
            bilan: {
                actif: (0, etats_consolides_1.apparierN1)(n.bilan.actif, n1?.bilan.actif ?? null),
                passif: (0, etats_consolides_1.apparierN1)(n.bilan.passif, n1?.bilan.passif ?? null),
            },
            compteDeResultat: (0, etats_consolides_1.apparierN1)(n.compteDeResultat, n1?.compteDeResultat ?? null),
            controles: n.controles,
            publiable: n.publiable && motifsJeu.length === 0,
            bilanEtResultatPubliables: n.publiable,
            motifsNonPubliable: [...n.motifsNonPubliable, ...motifsJeu],
            comparatif: { disponible: n1 != null, motif: motifSansComparatif },
            tableauDesFlux: tft,
            variationCapitauxPropres: tvcp,
            notePerimetre: (0, note_perimetre_1.noteDuPerimetre)(etatN.resultats, secteurs, resultatsN1, etatN.faits?.entitesControleHorsOhada ?? null),
            avertissements: cumulN.avertissements,
            reserves: cumulN.reserves,
        };
    }
};
exports.EtatsConsolidesService = EtatsConsolidesService;
exports.EtatsConsolidesService = EtatsConsolidesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cumul_service_1.CumulService,
        perimetre_service_1.PerimetreService,
        etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService])
], EtatsConsolidesService);
//# sourceMappingURL=etats-consolides.service.js.map