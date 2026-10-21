"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normaliserDeclarationsIfrs12 = normaliserDeclarationsIfrs12;
exports.construireNoteIfrs12 = construireNoteIfrs12;
const r2 = (x) => Math.round(x * 100) / 100 || 0;
const EPS = 0.005;
const texte = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const nombre = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
function normaliserDeclarationsIfrs12(brut) {
    const o = (brut && typeof brut === 'object' ? brut : {});
    const table = (v, f) => {
        const t = (v && typeof v === 'object' ? v : {});
        return Object.fromEntries(Object.entries(t).map(([k, x]) => [k, f((x && typeof x === 'object' ? x : {}))]));
    };
    return {
        jugements: texte(o.jugements),
        restrictions: texte(o.restrictions),
        datesCloture: texte(o.datesCloture),
        entitesStructurees: typeof o.entitesStructurees === 'boolean' ? o.entitesStructurees : null,
        filiales: table(o.filiales, (x) => ({
            etablissement: texte(x.etablissement),
            resultatMinoritaires: nombre(x.resultatMinoritaires),
            cumulMinoritaires: nombre(x.cumulMinoritaires),
            dividendesMinoritaires: nombre(x.dividendesMinoritaires),
        })),
        partenaires: table(o.partenaires, (x) => ({
            etablissement: texte(x.etablissement),
            natureRelation: texte(x.natureRelation),
            typePartenariat: x.typePartenariat === 'ENTREPRISE_COMMUNE' || x.typePartenariat === 'COENTREPRISE' ? x.typePartenariat : null,
            dividendesRecus: nombre(x.dividendesRecus),
        })),
    };
}
const LIBELLE_METHODE = {
    IG: 'Intégration globale',
    IP: 'Intégration proportionnelle',
    ME: 'Mise en équivalence',
    NC: 'Non consolidée',
    EXCLUE: 'Exclue',
};
function construireNoteIfrs12(p) {
    const d = p.declarations;
    const blocs = [];
    const motifs = [];
    const manque = (t, motif) => {
        blocs.push({ type: 'manque', texte: t });
        motifs.push(`Notes · IFRS 12 · ${motif}`);
    };
    blocs.push({
        type: 'tableau',
        titre: 'Composition du groupe (§ 10 a i)',
        colonnes: ['Méthode', '% de contrôle', '% d’intérêt', 'Fondement'],
        lignes: p.entites.map((e) => ({
            libelle: e.estConsolidante ? `${e.nom} (société mère)` : e.nom,
            valeurs: [e.exclusion ? `${LIBELLE_METHODE[e.methode]} · ${e.exclusion.libelle}` : LIBELLE_METHODE[e.methode], e.pctControle, e.pctInteret, e.fondement],
        })),
    });
    const aJustifier = p.entites.flatMap((e) => e.aJustifierEnNotes.map((j) => `${e.nom} · ${j}`));
    for (const j of aJustifier)
        blocs.push({ type: 'texte', texte: `À justifier · ${j}`, source: 'CALCULE' });
    if (d.jugements)
        blocs.push({ type: 'texte', texte: `Hypothèses et jugements importants (§ 7 à 9) · ${d.jugements}`, source: 'DECLARE' });
    else
        manque('Hypothèses et jugements importants sur le contrôle, le contrôle conjoint et l’influence notable · à déclarer (§ 7 à 9).', 'hypothèses et jugements importants non déclarés (§ 7 à 9).');
    const decalees = p.entites.filter((e) => e.dateCloture && e.dateCloture.verdict !== 'MEME_DATE');
    if (decalees.length) {
        for (const e of decalees)
            blocs.push({ type: 'texte', texte: `${e.nom} · ${e.dateCloture.message}`, source: 'CALCULE' });
        if (d.datesCloture)
            blocs.push({ type: 'texte', texte: `Raison des dates de clôture différentes (§ 11 b, § 22 b ii) · ${d.datesCloture}`, source: 'DECLARE' });
        else
            manque('Raison de l’utilisation d’une date de clôture différente · à déclarer (§ 11 b, § 22 b ii).', 'raison des dates de clôture différentes non déclarée (§ 11 b, § 22 b ii).');
    }
    const filiales = p.entites.filter((e) => !e.estConsolidante && !e.exclusion && e.methode === 'IG' && e.pctInteret < 100 - EPS);
    if (filiales.length) {
        let sommeResultat = 0;
        let sommeCumul = 0;
        let complet = true;
        const lignes = filiales.map((e) => {
            const x = d.filiales[e.nom] ?? { etablissement: null, resultatMinoritaires: null, cumulMinoritaires: null, dividendesMinoritaires: null };
            const manquants = [
                x.etablissement ? null : 'établissement principal (§ 12 b)',
                x.resultatMinoritaires == null ? 'résultat attribué aux minoritaires (§ 12 e)' : null,
                x.cumulMinoritaires == null ? 'cumul des minoritaires (§ 12 f)' : null,
                x.dividendesMinoritaires == null ? 'dividendes versés aux minoritaires (B10 a)' : null,
            ].filter((m) => m != null);
            if (manquants.length) {
                complet = false;
                motifs.push(`Notes · IFRS 12 · ${e.nom} · ${manquants.join(', ')} à déclarer.`);
            }
            sommeResultat += x.resultatMinoritaires ?? 0;
            sommeCumul += x.cumulMinoritaires ?? 0;
            const votes = r2(100 - e.pctControle);
            const titres = r2(100 - e.pctInteret);
            return {
                libelle: e.nom,
                valeurs: [x.etablissement, titres, Math.abs(votes - titres) > EPS ? votes : null, x.resultatMinoritaires, x.cumulMinoritaires, x.dividendesMinoritaires],
            };
        });
        blocs.push({
            type: 'tableau',
            titre: 'Filiales dont des participations ne donnent pas le contrôle (§ 12, B10 a)',
            colonnes: ['Établissement principal', '% des titres', '% des droits de vote, s’il diffère', 'Résultat net attribué', 'Cumul à la clôture', 'Dividendes versés'],
            lignes,
        });
        if (complet) {
            const ecartResultat = r2(sommeResultat - p.totaux.resultatMinoritaires);
            const ecartCumul = r2(sommeCumul - p.totaux.cumulMinoritaires);
            if (Math.abs(ecartResultat) > EPS) {
                motifs.push(`Notes · IFRS 12 · le résultat attribué aux minoritaires, filiale par filiale, diffère de ${ecartResultat} de celui de l’état consolidé (${p.totaux.resultatMinoritaires}).`);
            }
            if (Math.abs(ecartCumul) > EPS) {
                motifs.push(`Notes · IFRS 12 · le cumul des minoritaires, filiale par filiale, diffère de ${ecartCumul} de celui de l’état consolidé (${p.totaux.cumulMinoritaires}).`);
            }
        }
        manque('Informations financières résumées de chaque filiale à minoritaires (actifs et passifs courants et non courants, produits, résultat net, résultat global, flux de trésorerie), avant éliminations (B10 b, B11) · non servies par OmegaX.', 'informations financières résumées des filiales à minoritaires non servies (B10 b).');
    }
    if (p.variationsPartsInterets.length) {
        blocs.push({
            type: 'tableau',
            titre: 'Incidence des variations de parts d’intérêts sans perte du contrôle sur les capitaux propres attribuables aux propriétaires (§ 18)',
            colonnes: ['Propriétaires de la société mère', 'Participations ne donnant pas le contrôle'],
            lignes: p.variationsPartsInterets.map((v) => ({ libelle: v.libelle, valeurs: [v.groupe, v.minoritaires] })),
        });
    }
    const partenaires = p.entites.filter((e) => !e.estConsolidante && !e.exclusion && (e.methode === 'ME' || e.methode === 'IP'));
    if (partenaires.length) {
        const lignes = partenaires.map((e) => {
            const x = d.partenaires[e.nom] ?? { etablissement: null, natureRelation: null, typePartenariat: null, dividendesRecus: null };
            const manquants = [
                x.etablissement ? null : 'établissement principal (§ 21 a iii)',
                x.natureRelation ? null : 'nature de la relation (§ 21 a ii)',
                x.dividendesRecus == null ? 'dividendes reçus (B12 a)' : null,
                e.natureControle === 'CONJOINT' && !x.typePartenariat ? 'type de partenariat (§ 7 c, IFRS 11 § 14)' : null,
            ].filter((m) => m != null);
            if (manquants.length)
                motifs.push(`Notes · IFRS 12 · ${e.nom} · ${manquants.join(', ')} à déclarer.`);
            if (e.methode === 'IP' && x.typePartenariat === 'COENTREPRISE') {
                motifs.push(`IFRS 11 § 24 · ${e.nom} est déclarée coentreprise et consolidée en intégration proportionnelle · un coentrepreneur la comptabilise selon la méthode de la mise en équivalence · à retraiter.`);
            }
            const titres = r2(e.pctInteret);
            const votes = r2(e.pctControle);
            return {
                libelle: e.nom,
                valeurs: [
                    x.etablissement,
                    x.natureRelation,
                    x.typePartenariat === 'ENTREPRISE_COMMUNE' ? 'Entreprise commune' : x.typePartenariat === 'COENTREPRISE' ? 'Coentreprise' : e.natureControle === 'INFLUENCE_NOTABLE' ? 'Entreprise associée' : null,
                    titres,
                    Math.abs(votes - titres) > EPS ? votes : null,
                    LIBELLE_METHODE[e.methode],
                    x.dividendesRecus,
                ],
            };
        });
        blocs.push({
            type: 'tableau',
            titre: 'Partenariats et entreprises associées (§ 21 a et b i, B12 a)',
            colonnes: ['Établissement principal', 'Nature de la relation', 'Type', '% des titres', '% des droits de vote, s’il diffère', 'Méthode', 'Dividendes reçus'],
            lignes,
        });
        manque('Informations financières résumées de chaque coentreprise et entreprise associée (B12 b, B13), et globales pour celles qui ne sont pas significatives (§ 21 c) · non servies par OmegaX.', 'informations financières résumées des partenariats et entreprises associées non servies (B12 b, § 21 c).');
    }
    if (d.restrictions)
        blocs.push({ type: 'texte', texte: `Restrictions importantes (§ 13, § 22 a) · ${d.restrictions}`, source: 'DECLARE' });
    else
        manque('Restrictions importantes à l’accès aux actifs du groupe et au règlement de ses passifs · à déclarer, « aucune » compris (§ 13, § 22 a).', 'restrictions importantes non déclarées (§ 13, § 22 a).');
    if (d.entitesStructurees === true) {
        manque('Intérêts dans des entités structurées (§ 14 à 17, § 24 à 31) · non servis par OmegaX.', 'le groupe détient des intérêts dans des entités structurées, dont les informations (§ 14 à 17, § 24 à 31) ne sont pas servies.');
    }
    else if (d.entitesStructurees == null) {
        manque('Intérêts dans des entités structurées · question non répondue (§ 14 à 17, § 24 à 31).', 'intérêts dans des entités structurées · question non répondue (§ 24).');
    }
    blocs.push({ type: 'texte', texte: 'La perte du contrôle d’une filiale (§ 19) ne se présente pas · le tableau consolidé refuse tout changement de périmètre.', source: 'CALCULE' });
    return {
        note: {
            cle: 'IFRS12_INTERETS_AUTRES_ENTITES',
            titre: 'Intérêts détenus dans d’autres entités',
            ref: 'IFRS 12',
            postes: ['SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE', 'SF_PARTICIPATIONS_MEE', 'RN_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE'],
            blocs,
        },
        motifs,
    };
}
//# sourceMappingURL=notes-ifrs12.js.map