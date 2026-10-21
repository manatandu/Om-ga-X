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
exports.PerimetreService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const exercice_requis_1 = require("../../common/exercice-requis");
const perimetre_consolidation_1 = require("./perimetre-consolidation");
const NOM_PRIS = (nom) => `« ${nom} » figure déjà au périmètre de cet exercice.`;
async function sousUniciteDuNom(nom, ecriture) {
    try {
        return await ecriture;
    }
    catch (e) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
            throw new common_1.BadRequestException(NOM_PRIS(nom));
        throw e;
    }
}
function fiscaliteEnNombres(f) {
    const n = (v) => (v == null ? null : Number(v));
    return {
        tauxImpotDiffere: n(f.tauxImpotDiffere),
        idaOuverture: n(f.idaOuverture),
        idaCloture: n(f.idaCloture),
        idpOuverture: n(f.idpOuverture),
        idpCloture: n(f.idpCloture),
        ecartConversionActifN1: n(f.ecartConversionActifN1),
        ecartConversionPassifN1: n(f.ecartConversionPassifN1),
        coursCloture: n(f.coursCloture),
        coursProduitsCharges: n(f.coursProduitsCharges),
        coursEntree: n(f.coursEntree),
        capitauxPropresHistoriques: n(f.capitauxPropresHistoriques),
    };
}
let PerimetreService = class PerimetreService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async exercice(tenantId, exerciceId) {
        (0, exercice_requis_1.exigerExercice)(exerciceId);
        const ex = await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        if (!ex)
            throw new common_1.NotFoundException('Exercice introuvable dans ce dossier.');
        return ex;
    }
    async charger(tenantId, exerciceId) {
        (0, exercice_requis_1.exigerExercice)(exerciceId);
        const [tenant, ex, entites, liens, faits] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { id: true, nom: true } }),
            this.exercice(tenantId, exerciceId),
            this.prisma.entitePerimetreConsolidation.findMany({ where: { tenantId, exerciceId }, orderBy: { nom: 'asc' } }),
            this.prisma.lienParticipationConsolidation.findMany({ where: { tenantId, exerciceId }, orderBy: { createdAt: 'asc' } }),
            this.prisma.faitsConsolidationExercice.findFirst({ where: { tenantId, exerciceId } }),
        ]);
        return { tenant, ex, entites, liens, faits };
    }
    versMoteur(tenant, dateFin, entites, liens) {
        return {
            entites: [
                { id: tenant.id, nom: tenant.nom, estConsolidante: true, dateCloture: dateFin },
                ...entites.map((e) => ({
                    id: e.id,
                    nom: e.nom,
                    estConsolidante: false,
                    designationMajoriteDeuxExercices: e.designationMajoriteDeuxExercices,
                    aucunAutreAssocieSuperieur: e.aucunAutreAssocieSuperieur,
                    controleContractuel: e.controleContractuel,
                    accordControleConjoint: e.accordControleConjoint,
                    influenceNotableDeclaree: e.influenceNotableDeclaree,
                    exclusion: e.motifExclusion
                        ? { motif: e.motifExclusion, justification: e.justificationExclusion ?? '' }
                        : null,
                    dateCloture: e.dateCloture,
                })),
            ],
            liens: liens.map((l) => ({
                detentriceId: l.detentriceId ?? tenant.id,
                detenueId: l.detenueId,
                pctDroitsVote: Number(l.pctDroitsVote),
                pctCapital: Number(l.pctCapital),
            })),
        };
    }
    jouer(entites, liens) {
        try {
            return (0, perimetre_consolidation_1.analyserPerimetre)(entites, liens);
        }
        catch (e) {
            throw new common_1.BadRequestException(e.message);
        }
    }
    verifierTotaux(liens, nomDe) {
        const parDetenue = new Map();
        for (const l of liens) {
            const t = parDetenue.get(l.detenueId) ?? { vote: 0, capital: 0 };
            t.vote += l.pctDroitsVote;
            t.capital += l.pctCapital;
            parDetenue.set(l.detenueId, t);
        }
        for (const [id, t] of parDetenue) {
            if (t.vote > 100.00001 || t.capital > 100.00001) {
                throw new common_1.BadRequestException(`Les participations saisies sur « ${nomDe(id)} » dépassent 100 % (${t.vote.toFixed(2)} % des droits de vote, ` +
                    `${t.capital.toFixed(2)} % du capital).`);
            }
        }
    }
    async etat(tenantId, exerciceId) {
        const { tenant, ex, entites, liens, faits } = await this.charger(tenantId, exerciceId);
        const moteur = this.versMoteur(tenant, ex.dateFin, entites, liens);
        const resultats = this.jouer(moteur.entites, moteur.liens);
        const obligation = (0, perimetre_consolidation_1.verdictObligation)(resultats, {
            sousControleEntiteOhadaConsolidante: faits?.sousControleEntiteOhadaConsolidante,
            siegesDansDeuxRegions: faits?.siegesDansDeuxRegions,
            appelPublicEpargne: faits?.appelPublicEpargne,
            demandeAssociesDixieme: faits?.demandeAssociesDixieme,
            chiffreAffairesN: faits?.chiffreAffairesN == null ? null : Number(faits.chiffreAffairesN),
            chiffreAffairesN1: faits?.chiffreAffairesN1 == null ? null : Number(faits.chiffreAffairesN1),
            seuilEquivalentFc: faits?.seuilEquivalentFc == null ? null : Number(faits.seuilEquivalentFc),
            sourceSeuil: faits?.sourceSeuil ?? null,
        });
        const reciproques = await this.prisma.operationReciproqueConsolidation.findMany({
            where: { tenantId, exerciceId },
            orderBy: { createdAt: 'asc' },
        });
        const resultatsInternes = await this.prisma.resultatInterneConsolidation.findMany({
            where: { tenantId, exerciceId },
            orderBy: { createdAt: 'asc' },
        });
        const ecartsEvaluation = await this.prisma.ecartEvaluationConsolidation.findMany({
            where: { tenantId, exerciceId },
            orderBy: { createdAt: 'asc' },
        });
        const provisionsChange = await this.prisma.provisionChangeConsolidation.findMany({
            where: { tenantId, exerciceId },
            orderBy: { createdAt: 'asc' },
        });
        return {
            provisionsChange: provisionsChange.map((p) => ({ ...p, cloture: Number(p.cloture), dotation: Number(p.dotation), reprise: Number(p.reprise) })),
            ecartsEvaluation: ecartsEvaluation.map((e) => ({ ...e, montant: Number(e.montant) })),
            consolidante: { id: tenant.id, nom: tenant.nom, dateCloture: ex.dateFin },
            resultatsInternes: resultatsInternes.map((o) => ({ ...o, margeOuverture: Number(o.margeOuverture), margeCloture: Number(o.margeCloture) })),
            reciproques: reciproques.map((o) => ({ ...o, montant: Number(o.montant) })),
            entites: entites.map((e) => ({ ...e, ...fiscaliteEnNombres(e) })),
            liens: liens.map((l) => ({ ...l, pctDroitsVote: Number(l.pctDroitsVote), pctCapital: Number(l.pctCapital) })),
            faits: faits
                ? {
                    ...faits,
                    chiffreAffairesN: faits.chiffreAffairesN == null ? null : Number(faits.chiffreAffairesN),
                    chiffreAffairesN1: faits.chiffreAffairesN1 == null ? null : Number(faits.chiffreAffairesN1),
                    seuilEquivalentFc: faits.seuilEquivalentFc == null ? null : Number(faits.seuilEquivalentFc),
                    ...fiscaliteEnNombres(faits),
                }
                : null,
            resultats,
            obligation,
            motifsExclusion: perimetre_consolidation_1.LIBELLE_MOTIF_EXCLUSION,
            seuilDispenseFcfa: perimetre_consolidation_1.SEUIL_DISPENSE_FCFA,
        };
    }
    verifierExclusion(motif, justification) {
        const aMotif = !!motif;
        const aJustif = !!justification && justification.trim().length > 0;
        if (aMotif !== aJustif) {
            throw new common_1.BadRequestException('Une exclusion du périmètre porte un motif de la liste de l’art. 96 ET sa justification, que les Notes annexes reprennent · ' +
                'l’un sans l’autre est refusé.');
        }
    }
    async nomLibre(tenantId, exerciceId, nom, sauf) {
        const n = nom.trim();
        if (!n)
            throw new common_1.BadRequestException('Une entité du périmètre se déclare avec son nom.');
        const existe = await this.prisma.entitePerimetreConsolidation.findFirst({
            where: { tenantId, exerciceId, nom: n, ...(sauf ? { id: { not: sauf } } : {}) },
            select: { id: true },
        });
        if (existe)
            throw new common_1.BadRequestException(NOM_PRIS(n));
        return n;
    }
    async creerEntite(tenantId, dto) {
        await this.exercice(tenantId, dto.exerciceId);
        this.verifierExclusion(dto.motifExclusion, dto.justificationExclusion);
        const nom = await this.nomLibre(tenantId, dto.exerciceId, dto.nom);
        return sousUniciteDuNom(nom, this.prisma.entitePerimetreConsolidation.create({
            data: {
                tenantId,
                exerciceId: dto.exerciceId,
                nom,
                designationMajoriteDeuxExercices: dto.designationMajoriteDeuxExercices ?? false,
                aucunAutreAssocieSuperieur: dto.aucunAutreAssocieSuperieur ?? false,
                controleContractuel: dto.controleContractuel ?? false,
                accordControleConjoint: dto.accordControleConjoint ?? false,
                influenceNotableDeclaree: dto.influenceNotableDeclaree ?? false,
                motifExclusion: dto.motifExclusion ?? null,
                justificationExclusion: dto.justificationExclusion?.trim() || null,
                dateCloture: dto.dateCloture ? new Date(dto.dateCloture) : null,
                secteurActivite: dto.secteurActivite?.trim() || null,
            },
        }));
    }
    async modifierEntite(tenantId, id, dto) {
        const actuelle = await this.prisma.entitePerimetreConsolidation.findFirst({ where: { id, tenantId } });
        if (!actuelle)
            throw new common_1.NotFoundException('Entité introuvable dans ce dossier.');
        const motif = dto.motifExclusion !== undefined ? dto.motifExclusion : actuelle.motifExclusion;
        const justif = dto.justificationExclusion !== undefined ? dto.justificationExclusion : actuelle.justificationExclusion;
        this.verifierExclusion(motif, justif);
        const nom = dto.nom == null ? undefined : await this.nomLibre(tenantId, actuelle.exerciceId, dto.nom, id);
        return sousUniciteDuNom(nom ?? actuelle.nom, this.prisma.entitePerimetreConsolidation.update({
            where: { id },
            data: {
                nom,
                designationMajoriteDeuxExercices: dto.designationMajoriteDeuxExercices,
                aucunAutreAssocieSuperieur: dto.aucunAutreAssocieSuperieur,
                controleContractuel: dto.controleContractuel,
                accordControleConjoint: dto.accordControleConjoint,
                influenceNotableDeclaree: dto.influenceNotableDeclaree,
                motifExclusion: motif ?? null,
                justificationExclusion: justif?.trim() || null,
                dateCloture: dto.dateCloture === undefined ? undefined : dto.dateCloture ? new Date(dto.dateCloture) : null,
                secteurActivite: dto.secteurActivite === undefined ? undefined : dto.secteurActivite?.trim() || null,
            },
        }));
    }
    async supprimerEntite(tenantId, id) {
        const e = await this.prisma.entitePerimetreConsolidation.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!e)
            throw new common_1.NotFoundException('Entité introuvable dans ce dossier.');
        await this.prisma.entitePerimetreConsolidation.delete({ where: { id } });
        return { supprime: true };
    }
    async ajouterLien(tenantId, dto) {
        const { tenant, ex, entites, liens } = await this.charger(tenantId, dto.exerciceId);
        const detentriceId = dto.detentriceId ?? null;
        const connues = new Set(entites.map((e) => e.id));
        if (!connues.has(dto.detenueId) || (detentriceId !== null && !connues.has(detentriceId))) {
            throw new common_1.BadRequestException('Les deux entités de la participation doivent figurer au périmètre de cet exercice.');
        }
        if (detentriceId === dto.detenueId) {
            throw new common_1.BadRequestException('Une entité ne se détient pas elle-même.');
        }
        if (liens.some((l) => l.detentriceId === detentriceId && l.detenueId === dto.detenueId)) {
            throw new common_1.BadRequestException('Cette participation est déjà saisie · modifiez-la plutôt que d’en ajouter une seconde.');
        }
        const candidat = {
            id: 'nouveau',
            detentriceId,
            detenueId: dto.detenueId,
            pctDroitsVote: dto.pctDroitsVote,
            pctCapital: dto.pctCapital,
        };
        const moteur = this.versMoteur(tenant, ex.dateFin, entites, [...liens, candidat]);
        const nomDe = (id) => moteur.entites.find((e) => e.id === id)?.nom ?? id;
        this.verifierTotaux(moteur.liens, nomDe);
        this.jouer(moteur.entites, moteur.liens);
        return this.prisma.lienParticipationConsolidation.create({
            data: {
                tenantId,
                exerciceId: dto.exerciceId,
                detentriceId,
                detenueId: dto.detenueId,
                pctDroitsVote: dto.pctDroitsVote,
                pctCapital: dto.pctCapital,
            },
        });
    }
    async modifierLien(tenantId, id, dto) {
        const actuel = await this.prisma.lienParticipationConsolidation.findFirst({ where: { id, tenantId } });
        if (!actuel)
            throw new common_1.NotFoundException('Participation introuvable dans ce dossier.');
        const { tenant, ex, entites, liens } = await this.charger(tenantId, actuel.exerciceId);
        const rejoues = liens.map((l) => l.id === id
            ? { ...l, pctDroitsVote: dto.pctDroitsVote ?? l.pctDroitsVote, pctCapital: dto.pctCapital ?? l.pctCapital }
            : l);
        const moteur = this.versMoteur(tenant, ex.dateFin, entites, rejoues);
        const nomDe = (x) => moteur.entites.find((e) => e.id === x)?.nom ?? x;
        this.verifierTotaux(moteur.liens, nomDe);
        this.jouer(moteur.entites, moteur.liens);
        return this.prisma.lienParticipationConsolidation.update({
            where: { id },
            data: { pctDroitsVote: dto.pctDroitsVote, pctCapital: dto.pctCapital },
        });
    }
    async supprimerLien(tenantId, id) {
        const l = await this.prisma.lienParticipationConsolidation.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!l)
            throw new common_1.NotFoundException('Participation introuvable dans ce dossier.');
        await this.prisma.lienParticipationConsolidation.delete({ where: { id } });
        return { supprime: true };
    }
    async enregistrerFaits(tenantId, dto) {
        await this.exercice(tenantId, dto.exerciceId);
        const existant = await this.prisma.faitsConsolidationExercice.findFirst({
            where: { tenantId, exerciceId: dto.exerciceId },
            select: { id: true, seuilEquivalentFc: true, sourceSeuil: true },
        });
        const seuil = dto.seuilEquivalentFc !== undefined ? dto.seuilEquivalentFc : existant?.seuilEquivalentFc;
        const source = dto.sourceSeuil !== undefined ? dto.sourceSeuil : existant?.sourceSeuil;
        if (seuil != null && !(source && source.trim())) {
            throw new common_1.BadRequestException('L’équivalent en francs congolais du seuil de 500 000 000 FCFA se déclare AVEC sa source (texte, cours et date) · ' +
                'aucune source lue ne le fixe (art. 95).');
        }
        const data = {
            sousControleEntiteOhadaConsolidante: dto.sousControleEntiteOhadaConsolidante,
            siegesDansDeuxRegions: dto.siegesDansDeuxRegions,
            appelPublicEpargne: dto.appelPublicEpargne,
            demandeAssociesDixieme: dto.demandeAssociesDixieme,
            entitesControleHorsOhada: dto.entitesControleHorsOhada === undefined ? undefined : dto.entitesControleHorsOhada?.trim() || null,
            chiffreAffairesN: dto.chiffreAffairesN,
            chiffreAffairesN1: dto.chiffreAffairesN1,
            seuilEquivalentFc: dto.seuilEquivalentFc,
            sourceSeuil: dto.sourceSeuil === undefined ? undefined : dto.sourceSeuil?.trim() || null,
        };
        return existant
            ? this.prisma.faitsConsolidationExercice.update({ where: { id: existant.id }, data })
            : this.prisma.faitsConsolidationExercice.create({ data: { tenantId, exerciceId: dto.exerciceId, ...data } });
    }
};
exports.PerimetreService = PerimetreService;
exports.PerimetreService = PerimetreService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PerimetreService);
//# sourceMappingURL=perimetre.service.js.map