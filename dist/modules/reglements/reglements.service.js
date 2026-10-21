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
var ReglementsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReglementsService = void 0;
exports.motifANouveauProvisoire = motifANouveauProvisoire;
exports.avecLeMode = avecLeMode;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const lettrage_service_1 = require("../lettrage/lettrage.service");
const paires_a_cheval_1 = require("../lettrage/paires-a-cheval");
const gel_cloture_1 = require("../exercice/gel-cloture");
const ligne_en_devise_1 = require("../comptabilite/ligne-en-devise");
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const ecart_change_realise_1 = require("./ecart-change-realise");
const compte_ecart_change_1 = require("./compte-ecart-change");
const lignes_de_reevaluation_1 = require("./lignes-de-reevaluation");
const reevaluation_et_ecart_realise_1 = require("./reevaluation-et-ecart-realise");
const ordres_virement_service_1 = require("./ordres-virement.service");
const modes_reglement_service_1 = require("./modes-reglement.service");
const modes_reglement_1 = require("./modes-reglement");
const transactions_art_59_bis_1 = require("./transactions-art-59-bis");
const ecart_escompte_1 = require("./ecart-escompte");
const faits_declares_1 = require("../tenant/faits-declares");
const lettrage_partiel_1 = require("./lettrage-partiel");
const reconduction_lettrage_1 = require("../lettrage/reconduction-lettrage");
const reglement_tiers_1 = require("./reglement-tiers");
let ReglementsService = ReglementsService_1 = class ReglementsService {
    constructor(prisma, ecritures, lettrage, ordres) {
        this.prisma = prisma;
        this.ecritures = ecritures;
        this.lettrage = lettrage;
        this.ordres = ordres;
        this.journalServeur = new common_1.Logger(ReglementsService_1.name);
    }
    async echeances(tenantId, exerciceId, sens, jusquau) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        const limite = jusquau ? new Date(jusquau) : null;
        const include = {
            ecriture: {
                select: {
                    date: true,
                    libelle: true,
                    reference: true,
                    numeroPiece: true,
                    estANouveauProvisoire: true,
                    estGenereeParCloture: true,
                    estSoldeDesComptesDeGestion: true,
                    journal: { select: { code: true } },
                },
            },
            compte: { select: { id: true, numero: true, intitule: true, tiersCompte: { select: { tiers: { select: { nom: true, code: true } } } } } },
            devise: { select: { code: true } },
        };
        const ordre = [{ compteId: 'asc' }, { ecriture: { date: 'asc' } }, { id: 'asc' }];
        const libres = await this.prisma.ligneEcriture.findMany({
            where: {
                ecriture: { tenantId, exerciceId, ...ecritures_de_situation_1.HORS_SITUATION },
                lettrageId: null,
                compte: { tenantId, numero: { startsWith: sens === 'FOURNISSEUR' ? '40' : '41' } },
                ...(sens === 'FOURNISSEUR' ? { credit: { gt: 0 } } : { debit: { gt: 0 } }),
            },
            include,
            orderBy: ordre,
        });
        const partielles = await (0, lettrage_partiel_1.echeancesDesGroupesPartiels)(this.prisma, { tenantId, exerciceId, sens });
        const resteDeLaLigne = new Map(partielles.map((x) => [x.ligneId, x]));
        const lignesPartielles = partielles.length
            ? await this.prisma.ligneEcriture.findMany({ where: { id: { in: partielles.map((x) => x.ligneId) }, ecriture: { tenantId, exerciceId } }, include, orderBy: ordre })
            : [];
        const lignes = [...libres, ...lignesPartielles].sort((a, b) => (a.compteId < b.compteId ? -1 : a.compteId > b.compteId ? 1 : 0) || a.ecriture.date.getTime() - b.ecriture.date.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        const dueAvant = (l) => !limite || (l.dateEcheance ?? l.ecriture.date).getTime() <= limite.getTime();
        const paires = lignes.some((l) => (0, transactions_art_59_bis_1.estDAnouveau)(l.ecriture))
            ? await (0, paires_a_cheval_1.pairesACheval)(this.prisma, { tenantId, exercice, compte: { numero: { startsWith: sens === 'FOURNISSEUR' ? '40' : '41' } } })
            : null;
        const ecartsDeReevaluation = await (0, lignes_de_reevaluation_1.lignesDeReevaluationSurLesTiers)(this.prisma, {
            tenantId,
            exercice,
            compteIds: [...new Set(lignes.filter((l) => l.deviseId === null).map((l) => l.compteId))],
        });
        const aRegler = lignes.filter((l) => (0, reglement_tiers_1.estEcheanceAReglerSur)(l.compte.numero, sens) && !paires?.absorbees.has(l.id) && !ecartsDeReevaluation.has(l.id));
        const ecartees = new Map();
        for (const l of aRegler) {
            if (l.ecriture.estANouveauProvisoire === true && dueAvant(l))
                ecartees.set(l.compteId, (ecartees.get(l.compteId) ?? 0) + 1);
        }
        const retenues = aRegler
            .filter((l) => l.ecriture.estANouveauProvisoire !== true)
            .map((l) => {
            const partielle = resteDeLaLigne.get(l.id);
            const due = ligneDue(l, paires, partielle ? new Map([[l.id, { sens, reste: partielle.reste }]]) : null);
            const entiere = (0, reglement_tiers_1.montantDu)({ debit: Number(l.debit), credit: Number(l.credit) }, sens);
            const montant = (0, reglement_tiers_1.montantDu)({ debit: Number(due.debit), credit: Number(due.credit) }, sens);
            const reste = paires?.reste.get(l.id);
            return {
                id: l.id,
                compteId: l.compteId,
                echeance: l.dateEcheance ?? l.ecriture.date,
                date: l.ecriture.date,
                journalCode: l.ecriture.journal.code,
                numeroPiece: l.ecriture.numeroPiece,
                reference: l.ecriture.reference,
                libelle: l.libelle ?? l.ecriture.libelle,
                montant,
                deviseId: l.deviseId ?? null,
                deviseCode: l.devise?.code ?? null,
                montantDevise: partielle?.reste.deviseIndeterminee || due.montantDevise === null || due.montantDevise === undefined ? null : Number(due.montantDevise),
                coursApplique: l.coursApplique === null || l.coursApplique === undefined ? null : Number(l.coursApplique),
                regleParLettrageACheval: reste ? { groupe: reste.groupe, montant: Math.round((entiere - montant) * 100) / 100 } : null,
                regleParLettragePartiel: partielle
                    ? {
                        groupe: partielle.groupe.code.toLowerCase(),
                        montant: partielle.reste.regle,
                        ...(partielle.reste.deviseIndeterminee ? { deviseIndeterminee: true } : {}),
                    }
                    : null,
            };
        })
            .filter((l) => l.montant > 0 && (!limite || l.echeance.getTime() <= limite.getTime()));
        const reclassees = sens === 'CLIENT' ? await this.creancesReclasseesDesComptes(tenantId, [...new Set(aRegler.map((l) => l.compteId))]) : [];
        const parCompte = new Map();
        const groupeDe = (c) => {
            if (!parCompte.has(c.id)) {
                const r = reclassees.find((x) => x.compteId === c.id);
                parCompte.set(c.id, {
                    compteId: c.id,
                    numero: c.numero,
                    intitule: c.intitule,
                    tiers: c.tiersCompte ? `${c.tiersCompte.tiers.code} · ${c.tiersCompte.tiers.nom}` : null,
                    creanceReclassee: r ? { compte416: r.compte416, date: r.date } : null,
                    lignes: [],
                    aNouveauProvisoireEcartees: ecartees.get(c.id) ?? 0,
                });
            }
            return parCompte.get(c.id);
        };
        const parId = new Map(retenues.map((x) => [x.id, x]));
        for (const l of aRegler) {
            const retenue = parId.get(l.id);
            if (retenue)
                groupeDe(l.compte).lignes.push(retenue);
            else if (ecartees.has(l.compteId))
                groupeDe(l.compte);
        }
        return [...parCompte.values()];
    }
    async creancesReclasseesDesComptes(tenantId, comptes) {
        if (comptes.length === 0)
            return [];
        const creances = await this.prisma.creanceDouteuse.findMany({
            where: { tenantId, annuleeLe: null, corrigeeParResultatLe: null, compteCreanceId: { in: comptes } },
            select: { compteCreanceId: true, dateReclassement: true, compte416: { select: { numero: true } } },
            orderBy: { dateReclassement: 'desc' },
        });
        const vus = new Set();
        const rendues = [];
        for (const c of creances) {
            if (vus.has(c.compteCreanceId))
                continue;
            vus.add(c.compteCreanceId);
            rendues.push({ compteId: c.compteCreanceId, compte416: c.compte416.numero, date: c.dateReclassement.toISOString().slice(0, 10) });
        }
        return rendues;
    }
    async enregistrer(tenantId, userId, dto, email = userId) {
        const journal = await this.prisma.journal.findFirst({
            where: { id: dto.journalId, tenantId },
            include: { compteTresorerie: { select: { numero: true } } },
        });
        if (!journal)
            throw new common_1.NotFoundException('Journal introuvable pour ce dossier.');
        if (journal.type !== client_1.TypeJournal.TRESORERIE || !journal.compteTresorerieId) {
            throw new common_1.BadRequestException(`Le journal ${journal.code} n'est pas un journal de trésorerie rattaché à un compte de banque ou de caisse · ` +
                'un règlement se passe au journal du moyen de paiement.');
        }
        const compteTresorerieId = journal.compteTresorerieId;
        const mode = dto.modeReglementId ? await (0, modes_reglement_service_1.modeDuDossier)(this.prisma, tenantId, dto.modeReglementId) : null;
        const idsComptes = dto.reglements.map((r) => r.compteId);
        if (new Set(idsComptes).size !== idsComptes.length) {
            throw new common_1.BadRequestException('Un même tiers figure deux fois · ses factures se règlent en une seule pièce.');
        }
        const toutesLignes = dto.reglements.flatMap((r) => r.ligneIds);
        if (new Set(toutesLignes).size !== toutesLignes.length) {
            throw new common_1.BadRequestException('Une même facture figure dans deux règlements.');
        }
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: { id: { in: toutesLignes }, ecriture: { tenantId } },
            include: {
                compte: {
                    select: { numero: true, intitule: true, lettrable: true, tiersCompte: { select: { tiers: { select: { nom: true } } } } },
                },
                ecriture: {
                    select: {
                        exerciceId: true,
                        date: true,
                        estANouveauProvisoire: true,
                        estGenereeParCloture: true,
                        estSoldeDesComptesDeGestion: true,
                        numeroPiece: true,
                        libelle: true,
                        statut: true,
                    },
                },
            },
        });
        if (lignes.length !== toutesLignes.length) {
            throw new common_1.NotFoundException('Une ou plusieurs factures sont introuvables.');
        }
        const simulees = lignes.filter((l) => l.ecriture.statut === client_1.StatutEcriture.SITUATION);
        if (simulees.length > 0) {
            throw new common_1.BadRequestException(`${simulees.map((l) => `La pièce n° ${l.ecriture.numeroPiece ?? '·'} (${l.compte.numero})`).join(', ')} ` +
                `${simulees.length > 1 ? 'sont des écritures' : 'est une écriture'} de situation · ${simulees.length > 1 ? 'elles' : 'elle'} ` +
                "n'enregistre" + (simulees.length > 1 ? 'nt' : '') + " aucune opération et rien n'y est dû (AUDCIF art. 19). Aucune pièce de règlement n'est passée.");
        }
        let paires = null;
        if (lignes.some((l) => (0, transactions_art_59_bis_1.estDAnouveau)(l.ecriture))) {
            const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId }, select: { id: true, dateDebut: true } });
            if (!exercice)
                throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
            paires = await (0, paires_a_cheval_1.pairesACheval)(this.prisma, { tenantId, exercice, compte: { id: { in: idsComptes } } });
        }
        const avertissementsPaires = [];
        const { groupes, origines } = await (0, lettrage_partiel_1.groupesDesLignes)(this.prisma, tenantId, lignes.flatMap((l) => (l.lettrageId ? [l.lettrageId] : [])));
        const plan = dto.reglements.map((r) => {
            const lues = lignes.filter((l) => r.ligneIds.includes(l.id));
            for (const l of lues) {
                if (!l.lettrageId)
                    continue;
                const motif = (0, lettrage_partiel_1.motifLigneDuGroupe)(l.compte.numero, groupes.get(l.lettrageId), dto.exerciceId);
                if (motif)
                    throw new common_1.BadRequestException(motif);
            }
            const sesGroupes = [...new Set(lues.flatMap((l) => (l.lettrageId ? [l.lettrageId] : [])))].map((id) => groupes.get(id));
            const deux = (0, lettrage_partiel_1.motifDeuxGroupes)(lues[0]?.compte.numero ?? '', sesGroupes.map((g) => g.code));
            if (deux)
                throw new common_1.BadRequestException(deux);
            const groupe = sesGroupes[0] ?? null;
            const partiels = new Map();
            if (groupe) {
                const restes = (0, lettrage_partiel_1.restesDuGroupe)(groupe, dto.sens, origines);
                for (const l of lues) {
                    if (l.lettrageId !== groupe.id)
                        continue;
                    const reste = restes.get(l.id) ?? { francs: 0, devise: null, regle: 0, deviseIndeterminee: false };
                    if (reste.deviseIndeterminee)
                        throw new common_1.BadRequestException((0, lettrage_partiel_1.motifDeviseIndeterminee)(l.compte.numero, groupe.code));
                    if (reste.devise !== null && reste.devise <= 0 && reste.francs > 0) {
                        throw new common_1.BadRequestException(`${l.compte.numero} · la facture choisie est réglée en entier dans sa devise par le lettrage partiel ${groupe.code.toLowerCase()} · ` +
                            `il en reste ${reste.francs.toFixed(2)} en francs, un écart de change réalisé non passé (AUDCIF art. 55). Passez l’écart depuis ` +
                            'Interrogation et lettrage, rien ne se règle ici.');
                    }
                    partiels.set(l.id, { sens: dto.sens, reste });
                }
            }
            for (const l of lues) {
                if (paires?.absorbees.has(l.id)) {
                    throw new common_1.BadRequestException(`${l.compte.numero} · la ligne d'à-nouveau choisie est déjà réglée par le lettrage ${paires.groupeDe.get(l.id) ?? ''} ` +
                        "à cheval de deux exercices · sa facture d'origine y est lettrée avec un règlement de cet exercice. Elle n'est plus due ; " +
                        "ne la lettrez avec aucun autre règlement.");
                }
                const reste = paires?.reste.get(l.id);
                if (reste) {
                    avertissementsPaires.push(`${l.compte.numero} · la ligne d'à-nouveau du ${l.ecriture.date.toISOString().slice(0, 10)} est réglée en partie par le lettrage ` +
                        `${reste.groupe} à cheval de deux exercices · seul son reste est dû, et son lettrage avec ce règlement restera partiel de ce que ` +
                        'le groupe a réglé.');
                }
            }
            const siennes = lues.map((l) => ({ ...l, ...ligneDue(l, paires, partiels) }));
            for (const l of siennes) {
                if (l.compteId !== r.compteId) {
                    throw new common_1.BadRequestException('Toutes les factures d\'un règlement doivent être sur le compte du tiers réglé.');
                }
                if (!(0, reglement_tiers_1.estEcheanceAReglerSur)(l.compte.numero, dto.sens)) {
                    throw new common_1.BadRequestException((0, reglement_tiers_1.motifHorsEcheance)(l.compte.numero));
                }
                if (!l.compte.lettrable) {
                    throw new common_1.BadRequestException(`Le compte ${l.compte.numero} n'est pas déclaré lettrable · le règlement lettre ses factures. ` +
                        'Ouvrez-le au lettrage depuis le plan comptable avant de régler.');
                }
                if (l.ecriture.exerciceId !== dto.exerciceId) {
                    throw new common_1.BadRequestException('Les factures réglées doivent appartenir à l\'exercice du règlement.');
                }
                if (l.ecriture.estANouveauProvisoire === true) {
                    throw new common_1.BadRequestException(motifANouveauProvisoire(l.compte.numero));
                }
            }
            const du = Math.round(siennes.reduce((s, l) => s + (0, reglement_tiers_1.montantDu)({ debit: Number(l.debit), credit: Number(l.credit) }, dto.sens), 0) * 100) / 100;
            if (!(du > 0)) {
                throw new common_1.BadRequestException(`Rien n'est dû sur les factures choisies du compte ${siennes[0].compte.numero}.`);
            }
            return {
                r,
                compte: siennes[0].compte,
                siennes,
                du,
                reduite: lues.some((l) => paires?.reste.has(l.id) === true),
                groupe: groupe
                    ? {
                        id: groupe.id,
                        code: groupe.code,
                        lu: groupe,
                        lignes: groupe.lignes.map((l) => l.id),
                        solde: (0, reconduction_lettrage_1.resteDuGroupe)(groupe),
                        regle: Math.round([...partiels.values()].reduce((t, x) => t + x.reste.regle, 0) * 100) / 100,
                        duDevise: Math.round(siennes.reduce((t, l) => t + Number(l.montantDevise ?? 0), 0) * 100) / 100,
                    }
                    : null,
            };
        });
        let referentiel = null;
        const prepares = [];
        const avertissementsImputation = [];
        const candidatsParRole = new Map();
        let seuilDuDossier;
        const compteDuRoleOuRefus = async (numero, role, choisi) => {
            if (referentiel === null)
                referentiel = await (0, compte_ecart_change_1.referentielDuDossier)(this.prisma, tenantId);
            if (!candidatsParRole.has(role))
                candidatsParRole.set(role, await this.candidatsEcartEscompte(tenantId, referentiel, role));
            const r = (0, ecart_escompte_1.compteDuRole)(referentiel, role, candidatsParRole.get(role), choisi);
            if ('motif' in r)
                throw new common_1.BadRequestException(`${numero} · ${r.motif}`);
            return r.compte.id;
        };
        for (const p of plan) {
            const numero = p.compte.numero;
            const dus = new Map(p.siennes.map((l) => [l.id, (0, reglement_tiers_1.montantDu)({ debit: Number(l.debit), credit: Number(l.credit) }, dto.sens)]));
            const enDeviseP = p.siennes.some((l) => (l.deviseId ?? null) !== null);
            if (p.r.imputation !== undefined && p.groupe) {
                throw new common_1.BadRequestException(`${numero} · une facture du lettrage partiel ${p.groupe.code.toLowerCase()} se règle seule, sans part désignée · son reste suit ` +
                    'l’imputation du groupe. Retirez-la de ce règlement pour désigner les parts des autres.');
            }
            if (p.r.imputation !== undefined) {
                const motif = (0, reglement_tiers_1.motifRefusImputationReglement)({
                    sens: dto.sens,
                    parts: p.r.imputation,
                    dus,
                    montant: enDeviseP ? 0 : p.r.montant === undefined ? p.du : p.r.montant,
                    enDevise: enDeviseP,
                    reduite: p.reduite,
                    ordreVirement: dto.ordreVirement === true,
                    pieceImputation: p.r.pieceImputation ?? null,
                });
                if (motif)
                    throw new common_1.BadRequestException(`${numero} · ${motif}`);
            }
            else if (p.r.pieceImputation !== undefined) {
                throw new common_1.BadRequestException(`${numero} · la pièce de l’imputation n’a d’objet qu’avec la part désignée de chaque facture.`);
            }
            const avecEscompteOuEcart = p.r.escompte !== undefined || p.r.solderEcart === true;
            if (p.r.compteEscompteId !== undefined && p.r.escompte === undefined) {
                throw new common_1.BadRequestException(`${numero} · le compte de l’escompte n’a d’objet qu’avec un escompte.`);
            }
            if (p.r.compteEcartId !== undefined && p.r.solderEcart !== true) {
                throw new common_1.BadRequestException(`${numero} · le compte de l’écart n’a d’objet qu’avec « Solder l’écart ».`);
            }
            if (avecEscompteOuEcart && p.r.imputation !== undefined) {
                throw new common_1.BadRequestException(`${numero} · un escompte ou un écart de règlement ne se passe pas avec la part désignée de chaque facture · réglez sans parts désignées, ou passez-le à part.`);
            }
            if (avecEscompteOuEcart && enDeviseP) {
                throw new common_1.BadRequestException(`${numero} · les factures choisies sont en devise · ni escompte ni écart de règlement sur ce règlement ; réglez-le dans sa devise et passez-les à part.`);
            }
            if (!enDeviseP) {
                if (p.r.montantDevise !== undefined || p.r.coursReglement !== undefined || p.r.compteEcartChangeId !== undefined) {
                    throw new common_1.BadRequestException(`${numero} · les factures choisies sont en francs · ni montant en devise, ni cours, ni compte d'écart de change.`);
                }
                const escompte = p.r.escompte ?? 0;
                const montant = p.r.montant === undefined ? Math.round((p.du - escompte) * 100) / 100 : p.r.montant;
                let tiers = montant;
                let ecart = 0;
                let compteEscompteId = null;
                let compteEcartId = null;
                let plan = null;
                if (avecEscompteOuEcart) {
                    if (referentiel === null)
                        referentiel = await (0, compte_ecart_change_1.referentielDuDossier)(this.prisma, tenantId);
                    if (seuilDuDossier === undefined)
                        seuilDuDossier = await this.seuilEcartReglement(tenantId);
                    const planE = (0, ecart_escompte_1.planDuReglement)({
                        sens: dto.sens,
                        referentiel,
                        numeroTiers: numero,
                        du: p.du,
                        montant,
                        escompte,
                        solderEcart: p.r.solderEcart === true,
                        seuil: seuilDuDossier,
                    });
                    if ('motif' in planE)
                        throw new common_1.BadRequestException(`${numero} · ${planE.motif}`);
                    plan = planE;
                    tiers = planE.tiers;
                    ecart = planE.ecart;
                    if (escompte > 0)
                        compteEscompteId = await compteDuRoleOuRefus(numero, (0, ecart_escompte_1.roleEscompte)(dto.sens), p.r.compteEscompteId);
                    if (ecart > 0)
                        compteEcartId = await compteDuRoleOuRefus(numero, 'ECART_REGLEMENT', p.r.compteEcartId);
                }
                const auDelaDuReste = p.groupe ? (0, lettrage_partiel_1.motifRefusMontantDuGroupe)(numero, tiers, p.du, p.groupe.code, p.groupe.regle) : null;
                if (auDelaDuReste)
                    throw new common_1.BadRequestException(auDelaDuReste);
                if (p.groupe) {
                    const avertissement = (0, lettrage_partiel_1.avertissementImputationDuGroupe)({
                        numero,
                        groupe: p.groupe.lu,
                        origines,
                        sens: dto.sens,
                        choisies: p.r.ligneIds,
                        date: new Date(dto.date),
                        montant: tiers,
                        deviseId: null,
                    });
                    if (avertissement)
                        avertissementsImputation.push(avertissement);
                }
                const refus = avecEscompteOuEcart ? null : (0, reglement_tiers_1.motifRefusMontant)(montant, p.du);
                if (refus)
                    throw new common_1.BadRequestException(`${numero} · ${refus}`);
                let parts = null;
                if (p.r.imputation !== undefined) {
                    const libelles = (0, reglement_tiers_1.libellesDesParts)(`Règlement ${p.compte.tiersCompte?.tiers.nom ?? p.compte.intitule}`, p.r.imputation.map((x) => {
                        const l = p.siennes.find((s) => s.id === x.ligneId);
                        return { id: x.ligneId, reference: l.ecriture.numeroPiece ? `pièce ${l.ecriture.numeroPiece}` : l.ecriture.libelle || 'facture' };
                    }));
                    const referenceDe = (id) => {
                        const l = p.siennes.find((s) => s.id === id);
                        return l.ecriture.numeroPiece ? `pièce ${l.ecriture.numeroPiece}` : l.ecriture.libelle || 'facture';
                    };
                    parts = p.r.imputation.map((x) => ({
                        ligneId: x.ligneId,
                        montant: x.montant,
                        du: dus.get(x.ligneId),
                        libelle: libelles.get(x.ligneId),
                        reference: referenceDe(x.ligneId),
                    }));
                }
                else if (p.siennes.length > 1 && Math.round(tiers * 100) < Math.round(p.du * 100)) {
                    avertissementsImputation.push(dto.sens === 'FOURNISSEUR'
                        ? `${numero} · règlement partiel de ${p.siennes.length} factures sans part désignée · la déduction de leur TVA suit ` +
                            'l’imputation légale (Code civil, Livre III, art. 154 · les échues d’abord, la plus ancienne, au prorata à date ' +
                            'égale). Désignez la part de chaque facture pour la fixer (art. 151).'
                        : `${numero} · règlement partiel de ${p.siennes.length} factures · la TVA exigible suit l’imputation déclarée par le ` +
                            'client (art. 151) ou la quittance qu’il a acceptée (art. 153), à déclarer avec sa pièce une fois le règlement ' +
                            'validé, sinon l’imputation légale (art. 154 · les échues d’abord, la plus ancienne, au prorata à date égale).');
                }
                prepares.push({
                    r: p.r,
                    compte: p.compte,
                    du: p.du,
                    montant,
                    tiers,
                    escompte,
                    ecart,
                    compteEscompteId,
                    compteEcartId,
                    plan,
                    enDevise: null,
                    reduite: p.reduite,
                    parts,
                    groupe: p.groupe,
                });
                continue;
            }
            if (p.groupe && p.r.montantDevise !== undefined) {
                const auDelaDuReste = (0, lettrage_partiel_1.motifRefusMontantDuGroupe)(numero, p.r.montantDevise, p.groupe.duDevise, p.groupe.code, p.groupe.regle, true);
                if (auDelaDuReste)
                    throw new common_1.BadRequestException(auDelaDuReste);
            }
            if (p.groupe) {
                const deviseId = p.siennes.find((l) => l.deviseId)?.deviseId ?? null;
                const avertissement = deviseId
                    ? (0, lettrage_partiel_1.avertissementImputationDuGroupe)({
                        numero,
                        groupe: p.groupe.lu,
                        origines,
                        sens: dto.sens,
                        choisies: p.r.ligneIds,
                        date: new Date(dto.date),
                        montant: p.r.montantDevise ?? p.groupe.duDevise,
                        deviseId,
                    })
                    : null;
                if (avertissement)
                    avertissementsImputation.push(avertissement);
            }
            let fileDuCout = null;
            if (p.groupe) {
                const deviseDuReglement = p.siennes.find((l) => l.deviseId)?.deviseId ?? null;
                const file = deviseDuReglement ? (0, lettrage_partiel_1.fileDuGroupeEnDevise)(p.groupe.lu, dto.sens, origines, deviseDuReglement) : [];
                if (file === null)
                    throw new common_1.BadRequestException((0, lettrage_partiel_1.motifDeviseIndeterminee)(numero, p.groupe.code));
                const horsDuGroupe = p.siennes
                    .filter((l) => !p.groupe.lignes.includes(l.id))
                    .map((l) => ({
                    id: l.id,
                    francs: (0, reglement_tiers_1.montantDu)({ debit: Number(l.debit), credit: Number(l.credit) }, dto.sens),
                    montantDevise: Number(l.montantDevise),
                    date: l.ecriture.date,
                }));
                fileDuCout = [...file, ...horsDuGroupe];
            }
            if (referentiel === null)
                referentiel = await (0, compte_ecart_change_1.referentielDuDossier)(this.prisma, tenantId);
            const enDevise = await this.preparerEnDevise(tenantId, dto.exerciceId, referentiel, dto.sens, p.r, numero, p.siennes, [...(paires?.absorbees ?? [])], fileDuCout);
            prepares.push({
                r: p.r,
                compte: p.compte,
                du: p.du,
                montant: enDevise.francsPayes,
                tiers: enDevise.francsPayes,
                escompte: 0,
                ecart: 0,
                compteEscompteId: null,
                compteEcartId: null,
                plan: null,
                enDevise,
                reduite: p.reduite,
                parts: null,
                groupe: p.groupe,
            });
        }
        {
            const idsDevises = [
                ...new Set([...prepares.flatMap((x) => (x.enDevise ? [x.enDevise.deviseId] : [])), ...(dto.deviseTresorerieId ? [dto.deviseTresorerieId] : [])]),
            ];
            const devisesLues = idsDevises.length
                ? await this.prisma.devise.findMany({ where: { tenantId, id: { in: idsDevises } }, select: { id: true, code: true } })
                : [];
            const code = (id) => devisesLues.find((d) => d.id === id)?.code ?? '?';
            if (dto.deviseTresorerieId !== undefined && !devisesLues.some((d) => d.id === dto.deviseTresorerieId)) {
                throw new common_1.NotFoundException('Devise du moyen de paiement introuvable pour ce dossier.');
            }
            if (dto.deviseTresorerieId !== undefined && dto.tresorerieEnDevise !== true) {
                throw new common_1.BadRequestException('Une devise de moyen de paiement ne se déclare qu’avec « Moyen de paiement en devise ».');
            }
            const rib = await this.prisma.ribBanque.findFirst({ where: { tenantId, journalId: journal.id }, select: { devise: true } });
            const motif = (0, ecart_change_realise_1.motifRefusTresorerieEnDevise)({
                tresorerieEnDevise: dto.tresorerieEnDevise === true,
                devisesDuLot: prepares.map((x) => (x.enDevise ? { id: x.enDevise.deviseId, code: code(x.enDevise.deviseId) } : null)),
                deviseTresorerie: dto.deviseTresorerieId ? { id: dto.deviseTresorerieId, code: code(dto.deviseTresorerieId) } : null,
                deviseRib: rib?.devise ?? null,
                monnaieDeTenue: monnaie_de_tenue_1.MONNAIE_DE_TENUE,
                journalCode: journal.code,
            });
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
        const avertissements = [...avertissementsPaires, ...avertissementsImputation];
        for (const c of dto.sens === 'CLIENT' ? await this.creancesReclasseesDesComptes(tenantId, idsComptes) : []) {
            const x = prepares.find((p) => p.r.compteId === c.compteId);
            if (!x)
                continue;
            const s = await this.prisma.ligneEcriture.aggregate({
                where: { compteId: c.compteId, ecriture: { tenantId, exerciceId: dto.exerciceId, ...ecritures_de_situation_1.HORS_SITUATION } },
                _sum: { debit: true, credit: true },
            });
            const net = Number(s._sum.debit ?? 0) - Number(s._sum.credit ?? 0);
            const refus = (0, reglement_tiers_1.motifReglementAuDelaDuNet)(x.compte.numero, c.compte416, c.date, net, x.montant);
            if (refus)
                throw new common_1.BadRequestException(refus);
            avertissements.push((0, reglement_tiers_1.avertissementCreanceReclassee)(x.compte.numero, c.compte416, c.date));
        }
        for (const x of prepares) {
            if (!x.enDevise)
                continue;
            if (x.enDevise.avertissement)
                avertissements.push(x.enDevise.avertissement);
            const motif = await (0, reevaluation_et_ecart_realise_1.motifReglementDejaReevalue)(this.prisma, {
                tenantId,
                exerciceId: dto.exerciceId,
                compteId: x.r.compteId,
                compteNumero: x.compte.numero,
                ligneIds: x.r.ligneIds,
            });
            if (motif)
                throw new common_1.ConflictException(motif);
            const avertissement = await (0, reevaluation_et_ecart_realise_1.avertissementExtourneManquante)(this.prisma, {
                tenantId,
                exerciceId: dto.exerciceId,
                compteId: x.r.compteId,
                compteNumero: x.compte.numero,
                ligneIds: x.r.ligneIds,
            });
            if (avertissement)
                avertissements.push(avertissement);
        }
        if (dto.sens === 'FOURNISSEUR') {
            const dossier = await this.prisma.tenant.findFirst({
                where: { id: tenantId },
                select: { assujettiTva: true, assujettissementTvaRepondu: true },
            });
            const nature = mode?.nature ?? (0, modes_reglement_1.natureLueSurLeCompte)(journal.compteTresorerie?.numero ?? null);
            const nature59 = nature !== null && !modes_reglement_1.NATURES_ADMISES_ART_59_BIS.has(nature);
            const transactions = nature59 ? await (0, transactions_art_59_bis_1.transactionsDesLignes)(this.prisma, { tenantId, exerciceId: dto.exerciceId, lignes }) : new Map();
            for (const p of plan) {
                const { jugees, sousCondition, nonJugees } = (0, transactions_art_59_bis_1.classerTransactions)(p.siennes.flatMap((l) => {
                    const t = transactions.get(l.id);
                    return t ? [t] : [];
                }), modes_reglement_1.SEUIL_ART_59_BIS);
                const avertissement = (0, modes_reglement_1.avertissementArt59Bis)({
                    sens: dto.sens,
                    date: new Date(dto.date),
                    dossierAssujetti: dossier ? (0, faits_declares_1.faitAssujettissementTva)(dossier) : null,
                    nature,
                    source: mode ? 'MODE' : 'COMPTE',
                    compte: p.compte.numero,
                    factures: jugees,
                    sousCondition,
                    nonJugees,
                });
                if (avertissement)
                    avertissements.push(avertissement);
            }
        }
        if (prepares.some((x) => x.escompte > 0 || x.ecart > 0)) {
            const dossier = await this.prisma.tenant.findFirst({
                where: { id: tenantId },
                select: { assujettiTva: true, assujettissementTvaRepondu: true },
            });
            const assujetti = dossier ? (0, faits_declares_1.faitAssujettissementTva)(dossier) : null;
            for (const x of prepares) {
                if (x.escompte > 0) {
                    const siennes = plan.find((pp) => pp.r === x.r)?.siennes ?? [];
                    const apres = (0, ecart_escompte_1.avertissementEscompteApresEcheance)(x.compte.numero, new Date(dto.date), siennes.flatMap((l) => l.dateEcheance ? [{ reference: l.ecriture.numeroPiece ? `pièce ${l.ecriture.numeroPiece}` : l.ecriture.libelle || 'facture', echeance: l.dateEcheance }] : []));
                    if (apres)
                        avertissements.push(apres);
                    if (assujetti !== false)
                        avertissements.push((0, ecart_escompte_1.avertissementTvaEscompte)(x.compte.numero, x.escompte));
                }
                if (x.ecart > 0 && dto.sens === 'CLIENT' && assujetti !== false)
                    avertissements.push((0, ecart_escompte_1.avertissementTvaEcart)(x.compte.numero, x.ecart));
            }
        }
        await (0, gel_cloture_1.refuserSiLignesFigees)(this.prisma, tenantId, [...new Set([...toutesLignes, ...prepares.flatMap((x) => x.groupe?.lignes ?? [])])], 'régler');
        let preparation = null;
        if (dto.ordreVirement) {
            if (dto.sens !== 'FOURNISSEUR') {
                throw new common_1.BadRequestException("Un ordre de virement paie un fournisseur · l'encaissement d'un client ne s'ordonne pas.");
            }
            preparation = await this.ordres.preparer(tenantId, dto.journalId, idsComptes);
        }
        const lignesDe = ({ r, montant, escompte, ecart, compteEscompteId, compteEcartId, plan, enDevise, parts }, libelle) => avecLeMode(mode?.id ?? null, [r.compteId, compteTresorerieId], enDevise
            ? (0, ecart_change_realise_1.lignesDuReglementEnDevise)({
                sens: dto.sens,
                compteTiersId: r.compteId,
                compteTresorerieId,
                compteEcartId: enDevise.compteEcartId,
                historique: enDevise.historique,
                francsPayes: enDevise.francsPayes,
                deviseId: enDevise.deviseId,
                montantDevise: enDevise.montantDevise,
                coursReglement: enDevise.coursReglement,
                tresorerieEnDevise: dto.tresorerieEnDevise === true,
                libelle,
            })
            : parts
                ? (0, reglement_tiers_1.lignesDuReglementImpute)({ compteTiersId: r.compteId, compteTresorerieId, parts, libelle })
                : plan && (escompte > 0 || ecart > 0)
                    ? (0, ecart_escompte_1.lignesAvecEscompteEtEcart)({
                        sens: dto.sens,
                        compteTiersId: r.compteId,
                        compteTresorerieId,
                        montant,
                        plan,
                        escompte: compteEscompteId ? { montant: escompte, compteId: compteEscompteId } : null,
                        ecart: compteEcartId ? { montant: ecart, compteId: compteEcartId } : null,
                        libelle,
                    })
                    : (0, reglement_tiers_1.lignesDuReglement)({ sens: dto.sens, compteTiersId: r.compteId, compteTresorerieId, montant, libelle }));
        const libelleDe = (p) => `Règlement ${p.compte.tiersCompte?.tiers.nom ?? p.compte.intitule}`.slice(0, 190);
        await this.ecritures.verifierCaisseProvisionnee(tenantId, dto.exerciceId, [
            { date: dto.date, lignes: prepares.flatMap((p) => lignesDe(p, libelleDe(p))) },
        ]);
        const resultats = [];
        const aOrdonner = [];
        for (const preparee of prepares) {
            const { r, compte, du, montant, tiers, escompte, ecart, enDevise, reduite, parts, groupe } = preparee;
            const libelle = libelleDe(preparee);
            const ecriture = await this.ecritures.creer(tenantId, userId, {
                exerciceId: dto.exerciceId,
                journalId: dto.journalId,
                date: dto.date,
                libelle,
                reference: [r.reference, parts && r.pieceImputation ? `imputation notifiée · ${r.pieceImputation.trim()}` : null].filter(Boolean).join(' · ') || undefined,
                lignes: lignesDe(preparee, libelle),
            });
            if (parts) {
                const poses = [];
                try {
                    for (const part of parts) {
                        const ligneTiersPart = ecriture.lignes.find((l) => l.compteId === r.compteId && l.libelle === part.libelle);
                        if (!ligneTiersPart)
                            throw new common_1.ConflictException(`La ligne du règlement de « ${part.libelle} » est introuvable dans sa pièce.`);
                        const l = await this.lettrage.lettrerManuel(tenantId, r.compteId, [part.ligneId, ligneTiersPart.id], userId, {
                            autoriserPartiel: Math.round(part.montant * 100) < Math.round(part.du * 100),
                        });
                        poses.push(l.lettre);
                    }
                }
                catch (e) {
                    try {
                        for (const code of poses)
                            await this.lettrage.delettrer(tenantId, r.compteId, code);
                        await this.ecritures.retirerCompensation(tenantId, ecriture.id);
                    }
                    catch (nettoyage) {
                        this.journalServeur.error(`Règlement ${ecriture.id} du dossier ${tenantId} resté au brouillard avec ${poses.length} lettrage(s) · son retrait après l'échec du lettrage a échoué`, nettoyage instanceof Error ? nettoyage.stack : String(nettoyage));
                    }
                    throw e;
                }
                resultats.push({ compte: compte.numero, ecritureId: ecriture.id, montant, partiel: Math.round(montant * 100) < Math.round(du * 100), lettre: poses.join(', ') });
                aOrdonner.push({
                    compteId: r.compteId,
                    montant,
                    reference: r.reference || null,
                    ecritureId: ecriture.id,
                    pieceReglement: [journal.code, ecriture.numeroPiece].filter((v) => v !== null && v !== undefined).join(' '),
                    imputationDeclaree: (0, reglement_tiers_1.imputationImprimee)(parts),
                });
                continue;
            }
            const ligneTiers = ecriture.lignes.find((l) => l.compteId === r.compteId);
            if (groupe) {
                let complete;
                try {
                    complete = await this.lettrage.completer(tenantId, groupe.id, [...r.ligneIds.filter((id) => !groupe.lignes.includes(id)), ligneTiers.id], {
                        ...(enDevise ? { ecartChangeRealise: enDevise.ecart } : {}),
                        borne: {
                            soldeAttendu: groupe.solde,
                            sensDesFactures: dto.sens === 'CLIENT' ? 'DEBIT' : 'CREDIT',
                            deviseId: enDevise ? enDevise.deviseId : null,
                        },
                    });
                }
                catch (e) {
                    try {
                        await this.ecritures.retirerCompensation(tenantId, ecriture.id);
                    }
                    catch (nettoyage) {
                        this.journalServeur.error(`Règlement ${ecriture.id} du dossier ${tenantId} resté au brouillard · le lettrage partiel ${groupe.code} n'a pas été complété et son retrait a échoué`, nettoyage instanceof Error ? nettoyage.stack : String(nettoyage));
                    }
                    throw e;
                }
                resultats.push({
                    compte: compte.numero,
                    ecritureId: ecriture.id,
                    montant,
                    partiel: complete.statut !== client_1.StatutLettrage.SOLDE,
                    lettre: complete.lettre,
                    ...(enDevise ? { montantDevise: enDevise.montantDevise, ecartChange: enDevise.ecart } : {}),
                    ...(escompte > 0 ? { escompte } : {}),
                    ...(ecart > 0 ? { ecartReglement: ecart } : {}),
                });
                aOrdonner.push({
                    compteId: r.compteId,
                    montant,
                    reference: r.reference || null,
                    ecritureId: ecriture.id,
                    pieceReglement: [journal.code, ecriture.numeroPiece].filter((v) => v !== null && v !== undefined).join(' '),
                });
                continue;
            }
            const partiel = (enDevise ? enDevise.partiel : Math.round(tiers * 100) < Math.round(du * 100)) || reduite;
            let lettre;
            try {
                lettre = await this.lettrage.lettrerManuel(tenantId, r.compteId, [...r.ligneIds, ligneTiers.id], userId, {
                    autoriserPartiel: partiel,
                    ...(enDevise ? { ecartChangeRealise: enDevise.ecart } : {}),
                });
            }
            catch (e) {
                await this.ecritures.retirerCompensation(tenantId, ecriture.id);
                throw e;
            }
            resultats.push({
                compte: compte.numero,
                ecritureId: ecriture.id,
                montant,
                partiel,
                lettre: lettre.lettre,
                ...(enDevise ? { montantDevise: enDevise.montantDevise, ecartChange: enDevise.ecart } : {}),
                ...(escompte > 0 ? { escompte } : {}),
                ...(ecart > 0 ? { ecartReglement: ecart } : {}),
            });
            aOrdonner.push({
                compteId: r.compteId,
                montant,
                reference: r.reference || null,
                ecritureId: ecriture.id,
                pieceReglement: [journal.code, ecriture.numeroPiece].filter((v) => v !== null && v !== undefined).join(' '),
            });
        }
        const ordre = preparation
            ? await this.ordres.creer(tenantId, email, dto.journalId, dto.date, preparation, aOrdonner)
            : null;
        return { reglements: resultats, ordre, avertissements };
    }
    async comptesEscompteEcart(tenantId, sens) {
        const referentiel = await (0, compte_ecart_change_1.referentielDuDossier)(this.prisma, tenantId);
        const roles = [(0, ecart_escompte_1.roleEscompte)(sens), 'ECART_REGLEMENT'];
        const servis = [];
        for (const role of roles) {
            const candidats = await this.candidatsEcartEscompte(tenantId, referentiel, role);
            const choix = (0, ecart_escompte_1.compteDuRole)(referentiel, role, candidats, undefined);
            servis.push({
                role,
                racine: ecart_escompte_1.RACINES_ECART_ESCOMPTE[referentiel][role],
                comptes: (0, ecart_escompte_1.comptesOfferts)(referentiel, role, candidats),
                proposeId: 'compte' in choix ? choix.compte.id : null,
                motif: 'motif' in choix ? choix.motif : null,
            });
        }
        return { seuil: await this.seuilEcartReglement(tenantId), roles: servis };
    }
    async candidatsEcartEscompte(tenantId, referentiel, role) {
        return this.prisma.compte.findMany({
            where: { tenantId, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true, numero: { startsWith: ecart_escompte_1.RACINES_ECART_ESCOMPTE[referentiel][role] } },
            select: { id: true, numero: true, intitule: true },
            orderBy: { numero: 'asc' },
            take: 200,
        });
    }
    async seuilEcartReglement(tenantId) {
        const t = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { seuilEcartReglement: true } });
        if (!t)
            throw new common_1.NotFoundException('Dossier introuvable.');
        return t.seuilEcartReglement === null ? null : Number(t.seuilEcartReglement);
    }
    async preparerEnDevise(tenantId, exerciceId, referentiel, sens, r, numero, siennes, eteintes = [], fileDuCout = null) {
        if (siennes.some((l) => (l.deviseId ?? null) === null)) {
            throw new common_1.BadRequestException(`${numero} · des factures en francs et des factures en devise ne se règlent pas dans la même pièce · réglez-les séparément.`);
        }
        const devises = new Set(siennes.map((l) => l.deviseId));
        if (devises.size !== 1) {
            throw new common_1.BadRequestException(`${numero} · les factures choisies sont en plusieurs devises · une pièce par devise.`);
        }
        const factures = siennes.map((l) => ({
            id: l.id,
            francs: (0, reglement_tiers_1.montantDu)({ debit: Number(l.debit), credit: Number(l.credit) }, sens),
            montantDevise: Number(l.montantDevise),
            date: l.ecriture.date ?? new Date(0),
        }));
        if (factures.some((f) => !(f.francs > 0) || !(f.montantDevise > 0))) {
            throw new common_1.BadRequestException(`${numero} · un avoir en devise ne se règle pas ici · lettrez-le avec sa facture depuis Interrogation et lettrage.`);
        }
        if (r.montant !== undefined && r.montantDevise === undefined) {
            throw new common_1.BadRequestException(`${numero} · le montant payé en francs ne dit pas ce qu'il règle d'une facture en devise · saisissez aussi le montant réglé en devise.`);
        }
        const duDevise = Math.round(factures.reduce((s, f) => s + f.montantDevise, 0) * 100) / 100;
        const montantDevise = r.montantDevise === undefined ? duDevise : r.montantDevise;
        if (Math.round(montantDevise * 100) > Math.round(duDevise * 100)) {
            throw new common_1.BadRequestException(`${numero} · le montant réglé (${montantDevise.toFixed(2)}) dépasse le dû en devise des factures choisies ` +
                `(${duDevise.toFixed(2)}) · l'excédent est une avance ou un trop-perçu, à comptabiliser à part.`);
        }
        const deviseId = [...devises][0];
        const duReporte = Math.round(siennes.filter((l) => (0, transactions_art_59_bis_1.estDAnouveau)(l.ecriture)).reduce((t, l) => t + Number(l.montantDevise), 0) * 100) / 100;
        let avertissement = null;
        if (duReporte > 0) {
            const aNouveauNonLettre = {
                compteId: r.compteId,
                id: { notIn: [...r.ligneIds, ...eteintes] },
                lettrageId: null,
                ecriture: {
                    tenantId,
                    exerciceId,
                    OR: [{ estANouveauProvisoire: true }, { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false }],
                },
            };
            const reportees = { ...aNouveauNonLettre, deviseId };
            const exerciceLu = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true, dateDebut: true } });
            const ecartsReportes = exerciceLu
                ? await (0, lignes_de_reevaluation_1.lignesDeReevaluationSurLesTiers)(this.prisma, { tenantId, exercice: exerciceLu, compteIds: [r.compteId] })
                : new Set();
            const enFrancs = {
                ...aNouveauNonLettre,
                id: { notIn: [...r.ligneIds, ...eteintes, ...ecartsReportes] },
                deviseId: null,
            };
            const colonne = (signe) => (sens === 'FOURNISSEUR' ? { debit: { [signe]: 0 } } : { credit: { [signe]: 0 } });
            const colonneFrancs = sens === 'FOURNISSEUR' ? 'debit' : 'credit';
            const [positives, negatives, francsPositifs, francsNegatifs] = await Promise.all([
                this.prisma.ligneEcriture.aggregate({ where: { ...reportees, ...colonne('gt') }, _sum: { montantDevise: true } }),
                this.prisma.ligneEcriture.aggregate({ where: { ...reportees, ...colonne('lt') }, _sum: { montantDevise: true } }),
                this.prisma.ligneEcriture.aggregate({ where: { ...enFrancs, ...colonne('gt') }, _sum: { [colonneFrancs]: true } }),
                this.prisma.ligneEcriture.aggregate({ where: { ...enFrancs, ...colonne('lt') }, _sum: { [colonneFrancs]: true } }),
            ]);
            const reglesAuReport = Math.round((Number(positives._sum.montantDevise ?? 0) - Number(negatives._sum.montantDevise ?? 0)) * 100) / 100;
            const sommeFrancs = (a) => Number(a._sum[colonneFrancs] ?? 0);
            const reglesEnFrancs = Math.round((sommeFrancs(francsPositifs) + sommeFrancs(francsNegatifs)) * 100) / 100;
            const resteReporte = Math.max(0, Math.round((duReporte - Math.max(0, reglesAuReport)) * 100) / 100);
            const plafond = Math.round((duDevise - duReporte + resteReporte) * 100) / 100;
            if (Math.round(montantDevise * 100) > Math.round(plafond * 100)) {
                throw new common_1.BadRequestException(`${numero} · ${reglesAuReport.toFixed(2)} dans la devise des factures choisies sont déjà réglés au report à-nouveau de ce compte, ` +
                    "hors de tout lettrage · le report Détail reprend ENTIÈRE une facture payée en partie l'exercice précédent, et son règlement à part. " +
                    "Si ces règlements reportés reviennent à une autre facture que celles choisies, lettrez-les d'abord avec leur facture " +
                    `(Interrogation et lettrage). Sinon, les lignes d'à-nouveau choisies ne doivent plus que ${resteReporte.toFixed(2)} · ` +
                    `réglez au plus ${plafond.toFixed(2)}, puis complétez le lettrage de la facture avec ces lignes d'à-nouveau (Interrogation et lettrage). ` +
                    "Pour payer autrement, saisissez le règlement au journal de trésorerie, puis lettrez-le à la main " +
                    "avec la facture qu'il solde (Interrogation et lettrage).");
            }
            if (reglesEnFrancs > 0) {
                avertissement =
                    `${numero} · ${reglesEnFrancs.toFixed(2)} en francs, sans devise, sont reportés à l'à-nouveau de ce compte hors de tout lettrage ` +
                        "(un règlement d'avant la tenue en devise) · ils peuvent régler une part des factures en devise choisies, que la borne du reste dû " +
                        "ne lit pas. Vérifiez le reste dû au fournisseur ou au client avant de payer, et lettrez ce règlement avec sa facture.";
            }
        }
        const lu = (0, ecart_change_realise_1.coursEtFrancsDuReglement)({
            montantDevise,
            cours: r.coursReglement,
            francs: r.montant,
            tolerance: ligne_en_devise_1.contrevaleurAdmise,
        });
        if ('motif' in lu)
            throw new common_1.BadRequestException(`${numero} · ${lu.motif}`);
        const francsPayes = lu.francs;
        const historique = (0, ecart_change_realise_1.coutHistoriqueRegle)(fileDuCout ?? factures, montantDevise);
        const ecart = (0, ecart_change_realise_1.ecartSigne)(sens, historique, francsPayes);
        const compteEcart = ecart === 0
            ? null
            : await (0, compte_ecart_change_1.compteDeLEcart)(this.prisma, {
                tenantId,
                referentiel,
                nature: (0, ecart_change_realise_1.natureDuCompte)(numero, referentiel),
                ecart: ecart > 0 ? 'PERTE' : 'GAIN',
                choisiId: r.compteEcartChangeId,
            });
        return {
            deviseId,
            montantDevise,
            coursReglement: lu.cours,
            francsPayes,
            historique,
            ecart,
            compteEcartId: compteEcart?.id ?? null,
            partiel: Math.round(montantDevise * 100) < Math.round(duDevise * 100),
            avertissement,
        };
    }
    async passerEcartChange(tenantId, userId, dto) {
        const proposition = await this.lettrage.propositionEcartChange(tenantId, dto.lettrageId);
        if (proposition.ecart === null || proposition.ecart === 0) {
            throw new common_1.BadRequestException(proposition.motif ?? "Ce lettrage n'a aucun écart de change à passer.");
        }
        if (dto.exerciceId !== proposition.exerciceId) {
            throw new common_1.BadRequestException(`L'écart de change de ce lettrage s'est réalisé dans l'exercice de son dernier règlement · passez-le dans cet exercice (AUDCIF, Titre VIII ch. 22 § 2.3).`);
        }
        const dateDenouement = new Date(proposition.date).toISOString().slice(0, 10);
        if (dto.date.slice(0, 10) < dateDenouement) {
            throw new common_1.BadRequestException(`L'écart de change se constate à la date du règlement qui dénoue la position, le ${dateDenouement}, ou après · ` +
                `pas le ${dto.date.slice(0, 10)} (AUDCIF, Titre VIII ch. 22 § 2.3).`);
        }
        const journal = await this.prisma.journal.findFirst({ where: { id: dto.journalId, tenantId } });
        if (!journal)
            throw new common_1.NotFoundException('Journal introuvable pour ce dossier.');
        if (journal.type === client_1.TypeJournal.TRESORERIE) {
            throw new common_1.BadRequestException(`Le journal ${journal.code} est un journal de trésorerie · l'écart de change réalisé ne mouvemente aucune trésorerie, ` +
                "il se passe au journal des opérations diverses.");
        }
        const referentiel = await (0, compte_ecart_change_1.referentielDuDossier)(this.prisma, tenantId);
        const compteEcart = await (0, compte_ecart_change_1.compteDeLEcart)(this.prisma, {
            tenantId,
            referentiel,
            nature: (0, ecart_change_realise_1.natureDuCompte)(proposition.compteNumero, referentiel),
            ecart: proposition.ecart > 0 ? 'PERTE' : 'GAIN',
            choisiId: dto.compteEcartChangeId,
        });
        const dejaReevalue = await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(this.prisma, {
            tenantId,
            exerciceId: proposition.exerciceId,
            compteId: proposition.compteId,
            compteNumero: proposition.compteNumero,
            lettrageId: dto.lettrageId,
        });
        if (dejaReevalue && 'refus' in dejaReevalue)
            throw new common_1.ConflictException(dejaReevalue.refus);
        const lignesDuGroupe = await this.prisma.ligneEcriture.findMany({
            where: { lettrageId: dto.lettrageId, ecriture: { tenantId } },
            select: { id: true },
        });
        const extourne = await (0, reevaluation_et_ecart_realise_1.avertissementExtourneManquante)(this.prisma, {
            tenantId,
            exerciceId: proposition.exerciceId,
            compteId: proposition.compteId,
            compteNumero: proposition.compteNumero,
            ligneIds: lignesDuGroupe.map((l) => l.id),
        });
        const avertissement = [dejaReevalue && 'avertissement' in dejaReevalue ? dejaReevalue.avertissement : null, extourne].filter((x) => x !== null).join(' ') ||
            null;
        const libelle = `${(0, ecart_change_realise_1.libelleEcartRealise)(proposition.ecart)} · ${proposition.compteNumero} ${proposition.code}`;
        const ecriture = await this.ecritures.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date: dto.date,
            libelle,
            ...(dto.reporterAuPremierJourOuvert === true ? { reporterAuPremierJourOuvert: true } : {}),
            lignes: (0, ecart_change_realise_1.lignesEcartDuGroupe)({
                compteTiersId: proposition.compteId,
                compteEcartId: compteEcart.id,
                ecart: proposition.ecart,
                libelle,
            }),
        });
        const ligneTiers = ecriture.lignes.find((l) => l.compteId === proposition.compteId);
        let lettre;
        try {
            lettre = await this.lettrage.completer(tenantId, dto.lettrageId, [ligneTiers.id], { groupeTolere: dto.lettrageId });
        }
        catch (e) {
            await this.ecritures.retirerCompensation(tenantId, ecriture.id);
            throw e;
        }
        if (lettre.statut !== client_1.StatutLettrage.SOLDE) {
            await this.ecritures.retirerCompensation(tenantId, ecriture.id, async (tx) => {
                await tx.ligneEcriture.updateMany({ where: { ecritureId: ecriture.id }, data: { lettrageId: null } });
                const restes = await tx.ligneEcriture.findMany({ where: { lettrageId: dto.lettrageId }, select: { debit: true, credit: true } });
                const reste = Math.round(restes.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0) * 100) / 100;
                await tx.lettrage.updateMany({ where: { id: dto.lettrageId, tenantId }, data: { solde: reste } });
            });
            throw new common_1.ConflictException(`Le lettrage ${proposition.code} n'est pas soldé par cet écart (reste ${Number(lettre.solde).toFixed(2)}) · ` +
                "il a changé depuis la proposition. Relisez l'écart proposé.");
        }
        return {
            ecritureId: ecriture.id,
            ecart: proposition.ecart,
            compte: compteEcart.numero,
            lettre: lettre.lettre,
            statut: lettre.statut,
            date: ecriture.date,
            dateValeur: ecriture.dateValeur ?? null,
            avertissement,
        };
    }
};
exports.ReglementsService = ReglementsService;
exports.ReglementsService = ReglementsService = ReglementsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService,
        lettrage_service_1.LettrageService,
        ordres_virement_service_1.OrdresVirementService])
], ReglementsService);
function motifANouveauProvisoire(numero) {
    return (`${numero} · la ligne d'à-nouveau choisie est PROVISOIRE, l'exercice précédent n'étant pas clôturé · lettrée par ce règlement, ` +
        "elle ferait refuser la clôture de cet exercice, qui remplace l'à-nouveau provisoire. Attendez sa clôture, ou saisissez le règlement " +
        "au journal de trésorerie et lettrez-le avec la ligne d'à-nouveau définitif une fois l'exercice clôturé.");
}
function avecLeMode(modeReglementId, comptesQuiPaient, lignes) {
    if (!modeReglementId)
        return lignes;
    const paient = new Set(comptesQuiPaient);
    return lignes.map((l) => (paient.has(l.compteId) ? { ...l, modeReglementId } : l));
}
function ligneDue(l, paires, partiels = null) {
    const partiel = partiels?.get(l.id);
    if (partiel) {
        return {
            debit: partiel.sens === 'CLIENT' ? partiel.reste.francs : 0,
            credit: partiel.sens === 'FOURNISSEUR' ? partiel.reste.francs : 0,
            montantDevise: partiel.reste.devise ?? l.montantDevise ?? null,
        };
    }
    const reste = paires?.reste.get(l.id);
    if (!reste)
        return { debit: l.debit, credit: l.credit, montantDevise: l.montantDevise ?? null };
    return {
        debit: reste.francs > 0 ? reste.francs : 0,
        credit: reste.francs < 0 ? -reste.francs : 0,
        montantDevise: reste.devise ?? l.montantDevise ?? null,
    };
}
//# sourceMappingURL=reglements.service.js.map