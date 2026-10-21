"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISSUE_ORIGINE_NON_VENTILEE = exports.CLASSE_DES_CHARGES_DE_PERSONNEL = exports.PLAFOND_LIGNES_REPARTITION = void 0;
exports.enPointsDeBase = enPointsDeBase;
exports.motifRefusRepartition = motifRefusRepartition;
exports.versionDuMois = versionDuMois;
exports.cleDeLaLigne = cleDeLaLigne;
exports.partsDesBulletins = partsDesBulletins;
exports.ventilerLaPaie = ventilerLaPaie;
exports.issueDeLaCause = issueDeLaCause;
const bulletin_paie_1 = require("./bulletin-paie");
const comptabilisation_paie_1 = require("./comptabilisation-paie");
const passation_paie_1 = require("./passation-paie");
const od_analytique_1 = require("../analytique/od-analytique");
exports.PLAFOND_LIGNES_REPARTITION = 50;
exports.CLASSE_DES_CHARGES_DE_PERSONNEL = '6';
function enPointsDeBase(pourcentage) {
    if (!Number.isFinite(pourcentage))
        return null;
    const points = Math.round(pourcentage * 100);
    return Math.abs(points - pourcentage * 100) < 1e-6 ? points : null;
}
function motifRefusRepartition(params) {
    const { plan, sections, lignes, moisEffet } = params;
    if (!(0, bulletin_paie_1.moisValide)(moisEffet))
        return "Mois d'effet illisible · la forme attendue est AAAA-MM.";
    if (!plan)
        return 'Plan analytique introuvable dans ce dossier.';
    if (!plan.estActif)
        return `Le plan ${plan.code} est en sommeil · il ne reçoit plus de ventilation.`;
    const refusClasse = (0, od_analytique_1.motifRefusClasseVentilee)(exports.CLASSE_DES_CHARGES_DE_PERSONNEL, plan.classesVentilees);
    if (refusClasse)
        return `Plan ${plan.code} · ${refusClasse} La répartition de la paie ventile les charges de personnel.`;
    if (lignes.length > exports.PLAFOND_LIGNES_REPARTITION) {
        return `Une répartition porte au plus ${exports.PLAFOND_LIGNES_REPARTITION} sections.`;
    }
    if (lignes.length === 0)
        return null;
    const vues = new Set();
    let points = 0;
    for (const [i, l] of lignes.entries()) {
        const s = sections.find((x) => x.id === l.sectionId);
        if (!s || s.planId !== plan.id)
            return `Ligne ${i + 1} · la section n'appartient pas au plan ${plan.code}.`;
        if (s.estTotal) {
            return `Ligne ${i + 1} · ${s.code} est une rubrique (section Total) · elle totalise ses sections, elle ne reçoit rien.`;
        }
        if (!s.estActive)
            return `Ligne ${i + 1} · la section ${s.code} est en sommeil.`;
        if (vues.has(s.id))
            return `Ligne ${i + 1} · la section ${s.code} est déjà répartie plus haut.`;
        vues.add(s.id);
        const p = enPointsDeBase(l.pourcentage);
        if (p === null)
            return `Ligne ${i + 1} · pourcentage illisible (deux décimales au plus).`;
        if (p <= 0 || p > 10_000)
            return `Ligne ${i + 1} · un pourcentage est strictement positif et au plus 100.`;
        points += p;
    }
    if (points !== 10_000) {
        return `Les pourcentages font ${(points / 100).toFixed(2)} % · une répartition fait exactement 100 %, sans quoi une part de la charge ne serait portée par aucune section.`;
    }
    return null;
}
function versionDuMois(versions, salarieId, planId, mois) {
    let retenue = null;
    for (const v of versions) {
        if (v.salarieId !== salarieId || v.planId !== planId || v.moisEffet > mois)
            continue;
        if (!retenue || v.moisEffet > retenue.moisEffet)
            retenue = v;
    }
    return retenue;
}
function cleDeLaLigne(l, referentiel) {
    if (l.bloc === 'REPRISE_EN_NEGATIF')
        return null;
    const total = comptabilisation_paie_1.TOTAL_DU_BLOC[l.bloc];
    if (!l.negatif && l.compte === (0, passation_paie_1.compteDuRole)(total.role, referentiel) && l.sens === total.sens)
        return `${l.bloc}|TOTAL`;
    return `${l.bloc}|${l.compte}|${l.sens}`;
}
function partsDesBulletins(bulletins, referentiel) {
    const parts = new Map();
    const ajouter = (cle, bulletinId, centimes) => {
        const m = parts.get(cle) ?? new Map();
        m.set(bulletinId, (m.get(bulletinId) ?? 0) + centimes);
        parts.set(cle, m);
    };
    for (const b of bulletins) {
        const entree = (0, comptabilisation_paie_1.entreeDuBulletin)(b, referentiel);
        if (!entree)
            continue;
        const v = (0, passation_paie_1.passationPaie)(entree);
        if (v.refus.length > 0)
            continue;
        for (const l of v.lignes) {
            const total = comptabilisation_paie_1.TOTAL_DU_BLOC[l.bloc];
            if (l.compte === (0, passation_paie_1.compteDuRole)(total.role, referentiel) && l.sens === total.sens)
                continue;
            const centimes = Math.round(l.montantFc * 100);
            ajouter(`${l.bloc}|${l.compte}|${l.sens}`, b.id, centimes);
            ajouter(`${l.bloc}|TOTAL`, b.id, centimes);
        }
    }
    return parts;
}
function divisionPlancher(a, d) {
    const q = a / d;
    return a % d !== 0n && (a < 0n) !== (d < 0n) ? q - 1n : q;
}
function auPlusFortReste(exactes, total, codeDe) {
    const rendus = new Map();
    const restes = [];
    let distribue = 0;
    for (const [sectionId, exacte] of exactes) {
        const base = divisionPlancher(exacte, 10000n);
        rendus.set(sectionId, Number(base));
        distribue += Number(base);
        restes.push({ sectionId, reste: exacte - base * 10000n });
    }
    restes.sort((a, b) => (a.reste === b.reste ? codeDe(a.sectionId).localeCompare(codeDe(b.sectionId)) : a.reste > b.reste ? -1 : 1));
    for (let i = 0; i < total - distribue && restes.length > 0; i++) {
        const s = restes[i % restes.length].sectionId;
        rendus.set(s, (rendus.get(s) ?? 0) + 1);
    }
    return rendus;
}
function ventilerLaPaie(params) {
    const { mois, referentiel, lignes, bulletins, plans, sections, versions } = params;
    const reprises = params.reprises ?? [];
    const parLigne = lignes.map(() => []);
    const nonVentilees = [];
    const reserves = [];
    const parts = partsDesBulletins(bulletins, referentiel);
    const rejoues = reprises.filter((r) => r.mode === 'REJEU').flatMap((r) => r.bulletins.map((b) => ({ b, reprise: r })));
    const partsRejouees = partsDesBulletins(rejoues.map((x) => x.b), referentiel);
    const repriseDuRejoue = new Map(rejoues.map((x) => [x.b.id, x.reprise]));
    const partsDesPortes = new Map(reprises.map((r) => [r, partsDesBulletins(r.portes ?? [], referentiel)]));
    const exactes = reprises.filter((r) => r.mode === 'EXACTE').map((r) => r.origine);
    const bulletinDe = new Map(bulletins.map((b) => [b.id, b]));
    const sectionDe = new Map(sections.map((s) => [s.id, s]));
    const codeDe = (id) => sectionDe.get(id)?.code ?? id;
    const enUsage = (sectionId, planId) => {
        const s = sectionDe.get(sectionId);
        return !!s && s.planId === planId && !s.estTotal && s.estActive;
    };
    const ventilationDOrigine = (origine, compte, sens, plan) => {
        const piece = `pièce d'origine n° ${origine.numeroPiece ?? '·'}`;
        const lignesO = origine.lignes.filter((x) => x.compte === compte && Math.round((sens === 'DEBIT' ? x.debit : x.credit) * 100) !== 0);
        let montant = 0;
        const parSection = new Map();
        for (const x of lignesO) {
            const m = Math.round((sens === 'DEBIT' ? x.debit : x.credit) * 100);
            montant += m;
            const surLePlan = (x.ventilations ?? []).filter((v) => v.planId === plan.id);
            const ventile = surLePlan.reduce((n, v) => n + Math.round(v.montant * 100), 0);
            if (surLePlan.length === 0 || ventile !== m) {
                return { cause: 'ORIGINE_NON_VENTILEE', texte: `la ligne ${compte} de la ${piece} n'est pas ventilée en totalité sur ce plan` };
            }
            for (const v of surLePlan) {
                if (!enUsage(v.sectionId, plan.id)) {
                    return {
                        cause: 'SECTION_HORS_USAGE',
                        texte: `la section ${codeDe(v.sectionId)} de la ${piece} est en sommeil ou n'est plus une section Détail`,
                    };
                }
                parSection.set(v.sectionId, (parSection.get(v.sectionId) ?? 0) + Math.round(v.montant * 100));
            }
        }
        if (lignesO.length === 0)
            return { cause: 'ORIGINE_NON_VENTILEE', texte: `la ${piece} ne porte aucune ligne ${compte} de ce sens` };
        return { montant, parSection };
    };
    const refaireLOrigine = (reprise, cle, o, plan) => {
        const nonRefaite = {
            cause: 'ORIGINE_NON_RECONSTITUEE',
            texte: `la ventilation de la pièce d'origine n° ${reprise.origine.numeroPiece ?? '·'} ne se refait pas par les répartitions de ses bulletins`,
        };
        const parts = partsDesPortes.get(reprise)?.get(cle) ?? new Map();
        if ([...parts.values()].reduce((n, c) => n + c, 0) !== o.montant)
            return nonRefaite;
        const parBulletin = new Map();
        const somme = new Map();
        for (const b of reprise.portes ?? []) {
            const centimes = parts.get(b.id) ?? 0;
            if (centimes === 0)
                continue;
            const version = versionDuMois(versions.filter((v) => v.planId === plan.id), b.salarieId, plan.id, mois);
            if (!version || version.lignes.length === 0)
                return nonRefaite;
            const siennes = new Map();
            for (const r of version.lignes) {
                const points = enPointsDeBase(r.pourcentage);
                if (points === null)
                    return nonRefaite;
                const exacte = BigInt(centimes) * BigInt(points);
                siennes.set(r.sectionId, (siennes.get(r.sectionId) ?? 0n) + exacte);
                somme.set(r.sectionId, (somme.get(r.sectionId) ?? 0n) + exacte);
            }
            parBulletin.set(b.id, siennes);
        }
        const refaite = auPlusFortReste(somme, o.montant, codeDe);
        const sections = new Set([...refaite.keys(), ...o.parSection.keys()]);
        for (const sectionId of sections) {
            if ((refaite.get(sectionId) ?? 0) !== (o.parSection.get(sectionId) ?? 0))
                return nonRefaite;
        }
        return parBulletin;
    };
    for (const plan of plans.filter((p) => p.estActif)) {
        const declarees = versions.filter((v) => v.planId === plan.id);
        const aVentiler = lignes
            .map((l, index) => ({ l, index }))
            .filter(({ l }) => (0, od_analytique_1.motifRefusClasseVentilee)(l.compte.charAt(0), plan.classesVentilees) === null);
        if (aVentiler.length === 0)
            continue;
        const sansRepartition = new Set();
        const repartitionVide = new Set();
        const sectionsHorsUsage = new Set();
        let aucuneRepartition = 0;
        for (const { l, index } of aVentiler) {
            const nonVentilee = (cause, motif) => {
                if (cause === 'ORIGINE_NON_VENTILEE' && declarees.length === 0) {
                    aucuneRepartition += 1;
                    cause = 'AUCUNE_REPARTITION_DU_PLAN';
                    motif = 'aucune répartition de la paie déclarée sur ce plan';
                }
                nonVentilees.push({ index, compte: l.compte, intitule: l.intitule, planCode: plan.code, cause, motif, issue: issueDeLaCause(cause) });
            };
            const total = Math.round(l.montantFc * 100);
            const exactesDeLaLigne = new Map();
            const ajouter = (sectionId, centimesFois10000) => exactesDeLaLigne.set(sectionId, (exactesDeLaLigne.get(sectionId) ?? 0n) + centimesFois10000);
            if (l.bloc === 'REPRISE_EN_NEGATIF') {
                let refus = null;
                for (const origine of exactes) {
                    if (!origine.lignes.some((x) => x.compte === l.compte && Math.round((l.sens === 'DEBIT' ? x.debit : x.credit) * 100) !== 0))
                        continue;
                    const o = ventilationDOrigine(origine, l.compte, l.sens, plan);
                    if ('cause' in o) {
                        refus = o;
                        break;
                    }
                    for (const [sectionId, c] of o.parSection)
                        ajouter(sectionId, -BigInt(c) * 10000n);
                }
                const somme = [...exactesDeLaLigne.values()].reduce((n, x) => n + x, 0n);
                if (refus)
                    nonVentilee(refus.cause, refus.texte);
                else if (somme !== BigInt(total) * 10000n || somme === 0n)
                    nonVentilee('PART_ILLISIBLE', 'la reprise ne se relit pas sur ses pièces d’origine');
                else
                    poser(index, plan, auPlusFortReste(exactesDeLaLigne, total, codeDe));
                continue;
            }
            const cle = cleDeLaLigne(l, referentiel);
            const positives = l.negatif ? new Map() : (parts.get(cle) ?? new Map());
            const negatives = l.negatif || cle.endsWith('|TOTAL') ? (partsRejouees.get(cle) ?? new Map()) : new Map();
            const somme = [...positives.values()].reduce((n, c) => n + c, 0) - [...negatives.values()].reduce((n, c) => n + c, 0);
            if (somme !== total || total === 0) {
                nonVentilee('PART_ILLISIBLE', 'les parts des bulletins ne refont pas la ligne au centime');
                continue;
            }
            const manquants = [];
            let motif = null;
            if ([...positives.values()].some((c) => c !== 0) && declarees.length === 0) {
                aucuneRepartition += 1;
                nonVentilee('AUCUNE_REPARTITION_DU_PLAN', 'aucune répartition de la paie déclarée sur ce plan');
                continue;
            }
            for (const [bulletinId, centimes] of positives) {
                if (centimes === 0)
                    continue;
                const b = bulletinDe.get(bulletinId);
                const version = versionDuMois(declarees, b.salarieId, plan.id, mois);
                if (!version) {
                    manquants.push(b.nomComplet);
                    sansRepartition.add(b.nomComplet);
                    continue;
                }
                if (version.lignes.length === 0) {
                    repartitionVide.add(b.nomComplet);
                    motif = { cause: 'REPARTITION_VIDE', texte: `${b.nomComplet} n'est plus réparti sur ce plan depuis ${version.moisEffet}` };
                    continue;
                }
                for (const r of version.lignes) {
                    const s = sectionDe.get(r.sectionId);
                    if (!s || !enUsage(r.sectionId, plan.id)) {
                        sectionsHorsUsage.add(s?.code ?? r.sectionId);
                        motif = {
                            cause: 'SECTION_HORS_USAGE',
                            texte: `la section ${s?.code ?? r.sectionId} de la répartition de ${b.nomComplet} est en sommeil ou n'est plus une section Détail`,
                        };
                        continue;
                    }
                    const points = enPointsDeBase(r.pourcentage);
                    if (points === null) {
                        motif = { cause: 'SECTION_HORS_USAGE', texte: `la part de la section ${s.code} dans la répartition de ${b.nomComplet} est illisible` };
                        continue;
                    }
                    ajouter(s.id, BigInt(centimes) * BigInt(points));
                }
            }
            for (const [bulletinId, centimes] of negatives) {
                if (centimes === 0 || motif)
                    continue;
                const reprise = repriseDuRejoue.get(bulletinId);
                if (!reprise) {
                    motif = { cause: 'PART_ILLISIBLE', texte: 'la pièce d’origine d’un bulletin annulé n’est pas lue' };
                    continue;
                }
                const o = ventilationDOrigine(reprise.origine, l.compte, l.sens, plan);
                if ('cause' in o) {
                    motif = o;
                    continue;
                }
                const refaite = refaireLOrigine(reprise, cle, o, plan);
                if ('cause' in refaite) {
                    motif = refaite;
                    continue;
                }
                for (const [sectionId, exacte] of refaite.get(bulletinId) ?? new Map())
                    ajouter(sectionId, -exacte);
            }
            if (manquants.length > 0) {
                nonVentilee('SANS_REPARTITION', `sans répartition · ${manquants.join(', ')}`);
                continue;
            }
            if (motif) {
                nonVentilee(motif.cause, motif.texte);
                continue;
            }
            poser(index, plan, auPlusFortReste(exactesDeLaLigne, total, codeDe));
        }
        if (aucuneRepartition > 0) {
            reserves.push(`Plan ${plan.code} · aucune répartition de la paie n'y est déclarée · ${aucuneRepartition} ligne(s) de l'écriture, ` +
                'dans une classe que le plan ventile, partent sans ventilation (Registre du personnel, Répartition analytique).');
        }
        if (sansRepartition.size > 0) {
            reserves.push(`Plan ${plan.code} · ${[...sansRepartition].join(', ')} n'a (n'ont) aucune répartition en vigueur pour ${mois} · ` +
                'les lignes où sa part entre partent sans ventilation sur ce plan, rien n’étant réparti au prorata des autres.');
        }
        if (repartitionVide.size > 0) {
            reserves.push(`Plan ${plan.code} · ${[...repartitionVide].join(', ')} n'est (ne sont) plus réparti(s) sur ce plan · les lignes où sa part entre partent sans ventilation.`);
        }
        if (sectionsHorsUsage.size > 0) {
            reserves.push(`Plan ${plan.code} · la (les) section(s) ${[...sectionsHorsUsage].join(', ')} d'une répartition est (sont) en sommeil ou n'est (ne sont) plus Détail · ` +
                'déclarez une nouvelle répartition ; les lignes concernées partent sans ventilation.');
        }
    }
    if (nonVentilees.some((n) => n.cause === 'ORIGINE_NON_VENTILEE')) {
        reserves.push(exports.ISSUE_ORIGINE_NON_VENTILEE);
    }
    return { parLigne, nonVentilees, reserves };
    function poser(index, plan, rendus) {
        for (const [sectionId, centimes] of [...rendus].sort((a, b) => codeDe(a[0]).localeCompare(codeDe(b[0])))) {
            if (centimes === 0)
                continue;
            parLigne[index].push({ planId: plan.id, planCode: plan.code, sectionId, sectionCode: codeDe(sectionId), montantFc: centimes / 100 });
        }
    }
}
exports.ISSUE_ORIGINE_NON_VENTILEE = "REPRISE EN NÉGATIF · la pièce d'origine n'est pas ventilée sur le plan nommé, et la reprise se ventile comme elle. " +
    "Ventilez d'abord la pièce d'origine (Ventilation d'une ligne), si son exercice est ouvert et sa période non close ; " +
    "sinon, levez l'obligation de ventilation du plan (Plans analytiques), passez la paie, ventilez la reprise ligne à ligne, " +
    "puis rétablissez l'obligation.";
function issueDeLaCause(cause) {
    switch (cause) {
        case 'AUCUNE_REPARTITION_DU_PLAN':
        case 'SANS_REPARTITION':
        case 'REPARTITION_VIDE':
            return 'Déclarez la répartition des salariés nommés (Registre du personnel, Répartition analytique).';
        case 'SECTION_HORS_USAGE':
            return 'Déclarez une nouvelle répartition sur des sections Détail actives, ou réactivez la section nommée.';
        case 'ORIGINE_NON_VENTILEE':
            return exports.ISSUE_ORIGINE_NON_VENTILEE;
        case 'ORIGINE_NON_RECONSTITUEE':
        case 'PART_ILLISIBLE':
            return "Levez l'obligation de ventilation du plan (Plans analytiques), passez la paie, ventilez la ligne à la main en reprenant la part du bulletin annulé, puis rétablissez l'obligation.";
    }
}
//# sourceMappingURL=ventilation-analytique-paie.js.map