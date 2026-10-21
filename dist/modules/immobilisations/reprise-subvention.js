"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_METHODE_DEPRECIATION_NON_DECLAREE = exports.FONDS_REPRIS = void 0;
exports.fondsDuCompte = fondsDuCompte;
exports.proposerReprise = proposerReprise;
const SUBVENTION = {
    racine: '14',
    regle: 'SUBVENTION',
    compteReprise: '79900000',
    libelle: "Reprise de subvention d'investissement",
};
exports.FONDS_REPRIS = {
    SYSCOHADA: [SUBVENTION],
    SYCEBNL: [
        SUBVENTION,
        { racine: '167', exclure: '1679', regle: 'DONS_LEGS', compteReprise: '79230000', libelle: 'Reprise de fonds provenant de dons et legs' },
        { racine: '171', regle: 'USUFRUIT', compteReprise: '79610000', libelle: "Reprise de la donation temporaire d'usufruit" },
        { racine: '172', regle: 'A_VENDRE', compteReprise: '79620000', libelle: 'Reprise pour solde des dons et legs destinés à la vente' },
    ],
};
function fondsDuCompte(referentiel, numero) {
    return exports.FONDS_REPRIS[referentiel].find((f) => numero.startsWith(f.racine) && !(f.exclure && numero.startsWith(f.exclure)));
}
exports.RESERVE_METHODE_DEPRECIATION_NON_DECLAREE = "Le bien est déprécié sur l'exercice et le dossier n'a pas déclaré sa méthode de dépréciation des biens subventionnés (AUDCIF Titre VIII ch. 17 § 4.6) · aucune reprise n'est ajoutée pour la dépréciation.";
const centimes = (x) => Math.round(x * 100) / 100;
function proposerReprise(e) {
    const reste = centimes(e.subvention - e.cumulRepris);
    if (reste <= 0)
        return { montant: 0, nature: e.sorti ? 'SORTIE' : 'EXERCICE', motif: 'Le fonds est entièrement repris.' };
    const regle = e.regle ?? 'SUBVENTION';
    if (regle === 'A_VENDRE') {
        return e.sorti
            ? { montant: reste, nature: 'SORTIE', motif: null }
            : { montant: 0, nature: 'EXERCICE', motif: 'Le 172 se reprend pour solde à la cession du bien (SYCEBNL Partie 3 ch. 2 § 2.2.3).' };
    }
    if (regle === 'DONS_LEGS') {
        if (e.sorti) {
            return { montant: 0, nature: 'SORTIE', motif: "Le texte ne règle pas la reprise du 167 à la sortie d'un bien à conserver (SYCEBNL Partie 3 ch. 2 § 1.2.2) · décision du cabinet." };
        }
        if (e.amortissable && e.dotationExercice == null) {
            return { montant: 0, nature: 'EXERCICE', motif: "Passez d'abord la dotation de l'exercice · la reprise en suit le montant." };
        }
        const base = centimes((e.dotationExercice ?? 0) + (e.depreciationExercice ?? 0));
        if (base <= 0)
            return { montant: 0, nature: 'EXERCICE', motif: "Aucune dotation aux amortissements ni aux dépréciations sur l'exercice." };
        const quotePart = e.valeurOrigine > 0 ? Math.min(1, e.subvention / e.valeurOrigine) : 1;
        return { montant: Math.min(reste, centimes(base * quotePart)), nature: 'EXERCICE', motif: null };
    }
    if (e.sorti)
        return { montant: Math.max(0, centimes(reste - (e.reductions ?? 0))), nature: 'SORTIE', motif: null };
    if (regle === 'USUFRUIT') {
        if (e.dotationExercice == null) {
            return { montant: 0, nature: 'EXERCICE', motif: "Passez d'abord la dotation de l'exercice · la reprise en suit le montant." };
        }
        return { montant: Math.min(reste, centimes(e.dotationExercice)), nature: 'EXERCICE', motif: null };
    }
    const solde = centimes(reste - (e.reductions ?? 0));
    if (solde <= 0)
        return { montant: 0, nature: 'EXERCICE', motif: 'Le fonds est entièrement repris.' };
    if (e.amortissable) {
        if (e.dotationExercice == null) {
            return { montant: 0, nature: 'EXERCICE', motif: "Passez d'abord la dotation de l'exercice · la reprise en suit le montant." };
        }
        const globale = centimes(e.dotationExercice + (e.derogatoireNetExercice ?? 0));
        let montant;
        if (e.resteAAmortirOuverture == null) {
            const part = e.valeurOrigine > 0 ? Math.min(1, e.subvention / e.valeurOrigine) : 1;
            montant = Math.min(solde, centimes(globale * part));
        }
        else if (e.resteAAmortirOuverture <= 0) {
            montant = solde;
        }
        else {
            montant = Math.min(solde, centimes((solde * Math.min(globale, e.resteAAmortirOuverture)) / e.resteAAmortirOuverture));
        }
        let reserve = null;
        const depreciation = centimes(e.depreciationExercice ?? 0);
        if (depreciation > 0) {
            if (e.methodeDepreciation === 'VNC_ENTIERE')
                montant = Math.min(solde, centimes(montant + depreciation));
            else if (e.methodeDepreciation == null)
                reserve = exports.RESERVE_METHODE_DEPRECIATION_NON_DECLAREE;
        }
        return { montant: Math.max(0, montant), nature: 'EXERCICE', motif: null, ...(reserve ? { reserve } : {}) };
    }
    const annees = e.dureeInalienabiliteAns && e.dureeInalienabiliteAns > 0 ? e.dureeInalienabiliteAns : 10;
    if (e.exercicesRepris == null)
        return { montant: Math.min(solde, centimes(e.subvention / annees)), nature: 'EXERCICE', motif: null };
    const restantes = Math.max(1, annees - e.exercicesRepris);
    return { montant: Math.min(solde, centimes(solde / restantes)), nature: 'EXERCICE', motif: null };
}
//# sourceMappingURL=reprise-subvention.js.map