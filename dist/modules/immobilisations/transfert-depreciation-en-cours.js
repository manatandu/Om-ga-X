"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.racine29DuCompteDefinitif = racine29DuCompteDefinitif;
exports.propositionTransfert = propositionTransfert;
exports.motifRefusCompteCible = motifRefusCompteCible;
exports.compteCiblePropose = compteCiblePropose;
exports.porteurDeLaDepreciation = porteurDeLaDepreciation;
exports.dernierTestDeClotureDepuis = dernierTestDeClotureDepuis;
exports.motifTransfertDiffere = motifTransfertDiffere;
const depreciation_en_cours_1 = require("./depreciation-en-cours");
const EPSILON = 0.005;
const centimes = (x) => Math.round(x * 100) / 100;
function comptesDuNiveau(niveau, numeroSource) {
    if (niveau === 'HAO')
        return { reprise: '86300000', dotation: '85300000' };
    return numeroSource.startsWith('291')
        ? { reprise: '79130000', dotation: '69130000' }
        : { reprise: '79140000', dotation: '69140000' };
}
function racine29DuCompteDefinitif(numeroDefinitif) {
    return `29${numeroDefinitif.slice(1, 3)}`;
}
function propositionTransfert(o) {
    const cumuls = new Map();
    for (const m of o.mouvements) {
        const c = cumuls.get(m.compteDepreciationId) ?? { cumul: 0, numero: m.numeroCompteDepreciation };
        c.cumul = centimes(c.cumul + (m.sens === 'DOTATION' ? m.montant : -m.montant));
        cumuls.set(m.compteDepreciationId, c);
    }
    const porteurs = [...cumuls.entries()].filter(([, c]) => Math.abs(c.cumul) > EPSILON);
    const enCours = porteurs.filter(([, c]) => (0, depreciation_en_cours_1.estCompteDepreciationEnCours)(c.numero));
    if (enCours.length === 0)
        return { etat: 'SANS_OBJET' };
    const liste = enCours.map(([, c]) => `${c.cumul.toFixed(2)} au ${c.numero}`).join(', ');
    if (o.smt) {
        return {
            etat: 'ABSTENTION',
            motif: `La dépréciation constatée pendant les travaux (${liste}) n'est pas transférée · ce dossier tient le Système ` +
                "minimal de trésorerie, dont le modèle n'ouvre aucun poste de dépréciation, et la dotation y serait publiée " +
                'comme un amortissement.',
        };
    }
    if (porteurs.length > 1) {
        return {
            etat: 'ABSTENTION',
            motif: `La dépréciation de ce bien est répartie sur plusieurs comptes 29 (${porteurs.map(([, c]) => `${c.numero} ${c.cumul.toFixed(2)}`).join(', ')}) · ` +
                "OmegaX ne devine pas laquelle reprendre où, et le transfert à la mise en service n'est pas passé. Ramenez-la à un seul compte, puis transférez-la depuis la fiche du bien.",
        };
    }
    const [compteSourceId, source] = enCours[0];
    if (source.cumul < 0) {
        return {
            etat: 'ABSTENTION',
            motif: `Le compte ${source.numero} est débiteur pour ce bien (${source.cumul.toFixed(2)}) · une dépréciation est une correction d'actif de sens négatif (fiche du compte 29), rien n'est transféré.`,
        };
    }
    const dotations = o.mouvements.filter((m) => m.compteDepreciationId === compteSourceId && m.sens === 'DOTATION');
    if (dotations.some((m) => m.montantImputeEcart > EPSILON)) {
        return {
            etat: 'ABSTENTION',
            motif: `La dépréciation au ${source.numero} a été imputée en partie sur l'écart de réévaluation du bien (AUDCIF Titre VIII ` +
                "ch. 12 § 2.5) · la reprendre au 79 ferait entrer au résultat ce qui n'en est jamais sorti, et le texte ne dit pas comment la reprendre. Elle reste à ce compte.",
        };
    }
    const niveaux = new Set(dotations.map((m) => (m.numeroContrepartie.startsWith('853') ? 'HAO' : m.numeroContrepartie.startsWith('691') ? 'EXPLOITATION' : 'AUTRE')));
    if (niveaux.size !== 1 || niveaux.has('AUTRE')) {
        return {
            etat: 'ABSTENTION',
            motif: `La dépréciation au ${source.numero} a été dotée par ${[...new Set(dotations.map((m) => m.numeroContrepartie))].join(', ')} · ` +
                'le transfert reprend et dote au même niveau (691 et 791, ou 853 et 863, fiches des comptes 29 et 79), et ce mélange ne permet pas de le dire. Elle reste à ce compte.',
        };
    }
    const niveau = [...niveaux][0];
    const comptes = comptesDuNiveau(niveau, source.numero);
    return {
        etat: 'A_PASSER',
        montant: source.cumul,
        compteSourceId,
        numeroSource: source.numero,
        niveau,
        numeroReprise: comptes.reprise,
        numeroDotation: comptes.dotation,
        racineCible: racine29DuCompteDefinitif(o.numeroCompteDefinitif),
    };
}
function motifRefusCompteCible(numeroCible, racineCible) {
    if (!numeroCible.startsWith('29')) {
        return `Le compte ${numeroCible} n'est pas un compte de dépréciation d'immobilisation (29) · fiche du compte 29.`;
    }
    if ((0, depreciation_en_cours_1.estCompteDepreciationEnCours)(numeroCible)) {
        return `Le compte ${numeroCible} déprécie une immobilisation EN COURS · le transfert porte la dépréciation au 29 du bien achevé.`;
    }
    if (!numeroCible.startsWith(racineCible.slice(0, 3))) {
        return (`Le compte ${numeroCible} ne correspond pas à la division du bien achevé · attendu un ${racineCible.slice(0, 3)}. ` +
            '« Les comptes 28 et 29 ont été développés selon la structure des comptes de la classe 2 » (AUDCIF, Titre VII ch. 2).');
    }
    return null;
}
function compteCiblePropose(racineCible, candidats) {
    const admissibles = candidats.filter((c) => motifRefusCompteCible(c.numero, racineCible) === null);
    const fins = admissibles.filter((c) => c.numero.startsWith(racineCible));
    if (fins.length === 1)
        return fins[0];
    if (fins.length === 0 && admissibles.length === 1)
        return admissibles[0];
    return null;
}
function porteurDeLaDepreciation(mouvements) {
    if (mouvements.length === 0)
        return null;
    const cumuls = new Map();
    for (const m of mouvements) {
        cumuls.set(m.compteDepreciationId, centimes((cumuls.get(m.compteDepreciationId) ?? 0) + (m.sens === 'DOTATION' ? m.montant : -m.montant)));
    }
    const porteurs = [...cumuls.entries()].filter(([, c]) => c > EPSILON);
    const porteur = porteurs.length === 1 ? porteurs[0][0] : mouvements[mouvements.length - 1].compteDepreciationId;
    const dotationsDuPorteur = mouvements.filter((m) => m.sens === 'DOTATION' && m.compteDepreciationId === porteur);
    const derniereDotation = dotationsDuPorteur.at(-1) ?? mouvements.filter((m) => m.sens === 'DOTATION').at(-1) ?? null;
    return { compteDepreciationId: porteur, compteContrepartieDotationId: derniereDotation?.compteContrepartieId ?? null };
}
function dernierTestDeClotureDepuis(mouvements, date) {
    let dernier = null;
    for (const m of mouvements) {
        if (m.nature !== 'CLOTURE' || !(0, depreciation_en_cours_1.estCompteDepreciationEnCours)(m.compteDepreciation.numero) || m.exercice.dateFin < date)
            continue;
        if (!dernier || m.exercice.dateFin > dernier)
            dernier = m.exercice.dateFin;
    }
    return dernier;
}
function motifTransfertDiffere(numeroSource, montant, dernierTest) {
    const jour = dernierTest.toISOString().slice(0, 10);
    return (`La dépréciation de ${montant.toFixed(2)} au ${numeroSource} a été testée à la clôture du ${jour}, après la date de mise ` +
        'en service · elle reste à ce compte, et le transfert ne se passe pas à cette date (il reprendrait une dépréciation dotée ' +
        `après lui). Transférez-la avec « Transférer la dépréciation » dans un exercice ouvert qui commence après le ${jour} · ` +
        'le transfert est daté de son premier jour (AUDCIF art. 22, 4°) et porte tout ce que le compte en cours garde pour ce bien.');
}
//# sourceMappingURL=transfert-depreciation-en-cours.js.map