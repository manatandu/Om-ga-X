"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_RENUMEROTATION = exports.LONGUEUR_MAX_NUMERO = void 0;
exports.motifRefusParametres = motifRefusParametres;
exports.numeroForme = numeroForme;
exports.planDeRenumerotation = planDeRenumerotation;
exports.motifRefusPlan = motifRefusPlan;
exports.motifRefusCampagneOuverte = motifRefusCampagneOuverte;
exports.numerosEnDouble = numerosEnDouble;
exports.rapprocher = rapprocher;
exports.LONGUEUR_MAX_NUMERO = 100;
exports.PLAFOND_RENUMEROTATION = 5_000;
function motifRefusParametres(p) {
    if (typeof p.prefixe !== 'string' || p.prefixe.length > 20)
        return 'Le préfixe tient en vingt caractères au plus.';
    if (!/^[A-Za-z0-9._/-]*$/.test(p.prefixe)) {
        return 'Le préfixe ne prend que des lettres sans accent, des chiffres et les signes « . », « _ », « / », « - ».';
    }
    if (!Number.isInteger(p.premierNumero) || p.premierNumero < 0 || p.premierNumero > 99_999_999) {
        return 'Le premier numéro est un entier de 0 à 99 999 999.';
    }
    if (!Number.isInteger(p.largeur) || p.largeur < 1 || p.largeur > 8)
        return 'La largeur est de 1 à 8 chiffres.';
    if (p.ordre !== 'ACQUISITION' && p.ordre !== 'COMPTE')
        return 'Ordre inconnu.';
    if (p.perimetre !== 'EN_SERVICE' && p.perimetre !== 'SANS_NUMERO')
        return 'Périmètre inconnu.';
    return null;
}
function numeroForme(p, n) {
    return `${p.prefixe}${String(n).padStart(p.largeur, '0')}`;
}
function comparer(ordre) {
    return (a, b) => {
        if (ordre === 'COMPTE' && a.compteNumero !== b.compteNumero)
            return a.compteNumero < b.compteNumero ? -1 : 1;
        const d = a.dateAcquisition.getTime() - b.dateAcquisition.getTime();
        if (d !== 0)
            return d;
        const c = a.createdAt.getTime() - b.createdAt.getTime();
        if (c !== 0)
            return c;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    };
}
function planDeRenumerotation(fiches, p) {
    const dansLePerimetre = (f) => !f.sortie && (p.perimetre === 'EN_SERVICE' || !(f.numeroInventaire ?? '').trim());
    const perimetre = fiches.filter(dansLePerimetre).sort(comparer(p.ordre));
    const gardes = new Map();
    for (const f of fiches) {
        const num = (f.numeroInventaire ?? '').trim();
        if (!dansLePerimetre(f) && num)
            gardes.set(num, f.designation);
    }
    const attributions = [];
    const collisions = [];
    perimetre.forEach((f, i) => {
        const nouveau = numeroForme(p, p.premierNumero + i);
        const garde = gardes.get(nouveau);
        if (garde !== undefined)
            collisions.push({ numero: nouveau, designation: garde });
        if ((f.numeroInventaire ?? '').trim() !== nouveau) {
            attributions.push({ id: f.id, designation: f.designation, ancien: f.numeroInventaire, nouveau });
        }
    });
    return { attributions, collisions, nombre: perimetre.length };
}
function motifRefusPlan(plan, p) {
    if (plan.nombre === 0) {
        return p.perimetre === 'SANS_NUMERO' ? 'Aucun bien en service sans numéro d’inventaire.' : 'Aucun bien en service à renuméroter.';
    }
    if (plan.nombre > exports.PLAFOND_RENUMEROTATION) {
        return `${plan.nombre} biens · un geste en renumérote ${exports.PLAFOND_RENUMEROTATION} au plus. Renumérotez d’abord les biens sans numéro.`;
    }
    const dernier = numeroForme(p, p.premierNumero + plan.nombre - 1);
    if (String(p.premierNumero + plan.nombre - 1).length > p.largeur) {
        return `La largeur de ${p.largeur} chiffres ne suffit pas · le dernier numéro serait ${dernier}.`;
    }
    if (dernier.length > exports.LONGUEUR_MAX_NUMERO)
        return 'Le numéro dépasse la longueur admise.';
    if (plan.collisions.length > 0) {
        const nommes = plan.collisions
            .slice(0, 5)
            .map((c) => `${c.numero} (« ${c.designation} »)`)
            .join(', ');
        return (`${plan.collisions.length} numéro(s) nouveau(x) déjà porté(s) par un bien hors du périmètre · ${nommes}` +
            `${plan.collisions.length > 5 ? '…' : ''}. Choisissez un autre préfixe ou un autre premier numéro.`);
    }
    return null;
}
function motifRefusCampagneOuverte(campagnes) {
    const ouverte = campagnes.find((c) => c.statut !== 'CLOTUREE');
    if (!ouverte)
        return null;
    return (`La campagne d’inventaire « ${ouverte.libelle} » du ${ouverte.dateInventaire.toISOString().slice(0, 10)} n’est pas clôturée · ` +
        'ses fiches portent les numéros d’inventaire en place, et le comptage se fait sur eux. Renumérotez après sa clôture.');
}
function numerosEnDouble(fiches) {
    const parNumero = new Map();
    for (const f of fiches) {
        const num = (f.numeroInventaire ?? '').trim();
        if (!num)
            continue;
        const l = parNumero.get(num) ?? [];
        l.push({ id: f.id, designation: f.designation });
        parNumero.set(num, l);
    }
    return [...parNumero.entries()]
        .filter(([, l]) => l.length > 1)
        .map(([numero, fichesDuNumero]) => ({ numero, fiches: fichesDuNumero }))
        .sort((a, b) => (a.numero < b.numero ? -1 : 1));
}
const centimes = (x) => Math.round(x * 100);
function rapprocher(registre, balance) {
    const numeros = new Set([...registre.keys(), ...balance.keys()]);
    return [...numeros]
        .sort()
        .map((numero) => {
        const r = centimes(registre.get(numero)?.montant ?? 0);
        const b = centimes(balance.get(numero)?.solde ?? 0);
        return {
            numero,
            intitule: registre.get(numero)?.intitule ?? balance.get(numero)?.intitule ?? '',
            registre: r / 100,
            balance: b / 100,
            ecart: (b - r) / 100,
        };
    })
        .filter((l) => l.registre !== 0 || l.balance !== 0);
}
//# sourceMappingURL=maintenance-immobilisations.js.map