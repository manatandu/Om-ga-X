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
exports.PLAFOND_HISTORIQUE = exports.RelancesService = exports.RACINES_RELANCABLES = exports.MOTIF_COMPTE_INTROUVABLE_RELEVE = void 0;
exports.qualiteDuCompte = qualiteDuCompte;
exports.motifRienAReclamer = motifRienAReclamer;
exports.objetDeLaRelance = objetDeLaRelance;
const common_1 = require("@nestjs/common");
const mentions_societe_1 = require("../tenant/mentions-societe");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const courrier_service_1 = require("../courrier/courrier.service");
const relances_dto_1 = require("./dto/relances.dto");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const echeance_1 = require("../../common/echeance");
const reste_des_lignes_ouvertes_1 = require("../lettrage/reste-des-lignes-ouvertes");
const paires_a_cheval_1 = require("../lettrage/paires-a-cheval");
const date_origine_des_reports_1 = require("./date-origine-des-reports");
const groupes_soldes_en_devise_1 = require("./groupes-soldes-en-devise");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const modeles_impression_service_1 = require("../tiers/modeles-impression.service");
const modeles_impression_1 = require("../tiers/modeles-impression");
const JOUR = 86_400_000;
exports.MOTIF_COMPTE_INTROUVABLE_RELEVE = 'Compte introuvable dans ce dossier : aucun relevé ne peut être établi.';
const STATUTS_EN_FILE_OU_PARTIS = [
    client_1.StatutMessage.EN_ATTENTE,
    client_1.StatutMessage.SANS_TRANSPORT,
    client_1.StatutMessage.ECHEC,
    client_1.StatutMessage.ENVOYE,
];
function qualiteDuCompte(numero, referentiel) {
    if (referentiel === client_1.Referentiel.SYSCOHADA) {
        if (numero.startsWith('411'))
            return 'Client';
        if (numero.startsWith('412'))
            return 'Effet à recevoir';
        if (numero.startsWith('419'))
            return 'Client créditeur';
        return 'Tiers';
    }
    if (numero.startsWith('411'))
        return 'Adhérent';
    if (numero.startsWith('412'))
        return 'Client-usager';
    return 'Tiers';
}
function motifRienAReclamer(type) {
    if (type === client_1.TypeRelance.PREVENTIVE)
        return "Rien à prévenir à cette date · aucune échéance à venir n'est ouverte sur ce compte.";
    if (type === client_1.TypeRelance.RAPPEL)
        return "Rien à rappeler à cette date · aucune échéance passée n'est ouverte sur ce compte.";
    return "Rien de dû à cette date sur ce compte.";
}
exports.RACINES_RELANCABLES = {
    [client_1.Referentiel.SYCEBNL]: ['411', '412', '413', '416'],
    [client_1.Referentiel.SYSCOHADA]: ['411', '413', '416'],
};
const NIVEAUX_SYCEBNL = [
    {
        niveau: 1,
        libelle: 'Invitation à régler',
        type: client_1.TypeRelance.PREVENTIVE,
        joursApresEcheance: -7,
        modeleTexte: "Cher {tiers},\n\nNous vous rappelons amicalement que votre échéance de {montant} arrive à terme le {echeance}.\n\n{detail}\n\nNous vous remercions par avance de votre règlement, qui permet à notre entité de poursuivre ses activités.\n\n{entite}",
    },
    {
        niveau: 2,
        libelle: 'Premier rappel',
        type: client_1.TypeRelance.RAPPEL,
        joursApresEcheance: 15,
        modeleTexte: "Cher {tiers},\n\nSauf erreur de notre part, la somme de {montant} demeure due à ce jour, {date}.\n\n{detail}\n\nSi votre règlement a été effectué entre-temps, nous vous prions de ne pas tenir compte de ce rappel.\n\n{entite}",
    },
    {
        niveau: 3,
        libelle: 'Second rappel',
        type: client_1.TypeRelance.RAPPEL,
        joursApresEcheance: 45,
        modeleTexte: "Cher {tiers},\n\nMalgré notre précédent courrier, la somme de {montant} reste impayée au {date}.\n\n{detail}\n\nNous vous serions reconnaissants de bien vouloir régulariser votre situation, ou de prendre contact avec nous pour convenir d'un échelonnement.\n\n{entite}",
    },
];
const NIVEAUX_SYSCOHADA = [
    {
        niveau: 1,
        libelle: 'Avis d’échéance',
        type: client_1.TypeRelance.PREVENTIVE,
        joursApresEcheance: -7,
        modeleTexte: "Madame, Monsieur,\n\nNous vous informons que la somme de {montant} viendra à échéance le {echeance}.\n\n{detail}\n\nNous vous remercions de bien vouloir procéder au règlement à cette date.\n\n{entite}",
    },
    {
        niveau: 2,
        libelle: 'Premier rappel',
        type: client_1.TypeRelance.RAPPEL,
        joursApresEcheance: 15,
        modeleTexte: "Madame, Monsieur,\n\nSauf erreur de notre part, la somme de {montant} demeure impayée à ce jour, {date}.\n\n{detail}\n\nSi votre règlement nous est parvenu entre-temps, ce rappel est sans objet. Dans le cas contraire, nous vous remercions de le régulariser sans délai.\n\n{entite}",
    },
    {
        niveau: 3,
        libelle: 'Mise en demeure préalable',
        type: client_1.TypeRelance.RAPPEL,
        joursApresEcheance: 45,
        modeleTexte: "Madame, Monsieur,\n\nMalgré notre précédent rappel, la somme de {montant} reste impayée au {date}.\n\n{detail}\n\nNous vous invitons à régulariser sous quinzaine, ou à nous contacter pour convenir d'un échéancier. À défaut, nous serons contraints d'envisager le recouvrement de cette créance par les voies de droit.\n\n{entite}",
    },
];
const NIVEAUX_DEFAUT = {
    [client_1.Referentiel.SYCEBNL]: NIVEAUX_SYCEBNL,
    [client_1.Referentiel.SYSCOHADA]: NIVEAUX_SYSCOHADA,
};
function objetDeLaRelance(libelleNiveau, entite) {
    const libelle = (libelleNiveau ?? '').trim() || 'Rappel';
    const nom = (entite ?? '').trim();
    return nom.length > 0 ? `${libelle} · ${nom}` : libelle;
}
let RelancesService = class RelancesService {
    constructor(prisma, courrier) {
        this.prisma = prisma;
        this.courrier = courrier;
    }
    async listerNiveaux(tenantId) {
        return this.prisma.niveauRelance.findMany({ where: { tenantId }, orderBy: { niveau: 'asc' } });
    }
    async seedNiveauxDefaut(tenantId, referentiel, client = this.prisma) {
        const existants = await client.niveauRelance.count({ where: { tenantId } });
        if (existants > 0)
            return;
        await client.niveauRelance.createMany({
            data: NIVEAUX_DEFAUT[referentiel].map((n) => ({ ...n, tenantId })),
        });
    }
    async creerNiveau(tenantId, dto) {
        const existant = await this.prisma.niveauRelance.findFirst({ where: { tenantId, niveau: dto.niveau } });
        if (existant)
            throw new common_1.ConflictException(`Le niveau ${dto.niveau} existe déjà`);
        return this.prisma.niveauRelance.create({ data: { ...dto, tenantId } });
    }
    async modifierNiveau(tenantId, niveauId, dto) {
        const niveau = await this.prisma.niveauRelance.findFirst({ where: { id: niveauId, tenantId } });
        if (!niveau)
            throw new common_1.NotFoundException('Niveau de relance introuvable pour ce dossier');
        return this.prisma.niveauRelance.update({ where: { id: niveauId }, data: dto });
    }
    async positions(tenantId, params) {
        const ref = params.dateReference ? new Date(params.dateReference) : new Date();
        const type = params.type ?? client_1.TypeRelance.RAPPEL;
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        const racines = params.racine ? [params.racine] : exports.RACINES_RELANCABLES[referentiel];
        const lire = (curseur) => this.prisma.ligneEcriture.findMany({
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
            where: {
                ecriture: { tenantId, exerciceId: params.exerciceId, ...ecritures_de_situation_1.HORS_SITUATION },
                lettre: null,
                OR: racines.map((r) => ({ compte: { numero: { startsWith: r } } })),
            },
            include: {
                compte: {
                    select: {
                        id: true,
                        numero: true,
                        intitule: true,
                        tiersCompte: {
                            include: {
                                tiers: {
                                    select: {
                                        id: true,
                                        nom: true,
                                        type: true,
                                        email: true,
                                        horsRelance: true,
                                        motifHorsRelance: true,
                                        horsRelanceDepuis: true,
                                    },
                                },
                            },
                        },
                    },
                },
                ecriture: {
                    select: { date: true, libelle: true, estANouveauProvisoire: true, estGenereeParCloture: true, estSoldeDesComptesDeGestion: true },
                },
            },
        });
        const niveaux = await this.prisma.niveauRelance.findMany({
            where: { tenantId, estActif: true, type },
            orderBy: { joursApresEcheance: 'desc' },
        });
        const piecePlusAncienne = new Map();
        const lues = [];
        await (0, lecture_par_lots_1.lireParLots)(lire, (l) => {
            lues.push(l);
        });
        let paires = null;
        if (lues.some((l) => l.ecriture.estANouveauProvisoire === true || (l.ecriture.estGenereeParCloture === true && l.ecriture.estSoldeDesComptesDeGestion !== true))) {
            const exercice = await this.prisma.exercice.findFirst({
                where: { id: params.exerciceId, tenantId },
                select: { id: true, dateDebut: true },
            });
            if (!exercice)
                throw new common_1.NotFoundException('Exercice introuvable pour ce dossier');
            paires = await (0, paires_a_cheval_1.pairesACheval)(this.prisma, { tenantId, exercice, compte: { OR: racines.map((r) => ({ numero: { startsWith: r } })) } });
        }
        const reports = lues.filter((l) => l.ecriture.estANouveauProvisoire === true || (l.ecriture.estGenereeParCloture === true && l.ecriture.estSoldeDesComptesDeGestion !== true));
        let datesOrigine = new Map();
        if (reports.length) {
            const exercice = await this.prisma.exercice.findFirst({
                where: { id: params.exerciceId, tenantId },
                select: { dateDebut: true },
            });
            if (!exercice)
                throw new common_1.NotFoundException('Exercice introuvable pour ce dossier');
            datesOrigine = await (0, date_origine_des_reports_1.datesOrigineDesReports)(this.prisma, tenantId, exercice.dateDebut, reports.map((l) => ({
                id: l.id,
                compteId: l.compte.id,
                numeroCompte: l.compte.numero,
                debit: Number(l.debit),
                credit: Number(l.credit),
                libelle: l.libelle,
                dateEcheance: l.dateEcheance,
                date: l.ecriture.date,
                provisoire: l.ecriture.estANouveauProvisoire === true,
            })));
        }
        const poids = await (0, reste_des_lignes_ouvertes_1.poidsDesLignesLues)(this.prisma, tenantId, lues, {}, 'Relances');
        const soldesEnDevise = await (0, groupes_soldes_en_devise_1.groupesSoldesEnDevise)(this.prisma, tenantId, lues);
        const lusLigneALigne = await (0, reste_des_lignes_ouvertes_1.groupesLusLigneALigneParCompte)(this.prisma, tenantId, new Map([...poids.motifs].filter(([id]) => !soldesEnDevise.has(id))));
        const parCompte = new Map();
        const traiter = (l) => {
            if (paires?.absorbees.has(l.id))
                return;
            if (l.lettrageId && soldesEnDevise.has(l.lettrageId))
                return;
            const bloc = l.lettrageId ? poids.enBloc.get(l.lettrageId) : undefined;
            if (bloc && bloc.ligneId !== l.id)
                return;
            const net = paires?.reste.get(l.id)?.francs ?? bloc?.net ?? (0, reste_des_lignes_ouvertes_1.poidsOuMontant)(poids, l);
            if (Math.abs(net) < 0.005)
                return;
            const datePiece = datesOrigine.get(l.id) ?? l.ecriture.date;
            const echeance = l.dateEcheance ?? datePiece;
            const retard = Math.floor((ref.getTime() - echeance.getTime()) / JOUR);
            if (type === client_1.TypeRelance.PREVENTIVE && retard >= 0)
                return;
            if (type === client_1.TypeRelance.RAPPEL && retard < 0)
                return;
            const tiers = l.compte.tiersCompte?.tiers ?? null;
            const acc = parCompte.get(l.compte.id) ??
                {
                    compteId: l.compte.id,
                    numero: l.compte.numero,
                    intitule: l.compte.intitule,
                    tiersId: tiers?.id ?? null,
                    tiersNom: tiers?.nom ?? null,
                    tiersEmail: tiers?.email ?? null,
                    qualite: qualiteDuCompte(l.compte.numero, referentiel),
                    horsRelance: tiers?.horsRelance ?? false,
                    motifHorsRelance: tiers?.motifHorsRelance ?? null,
                    horsRelanceDepuis: tiers?.horsRelanceDepuis?.toISOString().slice(0, 10) ?? null,
                    montantDu: 0,
                    retardMaxJours: Number.NEGATIVE_INFINITY,
                    echeancePlusAncienne: null,
                    niveauSuggere: null,
                    derniereRelance: null,
                    lignes: [],
                    ecartsChangeNonPasses: [],
                    groupesLusLigneALigne: lusLigneALigne.get(l.compte.id) ?? { total: 0, groupes: [], tronque: false },
                };
            acc.montantDu += net;
            const vue = piecePlusAncienne.get(l.compte.id);
            if (!vue || datePiece < vue)
                piecePlusAncienne.set(l.compte.id, datePiece);
            acc.lignes.push({
                date: datePiece.toISOString().slice(0, 10),
                echeance: l.dateEcheance?.toISOString().slice(0, 10) ?? null,
                libelle: l.libelle ?? l.ecriture.libelle,
                montant: net,
                retardJours: retard,
            });
            if (retard > acc.retardMaxJours || acc.echeancePlusAncienne === null) {
                acc.retardMaxJours = Math.max(acc.retardMaxJours, retard);
                acc.echeancePlusAncienne = echeance.toISOString().slice(0, 10);
            }
            parCompte.set(l.compte.id, acc);
        };
        for (const l of lues)
            traiter(l);
        for (const g of soldesEnDevise.values()) {
            parCompte.get(g.compteId)?.ecartsChangeNonPasses.push({ code: g.code, ecart: g.ecart, libelle: g.libelle });
        }
        const comptesRetenus = [...parCompte.keys()];
        const depuis = comptesRetenus.length
            ? new Date(Math.min(...comptesRetenus.map((id) => piecePlusAncienne.get(id).getTime())))
            : null;
        const dernieres = depuis
            ? await this.prisma.relance.findMany({
                where: { tenantId, compteId: { in: comptesRetenus }, dateRelance: { gte: depuis } },
                orderBy: { dateRelance: 'desc' },
                include: { niveauRelance: { select: { niveau: true } } },
            })
            : [];
        const resultat = [];
        for (const p of parCompte.values()) {
            if (p.montantDu <= 0.005)
                continue;
            p.montantDu = Math.round(p.montantDu * 100) / 100;
            p.lignes.sort((a, b) => b.retardJours - a.retardJours);
            const ouverteDepuis = piecePlusAncienne.get(p.compteId);
            const derniere = dernieres.find((r) => r.compteId === p.compteId && r.dateRelance >= ouverteDepuis);
            if (derniere) {
                p.derniereRelance = {
                    niveau: derniere.niveauRelance.niveau,
                    date: derniere.dateRelance.toISOString().slice(0, 10),
                };
            }
            const atteignables = niveaux.filter((n) => p.retardMaxJours >= n.joursApresEcheance);
            const candidat = atteignables[0];
            if (!p.horsRelance && candidat && (!p.derniereRelance || candidat.niveau > p.derniereRelance.niveau)) {
                p.niveauSuggere = candidat.niveau;
            }
            resultat.push(p);
        }
        return resultat.sort((a, b) => b.retardMaxJours - a.retardMaxJours);
    }
    async releve(tenantId, compteId, exerciceId) {
        const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId }, select: { id: true } });
        if (!compte)
            throw new common_1.NotFoundException(exports.MOTIF_COMPTE_INTROUVABLE_RELEVE);
        const positions = await this.positions(tenantId, { exerciceId, type: client_1.TypeRelance.RELEVE });
        const position = positions.find((p) => p.compteId === compteId);
        if (!position) {
            throw new common_1.NotFoundException("Ce compte n'a rien de dû sur cet exercice.");
        }
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        const jour = (0, echeance_1.jourDeKinshasa)(new Date());
        const entiteCourrier = [tenant?.nom ?? '', tenant ? (0, mentions_societe_1.mentionsEmetteur)((0, mentions_societe_1.identiteSociete)(tenant), jour).ligne : null].filter((x) => x).join('\n');
        const cadre = position.tiersId
            ? ((await (0, modeles_impression_service_1.cadresDesTiers)(this.prisma, tenantId, [position.tiersId], 'EXTRAIT', { entite: entiteCourrier, jour })).get(position.tiersId) ?? null)
            : null;
        return { entite: tenant?.nom ?? '', ...position, cadre };
    }
    composer(modele, donnees) {
        const detail = donnees.lignes
            .map((l) => `  ${l.echeance ?? l.date}  ${l.libelle}  ${l.montant.toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
        })}${l.retardJours > 0 ? `  (${l.retardJours} j de retard)` : ''}`)
            .join('\n');
        return modele
            .replace(/\{tiers\}/g, donnees.tiers)
            .replace(/\{montant\}/g, donnees.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2 }))
            .replace(/\{date\}/g, donnees.date.toLocaleDateString('fr-FR'))
            .replace(/\{echeance\}/g, donnees.echeance ? new Date(`${donnees.echeance}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '')
            .replace(/\{entite\}/g, donnees.entite)
            .replace(/\{detail\}/g, detail);
    }
    async emettre(tenantId, createdBy, dto) {
        const compteIds = [...new Set(dto.compteIds)];
        if (compteIds.length > relances_dto_1.PLAFOND_COMPTES_PAR_EMISSION) {
            throw new common_1.BadRequestException(`Au plus ${relances_dto_1.PLAFOND_COMPTES_PAR_EMISSION} comptes par émission · découpez la sélection.`);
        }
        const niveau = await this.prisma.niveauRelance.findFirst({ where: { id: dto.niveauId, tenantId } });
        if (!niveau)
            throw new common_1.BadRequestException('Niveau de relance introuvable pour ce dossier');
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        const dateCourrier = dto.dateReference ? new Date(dto.dateReference) : new Date();
        const mentionEmetteur = tenant ? (0, mentions_societe_1.mentionsEmetteur)((0, mentions_societe_1.identiteSociete)(tenant), dateCourrier).ligne : null;
        const entite = [tenant?.nom ?? '', mentionEmetteur].filter((x) => x).join('\n');
        const positions = await this.positions(tenantId, {
            exerciceId: dto.exerciceId,
            dateReference: dto.dateReference,
            type: niveau.type,
        });
        const date = dto.dateReference ? new Date(dto.dateReference) : new Date();
        const exclues = [];
        const sansObjet = [];
        const sansPosition = compteIds.filter((id) => !positions.some((p) => p.compteId === id));
        const numerosSansPosition = new Map(sansPosition.length
            ? (await this.prisma.compte.findMany({
                where: { tenantId, id: { in: sansPosition } },
                select: { id: true, numero: true, intitule: true },
            })).map((c) => [c.id, `${c.numero} · ${c.intitule}`])
            : []);
        const cadres = await (0, modeles_impression_service_1.cadresDesTiers)(this.prisma, tenantId, compteIds.flatMap((id) => positions.find((p) => p.compteId === id)?.tiersId ?? []), (0, modeles_impression_1.natureDuNiveau)(niveau.type), { entite, jour: (0, echeance_1.jourDeKinshasa)(dateCourrier) });
        const aEcrire = [];
        for (const compteId of compteIds) {
            const position = positions.find((p) => p.compteId === compteId);
            if (!position) {
                sansObjet.push({ compteId, compte: numerosSansPosition.get(compteId) ?? 'compte inconnu', motif: motifRienAReclamer(niveau.type) });
                continue;
            }
            if (position.horsRelance) {
                exclues.push({
                    compteId,
                    tiers: position.tiersNom ?? position.numero,
                    motif: position.motifHorsRelance ?? 'Tiers exclu du circuit de relance.',
                });
                continue;
            }
            const tiers = position.tiersNom ?? `titulaire du compte ${position.numero}`;
            const lettre = this.composer(niveau.modeleTexte, {
                tiers,
                montant: position.montantDu,
                date,
                echeance: position.echeancePlusAncienne,
                entite,
                lignes: position.lignes,
            });
            const cadre = position.tiersId ? (cadres.get(position.tiersId) ?? null) : null;
            const texte = (0, modeles_impression_1.habiller)(cadre, lettre);
            aEcrire.push({ position, tiers, texte, modele: cadre?.modele ?? null });
        }
        const jour = (0, echeance_1.jourDeKinshasa)(date);
        const debutLecture = new Date(jour.getTime() - JOUR);
        const finLecture = new Date(jour.getTime() + JOUR);
        const objet = objetDeLaRelance(niveau.libelle, entite);
        const { lettres, dejaEcrits } = aEcrire.length
            ? await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`relances:${tenantId}`}))`;
                const memeJour = (await tx.relance.findMany({
                    where: {
                        tenantId,
                        niveauId: niveau.id,
                        compteId: { in: aEcrire.map((l) => l.position.compteId) },
                        dateRelance: { gte: debutLecture, lt: finLecture },
                    },
                    select: { id: true, compteId: true, dateRelance: true },
                })).filter((r) => (0, echeance_1.jourDeKinshasa)(r.dateRelance).getTime() === jour.getTime());
                const enFile = memeJour.length
                    ? await tx.message.findMany({
                        where: {
                            tenantId,
                            origine: courrier_service_1.ORIGINE_RELANCE,
                            origineId: { in: memeJour.map((r) => r.id) },
                            statut: { in: STATUTS_EN_FILE_OU_PARTIS },
                        },
                        select: { origineId: true },
                    })
                    : [];
                const relancesEnFile = new Set(enFile.map((m) => m.origineId));
                const dejaIds = new Set(memeJour.filter((r) => relancesEnFile.has(r.id)).map((r) => r.compteId));
                const faites = aEcrire
                    .filter((l) => !dejaIds.has(l.position.compteId))
                    .map((l) => ({ ...l, relanceId: (0, crypto_1.randomUUID)() }));
                if (faites.length) {
                    await tx.relance.createMany({
                        data: faites.map((l) => ({
                            id: l.relanceId,
                            tenantId,
                            compteId: l.position.compteId,
                            tiersId: l.position.tiersId,
                            niveauId: niveau.id,
                            dateRelance: date,
                            montant: new client_1.Prisma.Decimal(l.position.montantDu),
                            texte: l.texte,
                            createdBy,
                        })),
                    });
                }
                const remises = await this.remettre(tx, tenantId, createdBy, faites, objet);
                return {
                    lettres: faites.map((l, rang) => ({
                        compteId: l.position.compteId,
                        tiers: l.tiers,
                        montant: l.position.montantDu,
                        texte: l.texte,
                        modeleImpression: l.modele,
                        remise: remises[rang],
                    })),
                    dejaEcrits: aEcrire.filter((l) => dejaIds.has(l.position.compteId)),
                };
            })
            : { lettres: [], dejaEcrits: [] };
        const jourLisible = jour.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
        const dejaEmises = dejaEcrits.map((l) => ({
            compteId: l.position.compteId,
            compte: `${l.position.numero} · ${l.tiers}`,
            motif: `« ${niveau.libelle} » a déjà une lettre en file ou partie pour ce compte le ${jourLisible} · une seconde lettre identique n'est pas écrite.`,
        }));
        return {
            emises: lettres.length,
            niveau: niveau.niveau,
            misesEnFile: lettres.filter((l) => l.remise.statut !== null).length,
            nonRemises: lettres.filter((l) => l.remise.statut === null).length,
            exclues,
            sansObjet,
            dejaEmises,
            lettres,
        };
    }
    async remettre(tx, tenantId, createdBy, lettres, objet) {
        const avecAdresse = lettres
            .map((lettre, rang) => ({ lettre, rang, adresse: (lettre.position.tiersEmail ?? '').trim() }))
            .filter((l) => l.adresse.length > 0);
        const ecrits = avecAdresse.length
            ? await this.courrier.ecrireEnFileSansTenter(tx, tenantId, avecAdresse.map(({ lettre, adresse }) => ({
                destinataire: adresse,
                destinataireNom: lettre.position.tiersNom,
                sujet: objet,
                corps: lettre.texte,
                origine: courrier_service_1.ORIGINE_RELANCE,
                origineId: lettre.relanceId,
                createdBy,
            })))
            : [];
        const parRang = new Map(avecAdresse.map((l, i) => [l.rang, { adresse: l.adresse, ecrit: ecrits[i] }]));
        return lettres.map((lettre, rang) => {
            const remise = parRang.get(rang);
            if (!remise) {
                const { position } = lettre;
                return {
                    destinataire: null,
                    statut: null,
                    messageId: null,
                    motif: position.tiersId
                        ? `Aucune adresse de courriel pour « ${position.tiersNom ?? position.numero} » · la lettre est enregistrée dans l'historique, elle n'est partie à personne. Complétez la fiche du tiers, ou remettez-la autrement.`
                        : `Aucun tiers n'est rattaché au compte ${position.numero} · la lettre est enregistrée dans l'historique, elle n'a pas de destinataire.`,
                };
            }
            const { adresse, ecrit } = remise;
            if (ecrit.id === null)
                return { destinataire: adresse, statut: null, messageId: null, motif: ecrit.motif };
            return { destinataire: adresse, statut: ecrit.statut, messageId: ecrit.id, motif: null };
        });
    }
    async definirHorsRelance(tenantId, tiersId, params) {
        const tiers = await this.prisma.tiers.findFirst({ where: { id: tiersId, tenantId } });
        if (!tiers)
            throw new common_1.NotFoundException('Tiers introuvable pour ce dossier');
        if (!params.horsRelance) {
            return this.prisma.tiers.update({
                where: { id: tiersId },
                data: { horsRelance: false, motifHorsRelance: null, horsRelanceDepuis: null },
            });
        }
        const motif = (params.motif ?? '').trim();
        if (motif.length === 0) {
            throw new common_1.BadRequestException("Dites pourquoi ce tiers sort du circuit de relance (litige, échéancier convenu, tiers disparu). " +
                "Une exclusion sans motif ne se relit pas : au prochain examen, personne ne saura la lever ni la maintenir.");
        }
        return this.prisma.tiers.update({
            where: { id: tiersId },
            data: { horsRelance: true, motifHorsRelance: motif, horsRelanceDepuis: new Date() },
        });
    }
    async historique(tenantId, filtre = {}) {
        const lireDate = (v, fin) => {
            if (!v)
                return undefined;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
                throw new common_1.BadRequestException(`Date illisible : « ${v} » (AAAA-MM-JJ attendu).`);
            return new Date(`${v}T${fin ? '23:59:59.999' : '00:00:00.000'}Z`);
        };
        const du = lireDate(filtre.du, false);
        const au = lireDate(filtre.au, true);
        if (du && au && du > au)
            throw new common_1.BadRequestException('La date de début dépasse la date de fin.');
        const perimetre = {
            ...(filtre.compteId ? { compteId: filtre.compteId } : {}),
            ...(du || au ? { dateRelance: { ...(du ? { gte: du } : {}), ...(au ? { lte: au } : {}) } } : {}),
        };
        const [relances, total, somme] = await Promise.all([
            this.prisma.relance.findMany({
                where: { tenantId, ...perimetre },
                orderBy: { dateRelance: 'desc' },
                take: exports.PLAFOND_HISTORIQUE,
                include: {
                    compte: { select: { numero: true, intitule: true } },
                    tiers: { select: { nom: true } },
                    niveauRelance: { select: { niveau: true, libelle: true } },
                },
            }),
            this.prisma.relance.count({ where: { tenantId, ...perimetre } }),
            this.prisma.relance.aggregate({ where: { tenantId, ...perimetre }, _sum: { montant: true } }),
        ]);
        return {
            relances,
            total,
            tronque: total > relances.length,
            montantTotal: Number(somme._sum.montant ?? 0),
        };
    }
};
exports.RelancesService = RelancesService;
exports.RelancesService = RelancesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        courrier_service_1.CourrierService])
], RelancesService);
exports.PLAFOND_HISTORIQUE = 500;
//# sourceMappingURL=relances.service.js.map