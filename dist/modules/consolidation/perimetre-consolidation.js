"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEUIL_DISPENSE_FCFA = exports.SEUIL_PRESOMPTION_INFLUENCE_NOTABLE = exports.SEUIL_PRESOMPTION_CONTROLE_DE_FAIT = exports.SEUIL_CONTROLE_DE_DROIT = exports.LIBELLE_MOTIF_EXCLUSION = void 0;
exports.analyserPerimetre = analyserPerimetre;
exports.verdictDateCloture = verdictDateCloture;
exports.verdictObligation = verdictObligation;
const ajouter_mois_1 = require("../../common/ajouter-mois");
exports.LIBELLE_MOTIF_EXCLUSION = {
    PERTE_CONTROLE_DEMONTREE: 'Perte de contrôle ou de l’influence notable démontrée (art. 96, al. 1er)',
    RESTRICTIONS_SEVERES_DURABLES: 'Restrictions sévères et durables remettant en cause substantiellement le contrôle ou le transfert de fonds (art. 96)',
    DETENUE_EN_VUE_DE_CESSION: 'Actions ou parts détenues uniquement en vue de leur cession ultérieure (art. 96)',
    INFORMATION_FRAIS_EXCESSIFS: 'Informations impossibles à obtenir sans frais excessifs ou dans des délais compatibles (art. 96)',
    IMPORTANCE_NEGLIGEABLE: 'Importance négligeable par rapport à l’ensemble consolidé (art. 96, dernier alinéa)',
};
const arrondi = (x) => Math.round(x * 10000) / 10000;
exports.SEUIL_CONTROLE_DE_DROIT = 50;
exports.SEUIL_PRESOMPTION_CONTROLE_DE_FAIT = 40;
exports.SEUIL_PRESOMPTION_INFLUENCE_NOTABLE = 20;
function analyserPerimetre(entites, liens) {
    const consolidante = entites.find((e) => e.estConsolidante);
    if (!consolidante)
        throw new Error('Le périmètre n’a pas d’entité consolidante.');
    if (entites.filter((e) => e.estConsolidante).length > 1) {
        throw new Error('Un périmètre n’a qu’une entité consolidante (art. 75).');
    }
    for (const l of liens) {
        for (const p of [l.pctDroitsVote, l.pctCapital]) {
            if (!(p >= 0 && p <= 100))
                throw new Error('Un pourcentage de participation est compris entre 0 et 100.');
        }
    }
    verifierAbsenceDeCycle(entites, liens, consolidante.id);
    const nature = new Map();
    const pctControle = new Map();
    const controlees = new Set([consolidante.id]);
    for (let tour = 0; tour <= entites.length; tour++) {
        let change = false;
        for (const e of entites) {
            if (e.estConsolidante)
                continue;
            const pct = arrondi(liens
                .filter((l) => l.detenueId === e.id && controlees.has(l.detentriceId))
                .reduce((s, l) => s + l.pctDroitsVote, 0));
            pctControle.set(e.id, pct);
            const n = natureDuControle(e, pct);
            nature.set(e.id, n);
            const exclusive = n.startsWith('EXCLUSIF') && !controleRompu(e);
            if (exclusive && !controlees.has(e.id)) {
                controlees.add(e.id);
                change = true;
            }
            if (!exclusive && controlees.has(e.id)) {
                controlees.delete(e.id);
                change = true;
            }
        }
        if (!change)
            break;
    }
    const methodeDe = (e) => {
        if (e.estConsolidante)
            return 'IG';
        if (e.exclusion)
            return 'EXCLUE';
        return METHODE_PAR_NATURE[nature.get(e.id) ?? 'AUCUN'];
    };
    const retenues = new Set(entites
        .filter((e) => {
        const m = methodeDe(e);
        if (m === 'IG' || m === 'IP' || m === 'ME')
            return true;
        return m === 'EXCLUE' && nature.get(e.id) !== 'AUCUN' && !controleRompu(e);
    })
        .map((e) => e.id));
    const interet = new Map([[consolidante.id, 100]]);
    const ordre = ordreTopologique(entites, liens, consolidante.id);
    for (const id of ordre) {
        if (id === consolidante.id)
            continue;
        const pct = liens
            .filter((l) => l.detenueId === id && (l.detentriceId === consolidante.id || retenues.has(l.detentriceId)))
            .reduce((s, l) => s + ((interet.get(l.detentriceId) ?? 0) * l.pctCapital) / 100, 0);
        interet.set(id, arrondi(pct));
    }
    return entites.map((e) => {
        const methode = methodeDe(e);
        const n = e.estConsolidante ? 'EXCLUSIF_DE_DROIT' : (nature.get(e.id) ?? 'AUCUN');
        const pc = e.estConsolidante ? 100 : (pctControle.get(e.id) ?? 0);
        return {
            id: e.id,
            nom: e.nom,
            estConsolidante: e.estConsolidante,
            pctControle: pc,
            pctInteret: interet.get(e.id) ?? 0,
            natureControle: n,
            methode,
            fondement: e.estConsolidante ? 'Entité consolidante (art. 75).' : fondementDe(n, pc, e),
            aJustifierEnNotes: e.estConsolidante ? [] : justificationsEnNotes(methode, pc),
            exclusion: e.exclusion
                ? { motif: e.exclusion.motif, libelle: exports.LIBELLE_MOTIF_EXCLUSION[e.exclusion.motif], justification: e.exclusion.justification }
                : null,
            dateCloture: e.estConsolidante || !e.dateCloture || !consolidante.dateCloture || methode === 'EXCLUE' || methode === 'NC'
                ? null
                : verdictDateCloture(consolidante.dateCloture, e.dateCloture),
        };
    });
}
function controleRompu(e) {
    return e.exclusion?.motif === 'PERTE_CONTROLE_DEMONTREE' || e.exclusion?.motif === 'RESTRICTIONS_SEVERES_DURABLES';
}
const METHODE_PAR_NATURE = {
    EXCLUSIF_DE_DROIT: 'IG',
    EXCLUSIF_DE_FAIT: 'IG',
    EXCLUSIF_CONTRACTUEL: 'IG',
    CONJOINT: 'IP',
    INFLUENCE_NOTABLE: 'ME',
    AUCUN: 'NC',
};
function natureDuControle(e, pct) {
    if (pct > exports.SEUIL_CONTROLE_DE_DROIT)
        return 'EXCLUSIF_DE_DROIT';
    if (e.designationMajoriteDeuxExercices === true)
        return 'EXCLUSIF_DE_FAIT';
    if (pct > exports.SEUIL_PRESOMPTION_CONTROLE_DE_FAIT && e.aucunAutreAssocieSuperieur === true)
        return 'EXCLUSIF_DE_FAIT';
    if (e.controleContractuel === true)
        return 'EXCLUSIF_CONTRACTUEL';
    if (e.accordControleConjoint === true)
        return 'CONJOINT';
    if (pct >= exports.SEUIL_PRESOMPTION_INFLUENCE_NOTABLE || e.influenceNotableDeclaree === true)
        return 'INFLUENCE_NOTABLE';
    return 'AUCUN';
}
function fondementDe(n, pct, e) {
    const p = `${pct.toFixed(2)} % des droits de vote`;
    switch (n) {
        case 'EXCLUSIF_DE_DROIT':
            return `Contrôle exclusif de droit · ${p}, « la majorité des droits de vote » (art. 78) · intégration globale (art. 80).`;
        case 'EXCLUSIF_DE_FAIT':
            return e.designationMajoriteDeuxExercices === true
                ? `Contrôle exclusif de fait · ${p}, désignation de la majorité des organes pendant deux exercices successifs, déclarée (art. 78) · intégration globale (art. 80).`
                : `Contrôle exclusif de fait présumé · ${p}, plus de 40 %, et aucun autre associé au-dessus, déclaré (art. 78) · intégration globale (art. 80).`;
        case 'EXCLUSIF_CONTRACTUEL':
            return `Contrôle exclusif contractuel · influence dominante en vertu d'un contrat ou de clauses statutaires, déclarée (art. 78) · intégration globale (art. 80).`;
        case 'CONJOINT':
            return `Contrôle conjoint · accord contractuel entre un nombre limité d'associés, déclaré (art. 78) · intégration proportionnelle (art. 80).`;
        case 'INFLUENCE_NOTABLE':
            if (pct > exports.SEUIL_PRESOMPTION_CONTROLE_DE_FAIT) {
                return `Influence notable présumée · ${p}, au moins un cinquième (art. 78) · mise en équivalence (art. 80). Au-delà de 40 %, le contrôle de fait est présumé si aucun autre associé ne détient une fraction supérieure, ou établi par la désignation de la majorité des organes pendant deux exercices · ni l'un ni l'autre n'est déclaré.`;
            }
            return pct >= exports.SEUIL_PRESOMPTION_INFLUENCE_NOTABLE
                ? `Influence notable présumée · ${p}, au moins un cinquième (art. 78) · mise en équivalence (art. 80).`
                : `Influence notable déclarée sous le seuil de présomption · ${p} (art. 78, éléments autres que les droits de vote) · mise en équivalence (art. 80).`;
        case 'AUCUN':
            return `${p} · ni contrôle ni influence notable (art. 78) · titres non consolidés.`;
    }
}
function justificationsEnNotes(methode, pct) {
    const j = [];
    if (methode === 'IG' && pct <= exports.SEUIL_PRESOMPTION_CONTROLE_DE_FAIT) {
        j.push('Intégration globale avec 40 % des droits de vote ou moins · à justifier en Notes annexes (D4C, ch. XII-8 § 6).');
    }
    if (methode !== 'IG' && pct > exports.SEUIL_CONTROLE_DE_DROIT) {
        j.push('Plus de 50 % des droits de vote sans intégration globale · à justifier en Notes annexes (D4C, ch. XII-8 § 6).');
    }
    if (methode === 'ME' && pct < exports.SEUIL_PRESOMPTION_INFLUENCE_NOTABLE) {
        j.push('Mise en équivalence avec moins de 20 % des droits de vote · à justifier en Notes annexes (D4C, ch. XII-8 § 6).');
    }
    if ((methode === 'NC' || methode === 'EXCLUE') && pct > exports.SEUIL_PRESOMPTION_INFLUENCE_NOTABLE) {
        j.push('Plus de 20 % des droits de vote sans mise en équivalence · à justifier en Notes annexes (D4C, ch. XII-8 § 6).');
    }
    if (methode === 'EXCLUE') {
        j.push('Toute exclusion du périmètre doit être justifiée dans les Notes annexes (art. 96).');
    }
    return j;
}
function ajouterTroisMois(d) {
    return (0, ajouter_mois_1.ajouterMois)(d, 3, { finDeMoisSuit: true });
}
function verdictDateCloture(mere, filiale) {
    const [a, b] = mere.getTime() <= filiale.getTime() ? [mere, filiale] : [filiale, mere];
    if (a.getTime() === b.getTime()) {
        return { ecartMois: 0, verdict: 'MEME_DATE', message: 'Même date de clôture que l’entité consolidante (art. 97).' };
    }
    const troisMoisApres = ajouterTroisMois(a);
    const mois = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    if (b.getTime() <= troisMoisApres.getTime()) {
        return {
            ecartMois: mois,
            verdict: 'DEROGATION_POSSIBLE',
            message: 'Clôtures décalées de trois mois au plus · dérogation possible, avec un ajustement des comptes de la filiale pour les ' +
                'transactions et événements significatifs de la période intermédiaire (art. 97, al. 3).',
        };
    }
    return {
        ecartMois: mois,
        verdict: 'ETATS_SUPPLEMENTAIRES',
        message: 'Clôtures décalées de plus de trois mois · la filiale prépare des états financiers supplémentaires à la date de ' +
            'clôture de la consolidante, soumis au contrôle d’un commissaire aux comptes ou d’un professionnel (art. 97).',
    };
}
function verifierAbsenceDeCycle(entites, liens, consolidanteId) {
    const utiles = liens.filter((l) => l.detenueId !== consolidanteId);
    const etat = new Map();
    const suivants = (id) => utiles.filter((l) => l.detentriceId === id).map((l) => l.detenueId);
    const visiter = (id, chemin) => {
        if (etat.get(id) === 2)
            return;
        if (etat.get(id) === 1) {
            const noms = [...chemin.slice(chemin.indexOf(id)), id].map((x) => entites.find((e) => e.id === x)?.nom ?? x);
            throw new Error(`Participations croisées entre filiales (${noms.join(' → ')}) · le calcul des pourcentages d'intérêt par ` +
                'chaînes ne se referme pas. Vérifiez les liens saisis ; les titres d’autocontrôle sur la consolidante sont, eux, ignorés.');
        }
        etat.set(id, 1);
        for (const s of suivants(id))
            visiter(s, [...chemin, id]);
        etat.set(id, 2);
    };
    for (const e of entites)
        visiter(e.id, []);
}
function ordreTopologique(entites, liens, consolidanteId) {
    const utiles = liens.filter((l) => l.detenueId !== consolidanteId);
    const ordre = [];
    const vus = new Set();
    const visiter = (id) => {
        if (vus.has(id))
            return;
        vus.add(id);
        for (const l of utiles.filter((x) => x.detenueId === id))
            visiter(l.detentriceId);
        ordre.push(id);
    };
    for (const e of entites)
        visiter(e.id);
    return ordre;
}
exports.SEUIL_DISPENSE_FCFA = 500_000_000;
const CAUSES_EXEMPTION_ART96 = new Set([
    'RESTRICTIONS_SEVERES_DURABLES',
    'DETENUE_EN_VUE_DE_CESSION',
    'INFORMATION_FRAIS_EXCESSIFS',
]);
function verdictObligation(resultats, faits) {
    const motifs = [];
    const controlees = resultats.filter((r) => !r.estConsolidante &&
        (r.natureControle.startsWith('EXCLUSIF') || r.natureControle === 'CONJOINT') &&
        r.exclusion?.motif !== 'PERTE_CONTROLE_DEMONTREE');
    const controleExclusifOuConjoint = controlees.length > 0;
    const normesIfrsRequises = faits.appelPublicEpargne === true;
    if (normesIfrsRequises) {
        motifs.push('Entité cotée ou faisant appel public à l’épargne · ses états consolidés sont établis selon les normes IFRS (art. 75, al. 2), pas selon le D4C.');
    }
    if (!controleExclusifOuConjoint) {
        motifs.push('Aucune entité sous contrôle exclusif ou conjoint · pas d’obligation de consolider. L’influence notable seule ne l’impose pas (art. 74, al. 2).');
        return { obligation: 'NON_REQUISE', motifs, normesIfrsRequises };
    }
    if (controlees.every((r) => r.exclusion != null && CAUSES_EXEMPTION_ART96.has(r.exclusion.motif))) {
        motifs.push('Les seules entités contrôlées sont exclues pour restrictions sévères et durables, détention en vue de cession ou frais excessifs · exemptée de publier des comptes consolidés (art. 96, al. 2).');
        return { obligation: 'DISPENSEE', motifs, normesIfrsRequises };
    }
    motifs.push('Au moins une entité sous contrôle exclusif ou conjoint · obligation d’établir et de publier des états financiers consolidés ET un rapport sur la gestion de l’ensemble (art. 74 et 99). Le rapport de gestion n’est pas produit par OmegaX.');
    if (faits.sousControleEntiteOhadaConsolidante === true) {
        const exceptions = [
            faits.siegesDansDeuxRegions === true ? 'sièges dans deux régions différentes de l’espace OHADA' : null,
            faits.appelPublicEpargne === true ? 'appel public à l’épargne' : null,
            faits.demandeAssociesDixieme === true ? 'consolidation exigée par des associés représentant au moins le dixième du capital' : null,
        ].filter((x) => x !== null);
        if (exceptions.length === 0) {
            motifs.push('La consolidante est elle-même sous le contrôle d’une entité de l’espace OHADA soumise à consolidation · dispensée (art. 77, al. 1er).');
            return { obligation: 'DISPENSEE', motifs, normesIfrsRequises };
        }
        motifs.push(`Dispense de l’art. 77 écartée · ${exceptions.join(' ; ')} (art. 77, al. 2).`);
    }
    const { chiffreAffairesN: n, chiffreAffairesN1: n1, seuilEquivalentFc: seuil } = faits;
    if (seuil == null || !(seuil > 0)) {
        motifs.push('Dispense de l’art. 95 non examinée · le seuil de 500 000 000 FCFA « ou l’équivalent dans l’unité monétaire ayant cours légal » ' +
            'n’a pas d’équivalent en francs congolais dans les sources lues. Déclarez-le, avec sa source, pour que la dispense soit examinée.');
        return { obligation: 'A_EXAMINER', motifs, normesIfrsRequises };
    }
    if (n == null || n1 == null) {
        motifs.push('Dispense de l’art. 95 non examinée · il faut le chiffre d’affaires hors taxes de l’ensemble pour les DEUX derniers exercices arrêtés.');
        return { obligation: 'A_EXAMINER', motifs, normesIfrsRequises };
    }
    if (n <= seuil && n1 <= seuil) {
        motifs.push(`Chiffre d’affaires de l’ensemble sous le seuil pendant deux exercices successifs (${n1} puis ${n} FC, seuil déclaré ${seuil} FC` +
            `${faits.sourceSeuil ? `, source : ${faits.sourceSeuil}` : ''}) · dispensée (art. 95).`);
        return { obligation: 'DISPENSEE', motifs, normesIfrsRequises };
    }
    motifs.push(`Chiffre d’affaires de l’ensemble au-dessus du seuil déclaré sur au moins un des deux exercices · la dispense de l’art. 95 ne joue pas.`);
    return { obligation: 'OBLIGATOIRE', motifs, normesIfrsRequises };
}
//# sourceMappingURL=perimetre-consolidation.js.map