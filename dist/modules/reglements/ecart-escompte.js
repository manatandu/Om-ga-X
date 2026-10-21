"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RACINES_ECART_ESCOMPTE = void 0;
exports.roleEscompte = roleEscompte;
exports.comptesOfferts = comptesOfferts;
exports.compteDuRole = compteDuRole;
exports.planDuReglement = planDuReglement;
exports.lignesAvecEscompteEtEcart = lignesAvecEscompteEtEcart;
exports.avertissementEscompteApresEcheance = avertissementEscompteApresEcheance;
exports.avertissementTvaEscompte = avertissementTvaEscompte;
exports.avertissementTvaEcart = avertissementTvaEcart;
exports.RACINES_ECART_ESCOMPTE = {
    SYSCOHADA: { ESCOMPTE_OBTENU: '773', ESCOMPTE_ACCORDE: '673', ECART_REGLEMENT: '6588' },
    SYCEBNL: { ESCOMPTE_OBTENU: '773', ESCOMPTE_ACCORDE: '673', ECART_REGLEMENT: '658' },
};
function roleEscompte(sens) {
    return sens === 'FOURNISSEUR' ? 'ESCOMPTE_OBTENU' : 'ESCOMPTE_ACCORDE';
}
function comptesOfferts(referentiel, role, candidats) {
    const racine = exports.RACINES_ECART_ESCOMPTE[referentiel][role];
    const sous = candidats.filter((c) => c.numero.startsWith(racine));
    const seme = racine.padEnd(8, '0');
    const subdivise = sous.some((c) => c.numero !== seme);
    return subdivise ? sous.filter((c) => c.numero !== seme) : sous;
}
function compteDuRole(referentiel, role, candidats, choisiId) {
    const racine = exports.RACINES_ECART_ESCOMPTE[referentiel][role];
    const nom = role === 'ECART_REGLEMENT' ? "l'écart de règlement" : role === 'ESCOMPTE_OBTENU' ? "l'escompte obtenu" : "l'escompte accordé";
    const offerts = comptesOfferts(referentiel, role, candidats);
    if (choisiId !== undefined) {
        const c = offerts.find((x) => x.id === choisiId);
        return c
            ? { compte: c }
            : { motif: `Le compte choisi pour ${nom} n'est pas un compte de détail actif sous le ${racine}, ou il est subdivisé (choisissez un de ses sous-comptes).` };
    }
    if (offerts.length === 1)
        return { compte: offerts[0] };
    if (offerts.length === 0) {
        return { motif: `Aucun compte de détail actif sous le ${racine} pour ${nom} · ouvrez-le ou réactivez-le dans le Plan comptable.` };
    }
    return { motif: `Plusieurs comptes sous le ${racine} pour ${nom} (${offerts.map((c) => c.numero).join(', ')}) · choisissez-en un.` };
}
const c = (x) => Math.round(x * 100);
const f = (x) => (x / 100).toFixed(2);
function planDuReglement(p) {
    const du = c(p.du);
    const paye = c(p.montant);
    const escompte = c(p.escompte);
    if (escompte < 0)
        return { motif: "L'escompte ne peut pas être négatif." };
    if (escompte > 0 && escompte >= du) {
        return { motif: `L'escompte (${f(escompte)}) atteint le dû des factures choisies (${f(du)}) · il réduit un paiement, il ne le remplace pas.` };
    }
    if (paye <= 0)
        return { motif: 'Le montant réglé doit être positif.' };
    if (escompte > 0 && p.sens === 'CLIENT' && p.referentiel === 'SYCEBNL' && !p.numeroTiers.startsWith('412')) {
        return {
            motif: "au SYCEBNL, l'escompte de règlement ne s'accorde qu'au client-usager · la fiche du compte 41 crédite « le compte 412 · " +
                'CLIENTS-USAGERS » des escomptes accordés, par le débit du 673. Une cotisation d’adhérent n’en reçoit pas.',
        };
    }
    const seuilC = p.seuil === null ? null : c(p.seuil);
    const refusSeuil = (ecart) => seuilC === null
        ? "Aucun seuil d'écart de règlement n'est fixé pour ce dossier · fixez-le dans Paramètres du dossier, ou réglez sans solder l'écart."
        : ecart > seuilC
            ? `L'écart de ${f(ecart)} dépasse le seuil du dossier (${f(seuilC)}) · réglez sans solder l'écart, ou relevez le seuil dans Paramètres du dossier.`
            : null;
    if (p.sens === 'FOURNISSEUR') {
        if (p.solderEcart) {
            if (escompte > 0)
                return { motif: "Un escompte obtenu et un trop-payé ne se passent pas dans le même règlement · réglez l'un, puis l'autre." };
            if (paye < du) {
                return {
                    motif: `Payé ${f(paye)} pour un dû de ${f(du)} · la dette du reste demeure, le fournisseur seul peut la remettre (Code civil, Livre III, ` +
                        'art. 132 et 142) · le règlement reste partiel, sans écart.',
                };
            }
            if (paye === du)
                return { motif: "Le payé égale le dû · il n'y a pas d'écart à solder." };
            const motif = refusSeuil(paye - du);
            if (motif)
                return { motif };
            return { tiers: du / 100, ecart: (paye - du) / 100, partiel: false };
        }
        const tiers = paye + escompte;
        if (tiers > du) {
            return {
                motif: `Le payé (${f(paye)})${escompte > 0 ? ` et l'escompte (${f(escompte)})` : ''} dépassent le dû des factures choisies (${f(du)}) · ` +
                    "l'excédent est une avance, à comptabiliser à part, ou, s'il est sous le seuil du dossier, un écart à solder.",
            };
        }
        return { tiers: tiers / 100, ecart: 0, partiel: tiers < du };
    }
    const recu = paye + escompte;
    if (recu > du) {
        return {
            motif: `L'encaissé (${f(paye)})${escompte > 0 ? ` et l'escompte (${f(escompte)})` : ''} dépassent le dû des factures choisies (${f(du)}) · ` +
                'le trop-perçu se restitue au client (Code civil, Livre III, art. 252) · il s’enregistre à part, en avance reçue, jamais en produit.',
        };
    }
    if (p.solderEcart) {
        if (recu === du)
            return { motif: "L'encaissé égale le dû · il n'y a pas d'écart à solder." };
        const motif = refusSeuil(du - recu);
        if (motif)
            return { motif };
        return { tiers: du / 100, ecart: (du - recu) / 100, partiel: false };
    }
    return { tiers: recu / 100, ecart: 0, partiel: recu < du };
}
function lignesAvecEscompteEtEcart(p) {
    const { libelle } = p;
    const lignes = [];
    const escompte = p.escompte && p.escompte.montant > 0 ? p.escompte : null;
    const ecart = p.ecart && p.ecart.montant > 0 ? p.ecart : null;
    if (p.sens === 'FOURNISSEUR') {
        lignes.push({ compteId: p.compteTiersId, debit: p.plan.tiers, libelle });
        if (ecart)
            lignes.push({ compteId: ecart.compteId, debit: ecart.montant, libelle: `Écart de règlement · ${libelle}`.slice(0, 190) });
        lignes.push({ compteId: p.compteTresorerieId, credit: p.montant, libelle });
        if (escompte)
            lignes.push({ compteId: escompte.compteId, credit: escompte.montant, libelle: `Escompte obtenu · ${libelle}`.slice(0, 190) });
        return lignes;
    }
    lignes.push({ compteId: p.compteTresorerieId, debit: p.montant, libelle });
    if (escompte)
        lignes.push({ compteId: escompte.compteId, debit: escompte.montant, libelle: `Escompte accordé · ${libelle}`.slice(0, 190) });
    if (ecart)
        lignes.push({ compteId: ecart.compteId, debit: ecart.montant, libelle: `Écart de règlement · ${libelle}`.slice(0, 190) });
    lignes.push({ compteId: p.compteTiersId, credit: p.plan.tiers, libelle });
    return lignes;
}
function avertissementEscompteApresEcheance(numero, dateReglement, echeances) {
    const echues = echeances.filter((e) => e.echeance.getTime() < Date.UTC(dateReglement.getUTCFullYear(), dateReglement.getUTCMonth(), dateReglement.getUTCDate()));
    if (echues.length === 0)
        return null;
    return (`${numero} · ${echues.map((e) => `${e.reference} (échue le ${e.echeance.toISOString().slice(0, 10)})`).join(', ')} · l'escompte de ` +
        'règlement se consent pour un paiement AVANT le terme normal d’exigibilité (fiche du compte 673) · vérifiez qu’il a bien été convenu.');
}
function avertissementTvaEscompte(numero, escompte) {
    return (`${numero} · l'escompte de ${escompte.toFixed(2)} ne sort de la base de la TVA que s'il figure sur une facture initiale ou ` +
        'rectificative (O.-L. n° 10/001, art. 29, 1° ; décret n° 011/42, art. 79) · la pièce du règlement ne régularise pas la taxe, ' +
        'passez la facture rectificative à part.');
}
function avertissementTvaEcart(numero, ecart) {
    return (`${numero} · l'écart de ${ecart.toFixed(2)} abandonné au client ne réduit pas la TVA facturée · une remise ne sort de la base ` +
        "que si elle figure sur une facture initiale ou rectificative (O.-L. n° 10/001, art. 29, point 1 ; décret n° 011/42, art. 79).");
}
//# sourceMappingURL=ecart-escompte.js.map