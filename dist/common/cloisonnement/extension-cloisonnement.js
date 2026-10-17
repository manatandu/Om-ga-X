"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filtreBorne = filtreBorne;
exports.garderCloisonnement = garderCloisonnement;
exports.extensionCloisonnement = extensionCloisonnement;
const client_1 = require("@prisma/client");
const contexte_audit_1 = require("../audit/contexte-audit");
const modeles_cloisonnes_1 = require("./modeles-cloisonnes");
const contexte_cloisonnement_1 = require("./contexte-cloisonnement");
const LECTURES_UNITAIRES = ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow'];
const ECRITURES_UNITAIRES = ['update', 'delete', 'upsert'];
const COLLECTIONS = ['findMany', 'updateMany', 'deleteMany', 'count', 'aggregate', 'groupBy'];
const CREATIONS = ['create', 'createMany', 'createManyAndReturn'];
function dossierCree(data) {
    if (!data || typeof data !== 'object')
        return undefined;
    const d = data;
    if (typeof d.tenantId === 'string')
        return d.tenantId;
    const connecte = d.tenant?.connect?.id;
    return typeof connecte === 'string' ? connecte : undefined;
}
const FORME_ILLISIBLE = Symbol('forme de dossier illisible');
function dossiersVises(data) {
    if (!data || typeof data !== 'object')
        return [];
    const d = data;
    const cibles = [];
    if (d.tenantId !== undefined) {
        const v = d.tenantId;
        if (typeof v === 'string' || v === null)
            cibles.push(v);
        else if (v &&
            typeof v === 'object' &&
            !Array.isArray(v) &&
            Object.keys(v).length === 1 &&
            (typeof v.set === 'string' || v.set === null)) {
            cibles.push(v.set);
        }
        else
            cibles.push(FORME_ILLISIBLE);
    }
    if (d.tenant !== undefined) {
        const r = d.tenant;
        if (!r || typeof r !== 'object' || Array.isArray(r))
            return [...cibles, FORME_ILLISIBLE];
        for (const [cle, valeur] of Object.entries(r)) {
            if (cle === 'update')
                continue;
            if (cle === 'connect') {
                const c = valeur;
                const lisible = !!c && typeof c === 'object' && typeof c.id === 'string';
                cibles.push(lisible ? c.id : FORME_ILLISIBLE);
                continue;
            }
            cibles.push(FORME_ILLISIBLE);
        }
    }
    return cibles;
}
const MISES_A_JOUR = ['update', 'updateMany', 'upsert'];
const CLES_QUI_NE_BORNENT_PAS = new Set(['NOT', 'none', 'isNot', 'every']);
function valeurEpingle(valeur, dossier, perimetre) {
    if (typeof valeur === 'string') {
        return dossier == null || valeur === dossier || perimetre?.has(valeur) === true;
    }
    if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur))
        return false;
    const o = valeur;
    const cles = Object.keys(o);
    if (cles.length === 0)
        return false;
    return cles.every((cle) => {
        if (cle === 'equals')
            return valeurEpingle(o.equals, dossier, perimetre);
        if (cle === 'in') {
            return (Array.isArray(o.in) &&
                o.in.length > 0 &&
                o.in.every((x) => valeurEpingle(x, dossier, perimetre)));
        }
        return false;
    });
}
function filtreBorne(where, dossier, perimetre) {
    if (!where || typeof where !== 'object')
        return false;
    if (Array.isArray(where))
        return where.some((w) => filtreBorne(w, dossier, perimetre));
    const o = where;
    return Object.entries(o).some(([cle, v]) => {
        if (cle === 'tenantId')
            return valeurEpingle(v, dossier, perimetre);
        if (CLES_QUI_NE_BORNENT_PAS.has(cle))
            return false;
        if (cle === 'OR') {
            return (Array.isArray(v) && v.length > 0 && v.every((b) => filtreBorne(b, dossier, perimetre)));
        }
        return typeof v === 'object' && v !== null && filtreBorne(v, dossier, perimetre);
    });
}
function dossierDeLaLigne(ligne) {
    if (!ligne || typeof ligne !== 'object')
        return undefined;
    const t = ligne.tenantId;
    return typeof t === 'string' ? t : t === null ? null : undefined;
}
async function garderCloisonnement(base, contexte) {
    const { model, operation, args, query } = contexte;
    if (!modeles_cloisonnes_1.MODELES_CLOISONNES.has(model))
        return query(args);
    if ((0, contexte_cloisonnement_1.raisonHorsCloisonnement)())
        return query(args);
    const dossier = (0, contexte_audit_1.acteurCourant)()?.tenantId;
    const perimetre = (0, contexte_cloisonnement_1.perimetreCourant)();
    const a = args;
    const dossierAutorise = (proprietaire) => proprietaire === dossier || (proprietaire !== null && perimetre?.has(proprietaire) === true);
    if (CREATIONS.includes(operation) || operation === 'upsert') {
        const donnees = operation === 'upsert' ? args?.create : args?.data;
        const lignes = Array.isArray(donnees) ? donnees : [donnees];
        if (dossier) {
            for (const ligne of lignes) {
                const cible = dossierCree(ligne);
                if (cible !== undefined && !dossierAutorise(cible)) {
                    throw new contexte_cloisonnement_1.CloisonnementViole(`Création refusée · ${model}.${operation} dans un autre dossier que celui de la session. ` +
                        'Déclarer le périmètre par perimetreDeGroupe(...) ou la sortie par horsCloisonnement("raison", ...).');
                }
            }
        }
        if (operation !== 'upsert')
            return query(args);
    }
    if (MISES_A_JOUR.includes(operation) && dossier) {
        const donnees = operation === 'upsert' ? args?.update : args?.data;
        for (const cible of dossiersVises(donnees)) {
            if (cible === FORME_ILLISIBLE) {
                throw new contexte_cloisonnement_1.CloisonnementViole(`Mise à jour refusée · ${model}.${operation} touche au dossier de la ligne sous une forme que la garde ne sait pas lire. ` +
                    'Écrire le tenantId en clair, ou relier par tenant.connect.id.');
            }
            if (!dossierAutorise(cible)) {
                throw new contexte_cloisonnement_1.CloisonnementViole(`Mise à jour refusée · ${model}.${operation} ferait passer la ligne dans un autre dossier que celui de la session. ` +
                    'Déclarer le périmètre par perimetreDeGroupe(...) ou la sortie par horsCloisonnement("raison", ...).');
            }
        }
    }
    if (COLLECTIONS.includes(operation)) {
        if (!filtreBorne(a?.where, dossier, perimetre)) {
            throw new contexte_cloisonnement_1.CloisonnementViole(`Requête non cloisonnée · ${model}.${operation} sans borne de dossier vérifiable dans son filtre. ` +
                'Un tenantId présent ne suffit pas · il doit ÉGALER le dossier de la session, ou l’un de ' +
                'ceux déclarés par perimetreDeGroupe(...). Sinon, déclarer la sortie par horsCloisonnement("raison", ...).');
        }
        return query(args);
    }
    if (ECRITURES_UNITAIRES.includes(operation)) {
        if (filtreBorne(a?.where, dossier, perimetre))
            return query(args);
        if (!dossier) {
            throw new contexte_cloisonnement_1.CloisonnementViole(`Écriture hors dossier · ${model}.${operation} sans dossier au contexte et sans tenantId au filtre. ` +
                'Déclarer la sortie par horsCloisonnement("raison", ...) si elle est voulue.');
        }
        const propriete = model.charAt(0).toLowerCase() + model.slice(1);
        const existante = await base[propriete].findFirst({ where: a?.where, select: { tenantId: true } });
        const proprietaire = dossierDeLaLigne(existante);
        if (existante === null || proprietaire === undefined)
            return query(args);
        if (!dossierAutorise(proprietaire)) {
            throw new contexte_cloisonnement_1.CloisonnementViole(`Écriture refusée · ${model} appartient à un autre dossier que celui de la session.`);
        }
        return query(args);
    }
    if (LECTURES_UNITAIRES.includes(operation)) {
        if (!dossier || filtreBorne(a?.where, dossier, perimetre))
            return query(args);
        const select = args?.select;
        const ajoute = !!select && select.tenantId !== true;
        const resultat = await query(ajoute ? { ...args, select: { ...select, tenantId: true } } : args);
        const proprietaire = dossierDeLaLigne(resultat);
        if (proprietaire !== undefined && !dossierAutorise(proprietaire))
            return null;
        if (ajoute && resultat && typeof resultat === 'object')
            delete resultat.tenantId;
        return resultat;
    }
    return query(args);
}
function extensionCloisonnement(base) {
    return client_1.Prisma.defineExtension({
        name: 'cloisonnement-dossier',
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    return garderCloisonnement(base, { model, operation, args, query });
                },
            },
        },
    });
}
//# sourceMappingURL=extension-cloisonnement.js.map