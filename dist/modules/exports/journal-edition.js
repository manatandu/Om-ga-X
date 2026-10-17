"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TITRES_COLONNES_JOURNAL = exports.COLONNES_PISTE_REVISION = exports.NB_COLONNES_JOURNAL = void 0;
exports.formatDuJour = formatDuJour;
exports.compterStatut = compterStatut;
exports.motifBlocChange = motifBlocChange;
exports.signatureDeLecture = signatureDeLecture;
exports.motifPieceDeplacee = motifPieceDeplacee;
exports.titreDuBloc = titreDuBloc;
exports.estHorsLivreJournal = estHorsLivreJournal;
exports.libelleDeLaLigne = libelleDeLaLigne;
exports.tiersDeLaLigne = tiersDeLaLigne;
exports.criteresEnClair = criteresEnClair;
exports.etatDeCorrection = etatDeCorrection;
exports.ouvrirJournalEdition = ouvrirJournalEdition;
const crypto_1 = require("crypto");
const ExcelJS = require("exceljs");
const client_1 = require("@prisma/client");
const collectifs_tiers_1 = require("../tiers/collectifs-tiers");
const classeur_en_flux_1 = require("./classeur-en-flux");
const presentation_fpm_1 = require("./presentation-fpm");
const FORMAT_MONTANT = '#,##0.00';
const FORMAT_DATE = 'DD/MM/YYYY';
const FORMAT_DATE_HEURE = 'DD/MM/YYYY HH:mm';
exports.NB_COLONNES_JOURNAL = 7;
function formatDuJour(periode) {
    if (!periode)
        return 'DD/MM/YY';
    const unAnApres = new Date(periode.debut);
    unAnApres.setUTCFullYear(unAnApres.getUTCFullYear() + 1);
    return periode.fin.getTime() < unAnApres.getTime() ? 'DD/MM' : 'DD/MM/YY';
}
function compterStatut(s, statut, n = 1) {
    if (statut === client_1.StatutEcriture.VALIDEE)
        s.validees += n;
    else if (statut === client_1.StatutEcriture.SITUATION)
        s.situation += n;
    else
        s.brouillard += n;
}
function motifBlocChange(code, comptes, lus) {
    if (comptes.validees === lus.validees && comptes.brouillard === lus.brouillard && comptes.situation === lus.situation) {
        return null;
    }
    const hors = (s) => (s.brouillard + s.situation).toLocaleString('fr-FR');
    const val = (s) => s.validees.toLocaleString('fr-FR');
    return (`Le journal ${code} a changé pendant la production · ${val(lus)} écritures validées et ${hors(lus)} hors ` +
        `livre-journal lues, contre ${val(comptes)} et ${hors(comptes)} comptées au départ (une validation, une ` +
        "saisie ou un retrait en cours). Relancez l'export une fois le geste fini.");
}
function signatureDeLecture(e, nombreDeLignes) {
    return (0, crypto_1.createHash)('sha256')
        .update([e.id, e.journalId, e.statut, e.date.toISOString(), e.dateValeur?.toISOString() ?? '', e.numeroPiece ?? '', e.libelle, nombreDeLignes].join('\u0000'))
        .digest('base64url')
        .slice(0, 16);
}
function motifPieceDeplacee(code, e) {
    return (`La pièce n° ${e.numeroPiece ?? '·'} du ${jourEnClair(e.date)} au journal ${code} n'est plus celle que la feuille ` +
        'Journal a lue à cette place (écriture modifiée, validée, ajoutée ou retirée pendant la production) · la piste ' +
        "de révision dirait un autre livre. Relancez l'export une fois la saisie ou la validation finie.");
}
function titreDuBloc(journal, statuts) {
    const auBrouillard = statuts.brouillard + statuts.situation;
    if (journal.type === client_1.TypeJournal.SITUATION) {
        if (statuts.validees === 0)
            return 'JOURNAL DE SITUATION · HORS LIVRE-JOURNAL';
        return auBrouillard === 0
            ? 'JOURNAL DE SITUATION · ÉCRITURES VALIDÉES AU LIVRE-JOURNAL'
            : 'JOURNAL DE SITUATION · EN PARTIE HORS LIVRE-JOURNAL';
    }
    if (statuts.validees > 0 && auBrouillard === 0)
        return 'JOURNAL';
    if (statuts.validees === 0)
        return 'BROUILLARD';
    return 'JOURNAL ET BROUILLARD';
}
function estHorsLivreJournal(statut) {
    return statut !== client_1.StatutEcriture.VALIDEE;
}
function jourEnClair(d) {
    const d2 = (x) => String(x).padStart(2, '0');
    return `${d2(d.getUTCDate())}/${d2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
function libelleDeLaLigne(ligne, ecriture) {
    const propre = ligne.libelle?.trim() ? ligne.libelle.trim() : ecriture.libelle;
    return ecriture.dateValeur ? `${propre} · valeur au ${jourEnClair(ecriture.dateValeur)}` : propre;
}
const COLLECTIFS_DE_TIERS = new Set(Object.values(collectifs_tiers_1.PANOPLIES_TIERS).flatMap((parType) => Object.values(parType).flatMap((panoplie) => (panoplie ?? []).map((c) => c.collectif))));
function tiersDeLaLigne(compte, porteDesIndividuels) {
    if (!compte.tiersCompte)
        return '';
    if (COLLECTIFS_DE_TIERS.has(compte.numero))
        return '';
    if (porteDesIndividuels)
        return '';
    return compte.tiersCompte.tiers.code;
}
function criteresEnClair(c) {
    const morceaux = [];
    if (c.compte)
        morceaux.push(`compte ${c.compte}`);
    if (c.montantMin !== undefined) {
        morceaux.push(c.montantMax !== undefined && c.montantMax !== c.montantMin
            ? `montant de ${c.montantMin} à ${c.montantMax}`
            : `montant ${c.montantMin}`);
    }
    if (c.numeroPiece !== undefined)
        morceaux.push(`pièce n° ${c.numeroPiece}`);
    if (c.reference)
        morceaux.push(`référence « ${c.reference} »`);
    if (c.recherche)
        morceaux.push(`libellé « ${c.recherche} »`);
    return morceaux.length ? `Sélection · ${morceaux.join(', ')}` : null;
}
function etatDeCorrection(e) {
    if (e.correction)
        return `Annulée par la pièce n° ${e.correction.numeroPiece ?? '·'}`;
    if (e.corrigeEcriture)
        return `Annule la pièce n° ${e.corrigeEcriture.numeroPiece ?? '·'}`;
    return '';
}
exports.COLONNES_PISTE_REVISION = [
    { header: 'Journal', key: 'journal', width: 10 },
    { header: 'Date', key: 'date', width: 12, style: { numFmt: FORMAT_DATE } },
    { header: 'Date de valeur', key: 'dateValeur', width: 14, style: { numFmt: FORMAT_DATE } },
    { header: 'N° pièce', key: 'numeroPiece', width: 10 },
    { header: 'Référence', key: 'reference', width: 16 },
    { header: "Libellé de l'écriture", key: 'libelle', width: 36 },
    { header: 'Statut', key: 'statut', width: 12 },
    { header: 'Saisie le', key: 'saisieLe', width: 18, style: { numFmt: FORMAT_DATE_HEURE } },
    { header: 'Saisie par', key: 'saisiePar', width: 28 },
    { header: 'Validée le', key: 'valideeLe', width: 18, style: { numFmt: FORMAT_DATE_HEURE } },
    { header: 'Validée par', key: 'valideePar', width: 28 },
    { header: 'Correction', key: 'correction', width: 30 },
    { header: 'Motif de la correction', key: 'motifCorrection', width: 46 },
];
exports.TITRES_COLONNES_JOURNAL = ['Jour', 'N° pièce', 'N° compte', 'N° tiers', 'Libellé', 'Débit', 'Crédit'];
const ARRONDI = (x) => Math.round(x * 100) / 100;
const FILET_HAUT = { top: { style: 'thin' } };
const FILET_BAS = { bottom: { style: 'thin' } };
const ENTETE_FOND = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
function ouvrirJournalEdition(params) {
    const { sortie, identite } = params;
    const selection = params.selection ?? null;
    const instant = params.tire ?? new Date();
    const tire = (0, presentation_fpm_1.tirageAKinshasa)(instant);
    const editeLe = jourEnClair(new Date(instant.getTime() + 60 * 60 * 1000));
    const identification = (0, classeur_en_flux_1.segmentIdentification)(identite);
    const classeur = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sortie, ...classeur_en_flux_1.OPTIONS_CLASSEUR_EN_FLUX });
    classeur.creator = 'OmegaX';
    classeur.created = instant;
    const feuille = classeur.addWorksheet('Journal', {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
        headerFooter: {
            oddHeader: (0, classeur_en_flux_1.enTeteImpression)(identite.entite, identite.periode, 'Page &P / &N'),
            oddFooter: (0, classeur_en_flux_1.enTeteImpression)(`${identite.entite}${identification ? ` · ${identification}` : ''} · ${identite.periode} · montants en ${identite.devise}`, null, `Tiré le ${tire}`),
        },
    });
    feuille.columns = [
        { key: 'jour', width: 9, style: { numFmt: params.formatJour } },
        { key: 'numeroPiece', width: 10 },
        { key: 'compte', width: 12 },
        { key: 'tiers', width: 12 },
        { key: 'libelle', width: 46 },
        { key: 'debit', width: 16, style: { numFmt: FORMAT_MONTANT } },
        { key: 'credit', width: 16, style: { numFmt: FORMAT_MONTANT } },
    ];
    const ecrire = async (remplir) => {
        const ligne = feuille.addRow([]);
        remplir(ligne);
        ligne.commit();
        await (0, classeur_en_flux_1.attendreLeTuyau)(sortie);
        return ligne;
    };
    const totauxDesBlocs = [];
    let bloc = null;
    let debitPeriode = 0;
    let creditPeriode = 0;
    const enTete = async (titre, journal, mention) => {
        const ligneMention = [selection, mention].filter(Boolean).join(' · ') || null;
        await ecrire((l) => {
            l.getCell(1).value = `${selection ? `SÉLECTION D'ÉCRITURES · ${titre}` : titre} · ${identite.entite}`;
            l.getCell(1).font = { bold: true, size: 12 };
            l.getCell(exports.NB_COLONNES_JOURNAL).value = identite.periode;
            l.getCell(exports.NB_COLONNES_JOURNAL).alignment = { horizontal: 'right' };
        });
        await ecrire((l) => {
            l.getCell(1).value = journal;
            l.getCell(1).font = { bold: true };
            l.getCell(exports.NB_COLONNES_JOURNAL).value = `Tenue de compte : ${identite.devise}`;
            l.getCell(exports.NB_COLONNES_JOURNAL).alignment = { horizontal: 'right' };
        });
        await ecrire((l) => {
            l.getCell(1).value = `Tiré le ${tire}${identification ? ` · ${identification}` : ''}`;
            l.getCell(1).font = { size: 9, italic: true };
        });
        await ecrire((l) => {
            if (ligneMention) {
                l.getCell(1).value = ligneMention;
                l.getCell(1).font = { size: 9, italic: true };
            }
        });
    };
    return {
        feuille,
        classeur,
        async ouvrirBloc(journal, statuts) {
            if (bloc)
                throw new Error(`Le bloc du journal ${bloc.code} n'est pas fermé.`);
            const precedent = totauxDesBlocs[totauxDesBlocs.length - 1];
            if (precedent)
                precedent.addPageBreak();
            const horsLivre = statuts.brouillard + statuts.situation > 0;
            await enTete(titreDuBloc(journal, statuts), `${journal.code} · ${journal.intitule}`, horsLivre ? 'Lignes en italique · hors du livre-journal, non validées.' : null);
            const titres = await ecrire((l) => {
                exports.TITRES_COLONNES_JOURNAL.forEach((t, i) => {
                    const c = l.getCell(i + 1);
                    c.value = t;
                    c.font = { bold: true };
                    c.fill = ENTETE_FOND;
                    c.border = FILET_BAS;
                    if (i >= 5)
                        c.alignment = { horizontal: 'right' };
                });
            });
            bloc = { code: journal.code, premiere: titres.number + 1, derniere: titres.number, debit: 0, credit: 0 };
        },
        async ajouterLigne(l) {
            if (!bloc)
                throw new Error("Aucun bloc de journal n'est ouvert.");
            const courant = bloc;
            const ecrite = await ecrire((r) => {
                r.getCell(1).value = l.jour;
                r.getCell(2).value = l.numeroPiece;
                r.getCell(3).value = l.compte;
                r.getCell(4).value = l.tiers || null;
                r.getCell(5).value = l.libelle;
                r.getCell(6).value = l.debit || null;
                r.getCell(7).value = l.credit || null;
                if (l.horsLivreJournal)
                    r.font = { italic: true };
            });
            courant.derniere = ecrite.number;
            courant.debit = ARRONDI(courant.debit + l.debit);
            courant.credit = ARRONDI(courant.credit + l.credit);
        },
        async fermerBloc() {
            if (!bloc)
                throw new Error("Aucun bloc de journal n'est ouvert.");
            const courant = bloc;
            const total = await ecrire((r) => {
                r.getCell(5).value = selection ? `Totaux de la sélection, journal ${courant.code}` : `Totaux du journal ${courant.code}`;
                for (const [rang, valeur] of [
                    [6, courant.debit],
                    [7, courant.credit],
                ]) {
                    const lettre = rang === 6 ? 'F' : 'G';
                    r.getCell(rang).value =
                        courant.derniere >= courant.premiere
                            ? { formula: `SUM(${lettre}${courant.premiere}:${lettre}${courant.derniere})`, result: valeur }
                            : 0;
                }
                r.font = { bold: true };
                for (let c = 1; c <= exports.NB_COLONNES_JOURNAL; c++)
                    r.getCell(c).border = FILET_HAUT;
            });
            totauxDesBlocs.push(total);
            debitPeriode = ARRONDI(debitPeriode + courant.debit);
            creditPeriode = ARRONDI(creditPeriode + courant.credit);
            bloc = null;
        },
        async aucuneEcriture(journal) {
            await enTete(journal?.type === client_1.TypeJournal.SITUATION ? 'JOURNAL DE SITUATION · HORS LIVRE-JOURNAL' : 'JOURNAL', journal ? `${journal.code} · ${journal.intitule}` : 'Tous journaux', null);
            await ecrire((l) => {
                l.getCell(1).value = 'Aucune écriture sur la période.';
                l.getCell(1).font = { italic: true };
            });
        },
        async terminer(suivantes) {
            if (bloc)
                throw new Error(`Le bloc du journal ${bloc.code} n'est pas fermé.`);
            await ecrire(() => undefined);
            await ecrire((r) => {
                r.getCell(5).value = selection ? 'Totaux de la sélection' : 'Totaux de la période';
                for (const [rang, valeur] of [
                    [6, debitPeriode],
                    [7, creditPeriode],
                ]) {
                    const lettre = rang === 6 ? 'F' : 'G';
                    r.getCell(rang).value =
                        totauxDesBlocs.length > 0
                            ? { formula: totauxDesBlocs.map((t) => `${lettre}${t.number}`).join('+'), result: valeur }
                            : 0;
                }
                r.font = { bold: true };
                for (let c = 1; c <= exports.NB_COLONNES_JOURNAL; c++)
                    r.getCell(c).border = { top: { style: 'double' } };
            });
            feuille.commit();
            if (suivantes)
                await suivantes((p) => (0, classeur_en_flux_1.poserFeuille)(classeur, sortie, { editeLe, ...p }));
            await classeur.commit();
        },
        totauxPeriode: () => ({ debit: debitPeriode, credit: creditPeriode }),
    };
}
//# sourceMappingURL=journal-edition.js.map