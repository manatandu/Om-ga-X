"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estEchue = estEchue;
exports.motifPaiementExerciceClos = motifPaiementExerciceClos;
exports.motifReportDePaiement = motifReportDePaiement;
exports.motifGroupeLuEnBloc = motifGroupeLuEnBloc;
exports.motifRefusDeclaration = motifRefusDeclaration;
exports.imputerPaiements = imputerPaiements;
const EPSILON = 0.005;
const c = (n) => Math.round(n * 100) / 100;
function estEchue(dette, au) {
    const echeance = dette.dateEcheance ?? dette.dateFacture;
    return echeance.getTime() <= au.getTime();
}
function imputerLegalement(montant, candidates, reste, date, ajouter) {
    let disponible = c(montant);
    const ouvertes = candidates.filter((d) => (reste.get(d.id) ?? 0) > EPSILON);
    const nees = ouvertes.filter((d) => d.dateFacture.getTime() <= date.getTime());
    const aNaitre = ouvertes.filter((d) => d.dateFacture.getTime() > date.getTime());
    const rang = (d) => (estEchue(d, date) ? 0 : 1);
    const paliers = [];
    for (const lot of [nees, aNaitre]) {
        const tries = [...lot].sort((a, b) => rang(a) - rang(b) || a.dateFacture.getTime() - b.dateFacture.getTime() || a.id.localeCompare(b.id));
        for (const d of tries) {
            const dernier = paliers[paliers.length - 1];
            const tete = dernier?.[0];
            if (tete && lot.includes(tete) && rang(tete) === rang(d) && tete.dateFacture.getTime() === d.dateFacture.getTime()) {
                dernier.push(d);
            }
            else
                paliers.push([d]);
        }
    }
    for (const palier of paliers) {
        if (disponible <= EPSILON)
            break;
        const dus = palier.map((d) => reste.get(d.id) ?? 0);
        const total = dus.reduce((t, x) => t + x, 0);
        if (total <= EPSILON)
            continue;
        if (disponible >= total - EPSILON) {
            palier.forEach((d, i) => ajouter(d.id, dus[i]));
            disponible = c(disponible - total);
            continue;
        }
        let cumul = 0;
        let plusLourde = 0;
        const parts = dus.map((du, i) => {
            if (du > dus[plusLourde])
                plusLourde = i;
            const p = c((disponible * du) / total);
            cumul = c(cumul + p);
            return p;
        });
        parts[plusLourde] = c(parts[plusLourde] + disponible - cumul);
        palier.forEach((d, i) => {
            if (parts[i] > EPSILON)
                ajouter(d.id, Math.min(parts[i], dus[i]));
        });
        disponible = 0;
    }
    return disponible;
}
const jourDe = (d) => d.toISOString().slice(0, 10);
const jjmmaaaa = (d) => jourDe(d).split('-').reverse().join('/');
function motifPaiementExerciceClos(date) {
    return (`Le paiement du ${date ? jjmmaaaa(date) : '?'} appartient à un exercice clôturé · son imputation ne se déclare ` +
        'ni ne se retire plus (ses déclarations de TVA sont arrêtées sur l’imputation qu’il portait).');
}
function motifReportDePaiement(origine) {
    return ('La ligne désignée comme paiement est le report à nouveau d’un paiement d’un exercice précédent' +
        (origine ? ` (${origine})` : '') +
        ' · ce n’est pas un paiement. Le débiteur déclare quelle dette il acquitte « lorsqu’il paye » (Code civil, Livre III, ' +
        'art. 151) · déclarez l’imputation sur le paiement d’origine, dans son exercice. Si cet exercice est clôturé, ' +
        'l’imputation qu’il portait reste celle de ses déclarations de TVA, et l’imputation légale s’applique au reste (art. 154).');
}
function motifGroupeLuEnBloc(motif) {
    return (`Le moteur de la TVA lit ce groupe en bloc (${motif}) · aucune imputation n’y est lue, et une déclaration n’y serait ` +
        'pas retenue. Lettrez à part ce qui l’empêche de se décomposer (un avoir avec sa seule facture, par exemple), puis ' +
        'déclarez l’imputation.');
}
function motifRefusDeclaration(e) {
    const r = e.reglement;
    if (!r)
        return 'Le paiement désigné est introuvable dans ce dossier.';
    if (!r.validee)
        return 'Le paiement est au brouillard · seule une écriture validée (livre-journal) se déclare (AUDCIF art. 22, 2°).';
    const auClient = r.numero.startsWith('41');
    if (!auClient && !r.numero.startsWith('40')) {
        return `Le compte ${r.numero} n’est ni un compte client (41) ni un compte fournisseur (40) · l’imputation d’un paiement se déclare sur le compte du tiers qui paie ou qui est payé.`;
    }
    if (Math.abs(r.sens) <= EPSILON || (auClient ? r.sens > 0 : r.sens < 0)) {
        return `La ligne désignée comme paiement est ${auClient ? 'au débit du client' : 'au crédit du fournisseur'} · c’est le sens d’une facture, pas d’un règlement.`;
    }
    if (r.aNouveau)
        return motifReportDePaiement(e.origineDuReport ?? null);
    if (r.exerciceClos)
        return motifPaiementExerciceClos(r.date);
    if (!r.lettrageId) {
        return ('Le paiement n’est lettré avec aucune facture · une imputation déclarée se lit dans le groupe de lettrage qui réunit le ' +
            'paiement et ses factures. Lettrez-les d’abord (Interrogation et lettrage), puis déclarez l’imputation.');
    }
    if (e.motifEnBloc)
        return motifGroupeLuEnBloc(e.motifEnBloc);
    if (e.dejaActive) {
        return 'Une imputation est déjà déclarée pour ce paiement · retirez-la (motif exigé) avant d’en déclarer une autre.';
    }
    if (e.pieceReference.trim().length < 3) {
        return 'La pièce est exigée (ordre de virement ou lettre qui cite la facture, quittance acceptée) · une déclaration sans pièce ne se vérifie pas.';
    }
    if (!e.pieceDate || Number.isNaN(e.pieceDate.getTime())) {
        return 'La date de la pièce est exigée · la déclaration du débiteur se fait lorsqu’il paye (Code civil, Livre III, art. 151), la quittance constate ce que le créancier a reçu (art. 153).';
    }
    const datePaiement = r.date ?? null;
    if (e.fondement === 'DECLARATION_DU_DEBITEUR' && datePaiement && jourDe(e.pieceDate) > jourDe(datePaiement)) {
        return (`La pièce du ${jjmmaaaa(e.pieceDate)} est postérieure au paiement du ${jjmmaaaa(datePaiement)} · le débiteur déclare ` +
            'quelle dette il acquitte « lorsqu’il paye » (Code civil, Livre III, art. 151), pas après. Une imputation faite ensuite ' +
            'par le créancier sur sa quittance, et acceptée par le débiteur, se déclare comme quittance acceptée (art. 153), avec la ' +
            'preuve de l’acceptation ; sinon l’imputation légale s’applique (art. 154).');
    }
    if (e.fondement === 'QUITTANCE_ACCEPTEE') {
        if (datePaiement && jourDe(e.pieceDate) < jourDe(datePaiement)) {
            return (`La quittance du ${jjmmaaaa(e.pieceDate)} est antérieure au paiement du ${jjmmaaaa(datePaiement)} · elle constate ce ` +
                'que le créancier « a reçu » (Code civil, Livre III, art. 153), elle ne le précède pas.');
        }
        if ((e.preuveAcceptation ?? '').trim().length < 3) {
            return ('La preuve de l’acceptation est exigée · l’art. 153 ne lie le débiteur qu’à la quittance qu’il « a acceptée » ' +
                '(contreseing, lettre ou courriel du débiteur, avec sa référence).');
        }
    }
    const vues = new Set();
    let total = 0;
    for (const f of e.factures) {
        if (vues.has(f.idDemande))
            return 'Une même facture figure deux fois dans la déclaration.';
        vues.add(f.idDemande);
        const l = f.ligne;
        if (!l)
            return 'Une facture désignée est introuvable dans ce dossier.';
        if (l.id === r.id)
            return 'Le paiement ne s’impute pas sur lui-même.';
        if (l.compteId !== r.compteId)
            return `La facture désignée est au compte ${l.numero}, le paiement au compte ${r.numero} · un paiement ne paie que les dettes de son tiers.`;
        if (!l.validee)
            return `Une facture désignée (compte ${l.numero}) est au brouillard · seule une écriture validée se déclare.`;
        if (Math.abs(l.sens) <= EPSILON || l.sens > 0 === r.sens > 0) {
            return 'Une ligne désignée est dans le sens du paiement · ce n’est pas une dette qu’il paie.';
        }
        if (l.lettrageId !== r.lettrageId) {
            return 'Une facture désignée n’est pas dans le groupe de lettrage du paiement · lettrez-la avec lui, ou retirez-la de la déclaration.';
        }
        const reste = c(Math.abs(l.sens) - f.dejaDeclare);
        if (!(f.montant > 0) || c(f.montant) > reste + EPSILON) {
            const qui = (f.consommePar ?? []).length > 0 ? ` (${f.consommePar.join(' ; ')})` : '';
            return (`La part imputée (${c(f.montant).toFixed(2)}) dépasse ce qui reste de la facture (${Math.max(0, reste).toFixed(2)}` +
                (f.dejaDeclare > EPSILON ? `, après ${c(f.dejaDeclare).toFixed(2)} déjà imputés ou déclarés sur d’autres paiements${qui}` : '') +
                ').');
        }
        total = c(total + f.montant);
    }
    if (total > Math.abs(r.sens) + EPSILON) {
        return `Les parts déclarées (${total.toFixed(2)}) dépassent le paiement (${c(Math.abs(r.sens)).toFixed(2)}).`;
    }
    return null;
}
function imputerPaiements(dettes, paiements, declarees = []) {
    const reste = new Map(dettes.map((d) => [d.id, c(d.montant)]));
    const parDette = new Map(dettes.map((d) => [d.id, []]));
    const nonImpute = [];
    const declareesRamenees = [];
    const ordre = [...paiements].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
    for (const p of ordre) {
        let disponible = c(p.montant);
        const poser = (detteId, part, fondement) => {
            const x = c(part);
            if (x <= EPSILON)
                return;
            reste.set(detteId, c((reste.get(detteId) ?? 0) - x));
            parDette.get(detteId).push({ paiementId: p.id, date: p.date, montant: x, fondement });
        };
        for (const d of declarees.filter((x) => x.paiementId === p.id)) {
            if (!reste.has(d.detteId)) {
                declareesRamenees.push({ paiementId: p.id, detteId: d.detteId, declare: c(d.montant), retenu: 0 });
                continue;
            }
            const retenu = c(Math.max(0, Math.min(d.montant, reste.get(d.detteId), disponible)));
            if (Math.abs(retenu - c(d.montant)) > EPSILON) {
                declareesRamenees.push({ paiementId: p.id, detteId: d.detteId, declare: c(d.montant), retenu });
            }
            poser(d.detteId, retenu, 'DECLAREE');
            disponible = c(disponible - retenu);
        }
        if (disponible <= EPSILON)
            continue;
        const restant = imputerLegalement(disponible, [...dettes], reste, p.date, (id, part) => poser(id, part, 'LEGALE'));
        if (restant > EPSILON)
            nonImpute.push({ paiementId: p.id, montant: c(restant) });
    }
    return { parDette, nonImpute, declareesRamenees };
}
//# sourceMappingURL=imputation-paiements.js.map