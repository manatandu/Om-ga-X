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
var BalanceFonctionnelleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BalanceFonctionnelleService = void 0;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const PROFONDEUR_MAX = 20;
const SELECT_ECRITURE = {
    id: true,
    date: true,
    lignes: {
        select: {
            debit: true,
            credit: true,
            montantDevise: true,
            devise: { select: { code: true } },
            compte: { select: { id: true, numero: true, intitule: true } },
        },
    },
};
const MOUVEMENTS = { estGenereeParCloture: false };
const A_NOUVEAU = { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false };
let BalanceFonctionnelleService = BalanceFonctionnelleService_1 = class BalanceFonctionnelleService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    static coursApplicable(cours, date) {
        let retenu = null;
        for (const c of cours) {
            if (c.date.getTime() > date.getTime())
                continue;
            if (!retenu || c.date.getTime() > retenu.date.getTime())
                retenu = c;
        }
        return retenu?.cours ?? null;
    }
    static convertirLigne(ligne, monnaieFonctionnelle, coursDeLEcriture) {
        if (ligne.deviseCode === monnaieFonctionnelle && ligne.montantDevise !== null) {
            const montant = Math.abs(ligne.montantDevise);
            if (ligne.debit !== 0)
                return { debit: Math.sign(ligne.debit) * montant, credit: 0, exacte: true };
            return { debit: 0, credit: Math.sign(ligne.credit) * montant, exacte: true };
        }
        return {
            debit: ligne.debit / coursDeLEcriture,
            credit: ligne.credit / coursDeLEcriture,
            exacte: false,
        };
    }
    async balance(tenantId, exerciceId) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { devise: true, deviseFonctionnelle: true },
        });
        const monnaieTenue = tenant.devise ?? monnaie_de_tenue_1.MONNAIE_DE_TENUE;
        const fonctionnelle = tenant.deviseFonctionnelle;
        if (!fonctionnelle) {
            throw new common_1.BadRequestException("Aucune monnaie fonctionnelle n'est nommée pour ce dossier · renseignez-la dans les paramètres du " +
                'dossier. Elle ne déplace pas la tenue, qui reste en ' +
                `${monnaieTenue} : elle nomme la monnaie dans laquelle l'entité encaisse, dépense et rend compte à son ` +
                'bailleur.');
        }
        if (fonctionnelle === monnaieTenue) {
            throw new common_1.BadRequestException(`La monnaie fonctionnelle de ce dossier est déjà sa monnaie de tenue (${monnaieTenue}) · le second jeu ` +
                "n'aurait rien à convertir, et la balance légale suffit.");
        }
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        const devise = await this.prisma.devise.findFirst({
            where: { tenantId, code: fonctionnelle },
            include: { cours: { select: { date: true, cours: true }, orderBy: { date: 'asc' } } },
        });
        if (!devise) {
            throw new common_1.BadRequestException(`La devise ${fonctionnelle} n'existe pas au plan des devises de ce dossier · créez-la et alimentez ses ` +
                'cours avant de produire le second jeu.');
        }
        const cours = devise.cours.map((c) => ({ date: c.date, cours: Number(c.cours) }));
        const jeu = await this.jeuFonctionnel(tenantId, exercice, fonctionnelle, cours, 0);
        let debitTotal = 0;
        let creditTotal = 0;
        let ouvertureDebitTotal = 0;
        let ouvertureCreditTotal = 0;
        for (const v of jeu.parCompte.values()) {
            debitTotal += v.ouvertureDebit + v.debit;
            creditTotal += v.ouvertureCredit + v.credit;
            ouvertureDebitTotal += v.ouvertureDebit;
            ouvertureCreditTotal += v.ouvertureCredit;
        }
        const arrondir = (v) => Math.round(v * 100) / 100;
        return {
            monnaie: fonctionnelle,
            monnaieTenue,
            exercice: {
                dateDebut: exercice.dateDebut.toISOString().slice(0, 10),
                dateFin: exercice.dateFin.toISOString().slice(0, 10),
            },
            mention: BalanceFonctionnelleService_1.MENTION_SANS_VALEUR_LEGALE,
            lignes: [...jeu.parCompte.entries()]
                .map(([compteId, v]) => ({
                compteId,
                numero: v.numero,
                intitule: v.intitule,
                ouvertureDebit: arrondir(v.ouvertureDebit),
                ouvertureCredit: arrondir(v.ouvertureCredit),
                debit: arrondir(v.ouvertureDebit + v.debit),
                credit: arrondir(v.ouvertureCredit + v.credit),
                solde: arrondir(v.ouvertureDebit + v.debit - v.ouvertureCredit - v.credit),
            }))
                .sort((a, b) => a.numero.localeCompare(b.numero)),
            totaux: {
                debit: arrondir(debitTotal),
                credit: arrondir(creditTotal),
                ecartDeConversion: arrondir(debitTotal - creditTotal),
                dontOuverture: arrondir(ouvertureDebitTotal - ouvertureCreditTotal),
            },
            origine: {
                lignes: jeu.lignes,
                lignesExactes: jeu.lignesExactes,
                lignesConverties: jeu.lignes - jeu.lignesExactes,
                ecritures: jeu.ecritures,
                ouverture: jeu.ouverture,
            },
        };
    }
    async jeuFonctionnel(tenantId, exercice, fonctionnelle, cours, profondeur) {
        const bornes = { tenantId, exerciceId: exercice.id };
        const aUnANouveau = (await this.prisma.ligneEcriture.findFirst({
            where: { ecriture: { ...bornes, ...A_NOUVEAU } },
            select: { id: true },
        })) !== null;
        const parCompte = new Map();
        const compte = (id, numero, intitule) => {
            const c = parCompte.get(id) ?? { numero, intitule, ouvertureDebit: 0, ouvertureCredit: 0, debit: 0, credit: 0 };
            parCompte.set(id, c);
            return c;
        };
        const precedent = aUnANouveau && profondeur < PROFONDEUR_MAX
            ? await this.prisma.exercice.findFirst({
                where: { tenantId, dateFin: { lt: exercice.dateDebut } },
                orderBy: { dateFin: 'desc' },
                select: { id: true, dateDebut: true, dateFin: true },
            })
            : null;
        const coursParDate = new Map();
        const sansCours = new Set();
        let lignes = 0;
        let lignesExactes = 0;
        let ecritures = 0;
        const convertir = (ouverture) => (e) => {
            if (e.lignes.length === 0)
                return;
            ecritures += 1;
            lignes += e.lignes.length;
            const instant = e.date.getTime();
            if (!coursParDate.has(instant)) {
                coursParDate.set(instant, BalanceFonctionnelleService_1.coursApplicable(cours, e.date));
            }
            const coursDeLEcriture = coursParDate.get(instant) ?? null;
            if (coursDeLEcriture === null || coursDeLEcriture <= 0) {
                sansCours.add(e.date.toISOString().slice(0, 10));
                return;
            }
            for (const l of e.lignes) {
                const converti = BalanceFonctionnelleService_1.convertirLigne({
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                    deviseCode: l.devise?.code ?? null,
                    montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
                }, fonctionnelle, coursDeLEcriture);
                if (converti.exacte)
                    lignesExactes += 1;
                const c = compte(l.compte.id, l.compte.numero, l.compte.intitule);
                if (ouverture) {
                    c.ouvertureDebit += converti.debit;
                    c.ouvertureCredit += converti.credit;
                }
                else {
                    c.debit += converti.debit;
                    c.credit += converti.credit;
                }
            }
        };
        await this.lireEcritures({ ...bornes, ...MOUVEMENTS }, convertir(false));
        if (aUnANouveau && !precedent)
            await this.lireEcritures({ ...bornes, ...A_NOUVEAU }, convertir(true));
        if (sansCours.size > 0) {
            const distinctes = [...sansCours].sort();
            throw new common_1.BadRequestException(`Aucun cours ${fonctionnelle} connu à ${distinctes.length} date(s) d'écriture ` +
                `(${distinctes.slice(0, 10).join(', ')}${distinctes.length > 10 ? '…' : ''}) ` +
                `dans l'exercice du ${exercice.dateDebut.toISOString().slice(0, 10)} au ${exercice.dateFin.toISOString().slice(0, 10)}` +
                (profondeur > 0 ? ", exercice antérieur dont la clôture sert d'ouverture au second jeu" : '') +
                '. ' +
                "Le cours retenu est le dernier saisi à la date de l'écriture ou avant · l'état s'arrête ici plutôt que de prendre un cours postérieur ou celui de la clôture · une " +
                'balance convertie avec un cours inventé est plausible et fausse, et personne ne la vérifie.');
        }
        let ouverture = aUnANouveau ? 'CONVERTIE_A_SA_DATE' : 'AUCUNE';
        if (precedent) {
            ouverture = 'EXERCICE_PRECEDENT';
            const jeuPrecedent = await this.jeuFonctionnel(tenantId, precedent, fonctionnelle, cours, profondeur + 1);
            let resultat = 0;
            const reporter = (id, numero, intitule, solde) => {
                const c = compte(id, numero, intitule);
                if (solde >= 0)
                    c.ouvertureDebit += solde;
                else
                    c.ouvertureCredit += -solde;
            };
            for (const [id, v] of jeuPrecedent.parCompte) {
                const solde = v.ouvertureDebit + v.debit - v.ouvertureCredit - v.credit;
                if (['1', '2', '3', '4', '5'].includes(v.numero[0])) {
                    if (Math.abs(solde) > 0.000001)
                        reporter(id, v.numero, v.intitule, solde);
                }
                else
                    resultat += solde;
            }
            if (Math.abs(resultat) > 0.000001) {
                const ligneResultat = await this.prisma.ligneEcriture.findFirst({
                    where: {
                        ecriture: { tenantId, exerciceId: precedent.id, estSoldeDesComptesDeGestion: true },
                        compte: { numero: { startsWith: '13' } },
                    },
                    select: { compte: { select: { id: true, numero: true, intitule: true } } },
                });
                if (ligneResultat) {
                    reporter(ligneResultat.compte.id, ligneResultat.compte.numero, ligneResultat.compte.intitule, resultat);
                }
                else {
                    reporter(`resultat-${precedent.id}`, '13', "Résultat de l'exercice précédent, converti (exercice non clôturé)", resultat);
                }
            }
        }
        return { parCompte, lignes, lignesExactes, ecritures, ouverture };
    }
    lireEcritures({ tenantId, ...filtre }, traiter) {
        return (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ecriture.findMany({ where: { tenantId, ...filtre, ...ecritures_de_situation_1.HORS_SITUATION }, select: SELECT_ECRITURE, ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES) }), traiter, lecture_par_lots_1.LOT_ECRITURES);
    }
};
exports.BalanceFonctionnelleService = BalanceFonctionnelleService;
BalanceFonctionnelleService.MENTION_SANS_VALEUR_LEGALE = "Document de gestion · SANS VALEUR LÉGALE. La comptabilité de ce dossier est tenue et arrêtée en " +
    `${monnaie_de_tenue_1.MONNAIE_DE_TENUE} (loi n° 23/053, art. 141, 1° ; AUDCIF, art. 17, 1°), et c'est la balance en ` +
    `${monnaie_de_tenue_1.MONNAIE_DE_TENUE} qui fait foi. Cet état convertit chaque écriture de l'exercice au cours en vigueur à sa date (le dernier saisi à cette date ou avant, jamais un postérieur) pour ` +
    "rendre compte dans la monnaie où l'entité vit réellement, et reprend à l'ouverture la clôture du même jeu " +
    "pour l'exercice précédent. Aucun texte lu ne régit ce second jeu.";
exports.BalanceFonctionnelleService = BalanceFonctionnelleService = BalanceFonctionnelleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BalanceFonctionnelleService);
//# sourceMappingURL=balance-fonctionnelle.service.js.map