"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENONCE_MESURES_PERFORMANCE = exports.SOUS_TOTAUX_REFERENCE = void 0;
exports.normaliserDeclarationsNotes = normaliserDeclarationsNotes;
exports.motifsRefusDeclarationsNotes = motifsRefusDeclarationsNotes;
exports.construireNotesIfrs = construireNotesIfrs;
const rubriques_ifrs_1 = require("./rubriques-ifrs");
exports.SOUS_TOTAUX_REFERENCE = {
    RESULTAT_OPERATIONNEL: 'Résultat opérationnel (§ 69 a, § 118 c)',
    RESULTAT_AVANT_FINANCEMENT_IMPOTS: 'Résultat avant financement et impôts sur le résultat (§ 69 b)',
    RESULTAT_NET: 'Résultat net (§ 69 c)',
};
const RUBRIQUES_RESERVES = ['SF_RESERVES', 'SF_AUTRES_COMPOSANTES_CP'];
const texte = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const bool = (v) => (typeof v === 'boolean' ? v : null);
const num = (v) => {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v.replace(/\s/g, '').replace(',', '.'))))
        return Number(v.replace(/\s/g, '').replace(',', '.'));
    return null;
};
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const liste = (v) => (Array.isArray(v) ? v.map(obj) : []);
function normaliserDeclarationsNotes(brut) {
    const b = obj(brut);
    const e = obj(b.entite);
    const c = obj(b.continuite);
    const k = obj(b.capital);
    const d = obj(b.dividendes);
    const cartes = (v, lire) => Object.fromEntries(Object.entries(obj(v)).map(([cle, x]) => [cle, lire(x)]).filter(([, x]) => x != null));
    return {
        entite: {
            domicile: texte(e.domicile),
            formeJuridique: texte(e.formeJuridique),
            paysConstitution: texte(e.paysConstitution),
            adresseSiege: texte(e.adresseSiege),
            natureOperations: texte(e.natureOperations),
            sansSocieteMere: bool(e.sansSocieteMere),
            societeMere: texte(e.societeMere),
            societeMereUltime: texte(e.societeMereUltime),
            dureeVieLimitee: bool(e.dureeVieLimitee),
            informationsDureeVie: texte(e.informationsDureeVie),
        },
        conformiteDeclaree: bool(b.conformiteDeclaree),
        continuite: {
            retenue: bool(c.retenue),
            incertitudesSignificatives: bool(c.incertitudesSignificatives),
            incertitudes: texte(c.incertitudes),
            baseRetenue: texte(c.baseRetenue),
            raison: texte(c.raison),
        },
        methodes: liste(b.methodes).map((x) => ({ intitule: texte(x.intitule) ?? '', texte: texte(x.texte) ?? '' })),
        jugements: liste(b.jugements).map((x) => ({ intitule: texte(x.intitule) ?? '', texte: texte(x.texte) ?? '' })),
        aucunJugement: bool(b.aucunJugement),
        estimations: liste(b.estimations).map((x) => ({
            nature: texte(x.nature) ?? '',
            rubrique: texte(x.rubrique) ?? '',
            valeurComptable: num(x.valeurComptable),
            informations: texte(x.informations),
        })),
        aucuneEstimation: bool(b.aucuneEstimation),
        aucuneMesurePerformance: bool(b.aucuneMesurePerformance),
        mesuresPerformance: liste(b.mesuresPerformance).map((m) => ({
            libelle: texte(m.libelle) ?? '',
            aspect: texte(m.aspect) ?? '',
            calcul: texte(m.calcul) ?? '',
            sousTotalReference: texte(m.sousTotalReference),
            elements: liste(m.elements).map((x) => ({
                libelle: texte(x.libelle) ?? '',
                rubrique: texte(x.rubrique) ?? '',
                montant: num(x.montant) ?? 0,
                effetImpot: num(x.effetImpot),
                description: texte(x.description),
            })),
            methodeImpot: texte(m.methodeImpot),
            changement: texte(m.changement),
        })),
        capital: {
            description: texte(k.description),
            commentObjectifsAtteints: texte(k.commentObjectifsAtteints),
            soumisExigencesExternes: bool(k.soumisExigencesExternes),
            natureExigences: texte(k.natureExigences),
            exigencesRespectees: bool(k.exigencesRespectees),
            consequencesNonRespect: texte(k.consequencesNonRespect),
            changements: texte(k.changements),
            quantitatif: liste(k.quantitatif)
                .map((x) => ({ libelle: texte(x.libelle) ?? '', montantN: num(x.montantN), montantN1: num(x.montantN1) }))
                .filter((x) => x.montantN != null),
        },
        sansCapitalSocial: bool(b.sansCapitalSocial),
        informationsEquivalentes: texte(b.informationsEquivalentes),
        categoriesActions: liste(b.categoriesActions).map((a) => ({
            intitule: texte(a.intitule) ?? '',
            autorisees: num(a.autorisees),
            emisesLiberees: num(a.emisesLiberees),
            emisesNonLiberees: num(a.emisesNonLiberees),
            valeurNominale: num(a.valeurNominale),
            sansValeurNominale: a.sansValeurNominale === true,
            enCirculationOuverture: num(a.enCirculationOuverture),
            enCirculationCloture: num(a.enCirculationCloture),
            droitsRestrictions: texte(a.droitsRestrictions),
            autoDetenues: num(a.autoDetenues),
            reserveesOptions: texte(a.reserveesOptions),
        })),
        reserves: cartes(b.reserves, texte),
        dividendes: {
            proposesNonComptabilises: num(d.proposesNonComptabilises),
            proposesParAction: num(d.proposesParAction),
            preferentielsCumulesNonComptabilises: num(d.preferentielsCumulesNonComptabilises),
            comptabilisesParAction: num(d.comptabilisesParAction),
        },
        impotOci: cartes(b.impotOci, num),
    };
}
function motifsRefusDeclarationsNotes(d) {
    const refus = [];
    if (d.entite.sansSocieteMere === true && (d.entite.societeMere || d.entite.societeMereUltime)) {
        refus.push('Société mère · l’entité est déclarée sans société mère et une société mère est nommée (IFRS 18 § 116 c).');
    }
    if (d.continuite.retenue === true && (d.continuite.baseRetenue || d.continuite.raison)) {
        refus.push('Continuité d’exploitation · la base est déclarée retenue et une autre base est décrite (IAS 8 § 6K).');
    }
    d.methodes.forEach((m, i) => {
        if (!m.intitule || !m.texte)
            refus.push(`Méthode comptable n° ${i + 1} · un intitulé et un texte propre à l’entité (IAS 8 § 27D).`);
    });
    if (d.aucunJugement === true && d.jugements.length)
        refus.push('Jugements · « aucun » est déclaré et des jugements sont décrits (IAS 8 § 27G).');
    d.jugements.forEach((j, i) => {
        if (!j.intitule || !j.texte)
            refus.push(`Jugement n° ${i + 1} · un intitulé et une description.`);
    });
    if (d.aucuneEstimation === true && d.estimations.length)
        refus.push('Estimations · « aucune » est déclaré et des sources d’incertitude sont décrites (IAS 8 § 31A).');
    d.estimations.forEach((s, i) => {
        const rb = rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(s.rubrique);
        if (!s.nature)
            refus.push(`Source d’incertitude n° ${i + 1} · sa nature (IAS 8 § 31A a).`);
        if (!rb || rb.etat !== 'SITUATION')
            refus.push(`Source d’incertitude n° ${i + 1} · le poste de l’état de la situation financière qui porte l’actif ou le passif (IAS 8 § 31A).`);
    });
    if (d.aucuneMesurePerformance === true && d.mesuresPerformance.length) {
        refus.push('Mesures de la performance · « aucune » est déclaré et des mesures sont décrites (IFRS 18 § 117).');
    }
    d.mesuresPerformance.forEach((m, i) => {
        const nom = m.libelle || `n° ${i + 1}`;
        if (!m.libelle)
            refus.push(`Mesure de la performance n° ${i + 1} · son intitulé (§ 123).`);
        if (!m.aspect)
            refus.push(`Mesure « ${nom} » · l’aspect de la performance qu’elle communique et pourquoi il est utile (§ 123 a).`);
        if (!m.calcul)
            refus.push(`Mesure « ${nom} » · son mode de calcul (§ 123 b).`);
        if (!(m.sousTotalReference in exports.SOUS_TOTAUX_REFERENCE)) {
            refus.push(`Mesure « ${nom} » · le sous-total de référence du rapprochement, parmi ceux que le jeu présente (§ 123 c, § 118).`);
        }
        m.elements.forEach((x, j) => {
            const rb = rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(x.rubrique);
            if (!x.libelle)
                refus.push(`Mesure « ${nom} », élément n° ${j + 1} · son libellé.`);
            if (!rb || rb.etat !== 'RESULTAT')
                refus.push(`Mesure « ${nom} », élément n° ${j + 1} · le poste du compte de résultat auquel il se rapporte (B137 a).`);
            if (!(Math.abs(x.montant) > EPS))
                refus.push(`Mesure « ${nom} », élément n° ${j + 1} · un élément de rapprochement sans montant.`);
        });
    });
    if (d.capital.soumisExigencesExternes === false && (d.capital.natureExigences || d.capital.exigencesRespectees != null)) {
        refus.push('Capital · l’entité est déclarée non soumise à des exigences externes, et leur nature ou leur respect est renseigné (§ 127 a ii, d).');
    }
    if (d.capital.exigencesRespectees === true && d.capital.consequencesNonRespect) {
        refus.push('Capital · les exigences sont déclarées respectées et des conséquences de non-respect sont décrites (§ 127 e).');
    }
    if (d.sansCapitalSocial === true && d.categoriesActions.length)
        refus.push('Capital social · l’entité est déclarée sans capital social et des catégories d’actions sont décrites (§ 131).');
    d.categoriesActions.forEach((a, i) => {
        if (!a.intitule)
            refus.push(`Catégorie d’actions n° ${i + 1} · son intitulé (§ 130 a).`);
        if (a.sansValeurNominale && a.valeurNominale != null)
            refus.push(`Catégorie « ${a.intitule} » · une valeur nominale et la mention « sans valeur nominale » (§ 130 a iii).`);
    });
    for (const cle of Object.keys(d.reserves)) {
        if (!RUBRIQUES_RESERVES.includes(cle))
            refus.push(`Réserves · « ${cle} » n’est pas une rubrique de réserves des capitaux propres (§ 130 b).`);
    }
    for (const cle of Object.keys(d.impotOci)) {
        if (rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(cle)?.etat !== 'RESULTAT_GLOBAL')
            refus.push(`Impôt des autres éléments du résultat global · « ${cle} » n’est pas un poste de l’état du résultat global (§ 93).`);
    }
    return refus;
}
const r2 = (x) => Math.round(x * 100) / 100 || 0;
const EPS = 0.005;
exports.ENONCE_MESURES_PERFORMANCE = 'Les mesures de la performance définies par la direction communiquent le point de vue de la direction sur un aspect de la performance financière de l’entité dans son ensemble et elles ne sont pas nécessairement comparables aux mesures ayant des appellations ou des descriptions similaires communiquées par d’autres entités.';
function construireNotesIfrs(p) {
    const d = p.declarations;
    const motifs = [];
    const refus = motifsRefusDeclarationsNotes(d);
    for (const r of refus)
        motifs.push(`Notes · déclaration irrecevable · ${r}`);
    const notes = [];
    const manque = (texte, motif, blocs) => {
        blocs.push({ type: 'manque', texte });
        motifs.push(`Notes · ${motif}`);
    };
    const ligneDe = (etat, cle) => etat ? [...etat.situation, ...etat.resultat, ...etat.resultatGlobal].find((l) => l.cle === cle) : undefined;
    {
        const blocs = [];
        const e = d.entite;
        const champ = (libelle, declare, fiche, ref) => {
            if (declare)
                blocs.push({ type: 'texte', texte: `${libelle} · ${declare}`, source: 'DECLARE' });
            else if (fiche)
                blocs.push({ type: 'texte', texte: `${libelle} · ${fiche}`, source: 'FICHE_DOSSIER' });
            else
                manque(`${libelle} · à renseigner (${ref}).`, `${libelle.toLowerCase()} de l’entité à renseigner (IFRS 18 ${ref}).`, blocs);
        };
        blocs.push({ type: 'texte', texte: `Dénomination · ${p.ficheDossier.nom}`, source: 'FICHE_DOSSIER' });
        champ('Domicile', e.domicile, p.ficheDossier.pays, '§ 116 a');
        champ('Forme juridique', e.formeJuridique, p.ficheDossier.formeJuridique, '§ 116 a');
        champ('Pays de constitution', e.paysConstitution, p.ficheDossier.pays, '§ 116 a');
        champ('Adresse du siège social', e.adresseSiege, p.ficheDossier.adresse, '§ 116 a');
        champ('Nature des opérations et principales activités', e.natureOperations, p.ficheDossier.activite, '§ 116 b');
        if (e.sansSocieteMere === true)
            blocs.push({ type: 'texte', texte: 'L’entité n’a pas de société mère.', source: 'DECLARE' });
        else if (e.sansSocieteMere === false && e.societeMere && e.societeMereUltime) {
            blocs.push({ type: 'texte', texte: `Société mère · ${e.societeMere} · société mère ultime du groupe · ${e.societeMereUltime}`, source: 'DECLARE' });
        }
        else
            manque('Société mère et société mère ultime · non déclarées (§ 116 c).', 'société mère et société mère ultime non déclarées (IFRS 18 § 116 c).', blocs);
        if (e.dureeVieLimitee === false)
            blocs.push({ type: 'texte', texte: 'L’entité n’est pas à durée de vie limitée.', source: 'DECLARE' });
        else if (e.dureeVieLimitee === true && e.informationsDureeVie)
            blocs.push({ type: 'texte', texte: `Durée de vie · ${e.informationsDureeVie}`, source: 'DECLARE' });
        else
            manque('Durée de vie · non déclarée (§ 116 d).', 'durée de vie de l’entité non déclarée (IFRS 18 § 116 d).', blocs);
        notes.push({ cle: 'ENTITE', titre: 'Informations sur l’entité', ref: 'IFRS 18 § 116', postes: [], blocs });
    }
    let blocsBase = [];
    {
        const blocs = [];
        blocsBase = blocs;
        blocs.push({
            type: 'texte',
            texte: 'Les états IFRS sont établis EN SUS des états financiers de synthèse SYSCOHADA (AUDCIF art. 73-1) · ils partent de la balance légale, projetée sur les postes d’IFRS 18 et corrigée des retraitements décrits à la note des méthodes comptables.',
            source: 'CALCULE',
        });
        if (p.applicationAnticipee) {
            blocs.push({ type: 'texte', texte: 'IFRS 18 est appliquée par anticipation · l’exercice est ouvert avant le 1er janvier 2027 (IFRS 18 § C1).', source: 'CALCULE' });
        }
        if (p.premiereApplication) {
            blocs.push({ type: 'texte', texte: `Ces états sont les premiers états financiers IFRS de l’entité · date de transition aux IFRS le ${p.premiereApplication.dateTransition} (IFRS 1, annexe A). Voir la note sur la transition.`, source: 'CALCULE' });
        }
        const c = d.continuite;
        if (c.retenue === true && c.incertitudesSignificatives === false) {
            blocs.push({ type: 'texte', texte: 'Les états financiers sont préparés sur la base de la continuité d’exploitation.', source: 'DECLARE' });
        }
        else if (c.retenue === true && c.incertitudesSignificatives === true && c.incertitudes) {
            blocs.push({ type: 'texte', texte: `Les états financiers sont préparés sur la base de la continuité d’exploitation. Incertitudes significatives · ${c.incertitudes}`, source: 'DECLARE' });
        }
        else if (c.retenue === false && c.baseRetenue && c.raison) {
            blocs.push({ type: 'texte', texte: `Les états financiers ne sont pas préparés sur la base de la continuité d’exploitation. Base retenue · ${c.baseRetenue}. Raison · ${c.raison}`, source: 'DECLARE' });
        }
        else {
            manque('Continuité d’exploitation · appréciation de la direction non déclarée, ou incomplète (IAS 8 § 6K) · base retenue, incertitudes significatives, ou base et raison si elle n’est pas retenue.', 'appréciation de la continuité d’exploitation non déclarée ou incomplète (IAS 8 § 6K).', blocs);
        }
        blocs.push({
            type: 'texte',
            texte: 'Un écart à une disposition d’une norme IFRS (IAS 8 § 6E à 6J) n’est pas servi par OmegaX · s’il en existe un, la déclaration de conformité du § 6B se lit avec les informations du § 6F, à fournir hors du logiciel.',
            source: 'TEXTE_NORME',
        });
        notes.push({ cle: 'BASE', titre: 'Base d’établissement des états financiers', ref: 'IFRS 18 § 113 a, IAS 8 § 6A à 6L', postes: [], blocs });
    }
    {
        const blocs = [];
        for (const m of d.methodes)
            blocs.push({ type: 'texte', texte: `${m.intitule} · ${m.texte}`, source: 'DECLARE' });
        if (!d.methodes.length)
            manque('Aucune information sur les méthodes comptables n’est déclarée (IAS 8 § 27A).', 'informations significatives sur les méthodes comptables non déclarées (IAS 8 § 27A).', blocs);
        const postes = new Set();
        if (p.retraitements.length) {
            blocs.push({
                type: 'tableau',
                titre: 'Écarts de méthode avec la balance SYSCOHADA · les retraitements de l’exercice et leur fondement',
                colonnes: ['Fondement', 'Postes touchés'],
                lignes: p.retraitements.map((r) => {
                    r.lignes.forEach((l) => postes.add(l.rubrique));
                    return { libelle: r.libelle, valeurs: [r.fondement, [...new Set(r.lignes.map((l) => rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(l.rubrique)?.libelle ?? l.rubrique))].join(', ')] };
                }),
            });
        }
        notes.push({ cle: 'METHODES', titre: 'Informations significatives sur les méthodes comptables', ref: 'IFRS 18 § 113 a, IAS 8 § 27A à 27F', postes: [...postes], blocs });
    }
    {
        const blocs = [];
        for (const j of d.jugements)
            blocs.push({ type: 'texte', texte: `${j.intitule} · ${j.texte}`, source: 'DECLARE' });
        if (d.aucunJugement === true)
            blocs.push({ type: 'texte', texte: 'La direction déclare n’avoir porté aucun jugement ayant une incidence significative sur les montants comptabilisés, hors estimations.', source: 'DECLARE' });
        else if (!d.jugements.length)
            manque('Jugements · question non répondue (IAS 8 § 27G).', 'jugements de la direction non déclarés (IAS 8 § 27G).', blocs);
        notes.push({ cle: 'JUGEMENTS', titre: 'Jugements portés lors de l’application des méthodes comptables', ref: 'IAS 8 § 27G à 27I', postes: [], blocs });
    }
    {
        const blocs = [];
        const postes = new Set();
        if (d.estimations.length) {
            blocs.push({
                type: 'tableau',
                colonnes: ['Poste', 'Valeur comptable à la clôture', 'Informations'],
                lignes: d.estimations.map((s) => {
                    postes.add(s.rubrique);
                    return { libelle: s.nature, valeurs: [rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(s.rubrique)?.libelle ?? s.rubrique, s.valeurComptable, s.informations] };
                }),
            });
            d.estimations
                .filter((s) => s.valeurComptable == null)
                .forEach((s) => manque(`« ${s.nature} » · valeur comptable non déclarée (IAS 8 § 31A b).`, `valeur comptable de la source d’incertitude « ${s.nature} » non déclarée (IAS 8 § 31A b).`, blocs));
        }
        else if (d.aucuneEstimation === true) {
            blocs.push({ type: 'texte', texte: 'La direction déclare n’identifier aucune source majeure d’incertitude présentant un risque important d’ajustement significatif au cours de l’exercice suivant.', source: 'DECLARE' });
        }
        else
            manque('Sources d’incertitude relative aux estimations · question non répondue (IAS 8 § 31A).', 'sources d’incertitude relative aux estimations non déclarées (IAS 8 § 31A).', blocs);
        notes.push({ cle: 'ESTIMATIONS', titre: 'Sources d’incertitude relative aux estimations', ref: 'IAS 8 § 31A à 31H', postes: [...postes], blocs });
    }
    {
        const blocs = [];
        const postes = [];
        const n1ParCle = new Map((p.n1 ? [...p.n1.situation, ...p.n1.resultat] : []).map((l) => [l.cle, l]));
        for (const l of [...p.n.situation, ...p.n.resultat]) {
            if (l.nature !== 'POSTE' || !rubriques_ifrs_1.RUBRIQUE_PAR_CODE.has(l.cle))
                continue;
            const precedent = n1ParCle.get(l.cle);
            if (Math.abs(l.ifrs) <= EPS && Math.abs(precedent?.ifrs ?? 0) <= EPS)
                continue;
            postes.push(l.cle);
            const soldeN1 = new Map((precedent?.comptes ?? []).map((c) => [c.numero, c.solde]));
            const numeros = [...new Set([...(l.comptes ?? []).map((c) => c.numero), ...soldeN1.keys()])].sort();
            const intitules = new Map([...(precedent?.comptes ?? []), ...(l.comptes ?? [])].map((c) => [c.numero, c.intitule]));
            const soldeN = new Map((l.comptes ?? []).map((c) => [c.numero, c.solde]));
            const signe = sensDuPoste(l.cle);
            blocs.push({
                type: 'tableau',
                titre: `${l.libelle}${l.ref ? ` (${l.ref})` : ''}`,
                colonnes: ['N', 'N-1'],
                lignes: [
                    ...numeros.map((num) => ({ libelle: `${num} · ${intitules.get(num) ?? ''}`, valeurs: [r2(signe * (soldeN.get(num) ?? 0)), p.n1 ? r2(signe * (soldeN1.get(num) ?? 0)) : null] })),
                    { libelle: 'Retraitements IFRS', valeurs: [l.retraitements, precedent ? precedent.retraitements : null] },
                    { libelle: 'Montant du poste', valeurs: [l.ifrs, precedent ? precedent.ifrs : null], total: true },
                ],
            });
        }
        notes.push({ cle: 'POSTES', titre: 'Composition des postes des états financiers', ref: 'IFRS 18 § 114, § B112 c iii', postes, blocs });
    }
    const oci = p.n.resultatGlobal.filter((l) => l.nature === 'POSTE' && Math.abs(l.ifrs) > EPS);
    if (oci.length) {
        const blocs = [];
        blocs.push({
            type: 'tableau',
            titre: 'Analyse par élément et impôt relatif (§ 93, § 109)',
            colonnes: ['Montant net d’impôt', 'Impôt relatif'],
            lignes: oci.map((l) => ({ libelle: l.libelle, valeurs: [l.ifrs, d.impotOci[l.cle] ?? null] })),
        });
        const sources = p.retraitements.filter((r) => r.lignes.some((x) => rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(x.rubrique)?.etat === 'RESULTAT_GLOBAL'));
        if (sources.length) {
            blocs.push({
                type: 'tableau',
                titre: 'Origine · les retraitements déclarés',
                colonnes: ['Fondement', 'Montant'],
                lignes: sources.map((r) => ({
                    libelle: r.libelle,
                    valeurs: [r.fondement, r2(-r.lignes.filter((x) => rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(x.rubrique)?.etat === 'RESULTAT_GLOBAL').reduce((s, x) => s + x.montant, 0))],
                })),
            });
        }
        for (const l of oci.filter((x) => d.impotOci[x.cle] == null)) {
            manque(`« ${l.libelle} » · impôt relatif non déclaré (§ 93).`, `impôt relatif à « ${l.libelle} » non déclaré (IFRS 18 § 93).`, blocs);
        }
        blocs.push({ type: 'texte', texte: 'L’impôt se déclare par poste présenté · OmegaX ne connaît pas d’élément plus fin que le poste du § 89.', source: 'CALCULE' });
        notes.push({ cle: 'OCI', titre: 'Autres éléments du résultat global', ref: 'IFRS 18 § 93, § 109', postes: [...oci.map((l) => l.cle), 'SF_AUTRES_COMPOSANTES_CP', 'SF_OCI_EXERCICE'], blocs });
    }
    if (p.premiereApplication) {
        const pa = p.premiereApplication;
        const blocs = [
            { type: 'texte', texte: `Date de transition · ${pa.dateTransition}. Les rapprochements ci-dessous partent des chiffres publiés selon le SYSCOHADA (IFRS 1 § 24).`, source: 'CALCULE' },
            ...pa.rapprochements.map((r) => ({
                type: 'tableau',
                titre: `${r.titre} (${r.ref})`,
                colonnes: ['Fondement', 'Montant'],
                lignes: r.lignes.map((x) => ({ libelle: x.libelle, valeurs: [x.fondement ?? null, x.montant] })),
            })),
            ...pa.mentions.map((m) => ({ type: 'texte', texte: m, source: 'CALCULE' })),
        ];
        notes.push({ cle: 'TRANSITION', titre: 'Transition aux normes IFRS', ref: 'IFRS 1 § 23 à 26', postes: ['TOTAL_CAPITAUX_PROPRES', 'RESULTAT_GLOBAL'], blocs });
    }
    if (d.mesuresPerformance.length) {
        const blocs = [{ type: 'texte', texte: exports.ENONCE_MESURES_PERFORMANCE, source: 'TEXTE_NORME' }];
        const postes = new Set();
        for (const m of d.mesuresPerformance) {
            const ref = ligneDe(p.n, m.sousTotalReference);
            const refN1 = ligneDe(p.n1, m.sousTotalReference);
            const somme = r2(m.elements.reduce((s, x) => s + x.montant, 0));
            m.elements.forEach((x) => postes.add(x.rubrique));
            if (ref)
                postes.add(m.sousTotalReference);
            blocs.push({ type: 'texte', texte: `${m.libelle} · ${m.aspect}`, source: 'DECLARE' });
            blocs.push({ type: 'texte', texte: `Mode de calcul · ${m.calcul}`, source: 'DECLARE' });
            const mN1 = p.declarationsN1?.mesuresPerformance.find((x) => x.libelle === m.libelle) ?? null;
            const n1Etabli = !!(p.n1 && refN1 && mN1);
            const elementN1 = (libelle) => (n1Etabli ? mN1.elements.filter((y) => y.libelle === libelle).reduce((s, y) => s + y.montant, 0) : null);
            const libellesN1Seuls = n1Etabli ? mN1.elements.filter((y) => !m.elements.some((x) => x.libelle === y.libelle)) : [];
            blocs.push({
                type: 'tableau',
                titre: `Rapprochement avec ${exports.SOUS_TOTAUX_REFERENCE[m.sousTotalReference] ?? m.sousTotalReference} (§ 123 c, d)`,
                colonnes: ['Poste', 'N', 'N-1', 'Incidence fiscale N', 'Participations ne donnant pas le contrôle'],
                lignes: [
                    { libelle: exports.SOUS_TOTAUX_REFERENCE[m.sousTotalReference] ?? m.sousTotalReference, valeurs: [null, ref ? ref.ifrs : null, n1Etabli ? refN1.ifrs : null, null, null] },
                    ...m.elements.map((x) => ({
                        libelle: x.description ? `${x.libelle} · ${x.description}` : x.libelle,
                        valeurs: [rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(x.rubrique)?.libelle ?? x.rubrique, x.montant, elementN1(x.libelle), x.effetImpot, 'Sans objet · comptes individuels'],
                    })),
                    ...libellesN1Seuls.map((y) => ({ libelle: y.libelle, valeurs: [rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(y.rubrique)?.libelle ?? y.rubrique, null, y.montant, null, 'Sans objet · comptes individuels'] })),
                    {
                        libelle: m.libelle,
                        valeurs: [null, ref ? r2(ref.ifrs + somme) : null, n1Etabli ? r2(refN1.ifrs + mN1.elements.reduce((s, y) => s + y.montant, 0)) : null, null, null],
                        total: true,
                    },
                ],
            });
            if (m.methodeImpot)
                blocs.push({ type: 'texte', texte: `Détermination de l’incidence fiscale (§ 123 e, B141) · ${m.methodeImpot}`, source: 'DECLARE' });
            else if (m.elements.length)
                manque(`« ${m.libelle} » · méthode de l’incidence fiscale non décrite (§ 123 e).`, `méthode de détermination de l’incidence fiscale de « ${m.libelle} » non décrite (IFRS 18 § 123 e).`, blocs);
            for (const x of m.elements.filter((y) => y.effetImpot == null)) {
                manque(`« ${m.libelle} », « ${x.libelle} » · incidence fiscale non déclarée (§ 123 d).`, `incidence fiscale de l’élément « ${x.libelle} » de « ${m.libelle} » non déclarée (IFRS 18 § 123 d).`, blocs);
            }
            if (m.changement)
                blocs.push({ type: 'texte', texte: `Changement (§ 124) · ${m.changement}`, source: 'DECLARE' });
            if (!ref)
                manque(`« ${m.libelle} » · le sous-total de référence n’est pas présenté par le jeu.`, `sous-total de référence de « ${m.libelle} » introuvable.`, blocs);
            if (p.n1 && !n1Etabli && !m.changement) {
                manque(`« ${m.libelle} » · comparatif N-1 non déclaré · déclarez la mesure sur l’exercice précédent, ou décrivez l’ajout et, s’il est impraticable de retraiter le comparatif, dites-le (§ 124 c, § 125).`, `comparatif de la mesure « ${m.libelle} » non déclaré (IFRS 18 § 124 c, § 125).`, blocs);
            }
        }
        notes.push({ cle: 'MPM', titre: 'Mesures de la performance définies par la direction', ref: 'IFRS 18 § 117 à 125', postes: [...postes], blocs });
    }
    else if (d.aucuneMesurePerformance !== true) {
        motifs.push('Notes · mesures de la performance définies par la direction · question non répondue (IFRS 18 § 117) · déclarez les sous-totaux que l’entité communique hors des états financiers, ou qu’il n’y en a aucun.');
    }
    {
        const blocs = [];
        const k = d.capital;
        const exiger = (v, libelle, ref) => {
            if (v)
                blocs.push({ type: 'texte', texte: `${libelle} · ${v}`, source: 'DECLARE' });
            else
                manque(`${libelle} · à déclarer (${ref}).`, `${libelle.toLowerCase()} · à déclarer (IFRS 18 ${ref}).`, blocs);
        };
        exiger(k.description, 'Ce que l’entité gère comme capital', '§ 127 a i');
        exiger(k.commentObjectifsAtteints, 'Comment l’entité atteint ses objectifs de gestion du capital', '§ 127 a iii');
        if (k.soumisExigencesExternes === false)
            blocs.push({ type: 'texte', texte: 'L’entité n’est soumise à aucune exigence en matière de capital imposée de l’extérieur.', source: 'DECLARE' });
        else if (k.soumisExigencesExternes === true) {
            exiger(k.natureExigences, 'Exigences imposées de l’extérieur et leur intégration à la gestion du capital', '§ 127 a ii');
            if (k.exigencesRespectees === true)
                blocs.push({ type: 'texte', texte: 'L’entité s’est conformée, durant l’exercice, aux exigences en matière de capital imposées de l’extérieur.', source: 'DECLARE' });
            else if (k.exigencesRespectees === false)
                exiger(k.consequencesNonRespect, 'Conséquences du non-respect des exigences externes', '§ 127 e');
            else
                manque('Respect des exigences externes · non déclaré (§ 127 d).', 'respect des exigences externes en matière de capital non déclaré (IFRS 18 § 127 d).', blocs);
        }
        else
            manque('Exigences externes en matière de capital · question non répondue (§ 127 a ii, d).', 'exigences externes en matière de capital non déclarées (IFRS 18 § 127 a ii, d).', blocs);
        exiger(k.changements, 'Changements par rapport à l’exercice précédent', '§ 127 c');
        const cpN = p.n.situation.find((l) => l.cle === 'TOTAL_CAPITAUX_PROPRES')?.ifrs ?? null;
        const cpN1 = p.n1?.situation.find((l) => l.cle === 'TOTAL_CAPITAUX_PROPRES')?.ifrs ?? null;
        if (k.quantitatif.length) {
            blocs.push({
                type: 'tableau',
                titre: 'Données quantitatives sur ce qui est géré comme capital (§ 127 b)',
                colonnes: ['N', 'N-1'],
                lignes: [
                    ...k.quantitatif.map((x) => ({ libelle: x.libelle, valeurs: [x.montantN, x.montantN1] })),
                    { libelle: 'Pour rapprochement · total des capitaux propres IFRS de l’état de la situation financière', valeurs: [cpN, cpN1] },
                ],
            });
        }
        else
            manque('Données quantitatives sur le capital géré · non déclarées (§ 127 b) · ce que l’entité gère comme capital peut différer de ses capitaux propres.', 'données quantitatives sur le capital géré non déclarées (IFRS 18 § 127 b).', blocs);
        blocs.push({ type: 'texte', texte: 'Ces informations se fondent sur celles communiquées en interne aux principaux dirigeants (§ 128).', source: 'TEXTE_NORME' });
        notes.push({ cle: 'CAPITAL', titre: 'Gestion du capital', ref: 'IFRS 18 § 126 à 129', postes: ['TOTAL_CAPITAUX_PROPRES'], blocs });
    }
    {
        const blocs = [];
        if (d.sansCapitalSocial === true) {
            if (d.informationsEquivalentes)
                blocs.push({ type: 'texte', texte: d.informationsEquivalentes, source: 'DECLARE' });
            else
                manque('Entité sans capital social · les informations équivalentes du § 131 ne sont pas déclarées.', 'informations équivalentes du § 131 non déclarées (entité sans capital social).', blocs);
        }
        else if (d.categoriesActions.length) {
            blocs.push({
                type: 'tableau',
                titre: 'Catégories de capital (§ 130 a)',
                colonnes: d.categoriesActions.map((a) => a.intitule),
                lignes: [
                    { libelle: 'Actions autorisées (i)', valeurs: d.categoriesActions.map((a) => a.autorisees) },
                    { libelle: 'Émises et entièrement libérées (ii)', valeurs: d.categoriesActions.map((a) => a.emisesLiberees) },
                    { libelle: 'Émises et non entièrement libérées (ii)', valeurs: d.categoriesActions.map((a) => a.emisesNonLiberees) },
                    { libelle: 'Valeur nominale (iii)', valeurs: d.categoriesActions.map((a) => (a.sansValeurNominale ? 'Sans valeur nominale' : a.valeurNominale)) },
                    { libelle: 'En circulation à l’ouverture (iv)', valeurs: d.categoriesActions.map((a) => a.enCirculationOuverture) },
                    { libelle: 'En circulation à la clôture (iv)', valeurs: d.categoriesActions.map((a) => a.enCirculationCloture) },
                    { libelle: 'Droits, privilèges et restrictions (v)', valeurs: d.categoriesActions.map((a) => a.droitsRestrictions) },
                    { libelle: 'Détenues par l’entité, ses filiales ou entreprises associées (vi)', valeurs: d.categoriesActions.map((a) => a.autoDetenues) },
                    { libelle: 'Réservées pour options et contrats de vente (vii)', valeurs: d.categoriesActions.map((a) => a.reserveesOptions) },
                ],
            });
            for (const a of d.categoriesActions) {
                const manquants = [
                    a.autorisees == null && 'i',
                    (a.emisesLiberees == null || a.emisesNonLiberees == null) && 'ii',
                    a.valeurNominale == null && !a.sansValeurNominale && 'iii',
                    (a.enCirculationOuverture == null || a.enCirculationCloture == null) && 'iv',
                    a.droitsRestrictions == null && 'v',
                    a.autoDetenues == null && 'vi',
                    a.reserveesOptions == null && 'vii',
                ].filter(Boolean);
                if (manquants.length) {
                    manque(`« ${a.intitule} » · informations non déclarées au § 130 a ${manquants.join(', ')}.`, `catégorie de capital « ${a.intitule} » incomplète (IFRS 18 § 130 a ${manquants.join(', ')}).`, blocs);
                }
            }
        }
        else {
            manque('Capital social · catégories d’actions non déclarées, ou entité sans capital social non dite (§ 130 a, § 131).', 'catégories de capital non déclarées (IFRS 18 § 130 a, § 131).', blocs);
        }
        const presentes = p.n.situation.filter((l) => RUBRIQUES_RESERVES.includes(l.cle) && Math.abs(l.ifrs) > EPS);
        for (const l of presentes) {
            const t = d.reserves[l.cle];
            if (t)
                blocs.push({ type: 'texte', texte: `${l.libelle} · ${t}`, source: 'DECLARE' });
            else
                manque(`« ${l.libelle} » · nature et objet non décrits (§ 130 b).`, `nature et objet de la réserve « ${l.libelle} » non décrits (IFRS 18 § 130 b).`, blocs);
        }
        notes.push({ cle: 'CAPITAL_SOCIAL', titre: 'Capital et réserves', ref: 'IFRS 18 § 130, § 131', postes: ['SF_CAPITAL', ...presentes.map((l) => l.cle)], blocs });
    }
    {
        const blocs = [];
        const dv = d.dividendes;
        const avecActions = d.sansCapitalSocial === false || d.categoriesActions.length > 0;
        const lignes = [
            { libelle: 'Dividendes proposés ou déclarés, non comptabilisés en distribution (§ 132 a)', valeurs: [dv.proposesNonComptabilises] },
        ];
        if (avecActions)
            lignes.push({ libelle: 'Montant correspondant par action (§ 132 a)', valeurs: [dv.proposesParAction] });
        lignes.push({ libelle: 'Dividendes préférentiels cumulés non comptabilisés (§ 132 b)', valeurs: [dv.preferentielsCumulesNonComptabilises] });
        if (p.distributionsDeclarees && avecActions)
            lignes.push({ libelle: 'Dividendes comptabilisés en distribution, par action (§ 110)', valeurs: [dv.comptabilisesParAction] });
        blocs.push({ type: 'tableau', colonnes: ['Montant'], lignes });
        if (dv.proposesNonComptabilises == null)
            manque('Dividendes proposés non comptabilisés · question non répondue (§ 132 a) · zéro est une réponse.', 'dividendes proposés ou déclarés non comptabilisés non déclarés (IFRS 18 § 132 a).', blocs);
        if (avecActions && (dv.proposesNonComptabilises ?? 0) > EPS && dv.proposesParAction == null) {
            manque('Montant par action des dividendes proposés · non déclaré (§ 132 a).', 'montant par action des dividendes proposés non déclaré (IFRS 18 § 132 a).', blocs);
        }
        if (dv.preferentielsCumulesNonComptabilises == null)
            manque('Dividendes préférentiels cumulés · question non répondue (§ 132 b).', 'dividendes préférentiels cumulés non comptabilisés non déclarés (IFRS 18 § 132 b).', blocs);
        if (p.distributionsDeclarees && avecActions && dv.comptabilisesParAction == null) {
            manque('Dividendes par action de l’exercice · non déclarés (§ 110).', 'montant par action des dividendes comptabilisés non déclaré (IFRS 18 § 110).', blocs);
        }
        notes.push({ cle: 'DIVIDENDES', titre: 'Dividendes', ref: 'IFRS 18 § 110, § 132', postes: ['SF_RESERVES'], blocs });
    }
    notes.push({
        cle: 'NON_SERVI',
        titre: 'Informations exigées par les autres normes IFRS',
        ref: 'IFRS 18 § 113 b',
        postes: [],
        blocs: [
            {
                type: 'manque',
                texte: 'Les informations requises par chaque norme IFRS appliquée (par exemple IFRS 7, IFRS 16, IAS 12, IAS 16, IAS 7 § 43 et § 44A) ne sont pas servies par OmegaX · elles dépendent des normes qui s’appliquent au dossier. Le jeu n’est pas publiable tant qu’elles ne sont pas jointes.',
            },
        ],
    });
    {
        const conformite = [];
        if (d.conformiteDeclaree === true && p.motifsJeu.length === 0 && motifs.length === 0) {
            conformite.push({ type: 'texte', texte: 'Les états financiers sont conformes aux normes IFRS de comptabilité.', source: 'DECLARE' });
        }
        else if (d.conformiteDeclaree === true) {
            conformite.push({
                type: 'manque',
                texte: 'Déclaration de conformité aux normes IFRS · déclarée par l’entité et NON IMPRIMÉE · IAS 8 § 6B, « l’entité ne doit décrire des états financiers comme étant conformes aux normes IFRS de comptabilité que s’ils sont conformes à toutes les dispositions ». Ce jeu ne l’est pas encore · voir les motifs de non-publication.',
            });
        }
        else if (d.conformiteDeclaree === false) {
            manque('L’entité ne déclare pas la conformité de ses états aux normes IFRS · ils ne peuvent pas être présentés comme des états IFRS (IAS 8 § 6B).', 'la conformité aux normes IFRS n’est pas déclarée par l’entité (IAS 8 § 6B).', conformite);
        }
        else
            manque('Déclaration de conformité · question non répondue (IAS 8 § 6B).', 'déclaration de conformité aux normes IFRS non répondue (IAS 8 § 6B).', conformite);
        blocsBase.unshift(...conformite);
    }
    const numerotees = notes.map((x, i) => ({ ...x, numero: i + 1 }));
    const renvois = {};
    for (const x of numerotees)
        for (const cle of new Set(x.postes))
            (renvois[cle] ??= []).push(x.numero);
    return { notes: numerotees, renvois, motifsNonPubliable: motifs };
}
function sensDuPoste(cle) {
    const r = rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(cle);
    return r?.section?.startsWith('ACTIF') ? 1 : -1;
}
//# sourceMappingURL=notes-ifrs.js.map