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
var ProvisionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvisionsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const passifs_eventuels_en_note_1 = require("../notes-annexes/passifs-eventuels-en-note");
const court_terme_et_conditions_1 = require("./court-terme-et-conditions");
let ProvisionsService = ProvisionsService_1 = class ProvisionsService {
    constructor(prisma, ecritures) {
        this.prisma = prisma;
        this.ecritures = ecritures;
    }
    static naturesDuReferentiel(referentiel) {
        const communes = [
            { nature: client_1.NatureProvision.LITIGE, compte: '191', intitule: 'Provisions pour litiges' },
            { nature: client_1.NatureProvision.PERTES_DE_CHANGE, compte: '194', intitule: 'Provisions pour pertes de change' },
            {
                nature: client_1.NatureProvision.PENSIONS_ET_OBLIGATIONS_SIMILAIRES,
                compte: '196',
                intitule: 'Provisions pour pensions et obligations similaires',
            },
            { nature: client_1.NatureProvision.AMENDES_ET_PENALITES, compte: '1981', intitule: 'Provisions pour amendes et pénalités' },
            {
                nature: client_1.NatureProvision.DEMANTELEMENT_ET_REMISE_EN_ETAT,
                compte: '1984',
                intitule: 'Provisions pour démantèlement et remise en état',
            },
            {
                nature: client_1.NatureProvision.DIVERS_RISQUES_ET_CHARGES,
                compte: '1988',
                intitule: 'Provisions pour divers risques et charges',
            },
            { nature: client_1.NatureProvision.CONTRAT_DEFICITAIRE, compte: '1988', intitule: 'Provisions pour divers risques et charges' },
            { nature: client_1.NatureProvision.DEMENAGEMENT, compte: '1988', intitule: 'Provisions pour divers risques et charges' },
        ];
        if (referentiel === client_1.Referentiel.SYCEBNL) {
            return [
                ...communes,
                {
                    nature: client_1.NatureProvision.CHARGES_DONATIONS_LEGS,
                    compte: '192',
                    intitule: 'Provisions pour charges sur donations et legs',
                },
            ];
        }
        return [
            ...communes,
            { nature: client_1.NatureProvision.GARANTIE_CLIENTS, compte: '192', intitule: 'Provisions pour garanties données aux clients' },
            {
                nature: client_1.NatureProvision.PERTES_MARCHES_ACHEVEMENT_FUTUR,
                compte: '193',
                intitule: 'Provisions pour pertes sur marchés à achèvement futur',
            },
            { nature: client_1.NatureProvision.IMPOTS, compte: '195', intitule: 'Provisions pour impôts' },
            { nature: client_1.NatureProvision.RESTRUCTURATION, compte: '197', intitule: 'Provisions pour restructurations' },
            { nature: client_1.NatureProvision.PROPRE_ASSUREUR, compte: '1983', intitule: 'Provisions pour propre assureur' },
            {
                nature: client_1.NatureProvision.DROITS_A_REDUCTION,
                compte: '1985',
                intitule: 'Provisions pour droits à réduction ou avantage en nature',
            },
        ];
    }
    static conditionsManquantes(p) {
        const manques = [];
        if (!p.obligationExiste)
            manques.push("l'existence d'une obligation juridique ou implicite à la date de clôture");
        if (!p.resulteEvenementPasse)
            manques.push("le rattachement à un événement passé (le fait générateur)");
        if (!p.sortieProbable)
            manques.push('le caractère probable de la sortie de ressources (au-delà de 50 %)');
        if (!p.estimationFiable)
            manques.push("la possibilité d'une estimation fiable du montant");
        return manques;
    }
    static montantCloture(p) {
        const n = (v) => Number(v ?? 0);
        return Number((n(p.montantOuverture) +
            n(p.dotationsExercice) -
            n(p.montantsUtilises) -
            n(p.reprisesNonUtilisees) +
            n(p.effetActualisation)).toFixed(2));
    }
    async verifierCompte(tenantId, nature, compteId, courtTerme = false) {
        if (!compteId)
            return;
        const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId }, select: { numero: true } });
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable dans ce dossier.');
        const referentiel = await this.referentielDu(tenantId);
        if (courtTerme) {
            if (ProvisionsService_1.INTERDICTIONS[nature]) {
                throw new common_1.BadRequestException(`La nature ${nature} n'a aucun compte · elle ne se comptabilise pas.`);
            }
            const refus = (0, court_terme_et_conditions_1.motifRefusCompteCourtTerme)(referentiel, compte.numero);
            if (refus)
                throw new common_1.BadRequestException(refus);
            return;
        }
        const refusLong = (0, court_terme_et_conditions_1.motifRefusCompteLongTerme)(compte.numero);
        if (refusLong)
            throw new common_1.BadRequestException(refusLong);
        const servie = ProvisionsService_1.naturesDuReferentiel(referentiel).find((n) => n.nature === nature);
        if (!servie) {
            throw new common_1.BadRequestException(`La nature ${nature} n'a aucun compte dans le plan de ce dossier · elle ne se comptabilise pas.`);
        }
        if (!compte.numero.startsWith(servie.compte)) {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} n'est pas un ${servie.compte} (${servie.intitule}) · une provision se porte ` +
                'au compte que sa nature appelle, sans quoi son rapprochement se ferait contre le solde d’un autre risque.');
        }
    }
    async dossierDu(tenantId) {
        const tenant = await this.prisma.tenant.findFirst({
            where: { id: tenantId },
            select: { referentiel: true, jeuEtatsFinanciersSycebnl: true, systemeComptableSyscohada: true },
        });
        if (!tenant)
            throw new common_1.NotFoundException('Dossier introuvable.');
        return tenant;
    }
    async referentielDu(tenantId) {
        const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } });
        if (!tenant)
            throw new common_1.NotFoundException('Dossier introuvable.');
        return tenant.referentiel;
    }
    async controler(tenantId, dto, etat) {
        const statut = dto.statut ?? client_1.StatutProvision.EN_EXAMEN;
        const interdiction = ProvisionsService_1.INTERDICTIONS[dto.nature];
        if (interdiction && statut === client_1.StatutProvision.COMPTABILISEE) {
            throw new common_1.BadRequestException(`Cette provision ne peut pas être comptabilisée. ${interdiction}`);
        }
        if (!interdiction) {
            const referentiel = await this.referentielDu(tenantId);
            const admises = ProvisionsService_1.naturesDuReferentiel(referentiel);
            if (!admises.some((n) => n.nature === dto.nature)) {
                throw new common_1.BadRequestException(`La nature ${dto.nature} n'existe pas dans le plan de comptes ${referentiel}. ` +
                    'Les deux référentiels emploient les mêmes numéros pour des natures différentes · au 192, le ' +
                    "SYSCOHADA loge les garanties données aux clients, le SYCEBNL les charges sur donations et legs. " +
                    `Natures admises pour ce dossier : ${admises.map((n) => n.nature).join(', ')}.`);
            }
        }
        const manques = ProvisionsService_1.conditionsManquantes({
            obligationExiste: dto.obligationExiste ?? etat.obligationExiste,
            resulteEvenementPasse: dto.resulteEvenementPasse ?? etat.resulteEvenementPasse,
            sortieProbable: dto.sortieProbable ?? etat.sortieProbable,
            estimationFiable: dto.estimationFiable ?? etat.estimationFiable,
        });
        const conditions = dto.conditionsPropres !== undefined ? dto.conditionsPropres : etat.conditionsPropres;
        const inconnues = (0, court_terme_et_conditions_1.clesInconnues)(dto.nature, conditions);
        if (inconnues.length > 0) {
            throw new common_1.BadRequestException(`Condition(s) ${inconnues.join(', ')} inconnue(s) pour la nature ${dto.nature} · ` +
                `admises : ${(court_terme_et_conditions_1.CONDITIONS_PROPRES[dto.nature] ?? []).map((c) => c.cle).join(', ') || 'aucune'}.`);
        }
        manques.push(...(0, court_terme_et_conditions_1.conditionsPropresManquantes)(dto.nature, conditions));
        if (statut === client_1.StatutProvision.COMPTABILISEE && manques.length > 0) {
            const note = (0, passifs_eventuels_en_note_1.notePassifsEventuelsDuDossier)(await this.dossierDu(tenantId));
            const destination = note
                ? `PASSIF_EVENTUEL, qui la porte à la ${note} de la liasse sans rien inscrire au bilan`
                : "PASSIF_EVENTUEL, qui la garde au registre sans rien inscrire au bilan · le jeu d'états de ce dossier " +
                    "n'a pas de note d'actifs et passifs éventuels, et rien ne l'y porte d'office : décrivez-la aux Notes " +
                    'annexes';
            const propres = court_terme_et_conditions_1.CONDITIONS_PROPRES[dto.nature] ?? [];
            const total = 4 + propres.length;
            const annonce = propres.length
                ? `ses ${total} conditions sont réunies · les quatre conditions générales (AUDCIF Titre VIII ch. 18 § 2.1, ` +
                    `qui en compte trois · « Si ces trois conditions ne sont pas réunies, aucune provision ne peut être ` +
                    `constituée » ; le CPCC sépare l'obligation actuelle de l'événement passé) et les ${propres.length} ` +
                    `conditions propres de ce cas (${[...new Set(propres.map((c) => c.source))].join(', ')})`
                : `les quatre conditions sont réunies · AUDCIF Titre VIII ch. 18 § 2.1, qui en compte trois (« Si ces trois ` +
                    `conditions ne sont pas réunies, aucune provision ne peut être constituée » ; le CPCC sépare l'obligation ` +
                    `actuelle de l'événement passé)`;
            throw new common_1.BadRequestException(`Une provision ne se comptabilise que si ${annonce}. ` +
                `Il en manque ${manques.length} : ${manques.join(' ; ')}. Le risque ne disparaît pas pour autant · portez la ligne en ` +
                `${destination}, ou en ECARTEE si ` +
                'la probabilité de sortie de ressources est TRÈS FAIBLE (§ 2.1.2, seul cas où aucune information ' +
                "n'est nécessaire).");
        }
        if (statut !== client_1.StatutProvision.COMPTABILISEE && statut !== client_1.StatutProvision.EN_EXAMEN) {
            const motif = dto.motifNonComptabilisation;
            if (motif === undefined || motif === null || motif.trim().length === 0) {
                throw new common_1.BadRequestException("Un risque écarté sans motif écrit est un risque effacé, pas arbitré. Le § 5.3 exige « une brève " +
                    "description de la nature de l'obligation » et « une indication des incertitudes » : indiquez " +
                    'pourquoi la ligne ne figure pas au bilan.');
            }
        }
        if (dto.remboursementAttendu !== undefined && dto.remboursementAttendu !== null) {
            if (Number(dto.remboursementAttendu) < 0) {
                throw new common_1.BadRequestException('Un remboursement attendu ne se saisit jamais en négatif · § 3.1.4, il se présente « au bilan comme ' +
                    'un ACTIF DISTINCT, NON COMPENSÉ avec la provision comptabilisée au passif, car l\'entité reste ' +
                    "responsable de l'extinction de l'obligation en cas de défaillance du tiers ». Le porter en " +
                    'diminution de la provision sous-estimerait du même montant le passif ET l\'actif.');
            }
            if (!(dto.remboursementCertain ?? false)) {
                throw new common_1.BadRequestException("Le remboursement attendu « ne doit être comptabilisé que s'il est CERTAIN que l'entité le recevra » " +
                    '(§ 3.1.4). Tant que la certitude n\'est pas acquise, ne portez pas de montant · un remboursement ' +
                    'probable est un ACTIF ÉVENTUEL, qui « ne peut pas être comptabilisé » (§ 1.1.4) et se mentionne ' +
                    'aux Notes annexes.');
            }
        }
    }
    async creer(tenantId, exerciceId, dto, utilisateur) {
        await this.controler(tenantId, dto, {
            obligationExiste: false,
            resulteEvenementPasse: false,
            sortieProbable: false,
            estimationFiable: false,
        });
        await this.verifierCompte(tenantId, dto.nature, dto.compteId, dto.courtTerme ?? false);
        if ((0, court_terme_et_conditions_1.horizonAJuger)(dto.statut ?? client_1.StatutProvision.EN_EXAMEN, ProvisionsService_1.montantCloture(dto))) {
            const refus = await this.lireHorizon(tenantId, exerciceId, dto.courtTerme ?? false, dto.echeanceAttendue ? new Date(dto.echeanceAttendue) : null);
            if (refus)
                throw new common_1.BadRequestException(refus.refus);
        }
        return this.prisma.provisionRisqueCharge.create({
            data: {
                tenantId,
                exerciceId,
                objet: dto.objet,
                nature: dto.nature,
                compteId: dto.compteId ?? null,
                statut: dto.statut ?? client_1.StatutProvision.EN_EXAMEN,
                obligationExiste: dto.obligationExiste ?? false,
                resulteEvenementPasse: dto.resulteEvenementPasse ?? false,
                sortieProbable: dto.sortieProbable ?? false,
                estimationFiable: dto.estimationFiable ?? false,
                justificationObligation: dto.justificationObligation,
                echeanceAttendue: dto.echeanceAttendue ? new Date(dto.echeanceAttendue) : null,
                incertitudes: dto.incertitudes ?? null,
                montantOuverture: dto.montantOuverture ?? 0,
                dotationsExercice: dto.dotationsExercice ?? 0,
                montantsUtilises: dto.montantsUtilises ?? 0,
                reprisesNonUtilisees: dto.reprisesNonUtilisees ?? 0,
                effetActualisation: dto.effetActualisation ?? 0,
                remboursementAttendu: dto.remboursementAttendu ?? null,
                remboursementCertain: dto.remboursementCertain ?? false,
                remboursementTiers: dto.remboursementTiers ?? null,
                motifNonComptabilisation: dto.motifNonComptabilisation ?? null,
                courtTerme: dto.courtTerme ?? false,
                conditionsPropres: dto.conditionsPropres ?? client_1.Prisma.DbNull,
                createdBy: utilisateur,
            },
        });
    }
    async lireHorizon(tenantId, exerciceId, courtTerme, echeance) {
        if (!echeance)
            return null;
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { dateFin: true } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable.');
        const refus = (0, court_terme_et_conditions_1.motifRefusHorizon)(courtTerme, echeance, exercice.dateFin);
        return refus ? { refus, avertissement: (0, court_terme_et_conditions_1.avertissementHorizon)(courtTerme, echeance, exercice.dateFin) } : null;
    }
    async modifier(tenantId, id, dto) {
        const existante = await this.prisma.provisionRisqueCharge.findFirst({ where: { id, tenantId } });
        if (!existante)
            throw new common_1.NotFoundException('Provision introuvable.');
        await this.controler(tenantId, { ...dto, nature: dto.nature ?? existante.nature, statut: dto.statut ?? existante.statut }, existante);
        const courtTerme = dto.courtTerme ?? existante.courtTerme;
        await this.verifierCompte(tenantId, dto.nature ?? existante.nature, dto.compteId !== undefined ? dto.compteId : existante.compteId, courtTerme);
        const echeance = dto.echeanceAttendue !== undefined ? (dto.echeanceAttendue ? new Date(dto.echeanceAttendue) : null) : existante.echeanceAttendue;
        const changeHorizon = (dto.compteId !== undefined && dto.compteId !== existante.compteId) ||
            (dto.courtTerme !== undefined && dto.courtTerme !== existante.courtTerme) ||
            (dto.echeanceAttendue !== undefined && (echeance?.getTime() ?? null) !== (existante.echeanceAttendue?.getTime() ?? null));
        const apres = {
            montantOuverture: dto.montantOuverture ?? existante.montantOuverture,
            dotationsExercice: dto.dotationsExercice ?? existante.dotationsExercice,
            montantsUtilises: dto.montantsUtilises ?? existante.montantsUtilises,
            reprisesNonUtilisees: dto.reprisesNonUtilisees ?? existante.reprisesNonUtilisees,
            effetActualisation: dto.effetActualisation ?? existante.effetActualisation,
        };
        const avertissements = [];
        if ((0, court_terme_et_conditions_1.horizonAJuger)(dto.statut ?? existante.statut, ProvisionsService_1.montantCloture(apres))) {
            const horizon = await this.lireHorizon(tenantId, existante.exerciceId, courtTerme, echeance);
            if (horizon && changeHorizon)
                throw new common_1.BadRequestException(horizon.refus);
            if (horizon?.avertissement)
                avertissements.push(horizon.avertissement);
        }
        const miseAJour = await this.prisma.provisionRisqueCharge.update({
            where: { id },
            data: {
                ...(dto.objet !== undefined ? { objet: dto.objet } : {}),
                ...(dto.nature !== undefined ? { nature: dto.nature } : {}),
                ...(dto.compteId !== undefined ? { compteId: dto.compteId } : {}),
                ...(dto.statut !== undefined ? { statut: dto.statut } : {}),
                ...(dto.obligationExiste !== undefined ? { obligationExiste: dto.obligationExiste } : {}),
                ...(dto.resulteEvenementPasse !== undefined ? { resulteEvenementPasse: dto.resulteEvenementPasse } : {}),
                ...(dto.sortieProbable !== undefined ? { sortieProbable: dto.sortieProbable } : {}),
                ...(dto.estimationFiable !== undefined ? { estimationFiable: dto.estimationFiable } : {}),
                ...(dto.justificationObligation !== undefined
                    ? { justificationObligation: dto.justificationObligation }
                    : {}),
                ...(dto.echeanceAttendue !== undefined
                    ? { echeanceAttendue: dto.echeanceAttendue ? new Date(dto.echeanceAttendue) : null }
                    : {}),
                ...(dto.incertitudes !== undefined ? { incertitudes: dto.incertitudes } : {}),
                ...(dto.montantOuverture !== undefined ? { montantOuverture: dto.montantOuverture } : {}),
                ...(dto.dotationsExercice !== undefined ? { dotationsExercice: dto.dotationsExercice } : {}),
                ...(dto.montantsUtilises !== undefined ? { montantsUtilises: dto.montantsUtilises } : {}),
                ...(dto.reprisesNonUtilisees !== undefined ? { reprisesNonUtilisees: dto.reprisesNonUtilisees } : {}),
                ...(dto.effetActualisation !== undefined ? { effetActualisation: dto.effetActualisation } : {}),
                ...(dto.remboursementAttendu !== undefined ? { remboursementAttendu: dto.remboursementAttendu } : {}),
                ...(dto.remboursementCertain !== undefined ? { remboursementCertain: dto.remboursementCertain } : {}),
                ...(dto.remboursementTiers !== undefined ? { remboursementTiers: dto.remboursementTiers } : {}),
                ...(dto.motifNonComptabilisation !== undefined
                    ? { motifNonComptabilisation: dto.motifNonComptabilisation }
                    : {}),
                ...(dto.courtTerme !== undefined ? { courtTerme: dto.courtTerme } : {}),
                ...(dto.conditionsPropres !== undefined ? { conditionsPropres: dto.conditionsPropres ?? client_1.Prisma.DbNull } : {}),
            },
        });
        return { ...miseAJour, avertissements };
    }
    async statuer(tenantId, id, dto) {
        return this.modifier(tenantId, id, {
            statut: dto.statut,
            motifNonComptabilisation: dto.motifNonComptabilisation,
        });
    }
    async supprimer(tenantId, id) {
        const existante = await this.prisma.provisionRisqueCharge.findFirst({ where: { id, tenantId } });
        if (!existante)
            throw new common_1.NotFoundException('Provision introuvable.');
        await this.prisma.provisionRisqueCharge.delete({ where: { id } });
        return { supprimee: true };
    }
    async lister(tenantId, exerciceId) {
        return this.prisma.provisionRisqueCharge.findMany({
            where: { tenantId, exerciceId },
            include: { compte: { select: { numero: true, intitule: true } } },
            orderBy: [{ nature: 'asc' }, { objet: 'asc' }],
        });
    }
    async tableauDeVariation(tenantId, exerciceId) {
        const [lignes, balance] = await Promise.all([
            this.lister(tenantId, exerciceId),
            this.ecritures.balance(tenantId, exerciceId, true),
        ]);
        const soldeParNumero = new Map();
        for (const l of balance.lignes)
            soldeParNumero.set(l.numero, Math.abs(Number(l.solde ?? 0)));
        const detail = lignes.map((l) => ({
            id: l.id,
            objet: l.objet,
            nature: l.nature,
            statut: l.statut,
            compte: l.compte ? { numero: l.compte.numero, intitule: l.compte.intitule } : null,
            montantOuverture: Number(l.montantOuverture),
            dotationsExercice: Number(l.dotationsExercice),
            montantsUtilises: Number(l.montantsUtilises),
            reprisesNonUtilisees: Number(l.reprisesNonUtilisees),
            effetActualisation: Number(l.effetActualisation),
            montantCloture: ProvisionsService_1.montantCloture(l),
            remboursementAttendu: l.remboursementAttendu === null ? null : Number(l.remboursementAttendu),
            echeanceAttendue: l.echeanceAttendue,
            conditionsManquantes: [
                ...ProvisionsService_1.conditionsManquantes(l),
                ...(0, court_terme_et_conditions_1.conditionsPropresManquantes)(l.nature, l.conditionsPropres),
            ],
            courtTerme: l.courtTerme,
        }));
        const parCompte = new Map();
        for (const l of lignes) {
            if (l.statut !== client_1.StatutProvision.COMPTABILISEE || !l.compte)
                continue;
            const cle = l.compte.numero;
            const cumul = parCompte.get(cle) ?? { numero: cle, registre: 0 };
            cumul.registre = Number((cumul.registre + ProvisionsService_1.montantCloture(l)).toFixed(2));
            parCompte.set(cle, cumul);
        }
        const rapprochement = [...parCompte.values()].map((c) => {
            const solde = soldeParNumero.get(c.numero) ?? 0;
            return {
                numero: c.numero,
                montantRegistre: c.registre,
                soldeComptable: solde,
                ecart: Number((c.registre - solde).toFixed(2)),
            };
        });
        const somme = (cle) => Number(detail.reduce((t, l) => t + Number(l[cle] ?? 0), 0).toFixed(2));
        return {
            detail,
            totaux: {
                montantOuverture: somme('montantOuverture'),
                dotationsExercice: somme('dotationsExercice'),
                montantsUtilises: somme('montantsUtilises'),
                reprisesNonUtilisees: somme('reprisesNonUtilisees'),
                effetActualisation: somme('effetActualisation'),
                montantCloture: somme('montantCloture'),
            },
            rapprochement,
            passifsEventuels: detail.filter((l) => l.statut === client_1.StatutProvision.PASSIF_EVENTUEL),
            natures: ProvisionsService_1.naturesDuReferentiel(await this.referentielDu(tenantId)),
            comptesCourtTerme: (0, court_terme_et_conditions_1.comptesCourtTerme)(await this.referentielDu(tenantId)),
            conditionsPropres: court_terme_et_conditions_1.CONDITIONS_PROPRES,
        };
    }
    async reporterALOuverture(tenantId, exerciceSourceId, exerciceCibleId, utilisateur) {
        const sources = await this.prisma.provisionRisqueCharge.findMany({
            where: { tenantId, exerciceId: exerciceSourceId },
        });
        const aReporter = sources.filter((l) => {
            if (l.statut === client_1.StatutProvision.SOLDEE)
                return false;
            if (l.statut === client_1.StatutProvision.PASSIF_EVENTUEL)
                return true;
            return ProvisionsService_1.montantCloture(l) !== 0;
        });
        const deja = await this.prisma.provisionRisqueCharge.findMany({
            where: { tenantId, exerciceId: exerciceCibleId },
            select: { objet: true, nature: true },
        });
        const dejaPresent = new Set(deja.map((l) => `${l.nature}::${l.objet}`));
        let reportees = 0;
        for (const l of aReporter) {
            if (dejaPresent.has(`${l.nature}::${l.objet}`))
                continue;
            await this.prisma.provisionRisqueCharge.create({
                data: {
                    tenantId,
                    exerciceId: exerciceCibleId,
                    objet: l.objet,
                    nature: l.nature,
                    compteId: l.compteId,
                    statut: l.statut,
                    obligationExiste: l.obligationExiste,
                    resulteEvenementPasse: l.resulteEvenementPasse,
                    sortieProbable: l.sortieProbable,
                    estimationFiable: l.estimationFiable,
                    justificationObligation: l.justificationObligation,
                    echeanceAttendue: l.echeanceAttendue,
                    incertitudes: l.incertitudes,
                    montantOuverture: ProvisionsService_1.montantCloture(l),
                    dotationsExercice: 0,
                    montantsUtilises: 0,
                    reprisesNonUtilisees: 0,
                    effetActualisation: 0,
                    remboursementAttendu: null,
                    remboursementCertain: false,
                    remboursementTiers: l.remboursementTiers,
                    motifNonComptabilisation: l.motifNonComptabilisation,
                    courtTerme: l.courtTerme,
                    conditionsPropres: l.conditionsPropres ?? client_1.Prisma.DbNull,
                    createdBy: utilisateur,
                },
            });
            reportees += 1;
        }
        return { reportees, examinees: sources.length, ignorees: sources.length - reportees };
    }
};
exports.ProvisionsService = ProvisionsService;
ProvisionsService.INTERDICTIONS = {
    [client_1.NatureProvision.PERTES_OPERATIONNELLES_FUTURES]: "Ch. 18 § 4.11.1 : les pertes opérationnelles futures « ne répondent pas aux critères généraux de " +
        "comptabilisation. En particulier, il n'existe pas d'obligation actuelle résultant d'un événement passé. " +
        "Il n'est donc pas possible d'enregistrer une provision pour pertes opérationnelles futures. » " +
        "Si un ACTIF a perdu de la valeur, la voie est la DÉPRÉCIATION (comptes 29, 39, 49, 59), pas la provision.",
    [client_1.NatureProvision.GROSSES_REPARATIONS]: 'Ch. 18 § 4.11.2 : « Les provisions pour grosses réparations sont INTERDITES ; cependant, elles peuvent ' +
        "être enregistrées comme COMPOSANT DISTINCT du coût d'acquisition ou comme une CHARGE. » La voie est " +
        "l'approche par composants du module Immobilisations (composant « révisions majeures »), ou la charge de " +
        "l'exercice où les travaux sont engagés.",
};
exports.ProvisionsService = ProvisionsService = ProvisionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], ProvisionsService);
//# sourceMappingURL=provisions.service.js.map