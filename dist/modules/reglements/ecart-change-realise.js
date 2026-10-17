"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.natureDuCompte = natureDuCompte;
exports.comptesPrescrits = comptesPrescrits;
exports.racineDuPrescrit = racineDuPrescrit;
exports.racinesAdmises = racinesAdmises;
exports.compteAdmisPourEcart = compteAdmisPourEcart;
exports.motifRefusCompteEcart = motifRefusCompteEcart;
exports.libelleEcartRealise = libelleEcartRealise;
exports.coursEtFrancsDuReglement = coursEtFrancsDuReglement;
exports.motifRefusTresorerieEnDevise = motifRefusTresorerieEnDevise;
exports.ordreDeReglement = ordreDeReglement;
exports.coutHistoriqueRegle = coutHistoriqueRegle;
exports.coutsHistoriquesSuccessifs = coutsHistoriquesSuccessifs;
exports.ecartSigne = ecartSigne;
exports.lignesDuReglementEnDevise = lignesDuReglementEnDevise;
exports.ecartDuGroupe = ecartDuGroupe;
exports.lignesEcartDuGroupe = lignesEcartDuGroupe;
function natureDuCompte(numero, referentiel) {
    if (referentiel === 'SYSCOHADA' && numero.startsWith('414'))
        return null;
    const financieres = referentiel === 'SYSCOHADA' ? ['16', '17', '27', '404', '481'] : ['18', '27', '481'];
    if (financieres.some((r) => numero.startsWith(r)))
        return 'FINANCIERE';
    if (numero.startsWith('40') || numero.startsWith('41'))
        return 'COMMERCIALE';
    return null;
}
function comptesPrescrits(referentiel, nature) {
    if (nature === null) {
        return {
            perte: null,
            gain: null,
            motif: "La nature de ce compte (commerciale ou financière) ne se lit pas sur son numéro · choisissez le compte " +
                "d'écart de change (AUDCIF, Titre VIII ch. 22 § 2.3).",
        };
    }
    if (nature === 'FINANCIERE')
        return { perte: '67600000', gain: '77600000' };
    if (referentiel === 'SYSCOHADA')
        return { perte: '65600000', gain: '75600000' };
    return { perte: '65800000', gain: '75880000' };
}
function racineDuPrescrit(numero) {
    return numero.replace(/0+$/, '');
}
function racinesAdmises(referentiel, nature, ecart) {
    const perte = ecart === 'PERTE';
    const financier = { racine: perte ? '676' : '776' };
    const commercial = referentiel === 'SYSCOHADA' ? { racine: perte ? '656' : '756' } : { racine: perte ? '658' : '7588' };
    if (nature === 'FINANCIERE')
        return [financier];
    if (nature === 'COMMERCIALE')
        return [commercial];
    return [commercial, financier];
}
function compteAdmisPourEcart(racines, numero) {
    return racines.some((r) => numero.startsWith(r.racine) && !(r.sauf && numero.startsWith(r.sauf)));
}
const lesRacines = (racines) => racines.map((r) => (r.sauf ? `le ${r.racine} (hors ${r.sauf})` : `le ${r.racine}`)).join(' ou ');
function motifRefusCompteEcart(params) {
    const { referentiel, nature, ecart, numero } = params;
    const racines = racinesAdmises(referentiel, nature, ecart);
    if (compteAdmisPourEcart(racines, numero))
        return null;
    const lEcart = ecart === 'PERTE' ? 'Une perte' : 'Un gain';
    if (referentiel === 'SYCEBNL' && nature === 'COMMERCIALE' && (numero.startsWith('676') || numero.startsWith('776'))) {
        return (`Le ${numero.slice(0, 3)} est réservé par le SYCEBNL aux opérations à caractère financier (fiches des comptes 67 et 77) · ` +
            "l'écart d'une créance ou d'une dette commerciale va au 658 (perte) ou au 7588 (gain).");
    }
    const objet = nature === 'FINANCIERE'
        ? ' sur une opération financière'
        : nature === 'COMMERCIALE'
            ? ' sur une créance ou une dette commerciale'
            : '';
    return `${lEcart} de change${objet} se passe sous ${lesRacines(racines)} (AUDCIF, Titre VIII ch. 22 § 2.3) · le compte ${numero} n'en est pas.`;
}
function libelleEcartRealise(ecart) {
    return ecart > 0 ? 'Perte de change réalisée' : 'Gain de change réalisé';
}
function coursEtFrancsDuReglement(p) {
    if (!(p.montantDevise > 0)) {
        return { motif: 'le montant réglé en devise doit être strictement positif · un règlement nul ou négatif ne règle rien.' };
    }
    if (p.cours === undefined && p.francs === undefined) {
        return {
            motif: "les factures sont en devise · le cours du jour du règlement, ou le montant réellement payé en francs, est exigé, l'écart de change réalisé " +
                'se mesurant contre lui (AUDCIF art. 55).',
        };
    }
    const motifCours = 'le cours du jour du règlement doit être strictement positif · un cours nul ou négatif ferait passer ce que le tiers éteint pour un gain ' +
        '(AUDCIF art. 52 et 55).';
    const motifFrancs = 'le montant payé en francs doit être strictement positif · un règlement à zéro franc solderait le tiers contre une trésorerie vide ' +
        'et ferait du dû entier un gain de change (AUDCIF art. 55).';
    if (p.cours !== undefined && !(Number(p.cours) > 0))
        return { motif: motifCours };
    if (p.francs === undefined) {
        const cours = Number(p.cours);
        const francsDuCours = Math.round(p.montantDevise * cours * 100) / 100;
        if (!(francsDuCours > 0))
            return { motif: motifFrancs };
        return { cours, francs: francsDuCours };
    }
    const francs = Math.round(Number(p.francs) * 100) / 100;
    if (!(francs > 0))
        return { motif: motifFrancs };
    if (p.cours === undefined) {
        const deduit = Math.round((francs / p.montantDevise) * 1e6) / 1e6;
        if (!(deduit > 0))
            return { motif: motifCours };
        return { cours: deduit, francs };
    }
    const cours = Number(p.cours);
    if (!p.tolerance(p.montantDevise, cours, francs)) {
        const attendu = Math.round(p.montantDevise * cours * 100) / 100;
        return {
            motif: `${p.montantDevise.toFixed(2)} au cours de ${cours} font ${attendu.toFixed(2)} en francs, et le montant saisi est ${francs.toFixed(2)} · ` +
                'saisissez le seul montant payé, le cours s’en déduit (AUDCIF art. 52).',
        };
    }
    return { cours, francs };
}
function motifRefusTresorerieEnDevise(p) {
    const enDevise = p.devisesDuLot.filter((d) => d !== null);
    const codesLot = [...new Set(enDevise.map((d) => d.code))];
    const rib = p.deviseRib && p.deviseRib.trim() !== '' ? p.deviseRib.trim().toUpperCase() : null;
    const ribEtranger = rib !== null && rib !== p.monnaieDeTenue ? rib : null;
    if (!p.tresorerieEnDevise) {
        if (ribEtranger && enDevise.length > 0) {
            return (`Le RIB du journal ${p.journalCode} est tenu en ${ribEtranger} · cochez « Moyen de paiement en devise », sans quoi le ` +
                'compte de trésorerie recevrait des francs sans leur devise et échapperait à la conversion de clôture (AUDCIF art. 57) ; ' +
                'ou, si le RIB est mal renseigné, corrigez sa devise (Banques).');
        }
        if (ribEtranger) {
            return (`Le RIB du journal ${p.journalCode} est tenu en ${ribEtranger} et les factures choisies sont en francs · le compte de trésorerie ` +
                `recevrait des francs sans leur devise et la conversion des disponibilités à la clôture le fausserait (AUDCIF art. 57). ` +
                'Réglez ces factures depuis le journal d’un compte tenu en francs, ou, si le RIB est mal renseigné, corrigez sa devise (Banques) ; ' +
                'le paiement d’une facture en francs par une trésorerie en devise ne passe pas par le règlement des tiers, il se saisit au journal ' +
                'avec sa devise et son cours.');
        }
        return null;
    }
    if (enDevise.length === 0 || enDevise.length !== p.devisesDuLot.length) {
        return 'Un moyen de paiement en devise ne règle que des factures en devise · réglez les factures en francs dans une autre pièce.';
    }
    if (codesLot.length > 1) {
        return `Le lot porte plusieurs devises (${codesLot.join(', ')}) · un moyen de paiement en devise n'en tient qu'une, une saisie par devise.`;
    }
    if (!p.deviseTresorerie)
        return 'Précisez la devise du moyen de paiement.';
    if (p.deviseTresorerie.id !== enDevise[0].id) {
        return (`Le moyen de paiement est en ${p.deviseTresorerie.code} et les factures en ${codesLot[0]} · OmegaX ne passe pas un ` +
            "règlement d'une devise dans une autre.");
    }
    if (rib !== null && rib !== p.deviseTresorerie.code.toUpperCase()) {
        return `Le RIB du journal ${p.journalCode} est tenu en ${rib}, et non en ${p.deviseTresorerie.code} · choisissez le journal du compte en ${p.deviseTresorerie.code}.`;
    }
    return null;
}
const centimes = (x) => Math.round(x * 100);
function ordreDeReglement(a, b) {
    return a.date.getTime() - b.date.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
function coutHistoriqueRegle(factures, montantDeviseRegle) {
    return coutsHistoriquesSuccessifs(factures, [montantDeviseRegle])[0];
}
function coutsHistoriquesSuccessifs(factures, montantsDevise) {
    const file = [...factures].sort(ordreDeReglement).map((f) => ({ f, devise: f.montantDevise, francs: centimes(f.francs) }));
    return montantsDevise.map((montant) => {
        let reste = montant;
        let total = 0;
        for (const e of file) {
            if (reste <= 1e-9)
                break;
            if (e.devise <= 1e-9)
                continue;
            if (reste + 1e-9 >= e.devise) {
                total += e.francs;
                reste -= e.devise;
                e.devise = 0;
                e.francs = 0;
            }
            else {
                const part = centimes((e.f.francs * reste) / e.f.montantDevise);
                total += part;
                e.devise -= reste;
                e.francs -= part;
                reste = 0;
            }
        }
        return total / 100;
    });
}
function ecartSigne(sens, historique, francsPayes) {
    const brut = sens === 'FOURNISSEUR' ? francsPayes - historique : historique - francsPayes;
    return Math.round(brut * 100) / 100;
}
function lignesDuReglementEnDevise(p) {
    const ecart = ecartSigne(p.sens, p.historique, p.francsPayes);
    if (ecart !== 0 && !p.compteEcartId) {
        throw new Error("Un écart de change sans compte d'écart · le règlement l'aurait laissé hors de la pièce.");
    }
    const tiers = { compteId: p.compteTiersId, libelle: p.libelle, deviseId: p.deviseId, montantDevise: p.montantDevise };
    const tresorerie = {
        compteId: p.compteTresorerieId,
        libelle: p.libelle,
        ...(p.tresorerieEnDevise ? { deviseId: p.deviseId, montantDevise: p.montantDevise, coursApplique: p.coursReglement } : {}),
    };
    const libelleEcart = `${libelleEcartRealise(ecart)} · ${p.libelle}`.slice(0, 190);
    const ligneEcart = ecart === 0
        ? null
        : ecart > 0
            ? { compteId: p.compteEcartId, debit: ecart, libelle: libelleEcart }
            : { compteId: p.compteEcartId, credit: -ecart, libelle: libelleEcart };
    const debits = [];
    const credits = [];
    if (p.sens === 'FOURNISSEUR') {
        debits.push({ ...tiers, debit: p.historique });
        credits.push({ ...tresorerie, credit: p.francsPayes });
    }
    else {
        debits.push({ ...tresorerie, debit: p.francsPayes });
        credits.push({ ...tiers, credit: p.historique });
    }
    if (ligneEcart)
        (ligneEcart.debit !== undefined ? debits : credits).push(ligneEcart);
    return [...debits, ...credits];
}
function ecartDuGroupe(lignes) {
    const enDevise = lignes.filter((l) => l.deviseId !== null && l.montantDevise !== null);
    if (enDevise.length === 0)
        return null;
    const devises = new Set(enDevise.map((l) => l.deviseId));
    if (devises.size !== 1)
        return null;
    const soldeDevise = enDevise.reduce((s, l) => s + (l.debit - l.credit >= 0 ? 1 : -1) * Number(l.montantDevise), 0);
    if (Math.abs(soldeDevise) > 0.005)
        return null;
    const soldeFrancs = lignes.reduce((s, l) => s + centimes(l.debit) - centimes(l.credit), 0) / 100;
    return { deviseId: [...devises][0], ecart: soldeFrancs };
}
function lignesEcartDuGroupe(p) {
    const montant = Math.abs(p.ecart);
    return p.ecart > 0
        ? [
            { compteId: p.compteEcartId, debit: montant, libelle: p.libelle },
            { compteId: p.compteTiersId, credit: montant, libelle: p.libelle },
        ]
        : [
            { compteId: p.compteTiersId, debit: montant, libelle: p.libelle },
            { compteId: p.compteEcartId, credit: montant, libelle: p.libelle },
        ];
}
//# sourceMappingURL=ecart-change-realise.js.map