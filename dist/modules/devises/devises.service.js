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
var DevisesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevisesService = exports.MOTIF_VERROU_PROVISION = exports.ECHEANCE_VERROU_PROVISION_MS = exports.MOTIF_ATTESTATION_MAX = exports.MOTIF_ATTESTATION_MIN = exports.PROVISION_SYCEBNL = exports.PROVISION_SYSCOHADA = void 0;
exports.avertissementBasculeSycebnl = avertissementBasculeSycebnl;
exports.racineEcartDeConversion = racineEcartDeConversion;
exports.famillesProvisionChange = famillesProvisionChange;
exports.familleProvisionDe = familleProvisionDe;
exports.natureDeLaFamille = natureDeLaFamille;
exports.ajusterProvisions = ajusterProvisions;
exports.bornesDeVersion = bornesDeVersion;
exports.libelleVersionHorsBornes = libelleVersionHorsBornes;
exports.avertissementEtatAtteste = avertissementEtatAtteste;
exports.versionEnVigueur = versionEnVigueur;
exports.comptesProvisionDeclarables = comptesProvisionDeclarables;
exports.motifRefusDeclarationOuverture = motifRefusDeclarationOuverture;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const lignes_tenues_1 = require("../comptabilite/lignes-tenues");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const perimetre_reevaluation_1 = require("./perimetre-reevaluation");
const ecarts_disponibilites_1 = require("./ecarts-disponibilites");
const contre_passations_de_disponibilites_1 = require("./contre-passations-de-disponibilites");
const contre_passation_manuelle_1 = require("./contre-passation-manuelle");
const RACINE = {
    perteRealisee: ecarts_disponibilites_1.RACINES_CHANGE_DISPONIBILITES.perte,
    gainRealise: ecarts_disponibilites_1.RACINES_CHANGE_DISPONIBILITES.gain,
};
function avertissementBasculeSycebnl(referentiel, ajustements) {
    if (referentiel !== client_1.Referentiel.SYCEBNL)
        return null;
    const long = ajustements.find((a) => a.compteProvision === '194' && a.reprise > 0.005);
    const courts = ajustements.filter((a) => a.compteProvision !== '194' && a.dotation > 0.005);
    if (!long || courts.length === 0)
        return null;
    const dotations = courts.map((a) => `${a.dotation.toFixed(2)} au ${a.compteProvision} par le ${a.compteDotation}`).join(', ');
    return (`Cette réévaluation reprend ${long.reprise.toFixed(2)} au 194 par le ${long.compteReprise} et dote ${dotations}. Si la ` +
        "provision du 194 couvrait des créances ou des dettes à moins d'un an (le module les y portait toutes jusqu'à la ligne A5 " +
        "ter), c'est la correction de leur classement · fiche SYCEBNL du compte 19, exclusions, « les provisions correspondant à " +
        "des risques à moins d'un an (utiliser 499 – Provisions pour risques à court terme) ». Le résultat net n'en dépend pas, " +
        "mais les soldes intermédiaires de cet exercice portent le déplacement (résultat financier contre exploitation ou H.A.O.) · " +
        "à dire aux Notes annexes. Aucune écriture de reclassement n'est passée.");
}
const RACINES_FINANCIERES_LONGUES = /^(16|17|18|26|27)/;
const RACINES_FINANCIERES_COURTES = /^(50|56)/;
const INTERETS_COURUS = {
    [client_1.Referentiel.SYSCOHADA]: /^(166|176|276)/,
    [client_1.Referentiel.SYCEBNL]: /^(186|276)/,
};
const FOURNISSEURS_D_INVESTISSEMENTS = {
    [client_1.Referentiel.SYSCOHADA]: /^(404|481)/,
    [client_1.Referentiel.SYCEBNL]: /^481/,
};
function naturePosition(numero, referentiel) {
    if (INTERETS_COURUS[referentiel].test(numero) || FOURNISSEURS_D_INVESTISSEMENTS[referentiel].test(numero))
        return 'FINANCIER_COURT';
    if (RACINES_FINANCIERES_LONGUES.test(numero))
        return 'FINANCIER_LONG';
    if (RACINES_FINANCIERES_COURTES.test(numero))
        return 'FINANCIER_COURT';
    if (referentiel === client_1.Referentiel.SYCEBNL && numero.startsWith('48'))
        return 'HAO';
    return 'EXPLOITATION';
}
function racineEcartSyscohada(estCreance, estPerte, nature) {
    const exploitation = nature === 'EXPLOITATION' || nature === 'HAO';
    if (estPerte)
        return estCreance ? (exploitation ? '4781' : '4782') : exploitation ? '4783' : '4784';
    return estCreance ? (exploitation ? '4791' : '4792') : exploitation ? '4793' : '4794';
}
function racineEcartSycebnl(estCreance, estPerte, nature) {
    if (nature === 'FINANCIER_COURT' || nature === 'FINANCIER_LONG') {
        if (estPerte)
            return estCreance ? '4782' : '4784';
        return estCreance ? '4792' : '4794';
    }
    const hao = nature === 'HAO';
    if (estPerte)
        return estCreance ? (hao ? '47818' : '47811') : hao ? '47838' : '47831';
    return estCreance ? (hao ? '47918' : '47911') : hao ? '47938' : '47931';
}
function racineEcartDeConversion(referentiel, numero, estCreance, estPerte) {
    const nature = naturePosition(numero, referentiel);
    return referentiel === client_1.Referentiel.SYSCOHADA
        ? racineEcartSyscohada(estCreance, estPerte, nature)
        : racineEcartSycebnl(estCreance, estPerte, nature);
}
exports.PROVISION_SYSCOHADA = {
    EXPLOITATION: { dotation: '6591', provision: '4991', reprise: '7591' },
    FINANCIER_COURT: { dotation: '6791', provision: '4997', reprise: '7791' },
    FINANCIER_LONG: { dotation: '6971', provision: '194', reprise: '7971' },
};
exports.PROVISION_SYCEBNL = {
    EXPLOITATION: { dotation: '6591', provision: '4991', reprise: '7591' },
    HAO: { dotation: '839', provision: '4998', reprise: '849' },
    FINANCIER_COURT: { dotation: '6791', provision: '599', reprise: '7791' },
    FINANCIER_LONG: { dotation: '6971', provision: '194', reprise: '7971' },
};
function famillesProvisionChange(referentiel) {
    return referentiel === client_1.Referentiel.SYSCOHADA ? Object.values(exports.PROVISION_SYSCOHADA) : Object.values(exports.PROVISION_SYCEBNL);
}
function familleProvisionDe(referentiel, numero) {
    const nature = naturePosition(numero, referentiel);
    if (referentiel === client_1.Referentiel.SYCEBNL)
        return exports.PROVISION_SYCEBNL[nature];
    return exports.PROVISION_SYSCOHADA[nature === 'HAO' ? 'EXPLOITATION' : nature];
}
function natureDeLaFamille(compteProvision) {
    if (compteProvision === '4991')
        return 'exploitation';
    if (compteProvision === '4998')
        return 'H.A.O.';
    if (compteProvision === '194')
        return 'financier, long terme';
    return 'financier, court terme';
}
function ajusterProvisions(familles, requise, enPlace) {
    const arrondi = (x) => Math.round(x * 100) / 100;
    const rendu = [];
    for (const f of familles) {
        const r = arrondi(requise.get(f.provision) ?? 0);
        const e = arrondi(enPlace.get(f.provision) ?? 0);
        if (Math.abs(r) < 0.005 && Math.abs(e) < 0.005)
            continue;
        const ecart = arrondi(r - e);
        rendu.push({
            compteProvision: f.provision,
            compteDotation: f.dotation,
            compteReprise: f.reprise,
            requise: r,
            enPlace: e,
            dotation: ecart > 0 ? ecart : 0,
            reprise: ecart < 0 ? -ecart : 0,
        });
    }
    return rendu;
}
function sommeProvision(lignes, racine, depuis, jusqua, jusquaCompris) {
    return lignes
        .filter((l) => l.numero.startsWith(racine) &&
        (!depuis || l.date.getTime() >= depuis.getTime()) &&
        (jusquaCompris ? l.date.getTime() <= jusqua.getTime() : l.date.getTime() < jusqua.getTime()))
        .reduce((t, l) => t + l.montant, 0);
}
function bornesDeVersion(ouverture, explique) {
    const module = ouverture.provisionModule ?? explique;
    return { plancher: arrondiCentime(Math.min(module, ouverture.montant)), plafond: ouverture.montant, module: arrondiCentime(module) };
}
function libelleVersionHorsBornes(x) {
    const v = x.enPlaceOuverture.toFixed(2);
    const solde = x.plafondFiable ? "solde créditeur d'ouverture" : "solde reconstitué à la clôture de l'exercice précédent";
    if (x.borne === 'PLAFOND') {
        return (`${x.compteProvision} · ${v} au-dessus du ${solde} (${x.plafond.toFixed(2)}) · une reprise rendrait le compte débiteur ; ` +
            `déclarez entre ${x.plancher.toFixed(2)} et ${x.plafond.toFixed(2)}`);
    }
    if (x.contesteeAuMontant !== null) {
        return (`${x.compteProvision} · la provision passée par OmegaX a changé depuis la contestation (${x.contesteeAuMontant.toFixed(2)} ` +
            `contestés, ${x.provisionModule.toFixed(2)} aujourd'hui) · la perte provisionnée depuis serait dotée une seconde fois ; ` +
            `confirmez ou corrigez par une version datée plus tard (retouchée si aucune réévaluation ne l'a utilisée), entre ` +
            `${x.plancher.toFixed(2)} et ${x.plafond.toFixed(2)} (le ${solde})`);
    }
    return (`${x.compteProvision} · ${v} sous la provision pour pertes de change passée par OmegaX jusqu'à la clôture précédente ` +
        `(${x.provisionModule.toFixed(2)}) · la perte déjà provisionnée par OmegaX serait dotée une seconde fois ; déclarez entre ` +
        `${x.plancher.toFixed(2)} et ${x.plafond.toFixed(2)} (le ${solde}) une version corrigée (retouchée si aucune réévaluation ne ` +
        "l'a utilisée, sinon au début d'un exercice postérieur avec son motif), ou, si la provision du module est erronée, " +
        'déclarez-le expressément (« La provision passée par OmegaX ne correspond pas à la provision de change réelle », avec le motif de la contestation)');
}
const arrondiCentime = (x) => Math.round(x * 100) / 100;
exports.MOTIF_ATTESTATION_MIN = 10;
exports.MOTIF_ATTESTATION_MAX = 500;
function avertissementEtatAtteste(attestation, motifEtat) {
    const le = attestation.etatAttesteLe ? attestation.etatAttesteLe.toISOString().slice(0, 10) : '·';
    return (`État de l'écart attesté par le cabinet le ${le} (« ${attestation.motifAttestation ?? ''} ») · ce refus de la règle d'état ` +
        `devient un avertissement, le cabinet répondant de l'état des comptes · ${motifEtat}`);
}
exports.ECHEANCE_VERROU_PROVISION_MS = 15 * 60 * 1000;
exports.MOTIF_VERROU_PROVISION = 'Une opération sur la provision pour pertes de change est en cours sur ce dossier · réessayez après sa fin.';
function versionEnVigueur(versions, date) {
    let retenue;
    for (const v of versions) {
        if (v.dateReference.getTime() > date.getTime())
            continue;
        if (!retenue || v.dateReference.getTime() > retenue.dateReference.getTime())
            retenue = v;
    }
    return retenue;
}
function comptesProvisionDeclarables(referentiel) {
    return famillesProvisionChange(referentiel).map((f) => f.provision);
}
function motifRefusDeclarationOuverture(referentiel, d) {
    const admis = comptesProvisionDeclarables(referentiel);
    if (!d.compteProvision || !admis.includes(d.compteProvision)) {
        return (`Le compte ${d.compteProvision ?? '(absent)'} ne porte pas de provision pour pertes de change dans ce référentiel · ` +
            `comptes admis : ${admis.join(', ')}.`);
    }
    if (typeof d.montant !== 'number' || !Number.isFinite(d.montant) || d.montant < 0) {
        return 'Le montant de la provision existant à l’ouverture est un nombre positif ou nul.';
    }
    if (!d.dateReference || Number.isNaN(new Date(d.dateReference).getTime())) {
        return 'La date à laquelle la provision existait est exigée.';
    }
    if (!d.source || d.source.trim().length === 0) {
        return 'La source du montant déclaré est exigée (pièce, balance d’ouverture, liasse de l’exercice précédent).';
    }
    if (d.provisionModuleContestee === true && (!d.motifContestation || d.motifContestation.trim().length === 0)) {
        return 'La provision passée par OmegaX est déclarée erronée · dites pourquoi (motif de la contestation, distinct du motif de correction).';
    }
    if (d.provisionModuleContestee !== true && d.motifContestation && d.motifContestation.trim().length > 0) {
        return 'Un motif de contestation sans contestation déclarée ne se garde pas · cochez « La provision passée par OmegaX est erronée », ou retirez ce motif.';
    }
    return null;
}
const ANNULEE = { is: { annuleeLe: { not: null } } };
const ECRITURES_D_UNE_REEVALUATION_ANNULEE = [
    { reevaluationEcarts: ANNULEE },
    { reevaluationProvision: ANNULEE },
    { reevaluationExtourne: ANNULEE },
    { corrigeEcriture: { is: { OR: [{ reevaluationEcarts: ANNULEE }, { reevaluationProvision: ANNULEE }, { reevaluationExtourne: ANNULEE }] } } },
];
const SELECTION_REEVALUATION_RELUE = {
    id: true,
    exerciceId: true,
    dateReevaluation: true,
    createdAt: true,
    annuleeLe: true,
    coursUtilises: true,
    ecartsDisponibilites: true,
    ventilationDisponibilites: true,
    ecritureEcarts: {
        select: {
            statut: true,
            valideeAt: true,
            lignes: { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } },
        },
    },
};
function dansLaFenetre(x, fenetre) {
    return { OR: [{ exerciceId: x.exercice.id, date: { gte: x.dateReevaluation } }, { exerciceId: { in: fenetre.map((e) => e.id) } }] };
}
function passeSurLesDisponibilites(reeval) {
    const passe = new Map();
    for (const l of reeval.ecritureEcarts?.lignes ?? []) {
        if (!(0, ecarts_disponibilites_1.estDisponibilite)(l.compte.numero))
            continue;
        passe.set(l.compteId, (passe.get(l.compteId) ?? 0) + Number(l.debit) - Number(l.credit));
    }
    return passe;
}
let DevisesService = DevisesService_1 = class DevisesService {
    constructor(prisma, ecritureService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
        this.journal = new common_1.Logger(DevisesService_1.name);
    }
    async lister(tenantId) {
        return this.prisma.devise.findMany({
            where: { tenantId },
            orderBy: { code: 'asc' },
            include: { cours: { orderBy: { date: 'desc' }, take: 12 } },
        });
    }
    async creer(tenantId, dto) {
        const code = dto.code.toUpperCase();
        const existante = await this.prisma.devise.findFirst({ where: { tenantId, code } });
        if (existante)
            throw new common_1.ConflictException(`La devise ${code} existe déjà dans ce dossier`);
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (tenant?.devise && tenant.devise.toUpperCase() === code) {
            throw new common_1.BadRequestException(`${code} est la monnaie de tenue de ce dossier : elle n'a pas de cours et ne se réévalue pas.`);
        }
        return this.prisma.devise.create({ data: { tenantId, code, intitule: dto.intitule } });
    }
    async modifier(tenantId, deviseId, dto) {
        await this.trouver(tenantId, deviseId);
        return this.prisma.devise.update({ where: { id: deviseId }, data: dto });
    }
    async poserCours(tenantId, deviseId, dto) {
        await this.trouver(tenantId, deviseId);
        const date = new Date(dto.date);
        return this.prisma.coursDevise.upsert({
            where: { deviseId_date: { deviseId, date } },
            create: { deviseId, date, cours: new client_1.Prisma.Decimal(dto.cours), source: dto.source },
            update: { cours: new client_1.Prisma.Decimal(dto.cours), source: dto.source },
        });
    }
    async ajouterCours(tenantId, deviseId, dto, dejaCote) {
        await this.trouver(tenantId, deviseId);
        const date = new Date(dto.date);
        try {
            return await this.prisma.coursDevise.create({
                data: { deviseId, date, cours: new client_1.Prisma.Decimal(dto.cours), source: dto.source },
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
                throw new common_1.ConflictException(dejaCote);
            throw e;
        }
    }
    async trouver(tenantId, deviseId) {
        const devise = await this.prisma.devise.findFirst({ where: { id: deviseId, tenantId } });
        if (!devise)
            throw new common_1.NotFoundException('Devise introuvable pour ce dossier');
        return devise;
    }
    async coursA(deviseId, date) {
        const cote = await this.prisma.coursDevise.findFirst({
            where: { deviseId, date: { lte: date } },
            orderBy: { date: 'desc' },
        });
        return cote ? Number(cote.cours) : null;
    }
    async calculer(tenantId, dto) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        const date = dto.dateReevaluation ? new Date(dto.dateReevaluation) : exercice.dateFin;
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
        if (!tenant)
            throw new common_1.BadRequestException('Dossier introuvable');
        const avertissementsGroupes = new Set();
        const horsDeLExercice = {
            OR: [{ ecriture: { exerciceId: { not: dto.exerciceId } } }, { ecriture: { date: { gt: date } } }],
        };
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: {
                ecriture: { tenantId, exerciceId: dto.exerciceId, date: { lte: date }, ...ecritures_de_situation_1.HORS_SITUATION },
                deviseId: { not: null },
                OR: [{ lettre: null }, { lettrage: { lignes: { some: horsDeLExercice } } }],
            },
            include: {
                compte: { select: { id: true, numero: true, intitule: true } },
                devise: { select: { id: true, code: true } },
            },
        });
        const idsGroupes = [
            ...new Set(lignes.filter((l) => l.lettrageId && !(0, ecarts_disponibilites_1.estDisponibilite)(l.compte.numero)).map((l) => l.lettrageId)),
        ];
        const lignesDesGroupes = idsGroupes.length
            ? (await this.prisma.ligneEcriture.findMany({
                where: { lettrageId: { in: idsGroupes }, ecriture: { tenantId } },
                select: {
                    id: true,
                    lettrageId: true,
                    compteId: true,
                    debit: true,
                    credit: true,
                    deviseId: true,
                    montantDevise: true,
                    lettrage: { select: { code: true } },
                    compte: { select: { id: true, numero: true, intitule: true } },
                    devise: { select: { id: true, code: true } },
                    ecriture: { select: { exerciceId: true, date: true } },
                },
            })).map((l) => ({
                ...l,
                lettrageId: l.lettrageId,
                code: l.lettrage?.code ?? '',
                debit: Number(l.debit),
                credit: Number(l.credit),
                montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
            }))
            : [];
        const lecture = (0, perimetre_reevaluation_1.lectureDesGroupes)(lignesDesGroupes, { exerciceId: dto.exerciceId, date });
        const denoues = (0, perimetre_reevaluation_1.groupesDenoues)(lignesDesGroupes.filter((l) => !lecture.aCheval.has(l.lettrageId)));
        const groupesSignales = new Set();
        const positionsNonReevaluees = [];
        const ouverture = (l, devise) => ({
            compteId: l.compte.id,
            numero: l.compte.numero,
            intitule: l.compte.intitule,
            deviseCode: devise.code,
            deviseId: devise.id,
            montantDevise: 0,
            valeurComptable: 0,
            coursCloture: 0,
            valeurReevaluee: 0,
            ecart: 0,
            estTresorerie: (0, ecarts_disponibilites_1.estDisponibilite)(l.compte.numero),
            provisionnable: 0,
        });
        const positions = new Map();
        for (const l of lignes) {
            if (!l.devise)
                continue;
            if (l.lettre && (0, ecarts_disponibilites_1.estDisponibilite)(l.compte.numero))
                continue;
            const denoue = l.lettrageId ? denoues.get(l.lettrageId) : undefined;
            if (denoue) {
                if (!groupesSignales.has(l.lettrageId)) {
                    groupesSignales.add(l.lettrageId);
                    positionsNonReevaluees.push({
                        numero: l.compte.numero,
                        intitule: l.compte.intitule,
                        deviseCode: l.devise.code,
                        montantDevise: 0,
                        motif: `lettrage ${denoue.code.toLowerCase()} · ${(0, perimetre_reevaluation_1.motifPositionDenouee)(0, denoue.ecart) ?? 'position dénouée'}`,
                    });
                }
                continue;
            }
            const cle = `${l.compteId}|${l.deviseId}`;
            const acc = positions.get(cle) ?? ouverture(l, l.devise);
            const sens = Number(l.debit) - Number(l.credit) >= 0 ? 1 : -1;
            acc.montantDevise += sens * Number(l.montantDevise ?? 0);
            acc.valeurComptable += Number(l.debit) - Number(l.credit);
            positions.set(cle, acc);
        }
        for (const l of lecture.lignesEnFrancs) {
            const devise = lecture.deviseDuGroupe.get(l.lettrageId);
            if (!devise) {
                avertissementsGroupes.add(`${l.compte.numero} · lettrage ${l.code.toLowerCase()} · le groupe sort de l'exercice et porte plusieurs devises ; ses lignes en francs ` +
                    "(écart réalisé) ne se rangent dans aucune position · vérifiez la position de ce compte.");
                continue;
            }
            const cle = `${l.compteId}|${devise.id}`;
            const acc = positions.get(cle) ?? ouverture(l, devise);
            acc.valeurComptable += l.debit - l.credit;
            positions.set(cle, acc);
        }
        for (const [id, d] of lecture.denouesACheval) {
            const devise = lecture.deviseDuGroupe.get(id);
            const l = lignesDesGroupes.find((x) => x.lettrageId === id);
            if (!devise || !l)
                continue;
            const cle = `${l.compteId}|${devise.id}`;
            const acc = positions.get(cle);
            if (acc)
                acc.valeurComptable = Math.round((acc.valeurComptable - d.ecart) * 100) / 100;
            positionsNonReevaluees.push({
                numero: l.compte.numero,
                intitule: l.compte.intitule,
                deviseCode: devise.code,
                montantDevise: 0,
                motif: `lettrage ${d.code.toLowerCase()} · ${(0, perimetre_reevaluation_1.motifPositionDenouee)(0, d.ecart) ?? 'position dénouée'}`,
            });
        }
        const clesDisponibilites = [...positions.values()].filter((p) => p.estTresorerie).map((p) => `${p.compteId}|${p.deviseId}`);
        const reports = clesDisponibilites.length > 0
            ? await this.ecartsReportesDesDisponibilites(tenantId, exercice, clesDisponibilites)
            : { parCle: new Map(), reserves: [] };
        for (const p of positions.values()) {
            const report = reports.parCle.get(`${p.compteId}|${p.deviseId}`);
            if (report !== undefined)
                p.valeurComptable = Math.round((p.valeurComptable + report) * 100) / 100;
        }
        const coursManquants = new Set();
        const coursUtilises = {};
        const resultat = [];
        for (const p of positions.values()) {
            if (Math.abs(p.montantDevise) < 0.005 && Math.abs(p.valeurComptable) < 0.005)
                continue;
            const motif = (0, perimetre_reevaluation_1.motifHorsReevaluation)(p.numero, tenant.referentiel) ??
                ((0, ecarts_disponibilites_1.estDisponibilite)(p.numero) ? null : (0, perimetre_reevaluation_1.motifPositionDenouee)(p.montantDevise, p.valeurComptable));
            if (motif) {
                positionsNonReevaluees.push({
                    numero: p.numero,
                    intitule: p.intitule,
                    deviseCode: p.deviseCode,
                    montantDevise: Math.round(p.montantDevise * 100) / 100,
                    motif,
                });
                continue;
            }
            const cours = await this.coursA(p.deviseId, date);
            if (cours === null) {
                coursManquants.add(p.deviseCode);
                continue;
            }
            p.coursCloture = cours;
            coursUtilises[p.deviseId] = cours;
            p.valeurReevaluee = Math.round(p.montantDevise * cours * 100) / 100;
            p.ecart = Math.round((p.valeurReevaluee - p.valeurComptable) * 100) / 100;
            if (Math.abs(p.ecart) >= 0.005)
                resultat.push(p);
        }
        const latentes = resultat.filter((p) => !p.estTresorerie);
        const tresorerie = resultat.filter((p) => p.estTresorerie);
        const perteLatente = latentes.filter((p) => p.ecart < 0).reduce((s, p) => s - p.ecart, 0);
        const gainLatent = latentes.filter((p) => p.ecart > 0).reduce((s, p) => s + p.ecart, 0);
        const perteRealisee = tresorerie.filter((p) => p.ecart < 0).reduce((s, p) => s - p.ecart, 0);
        const gainRealise = tresorerie.filter((p) => p.ecart > 0).reduce((s, p) => s + p.ecart, 0);
        const positionGlobale = dto.positionGlobale === true;
        const perteParDevise = new Map();
        const gainParDevise = new Map();
        for (const p of latentes) {
            const table = p.ecart < 0 ? perteParDevise : gainParDevise;
            table.set(p.deviseCode, (table.get(p.deviseCode) ?? 0) + Math.abs(p.ecart));
        }
        for (const p of resultat) {
            if (p.estTresorerie || p.ecart >= 0) {
                p.provisionnable = 0;
                continue;
            }
            const perteDevise = perteParDevise.get(p.deviseCode) ?? 0;
            const gainDevise = gainParDevise.get(p.deviseCode) ?? 0;
            const ratio = positionGlobale && perteDevise > 0 ? Math.max(0, perteDevise - gainDevise) / perteDevise : 1;
            p.provisionnable = Math.round(-p.ecart * ratio * 100) / 100;
        }
        const provision = resultat.reduce((s, p) => s + p.provisionnable, 0);
        const familles = famillesProvisionChange(tenant.referentiel);
        const requiseParFamille = new Map();
        for (const p of resultat) {
            if (p.provisionnable <= 0.005)
                continue;
            const f = familleProvisionDe(tenant.referentiel, p.numero);
            requiseParFamille.set(f.provision, (requiseParFamille.get(f.provision) ?? 0) + p.provisionnable);
        }
        const enPlace = await this.provisionsEnPlace(tenantId, exercice, date, familles);
        const ajustementsProvision = ajusterProvisions(familles, requiseParFamille, enPlace.parFamille).map((a) => ({
            ...a,
            declaree: enPlace.declarees.get(a.compteProvision) ?? null,
            enPlaceIncomplete: enPlace.nonDeclarees.some((n) => n.compteProvision === a.compteProvision),
        })).map((a) => ({
            ...a,
            montantsProvisoires: a.enPlaceIncomplete,
        }));
        const avertissements = [...enPlace.avertissements, ...reports.reserves, ...avertissementsGroupes];
        for (const p of resultat) {
            if (p.estTresorerie || p.ecart >= 0)
                continue;
            if (naturePosition(p.numero, tenant.referentiel) !== 'FINANCIER_LONG')
                continue;
            avertissements.push(`${p.numero} ${p.intitule} (${p.deviseCode}) · perte de change de ` +
                `${Math.abs(p.ecart).toFixed(2)} sur un emprunt, un prêt ou une immobilisation financière. ` +
                "Si l'échéance dépasse un an, l'AUDCIF (art. 56) impose d'ÉTALER cette perte sur la durée " +
                'restant à courir, en proportion des remboursements à venir prévus au contrat. La totalité est ' +
                "dotée ici, faute de tableau d'amortissement : ajustez la dotation et portez le montant " +
                'potentiel total dans les Notes annexes.');
        }
        const bascule = avertissementBasculeSycebnl(tenant.referentiel, ajustementsProvision);
        if (bascule)
            avertissements.push(bascule);
        return {
            dateReevaluation: date.toISOString().slice(0, 10),
            positions: resultat,
            perteLatente: Math.round(perteLatente * 100) / 100,
            gainLatent: Math.round(gainLatent * 100) / 100,
            perteRealisee: Math.round(perteRealisee * 100) / 100,
            gainRealise: Math.round(gainRealise * 100) / 100,
            provision: Math.round(provision * 100) / 100,
            provisionEnPlace: Math.round(ajustementsProvision.reduce((t, a) => t + a.enPlace, 0) * 100) / 100,
            ajustementsProvision,
            provisionsOuvertureNonDeclarees: enPlace.nonDeclarees,
            provisionEnPlaceIncomplete: enPlace.nonDeclarees.length > 0,
            provisionsOuvertureExcessives: enPlace.excessives,
            provisionSansPositionGlobale: Math.round(perteLatente * 100) / 100,
            positionGlobaleRetenue: positionGlobale,
            avertissements,
            coursManquants: [...coursManquants],
            positionsNonReevaluees,
            coursUtilises,
            reportsDisponibilitesNonEtablis: reports.reserves,
        };
    }
    async reevaluer(tenantId, createdBy, dto) {
        if (dto.dateReevaluation !== undefined) {
            const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId }, select: { dateFin: true } });
            if (!exercice)
                throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
            const motif = (0, perimetre_reevaluation_1.motifDateReevaluation)(dto.dateReevaluation, exercice.dateFin);
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
        if (dto.simulation)
            return { rapport: await this.calculer(tenantId, dto), ecritures: [] };
        return this.sousVerrouDuDossier(tenantId, 'REEVALUATION', () => this.reevaluerSousVerrou(tenantId, createdBy, dto));
    }
    async sousVerrouDuDossier(tenantId, geste, travail) {
        const maintenant = new Date();
        await this.prisma.verrouProvisionChange.deleteMany({ where: { tenantId, echeance: { lt: maintenant } } });
        let verrou;
        try {
            verrou = await this.prisma.verrouProvisionChange.create({
                data: { tenantId, geste, echeance: new Date(maintenant.getTime() + exports.ECHEANCE_VERROU_PROVISION_MS) },
                select: { id: true },
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                const tenu = await this.prisma.verrouProvisionChange.findFirst({
                    where: { tenantId },
                    select: { geste: true, createdAt: true, echeance: true },
                });
                throw new common_1.ConflictException(tenu
                    ? `${exports.MOTIF_VERROU_PROVISION} Geste en cours · ${tenu.geste}, depuis le ${tenu.createdAt.toISOString()} ; ` +
                        `le verrou échoit au plus tard le ${tenu.echeance.toISOString()}.`
                    : exports.MOTIF_VERROU_PROVISION);
            }
            throw e;
        }
        let resultat;
        let erreur = null;
        let echec = false;
        try {
            resultat = await travail();
        }
        catch (e) {
            echec = true;
            erreur = e;
        }
        try {
            await this.prisma.verrouProvisionChange.deleteMany({ where: { tenantId, id: verrou.id } });
        }
        catch (liberation) {
            this.journal.error(`Verrou de provision du dossier ${tenantId} non retiré · il échoit à son échéance`, liberation instanceof Error ? liberation.stack : String(liberation));
        }
        if (echec)
            throw erreur;
        return resultat;
    }
    async motifContrePassationManquante(tenantId, exercice) {
        const jourDe = (d) => d.toISOString().slice(0, 10);
        const lues = await this.prisma.reevaluation.findMany({
            where: { tenantId, annuleeLe: null, exerciceId: { not: exercice.id }, exercice: { dateFin: { lt: exercice.dateDebut } } },
            orderBy: [{ dateReevaluation: 'desc' }, { id: 'asc' }],
            take: contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES + 1,
            select: {
                id: true,
                dateReevaluation: true,
                exercice: { select: { id: true, dateDebut: true, dateFin: true } },
                ecritureExtourneId: true,
                ecritureExtourne: { select: { id: true, numeroPiece: true, date: true, exercice: { select: { id: true, dateDebut: true } } } },
                etatAtteste: true,
                motifAttestation: true,
                etatAttesteLe: true,
                contrePassationDeclareeId: true,
                contrePassationDeclaree: { select: { id: true, numeroPiece: true, date: true, exercice: { select: { id: true, dateDebut: true } } } },
                ecritureEcarts: {
                    select: { lignes: { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } } },
                },
            },
        });
        const depassement = lues.length > contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES
            ? `Contre-passations vérifiées sur les ${contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES} réévaluations antérieures les plus récentes · ` +
                "les plus anciennes n'ont pas été relues ; vérifiez qu'elles sont contre-passées."
            : null;
        const cibles = new Map();
        const manquantes = [];
        let referentiel = null;
        const malPlacees = [];
        for (const r of lues.slice(0, contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES).reverse()) {
            if (!r.ecritureEcarts)
                continue;
            const lignes = r.ecritureEcarts.lignes.map((l) => ({
                compteId: l.compteId,
                compteNumero: l.compte.numero,
                debit: Number(l.debit),
                credit: Number(l.credit),
            }));
            const partage = (0, ecarts_disponibilites_1.partagerLignesDEcarts)(lignes);
            if (partage.aContrePasser.length === 0)
                continue;
            let cible = cibles.get(r.exercice.id);
            if (cible === undefined) {
                cible = await this.cibleDeContrePassation(tenantId, r.exercice.dateFin);
                cibles.set(r.exercice.id, cible);
            }
            const jour = jourDe(r.dateReevaluation);
            const periode = `exercice du ${jourDe(r.exercice.dateDebut)} au ${jourDe(r.exercice.dateFin)}`;
            const ouvertureCible = !cible || cible.id === exercice.id
                ? "à l'ouverture de cet exercice"
                : `à l'ouverture de l'exercice du ${jourDe(cible.dateDebut)} au ${jourDe(cible.dateFin)}, le premier ouvert après la réévaluation`;
            if (r.ecritureExtourneId || r.contrePassationDeclareeId) {
                const y = r.ecritureExtourne ?? r.contrePassationDeclaree;
                const dansSonExercice = !r.ecritureExtourneId && y !== null && y.exercice.id === r.exercice.id;
                if (y && (dansSonExercice || (await this.contrePassationASaPlace(tenantId, r.exercice, y.exercice, exercice))))
                    continue;
                malPlacees.push({
                    jour,
                    periode,
                    piece: y ? `pièce n° ${y.numeroPiece ?? '·'} du ${jourDe(y.date)}` : 'pièce introuvable',
                    ouvertureCible,
                    declaree: !r.ecritureExtourneId,
                });
                continue;
            }
            const attendus = (0, contre_passation_manuelle_1.montantsAContrePasser)(partage.aContrePasser);
            referentiel ??= await this.referentielDuDossier(tenantId);
            const manuelles = this.motifEtatDeLEcart(await this.etatDeLEcart(tenantId, r, attendus), attendus, jour, referentiel);
            manquantes.push({
                jour,
                periode,
                montants: (0, contre_passation_manuelle_1.libelleMontantsAContrePasser)(attendus),
                ouvertureCible,
                integrale: partage.motifRefus !== null,
                manuelles,
                atteste: r.etatAtteste ? { motifAttestation: r.motifAttestation, etatAttesteLe: r.etatAttesteLe } : null,
            });
        }
        const messages = [];
        for (const m of malPlacees) {
            messages.push(`La contre-passation ${m.declaree ? 'déclarée ' : ''}de la réévaluation du ${m.jour} (${m.periode}, ${m.piece}) n'est pas ` +
                "à l'ouverture du premier exercice ouvert qui suit la réévaluation · ses écarts de conversion y sont donc toujours en " +
                'place, et réévaluer cet exercice les repasserait. ' +
                (m.declaree
                    ? 'Retirez la déclaration (Devises, « Retirer la déclaration »), corrigez l’écriture manuelle, puis contre-passez '
                    : 'Annulez cette contre-passation (Devises, « Annuler la contre-passation »), passez-la ') +
                `${m.ouvertureCible}, puis réévaluez.`);
        }
        const avertissements = [];
        for (const m of manquantes) {
            if (m.manuelles && m.atteste) {
                avertissements.push(avertissementEtatAtteste(m.atteste, `réévaluation du ${m.jour} (${m.periode}) · ${m.manuelles.charAt(0).toLowerCase()}${m.manuelles.slice(1)}`));
                continue;
            }
            if (m.manuelles) {
                messages.push(`La réévaluation du ${m.jour} n'est pas contre-passée (${m.periode}) · ${m.manuelles.charAt(0).toLowerCase()}${m.manuelles.slice(1)}`);
                continue;
            }
            messages.push(`La réévaluation du ${m.jour} n'est pas contre-passée (${m.periode}) · ses écarts de conversion sont toujours en place ` +
                `(à contre-passer · ${m.montants}), et réévaluer cet exercice repasserait le même écart sur les créances et dettes en ` +
                `devise. Passez la contre-passation de la réévaluation du ${m.jour} (Devises) ${m.ouvertureCible}, puis réévaluez · ` +
                'si la première période en est close, la pièce est reportée au premier jour non clôturé, sa date de valeur restant ' +
                "l'ouverture (AUDCIF art. 22, 4°)." +
                (m.integrale
                    ? " Son écriture des écarts ne se partage pas · demandez la contre-passation intégrale (« Contre-passation intégrale »)."
                    : ''));
        }
        return { refus: messages.length > 0 ? messages.join(' ') : null, depassement, avertissements };
    }
    async contrePassationASaPlace(tenantId, exerciceReevalue, exerciceContrePassation, exercice) {
        if (exerciceContrePassation.dateDebut.getTime() <= exerciceReevalue.dateFin.getTime())
            return false;
        if (exercice && exerciceContrePassation.dateDebut.getTime() > exercice.dateDebut.getTime())
            return false;
        const ouvertEntreDeux = await this.prisma.exercice.findFirst({
            where: {
                tenantId,
                statut: client_1.StatutExercice.OUVERT,
                dateDebut: { gt: exerciceReevalue.dateFin, lt: exerciceContrePassation.dateDebut },
            },
            select: { id: true },
        });
        return !ouvertEntreDeux;
    }
    async cibleDeContrePassation(tenantId, finExerciceReevalue) {
        return this.prisma.exercice.findFirst({
            where: { tenantId, dateDebut: { gt: finExerciceReevalue }, statut: client_1.StatutExercice.OUVERT },
            orderBy: { dateDebut: 'asc' },
            select: { id: true, dateDebut: true, dateFin: true, statut: true },
        });
    }
    async motifRefusOrdre(tenantId, exercice) {
        const anterieurs = await this.prisma.exercice.findMany({
            where: { tenantId, dateFin: { lt: exercice.dateDebut }, statut: { not: client_1.StatutExercice.CLOTURE } },
            orderBy: { dateDebut: 'asc' },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        for (const e of anterieurs) {
            const passee = await this.prisma.reevaluation.findFirst({ where: { tenantId, exerciceId: e.id, annuleeLe: null }, select: { id: true } });
            if (passee)
                continue;
            const r = await this.calculer(tenantId, { exerciceId: e.id });
            const sansObjet = r.positions.length === 0 &&
                !r.ajustementsProvision.some((a) => a.dotation > 0.005 || a.reprise > 0.005) &&
                r.provisionsOuvertureNonDeclarees.length === 0 &&
                r.provisionsOuvertureExcessives.length === 0;
            if (sansObjet)
                continue;
            const jour = (d) => d.toISOString().slice(0, 10);
            if (r.provisionsOuvertureExcessives.length > 0) {
                return (`L'exercice du ${jour(e.dateDebut)} au ${jour(e.dateFin)}, antérieur et encore ouvert, porte une provision pour pertes ` +
                    `de change déclarée à l'ouverture qui ne concorde pas avec son ouverture (${r.provisionsOuvertureExcessives
                        .map(libelleVersionHorsBornes)
                        .join(' ; ')}) · mettez-la à jour, puis réévaluez-le s'il a des positions.`);
            }
            if (r.provisionsOuvertureNonDeclarees.length > 0) {
                return (`L'exercice du ${jour(e.dateDebut)} au ${jour(e.dateFin)}, antérieur et encore ouvert, porte une provision pour pertes ` +
                    `de change à l'ouverture non déclarée (${r.provisionsOuvertureNonDeclarees.map((n) => n.compteProvision).join(', ')}) · ` +
                    "déclarez-la au début de cet exercice (montant, source ; zéro si le solde porte un autre risque), puis réévaluez-le " +
                    "s'il a des positions. La provision se réajuste à la clôture de chaque exercice à partir de la précédente (fiche du compte 19).");
            }
            return (`L'exercice du ${jour(e.dateDebut)} au ${jour(e.dateFin)}, antérieur et encore ouvert, n'est pas réévalué · ` +
                "réévaluez-le d'abord. La provision pour pertes de change se réajuste à la clôture de chaque exercice à partir " +
                "de la précédente (fiche du compte 19) · réévaluer celui-ci avant doterait deux fois la même perte.");
        }
        return null;
    }
    async reevaluerSousVerrou(tenantId, createdBy, dto) {
        const exerciceCourant = await this.prisma.exercice.findFirst({
            where: { id: dto.exerciceId, tenantId },
            select: { id: true, dateDebut: true },
        });
        if (!exerciceCourant)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        const refusOrdre = await this.motifRefusOrdre(tenantId, exerciceCourant);
        if (refusOrdre)
            throw new common_1.BadRequestException(refusOrdre);
        const contrePassation = await this.motifContrePassationManquante(tenantId, exerciceCourant);
        if (contrePassation.refus)
            throw new common_1.BadRequestException(contrePassation.refus);
        const rapport = await this.calculer(tenantId, dto);
        if (contrePassation.depassement)
            rapport.avertissements.push(contrePassation.depassement);
        rapport.avertissements.push(...contrePassation.avertissements);
        if (rapport.provisionsOuvertureNonDeclarees.length > 0) {
            throw new common_1.BadRequestException(`Provision pour pertes de change à l'ouverture non déclarée (${rapport.provisionsOuvertureNonDeclarees
                .map((n) => n.compteProvision)
                .join(', ')}) · déclarez-la (montant, source ; zéro si le solde porte un autre risque) avant de passer ` +
                "les écritures. La provision antérieure doit être connue pour être réajustée (fiche du compte 19).");
        }
        if (rapport.provisionsOuvertureExcessives.length > 0) {
            throw new common_1.BadRequestException(`La provision pour pertes de change déclarée à l'ouverture ne concorde pas avec l'ouverture (${rapport.provisionsOuvertureExcessives
                .map(libelleVersionHorsBornes)
                .join(' ; ')}) · mettez la déclaration à jour avant de passer les écritures.`);
        }
        if (rapport.reportsDisponibilitesNonEtablis.length > 0) {
            throw new common_1.BadRequestException(rapport.reportsDisponibilitesNonEtablis.join(' ; '));
        }
        const aAjuster = rapport.ajustementsProvision.some((a) => a.dotation > 0.005 || a.reprise > 0.005);
        if (rapport.positions.length === 0 && !aAjuster) {
            throw new common_1.BadRequestException("Aucune position en devise à réévaluer à cette date.");
        }
        if (rapport.coursManquants.length > 0) {
            throw new common_1.BadRequestException(`Aucun cours coté au ${rapport.dateReevaluation} ou avant pour : ${rapport.coursManquants.join(', ')}. ` +
                'Renseignez le cours de clôture avant de réévaluer.');
        }
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        if (exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("L'exercice est clôturé.");
        }
        const dejaFaite = await this.prisma.reevaluation.findFirst({
            where: { tenantId, exerciceId: dto.exerciceId, annuleeLe: null },
            select: { dateReevaluation: true },
        });
        if (dejaFaite) {
            throw new common_1.ConflictException(`Une réévaluation a déjà été passée au ${dejaFaite.dateReevaluation.toISOString().slice(0, 10)} sur cet exercice · ` +
                "une seconde repasserait l'écart entier, ses écarts étant passés sans devise, et doublerait la provision. " +
                "Pour une situation intermédiaire, utilisez le calcul sans enregistrement.");
        }
        const journal = await this.journalGeneral(tenantId);
        const compte = (racine) => this.compteParRacine(tenantId, racine);
        const referentiel = await this.referentielDuDossier(tenantId);
        const lignes = [];
        for (const p of rapport.positions) {
            const contrepartie = p.estTresorerie
                ?
                    p.ecart < 0
                        ? await compte(RACINE.perteRealisee)
                        : await compte(RACINE.gainRealise)
                :
                    await compte(racineEcartDeConversion(referentiel, p.numero, p.valeurComptable >= 0, p.ecart < 0));
            const abs = Math.abs(p.ecart);
            const libelle = `Réévaluation ${p.deviseCode} au ${rapport.dateReevaluation}`;
            if (p.ecart > 0) {
                lignes.push({ compteId: p.compteId, debit: abs, libelle });
                lignes.push({ compteId: contrepartie.id, credit: abs, libelle });
            }
            else {
                lignes.push({ compteId: contrepartie.id, debit: abs, libelle });
                lignes.push({ compteId: p.compteId, credit: abs, libelle });
            }
        }
        const ecritureEcarts = lignes.length > 0
            ? await this.ecritureService.creer(tenantId, createdBy, {
                exerciceId: dto.exerciceId,
                journalId: journal.id,
                date: rapport.dateReevaluation,
                libelle: `Réévaluation des créances et dettes en devises au ${rapport.dateReevaluation}`,
                reference: 'REEVAL',
                lignes,
            })
            : null;
        let ecritureProvision = null;
        const lignesProvision = [];
        for (const a of rapport.ajustementsProvision) {
            if (a.dotation <= 0.005 && a.reprise <= 0.005)
                continue;
            const nature = ` (${natureDeLaFamille(a.compteProvision)})`;
            const provision = await compte(a.compteProvision);
            if (a.dotation > 0.005) {
                const dotation = await compte(a.compteDotation);
                lignesProvision.push({ compteId: dotation.id, debit: a.dotation, libelle: `Dotation provision perte de change${nature}` });
                lignesProvision.push({ compteId: provision.id, credit: a.dotation, libelle: `Provision pour pertes de change${nature}` });
            }
            else {
                const reprise = await compte(a.compteReprise);
                lignesProvision.push({ compteId: provision.id, debit: a.reprise, libelle: `Provision pour pertes de change${nature}` });
                lignesProvision.push({ compteId: reprise.id, credit: a.reprise, libelle: `Reprise provision perte de change${nature}` });
            }
        }
        if (lignesProvision.length > 0) {
            try {
                ecritureProvision = await this.ecritureService.creer(tenantId, createdBy, {
                    exerciceId: dto.exerciceId,
                    journalId: journal.id,
                    date: rapport.dateReevaluation,
                    libelle: `Provision pour perte de change au ${rapport.dateReevaluation} · ajustement`,
                    reference: 'REEVAL',
                    lignes: lignesProvision,
                });
            }
            catch (e) {
                if (ecritureEcarts)
                    await this.ecritureService.retirerCompensation(tenantId, ecritureEcarts.id);
                throw e;
            }
        }
        let reevaluation;
        try {
            reevaluation = await this.prisma.reevaluation.create({
                data: {
                    tenantId,
                    exerciceId: dto.exerciceId,
                    dateReevaluation: new Date(rapport.dateReevaluation),
                    ecritureEcartsId: ecritureEcarts?.id,
                    ecritureProvisionId: ecritureProvision?.id,
                    coursUtilises: rapport.coursUtilises,
                    ecartsDisponibilites: rapport.positions
                        .filter((p) => p.estTresorerie)
                        .map((p) => ({ compteId: p.compteId, deviseId: p.deviseId, ecart: p.ecart })),
                    createdBy,
                },
            });
        }
        catch (e) {
            if (ecritureEcarts)
                await this.ecritureService.retirerCompensation(tenantId, ecritureEcarts.id);
            if (ecritureProvision)
                await this.ecritureService.retirerCompensation(tenantId, ecritureProvision.id);
            throw e;
        }
        return {
            rapport,
            reevaluationId: reevaluation.id,
            ecritures: [...(ecritureEcarts ? [ecritureEcarts.id] : []), ...(ecritureProvision ? [ecritureProvision.id] : [])],
        };
    }
    async extourner(tenantId, createdBy, reevaluationId, exerciceSuivantId, options = {}) {
        return this.sousVerrouDuDossier(tenantId, 'CONTRE_PASSATION', () => this.extournerSousVerrou(tenantId, createdBy, reevaluationId, exerciceSuivantId, options));
    }
    async extournerSousVerrou(tenantId, createdBy, reevaluationId, exerciceSuivantId, options) {
        const reeval = await this.prisma.reevaluation.findFirst({
            where: { id: reevaluationId, tenantId },
            include: {
                exercice: { select: { id: true, dateDebut: true, dateFin: true } },
                ecritureEcarts: { include: { lignes: { include: { compte: { select: { numero: true } } } } } },
            },
        });
        if (!reeval)
            throw new common_1.NotFoundException('Réévaluation introuvable pour ce dossier');
        if (reeval.annuleeLe)
            throw new common_1.ConflictException('Cette réévaluation est annulée · il n’y a rien à contre-passer.');
        if (reeval.ecritureExtourneId)
            throw new common_1.ConflictException('Cette réévaluation a déjà été extournée.');
        if (reeval.contrePassationDeclareeId) {
            throw new common_1.ConflictException('Cette réévaluation est déjà contre-passée par une écriture manuelle déclarée · la contre-passer par le module ' +
                "l'inverserait une seconde fois. Si l'écriture manuelle est erronée, retirez la déclaration (Devises, « Retirer la " +
                "déclaration »), CORRIGEZ l'écriture par inscription en négatif (AUDCIF art. 20, al. 2), puis contre-passez.");
        }
        if (!reeval.ecritureEcarts)
            throw new common_1.BadRequestException("Aucune écriture d'écarts à extourner.");
        const suivant = await this.prisma.exercice.findFirst({ where: { id: exerciceSuivantId, tenantId } });
        if (!suivant)
            throw new common_1.BadRequestException('Exercice suivant introuvable pour ce dossier');
        if (suivant.dateDebut.getTime() <= reeval.dateReevaluation.getTime()) {
            throw new common_1.BadRequestException("La contre-passation se passe à l'ouverture d'un exercice qui commence après la réévaluation · choisissez l'exercice suivant.");
        }
        const fin = reeval.exercice?.dateFin ?? reeval.dateReevaluation;
        const cible = await this.cibleDeContrePassation(tenantId, fin);
        if (!cible) {
            throw new common_1.BadRequestException("Aucun exercice ouvert après celui de la réévaluation · ouvrez l'exercice suivant (Fin d'exercice…), puis contre-passez.");
        }
        if (cible.id !== suivant.id) {
            const jour = (d) => d.toISOString().slice(0, 10);
            throw new common_1.BadRequestException(`La contre-passation se passe à l'ouverture du premier exercice ouvert qui suit la réévaluation, celui du ` +
                `${jour(cible.dateDebut)} au ${jour(cible.dateFin)} · passée ailleurs, l'écart de conversion vivrait pendant un ` +
                'exercice ouvert, que sa réévaluation repasserait depuis le coût historique.');
        }
        const lignes = reeval.ecritureEcarts.lignes.map((l) => ({
            ...l,
            compteNumero: l.compte.numero,
            debit: Number(l.debit),
            credit: Number(l.credit),
        }));
        const partage = (0, ecarts_disponibilites_1.partagerLignesDEcarts)(lignes);
        const integrale = await this.motifContrePassationIntegrale(tenantId, suivant.id, partage, options.integrale === true);
        if (integrale.refus)
            throw new common_1.BadRequestException(integrale.refus);
        const aContrePasser = integrale.code ? lignes : partage.aContrePasser;
        if (aContrePasser.length === 0) {
            throw new common_1.BadRequestException("Cette réévaluation ne porte que des disponibilités · leur écart est réalisé et reste au résultat de l'exercice " +
                '(AUDCIF art. 57) · il n’y a aucun écart de conversion à contre-passer.');
        }
        let avertissementEtat = null;
        let avertissementPosterieures = null;
        let avertissementOuverture = null;
        {
            const attendus = (0, contre_passation_manuelle_1.montantsAContrePasser)(partage.aContrePasser.map((l) => ({ compteId: l.compteId, compteNumero: l.compteNumero, debit: l.debit, credit: l.credit })));
            const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
            const etat = await this.etatDeLEcart(tenantId, {
                id: reeval.id,
                dateReevaluation: reeval.dateReevaluation,
                exercice: { id: reeval.exerciceId, dateDebut: reeval.exercice?.dateDebut ?? fin, dateFin: fin },
            }, attendus);
            const refusEtat = this.motifEtatDeLEcart(etat, attendus, reeval.dateReevaluation.toISOString().slice(0, 10), await this.referentielDuDossier(tenantId));
            const deuxieme = etat.jugement?.verdict === 'CONTRE_PASSEE' || etat.jugement?.verdict === 'AMBIGU';
            if (refusEtat && (!reeval.etatAtteste || deuxieme))
                throw new common_1.BadRequestException(refusEtat);
            if (refusEtat)
                avertissementEtat = avertissementEtatAtteste(reeval, refusEtat);
            if (!etat.ouvertureFiableCible) {
                avertissementOuverture =
                    "L'ouverture de cet exercice n'est pas encore l'à-nouveau de clôture de l'exercice précédent · la contre-passation est " +
                        "passée sur sa clôture reconstituée. Jusqu'à cette clôture (ou au bilan d'ouverture), la balance de cet exercice peut " +
                        'montrer la contre-passation sans l’écart de conversion qu’elle inverse ; elle s’équilibre quand l’à-nouveau de clôture ' +
                        'porte cet écart.';
            }
            if (etat.posterieures.length > 0) {
                const dates = etat.posterieures.map((r) => `du ${r.dateReevaluation.toISOString().slice(0, 10)}`).join(', ');
                avertissementPosterieures =
                    `La réévaluation ${dates}, passée dans cet exercice avant cette contre-passation, a mesuré les créances et dettes ` +
                        "depuis leur coût historique · son écart reste juste et en place ; la contre-passation, datée de l'ouverture, ne retire " +
                        'que celui du ' +
                        `${reeval.dateReevaluation.toISOString().slice(0, 10)} (Guide, Partie 2 ch. 22, Applications 84 et 85). Rien n'est à annuler.`;
            }
        }
        const jourReeval = reeval.dateReevaluation.toISOString().slice(0, 10);
        const journal = await this.journalGeneral(tenantId);
        const ecriture = await this.ecritureService.creer(tenantId, createdBy, {
            exerciceId: suivant.id,
            journalId: journal.id,
            date: suivant.dateDebut.toISOString().slice(0, 10),
            reporterAuPremierJourOuvert: true,
            libelle: integrale.code
                ? `Contre-passation intégrale des écarts du ${jourReeval}, banque et caisse comprises (${ecarts_disponibilites_1.LIBELLE_INTEGRALE[integrale.code]})`
                : `Contre-passation des écarts de conversion du ${jourReeval}`,
            reference: 'REEVAL',
            lignes: aContrePasser.map((l) => ({
                compteId: l.compteId,
                debit: l.credit || undefined,
                credit: l.debit || undefined,
                libelle: l.libelle ?? undefined,
            })),
        });
        try {
            await this.prisma.reevaluation.update({
                where: { id: reevaluationId, tenantId, AND: [{ ecritureExtourneId: null }, { contrePassationDeclareeId: null }] },
                data: { ecritureExtourneId: ecriture.id, contrePassationIntegrale: integrale.code },
            });
        }
        catch (e) {
            await this.ecritureService.retirerCompensation(tenantId, ecriture.id);
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
                throw new common_1.ConflictException('Cette réévaluation a déjà été extournée.');
            }
            throw e;
        }
        const enregistree = await this.prisma.reevaluation.findFirstOrThrow({ where: { id: reevaluationId, tenantId } });
        return {
            ...enregistree,
            avertissement: [integrale.code ? ecarts_disponibilites_1.AVERTISSEMENT_INTEGRALE[integrale.code] : null, avertissementEtat, avertissementPosterieures, avertissementOuverture]
                .filter((a) => a !== null)
                .join(' ') || null,
        };
    }
    async motifContrePassationIntegrale(tenantId, exerciceSuivantId, partage, demandee) {
        if (partage.realisees.length > 0) {
            const ancienRegime = await this.prisma.reevaluation.findFirst({
                where: { tenantId, exerciceId: exerciceSuivantId, annuleeLe: null, ecartsDisponibilites: { equals: client_1.Prisma.DbNull } },
                select: { id: true },
            });
            if (ancienRegime)
                return { code: 'EXERCICE_SUIVANT_ANCIEN_REGIME', refus: null };
        }
        if (partage.motifRefus) {
            return demandee ? { code: 'PARTAGE_IMPOSSIBLE', refus: null } : { code: null, refus: partage.motifRefus };
        }
        if (demandee) {
            return {
                code: null,
                refus: "La contre-passation intégrale n'est ouverte qu'à une écriture des écarts qui ne se partage pas · celle-ci se partage, " +
                    "et seuls le 478, le 479 et les comptes de tiers se contre-passent (l'écart de la banque et de la caisse est réalisé, " +
                    'AUDCIF art. 57).',
            };
        }
        return { code: null, refus: null };
    }
    async annulerContrePassation(tenantId, userId, reevaluationId, motif) {
        const raison = (motif ?? '').trim();
        if (!raison)
            throw new common_1.BadRequestException("Le motif de l'annulation est obligatoire (AUDCIF art. 20).");
        return this.sousVerrouDuDossier(tenantId, 'ANNULATION DE CONTRE-PASSATION', () => this.annulerContrePassationSousVerrou(tenantId, userId, reevaluationId, raison));
    }
    async annulerContrePassationSousVerrou(tenantId, userId, reevaluationId, motif) {
        const reeval = await this.prisma.reevaluation.findFirst({
            where: { id: reevaluationId, tenantId },
            select: {
                id: true,
                dateReevaluation: true,
                annuleeLe: true,
                annulationsContrePassation: true,
                contrePassationDeclareeId: true,
                contrePassationDeclaree: { select: { numeroPiece: true } },
                ecritureExtourne: {
                    select: {
                        id: true,
                        statut: true,
                        numeroPiece: true,
                        exerciceId: true,
                        exercice: { select: { statut: true } },
                        lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } },
                    },
                },
            },
        });
        if (!reeval)
            throw new common_1.NotFoundException('Réévaluation introuvable pour ce dossier');
        const jour = (d) => d.toISOString().slice(0, 10);
        if (reeval.annuleeLe)
            throw new common_1.ConflictException(`Cette réévaluation est annulée, le ${jour(reeval.annuleeLe)}.`);
        const e = reeval.ecritureExtourne;
        if (!e && reeval.contrePassationDeclareeId) {
            throw new common_1.BadRequestException(`Cette réévaluation est contre-passée par une écriture manuelle déclarée (pièce n° ${reeval.contrePassationDeclaree?.numeroPiece ?? '·'}) · ` +
                "ce geste n'annule que la contre-passation du module. Retirez la déclaration (Devises, « Retirer la déclaration »), " +
                "puis corrigez l'écriture manuelle par inscription en négatif (AUDCIF art. 20, al. 2).");
        }
        if (!e)
            throw new common_1.BadRequestException("Cette réévaluation n'est pas contre-passée · il n'y a rien à annuler.");
        if (e.exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("La contre-passation est passée dans un exercice clôturé · elle ne s'annule plus (AUDCIF art. 20, al. 3).");
        }
        const lectrice = await this.prisma.reevaluation.findFirst({
            where: { tenantId, exerciceId: e.exerciceId, annuleeLe: null },
            select: { dateReevaluation: true },
        });
        if (lectrice) {
            throw new common_1.BadRequestException(`La réévaluation du ${jour(lectrice.dateReevaluation)}, passée dans l'exercice qui porte cette contre-passation, a ` +
                "mesuré ses positions après elle · annulez-la d'abord (Devises), puis la contre-passation.");
        }
        const nom = `la contre-passation n° ${e.numeroPiece ?? '·'}`;
        const tenues = (0, lignes_tenues_1.motifLignesTenues)(e.lignes, nom, 'annuler');
        if (tenues)
            throw new common_1.BadRequestException(tenues);
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const relues = await tx.ligneEcriture.findMany({
                where: { ecritureId: e.id, ecriture: { tenantId } },
                select: { lettre: true, lettrageId: true, rapprochementId: true },
            });
            const motifTenues = (0, lignes_tenues_1.motifLignesTenues)(relues, nom, 'annuler');
            if (motifTenues)
                throw new common_1.BadRequestException(motifTenues);
            const statut = (await tx.ecriture.findFirst({ where: { id: e.id, tenantId }, select: { statut: true } }))?.statut;
            const negatif = statut === client_1.StatutEcriture.BROUILLARD
                ? null
                : await this.ecritureService.inscrireEnNegatifPourAnnulation(tenantId, userId, e.id, motif, tx);
            const trace = {
                ecritureId: e.id,
                numeroPiece: e.numeroPiece,
                traitement: negatif ? 'INSCRITE_EN_NEGATIF' : 'SUPPRIMEE',
                ...(negatif ? { negatifId: negatif.id, negatifNumeroPiece: negatif.numeroPiece } : {}),
                motif,
                par: userId,
                le: new Date().toISOString(),
            };
            const anciennes = Array.isArray(reeval.annulationsContrePassation) ? reeval.annulationsContrePassation : [];
            try {
                await tx.reevaluation.update({
                    where: { id: reeval.id, tenantId, ecritureExtourneId: e.id },
                    data: {
                        ecritureExtourneId: null,
                        contrePassationIntegrale: null,
                        annulationsContrePassation: [...anciennes, trace],
                    },
                });
            }
            catch (err) {
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                    throw new common_1.ConflictException('La contre-passation de cette réévaluation a changé entre-temps · relancez le geste.');
                }
                throw err;
            }
            if (!negatif) {
                await tx.ligneEcriture.deleteMany({ where: { ecritureId: e.id, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } } });
                const { count } = await tx.ecriture.deleteMany({ where: { id: e.id, tenantId, statut: client_1.StatutEcriture.BROUILLARD } });
                if (count !== 1)
                    throw new common_1.ConflictException('La contre-passation a été validée entre-temps · relancez le geste.');
            }
            return tx.reevaluation.findFirstOrThrow({ where: { id: reeval.id, tenantId } });
        });
    }
    async declarerContrePassationManuelle(tenantId, userId, reevaluationId, ecritureId, motif) {
        const raison = (motif ?? '').trim();
        if (raison.length < 3) {
            throw new common_1.BadRequestException("Le motif de la déclaration est obligatoire · dites quelle écriture a contre-passé l'écart, et pourquoi à la main.");
        }
        return this.sousVerrouDuDossier(tenantId, 'DÉCLARATION DE CONTRE-PASSATION', () => this.declarerContrePassationSousVerrou(tenantId, userId, reevaluationId, ecritureId, raison));
    }
    async reevaluationADeclarer(tenantId, reevaluationId) {
        const reeval = await this.prisma.reevaluation.findFirst({
            where: { id: reevaluationId, tenantId },
            select: {
                id: true,
                dateReevaluation: true,
                annuleeLe: true,
                ecritureExtourneId: true,
                ecritureExtourne: { select: { numeroPiece: true } },
                contrePassationDeclareeId: true,
                contrePassationDeclaree: { select: { numeroPiece: true } },
                etatAtteste: true,
                motifAttestation: true,
                etatAttesteLe: true,
                exercice: { select: { id: true, dateDebut: true, dateFin: true } },
                ecritureEcarts: {
                    select: { lignes: { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } } },
                },
            },
        });
        if (!reeval)
            throw new common_1.NotFoundException('Réévaluation introuvable pour ce dossier');
        const jour = (d) => d.toISOString().slice(0, 10);
        if (reeval.annuleeLe)
            throw new common_1.ConflictException(`Cette réévaluation est annulée, le ${jour(reeval.annuleeLe)} · il n'y a rien à contre-passer.`);
        if (reeval.ecritureExtourneId) {
            throw new common_1.ConflictException(`Cette réévaluation est déjà contre-passée par le module (pièce n° ${reeval.ecritureExtourne?.numeroPiece ?? '·'}) · ` +
                'une seconde contre-passation inverserait l’écart une seconde fois.');
        }
        if (reeval.contrePassationDeclareeId) {
            throw new common_1.ConflictException(`Une contre-passation manuelle est déjà déclarée pour cette réévaluation (pièce n° ${reeval.contrePassationDeclaree?.numeroPiece ?? '·'}) · ` +
                'retirez-la avant d’en déclarer une autre.');
        }
        const lignes = (reeval.ecritureEcarts?.lignes ?? []).map((l) => ({
            compteId: l.compteId,
            compteNumero: l.compte.numero,
            debit: Number(l.debit),
            credit: Number(l.credit),
        }));
        const partage = (0, ecarts_disponibilites_1.partagerLignesDEcarts)(lignes);
        const attendus = (0, contre_passation_manuelle_1.montantsAContrePasser)(partage.aContrePasser);
        if (attendus.length === 0) {
            throw new common_1.BadRequestException("Cette réévaluation n'a aucun écart de conversion · celui des disponibilités est réalisé et reste au résultat de l'exercice " +
                '(AUDCIF art. 57) · il n’y a rien à contre-passer, ni à déclarer.');
        }
        return { reeval, attendus, jour };
    }
    async declarerContrePassationSousVerrou(tenantId, userId, reevaluationId, ecritureId, motif) {
        const { reeval, attendus, jour } = await this.reevaluationADeclarer(tenantId, reevaluationId);
        const ecriture = await this.prisma.ecriture.findFirst({
            where: { id: ecritureId, tenantId },
            select: {
                id: true,
                numeroPiece: true,
                date: true,
                statut: true,
                estGenereeParCloture: true,
                estANouveauProvisoire: true,
                estSoldeDesComptesDeGestion: true,
                exercice: { select: { id: true, dateDebut: true, dateFin: true } },
                correction: { select: { numeroPiece: true } },
                corrigeEcritureId: true,
                corrigeEcriture: { select: { numeroPiece: true } },
                reevaluationEcarts: { select: { id: true } },
                reevaluationProvision: { select: { id: true } },
                reevaluationExtourne: { select: { id: true } },
                reevaluationContrePassationDeclaree: { select: { id: true } },
                lignes: { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } },
            },
        });
        if (!ecriture)
            throw new common_1.NotFoundException('Écriture introuvable pour ce dossier');
        const piece = `la pièce n° ${ecriture.numeroPiece ?? '·'} du ${jour(ecriture.date)}`;
        if (ecriture.statut === client_1.StatutEcriture.SITUATION) {
            throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifSimulationNonRattachable)(piece, "la contre-passation d'une réévaluation"));
        }
        const Piece = piece.charAt(0).toUpperCase() + piece.slice(1);
        if (ecriture.estGenereeParCloture || ecriture.estANouveauProvisoire || ecriture.estSoldeDesComptesDeGestion) {
            throw new common_1.BadRequestException(`${Piece} est engendrée par la clôture ou l'à-nouveau · elle reporte des soldes, elle ne contre-passe rien. Désignez l'écriture qui a contre-passé l'écart.`);
        }
        if (ecriture.correction) {
            throw new common_1.BadRequestException(`${Piece} est neutralisée par son inscription en négatif (pièce n° ${ecriture.correction.numeroPiece ?? '·'}) · elle ne contre-passe plus rien.`);
        }
        if (ecriture.corrigeEcritureId) {
            throw new common_1.BadRequestException(`${Piece} est une inscription en négatif (correction de la pièce n° ${ecriture.corrigeEcriture?.numeroPiece ?? '·'}) · ` +
                "elle annule une écriture, elle ne contre-passe pas un écart. Désignez l'écriture qui contre-passe l'écart, ou contre-passez par le module.");
        }
        if (ecriture.reevaluationContrePassationDeclaree) {
            throw new common_1.ConflictException(`${Piece} est déjà déclarée comme la contre-passation d'une autre réévaluation.`);
        }
        if (ecriture.reevaluationEcarts || ecriture.reevaluationProvision || ecriture.reevaluationExtourne) {
            throw new common_1.ConflictException(`${Piece} est une écriture d'une réévaluation (écarts, provision ou contre-passation du module) · elle n'est pas une contre-passation faite à la main.`);
        }
        const dansSonExercice = ecriture.exercice.id === reeval.exercice.id && ecriture.date.getTime() >= reeval.dateReevaluation.getTime();
        if (!dansSonExercice && !(await this.contrePassationASaPlace(tenantId, reeval.exercice, ecriture.exercice, null))) {
            const cible = await this.cibleDeContrePassation(tenantId, reeval.exercice.dateFin);
            throw new common_1.BadRequestException(`${Piece} n'est pas à la place de la contre-passation de la réévaluation du ${jour(reeval.dateReevaluation)} · elle se passe à ` +
                "l'ouverture du premier exercice ouvert qui suit la réévaluation" +
                (cible ? `, celui du ${jour(cible.dateDebut)} au ${jour(cible.dateFin)},` : '') +
                ' ou dans un exercice clôturé entre les deux. Ailleurs, l’écart de conversion aurait vécu pendant un exercice ouvert, que sa ' +
                'réévaluation repasserait depuis le coût historique.');
        }
        const refus = (0, contre_passation_manuelle_1.motifRefusInversion)(attendus, ecriture.lignes.map((l) => ({ compteId: l.compteId, compteNumero: l.compte.numero, debit: Number(l.debit), credit: Number(l.credit) })));
        if (refus)
            throw new common_1.BadRequestException(refus);
        let avertissement = null;
        {
            const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
            const etat = await this.etatDeLEcart(tenantId, reeval, attendus);
            const verdict = etat.jugement?.verdict;
            if (verdict !== 'CONTRE_PASSEE' && verdict !== 'AMBIGU') {
                const motifEtat = this.motifEtatDeLEcart(etat, attendus, jour(reeval.dateReevaluation), await this.referentielDuDossier(tenantId));
                const refusEtat = `${Piece} ne se déclare pas · ` +
                    (motifEtat
                        ? `${motifEtat.charAt(0).toLowerCase()}${motifEtat.slice(1)}`
                        : `l'écart de conversion de la réévaluation du ${jour(reeval.dateReevaluation)} est en place dans les comptes, une autre ` +
                            'écriture hors module compensant celle-ci · contre-passez par le module (Devises, « Contre-passer »).');
                if (!reeval.etatAtteste)
                    throw new common_1.BadRequestException(refusEtat);
                avertissement = avertissementEtatAtteste(reeval, refusEtat);
            }
        }
        try {
            await this.prisma.reevaluation.update({
                where: { id: reeval.id, tenantId, annuleeLe: null, AND: [{ ecritureExtourneId: null }, { contrePassationDeclareeId: null }] },
                data: {
                    contrePassationDeclareeId: ecriture.id,
                    motifContrePassationDeclaree: motif,
                    contrePassationDeclareeLe: new Date(),
                    contrePassationDeclareePar: userId,
                },
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
                throw new common_1.ConflictException('La contre-passation de cette réévaluation a changé entre-temps · relancez le geste.');
            }
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException(`${Piece} vient d'être déclarée comme la contre-passation d'une autre réévaluation.`);
            }
            throw e;
        }
        return { ...(await this.prisma.reevaluation.findFirstOrThrow({ where: { id: reeval.id, tenantId } })), avertissement };
    }
    async etatDeLEcart(tenantId, x, attendusX) {
        const PLAFOND_ECRITURES = 200;
        const centimesDe = (l) => Math.round(Number(l.debit) * 100) - Math.round(Number(l.credit) * 100);
        const comptes47 = attendusX.filter((a) => a.compteNumero.startsWith('47'));
        const comptesTiers = attendusX.filter((a) => !a.compteNumero.startsWith('47'));
        const ids47 = comptes47.map((a) => a.compteId);
        const idsTiers = comptesTiers.map((a) => a.compteId);
        const idsEcart = [...ids47, ...idsTiers];
        const ecartX = new Map(attendusX.map((a) => [a.compteId, a.netCentimes]));
        const suivants = await this.prisma.exercice.findMany({
            where: { tenantId, dateDebut: { gt: x.exercice.dateFin } },
            orderBy: { dateDebut: 'asc' },
            take: contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES,
            select: { id: true, statut: true, dateDebut: true, dateFin: true },
        });
        const premierOuvert = suivants.findIndex((e) => e.statut === client_1.StatutExercice.OUVERT);
        const fenetre = premierOuvert < 0 ? [] : suivants.slice(0, premierOuvert + 1);
        const cible = fenetre.length > 0 ? fenetre[fenetre.length - 1] : null;
        const etat = {
            cible,
            comptes47,
            comptesTiers,
            ouverture: null,
            ecartTiers: new Map(),
            ecritures: [],
            autresEcarts: [],
            jugement: null,
            posterieures: [],
            ouvertureFiableCible: false,
            tronque: false,
        };
        if (!cible)
            return etat;
        const jusquaLaCible = await this.prisma.exercice.findMany({
            where: { tenantId, dateDebut: { lte: cible.dateDebut } },
            orderBy: { dateDebut: 'desc' },
            take: contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES,
            select: { id: true, dateDebut: true, dateFin: true },
        });
        const avecOuverture = new Set((await this.prisma.ecriture.findMany({
            where: {
                tenantId,
                exerciceId: { in: jusquaLaCible.map((e) => e.id) },
                estGenereeParCloture: true,
                estANouveauProvisoire: false,
                estSoldeDesComptesDeGestion: false,
            },
            distinct: ['exerciceId'],
            select: { exerciceId: true },
        })).map((e) => e.exerciceId));
        etat.ouvertureFiableCible = avecOuverture.has(cible.id);
        const lecture = await this.lireLaFenetreDeLEcart(tenantId, x, fenetre, jusquaLaCible, avecOuverture, idsEcart);
        etat.tronque = etat.tronque || lecture.tronque;
        const lu47 = new Map(ids47.map((c) => [c, lecture.solde.get(c) ?? 0]));
        if (lecture.ouvertures.length > 0) {
            etat.ouverture = { exercice: lecture.ouvertures[lecture.ouvertures.length - 1], exercices: lecture.ouvertures, ecart: lecture.ecartOuverture };
        }
        const reevaluations = await this.prisma.reevaluation.findMany({
            where: { tenantId, annuleeLe: null, exercice: { dateDebut: { lte: cible.dateDebut } } },
            orderBy: [{ dateReevaluation: 'desc' }, { id: 'asc' }],
            take: contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES + 1,
            select: {
                id: true,
                dateReevaluation: true,
                exerciceId: true,
                ecritureExtourne: { select: { exercice: { select: { dateDebut: true } } } },
                contrePassationDeclaree: { select: { exercice: { select: { dateDebut: true } } } },
                ecritureEcarts: { select: { lignes: { where: { compteId: { in: idsEcart } }, select: { compteId: true, debit: true, credit: true } } } },
            },
        });
        etat.tronque = etat.tronque || reevaluations.length > contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES;
        const renversee = (y) => y !== null && y.exercice.dateDebut.getTime() <= cible.dateDebut.getTime();
        const enPlace = reevaluations
            .slice(0, contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES)
            .filter((r) => !renversee(r.ecritureExtourne) && !renversee(r.contrePassationDeclaree))
            .map((r) => {
            const ecart = new Map();
            for (const l of r.ecritureEcarts?.lignes ?? [])
                ecart.set(l.compteId, (ecart.get(l.compteId) ?? 0) + centimesDe(l));
            return { id: r.id, ecart };
        });
        etat.posterieures = reevaluations
            .slice(0, contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES)
            .filter((r) => r.id !== x.id && r.exerciceId === cible.id && ids47.length > 0 && (r.ecritureEcarts?.lignes ?? []).some((l) => ids47.includes(l.compteId)))
            .map((r) => ({ id: r.id, dateReevaluation: r.dateReevaluation }));
        const horsModule = {
            estGenereeParCloture: false,
            ...ecritures_de_situation_1.HORS_SITUATION,
            estANouveauProvisoire: false,
            estSoldeDesComptesDeGestion: false,
            corrigeEcritureId: null,
            correction: { is: null },
            reevaluationEcarts: { is: null },
            reevaluationProvision: { is: null },
            reevaluationExtourne: { is: null },
            reevaluationContrePassationDeclaree: { is: null },
            lignes: { some: { compteId: { in: ids47 } } },
            ...dansLaFenetre(x, fenetre),
        };
        const liste = ids47.length === 0
            ? []
            : await this.prisma.ecriture.findMany({
                where: { tenantId, ...horsModule },
                orderBy: [{ date: 'asc' }, { id: 'asc' }],
                take: PLAFOND_ECRITURES + 1,
                select: {
                    id: true,
                    numeroPiece: true,
                    date: true,
                    exerciceId: true,
                    lignes: { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } },
                },
            });
        const tronqueListe = liste.length > PLAFOND_ECRITURES;
        etat.tronque = etat.tronque || tronqueListe;
        const promus = [];
        for (const e of tronqueListe ? [] : liste) {
            const effet = new Map();
            for (const l of e.lignes)
                if (idsEcart.includes(l.compteId))
                    effet.set(l.compteId, (effet.get(l.compteId) ?? 0) + centimesDe(l));
            const exacte = (0, contre_passation_manuelle_1.motifRefusInversion)(attendusX, e.lignes.map((l) => ({ compteId: l.compteId, compteNumero: l.compte.numero, debit: Number(l.debit), credit: Number(l.credit) }))) === null;
            const dansLaCible = e.exerciceId === cible.id;
            const dansLeSens = ids47.some((c) => (effet.get(c) ?? 0) !== 0) &&
                ids47.every((c) => (effet.get(c) ?? 0) === 0 || Math.sign(effet.get(c) ?? 0) === Math.sign(ecartX.get(c) ?? 0));
            if (!dansLaCible && dansLeSens && !exacte) {
                promus.push({ id: `hors-module:${e.id}`, ecart: effet });
                etat.autresEcarts.push({ numeroPiece: e.numeroPiece, date: e.date });
                continue;
            }
            etat.ecritures.push({
                id: e.id,
                numeroPiece: e.numeroPiece,
                date: e.date,
                dansLaCible,
                exacte,
                horsDeLEcart: e.lignes.some((l) => !idsEcart.includes(l.compteId)),
                dansLeSens,
                effet,
            });
        }
        for (const c of idsTiers)
            etat.ecartTiers.set(c, lecture.ecartOuverture.get(c) ?? 0);
        if (tronqueListe) {
            const groupes = await this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { compteId: { in: idsTiers }, ecriture: { tenantId, ...horsModule } },
                _sum: { debit: true, credit: true },
            });
            for (const g of groupes) {
                etat.ecartTiers.set(g.compteId, (etat.ecartTiers.get(g.compteId) ?? 0) + centimesDe({ debit: g._sum.debit ?? 0, credit: g._sum.credit ?? 0 }));
            }
        }
        else {
            for (const e of etat.ecritures)
                for (const c of idsTiers)
                    etat.ecartTiers.set(c, (etat.ecartTiers.get(c) ?? 0) + (e.effet.get(c) ?? 0));
        }
        const utilesModule = enPlace.filter((r) => idsEcart.some((c) => (r.ecart.get(c) ?? 0) !== 0)).length;
        if (utilesModule + promus.length > contre_passation_manuelle_1.PLAFOND_SOUS_ENSEMBLES && promus.length > 1) {
            const ensemble = new Map();
            for (const p of promus)
                for (const [c, v] of p.ecart)
                    ensemble.set(c, (ensemble.get(c) ?? 0) + v);
            promus.splice(0, promus.length, { id: 'hors-module', ecart: ensemble });
        }
        const ouvertureOmetLEcart = etat.ouverture !== null && idsEcart.every((c) => (etat.ouverture.ecart.get(c) ?? 0) === -(ecartX.get(c) ?? 0));
        const entree = {
            comptes47: ids47,
            comptesTiers: idsTiers,
            lu47,
            ecartTiers: etat.ecartTiers,
            enPlace: [...enPlace, ...promus],
            reevaluationId: x.id,
            ecartX,
            retablissable: ouvertureOmetLEcart,
            ecritures: tronqueListe ? null : etat.ecritures,
        };
        etat.jugement = (0, contre_passation_manuelle_1.jugerLEtat)(entree);
        return etat;
    }
    async lireLaFenetreDeLEcart(tenantId, x, fenetre, jusquaLaCible, avecOuverture, comptes) {
        const centimesDe = (l) => Math.round(Number(l.debit) * 100) - Math.round(Number(l.credit) * 100);
        const resultat = {
            solde: new Map(),
            ecartOuverture: new Map(comptes.map((c) => [c, 0])),
            ouvertures: [],
            tronque: false,
        };
        if (comptes.length === 0)
            return resultat;
        const sommes = async (ecriture) => {
            const s = new Map();
            const groupes = await this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { compteId: { in: comptes }, ecriture: { tenantId, estANouveauProvisoire: false, ...ecritures_de_situation_1.HORS_SITUATION, ...ecriture } },
                _sum: { debit: true, credit: true },
            });
            for (const g of groupes)
                s.set(g.compteId, (s.get(g.compteId) ?? 0) + centimesDe({ debit: g._sum.debit ?? 0, credit: g._sum.credit ?? 0 }));
            return s;
        };
        const ouvertureSeule = { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false };
        const horsOuverture = { NOT: ouvertureSeule };
        const indexX = jusquaLaCible.findIndex((e) => e.id === x.exercice.id);
        const avant = [];
        if (indexX < 0) {
            resultat.tronque = true;
        }
        else if (!avecOuverture.has(x.exercice.id)) {
            for (let i = indexX + 1; i < jusquaLaCible.length; i++) {
                avant.push(jusquaLaCible[i].id);
                if (avecOuverture.has(jusquaLaCible[i].id))
                    break;
            }
            if (!avant.some((id) => avecOuverture.has(id)) && jusquaLaCible.length >= contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES)
                resultat.tronque = true;
        }
        const base = await sommes({
            OR: [{ exerciceId: x.exercice.id, date: { lt: x.dateReevaluation } }, ...(avant.length > 0 ? [{ exerciceId: { in: avant } }] : [])],
        });
        const solde = new Map(comptes.map((c) => [c, base.get(c) ?? 0]));
        const ajouter = (m) => {
            for (const c of comptes)
                solde.set(c, (solde.get(c) ?? 0) + (m.get(c) ?? 0));
        };
        ajouter(await sommes({ exerciceId: x.exercice.id, date: { gte: x.dateReevaluation }, ...horsOuverture }));
        for (const exo of fenetre) {
            if (avecOuverture.has(exo.id)) {
                const ouverture = await sommes({ exerciceId: exo.id, ...ouvertureSeule });
                let ecarte = false;
                for (const c of comptes) {
                    const d = (ouverture.get(c) ?? 0) - (solde.get(c) ?? 0);
                    if (d !== 0)
                        ecarte = true;
                    resultat.ecartOuverture.set(c, (resultat.ecartOuverture.get(c) ?? 0) + d);
                    solde.set(c, ouverture.get(c) ?? 0);
                }
                if (ecarte)
                    resultat.ouvertures.push(exo);
            }
            ajouter(await sommes({ exerciceId: exo.id, ...horsOuverture }));
        }
        resultat.solde = solde;
        return resultat;
    }
    motifEtatDeLEcart(etat, attendusX, jourReevaluation, referentiel) {
        if (!etat.cible || !etat.jugement) {
            return "Aucun exercice ouvert après celui de la réévaluation · ouvrez l'exercice suivant (Fin d'exercice…), puis contre-passez.";
        }
        const j = etat.jugement;
        const issue = j.issue;
        if (issue && issue.gestes.length === 0 && issue.fin === 'CONTRE_PASSER')
            return null;
        const jour = (d) => d.toISOString().slice(0, 10);
        const montant = (c) => `${(Math.abs(c) / 100).toFixed(2)}${c > 0 ? ' débiteur' : c < 0 ? ' créditeur' : ''}`;
        const pieces = (liste) => liste
            .slice(0, 5)
            .map((e) => `la pièce n° ${e.numeroPiece ?? '·'} du ${jour(e.date)}`)
            .join(', ') + (liste.length > 5 ? ` et ${liste.length - 5} autre(s)` : '');
        const periode = (e) => `l'exercice du ${jour(e.dateDebut)} au ${jour(e.dateFin)}`;
        const tete = `L'écart de conversion de la réévaluation du ${jourReevaluation}`;
        const correspondance = referentiel === client_1.Referentiel.SYCEBNL ? 'SYCEBNL art. 16, 4)' : 'AUDCIF art. 34';
        const chiffres = [
            ...etat.comptes47.map((a) => `${a.compteNumero} · attendu ${montant(j.attendu.get(a.compteId) ?? 0)} (écarts en place), solde ${montant(j.lu.get(a.compteId) ?? 0)}`),
            ...etat.comptesTiers
                .filter((a) => (etat.ecartTiers.get(a.compteId) ?? 0) !== 0)
                .map((a) => `${a.compteNumero} · ouverture et écritures hors module sur l'écart ${montant(etat.ecartTiers.get(a.compteId) ?? 0)}`),
        ].join(' ; ');
        const borne = etat.tronque ? ' Lecture bornée · une part des écritures ou des réévaluations n’a pas été relue.' : '';
        if (issue && issue.gestes.length === 0 && issue.fin === 'DECLARER') {
            return (`${tete} est déjà contre-passé à la main · ${pieces([issue.ecriture])} l'inverse exactement (${chiffres}). Déclarez cette ` +
                'écriture (Devises, « Déclarer une contre-passation manuelle ») · la contre-passer par le module l’inverserait une seconde fois.' +
                (j.verdict === 'AMBIGU'
                    ? ' Un autre écart en place porte les mêmes comptes et les mêmes montants · elle contre-passe indifféremment l’un ou l’autre.'
                    : '') +
                borne);
        }
        const etatDit = j.verdict === 'CONTRE_PASSEE'
            ? "il n'est plus en place"
            : j.verdict === 'EN_PLACE'
                ? 'il est en place'
                : j.trop
                    ? 'plus de douze écarts touchent ces comptes, la lecture n’est pas tranchée'
                    : j.verdict === 'AMBIGU'
                        ? 'deux lectures sont possibles'
                        : 'les comptes ne se lisent ni comme l’écart en place, ni comme l’écart contre-passé';
        const ouverture = etat.ouverture
            ? `l'ouverture de ${etat.ouverture.exercices.map(periode).join(' et de ')} ne correspond pas à la clôture de l'exercice précédent (${correspondance} · ${[
                ...etat.comptes47,
                ...etat.comptesTiers,
            ]
                .filter((a) => (etat.ouverture.ecart.get(a.compteId) ?? 0) !== 0)
                .map((a) => `${a.compteNumero} ${montant(etat.ouverture.ecart.get(a.compteId) ?? 0)}`)
                .join(', ')})`
            : null;
        if (issue) {
            const etapes = [];
            for (const g of issue.gestes) {
                if (g.type === 'RETABLIR') {
                    etapes.push(`rétablissez l'écart, que l'ouverture${etat.ouverture ? ` de ${etat.ouverture.exercices.map(periode).join(' et de ')}` : ''} omet (${correspondance}), ` +
                        (etat.ouverture && etat.ouverture.exercice.id !== etat.cible.id
                            ? `par une OD à l'ouverture de ${periode(etat.cible)} (${(0, contre_passation_manuelle_1.libelleMontantsDeLEcart)(attendusX)})`
                            : `par une OD à cette ouverture (${(0, contre_passation_manuelle_1.libelleMontantsDeLEcart)(attendusX)})`));
                    continue;
                }
                const dans = g.ecritures.filter((e) => e.dansLaCible);
                const avant = g.ecritures.filter((e) => !e.dansLaCible);
                if (dans.length > 0) {
                    etapes.push(`corrigez ${pieces(dans)}, qui ${dans.length > 1 ? 'déplacent' : 'déplace'} le 478 ou le 479 de l'écart (au brouillard, supprimez-la ; ` +
                        'validée, par inscription en négatif, AUDCIF art. 20, al. 2' +
                        (dans.some((e) => e.dansLeSens) ? ' ; un écart de cet exercice se repasse après la contre-passation)' : ')'));
                }
                if (avant.length > 0) {
                    etapes.push(`inversez à l'ouverture de ${periode(etat.cible)} ${pieces(avant)}, passée${avant.length > 1 ? 's' : ''} dans un exercice antérieur ` +
                        '(une écriture des mêmes comptes et montants, en sens contraire)');
                }
            }
            etapes.push(issue.fin === 'CONTRE_PASSER'
                ? 'puis contre-passez (Devises, « Contre-passer »)'
                : `puis déclarez ${pieces([issue.ecriture])}, qui l'inverse exactement (Devises, « Déclarer une contre-passation manuelle »)`);
            return `${tete} ne se contre-passe pas en l'état · ${etatDit} (${chiffres}). ${etapes.join(', ').replace(/^./, (c) => c.toUpperCase())}.${borne}`;
        }
        const autres = etat.autresEcarts.length > 0 ? ` Écarts passés hors du module tenus pour en place · ${pieces(etat.autresEcarts)}.` : '';
        const nommees = etat.ecritures.length > 0 ? ` Écritures hors module sur l'écart · ${pieces(etat.ecritures)}.` : '';
        return (`${tete} ne se contre-passe pas en l'état · ${etatDit} (${chiffres}), et aucune correction ne se déduit des comptes.` +
            autres +
            nommees +
            (ouverture
                ? ` ${ouverture.replace(/^./, (c) => c.toUpperCase())} · rapprochez-la de cette clôture (corrigez le bilan d'ouverture, ou complétez l'exercice précédent), puis contre-passez.`
                : " Rapprochez ces comptes · un écart passé hors du module qui n'est plus en place, ou une écriture qui déplace le 478 ou le 479, se corrige " +
                    'par inscription en négatif (AUDCIF art. 20, al. 2) ; puis contre-passez.') +
            borne);
    }
    async candidatesContrePassationManuelle(tenantId, reevaluationId) {
        const PLAFOND_CANDIDATES = 20;
        const { reeval, attendus, jour } = await this.reevaluationADeclarer(tenantId, reevaluationId);
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
        const etat = await this.etatDeLEcart(tenantId, reeval, attendus);
        const declarable = etat.jugement !== null && (etat.jugement.verdict === 'CONTRE_PASSEE' || etat.jugement.verdict === 'AMBIGU' || reeval.etatAtteste);
        const ids = declarable ? etat.ecritures.filter((e) => e.exacte).map((e) => e.id) : [];
        const candidates = ids.length === 0
            ? []
            : await this.prisma.ecriture.findMany({
                where: { tenantId, id: { in: ids } },
                orderBy: [{ date: 'asc' }, { id: 'asc' }],
                take: PLAFOND_CANDIDATES,
                select: {
                    id: true,
                    numeroPiece: true,
                    date: true,
                    libelle: true,
                    statut: true,
                    journal: { select: { code: true } },
                    exercice: { select: { dateDebut: true, dateFin: true, statut: true } },
                },
            });
        return {
            montants: (0, contre_passation_manuelle_1.libelleMontantsAContrePasser)(attendus),
            candidates,
            tronque: etat.tronque || ids.length > PLAFOND_CANDIDATES,
            motifHorsModule: candidates.length > 0 && !reeval.etatAtteste
                ? null
                : this.motifEtatDeLEcart(etat, attendus, jour(reeval.dateReevaluation), await this.referentielDuDossier(tenantId)),
            etatAtteste: reeval.etatAtteste,
        };
    }
    async attesterEtatDeLEcart(tenantId, userId, reevaluationId, motif) {
        const raison = (motif ?? '').trim();
        if (raison.length < exports.MOTIF_ATTESTATION_MIN || raison.length > exports.MOTIF_ATTESTATION_MAX) {
            throw new common_1.BadRequestException(`Le motif de l'attestation est obligatoire, de ${exports.MOTIF_ATTESTATION_MIN} à ${exports.MOTIF_ATTESTATION_MAX} caractères · dites ce qui justifie l'état des comptes de l'écart.`);
        }
        return this.sousVerrouDuDossier(tenantId, "ATTESTATION DE L'ÉTAT DE L'ÉCART", async () => {
            const reeval = await this.prisma.reevaluation.findFirst({
                where: { id: reevaluationId, tenantId },
                select: { id: true, annuleeLe: true, etatAtteste: true },
            });
            if (!reeval)
                throw new common_1.NotFoundException('Réévaluation introuvable pour ce dossier');
            if (reeval.annuleeLe)
                throw new common_1.ConflictException("Cette réévaluation est annulée · il n'y a rien à attester.");
            if (reeval.etatAtteste)
                throw new common_1.ConflictException("L'état de l'écart de cette réévaluation est déjà attesté · retirez l'attestation pour en poser une autre.");
            try {
                await this.prisma.reevaluation.update({
                    where: { id: reeval.id, tenantId, annuleeLe: null, etatAtteste: false },
                    data: { etatAtteste: true, motifAttestation: raison, etatAttesteLe: new Date(), etatAttestePar: userId },
                });
            }
            catch (e) {
                if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
                    throw new common_1.ConflictException("L'attestation de cette réévaluation a changé entre-temps · relancez le geste.");
                }
                throw e;
            }
            return this.prisma.reevaluation.findFirstOrThrow({ where: { id: reeval.id, tenantId } });
        });
    }
    async retirerAttestationEtatDeLEcart(tenantId, userId, reevaluationId, motif) {
        const raison = (motif ?? '').trim();
        if (raison.length < exports.MOTIF_ATTESTATION_MIN || raison.length > exports.MOTIF_ATTESTATION_MAX) {
            throw new common_1.BadRequestException(`Le motif du retrait est obligatoire, de ${exports.MOTIF_ATTESTATION_MIN} à ${exports.MOTIF_ATTESTATION_MAX} caractères.`);
        }
        return this.sousVerrouDuDossier(tenantId, "RETRAIT DE L'ATTESTATION DE L'ÉTAT DE L'ÉCART", async () => {
            const reeval = await this.prisma.reevaluation.findFirst({
                where: { id: reevaluationId, tenantId },
                select: {
                    id: true,
                    etatAtteste: true,
                    motifAttestation: true,
                    etatAttesteLe: true,
                    etatAttestePar: true,
                    retraitsAttestation: true,
                    exercice: { select: { dateFin: true } },
                    ecritureExtourne: { select: { numeroPiece: true, createdAt: true } },
                    contrePassationDeclareeLe: true,
                },
            });
            if (!reeval)
                throw new common_1.NotFoundException('Réévaluation introuvable pour ce dossier');
            if (!reeval.etatAtteste)
                throw new common_1.BadRequestException("L'état de l'écart de cette réévaluation n'est pas attesté · il n'y a rien à retirer.");
            const depuis = reeval.etatAttesteLe ?? new Date(0);
            if (reeval.ecritureExtourne && reeval.ecritureExtourne.createdAt.getTime() >= depuis.getTime()) {
                throw new common_1.BadRequestException(`La contre-passation (pièce n° ${reeval.ecritureExtourne.numeroPiece ?? '·'}) a été passée sous cette attestation · ` +
                    "annulez-la d'abord (Devises, « Annuler la contre-passation »), puis retirez l'attestation.");
            }
            if (reeval.contrePassationDeclareeLe && reeval.contrePassationDeclareeLe.getTime() >= depuis.getTime()) {
                throw new common_1.BadRequestException("La contre-passation manuelle a été déclarée sous cette attestation · retirez d'abord la déclaration (Devises, « Retirer la déclaration »).");
            }
            const appui = await this.prisma.reevaluation.findFirst({
                where: { tenantId, annuleeLe: null, id: { not: reeval.id }, exercice: { dateDebut: { gt: reeval.exercice.dateFin } }, createdAt: { gte: depuis } },
                orderBy: [{ dateReevaluation: 'asc' }, { id: 'asc' }],
                select: { dateReevaluation: true },
            });
            if (appui) {
                throw new common_1.BadRequestException(`La réévaluation du ${appui.dateReevaluation.toISOString().slice(0, 10)} a été passée sous cette attestation · annulez-la ` +
                    "d'abord (Devises, « Annuler la réévaluation »), puis retirez l'attestation.");
            }
            const anciens = Array.isArray(reeval.retraitsAttestation) ? reeval.retraitsAttestation : [];
            const trace = {
                motifAttestation: reeval.motifAttestation,
                attesteLe: reeval.etatAttesteLe?.toISOString() ?? null,
                attestePar: reeval.etatAttestePar,
                motif: raison,
                par: userId,
                le: new Date().toISOString(),
            };
            try {
                await this.prisma.reevaluation.update({
                    where: { id: reeval.id, tenantId, etatAtteste: true },
                    data: {
                        etatAtteste: false,
                        motifAttestation: null,
                        etatAttesteLe: null,
                        etatAttestePar: null,
                        retraitsAttestation: [...anciens, trace],
                    },
                });
            }
            catch (e) {
                if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
                    throw new common_1.ConflictException("L'attestation de cette réévaluation a changé entre-temps · relancez le geste.");
                }
                throw e;
            }
            return this.prisma.reevaluation.findFirstOrThrow({ where: { id: reeval.id, tenantId } });
        });
    }
    async retirerContrePassationManuelle(tenantId, userId, reevaluationId, motif) {
        const raison = (motif ?? '').trim();
        if (raison.length < 3)
            throw new common_1.BadRequestException('Le motif du retrait est obligatoire (3 caractères au moins).');
        return this.sousVerrouDuDossier(tenantId, 'RETRAIT DE CONTRE-PASSATION DÉCLARÉE', async () => {
            const reeval = await this.prisma.reevaluation.findFirst({
                where: { id: reevaluationId, tenantId },
                select: {
                    id: true,
                    contrePassationDeclareeId: true,
                    motifContrePassationDeclaree: true,
                    contrePassationDeclareeLe: true,
                    contrePassationDeclareePar: true,
                    retraitsContrePassationDeclaree: true,
                    contrePassationDeclaree: { select: { numeroPiece: true, exercice: { select: { dateDebut: true, statut: true } } } },
                },
            });
            if (!reeval)
                throw new common_1.NotFoundException('Réévaluation introuvable pour ce dossier');
            const declaree = reeval.contrePassationDeclaree;
            if (!reeval.contrePassationDeclareeId || !declaree) {
                throw new common_1.BadRequestException("Aucune contre-passation manuelle n'est déclarée pour cette réévaluation · il n'y a rien à retirer.");
            }
            if (declaree.exercice.statut === client_1.StatutExercice.CLOTURE) {
                throw new common_1.BadRequestException(`L'écriture déclarée (pièce n° ${declaree.numeroPiece ?? '·'}) est dans un exercice clôturé · elle ne se corrige plus ` +
                    "(AUDCIF art. 20, al. 3), et retirer la déclaration ferait repasser un écart qu'elle a déjà contre-passé. La déclaration reste.");
            }
            const appui = await this.prisma.reevaluation.findFirst({
                where: { tenantId, annuleeLe: null, id: { not: reeval.id }, exercice: { dateDebut: { gte: declaree.exercice.dateDebut } } },
                orderBy: [{ dateReevaluation: 'asc' }, { id: 'asc' }],
                select: { dateReevaluation: true },
            });
            if (appui) {
                throw new common_1.BadRequestException(`La réévaluation du ${appui.dateReevaluation.toISOString().slice(0, 10)} a été calculée avec cette contre-passation en place · ` +
                    "annulez-la d'abord (Devises), puis retirez la déclaration. Retirée, l'écriture ne serait plus retenue, et sa suppression " +
                    "ramènerait un écart que cette réévaluation a déjà mesuré depuis le coût historique.");
            }
            const anciens = Array.isArray(reeval.retraitsContrePassationDeclaree) ? reeval.retraitsContrePassationDeclaree : [];
            const trace = {
                ecritureId: reeval.contrePassationDeclareeId,
                numeroPiece: declaree.numeroPiece,
                motifDeclaration: reeval.motifContrePassationDeclaree,
                declareeLe: reeval.contrePassationDeclareeLe?.toISOString() ?? null,
                declareePar: reeval.contrePassationDeclareePar,
                motif: raison,
                par: userId,
                le: new Date().toISOString(),
            };
            try {
                await this.prisma.reevaluation.update({
                    where: { id: reeval.id, tenantId, contrePassationDeclareeId: reeval.contrePassationDeclareeId },
                    data: {
                        contrePassationDeclareeId: null,
                        motifContrePassationDeclaree: null,
                        contrePassationDeclareeLe: null,
                        contrePassationDeclareePar: null,
                        retraitsContrePassationDeclaree: [...anciens, trace],
                    },
                });
            }
            catch (e) {
                if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
                    throw new common_1.ConflictException('La déclaration de cette réévaluation a changé entre-temps · relancez le geste.');
                }
                throw e;
            }
            return this.prisma.reevaluation.findFirstOrThrow({ where: { id: reeval.id, tenantId } });
        });
    }
    async annulerReevaluation(tenantId, userId, reevaluationId, motif) {
        const raison = (motif ?? '').trim();
        if (!raison)
            throw new common_1.BadRequestException("Le motif de l'annulation est obligatoire (AUDCIF art. 20).");
        return this.sousVerrouDuDossier(tenantId, 'ANNULATION', () => this.annulerSousVerrou(tenantId, userId, reevaluationId, raison));
    }
    async annulerSousVerrou(tenantId, userId, reevaluationId, motif) {
        const ecriture = {
            select: {
                id: true,
                statut: true,
                numeroPiece: true,
                exercice: { select: { statut: true } },
                lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true, compte: { select: { numero: true } } } },
            },
        };
        const reeval = await this.prisma.reevaluation.findFirst({
            where: { id: reevaluationId, tenantId },
            include: {
                exercice: { select: { statut: true, dateDebut: true, dateFin: true } },
                ecritureEcarts: ecriture,
                ecritureProvision: ecriture,
                ecritureExtourne: ecriture,
            },
        });
        if (!reeval)
            throw new common_1.NotFoundException('Réévaluation introuvable pour ce dossier');
        const jour = (d) => d.toISOString().slice(0, 10);
        if (reeval.annuleeLe) {
            throw new common_1.ConflictException(`Cette réévaluation est déjà annulée, le ${jour(reeval.annuleeLe)}.`);
        }
        if (reeval.exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("L'exercice de cette réévaluation est clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3), hors de ce geste.");
        }
        if (reeval.ecritureExtourne && reeval.ecritureExtourne.exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("La contre-passation de cette réévaluation est passée dans un exercice clôturé · elle ne s'annule plus (AUDCIF art. 20, al. 3).");
        }
        if (reeval.contrePassationDeclareeId) {
            throw new common_1.BadRequestException('Cette réévaluation est contre-passée par une écriture manuelle déclarée · retirez la déclaration (Devises, « Retirer la ' +
                "déclaration »), annulez la réévaluation, puis corrigez l'écriture manuelle par inscription en négatif (AUDCIF art. 20, al. 2).");
        }
        const posterieure = await this.prisma.reevaluation.findFirst({
            where: { tenantId, annuleeLe: null, dateReevaluation: { gt: reeval.dateReevaluation } },
            orderBy: { dateReevaluation: 'asc' },
            select: { dateReevaluation: true },
        });
        if (posterieure) {
            throw new common_1.BadRequestException(`La réévaluation du ${jour(posterieure.dateReevaluation)}, postérieure, n'est pas annulée · elle part de la provision que ` +
                "celle-ci a passée. On annule de la plus récente à la plus ancienne.");
        }
        const comptesTouches = [...new Set((reeval.ecritureProvision?.lignes ?? []).map((l) => l.compte.numero))];
        const touche = (compteProvision) => comptesTouches.some((n) => n.startsWith(compteProvision));
        const versions = (comptesTouches.length === 0
            ? []
            : await this.prisma.provisionChangeOuverture.findMany({
                where: { tenantId, dateReference: { gt: reeval.dateReevaluation } },
                orderBy: [{ dateReference: 'asc' }, { compteProvision: 'asc' }],
                take: 200,
                select: { compteProvision: true, dateReference: true },
            })).filter((v) => touche(v.compteProvision));
        if (versions.length > 0) {
            const nommees = versions
                .slice(0, 20)
                .map((v) => `au ${jour(v.dateReference)} (compte ${v.compteProvision})`)
                .join(', ');
            const plus = versions.length > 20 ? ' et d’autres encore' : '';
            const une = versions.length === 1;
            throw new common_1.BadRequestException(`${une ? 'La provision d’ouverture déclarée' : 'Les provisions d’ouverture déclarées'} ${nommees}${plus} ` +
                `${une ? 's’appuie' : 's’appuient'} sur la provision que cette réévaluation a passée · ${une ? 'retirez-la' : 'retirez-les'} ` +
                '(Devises, « Dossier repris », « Retirer »), annulez la réévaluation, puis déclarez de nouveau ce qui reste vrai. ' +
                'Une version nouvelle ne lève pas ce refus · l’ancienne resterait en place.');
        }
        const ecritures = [
            ['ECARTS', reeval.ecritureEcarts],
            ['PROVISION', reeval.ecritureProvision],
            ['CONTRE_PASSATION', reeval.ecritureExtourne],
        ];
        const NOMS = { ECARTS: "d'écarts", PROVISION: 'de provision', CONTRE_PASSATION: 'de contre-passation' };
        for (const [role, e] of ecritures) {
            if (!e)
                continue;
            const motif = (0, lignes_tenues_1.motifLignesTenues)(e.lignes, `l'écriture ${NOMS[role]} n° ${e.numeroPiece ?? '·'}`, 'annuler', ', puis annulez la réévaluation');
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const fait = [];
            for (const [role, e] of ecritures) {
                if (!e)
                    continue;
                const relues = await tx.ligneEcriture.findMany({
                    where: { ecritureId: e.id, ecriture: { tenantId } },
                    select: { lettre: true, lettrageId: true, rapprochementId: true },
                });
                const motifTenues = (0, lignes_tenues_1.motifLignesTenues)(relues, `l'écriture ${NOMS[role]} n° ${e.numeroPiece ?? '·'}`, 'annuler', ', puis annulez la réévaluation');
                if (motifTenues)
                    throw new common_1.BadRequestException(motifTenues);
            }
            for (const [role, e] of ecritures) {
                if (!e)
                    continue;
                if (e.statut === client_1.StatutEcriture.BROUILLARD) {
                    fait.push({ role, ecritureId: e.id, numeroPiece: e.numeroPiece, traitement: 'SUPPRIMEE' });
                }
                else {
                    const negatif = await this.ecritureService.inscrireEnNegatifPourAnnulation(tenantId, userId, e.id, motif, tx);
                    fait.push({ role, ecritureId: e.id, numeroPiece: e.numeroPiece, traitement: 'INSCRITE_EN_NEGATIF', negatifId: negatif.id, negatifNumeroPiece: negatif.numeroPiece });
                }
            }
            try {
                await tx.reevaluation.update({
                    where: { id: reeval.id, tenantId, annuleeLe: null },
                    data: { annuleeLe: new Date(), annuleePar: userId, motifAnnulation: motif, annulation: fait },
                });
            }
            catch (e) {
                if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
                    throw new common_1.ConflictException('Cette réévaluation est déjà annulée.');
                }
                throw e;
            }
            for (const f of fait) {
                if (f.traitement !== 'SUPPRIMEE')
                    continue;
                await tx.ligneEcriture.deleteMany({ where: { ecritureId: f.ecritureId, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } } });
                const r = await tx.ecriture.deleteMany({ where: { id: f.ecritureId, tenantId, statut: client_1.StatutEcriture.BROUILLARD } });
                if (r.count !== 1) {
                    throw new common_1.ConflictException(`L'écriture ${NOMS[f.role]} n° ${f.numeroPiece ?? '·'} a été validée ou retirée pendant l'annulation · ` +
                        "rien n'est annulé. Relancez l'annulation · validée, elle s'inscrira en négatif (AUDCIF art. 20, al. 2).");
                }
            }
            return tx.reevaluation.findFirstOrThrow({ where: { id: reeval.id, tenantId } });
        });
    }
    async listerReevaluations(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { dateFin: true } });
        const suivant = exercice ? await this.cibleDeContrePassation(tenantId, exercice.dateFin) : null;
        const suivantAncienRegime = suivant
            ? (await this.prisma.reevaluation.findFirst({
                where: { tenantId, exerciceId: suivant.id, annuleeLe: null, ecartsDisponibilites: { equals: client_1.Prisma.DbNull } },
                select: { id: true },
            })) !== null
            : false;
        const reevaluations = await this.prisma.reevaluation.findMany({
            where: { tenantId, exerciceId },
            orderBy: { dateReevaluation: 'desc' },
            include: {
                ecritureEcarts: { select: { id: true, numeroPiece: true, date: true } },
                ecritureProvision: { select: { id: true, numeroPiece: true } },
                ecritureExtourne: { select: { id: true, numeroPiece: true, date: true } },
                contrePassationDeclaree: { select: { id: true, numeroPiece: true, date: true } },
            },
        });
        const relues = await this.prisma.reevaluation.findMany({
            where: { tenantId, exerciceId, id: { in: reevaluations.map((r) => r.id) } },
            select: SELECTION_REEVALUATION_RELUE,
        });
        const relueDe = new Map(relues.map((r) => [r.id, r]));
        return Promise.all(reevaluations.map(async (r) => {
            const relue = relueDe.get(r.id);
            const partage = relue?.ecritureEcarts
                ? (0, ecarts_disponibilites_1.partagerLignesDEcarts)(relue.ecritureEcarts.lignes.map((l) => ({ compteNumero: l.compte.numero, debit: Number(l.debit), credit: Number(l.credit) })))
                : null;
            const libre = !r.annuleeLe && !r.ecritureExtourneId && !r.contrePassationDeclareeId && partage !== null;
            const contrePassationAPasser = !libre
                ? null
                : partage.realisees.length > 0 && suivantAncienRegime
                    ? 'INTEGRALE_ANCIEN_REGIME'
                    : partage.motifRefus
                        ? 'INTEGRALE_SUR_DEMANDE'
                        : partage.aContrePasser.length > 0
                            ? 'ECARTS_DE_CONVERSION'
                            : null;
            return {
                ...r,
                horsCloture: exercice ? (0, perimetre_reevaluation_1.motifDateReevaluation)(r.dateReevaluation.toISOString().slice(0, 10), exercice.dateFin) : null,
                contrePassationAPasser,
                exerciceDeContrePassation: suivant,
                ventilationAExiger: relue ? await this.ventilationAExiger(tenantId, relue) : null,
            };
        }));
    }
    async provisionsEnPlace(tenantId, exercice, date, familles) {
        const { enVigueur, parFamille, reevaluations, etats, exercices } = await this.etatsOuverture(tenantId, exercice, familles.map((f) => f.provision), date);
        const declarees = new Map();
        for (const [compte, v] of enVigueur)
            declarees.set(compte, v.montant);
        const idsDuModule = reevaluations.map((r) => r.ecritureProvisionId).filter((id) => !!id);
        const avertissements = [];
        const nonDeclarees = [];
        const excessives = [];
        for (const f of familles) {
            const hors = await this.prisma.ligneEcriture.aggregate({
                where: {
                    compte: { tenantId, numero: { startsWith: f.provision } },
                    ecriture: {
                        tenantId,
                        exerciceId: exercice.id,
                        date: { lte: date },
                        estGenereeParCloture: false,
                        estANouveauProvisoire: false,
                        ...ecritures_de_situation_1.HORS_SITUATION,
                        ...(idsDuModule.length > 0 ? { id: { notIn: idsDuModule } } : {}),
                        NOT: ECRITURES_D_UNE_REEVALUATION_ANNULEE,
                    },
                },
                _count: { _all: true },
            });
            const nombre = hors._count?._all ?? 0;
            if (nombre > 0) {
                avertissements.push(`Le compte ${f.provision} porte ${nombre} ligne(s) passée(s) dans l'exercice hors réévaluation. ` +
                    "La provision pour perte de change en place est lue sur les seules réévaluations passées · " +
                    "si l'une de ces lignes dote ou reprend une provision pour perte de change, l'ajustement proposé la doublerait.");
            }
            const anterieursOuverts = exercices.filter((x) => x.statut !== client_1.StatutExercice.CLOTURE && x.dateFin.getTime() < exercice.dateDebut.getTime());
            if (anterieursOuverts.length > 0) {
                const horsAnterieurs = await this.prisma.ligneEcriture.aggregate({
                    where: {
                        compte: { tenantId, numero: { startsWith: f.provision } },
                        ecriture: {
                            tenantId,
                            exerciceId: { in: anterieursOuverts.map((x) => x.id) },
                            estGenereeParCloture: false,
                            estANouveauProvisoire: false,
                            ...ecritures_de_situation_1.HORS_SITUATION,
                            ...(idsDuModule.length > 0 ? { id: { notIn: idsDuModule } } : {}),
                            NOT: ECRITURES_D_UNE_REEVALUATION_ANNULEE,
                        },
                    },
                    _count: { _all: true },
                });
                const nombreAnterieur = horsAnterieurs._count?._all ?? 0;
                if (nombreAnterieur > 0) {
                    avertissements.push(`Le compte ${f.provision} porte ${nombreAnterieur} ligne(s) passée(s) hors réévaluation dans un exercice antérieur encore ` +
                        "ouvert · la provision lue à la clôture précédente ne les compte pas. Si elles dotent ou reprennent une provision pour " +
                        "perte de change, déclarez la provision au début de l'exercice.");
                }
            }
            const e = etats.get(f.provision);
            const ouverture = e.ouverture;
            const provisoire = ouverture.statut === 'IMPORTE' ? ' (à-nouveau au brouillard, bilan d’ouverture importé, provisoire, non validé)' : '';
            if (e.horsBornes) {
                const x = e.horsBornes;
                excessives.push(x);
                avertissements.push(`La provision pour pertes de change déclarée à l'ouverture ne concorde pas avec l'ouverture${x.plafondFiable ? provisoire : ''} · ` +
                    `${libelleVersionHorsBornes(x)}.`);
            }
            if (!e.reserve)
                continue;
            const explique = e.explique;
            nonDeclarees.push({ compteProvision: f.provision, soldeOuverture: ouverture.montant, explique, statutOuverture: ouverture.statut });
            const sens = explique > ouverture.montant
                ? `alors que les réévaluations OmegaX en expliquent ${explique.toFixed(2)}, plus que ce solde`
                : `dont les réévaluations OmegaX n'expliquent que ${explique.toFixed(2)}`;
            const consigne = "la provision pour pertes de change existant à l'ouverture n'est pas déclarée · elle est lue sans cette part, sous " +
                "réserve, et l'ajustement ne se passe pas tant qu'elle n'est pas déclarée (montant, source ; zéro si ce solde porte " +
                'un autre risque).';
            if (ouverture.statut === 'CLOTURE_PRECEDENTE') {
                avertissements.push(`Le compte ${f.provision} s'ouvre, faute d'à-nouveau validé, sur son solde à la clôture de l'exercice précédent ` +
                    `reconstitué de ses écritures (${ouverture.montant.toFixed(2)}), ${sens} · un à-nouveau ou une écriture entrés dans ` +
                    `cet exercice après sa réévaluation n'y sont pas expliqués (une provision pour litige du même compte, par exemple), ` +
                    `et ${consigne} Deux issues · déclarez au début de l'exercice la part de change (au plus ${ouverture.montant.toFixed(2)}), ` +
                    "ou clôturez l'exercice précédent pour que son à-nouveau soit validé.");
                continue;
            }
            const clotureDitAutreChose = ouverture.cloturePrecedente !== null &&
                Math.abs(ouverture.montant - ouverture.cloturePrecedente) >= 0.005 &&
                Math.abs(ouverture.cloturePrecedente - explique) >= 0.005;
            if (clotureDitAutreChose) {
                avertissements.push(`L'à-nouveau du compte ${f.provision} (${ouverture.montant.toFixed(2)}${provisoire}) ne concorde pas avec le solde du ` +
                    `compte reconstitué à la clôture de l'exercice précédent (${ouverture.cloturePrecedente.toFixed(2)}) · ` +
                    `déclarez au début de l'exercice la part de ${ouverture.montant.toFixed(2)} qui couvre des pertes de change (montant, source ; ` +
                    'zéro si ce solde porte un autre risque).');
            }
            if (Math.abs(ouverture.montant - explique) >= 0.005 || !clotureDitAutreChose) {
                avertissements.push(`Le compte ${f.provision} s'ouvre avec un solde de ${ouverture.montant.toFixed(2)}${provisoire}, ${sens}, et ${consigne}`);
            }
        }
        return { parFamille, declarees, nonDeclarees, excessives, avertissements };
    }
    async etatsOuverture(tenantId, exercice, racines, date) {
        const ctx = await this.contexteProvision(tenantId);
        const enVigueur = new Map();
        for (const racine of racines) {
            const v = versionEnVigueur(ctx.versions.filter((x) => x.compteProvision === racine), date);
            if (v) {
                enVigueur.set(racine, {
                    montant: Number(v.montant),
                    dateReference: v.dateReference,
                    contesteeAuMontant: v.provisionModuleContestee === true && v.provisionModuleContesteeMontant !== null && v.provisionModuleContesteeMontant !== undefined
                        ? Number(v.provisionModuleContesteeMontant)
                        : null,
                });
            }
        }
        const parFamille = new Map();
        for (const racine of racines) {
            const v = enVigueur.get(racine);
            const montant = (v?.montant ?? 0) + sommeProvision(ctx.lignes, racine, v ? v.dateReference : null, date, false);
            if (v || Math.abs(montant) >= 0.005)
                parFamille.set(racine, montant);
        }
        const ouvertures = await this.ouverturesDe(tenantId, exercice, racines, ctx);
        const etats = new Map();
        for (const racine of racines) {
            const ouverture = ouvertures.get(racine);
            const v = enVigueur.get(racine);
            const explique = arrondiCentime(sommeProvision(ctx.lignes, racine, null, exercice.dateDebut, false));
            const enPlaceOuverture = v
                ? arrondiCentime(v.montant + sommeProvision(ctx.lignes, racine, v.dateReference, exercice.dateDebut, false))
                : null;
            const bornes = bornesDeVersion(ouverture, explique);
            let horsBornes = null;
            if (enPlaceOuverture !== null && v) {
                const contestationValable = v.contesteeAuMontant !== null && Math.abs(v.contesteeAuMontant - bornes.module) < 0.005;
                const sousLePlancher = enPlaceOuverture < bornes.plancher - 0.005;
                const borne = enPlaceOuverture > bornes.plafond + 0.005
                    ? 'PLAFOND'
                    : sousLePlancher && !contestationValable
                        ? 'PLANCHER'
                        : null;
                if (borne) {
                    horsBornes = {
                        compteProvision: racine,
                        enPlaceOuverture,
                        borne,
                        plancher: bornes.plancher,
                        plafond: bornes.plafond,
                        plafondFiable: ouverture.fiable,
                        provisionModule: bornes.module,
                        contesteeAuMontant: borne === 'PLANCHER' && v.contesteeAuMontant !== null ? v.contesteeAuMontant : null,
                    };
                }
            }
            const depasse = horsBornes !== null;
            etats.set(racine, {
                ouverture,
                explique,
                enPlaceOuverture,
                depasse,
                horsBornes,
                bornes,
                reserve: !v &&
                    (Math.abs(ouverture.montant - explique) >= 0.005 ||
                        (ouverture.fiable &&
                            ouverture.cloturePrecedente !== null &&
                            Math.abs(ouverture.montant - ouverture.cloturePrecedente) >= 0.005)),
            });
        }
        return { enVigueur, parFamille, reevaluations: ctx.reevaluations, etats, exercices: ctx.exercices };
    }
    async contexteProvision(tenantId) {
        const versions = await this.prisma.provisionChangeOuverture.findMany({
            where: { tenantId },
            select: {
                compteProvision: true,
                montant: true,
                dateReference: true,
                provisionModuleContestee: true,
                provisionModuleContesteeMontant: true,
            },
            orderBy: { dateReference: 'asc' },
        });
        const reevaluations = await this.prisma.reevaluation.findMany({
            where: { tenantId, ecritureProvisionId: { not: null }, annuleeLe: null },
            select: {
                dateReevaluation: true,
                ecritureProvisionId: true,
                ecritureProvision: {
                    select: { lignes: { select: { debit: true, credit: true, compte: { select: { numero: true } } } } },
                },
            },
        });
        const lignes = [];
        for (const r of reevaluations) {
            for (const l of r.ecritureProvision?.lignes ?? []) {
                lignes.push({ date: r.dateReevaluation, numero: l.compte.numero, montant: Number(l.credit) - Number(l.debit) });
            }
        }
        const exercices = await this.prisma.exercice.findMany({
            where: { tenantId },
            select: { id: true, dateDebut: true, dateFin: true, statut: true },
            orderBy: { dateDebut: 'asc' },
        });
        return { versions, reevaluations, lignes, exercices };
    }
    async ouverturesDe(tenantId, exercice, racines, ctx) {
        const rendu = new Map();
        const nonProvisoire = {
            tenantId,
            exerciceId: exercice.id,
            estGenereeParCloture: true,
            estSoldeDesComptesDeGestion: false,
            estANouveauProvisoire: false,
        };
        const precedent = [...ctx.exercices]
            .filter((e) => e.dateFin.getTime() < exercice.dateDebut.getTime())
            .sort((x, y) => y.dateFin.getTime() - x.dateFin.getTime())[0];
        if ((await this.prisma.ecriture.count({ where: { ...nonProvisoire, tenantId } })) > 0) {
            const auBrouillard = await this.prisma.ecriture.count({
                where: { ...nonProvisoire, tenantId, statut: client_1.StatutEcriture.BROUILLARD },
            });
            const statut = auBrouillard > 0 ? 'IMPORTE' : 'VALIDE';
            const clotures = precedent ? await this.cloturesDe(tenantId, precedent, racines, ctx) : null;
            for (const racine of racines) {
                const r = await this.prisma.ligneEcriture.aggregate({
                    where: { compte: { tenantId, numero: { startsWith: racine } }, ecriture: nonProvisoire },
                    _sum: { debit: true, credit: true },
                });
                rendu.set(racine, {
                    montant: arrondiCentime(Number(r._sum?.credit ?? 0) - Number(r._sum?.debit ?? 0)),
                    statut,
                    fiable: true,
                    cloturePrecedente: clotures ? clotures.get(racine).reconstitue : null,
                    provisionModule: clotures ? clotures.get(racine).module : null,
                });
            }
            return rendu;
        }
        if (!precedent) {
            for (const racine of racines) {
                rendu.set(racine, { montant: 0, statut: 'AUCUN', fiable: true, cloturePrecedente: null, provisionModule: null });
            }
            return rendu;
        }
        const clotures = await this.cloturesDe(tenantId, precedent, racines, ctx);
        for (const racine of racines) {
            const c = clotures.get(racine);
            rendu.set(racine, {
                montant: c.reconstitue,
                statut: 'CLOTURE_PRECEDENTE',
                fiable: false,
                cloturePrecedente: c.reconstitue,
                provisionModule: c.module,
            });
        }
        return rendu;
    }
    async cloturesDe(tenantId, exercice, racines, ctx) {
        const rendu = new Map();
        const ouverture = await this.ouverturesDe(tenantId, exercice, racines, ctx);
        for (const racine of racines) {
            const v = versionEnVigueur(ctx.versions.filter((x) => x.compteProvision === racine), exercice.dateFin);
            const module = v
                ? Number(v.montant) + sommeProvision(ctx.lignes, racine, v.dateReference, exercice.dateFin, true)
                : sommeProvision(ctx.lignes, racine, null, exercice.dateFin, true);
            const r = await this.prisma.ligneEcriture.aggregate({
                where: {
                    compte: { tenantId, numero: { startsWith: racine } },
                    ecriture: { tenantId, exerciceId: exercice.id, estGenereeParCloture: false, ...ecritures_de_situation_1.HORS_SITUATION },
                },
                _sum: { debit: true, credit: true },
            });
            rendu.set(racine, {
                reconstitue: arrondiCentime(ouverture.get(racine).montant + Number(r._sum?.credit ?? 0) - Number(r._sum?.debit ?? 0)),
                module: arrondiCentime(module),
            });
        }
        return rendu;
    }
    async reevaluationUtilisatrice(tenantId, v, suivante) {
        return this.prisma.reevaluation.findFirst({
            where: {
                tenantId,
                annuleeLe: null,
                dateReevaluation: { gte: v.dateReference, ...(suivante ? { lt: suivante.dateReference } : {}) },
            },
            select: { dateReevaluation: true },
        });
    }
    async provisionsOuverture(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { id: true, dateDebut: true },
        });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier');
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
        if (!tenant)
            throw new common_1.BadRequestException('Dossier introuvable');
        const racines = comptesProvisionDeclarables(tenant.referentiel);
        const versions = await this.prisma.provisionChangeOuverture.findMany({
            where: { tenantId },
            orderBy: { dateReference: 'asc' },
        });
        const { etats } = await this.etatsOuverture(tenantId, exercice, racines, exercice.dateDebut);
        const jour = (d) => d.toISOString().slice(0, 10);
        const rendu = [];
        for (const compteProvision of racines) {
            const duCompte = versions.filter((v) => v.compteProvision === compteProvision);
            const lues = [];
            for (let i = 0; i < duCompte.length; i++) {
                const v = duCompte[i];
                const utilisatrice = await this.reevaluationUtilisatrice(tenantId, v, duCompte[i + 1]);
                lues.push({
                    id: v.id,
                    montant: Number(v.montant),
                    dateReference: jour(v.dateReference),
                    source: v.source,
                    motif: v.motif,
                    provisionModuleContestee: v.provisionModuleContestee,
                    motifContestation: v.motifContestation,
                    provisionModuleContesteeMontant: v.provisionModuleContesteeMontant === null ? null : Number(v.provisionModuleContesteeMontant),
                    utilisee: !!utilisatrice,
                });
            }
            const enVigueur = versionEnVigueur(duCompte, exercice.dateDebut);
            const e = etats.get(compteProvision);
            rendu.push({
                compteProvision,
                soldeOuverturePropose: e.ouverture.montant,
                statutSoldeOuverture: e.ouverture.statut,
                ouvertureFiable: e.ouverture.fiable,
                provisionEnPlaceOuverture: e.enPlaceOuverture,
                depasseSoldeOuverture: e.depasse,
                provisionModuleOuverture: e.bornes.module,
                plancherVersion: e.bornes.plancher,
                plafondVersion: e.bornes.plafond,
                horsBornes: e.horsBornes ? e.horsBornes.borne : null,
                reserve: e.reserve,
                explique: e.explique,
                versions: lues,
                enVigueur: enVigueur ? (lues.find((l) => l.id === enVigueur.id) ?? null) : null,
            });
        }
        return { dateOuverture: jour(exercice.dateDebut), comptes: rendu };
    }
    async declarerProvisionOuverture(tenantId, userId, dto) {
        return this.sousVerrouDuDossier(tenantId, 'DECLARATION', () => this.declarerSousVerrou(tenantId, userId, dto));
    }
    async declarerSousVerrou(tenantId, userId, dto) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
        if (!tenant)
            throw new common_1.BadRequestException('Dossier introuvable');
        const motif = motifRefusDeclarationOuverture(tenant.referentiel, dto);
        if (motif)
            throw new common_1.BadRequestException(motif);
        const dateReference = new Date(dto.dateReference.slice(0, 10));
        const exercice = await this.prisma.exercice.findFirst({
            where: { tenantId, dateDebut: dateReference },
            select: { id: true },
        });
        if (!exercice) {
            throw new common_1.BadRequestException(`La date ${dto.dateReference.slice(0, 10)} n'est le début d'aucun exercice du dossier · la provision se déclare ` +
                "telle qu'elle existe au début d'un exercice (fiche du compte 77, « existant au début de l'exercice »).");
        }
        const versions = await this.prisma.provisionChangeOuverture.findMany({
            where: { tenantId, compteProvision: dto.compteProvision },
            orderBy: { dateReference: 'asc' },
        });
        const montantConteste = dto.provisionModuleContestee === true
            ? (await this.etatsOuverture(tenantId, { id: exercice.id, dateDebut: dateReference }, [dto.compteProvision], dateReference)).etats.get(dto.compteProvision).bornes.module
            : null;
        const motifCorrection = dto.motif?.trim() || null;
        const memeDate = versions.findIndex((v) => v.dateReference.getTime() === dateReference.getTime());
        const precedenteIndex = versions.reduce((i, v, k) => (v.dateReference.getTime() < dateReference.getTime() ? k : i), -1);
        if (precedenteIndex >= 0 && !motifCorrection) {
            const precedente = versions[precedenteIndex];
            const utilisee = await this.reevaluationUtilisatrice(tenantId, precedente, versions[precedenteIndex + 1]);
            if (utilisee) {
                throw new common_1.BadRequestException(`La version précédente du ${dto.compteProvision} a servi à la réévaluation du ` +
                    `${utilisee.dateReevaluation.toISOString().slice(0, 10)} · celle-ci la corrige et porte son motif.`);
            }
        }
        const donnees = {
            montant: new client_1.Prisma.Decimal(Math.round(dto.montant * 100) / 100),
            source: dto.source.trim(),
            motif: motifCorrection,
            provisionModuleContestee: dto.provisionModuleContestee === true,
            motifContestation: dto.provisionModuleContestee === true ? dto.motifContestation.trim() : null,
            provisionModuleContesteeMontant: montantConteste === null ? null : new client_1.Prisma.Decimal(montantConteste),
        };
        if (memeDate >= 0) {
            const existante = versions[memeDate];
            const utilisatrice = await this.reevaluationUtilisatrice(tenantId, existante, versions[memeDate + 1]);
            if (utilisatrice) {
                throw new common_1.ConflictException(`La provision d'ouverture du compte ${dto.compteProvision} a servi à la réévaluation du ` +
                    `${utilisatrice.dateReevaluation.toISOString().slice(0, 10)} · elle ne se modifie plus. Déclarez une nouvelle ` +
                    "version au début d'un exercice postérieur, avec son motif.");
            }
            return this.prisma.provisionChangeOuverture.update({
                where: { id: existante.id },
                data: { ...donnees, modifiedBy: userId },
            });
        }
        const suivante = versions.find((v) => v.dateReference.getTime() > dateReference.getTime());
        const dejaPassee = await this.prisma.reevaluation.findFirst({
            where: {
                tenantId,
                annuleeLe: null,
                dateReevaluation: { gte: dateReference, ...(suivante ? { lt: suivante.dateReference } : {}) },
            },
            select: { dateReevaluation: true },
        });
        if (dejaPassee) {
            throw new common_1.ConflictException(`La réévaluation du ${dejaPassee.dateReevaluation.toISOString().slice(0, 10)} est déjà passée dans la période ` +
                `de cette version du ${dto.compteProvision} · la déclarer changerait la provision en vigueur d'un calcul passé. ` +
                "Déclarez-la au début d'un exercice qu'aucune réévaluation n'a encore touché.");
        }
        return this.prisma.provisionChangeOuverture.create({
            data: { tenantId, compteProvision: dto.compteProvision, dateReference, ...donnees, createdBy: userId },
        });
    }
    async retirerProvisionOuverture(tenantId, id) {
        return this.sousVerrouDuDossier(tenantId, 'RETRAIT', () => this.retirerSousVerrou(tenantId, id));
    }
    async retirerSousVerrou(tenantId, id) {
        const existante = await this.prisma.provisionChangeOuverture.findFirst({ where: { id, tenantId } });
        if (!existante)
            throw new common_1.NotFoundException('Déclaration introuvable pour ce dossier');
        const suivante = await this.prisma.provisionChangeOuverture.findFirst({
            where: { tenantId, compteProvision: existante.compteProvision, dateReference: { gt: existante.dateReference } },
            orderBy: { dateReference: 'asc' },
        });
        const utilisatrice = await this.reevaluationUtilisatrice(tenantId, existante, suivante ?? undefined);
        if (utilisatrice) {
            throw new common_1.ConflictException(`La provision d'ouverture du compte ${existante.compteProvision} a servi à la réévaluation du ` +
                `${utilisatrice.dateReevaluation.toISOString().slice(0, 10)} · elle ne se modifie plus.`);
        }
        await this.prisma.provisionChangeOuverture.delete({ where: { id: existante.id } });
        return { id: existante.id };
    }
    async ecartsDeDisponibilitesDe(tenantId, reeval) {
        const enregistres = (0, ecarts_disponibilites_1.ecartsDisponibilitesEnregistres)(reeval.ecartsDisponibilites);
        if (enregistres)
            return enregistres;
        const passeParCompte = passeSurLesDisponibilites(reeval);
        if (passeParCompte.size === 0)
            return [];
        const declares = (0, ecarts_disponibilites_1.ecartsDisponibilitesEnregistres)(reeval.ventilationDisponibilites);
        if (declares) {
            const devises = new Set(declares.map((d) => d.deviseId));
            return (0, ecarts_disponibilites_1.motifRefusVentilationDeclaree)(passeParCompte, declares, devises, 'déclarée') === null ? declares : null;
        }
        return this.relireLaLignePassee(tenantId, reeval, passeParCompte);
    }
    async relireLaLignePassee(tenantId, reeval, passeParCompte) {
        const sommes = await this.sommesDesDisponibilitesALaReevaluation(tenantId, reeval, [...passeParCompte.keys()]);
        const gardes = reeval.coursUtilises && typeof reeval.coursUtilises === 'object' && !Array.isArray(reeval.coursUtilises)
            ? reeval.coursUtilises
            : {};
        const coursDeLaTable = new Map();
        for (const liste of sommes.values()) {
            for (const s of liste) {
                if (typeof gardes[s.deviseId] === 'number' || coursDeLaTable.has(s.deviseId))
                    continue;
                coursDeLaTable.set(s.deviseId, await this.coursA(s.deviseId, reeval.dateReevaluation));
            }
        }
        const cours = (deviseId) => {
            const garde = gardes[deviseId];
            return typeof garde === 'number' ? garde : (coursDeLaTable.get(deviseId) ?? null);
        };
        const sortie = [];
        for (const [compteId, passe] of passeParCompte) {
            const ventile = (0, ecarts_disponibilites_1.ventilerEcartPasse)(compteId, passe, sommes.get(compteId) ?? [], cours);
            if (ventile === null)
                return null;
            sortie.push(...ventile);
        }
        return sortie;
    }
    async sommesDesDisponibilitesALaReevaluation(tenantId, reeval, comptes) {
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: reeval.exerciceId, tenantId },
            select: { dateDebut: true },
        });
        const ecriture = {
            tenantId,
            exerciceId: reeval.exerciceId,
            date: { lte: reeval.dateReevaluation },
            ...ecritures_de_situation_1.HORS_SITUATION,
            OR: [
                { createdAt: { lte: reeval.createdAt } },
                ...(exercice
                    ? [
                        {
                            date: exercice.dateDebut,
                            OR: [{ estANouveauProvisoire: true }, { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false }],
                        },
                    ]
                    : []),
            ],
        };
        const base = {
            compteId: { in: comptes },
            deviseId: { not: null },
            ecriture,
            OR: [{ lettre: null }, { lettrage: { soldeAt: { gt: reeval.createdAt } } }],
        };
        const credit = this.prisma.ligneEcriture.fields.credit;
        const [positifs, negatifs] = await Promise.all([
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId', 'deviseId'],
                where: { ...base, debit: { gte: credit } },
                _sum: { debit: true, credit: true, montantDevise: true },
            }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId', 'deviseId'],
                where: { ...base, debit: { lt: credit } },
                _sum: { debit: true, credit: true, montantDevise: true },
            }),
        ]);
        const nombre = (x) => (x === null || x === undefined ? 0 : Number(x));
        const parCompte = new Map();
        for (const [groupes, sens] of [
            [positifs, 1],
            [negatifs, -1],
        ]) {
            for (const g of groupes) {
                if (!g.deviseId)
                    continue;
                const duCompte = parCompte.get(g.compteId) ?? new Map();
                const s = duCompte.get(g.deviseId) ?? { deviseId: g.deviseId, devise: 0, francs: 0 };
                s.devise += sens * nombre(g._sum.montantDevise);
                s.francs += nombre(g._sum.debit) - nombre(g._sum.credit);
                duCompte.set(g.deviseId, s);
                parCompte.set(g.compteId, duCompte);
            }
        }
        return new Map([...parCompte].map(([compteId, m]) => [compteId, [...m.values()]]));
    }
    async declarerVentilationDisponibilites(tenantId, userId, reevaluationId, dto) {
        return this.sousVerrouDuDossier(tenantId, 'VENTILATION', () => this.declarerVentilationSousVerrou(tenantId, userId, reevaluationId, dto));
    }
    async declarerVentilationSousVerrou(tenantId, userId, reevaluationId, dto) {
        const reeval = await this.prisma.reevaluation.findFirst({
            where: { id: reevaluationId, tenantId },
            select: SELECTION_REEVALUATION_RELUE,
        });
        if (!reeval)
            throw new common_1.NotFoundException('Réévaluation introuvable pour ce dossier');
        if (reeval.annuleeLe) {
            throw new common_1.ConflictException("Cette réévaluation est annulée · ses écritures sont neutralisées, il n'y a rien à ventiler.");
        }
        if ((0, ecarts_disponibilites_1.ecartsDisponibilitesEnregistres)(reeval.ecartsDisponibilites)) {
            throw new common_1.ConflictException("Cette réévaluation a gardé l'écart de chaque devise · il n'y a rien à déclarer.");
        }
        const passeParCompte = passeSurLesDisponibilites(reeval);
        if (passeParCompte.size === 0) {
            throw new common_1.BadRequestException("Cette réévaluation n'a passé aucun écart sur une banque ou une caisse · il n'y a rien à ventiler.");
        }
        if (reeval.ventilationDisponibilites !== null) {
            const lectrice = await this.prisma.reevaluation.findFirst({
                where: { tenantId, annuleeLe: null, dateReevaluation: { gt: reeval.dateReevaluation } },
                orderBy: { dateReevaluation: 'asc' },
                select: { dateReevaluation: true },
            });
            if (lectrice) {
                throw new common_1.ConflictException(`La ventilation déclarée a servi à la réévaluation du ${lectrice.dateReevaluation.toISOString().slice(0, 10)} · ` +
                    "elle ne se modifie plus. Annulez d'abord cette réévaluation postérieure (Devises) si la ventilation est fausse.");
            }
        }
        const relue = await this.relireLaLignePassee(tenantId, reeval, passeParCompte);
        if (relue !== null) {
            throw new common_1.ConflictException("L'écart passé sur les disponibilités se relit devise par devise sans déclaration · il n'y a rien à déclarer.");
        }
        const devises = await this.prisma.devise.findMany({ where: { tenantId }, select: { id: true } });
        const ventilation = (dto.ventilation ?? []).map((v) => ({
            compteId: v.compteId,
            deviseId: v.deviseId,
            ecart: Math.round(Number(v.ecart) * 100) / 100,
        }));
        const sommes = await this.sommesDesDisponibilitesALaReevaluation(tenantId, reeval, [...passeParCompte.keys()]);
        const motif = (0, ecarts_disponibilites_1.motifRefusVentilationDeclaree)(passeParCompte, ventilation, new Set(devises.map((d) => d.id)), dto.source, sommes);
        if (motif)
            throw new common_1.BadRequestException(motif);
        await this.prisma.reevaluation.update({
            where: { id: reeval.id, tenantId },
            data: {
                ventilationDisponibilites: ventilation.filter((v) => Math.abs(v.ecart) >= 0.005),
                ventilationDisponibilitesSource: dto.source.trim(),
                ventilationDisponibilitesLe: new Date(),
                ventilationDisponibilitesPar: userId,
            },
        });
        return this.prisma.reevaluation.findFirstOrThrow({ where: { id: reeval.id, tenantId } });
    }
    async ventilationAExiger(tenantId, reeval) {
        if (reeval.annuleeLe || (0, ecarts_disponibilites_1.ecartsDisponibilitesEnregistres)(reeval.ecartsDisponibilites))
            return null;
        const passeParCompte = passeSurLesDisponibilites(reeval);
        if (passeParCompte.size === 0)
            return null;
        if ((await this.ecartsDeDisponibilitesDe(tenantId, reeval)) !== null)
            return null;
        const sommes = await this.sommesDesDisponibilitesALaReevaluation(tenantId, reeval, [...passeParCompte.keys()]);
        const devises = await this.prisma.devise.findMany({ where: { tenantId }, select: { id: true, code: true } });
        const code = new Map(devises.map((d) => [d.id, d.code]));
        const numeros = new Map((reeval.ecritureEcarts?.lignes ?? []).map((l) => [l.compteId, l.compte.numero]));
        return [...passeParCompte].map(([compteId, passe]) => ({
            compteId,
            numero: numeros.get(compteId) ?? '',
            passe: Math.round(passe * 100) / 100,
            devises: (sommes.get(compteId) ?? [])
                .filter((s) => Math.abs(s.devise) >= 0.005 || Math.abs(s.francs) >= 0.005)
                .map((s) => ({
                deviseId: s.deviseId,
                code: code.get(s.deviseId) ?? '',
                montantDevise: Math.round(s.devise * 100) / 100,
                francs: Math.round(s.francs * 100) / 100,
            })),
        }));
    }
    async ecartsReportesDesDisponibilites(tenantId, exercice, cles) {
        const parCle = new Map();
        const reserves = [];
        const jour = (d) => d.toISOString().slice(0, 10);
        let actives = new Set(cles);
        let courant = { id: exercice.id, dateDebut: exercice.dateDebut };
        const parcourus = new Set([exercice.id]);
        for (let pas = 0; pas < 50 && actives.size > 0; pas++) {
            const precedent = await this.prisma.exercice.findFirst({
                where: { tenantId, dateFin: { lt: courant.dateDebut } },
                orderBy: { dateFin: 'desc' },
                select: { id: true, dateDebut: true, dateFin: true, statut: true },
            });
            if (!precedent || precedent.id === courant.id || !(precedent.dateFin.getTime() < courant.dateDebut.getTime()))
                break;
            const aNouveau = await this.prisma.ligneEcriture.findMany({
                where: {
                    compteId: { in: [...new Set([...actives].map((k) => k.split('|')[0]))] },
                    deviseId: { not: null },
                    ecriture: {
                        tenantId,
                        exerciceId: courant.id,
                        date: courant.dateDebut,
                        estGenereeParCloture: true,
                        estSoldeDesComptesDeGestion: false,
                    },
                },
                select: { compteId: true, deviseId: true, ecriture: { select: { estANouveauProvisoire: true, createdAt: true } } },
            });
            const reportees = new Map();
            for (const l of aNouveau) {
                if (!l.deviseId || !l.ecriture)
                    continue;
                reportees.set(`${l.compteId}|${l.deviseId}`, { provisoire: l.ecriture.estANouveauProvisoire, creeeLe: l.ecriture.createdAt });
            }
            actives = new Set([...actives].filter((k) => reportees.has(k)));
            if (actives.size === 0)
                break;
            const reeval = await this.prisma.reevaluation.findFirst({
                where: { tenantId, exerciceId: precedent.id, annuleeLe: null },
                select: {
                    ...SELECTION_REEVALUATION_RELUE,
                    ecritureExtourne: { select: { exerciceId: true, lignes: { select: { compte: { select: { numero: true } } } } } },
                    contrePassationDeclaree: {
                        select: { exerciceId: true, lignes: { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } } },
                    },
                },
            });
            const inverseeParLAncienneContrePassation = (reeval?.ecritureExtourne !== null &&
                reeval?.ecritureExtourne !== undefined &&
                parcourus.has(reeval.ecritureExtourne.exerciceId) &&
                reeval.ecritureExtourne.lignes.some((l) => (0, ecarts_disponibilites_1.estDisponibilite)(l.compte.numero))) ||
                false;
            const declaree = reeval?.contrePassationDeclaree;
            const inverseesParLaDeclaration = reeval?.ecritureEcarts && declaree && parcourus.has(declaree.exerciceId)
                ? (0, contre_passation_manuelle_1.disponibilitesInversees)(reeval.ecritureEcarts.lignes.map((l) => ({
                    compteId: l.compteId,
                    compteNumero: l.compte.numero,
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                })), declaree.lignes.map((l) => ({ compteId: l.compteId, compteNumero: l.compte.numero, debit: Number(l.debit), credit: Number(l.credit) })), ecarts_disponibilites_1.estDisponibilite)
                : new Set();
            const toutesInversees = reeval !== null && reeval !== undefined && [...passeSurLesDisponibilites(reeval).keys()].every((c) => inverseesParLaDeclaration.has(c));
            if (reeval?.ecritureEcarts && !inverseeParLAncienneContrePassation && !toutesInversees) {
                const ecarts = (await this.ecartsDeDisponibilitesDe(tenantId, reeval))?.filter((e) => !inverseesParLaDeclaration.has(e.compteId)) ?? null;
                if (ecarts === null) {
                    const ouvert = precedent.statut !== client_1.StatutExercice.CLOTURE;
                    reserves.push(`L'écart passé sur les disponibilités par la réévaluation du ${jour(reeval.dateReevaluation)} ne se relit pas ` +
                        'devise par devise (banque ou caisse en plusieurs devises, ligne passée sans devise, cours qui ne la rend pas au ' +
                        'centime) · la banque ou la caisse partirait du coût historique et cet écart, réalisé (AUDCIF art. 57), serait ' +
                        `passé une seconde fois. Déclarez l'écart de chaque devise, avec sa source (Devises, exercice du ` +
                        `${jour(precedent.dateDebut)} au ${jour(precedent.dateFin)}, « Ventiler l'écart des disponibilités »)` +
                        (ouvert ? ", ou annulez cette réévaluation et repassez-la · elle gardera l'écart de chaque devise." : '.'));
                    break;
                }
                const ecritureEcarts = reeval.ecritureEcarts;
                for (const e of ecarts) {
                    const cle = `${e.compteId}|${e.deviseId}`;
                    const an = reportees.get(cle);
                    if (!actives.has(cle) || !an)
                        continue;
                    const dansLeReport = !an.provisoire ||
                        (ecritureEcarts.statut === client_1.StatutEcriture.VALIDEE &&
                            ecritureEcarts.valideeAt !== null &&
                            ecritureEcarts.valideeAt.getTime() <= an.creeeLe.getTime());
                    if (!dansLeReport) {
                        const validee = ecritureEcarts.statut === client_1.StatutEcriture.VALIDEE;
                        reserves.push(`L'à-nouveau provisoire du ${jour(courant.dateDebut)} a été passé avant que la réévaluation du ` +
                            `${jour(reeval.dateReevaluation)} n'entre au livre-journal · il ne porte pas l'écart de la banque ou de la ` +
                            'caisse. ' +
                            (validee
                                ? "Relancez l'à-nouveau provisoire, ou clôturez l'exercice précédent, avant de réévaluer."
                                : "Validez l'écriture des écarts, puis relancez l'à-nouveau provisoire ou clôturez l'exercice précédent, avant de réévaluer."));
                        continue;
                    }
                    parCle.set(cle, (parCle.get(cle) ?? 0) + e.ecart);
                }
            }
            courant = { id: precedent.id, dateDebut: precedent.dateDebut };
            parcourus.add(precedent.id);
        }
        return { parCle, reserves: [...new Set(reserves)] };
    }
    async referentielDuDossier(tenantId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
        if (!tenant)
            throw new common_1.NotFoundException('Dossier introuvable · son référentiel ne se lit pas, rien ne se réévalue.');
        return tenant.referentiel;
    }
    async compteParRacine(tenantId, racine) {
        const compte = await this.prisma.compte.findFirst({
            where: { tenantId, numero: { startsWith: racine }, typeCompte: 'DETAIL', estActif: true },
            orderBy: { numero: 'asc' },
        });
        if (!compte) {
            throw new common_1.BadRequestException(`Aucun compte ${racine} dans le plan de ce dossier. La réévaluation en a besoin ; créez-le avant de relancer.`);
        }
        return compte;
    }
    async journalGeneral(tenantId) {
        const journal = (await this.prisma.journal.findFirst({ where: { tenantId, code: 'OD' } })) ??
            (await this.prisma.journal.findFirst({ where: { tenantId, type: 'GENERAL' } }));
        if (!journal) {
            throw new common_1.BadRequestException("Aucun journal général (code OD) pour recevoir les écritures de réévaluation.");
        }
        return journal;
    }
};
exports.DevisesService = DevisesService;
exports.DevisesService = DevisesService = DevisesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], DevisesService);
//# sourceMappingURL=devises.service.js.map