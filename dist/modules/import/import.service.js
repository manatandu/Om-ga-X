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
exports.ImportService = void 0;
exports.lireDeviseDeLaLigne = lireDeviseDeLaLigne;
exports.intituleDUnAutreReferentiel = intituleDUnAutreReferentiel;
exports.messageEcartReferentiel = messageEcartReferentiel;
exports.modeReportPourClasse = modeReportPourClasse;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const node_crypto_1 = require("node:crypto");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const numerotation_piece_1 = require("../journaux/numerotation-piece");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const client_1 = require("@prisma/client");
const compte_seed_1 = require("../comptes/compte-seed");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const import_dto_1 = require("./dto/import.dto");
const lecture_fichier_1 = require("./lecture-fichier");
const export_modifications_1 = require("../exports/modifications/export-modifications");
const classe_du_numero_1 = require("../comptes/classe-du-numero");
const ligne_en_devise_1 = require("../comptabilite/ligne-en-devise");
const report_a_nouveau_1 = require("../exercice/report-a-nouveau");
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const TAILLE_TRANCHE_ECRITURES = 1000;
const TAILLE_TRANCHE_LIGNES = 5000;
const DELAI_IMPORT_MS = 120_000;
function tranches(elements, taille) {
    const sortie = [];
    for (let i = 0; i < elements.length; i += taille)
        sortie.push(elements.slice(i, i + taille));
    return sortie;
}
const CHAMPS_DEVISE = [
    { cle: 'montantDevise', libelle: 'Montant en devise', obligatoire: false, indices: ['montant en devise', 'montant devise'] },
    { cle: 'devise', libelle: 'Devise (code ISO)', obligatoire: false, indices: ['devise', 'monnaie'] },
    { cle: 'cours', libelle: 'Cours appliqué', obligatoire: false, indices: ['cours', 'taux de change'] },
];
function lireDeviseDeLaLigne(codeDevise, texteMontantDevise, texteCours, numero, devisesParCode, montantFrancs) {
    const code = codeDevise.trim().toUpperCase();
    if (!code && !texteMontantDevise && !texteCours)
        return { enDevise: false };
    if (code === monnaie_de_tenue_1.MONNAIE_DE_TENUE) {
        const montant = texteMontantDevise ? (0, lecture_fichier_1.lireMontant)(texteMontantDevise) : null;
        const cours = texteCours ? (0, lecture_fichier_1.lireMontant)(texteCours) : null;
        const montantConcorde = !texteMontantDevise || (montant !== null && Math.abs(Math.abs(montant) - Math.abs(montantFrancs)) < 0.005);
        const coursConcorde = !texteCours || (cours !== null && Math.abs(cours - 1) < 1e-9);
        if (montantConcorde && coursConcorde)
            return { enDevise: false };
        return {
            enDevise: true,
            refus: `${monnaie_de_tenue_1.MONNAIE_DE_TENUE} est la monnaie de tenue, pas une devise · sur le compte ${numero}, son montant doit être celui ` +
                'de la ligne et son cours 1, ou laissez les colonnes vides.',
        };
    }
    const devise = devisesParCode.get(code);
    if (!devise) {
        return {
            enDevise: true,
            refus: code
                ? `Devise « ${code} » inconnue du dossier · créez-la dans la fenêtre Devises.`
                : `Montant en devise ou cours sans devise sur le compte ${numero}.`,
        };
    }
    const montantDevise = (0, lecture_fichier_1.lireMontant)(texteMontantDevise);
    const cours = texteCours ? (0, lecture_fichier_1.lireMontant)(texteCours) : null;
    if (montantDevise === null || (texteCours && cours === null)) {
        return { enDevise: true, refus: `Montant en devise ou cours illisible sur le compte ${numero}.` };
    }
    return { enDevise: true, refus: null, deviseId: devise.id, montantDevise, ...(cours !== null ? { coursApplique: cours } : {}) };
}
const CHAMPS = {
    [import_dto_1.TypeImport.PLAN_COMPTES]: [
        { cle: 'numero', libelle: 'Numéro de compte', obligatoire: true, indices: ['numero', 'compte', 'code'] },
        { cle: 'intitule', libelle: 'Intitulé', obligatoire: true, indices: ['intitule', 'libelle', 'designation', 'nom'] },
        { cle: 'type', libelle: 'Type (Détail / Total)', obligatoire: false, indices: ['type'] },
    ],
    [import_dto_1.TypeImport.BALANCE]: [
        { cle: 'numero', libelle: 'Numéro de compte', obligatoire: true, indices: ['numero', 'compte', 'code'] },
        { cle: 'intitule', libelle: 'Intitulé', obligatoire: false, indices: ['intitule', 'libelle', 'designation'] },
        { cle: 'debit', libelle: 'Solde débiteur', obligatoire: true, indices: ['debit', 'debiteur'] },
        { cle: 'credit', libelle: 'Solde créditeur', obligatoire: true, indices: ['credit', 'crediteur'] },
        ...CHAMPS_DEVISE,
    ],
    [import_dto_1.TypeImport.ECRITURES]: [
        { cle: 'date', libelle: 'Date', obligatoire: true, indices: ['date'] },
        { cle: 'journal', libelle: 'Code journal', obligatoire: false, indices: ['journal', 'jal'] },
        { cle: 'piece', libelle: 'N° de pièce', obligatoire: false, indices: ['piece', 'pièce'] },
        { cle: 'reference', libelle: 'Référence', obligatoire: false, indices: ['reference', 'facture'] },
        { cle: 'numero', libelle: 'Numéro de compte', obligatoire: true, indices: ['numero', 'compte', 'code'] },
        { cle: 'libelle', libelle: 'Libellé', obligatoire: true, indices: ['libelle', 'intitule', 'designation'] },
        { cle: 'debit', libelle: 'Débit', obligatoire: true, indices: ['debit'] },
        { cle: 'credit', libelle: 'Crédit', obligatoire: true, indices: ['credit'] },
        ...CHAMPS_DEVISE,
    ],
};
function normaliser(texte) {
    return texte
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '');
}
const INTITULES_OFFICIELS = {
    [client_1.Referentiel.SYCEBNL]: new Map(compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => [c.numero, c.intitule])),
    [client_1.Referentiel.SYSCOHADA]: new Map(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => [c.numero, c.intitule])),
};
function normaliserIntitule(texte) {
    return normaliser(texte.replace(/\[\d+\]/g, ' '));
}
function intituleDUnAutreReferentiel(numero, intitule, referentiel) {
    const lu = normaliserIntitule(intitule);
    if (!lu)
        return null;
    const autre = referentiel === client_1.Referentiel.SYSCOHADA ? client_1.Referentiel.SYCEBNL : client_1.Referentiel.SYSCOHADA;
    const intituleAutre = INTITULES_OFFICIELS[autre]?.get(numero);
    if (!intituleAutre || normaliserIntitule(intituleAutre) !== lu)
        return null;
    const intituleDuDossier = INTITULES_OFFICIELS[referentiel]?.get(numero) ?? null;
    if (intituleDuDossier && normaliserIntitule(intituleDuDossier) === lu)
        return null;
    return { autre, intituleAutre, intituleDuDossier };
}
function messageEcartReferentiel(numero, referentiel, ecart) {
    return (`Le compte ${numero} porte l'intitulé « ${ecart.intituleAutre} », qui est celui du plan ` +
        `${ecart.autre} et non du plan ${referentiel} de ce dossier` +
        (ecart.intituleDuDossier
            ? `, où ${numero} est « ${ecart.intituleDuDossier} ». `
            : `, qui ne connaît pas ce numéro. `) +
        "Le fichier semble venir de l'autre référentiel : chaque référentiel impose son propre plan " +
        'normalisé (AUDCIF art. 17, 7° · SYCEBNL art. 16, 1°) et « les opérations sont enregistrées ' +
        'dans les comptes dont les intitulés correspondent à leur nature » (AUDCIF art. 18). ' +
        "Vérifiez le référentiel du fichier avant de reprendre cette ligne.");
}
function modeReportPourClasse(classe, numero, referentiel) {
    const soldeesSurLeResultat = [client_1.ClasseCompte.CLASSE_6, client_1.ClasseCompte.CLASSE_7, client_1.ClasseCompte.CLASSE_8];
    if (soldeesSurLeResultat.includes(classe))
        return client_1.ModeReportANouveau.AUCUN;
    if ((0, report_a_nouveau_1.horsDuReport)(numero, referentiel))
        return client_1.ModeReportANouveau.AUCUN;
    return client_1.ModeReportANouveau.SOLDE;
}
let ImportService = class ImportService {
    constructor(prisma, ecritureService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
    }
    async analyser(dto) {
        const tableau = await (0, lecture_fichier_1.lireFichier)(dto.nomFichier, dto.contenuBase64);
        const champs = CHAMPS[dto.type];
        const normalisees = tableau.colonnes.map(normaliser);
        const mappingPropose = {};
        const dejaPrises = new Set();
        for (const champ of champs) {
            let choix = null;
            for (const indice of [...champ.indices].sort((a, b) => b.length - a.length)) {
                const i = normalisees.findIndex((c, idx) => !dejaPrises.has(idx) && c.includes(normaliser(indice)));
                if (i >= 0) {
                    choix = i;
                    break;
                }
            }
            if (choix !== null)
                dejaPrises.add(choix);
            mappingPropose[champ.cle] = choix !== null ? tableau.colonnes[choix] : null;
        }
        return {
            colonnes: tableau.colonnes,
            separateur: tableau.separateur ?? null,
            nombreLignes: tableau.lignes.length,
            apercu: tableau.lignes.slice(0, 8),
            champs: champs.map((c) => ({ cle: c.cle, libelle: c.libelle, obligatoire: c.obligatoire })),
            mappingPropose,
            manquants: champs
                .filter((c) => c.obligatoire && !mappingPropose[c.cle])
                .map((c) => c.libelle),
        };
    }
    indexDe(tableau, mapping, cle) {
        const nom = mapping[cle];
        if (!nom)
            return -1;
        return tableau.colonnes.indexOf(nom);
    }
    valeur(ligne, index) {
        return index >= 0 ? (ligne[index] ?? '').trim() : '';
    }
    classeDe(numero) {
        return (0, classe_du_numero_1.classeDuNumero)(numero);
    }
    async executer(tenantId, createdBy, dto) {
        const tableau = await (0, lecture_fichier_1.lireFichier)(dto.nomFichier, dto.contenuBase64, dto.separateur);
        const champs = CHAMPS[dto.type];
        for (const champ of champs) {
            if (champ.obligatoire && !dto.mapping[champ.cle]) {
                throw new common_1.BadRequestException(`La colonne « ${champ.libelle} » n'est pas renseignée dans la correspondance.`);
            }
        }
        for (const [cle, colonne] of Object.entries(dto.mapping)) {
            if (colonne && !tableau.colonnes.includes(colonne)) {
                throw new common_1.BadRequestException(`La colonne « ${colonne} » (${cle}) est absente du fichier.`);
            }
        }
        switch (dto.type) {
            case import_dto_1.TypeImport.PLAN_COMPTES:
                return this.importerPlanComptes(tenantId, tableau, dto);
            case import_dto_1.TypeImport.BALANCE:
                return this.importerBalance(tenantId, createdBy, tableau, dto);
            case import_dto_1.TypeImport.ECRITURES:
                return this.importerEcritures(tenantId, createdBy, tableau, dto);
        }
    }
    async importerPlanComptes(tenantId, tableau, dto) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant)
            throw new common_1.BadRequestException('Dossier introuvable');
        const iNumero = this.indexDe(tableau, dto.mapping, 'numero');
        const iIntitule = this.indexDe(tableau, dto.mapping, 'intitule');
        const iType = this.indexDe(tableau, dto.mapping, 'type');
        const existants = new Set((await this.prisma.compte.findMany({ where: { tenantId }, select: { numero: true } })).map((c) => c.numero));
        const anomalies = [];
        const aCreer = [];
        let reconnus = 0;
        tableau.lignes.forEach((ligne, i) => {
            const numeroLigne = i + 2;
            const numero = this.valeur(ligne, iNumero).replace(/\s/g, '');
            const intitule = this.valeur(ligne, iIntitule);
            if (!numero && !intitule)
                return;
            if (!/^\d{1,13}$/.test(numero)) {
                anomalies.push({ ligne: numeroLigne, message: `Numéro de compte invalide : « ${numero} »` });
                return;
            }
            if (numero.length > tenant.longueurCompte) {
                anomalies.push({
                    ligne: numeroLigne,
                    message: `Le compte ${numero} dépasse la longueur du dossier (${tenant.longueurCompte} chiffres).`,
                });
                return;
            }
            if (!intitule) {
                anomalies.push({ ligne: numeroLigne, message: `Le compte ${numero} n'a pas d'intitulé.` });
                return;
            }
            const classe = this.classeDe(numero);
            if (!classe) {
                anomalies.push({
                    ligne: numeroLigne,
                    message: `Le compte ${numero} ne commence pas par un chiffre de classe (1 à 9).`,
                });
                return;
            }
            const ecart = intituleDUnAutreReferentiel(numero, intitule, tenant.referentiel);
            if (ecart) {
                anomalies.push({ ligne: numeroLigne, message: messageEcartReferentiel(numero, tenant.referentiel, ecart) });
                return;
            }
            if (existants.has(numero) || aCreer.some((c) => c.numero === numero)) {
                reconnus++;
                return;
            }
            const typeBrut = normaliser(this.valeur(ligne, iType));
            const typeCompte = typeBrut.startsWith('tot') ? client_1.TypeCompteDetailTotal.TOTAL : client_1.TypeCompteDetailTotal.DETAIL;
            aCreer.push({
                tenantId,
                numero,
                intitule,
                classe,
                typeCompte,
                modeReportANouveau: modeReportPourClasse(classe, numero, tenant.referentiel),
            });
        });
        if (!dto.simulation && aCreer.length > 0) {
            await this.prisma.compte.createMany({ data: aCreer, skipDuplicates: true });
        }
        return {
            type: dto.type,
            simulation: !!dto.simulation,
            lignesLues: tableau.lignes.length,
            comptesCrees: aCreer.length,
            comptesReconnus: reconnus,
            ecrituresCreees: 0,
            lignesEcritureCreees: 0,
            totalDebit: 0,
            totalCredit: 0,
            anomalies,
        };
    }
    async importerBalance(tenantId, createdBy, tableau, dto) {
        const { exercice, journal, comptes, tenant } = await this.contexte(tenantId, dto);
        const dateReprise = dto.dateOperation ? new Date(dto.dateOperation) : exercice.dateDebut;
        const horsExercice = (0, ecriture_service_1.motifDateHorsExercice)(dateReprise, exercice);
        if (horsExercice)
            throw new common_1.BadRequestException(horsExercice);
        const iNumero = this.indexDe(tableau, dto.mapping, 'numero');
        const iIntitule = this.indexDe(tableau, dto.mapping, 'intitule');
        const iDebit = this.indexDe(tableau, dto.mapping, 'debit');
        const iCredit = this.indexDe(tableau, dto.mapping, 'credit');
        const iDevise = this.indexDe(tableau, dto.mapping, 'devise');
        const iMontantDevise = this.indexDe(tableau, dto.mapping, 'montantDevise');
        const iCours = this.indexDe(tableau, dto.mapping, 'cours');
        const devisesDuDossier = iDevise >= 0 || iMontantDevise >= 0 || iCours >= 0
            ? await this.prisma.devise.findMany({ where: { tenantId }, select: { id: true, code: true } })
            : [];
        const devisesParCode = new Map(devisesDuDossier.map((d) => [d.code.toUpperCase(), d]));
        const devisesParId = new Map(devisesDuDossier.map((d) => [d.id, d]));
        const bilanDOuverture = dto.bilanDOuverture !== false;
        const anomalies = [];
        const comptesParNumero = new Map(comptes.map((c) => [c.numero, c]));
        const comptesACreer = [];
        const lignes = [];
        tableau.lignes.forEach((ligne, i) => {
            const numeroLigne = i + 2;
            const numero = this.valeur(ligne, iNumero).replace(/\s/g, '');
            if (!numero)
                return;
            const debit = (0, lecture_fichier_1.lireMontant)(this.valeur(ligne, iDebit));
            const credit = (0, lecture_fichier_1.lireMontant)(this.valeur(ligne, iCredit));
            if (debit === null || credit === null) {
                anomalies.push({ ligne: numeroLigne, message: `Montant illisible sur le compte ${numero}.` });
                return;
            }
            if (Math.abs(debit) < 0.005 && Math.abs(credit) < 0.005)
                return;
            const enDevise = {};
            const lue = lireDeviseDeLaLigne(this.valeur(ligne, iDevise), this.valeur(ligne, iMontantDevise), this.valeur(ligne, iCours), numero, devisesParCode, Math.abs((debit ?? 0) - (credit ?? 0)));
            if (lue.enDevise) {
                if (lue.refus !== null) {
                    anomalies.push({ ligne: numeroLigne, message: lue.refus });
                    return;
                }
                const motif = (0, ligne_en_devise_1.motifRefusLigneEnDevise)({ debit, credit, deviseId: lue.deviseId, montantDevise: lue.montantDevise, coursApplique: lue.coursApplique ?? null }, devisesParId.get(lue.deviseId));
                if (motif) {
                    anomalies.push({ ligne: numeroLigne, message: `Compte ${numero} · ${motif}` });
                    return;
                }
                enDevise.deviseId = lue.deviseId;
                enDevise.montantDevise = lue.montantDevise;
                if (lue.coursApplique !== undefined)
                    enDevise.coursApplique = lue.coursApplique;
            }
            const ecartReferentiel = intituleDUnAutreReferentiel(numero, this.valeur(ligne, iIntitule), tenant.referentiel);
            if (ecartReferentiel) {
                anomalies.push({
                    ligne: numeroLigne,
                    message: messageEcartReferentiel(numero, tenant.referentiel, ecartReferentiel),
                });
                return;
            }
            const compte = comptesParNumero.get(numero);
            if (!compte) {
                if (!dto.creerComptesManquants) {
                    anomalies.push({
                        ligne: numeroLigne,
                        message: `Le compte ${numero} n'existe pas dans le plan du dossier.`,
                    });
                    return;
                }
                const classe = this.classeDe(numero);
                if (!classe || numero.length > tenant.longueurCompte) {
                    anomalies.push({ ligne: numeroLigne, message: `Le compte ${numero} ne peut pas être créé.` });
                    return;
                }
                comptesACreer.push({
                    tenantId,
                    numero,
                    intitule: this.valeur(ligne, iIntitule) || `Compte ${numero}`,
                    classe,
                    modeReportANouveau: modeReportPourClasse(classe, numero, tenant.referentiel),
                });
            }
            else if (compte.typeCompte === client_1.TypeCompteDetailTotal.TOTAL) {
                anomalies.push({
                    ligne: numeroLigne,
                    message: `Le compte ${numero} est un compte Total : sa ligne de totalisation est ignorée.`,
                });
                return;
            }
            if (bilanDOuverture && /^[678]/.test(numero)) {
                anomalies.push({
                    ligne: numeroLigne,
                    message: `Le compte ${numero} est un compte de gestion : il n'a pas sa place dans un bilan d'ouverture. ` +
                        'Les classes 6, 7 et 8 ont été soldées sur le compte 13 à la clôture précédente ' +
                        "(AUDCIF art. 34 · SYCEBNL art. 16, 4° : le bilan d'ouverture correspond au bilan de clôture). " +
                        "S'il s'agit d'une reprise en cours d'exercice, décochez « Bilan d'ouverture ».",
                });
                return;
            }
            lignes.push({ numero, debit, credit, ...enDevise });
        });
        const totalDebit = lignes.reduce((s, l) => s + l.debit, 0);
        const totalCredit = lignes.reduce((s, l) => s + l.credit, 0);
        if (lignes.length > 0 && Math.abs(totalDebit - totalCredit) > 0.005) {
            anomalies.push({
                ligne: 0,
                message: `La balance est déséquilibrée de ${(totalDebit - totalCredit).toFixed(2)} ` +
                    `(débit ${totalDebit.toFixed(2)}, crédit ${totalCredit.toFixed(2)}). ` +
                    "Aucune écriture d'à-nouveau n'a été créée : une reprise fausse contaminerait tous les états.",
            });
        }
        const peutEcrire = !dto.simulation && lignes.length > 0 && Math.abs(totalDebit - totalCredit) <= 0.005;
        let ecrituresCreees = 0;
        if (peutEcrire) {
            const date = dateReprise;
            await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                if (comptesACreer.length > 0) {
                    await tx.compte.createMany({ data: comptesACreer, skipDuplicates: true });
                }
                const tous = await tx.compte.findMany({ where: { tenantId }, select: { id: true, numero: true } });
                const parNumero = new Map(tous.map((c) => [c.numero, c.id]));
                await this.ecritureService.controlesDEntree(tenantId, {
                    exerciceId: exercice.id,
                    journalId: journal.id,
                    date,
                    lignes: lignes.map((l) => ({
                        compteId: parNumero.get(l.numero),
                        debit: l.debit,
                        credit: l.credit,
                        deviseId: l.deviseId,
                        montantDevise: l.montantDevise,
                        coursApplique: l.coursApplique,
                    })),
                    exigerVentilationObligatoire: false,
                }, tx);
                const numeroPiece = await (0, numerotation_piece_1.prochainNumeroPiece)(tx, tenantId, journal, exercice.id, date);
                await tx.ecriture.create({
                    data: {
                        tenantId,
                        exerciceId: exercice.id,
                        journalId: journal.id,
                        numeroPiece,
                        date,
                        libelle: bilanDOuverture
                            ? `Bilan d'ouverture · ${dto.nomFichier}`
                            : `Reprise de balance · ${dto.nomFichier}`,
                        reference: 'IMPORT',
                        createdBy,
                        estGenereeParCloture: bilanDOuverture,
                        lignes: {
                            createMany: {
                                data: lignes.map((l) => ({
                                    compteId: parNumero.get(l.numero),
                                    debit: l.debit,
                                    credit: l.credit,
                                    deviseId: l.deviseId,
                                    montantDevise: l.montantDevise,
                                    coursApplique: (0, ligne_en_devise_1.coursDeLaLigne)(l),
                                })),
                            },
                        },
                    },
                });
                ecrituresCreees = 1;
            }, { maxWait: 10_000, timeout: DELAI_IMPORT_MS });
        }
        return {
            type: dto.type,
            simulation: !!dto.simulation,
            lignesLues: tableau.lignes.length,
            comptesCrees: peutEcrire ? comptesACreer.length : 0,
            comptesReconnus: lignes.length - comptesACreer.length,
            ecrituresCreees,
            lignesEcritureCreees: peutEcrire ? lignes.length : 0,
            totalDebit,
            totalCredit,
            anomalies,
        };
    }
    async importerEcritures(tenantId, createdBy, tableau, dto) {
        const nonRelu = (0, export_modifications_1.motifEnvoiNonRelu)(tableau.colonnes, tableau.lignes, tableau.lignesSupprimees ?? 0);
        if (nonRelu)
            throw new common_1.BadRequestException(nonRelu);
        const { exercice, journal, comptes, journaux } = await this.contexte(tenantId, dto);
        const iDate = this.indexDe(tableau, dto.mapping, 'date');
        const iJournal = this.indexDe(tableau, dto.mapping, 'journal');
        const iPiece = this.indexDe(tableau, dto.mapping, 'piece');
        const iReference = this.indexDe(tableau, dto.mapping, 'reference');
        const iNumero = this.indexDe(tableau, dto.mapping, 'numero');
        const iLibelle = this.indexDe(tableau, dto.mapping, 'libelle');
        const iDebit = this.indexDe(tableau, dto.mapping, 'debit');
        const iCredit = this.indexDe(tableau, dto.mapping, 'credit');
        const iDevise = this.indexDe(tableau, dto.mapping, 'devise');
        const iMontantDevise = this.indexDe(tableau, dto.mapping, 'montantDevise');
        const iCours = this.indexDe(tableau, dto.mapping, 'cours');
        const comptesParNumero = new Map(comptes.map((c) => [c.numero, c]));
        const journauxParCode = new Map(journaux.map((j) => [j.code.toUpperCase(), j]));
        const journauxParId = new Map(journaux.map((j) => [j.id, j]));
        const devisesParCode = iDevise >= 0
            ? new Map((await this.prisma.devise.findMany({ where: { tenantId }, select: { id: true, code: true } })).map((d) => [
                d.code.toUpperCase(),
                d,
            ]))
            : new Map();
        const anomalies = [];
        const pieces = new Map();
        tableau.lignes.forEach((ligne, i) => {
            const numeroLigne = i + 2;
            const numero = this.valeur(ligne, iNumero).replace(/\s/g, '');
            if (!numero)
                return;
            const date = (0, lecture_fichier_1.lireDate)(this.valeur(ligne, iDate));
            if (!date) {
                anomalies.push({ ligne: numeroLigne, message: `Date illisible : « ${this.valeur(ligne, iDate)} »` });
                return;
            }
            if (date < exercice.dateDebut || date > exercice.dateFin) {
                anomalies.push({
                    ligne: numeroLigne,
                    message: `La date ${date.toISOString().slice(0, 10)} sort de l'exercice sélectionné.`,
                });
                return;
            }
            const codeJournal = this.valeur(ligne, iJournal).toUpperCase();
            const jal = codeJournal ? journauxParCode.get(codeJournal) : journal;
            if (!jal) {
                anomalies.push({ ligne: numeroLigne, message: `Journal « ${codeJournal} » inconnu du dossier.` });
                return;
            }
            const compte = comptesParNumero.get(numero);
            if (!compte) {
                anomalies.push({ ligne: numeroLigne, message: `Le compte ${numero} n'existe pas dans le plan du dossier.` });
                return;
            }
            if (compte.typeCompte === client_1.TypeCompteDetailTotal.TOTAL) {
                anomalies.push({ ligne: numeroLigne, message: `Le compte ${numero} est un compte Total : non mouvementable.` });
                return;
            }
            const debit = (0, lecture_fichier_1.lireMontant)(this.valeur(ligne, iDebit));
            const credit = (0, lecture_fichier_1.lireMontant)(this.valeur(ligne, iCredit));
            if (debit === null || credit === null) {
                anomalies.push({ ligne: numeroLigne, message: `Montant illisible sur le compte ${numero}.` });
                return;
            }
            if (Math.abs(debit) < 0.005 && Math.abs(credit) < 0.005)
                return;
            const enDevise = {};
            const lue = lireDeviseDeLaLigne(this.valeur(ligne, iDevise), this.valeur(ligne, iMontantDevise), this.valeur(ligne, iCours), numero, devisesParCode, Math.abs((debit ?? 0) - (credit ?? 0)));
            if (lue.enDevise) {
                if (lue.refus !== null) {
                    anomalies.push({ ligne: numeroLigne, message: lue.refus });
                    return;
                }
                enDevise.deviseId = lue.deviseId;
                enDevise.montantDevise = lue.montantDevise;
                if (lue.coursApplique !== undefined)
                    enDevise.coursApplique = lue.coursApplique;
            }
            const piece = this.valeur(ligne, iPiece);
            const libelle = this.valeur(ligne, iLibelle);
            const cle = `${date.toISOString().slice(0, 10)}|${jal.id}|${piece}`;
            const existante = pieces.get(cle);
            if (existante) {
                existante.lignes.push({ compteId: compte.id, libelle, debit, credit, ...enDevise });
            }
            else {
                pieces.set(cle, {
                    cle,
                    date,
                    journalId: jal.id,
                    reference: this.valeur(ligne, iReference) || null,
                    libelle: libelle || `Import ${dto.nomFichier}`,
                    lignes: [{ compteId: compte.id, libelle, debit, credit, ...enDevise }],
                    premiereLigne: numeroLigne,
                });
            }
        });
        const memoire = new Map();
        const valides = [];
        for (const piece of pieces.values()) {
            const d = piece.lignes.reduce((s, l) => s + l.debit, 0);
            const c = piece.lignes.reduce((s, l) => s + l.credit, 0);
            if (piece.lignes.length < 2 || Math.abs(d - c) > 0.005) {
                anomalies.push({
                    ligne: piece.premiereLigne,
                    message: `Pièce déséquilibrée ou incomplète (débit ${d.toFixed(2)}, crédit ${c.toFixed(2)}, ` +
                        `${piece.lignes.length} ligne(s)) : elle n'a pas été créée.`,
                });
                continue;
            }
            try {
                await this.ecritureService.controlesDEntree(tenantId, {
                    exerciceId: exercice.id,
                    journalId: piece.journalId,
                    date: piece.date,
                    lignes: piece.lignes,
                    exigerVentilationObligatoire: false,
                }, undefined, memoire);
            }
            catch (e) {
                anomalies.push({
                    ligne: piece.premiereLigne,
                    message: `${e instanceof Error ? e.message : String(e)} · la pièce n'a pas été créée.`,
                });
                continue;
            }
            valides.push(piece);
        }
        let ecrituresCreees = 0;
        let lignesCreees = 0;
        if (!dto.simulation && valides.length > 0) {
            await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const numeroter = (0, numerotation_piece_1.numeroteurDeLot)(tx, tenantId, exercice.id);
                const pieces = [];
                for (const piece of valides) {
                    const numeroPiece = await numeroter(journauxParId.get(piece.journalId), piece.date);
                    pieces.push({ ...piece, id: (0, node_crypto_1.randomUUID)(), numeroPiece });
                }
                for (const lot of tranches(pieces, TAILLE_TRANCHE_ECRITURES)) {
                    await tx.ecriture.createMany({
                        data: lot.map((p) => ({
                            id: p.id,
                            tenantId,
                            exerciceId: exercice.id,
                            journalId: p.journalId,
                            numeroPiece: p.numeroPiece,
                            date: p.date,
                            libelle: p.libelle,
                            reference: p.reference,
                            createdBy,
                        })),
                    });
                }
                const lignes = pieces.flatMap((p) => p.lignes.map((l) => ({
                    ecritureId: p.id,
                    compteId: l.compteId,
                    libelle: l.libelle || undefined,
                    debit: l.debit,
                    credit: l.credit,
                    deviseId: l.deviseId,
                    montantDevise: l.montantDevise,
                    coursApplique: (0, ligne_en_devise_1.coursDeLaLigne)(l),
                })));
                for (const lot of tranches(lignes, TAILLE_TRANCHE_LIGNES)) {
                    await tx.ligneEcriture.createMany({ data: lot });
                }
                ecrituresCreees = pieces.length;
                lignesCreees = lignes.length;
            }, { maxWait: 10_000, timeout: DELAI_IMPORT_MS });
        }
        return {
            type: dto.type,
            simulation: !!dto.simulation,
            lignesLues: tableau.lignes.length,
            comptesCrees: 0,
            comptesReconnus: comptesParNumero.size,
            ecrituresCreees: dto.simulation ? valides.length : ecrituresCreees,
            lignesEcritureCreees: dto.simulation
                ? valides.reduce((s, p) => s + p.lignes.length, 0)
                : lignesCreees,
            totalDebit: valides.reduce((s, p) => s + p.lignes.reduce((t, l) => t + l.debit, 0), 0),
            totalCredit: valides.reduce((s, p) => s + p.lignes.reduce((t, l) => t + l.credit, 0), 0),
            anomalies,
        };
    }
    async contexte(tenantId, dto) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant)
            throw new common_1.BadRequestException('Dossier introuvable');
        const exercice = dto.exerciceId
            ? await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } })
            : await this.prisma.exercice.findFirst({
                where: { tenantId, statut: client_1.StatutExercice.OUVERT },
                orderBy: { dateDebut: 'desc' },
            });
        if (!exercice)
            throw new common_1.BadRequestException('Aucun exercice ouvert pour recevoir cet import.');
        if (exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("L'exercice sélectionné est clôturé.");
        }
        const journaux = await this.prisma.journal.findMany({ where: { tenantId } });
        const journal = dto.journalId
            ? journaux.find((j) => j.id === dto.journalId)
            : (journaux.find((j) => j.code === 'OD') ?? journaux.find((j) => j.type === 'GENERAL'));
        if (!journal) {
            throw new common_1.BadRequestException("Aucun journal d'accueil : indiquez le journal, ou créez un journal général (code OD).");
        }
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId },
            select: { id: true, numero: true, typeCompte: true },
        });
        return { tenant, exercice, journal, journaux, comptes };
    }
};
exports.ImportService = ImportService;
exports.ImportService = ImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], ImportService);
//# sourceMappingURL=import.service.js.map