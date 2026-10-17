"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const correspondance_bilan_syscohada_1 = require("./correspondance-bilan-syscohada");
const correspondance_compte_resultat_syscohada_1 = require("./correspondance-compte-resultat-syscohada");
const correspondance_notes_syscohada_1_1 = require("./correspondance-notes-syscohada-1");
const FEUILLES = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.typeCompte !== 'TOTAL');
const FEUILLES_BILAN = FEUILLES.filter((c) => /^[1-5]/.test(c.numero));
const COLONNES_CONNUES = [
    'EXERCICE_N', 'EXERCICE_N1', 'VARIATION_VALEUR', 'VARIATION_POURCENT', 'VARIATION_VALEUR_ABSOLUE',
    'OUVERTURE', 'AUGMENTATIONS', 'DIMINUTIONS', 'CLOTURE',
    'VIREMENTS_AUGMENTATION', 'VIREMENTS_DIMINUTION', 'REEVALUATION',
    'AUGMENTATION_EXPLOITATION', 'AUGMENTATION_FINANCIERE', 'AUGMENTATION_HAO',
    'DIMINUTION_EXPLOITATION', 'DIMINUTION_FINANCIERE', 'DIMINUTION_HAO',
    'ECHEANCE_1AN', 'ECHEANCE_2ANS', 'ECHEANCE_PLUS_2ANS', 'LIBRE',
];
const etiquette = (spec) => `${spec.code}${spec.sousTableau ? ` · ${spec.sousTableau}` : ''}`;
function prefixesCites() {
    const out = [];
    for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
        for (const r of spec.rubriques) {
            r.comptes?.forEach((p) => out.push({ note: etiquette(spec), rubrique: r.libelle, prefixe: p, role: 'comptes' }));
            r.exclusions?.forEach((p) => out.push({ note: etiquette(spec), rubrique: r.libelle, prefixe: p, role: 'exclusions' }));
        }
    }
    return out;
}
const noteUnique = (code, sousTableau) => {
    const s = correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1.find((n) => n.code === code && (sousTableau === undefined || n.sousTableau === sousTableau));
    if (!s)
        throw new Error(`note ${code} ${sousTableau ?? ''} absente`);
    return s;
};
const poste = (ref) => {
    const p = [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA].find((x) => x.ref === ref);
    if (!p)
        throw new Error(`poste ${ref} absent du bilan SYSCOHADA`);
    return p;
};
const rubriquesChiffrees = (spec, negatives) => spec.rubriques.filter((r) => (r.comptes?.length ?? 0) > 0 && !!r.presenterEnNegatif === negatives);
const capteParRubriques = (numero, rubriques) => rubriques.some((r) => (0, etats_financiers_communs_1.correspond)(numero, r.comptes ?? [], r.exclusions));
describe('correspondance des notes annexes SYSCOHADA · tranche 1 (AUDCIF Titre IX ch. 6 et ch. 7)', () => {
    it('transcrit exactement les codes de la tranche, ni un de plus ni un de moins', () => {
        const transcrits = [...new Set(correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1.map((n) => n.code))];
        expect([...transcrits].sort()).toEqual([...correspondance_notes_syscohada_1_1.CODES_NOTES_SYSCOHADA_1].sort());
        expect(correspondance_notes_syscohada_1_1.CODES_NOTES_SYSCOHADA_1).toEqual([
            '1', '2', '3A', '3B', '3C', '3D', '3E', '3F', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15A', '15B',
        ]);
        expect(correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1.some((n) => n.code === '8A')).toBe(false);
    });
    it('aucun tableau en double · un code seul, ou un code et son sous-tableau', () => {
        const cles = correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1.map((n) => `${n.code}::${n.sousTableau ?? ''}`);
        expect(new Set(cles).size).toBe(cles.length);
    });
    it('une note à plusieurs tableaux les nomme TOUS · sinon deux tableaux se confondent', () => {
        const parCode = new Map();
        for (const n of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1)
            parCode.set(n.code, (parCode.get(n.code) ?? 0) + 1);
        for (const n of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
            const multiple = (parCode.get(n.code) ?? 0) > 1;
            expect({ code: n.code, nomme: !multiple || !!n.sousTableau }).toEqual({ code: n.code, nomme: true });
        }
        for (const code of ['1', '4', '5', '12'])
            expect(parCode.get(code)).toBe(2);
    });
    it('un total ne référence jamais une rubrique qui vient APRÈS lui · sinon le calcul en une passe lirait 0', () => {
        for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
            spec.rubriques.forEach((r, i) => {
                for (const idx of [...(r.totalDeRubriques ?? []), ...(r.moinsRubriques ?? [])]) {
                    expect({ note: etiquette(spec), rubrique: r.libelle, avant: idx < i }).toEqual({ note: etiquette(spec), rubrique: r.libelle, avant: true });
                }
            });
        }
    });
    it('un total ne compte jamais deux fois la même ligne, ni directement ni par un sous-total', () => {
        for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
            const feuillesDe = (i, vues = new Set()) => {
                const r = spec.rubriques[i];
                if (!r.totalDeRubriques)
                    return vues.add(i);
                for (const j of r.totalDeRubriques)
                    feuillesDe(j, vues);
                return vues;
            };
            spec.rubriques.forEach((r, i) => {
                if (!r.totalDeRubriques)
                    return;
                const feuilles = r.totalDeRubriques.flatMap((j) => [...feuillesDe(j)]);
                expect({ note: etiquette(spec), total: r.libelle, doublons: feuilles.length - new Set(feuilles).size }).toEqual({ note: etiquette(spec), total: r.libelle, doublons: 0 });
                expect(i).toBeGreaterThan(Math.max(...r.totalDeRubriques));
            });
        }
    });
    it('une rubrique porte soit des comptes, soit un total, soit une subdivision attendue, soit une saisie · jamais rien', () => {
        for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
            for (const r of spec.rubriques) {
                const definie = (r.comptes?.length ?? 0) > 0 || r.totalDeRubriques !== undefined || r.subdivisionAttendue !== undefined || r.saisie === true;
                expect({ note: etiquette(spec), rubrique: r.libelle, definie }).toEqual({ note: etiquette(spec), rubrique: r.libelle, definie: true });
            }
        }
    });
    it('toute rubrique en attente de rattachement porte une clé stable, unique dans sa note', () => {
        const parCode = new Map();
        for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
            for (const r of spec.rubriques) {
                if (r.subdivisionAttendue) {
                    expect({ note: etiquette(spec), libelle: r.libelle, cle: r.cle ?? null }).toEqual(expect.objectContaining({ cle: expect.any(String) }));
                }
                if (r.cle)
                    parCode.set(spec.code, [...(parCode.get(spec.code) ?? []), r.cle]);
            }
        }
        for (const [code, cles] of parCode) {
            expect({ code, uniques: new Set(cles).size === cles.length }).toEqual({ code, uniques: true });
        }
    });
    it('une rubrique en SAISIE n’est jamais confondue avec une rubrique en attente de rattachement, et ne porte pas de comptes', () => {
        for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
            for (const r of spec.rubriques) {
                expect({ note: etiquette(spec), r: r.libelle, cumul: !!(r.saisie && r.subdivisionAttendue) }).toEqual({ note: etiquette(spec), r: r.libelle, cumul: false });
                expect({ note: etiquette(spec), r: r.libelle, comptes: !!(r.saisie && r.comptes?.length) }).toEqual({ note: etiquette(spec), r: r.libelle, comptes: false });
            }
        }
    });
    it('une note hors balance ne cite aucun compte · sinon elle serait calculée et la mention « à renseigner » fausse', () => {
        for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1.filter((n) => n.horsBalance)) {
            expect({ note: etiquette(spec), comptes: spec.rubriques.some((r) => (r.comptes?.length ?? 0) > 0) }).toEqual({ note: etiquette(spec), comptes: false });
            expect(spec.rubriques.length).toBeGreaterThan(0);
        }
        const horsBalance = correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1.filter((n) => n.horsBalance).map(etiquette).sort();
        expect(horsBalance).toEqual(['1 · ENGAGEMENTS FINANCIERS', '2', '3D', '3E', '3F', '4 · LISTE DES FILIALES ET PARTICIPATIONS'].sort());
    });
    it('sens et natureCreditrice ne se cumulent jamais : l’un filtre, l’autre non', () => {
        for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
            for (const r of spec.rubriques) {
                expect({ note: etiquette(spec), r: r.libelle, cumul: !!(r.sens && r.natureCreditrice) }).toEqual({ note: etiquette(spec), r: r.libelle, cumul: false });
            }
        }
    });
    it('toute colonne déclarée est d’un type que le moteur calcule ou présente, et chaque note a un titre', () => {
        for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
            expect(spec.colonnes.length).toBeGreaterThan(0);
            expect(spec.titre.trim().length).toBeGreaterThan(0);
            for (const c of spec.colonnes) {
                expect({ note: etiquette(spec), colonne: c.libelle, connue: COLONNES_CONNUES.includes(c.type) }).toEqual({ note: etiquette(spec), colonne: c.libelle, connue: true });
            }
            const libelles = spec.colonnes.map((c) => c.libelle);
            expect(new Set(libelles).size).toBe(libelles.length);
        }
    });
    it('un tableau de situations et mouvements déclare A, B, C et D ensemble, et le sens d’accroissement des amortissements', () => {
        for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
            const types = spec.colonnes.map((c) => c.type);
            const mouvement = ['OUVERTURE', 'AUGMENTATIONS', 'DIMINUTIONS', 'CLOTURE'].filter((t) => types.includes(t));
            expect({ note: etiquette(spec), colonnes: mouvement.length === 0 || mouvement.length === 4 }).toEqual({ note: etiquette(spec), colonnes: true });
        }
        expect(noteUnique('3A').sensAccroissement).toBeUndefined();
        expect(noteUnique('3B').sensAccroissement).toBeUndefined();
        expect(noteUnique('3C').sensAccroissement).toBe('CREDIT');
    });
    it('chaque compte cité existe au plan SYSCOHADA semé · un préfixe fantôme ne capterait rien, en silence', () => {
        for (const cite of prefixesCites()) {
            const existe = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.some((c) => c.numero.startsWith(cite.prefixe));
            expect({ ...cite, existe }).toEqual({ ...cite, existe: true });
            const feuille = FEUILLES.some((c) => c.numero.startsWith(cite.prefixe));
            expect({ ...cite, feuille }).toEqual({ ...cite, feuille: true });
        }
    });
    it('une exclusion est toujours contenue dans un préfixe de la même rubrique · sinon elle est lettre morte', () => {
        for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
            for (const r of spec.rubriques) {
                for (const e of r.exclusions ?? []) {
                    const couverte = (r.comptes ?? []).some((p) => e.startsWith(p));
                    expect({ note: etiquette(spec), rubrique: r.libelle, exclusion: e, couverte }).toEqual({ note: etiquette(spec), rubrique: r.libelle, exclusion: e, couverte: true });
                }
            }
        }
    });
    it('dans une même note, une feuille du plan n’est captée que par UNE rubrique chiffrée · sinon elle serait comptée deux fois', () => {
        for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
            const chiffrees = spec.rubriques.filter((r) => (r.comptes?.length ?? 0) > 0);
            for (const c of FEUILLES_BILAN) {
                const captantes = chiffrees.filter((r) => (0, etats_financiers_communs_1.correspond)(c.numero, r.comptes ?? [], r.exclusions));
                const sens = new Set(captantes.map((r) => r.sens ?? (r.natureCreditrice ? 'CREDITEUR' : 'DEBITEUR')));
                expect({ note: etiquette(spec), compte: c.numero, doublon: captantes.length > sens.size }).toEqual({ note: etiquette(spec), compte: c.numero, doublon: false });
            }
        }
    });
    describe('recoupement note ↔ poste de bilan (ch. 7) · une note documente un poste, elle doit en couvrir les comptes', () => {
        const paires = [
            {
                note: noteUnique('3A'),
                brut: ['AE', 'AF', 'AG', 'AH', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AP', 'AR', 'AS'],
                deprec: [],
            },
            { note: noteUnique('4', 'IMMOBILISATIONS FINANCIÈRES'), brut: ['AR', 'AS'], deprec: ['AR', 'AS'] },
            { note: noteUnique('5', 'ACTIF CIRCULANT HAO'), brut: ['BA'], deprec: ['BA'] },
            { note: noteUnique('5', 'DETTES CIRCULANTES HAO'), brut: ['DH'], deprec: [] },
            { note: noteUnique('6'), brut: ['BB'], deprec: ['BB'] },
            { note: noteUnique('7'), brut: ['BI', 'DI'], deprec: ['BI'] },
            { note: noteUnique('8'), brut: ['BJ'], deprec: ['BJ'], horsPoste: ['186', '187', '188'] },
            { note: noteUnique('9'), brut: ['BQ'], deprec: ['BQ'] },
            { note: noteUnique('10'), brut: ['BR'], deprec: ['BR'] },
            { note: noteUnique('11'), brut: ['BS'], deprec: ['BS'] },
            { note: noteUnique('12', 'ÉCARTS DE CONVERSION'), brut: ['BU', 'DV'], deprec: [] },
            { note: noteUnique('13'), brut: ['CA', 'CB'], deprec: [] },
            { note: noteUnique('14'), brut: ['CD', 'CF', 'CG', 'CH'], deprec: [] },
            { note: noteUnique('15A'), brut: ['CL', 'CM'], deprec: [] },
            { note: noteUnique('1', 'DETTES GARANTIES PAR DES SÛRETÉS RÉELLES'), brut: ['DA', 'DB', 'DJ', 'DI', 'DK', 'DM'], deprec: [] },
        ];
        it.each(paires.map((p) => [etiquette(p.note), p]))('note %s', (_, { note, brut, deprec, horsPoste }) => {
            const postesBrut = brut.map(poste);
            const postesDeprec = deprec.map(poste);
            const rubBrut = deprec.length ? rubriquesChiffrees(note, false) : note.rubriques.filter((r) => (r.comptes?.length ?? 0) > 0);
            const rubDeprec = deprec.length ? rubriquesChiffrees(note, true) : [];
            for (const c of FEUILLES_BILAN) {
                const dansPosteBrut = postesBrut.some((p) => (0, etats_financiers_communs_1.correspond)(c.numero, p.comptes, p.exclusions));
                const dansPosteDeprec = postesDeprec.some((p) => p.comptesAmortissement !== undefined && (0, etats_financiers_communs_1.correspond)(c.numero, p.comptesAmortissement, p.exclusionsAmortissement));
                const dansNoteBrut = capteParRubriques(c.numero, rubBrut);
                const dansNoteDeprec = capteParRubriques(c.numero, rubDeprec);
                const tolere = (horsPoste ?? []).some((p) => c.numero.startsWith(p));
                expect({ compte: c.numero, posteBrut: dansPosteBrut, noteBrut: dansNoteBrut || !dansPosteBrut }).toEqual({ compte: c.numero, posteBrut: dansPosteBrut, noteBrut: true });
                expect({ compte: c.numero, posteDeprec: dansPosteDeprec, noteDeprec: dansNoteDeprec || !dansPosteDeprec }).toEqual({ compte: c.numero, posteDeprec: dansPosteDeprec, noteDeprec: true });
                expect({ compte: c.numero, noteBrut: dansNoteBrut, posteBrut: dansPosteBrut || tolere || !dansNoteBrut }).toEqual({ compte: c.numero, noteBrut: dansNoteBrut, posteBrut: true });
                expect({ compte: c.numero, noteDeprec: dansNoteDeprec, posteDeprec: dansPosteDeprec || !dansNoteDeprec }).toEqual({ compte: c.numero, noteDeprec: dansNoteDeprec, posteDeprec: true });
            }
        });
        it('les comptes que la note 8 capte hors de BJ sont exactement les orphelins justifiés du bilan (186, 187, 188)', () => {
            const justifies = correspondance_bilan_syscohada_1.COMPTES_BILAN_SANS_POSTE_JUSTIFIES.map((c) => c.prefixe).filter((p) => p.startsWith('18'));
            expect(justifies.sort()).toEqual(['186', '187', '188']);
        });
    });
    describe('lettre du texte officiel, vérifiée ligne à ligne', () => {
        it('la note 1 renvoie chaque dette à la note qui la détaille (article 15, référence croisée)', () => {
            const n1 = noteUnique('1', 'DETTES GARANTIES PAR DES SÛRETÉS RÉELLES');
            const chiffrees = n1.rubriques.filter((r) => (r.comptes?.length ?? 0) > 0);
            for (const r of chiffrees)
                expect({ r: r.libelle, renvoi: r.renvoi }).toEqual(expect.objectContaining({ renvoi: expect.any(String) }));
            expect(n1.rubriques.at(-1)?.libelle).toBe('TOTAL (1) + (2) + (3)');
        });
        it('la note 3A distingue les immeubles de placement que le bilan ne montre qu’en renvoi', () => {
            const n3a = noteUnique('3A');
            const placement = n3a.rubriques.filter((r) => r.libelle.endsWith('immeuble de placement') && !r.libelle.includes('hors'));
            expect(placement.map((r) => r.comptes)).toEqual([['2281'], ['2315', '2325']]);
            const horsPlacement = n3a.rubriques.filter((r) => r.libelle.includes('hors immeuble de placement'));
            expect(horsPlacement.map((r) => r.exclusions)).toEqual([['2281'], ['2315', '2325']]);
        });
        it('anomalie n° 3 : les lignes incorporelles de la note 3B sont en saisie, jamais rattachées ni en attente', () => {
            const n3b = noteUnique('3B');
            const incorporelles = n3b.rubriques.slice(0, 3);
            expect(incorporelles.every((r) => r.saisie === true && !r.comptes && !r.subdivisionAttendue)).toBe(true);
            const cites = n3b.rubriques.flatMap((r) => r.comptes ?? []).sort();
            expect(cites).toEqual(['2286', '2316', '2326', '2416', '2426', '2446', '2456']);
        });
        it('la note 3C ne prend que les amortissements (28x) · les dépréciations (29x) relèvent de la note 28', () => {
            const cites = noteUnique('3C').rubriques.flatMap((r) => [...(r.comptes ?? []), ...(r.exclusions ?? [])]);
            expect(cites.every((p) => p.startsWith('28'))).toBe(true);
            const rub = rubriquesChiffrees(noteUnique('3C'), false);
            for (const c of FEUILLES_BILAN.filter((c) => c.numero.startsWith('28'))) {
                expect({ compte: c.numero, capte: capteParRubriques(c.numero, rub) }).toEqual({ compte: c.numero, capte: true });
            }
        });
        it('anomalie n° 10 : les deux lignes « immeuble de placement » de la 3C sont en SAISIE, jamais rattachables', () => {
            const placement = noteUnique('3C').rubriques.filter((r) => r.libelle.endsWith('immeuble de placement') && !r.libelle.includes('hors'));
            expect(placement.map((r) => r.libelle)).toEqual([
                'Terrains - immeuble de placement',
                'Bâtiments - immeuble de placement',
            ]);
            for (const r of placement) {
                expect({ r: r.libelle, saisie: r.saisie, attente: r.subdivisionAttendue, comptes: r.comptes }).toEqual({
                    r: r.libelle,
                    saisie: true,
                    attente: undefined,
                    comptes: undefined,
                });
                expect(r.renvoi).toContain('compté deux fois');
            }
            expect(noteUnique('3C').rubriques.some((r) => r.subdivisionAttendue)).toBe(false);
        });
        it('anomalie n° 7 : TOUS les 52x et 53x de la note 11 sont filtrés au débit, comme le bilan les transfère en DR', () => {
            const n11 = noteUnique('11');
            const interets = n11.rubriques.filter((r) => r.libelle.includes('intérêts courus'));
            expect(interets.map((r) => [r.comptes, r.sens])).toEqual([
                [['526'], 'DEBITEUR'],
                [['536'], 'DEBITEUR'],
            ]);
            const bancaires = n11.rubriques.filter((r) => (r.comptes ?? []).some((p) => /^5[23]/.test(p)));
            expect(bancaires.every((r) => r.sens === 'DEBITEUR')).toBe(true);
            expect(bancaires.flatMap((r) => r.comptes ?? []).sort()).toEqual(['52', '521', '522', '525', '526', '53', '531', '536']);
            expect(n11.renvoiOfficiel).toContain('en négatif si le compte principal attaché est débiteur');
        });
        it('la note 8 isole le compte transitoire 475 et exclut LES DEUX écarts de conversion, comme le poste BJ', () => {
            const n8 = noteUnique('8');
            const transitoire = n8.rubriques.find((r) => r.libelle.startsWith('Compte transitoire'));
            expect(transitoire?.comptes).toEqual(['475']);
            const divers = n8.rubriques.find((r) => r.libelle === 'Autres débiteurs divers');
            expect(divers?.exclusions).toEqual(['475', '478', '479']);
            expect(n8.rubriques.filter((r) => r.comptes && !r.presenterEnNegatif).every((r) => r.sens === 'DEBITEUR')).toBe(true);
        });
        it('la note 15A renvoie la provision spéciale de réévaluation à la note 3E', () => {
            const ligne = noteUnique('15A').rubriques.find((r) => r.libelle === 'Provision spéciale de réévaluation');
            expect(ligne).toEqual(expect.objectContaining({ comptes: ['154'], renvoi: '3E' }));
        });
        it('anomalie n° 8 : la note 15B ne rattache que 167 et 1613, le reste attend un sous-compte du dossier', () => {
            const n15b = noteUnique('15B');
            const cites = n15b.rubriques.flatMap((r) => r.comptes ?? []).sort();
            expect(cites).toEqual(['1613', '167']);
            const enAttente = n15b.rubriques.filter((r) => r.subdivisionAttendue).map((r) => r.cle);
            expect(enAttente).toEqual(['titres-participatifs', 'titres-subordonnes-duree-indeterminee', 'autres-fonds-propres']);
        });
        it('les renvois croisés couvrent tous les postes du bilan du ch. 3 qui renvoient à une note de la tranche', () => {
            const attendus = [
                'AD', 'AI', 'AP', 'AQ', 'BA', 'BB', 'BI', 'BJ', 'BQ', 'BR', 'BS', 'BU',
                'CA', 'CB', 'CD', 'CE', 'CF', 'CG', 'CH', 'CL', 'CM', 'DH', 'DI', 'DV',
            ];
            const renvoyes = new Set(correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1.flatMap((n) => n.renvoyeeDepuis ?? []));
            for (const ref of attendus)
                expect({ ref, renvoye: renvoyes.has(ref) }).toEqual({ ref, renvoye: true });
        });
        it('tout code de renvoi croisé existe au bilan ou au compte de résultat SYSCOHADA', () => {
            const connus = new Set([
                ...correspondance_bilan_syscohada_1.ORDRE_AFFICHAGE_ACTIF_SYSCOHADA,
                ...correspondance_bilan_syscohada_1.ORDRE_AFFICHAGE_PASSIF_SYSCOHADA,
                ...correspondance_compte_resultat_syscohada_1.ORDRE_AFFICHAGE_COMPTE_RESULTAT,
            ]);
            for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
                for (const ref of spec.renvoyeeDepuis ?? []) {
                    expect({ note: etiquette(spec), ref, connu: connus.has(ref) }).toEqual({ note: etiquette(spec), ref, connu: true });
                }
            }
        });
        it('anomalie n° 16 : aucun renvoi croisé INVENTÉ · seuls ceux du ch. 3 et des gloses du ch. 6', () => {
            const attendu = {
                '3A': ['AD', 'AI', 'AP'],
                '3C': ['AD', 'AI', 'AP', 'RL', 'RN'],
                '3D': ['TN', 'RO'],
                '3E': ['CE'],
                '4': ['AQ'],
                '5': ['BA', 'DH'],
                '6': ['BB', 'RB', 'TE', 'RD', 'RF'],
                '7': ['BI', 'DI'],
                '8': ['BJ'],
                '9': ['BQ'],
                '10': ['BR'],
                '11': ['BS'],
                '12': ['BU', 'DV', 'TI', 'TM'],
                '13': ['CA', 'CB'],
                '14': ['CD', 'CF', 'CG', 'CH'],
                '15A': ['CL', 'CM'],
            };
            const parCode = new Map();
            for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1) {
                parCode.set(spec.code, [...(parCode.get(spec.code) ?? []), ...(spec.renvoyeeDepuis ?? [])]);
            }
            for (const [code, refs] of parCode) {
                expect({ code, refs: [...refs].sort() }).toEqual({ code, refs: [...(attendu[code] ?? [])].sort() });
            }
            for (const spec of correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1.filter((n) => n.code === '1' || n.code === '15B')) {
                expect({ note: etiquette(spec), renvois: spec.renvoyeeDepuis }).toEqual({ note: etiquette(spec), renvois: undefined });
            }
        });
        it('anomalie n° 5 : « Variation en valeur absolue » est la variation en MONTANT, pas un Math.abs', () => {
            for (const code of ['14', '15A', '15B']) {
                const colonne = noteUnique(code).colonnes.find((c) => c.libelle === 'Variation en valeur absolue');
                expect({ code, colonne: colonne?.type }).toEqual({ code, colonne: 'VARIATION_VALEUR' });
            }
            const absolues = correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1.flatMap((n) => n.colonnes.filter((c) => c.type === 'VARIATION_VALEUR_ABSOLUE').map((c) => `${etiquette(n)} · ${c.libelle}`));
            expect(absolues).toEqual([]);
        });
        it('anomalie n° 11 : le 109 de la note 13 est LU AU CRÉDIT, donc présenté en moins comme CB au bilan', () => {
            const n13 = noteUnique('13');
            const nonAppele = n13.rubriques.find((r) => r.libelle === 'Apporteurs, capital non appelé');
            expect(nonAppele).toEqual(expect.objectContaining({ comptes: ['109'], natureCreditrice: true }));
            expect('presenterEnNegatif' in (nonAppele ?? {})).toBe(false);
            expect(poste('CB').sens).toBe('PASSIF');
            expect(poste('CB').comptes).toEqual(['109']);
            const total = n13.rubriques.find((r) => r.libelle === 'TOTAL');
            expect(total?.totalDeRubriques).toBeUndefined();
            expect(total?.comptes).toEqual(poste('CA').comptes);
            expect(total?.renvoi).toContain('n’est donc pas la somme arithmétique');
        });
        it('les lignes résiduelles sont écrites « préfixe sauf … » · un sous-compte créé par le dossier reste dans la note', () => {
            const cas = [
                { note: noteUnique('4', 'IMMOBILISATIONS FINANCIÈRES'), ref: 'AS', invente: '27900000', rubrique: 'Prêts et créances' },
                { note: noteUnique('9'), ref: 'BQ', invente: '50700000', rubrique: 'Autres valeurs assimilés' },
                { note: noteUnique('10'), ref: 'BR', invente: '51600000', rubrique: 'Autres valeurs à encaisser' },
                { note: noteUnique('11'), ref: 'BS', invente: '52700000', rubrique: 'Autres banques' },
                { note: noteUnique('11'), ref: 'BS', invente: '53400000', rubrique: 'Autres établissement financiers' },
                { note: noteUnique('14'), ref: 'CD', invente: '10550000', rubrique: 'Autres primes' },
                { note: noteUnique('15A'), ref: 'CL', invente: '14200000', rubrique: 'Autres' },
            ];
            for (const { note, ref, invente, rubrique } of cas) {
                const p = poste(ref);
                expect({ ref, invente, dansPoste: (0, etats_financiers_communs_1.correspond)(invente, p.comptes, p.exclusions) }).toEqual({ ref, invente, dansPoste: true });
                const captantes = note.rubriques.filter((r) => (r.comptes?.length ?? 0) > 0 && (0, etats_financiers_communs_1.correspond)(invente, r.comptes, r.exclusions));
                expect({ invente, captantes: captantes.map((r) => r.libelle) }).toEqual({ invente, captantes: [rubrique] });
            }
        });
        it('anomalie n° 6 : la note 4 SIGNALE sur la ligne les comptes que le modèle n’a pas de ligne pour recevoir', () => {
            const pretsEtCreances = noteUnique('4', 'IMMOBILISATIONS FINANCIÈRES').rubriques.find((r) => r.libelle === 'Prêts et créances');
            expect((0, etats_financiers_communs_1.correspond)('27710000', pretsEtCreances.comptes, pretsEtCreances.exclusions)).toBe(true);
            expect((0, etats_financiers_communs_1.correspond)('27840000', pretsEtCreances.comptes, pretsEtCreances.exclusions)).toBe(true);
            expect(pretsEtCreances?.renvoi).toContain('2784');
            expect(pretsEtCreances?.renvoi).toContain('2785');
        });
        it('anomalie n° 15 : la note 1 dit pourquoi les intérêts courus des deux blocs ne sont pas traités pareil', () => {
            const n1 = noteUnique('1', 'DETTES GARANTIES PAR DES SÛRETÉS RÉELLES');
            const locationAcquisition = n1.rubriques.filter((r) => (r.comptes ?? []).some((p) => p.startsWith('17')));
            expect(locationAcquisition.map((r) => r.comptes)).toEqual([
                ['172', '1762'],
                ['173', '1763'],
                ['174', '1764'],
                ['178', '1768'],
            ]);
            for (const c of FEUILLES_BILAN.filter((c) => c.numero.startsWith('17'))) {
                expect({ compte: c.numero, capte: capteParRubriques(c.numero, locationAcquisition) }).toEqual({ compte: c.numero, capte: true });
            }
            const residuelle = n1.rubriques.find((r) => r.libelle === 'Autres dettes financières');
            expect((0, etats_financiers_communs_1.correspond)('16610000', residuelle.comptes, residuelle.exclusions)).toBe(true);
            expect((0, etats_financiers_communs_1.correspond)('16620000', residuelle.comptes, residuelle.exclusions)).toBe(true);
        });
    });
});
//# sourceMappingURL=correspondance-notes-syscohada-1.spec.js.map