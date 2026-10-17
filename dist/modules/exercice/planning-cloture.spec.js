"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const moitie_capital_1 = require("../controles/moitie-capital");
const correspondance_retenues_1 = require("../retenues/correspondance-retenues");
const planning_cloture_1 = require("./planning-cloture");
const regles_affectation_1 = require("../affectation/regles-affectation");
const correspondance_inventaire_syscohada_1 = require("../documents-obligatoires/correspondance-inventaire-syscohada");
const conditions_ong_etrangere_1 = require("../accord-cadre/conditions-ong-etrangere");
const correspondance_retenues_2 = require("../retenues/correspondance-retenues");
const iso = (d) => d.toISOString().slice(0, 10);
describe('planning de clôture', () => {
    const finExerciceCivil = new Date(Date.UTC(2026, 11, 31));
    const parLibelle = (fragment) => planning_cloture_1.JALONS_CLOTURE.find((j) => j.libelle.includes(fragment));
    it('cale les dépôts congolais sur les mois annoncés par le cours, pour un exercice civil', () => {
        const echeance = (fragment) => iso((0, planning_cloture_1.dateJalon)(finExerciceCivil, parLibelle(fragment).echeance));
        expect(echeance('Ministère de la Justice')).toBe('2027-01-31');
        expect(echeance('Déclarations fiscales')).toBe('2027-04-30');
        expect(echeance('Économie nationale')).toBe('2027-06-15');
        expect(echeance('approbation des comptes')).toBe('2027-06-30');
        expect(echeance('CPCC')).toBe('2027-06-30');
        expect(echeance('RCCM')).toBe('2027-07-31');
    });
    it("décale tout le planning quand l'exercice ne se clôt pas au 31 décembre", () => {
        const finJuin = new Date(Date.UTC(2026, 5, 30));
        expect(iso((0, planning_cloture_1.dateJalon)(finJuin, parLibelle('Déclarations fiscales').echeance))).toBe('2026-10-31');
    });
    it('tombe sur le bon dernier jour de février, bissextile compris', () => {
        const finOctobre = new Date(Date.UTC(2027, 9, 31));
        expect(iso((0, planning_cloture_1.dateJalon)(finOctobre, { moisApres: 4, jour: 'FIN' }))).toBe('2028-02-29');
        expect(iso((0, planning_cloture_1.dateJalon)(new Date(Date.UTC(2026, 9, 31)), { moisApres: 4, jour: 'FIN' }))).toBe('2027-02-28');
    });
    it('classe les jalons par échéance croissante, comme un planning se lit', () => {
        const echeances = planning_cloture_1.JALONS_CLOTURE.map((j) => (0, planning_cloture_1.dateJalon)(finExerciceCivil, j.echeance).getTime());
        expect(echeances).toEqual([...echeances].sort((a, b) => a - b));
    });
    it('ordonne les jalons et fait tenir chaque échéance après son début', () => {
        const etapes = planning_cloture_1.JALONS_CLOTURE.map((j) => j.etape);
        expect(etapes).toEqual([...etapes].sort((a, b) => a - b));
        for (const j of planning_cloture_1.JALONS_CLOTURE) {
            expect((0, planning_cloture_1.dateJalon)(finExerciceCivil, j.echeance).getTime()).toBeGreaterThanOrEqual((0, planning_cloture_1.dateJalon)(finExerciceCivil, j.debut).getTime());
        }
    });
    it('cite une source pour chaque jalon', () => {
        for (const j of planning_cloture_1.JALONS_CLOTURE) {
            expect(j.source.length).toBeGreaterThan(10);
        }
    });
    it("ne contient aucun taux ni montant d'astreinte", () => {
        const texte = planning_cloture_1.JALONS_CLOTURE.map((j) => `${j.libelle} ${j.detail} ${j.source}`).join(' ');
        const sansJourFranc = texte.replace(/jours francs|délai n’est pas franc/g, '');
        expect(sansJourFranc).not.toMatch(/\bFC\b|FCFA|\bCDF\b|franc/i);
        expect(texte).not.toMatch(/\d[\d\s.]*,\d{2}\b/);
        for (const j of planning_cloture_1.JALONS_CLOTURE) {
            if (/%/.test(`${j.libelle} ${j.detail}`)) {
                expect(j.source).toMatch(/art\.|article/i);
            }
        }
    });
    it('marque comme LEGALE toute échéance opposable à un tiers', () => {
        const legaux = planning_cloture_1.JALONS_CLOTURE.filter((j) => j.nature === 'LEGALE').map((j) => j.libelle);
        expect(legaux).toEqual([
            'Compte annuel et liste des membres effectifs au Ministère de la Justice',
            'Conventions poursuivies · information du commissaire aux comptes (SARL)',
            'Déclaration semestrielle relative aux ressources',
            'Livre d’inventaire',
            'Livre d’inventaire',
            'Budget et comptes annuels au ministre du secteur (établissement d’utilité publique)',
            'Accord-cadre et main-d’œuvre locale (ONG de droit étranger)',
            'Registre des donateurs arrêté',
            'Déclarations fiscales annuelles',
            'Déclarations fiscales annuelles',
            'Déclaration annuelle des revenus (personne physique)',
            'Rapport de gestion',
            'Rapport de gestion',
            'États financiers et rapport de gestion aux commissaires aux comptes',
            'Mise à disposition de l’auditeur',
            'Rapport d’activité au Ministère du Plan et au ministère du secteur',
            'Dépôt au Ministère de l’Économie nationale',
            'Dépôt au Ministère de l’Économie nationale',
            'Approbation des états financiers et du rapport de gestion',
            'Approbation des états financiers et du rapport de gestion',
            'Approbation des états financiers et du rapport de gestion',
            'Dépôt des états financiers SYCEBNL au CPCC',
            'Dépôt des états financiers au CPCC',
            'Assemblée générale statuant sur les états financiers',
            'Assemblée générale statuant sur les états financiers',
            'Assemblée générale statuant sur les états financiers',
            'Dépôt des états financiers au RCCM',
            'Affectation du résultat',
            'Affectation du résultat',
        ]);
    });
});
describe('jalons applicables selon la forme juridique', () => {
    const libelles = (c) => (0, planning_cloture_1.jalonsApplicables)(c).map((j) => j.libelle);
    const asbl = {
        referentiel: client_1.Referentiel.SYCEBNL,
        formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
        droitEtranger: false,
    };
    it("ne propose jamais le RCCM à une ASBL : elle n'est pas commerçante", () => {
        expect(libelles(asbl).some((l) => l.includes('RCCM'))).toBe(false);
    });
    it('donne à une ASBL le dépôt du compte annuel au Ministère de la Justice', () => {
        expect(libelles(asbl).some((l) => l.includes('Ministère de la Justice'))).toBe(true);
    });
    it("ne présente aucun jalon comme un dépôt d'états financiers à la DGI", () => {
        const fiscal = planning_cloture_1.JALONS_CLOTURE.find((j) => j.libelle.includes('Déclarations fiscales'));
        expect(fiscal.libelle).toBe('Déclarations fiscales annuelles');
        expect(fiscal.detail).toContain('Une ASBL exemptée ne dépose donc ni déclaration d’impôt sur les sociétés ni liasse à la DGI');
        expect(fiscal.detail).toContain('joint à sa déclaration ses états financiers SYCEBNL (art. 13, al. 4)');
        const depots = planning_cloture_1.JALONS_CLOTURE.filter((j) => j.libelle.toLowerCase().startsWith('dépôt'));
        expect(depots.some((j) => /DGI|fiscal|impôts/i.test(j.libelle))).toBe(false);
    });
    it('réserve le rapport au Ministère du Plan aux ONG', () => {
        expect(libelles(asbl).some((l) => l.includes('Ministère du Plan'))).toBe(false);
        const ong = { ...asbl, formeJuridique: client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE };
        expect(libelles(ong).some((l) => l.includes('Ministère du Plan'))).toBe(true);
    });
    it('bascule sur le circuit commercial pour un dossier SYSCOHADA', () => {
        const entreprise = {
            ...asbl,
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
        };
        const l = libelles(entreprise);
        expect(l.some((x) => x.includes('RCCM'))).toBe(true);
        expect(l.some((x) => x.includes('Ministère de la Justice'))).toBe(false);
        expect(l.some((x) => x.includes('donateurs'))).toBe(false);
    });
    const syscohada = (forme) => ({
        referentiel: client_1.Referentiel.SYSCOHADA,
        formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
        formeJuridiqueSyscohada: forme ?? null,
        droitEtranger: false,
    });
    it('ne propose le dépôt au RCCM ni à un entreprenant ni à une coopérative', () => {
        expect(libelles(syscohada(client_1.FormeJuridiqueSyscohada.ENTREPRENANT)).some((l) => l.includes('RCCM'))).toBe(false);
        expect(libelles(syscohada(client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE)).some((l) => l.includes('RCCM'))).toBe(false);
        expect(libelles(syscohada(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME)).some((l) => l.includes('RCCM'))).toBe(true);
    });
    it('réserve le circuit des assemblées aux SA, SAS et SARL (art. 140)', () => {
        const avec = libelles(syscohada(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME));
        expect(avec.some((l) => l.includes('commissaires aux comptes'))).toBe(true);
        expect(avec.some((l) => l.includes('Assemblée générale'))).toBe(true);
        const sans = libelles(syscohada(client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE));
        expect(sans.some((l) => l.includes('commissaires aux comptes'))).toBe(false);
        expect(sans.some((l) => l.includes('Assemblée générale'))).toBe(false);
    });
    it('n’affiche aucun jalon de forme tant que la forme OHADA n’est pas renseignée', () => {
        const l = libelles(syscohada());
        expect(l.some((x) => x.includes('RCCM'))).toBe(false);
        expect(l.some((x) => x.includes('Assemblée générale'))).toBe(false);
        expect(l).toContain('Clôture et réouverture des livres');
        expect(l).not.toContain('Rapport de gestion');
    });
    it('garde les jalons internes pour toutes les formes', () => {
        for (const forme of Object.values(client_1.FormeJuridiqueEbnl)) {
            const l = libelles({ ...asbl, formeJuridique: forme });
            expect(l).toContain('Balance de vérification');
            expect(l).toContain('Clôture et réouverture des livres');
        }
    });
});
describe('obligations de la loi 004/2001 réintégrées', () => {
    const asbl = {
        referentiel: client_1.Referentiel.SYCEBNL,
        formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
        droitEtranger: false,
    };
    const eup = { ...asbl, formeJuridique: client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE };
    const ongEtrangere = {
        ...asbl,
        formeJuridique: client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE,
        droitEtranger: true,
    };
    const libelles = (c) => (0, planning_cloture_1.jalonsApplicables)(c).map((j) => j.libelle);
    it('donne enfin un jalon à l’établissement d’utilité publique (art. 66)', () => {
        expect(libelles(eup).some((l) => l.includes('ministre du secteur'))).toBe(true);
    });
    it('ne sert pas le jalon EUP à une association ordinaire', () => {
        expect(libelles(asbl).some((l) => l.includes('ministre du secteur'))).toBe(false);
    });
    it('porte la déclaration SEMESTRIELLE des ressources, sanctionnée par la dissolution', () => {
        const jalon = (0, planning_cloture_1.jalonsApplicables)(asbl).find((j) => j.libelle.includes('semestrielle'));
        expect(jalon).toBeDefined();
        expect(jalon.detail).toContain('chaque semestre');
        expect(jalon.source).toContain('art. 4, e');
    });
    it('n’active le jalon des ONG étrangères que pour un dossier de droit étranger', () => {
        expect(libelles(ongEtrangere).some((l) => l.includes('Accord-cadre'))).toBe(true);
        expect(libelles(asbl).some((l) => l.includes('Accord-cadre'))).toBe(false);
    });
});
describe('obligations déclenchées par un événement', () => {
    it('porte le changement d’administrateur (art. 11) et le mouvement d’immeuble (art. 15)', () => {
        const cles = planning_cloture_1.OBLIGATIONS_EVENEMENTIELLES.map((o) => o.cle);
        expect(cles).toContain('changementAdministrateur');
        expect(cles).toContain('mouvementImmeuble');
    });
    it('rattache le mouvement d’immeuble à l’écran qui le constate', () => {
        const o = planning_cloture_1.OBLIGATIONS_EVENEMENTIELLES.find((x) => x.cle === 'mouvementImmeuble');
        expect(o.ecranDeclencheur).toContain('Immobilisations');
        expect(o.destinataire).toContain('FINANCES');
    });
    it('cite une source et un délai pour chaque obligation', () => {
        for (const o of planning_cloture_1.OBLIGATIONS_EVENEMENTIELLES) {
            expect(o.source.length).toBeGreaterThan(10);
            expect(o.delai.length).toBeGreaterThan(5);
        }
    });
    it('filtre selon la forme juridique, comme les jalons', () => {
        const cles = (0, planning_cloture_1.obligationsEvenementiellesApplicables)({
            referentiel: client_1.Referentiel.SYCEBNL,
            formeJuridique: client_1.FormeJuridiqueEbnl.UNITE_GESTION_PROJET,
            droitEtranger: false,
        }).map((o) => o.cle);
        expect(cles).not.toContain('changementAdministrateur');
        expect(cles).toContain('numeroImpot');
    });
});
describe('planning de clôture · cloisonnement des référentiels', () => {
    const syscohada = planning_cloture_1.JALONS_CLOTURE.filter((j) => !j.referentiels || j.referentiels.includes(client_1.Referentiel.SYSCOHADA));
    const sycebnl = planning_cloture_1.JALONS_CLOTURE.filter((j) => !j.referentiels || j.referentiels.includes(client_1.Referentiel.SYCEBNL));
    it('donne à chaque DOSSIER un numéro d’étape par jalon, jamais deux', () => {
        const formesSyscohada = [null, ...Object.values(client_1.FormeJuridiqueSyscohada)];
        const contextes = [];
        for (const forme of Object.values(client_1.FormeJuridiqueEbnl)) {
            for (const droitEtranger of [false, true]) {
                contextes.push({
                    nom: `SYCEBNL ${forme}${droitEtranger ? ' (droit étranger)' : ''}`,
                    contexte: { referentiel: client_1.Referentiel.SYCEBNL, formeJuridique: forme, droitEtranger },
                });
            }
        }
        for (const forme of formesSyscohada) {
            contextes.push({
                nom: `SYSCOHADA ${forme ?? 'forme non renseignée'}`,
                contexte: {
                    referentiel: client_1.Referentiel.SYSCOHADA,
                    formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
                    formeJuridiqueSyscohada: forme,
                    droitEtranger: false,
                },
            });
        }
        for (const { nom, contexte } of contextes) {
            const etapes = (0, planning_cloture_1.jalonsApplicables)(contexte).map((j) => j.etape);
            expect(`${nom}: ${etapes.length}`).toBe(`${nom}: ${new Set(etapes).size}`);
        }
    });
    it('sert la déclaration de l’art. 17 à une personne physique, et jamais celle de l’IS', () => {
        const pour = (forme) => (0, planning_cloture_1.jalonsApplicables)({
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
            formeJuridiqueSyscohada: forme,
            droitEtranger: false,
        }).filter((j) => j.etape === 15);
        for (const forme of [client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE, client_1.FormeJuridiqueSyscohada.ENTREPRENANT]) {
            const jalons = pour(forme);
            expect(jalons).toHaveLength(1);
            expect(jalons[0].libelle).toContain('personne physique');
            expect(jalons[0].detail).not.toMatch(/Déclaration de l’Impôt sur les Sociétés/);
            expect(jalons[0].detail).toContain('DÉPEND DU RÉGIME');
            expect(jalons[0].detail).toContain('31 janvier');
            expect(jalons[0].source).toMatch(/art\. 17/);
        }
        const sa = pour(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        expect(sa).toHaveLength(1);
        expect(sa[0].libelle).toBe('Déclarations fiscales annuelles');
        const inconnue = pour(null);
        expect(inconnue).toHaveLength(1);
        expect(inconnue[0].libelle).toBe('Déclarations fiscales annuelles');
    });
    it('ne sert aucun compte, article ou mot du SYCEBNL à un dossier SYSCOHADA', () => {
        const motifsSycebnl = [
            /fonds affectés/i,
            /fonds reportés/i,
            /emplois-ressources/i,
            /compte d’exploitation/i,
            /excédent ou déficit/i,
            /dons en nature/i,
            /projet de développement/i,
            /rapport d’activité/i,
            /impôt sur les sociétés ne paie pas/i,
        ];
        for (const j of syscohada) {
            for (const motif of motifsSycebnl) {
                const fautif = motif.test(j.detail) ? `étape ${j.etape} « ${j.libelle} » : ${j.detail}` : 'aucun';
                expect(fautif).toBe('aucun');
            }
        }
    });
    it('ne fonde aucun jalon SYSCOHADA sur un texte propre aux entités à but non lucratif', () => {
        for (const j of syscohada) {
            if (j.libelle === 'Dépôt des états financiers au RCCM')
                continue;
            const source = j.source.replace(/, non exclu par l’art\. 3 du SYCEBNL/g, '');
            expect(`${j.etape} ${source}`).not.toMatch(/SYCEBNL|004\/2001/);
        }
    });
    it('ne pose sur aucun jalon SYSCOHADA une observation que seul le SYCEBNL peut satisfaire', () => {
        const reserveesSycebnl = ['INVENTAIRE', 'RAPPORT_ACTIVITE', 'DONATEURS'];
        for (const j of syscohada) {
            expect(`${j.etape} ${j.observation ?? 'aucune'}`).not.toMatch(new RegExp(reserveesSycebnl.join('|')));
        }
    });
    it('rend au SYSCOHADA les deux jalons dont l’AUDCIF et le cours le rendent débiteur', () => {
        const libelles = syscohada.map((j) => j.libelle);
        expect(libelles).toContain('Livre d’inventaire');
        expect(libelles.some((l) => l.includes('CPCC'))).toBe(true);
    });
    it('vise le bon compte de fonds affectés au jalon d’écritures d’inventaire', () => {
        const inventaireSycebnl = sycebnl.find((j) => j.etape === 6);
        expect(inventaireSycebnl.detail).toContain('compte 165');
        expect(inventaireSycebnl.detail).toContain('fonds reportés (compte 17)');
        const inventaireSyscohada = syscohada.find((j) => j.etape === 6);
        expect(inventaireSyscohada.detail).toContain('compte 14');
        expect(inventaireSyscohada.detail).toContain('799');
    });
    it('refuse à une entreprise le rapport d’activité de la loi n° 004/2001, même sous forme d’ONG', () => {
        const jalons = (0, planning_cloture_1.jalonsApplicables)({
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridique: client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
            droitEtranger: false,
        });
        expect(jalons.some((j) => j.source.includes('004/2001, art. 44'))).toBe(false);
    });
    it('donne un jalon de remise au contrôleur à toute forme SYSCOHADA, pas seulement aux sociétés à assemblée', () => {
        const snc = (0, planning_cloture_1.jalonsApplicables)({
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF,
            droitEtranger: false,
        });
        expect(snc.some((j) => j.libelle.includes('commissaire aux comptes'))).toBe(true);
        expect(snc.some((j) => j.libelle === 'Mise à disposition de l’auditeur')).toBe(false);
    });
    it('ne sert aucune obligation événementielle de la loi n° 004/2001 à un dossier SYSCOHADA', () => {
        const cles = (0, planning_cloture_1.obligationsEvenementiellesApplicables)({
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
            droitEtranger: false,
        }).map((o) => o.cle);
        expect(cles).not.toContain('changementAdministrateur');
        expect(cles).not.toContain('mouvementImmeuble');
        expect(cles).not.toContain('renouvellementFacilites');
        expect(cles).toContain('numeroImpot');
        expect(cles).toContain('engagementTravailleur');
    });
    it('ne porte toujours aucun montant, dans les jalons ajoutés comme dans les autres', () => {
        for (const j of planning_cloture_1.JALONS_CLOTURE) {
            expect(`${j.etape} ${j.detail}`).not.toMatch(/\d[\d\s.]*\s?(FC|francs congolais|FCFA)/i);
        }
    });
});
describe('SYCEBNL art. 19 al. 4 · le délai de quarante-cinq jours', () => {
    const jalon = (referentiel, libelle) => planning_cloture_1.JALONS_CLOTURE.find((j) => j.libelle === libelle && (j.referentiels ?? []).includes(referentiel));
    it('le jalon SYCEBNL de mise à disposition de l’auditeur porte le délai et le dit LÉGAL', () => {
        const j = jalon(client_1.Referentiel.SYCEBNL, 'Mise à disposition de l’auditeur');
        expect(j.detail).toContain('QUARANTE-CINQ JOURS AU MOINS');
        expect(j.detail).toContain('À REBOURS');
        expect(j.detail).toContain('bailleurs de fonds');
        expect(j.nature).toBe('LEGALE');
        expect(j.source).toContain('art. 19 al. 4');
    });
    it('les DEUX référentiels portent le délai · c’est la même règle sous deux textes', () => {
        for (const [referentiel, libelle] of [
            [client_1.Referentiel.SYCEBNL, 'Mise à disposition de l’auditeur'],
            [client_1.Referentiel.SYSCOHADA, 'Mise à disposition du commissaire aux comptes'],
        ]) {
            expect({ referentiel, delai: jalon(referentiel, libelle).detail.includes('QUARANTE-CINQ JOURS AU MOINS') }).toEqual({
                referentiel,
                delai: true,
            });
        }
    });
});
describe('événements postérieurs à la clôture · les deux branches du tri', () => {
    const jalon = (referentiel) => planning_cloture_1.JALONS_CLOTURE.find((j) => j.libelle === 'Événements postérieurs à la clôture' && (j.referentiels ?? []).includes(referentiel));
    for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
        it(`${referentiel} · le jalon existe et porte l’ajustement, la mention et la continuité`, () => {
            const j = jalon(referentiel);
            expect(j).toBeDefined();
            expect(j.detail).toContain('CONFIRMENT');
            expect(j.detail).toContain('AJUSTEMENT');
            expect(j.detail).toContain('APPARUE APRÈS');
            expect(j.detail).toContain('continuité de l’exploitation');
            expect(j.detail).toContain('valeurs liquidatives');
        });
    }
    it('la fenêtre se ferme à l’arrêté, comme les états financiers eux-mêmes', () => {
        for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            expect({ referentiel, echeance: jalon(referentiel).echeance }).toEqual({
                referentiel,
                echeance: { moisApres: 4, jour: 'FIN' },
            });
        }
    });
});
describe('inventaires extracomptables · la sanction et le PV', () => {
    const jalon = (referentiel) => planning_cloture_1.JALONS_CLOTURE.find((j) => j.libelle === 'Inventaires extracomptables' && (j.referentiels ?? []).includes(referentiel));
    for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
        it(`${referentiel} · le PV d’inventaire physique signé est attendu`, () => {
            const j = jalon(referentiel);
            expect(j.detail).toContain('PV d’inventaire physique');
            expect(j.detail).toContain('signé');
            expect(j.source).toContain('CPCC');
        });
        it(`${referentiel} · le jalon reste INTERNE malgré la sanction`, () => {
            expect(jalon(referentiel).nature).toBe('INTERNE');
            expect(jalon(referentiel).sanction).toBeDefined();
        });
    }
    it('le SYCEBNL cite son art. 24, jamais l’art. 111 que son art. 3 exclut', () => {
        const s = jalon(client_1.Referentiel.SYCEBNL).sanction;
        expect(s).toContain('Article 24');
        expect(s).toContain('SYCEBNL');
        expect(s).not.toContain('111');
        expect(s).not.toContain('AUDCIF');
        expect(s).toContain('registre des donateurs');
    });
    it('le SYSCOHADA cite l’art. 111 de l’AUDCIF, jamais l’art. 24 du SYCEBNL', () => {
        const s = jalon(client_1.Referentiel.SYSCOHADA).sanction;
        expect(s).toContain('Article 111');
        expect(s).toContain('AUDCIF');
        expect(s).not.toContain('SYCEBNL');
        expect(s).not.toContain('registre des donateurs');
        expect(s).toContain('rapport de gestion');
    });
});
describe('Passe F6 · l’art. 141, 2° est nommé dans les deux déclarations annuelles', () => {
    const jalons = planning_cloture_1.JALONS_CLOTURE.filter((j) => j.libelle.startsWith('Déclaration'));
    it('les deux jalons annuels de déclaration portent la mention et sa source', () => {
        const concernes = jalons.filter((j) => j.libelle === 'Déclarations fiscales annuelles' || j.libelle.includes('personne physique'));
        expect(concernes).toHaveLength(3);
        for (const j of concernes) {
            expect(j.detail).toContain('LA MENTION DU COMPTABLE');
            expect(j.detail).toContain('la qualification du comptable');
            expect(j.detail).toContain('salarié ou non');
            expect(j.source).toContain('art. 141, 2°');
        }
    });
    it('dit que ce n’est PAS le contreseing, et qu’OmegaX ne détient pas la donnée', () => {
        const concernes = jalons.filter((x) => x.libelle === 'Déclarations fiscales annuelles' || x.libelle.includes('personne physique'));
        const j = concernes.find((x) => x.referentiels?.includes('SYSCOHADA') && x.libelle === 'Déclarations fiscales annuelles');
        expect(j.detail).toContain('signer n’est pas déclarer');
        expect(j.detail).toContain('à reporter à la main');
        const asbl = concernes.find((x) => x.referentiels?.includes('SYCEBNL'));
        expect(asbl.detail).toContain('articles 139 ET 140');
        expect(asbl.detail).toContain('RÉSERVE');
        expect(asbl.source).toContain('art. 141, 2°');
    });
});
describe('Passe F13 · le PV d’assemblée de l’art. 13 bis LPF', () => {
    it('n’est pas servi à une association, exemptée de l’IS', () => {
        const cles = (referentiel) => (0, planning_cloture_1.obligationsEvenementiellesApplicables)({
            referentiel,
            formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
            droitEtranger: false,
        }).map((o) => o.cle);
        expect(cles(client_1.Referentiel.SYSCOHADA)).toContain('proceValAssembleeGenerale');
        expect(cles(client_1.Referentiel.SYCEBNL)).not.toContain('proceValAssembleeGenerale');
    });
});
describe('recensement · planning de clôture confronté aux textes', () => {
    const pourForme = (forme) => (0, planning_cloture_1.jalonsApplicables)({
        referentiel: client_1.Referentiel.SYSCOHADA,
        formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
        formeJuridiqueSyscohada: forme,
        droitEtranger: false,
    });
    const toutesFormes = [null, ...Object.values(client_1.FormeJuridiqueSyscohada)];
    it('O1a C1 · le rapport de gestion est servi exactement là où regleRapportGestion l’exige, sous le même article', () => {
        for (const forme of toutesFormes) {
            const regle = (0, correspondance_inventaire_syscohada_1.regleRapportGestion)(forme);
            const jalons = pourForme(forme).filter((j) => j.libelle === 'Rapport de gestion');
            expect({ forme, servi: jalons.length === 1 }).toEqual({ forme, servi: regle.genre === 'EXIGE' });
            if (regle.genre === 'EXIGE') {
                const article = /AUSCOOP/.test(regle.source) ? 'AUSCOOP, art. 108' : 'AUSCGIE, art. 138';
                expect({ forme, source: jalons[0].source.startsWith(article) }).toEqual({ forme, source: true });
            }
        }
    });
    it('O1a C3 · l’affectation SYSCOHADA dit la réserve légale que regimeReserveLegale dit, forme par forme', () => {
        for (const forme of toutesFormes) {
            const regime = (0, regles_affectation_1.regimeReserveLegale)(forme);
            const j = pourForme(forme).find((x) => x.libelle === 'Affectation du résultat');
            expect({ forme, nulle: j.detail.includes('NULLE') }).toEqual({ forme, nulle: regime.exigee });
            if (!regime.exigee)
                expect(j.detail).toContain(regime.motif);
            expect(j.source).toContain(regime.source);
            const commerciale = forme !== null && correspondance_retenues_2.FORMES_PERSONNES_PHYSIQUES.includes(forme) === false &&
                ['SOCIETE_ANONYME', 'SOCIETE_PAR_ACTIONS_SIMPLIFIEE', 'SOCIETE_RESPONSABILITE_LIMITEE', 'SOCIETE_NOM_COLLECTIF', 'SOCIETE_COMMANDITE_SIMPLE'].includes(forme);
            expect({ forme, dividendes: j.detail.includes('(465)') }).toEqual({ forme, dividendes: commerciale });
            expect({ forme, art146: j.source.includes('art. 146') }).toEqual({ forme, art146: commerciale });
        }
        for (const forme of correspondance_retenues_2.FORMES_PERSONNES_PHYSIQUES) {
            expect(pourForme(forme).find((x) => x.libelle === 'Affectation du résultat').detail).toContain('compte 103 (Capital personnel)');
        }
    });
    it('O1a C2 · l’envoi aux commissaires se date quarante-cinq jours avant une assemblée de fin de sixième mois', () => {
        const j = planning_cloture_1.JALONS_CLOTURE.find((x) => x.libelle === 'États financiers et rapport de gestion aux commissaires aux comptes');
        expect(iso((0, planning_cloture_1.dateJalon)(new Date(Date.UTC(2026, 11, 31)), j.echeance))).toBe('2027-05-15');
        expect(j.detail).toContain('le 15 du cinquième mois, quarante-cinq jours francs avant');
        expect(j.detail).toContain('un jour plus tard si le délai n’est pas franc');
    });
    it('O1a E4 et O6 B4 · la SNC, la SCS et la coopérative reçoivent l’approbation sous leur propre article', () => {
        const approbation = (forme) => pourForme(forme).filter((j) => j.etape === 21);
        for (const forme of toutesFormes)
            expect({ forme, n: approbation(forme).length }).toEqual({ forme, n: 1 });
        for (const forme of [client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF, client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE]) {
            const j = approbation(forme)[0];
            expect(j.detail).toContain('QUINZE JOURS');
            expect(j.source).toContain('art. 288');
            expect(j.source).toContain('art. 306');
        }
        const coop = approbation(client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE)[0];
        expect(coop.detail).toContain('organisation faîtière');
        expect(coop.source).toContain('AUSCOOP, art. 110');
        expect(approbation(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME)[0].source).not.toContain('AUSCOOP');
    });
    it('O1b A7 et C4 · SARL et SA reçoivent ce qui précède leur assemblée, chacune sous son article', () => {
        const sarl = pourForme(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        const conventions = sarl.find((j) => j.libelle.startsWith('Conventions poursuivies'));
        expect(conventions.source).toContain('art. 351, al. 2');
        expect(iso((0, planning_cloture_1.dateJalon)(new Date(Date.UTC(2026, 11, 31)), conventions.echeance))).toBe('2027-01-31');
        const agSarl = sarl.find((j) => j.etape === 23);
        expect(agSarl.source).toContain('art. 345');
        expect(agSarl.source).toContain('353');
        expect(agSarl.detail).toContain('NULLES');
        const agSa = pourForme(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME).find((j) => j.etape === 23);
        expect(agSa.source).toContain('art. 525');
        const agSas = pourForme(client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE).find((j) => j.etape === 23);
        expect(agSas.source).not.toContain('525');
        for (const forme of toutesFormes.filter((f) => f !== client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE)) {
            expect({ forme, c: pourForme(forme).some((j) => j.libelle.startsWith('Conventions poursuivies')) }).toEqual({ forme, c: false });
        }
    });
    it('F8 B1 et D3 C3 · la certification cite l’arrêté n° 014 et date chaque article de son texte modificatif', () => {
        const j = pourForme(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME).find((x) => x.etape === 15);
        expect(j.detail).toContain('n° 014 du 16 mai 2023');
        expect(j.detail).toContain('INDÉPENDANT');
        expect(j.detail).toContain('« par dérogation à l’article 5 »');
        expect(j.source).toContain('art. 14 (certification ONEC), modifié par la loi de finances n° 22/071');
        expect(j.source).not.toContain('16 (dans le mois en cas de dissolution, de liquidation ou de cessation), modifiés par la loi n° 23/052');
    });
    it('D1 A1 · le jalon de l’accord-cadre suit la règle d’articleTrenteSeptApplicable', () => {
        for (const forme of Object.values(client_1.FormeJuridiqueEbnl)) {
            for (const droitEtranger of [false, true]) {
                const servi = (0, planning_cloture_1.jalonsApplicables)({ referentiel: client_1.Referentiel.SYCEBNL, formeJuridique: forme, droitEtranger }).some((j) => j.libelle.startsWith('Accord-cadre'));
                expect({ forme, droitEtranger, servi }).toEqual({ forme, droitEtranger, servi: (0, conditions_ong_etrangere_1.articleTrenteSeptApplicable)(forme, droitEtranger) });
            }
        }
        const j = planning_cloture_1.JALONS_CLOTURE.find((x) => x.libelle.startsWith('Accord-cadre'));
        expect(j.detail).toContain('main d’œuvre locale');
        expect(j.detail).toContain('AUCUN délai');
    });
    it('D1 A3 · le jalon de l’EUP dit que l’art. 66 ne fixe aucun délai, et reprend sa formule passive', () => {
        const j = planning_cloture_1.JALONS_CLOTURE.find((x) => x.libelle.includes('établissement d’utilité publique'));
        expect(j.detail).toContain('AUCUN délai');
        expect(j.detail).toContain('« sont transmis au Ministre de la Justice');
    });
    it('D1 C2 et C3 · le compte annuel à la Justice porte sa réserve et ne vise que l’ASBL de droit congolais', () => {
        const lib = 'Compte annuel et liste des membres effectifs au Ministère de la Justice';
        const pour = (droitEtranger) => (0, planning_cloture_1.jalonsApplicables)({ referentiel: client_1.Referentiel.SYCEBNL, formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION, droitEtranger }).find((j) => j.libelle === lib);
        expect(pour(true)).toBeUndefined();
        const j = pour(false);
        expect(j.detail).toContain('DOTÉE DE LA PERSONNALITÉ JURIDIQUE');
        expect(j.detail).toContain('aucun article de la loi n° 004/2001 ne la porte');
        expect(j.detail).toContain('au Ministère de la Justice ET aux autorités');
        expect(j.source).toContain('texte réglementaire non identifié');
    });
    it('D1 A7 et C4 · l’art. 15 vise aussi l’usage et la jouissance, et ne vaut que pour le droit congolais', () => {
        const o = planning_cloture_1.OBLIGATIONS_EVENEMENTIELLES.find((x) => x.cle === 'mouvementImmeuble');
        expect(o.evenement).toContain('l’usage ou la jouissance');
        expect(o.delai).toContain('date de l’acte');
        const cles = (droitEtranger) => (0, planning_cloture_1.obligationsEvenementiellesApplicables)({ referentiel: client_1.Referentiel.SYCEBNL, formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION, droitEtranger }).map((x) => x.cle);
        expect(cles(false)).toEqual(expect.arrayContaining(['mouvementImmeuble', 'changementAdministrateur']));
        expect(cles(true)).not.toContain('mouvementImmeuble');
        expect(cles(true)).not.toContain('changementAdministrateur');
    });
});
describe('obligation événementielle · capitaux propres inférieurs à la moitié du capital', () => {
    const cles = (forme, referentiel = client_1.Referentiel.SYSCOHADA) => (0, planning_cloture_1.obligationsEvenementiellesApplicables)({
        referentiel,
        formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
        droitEtranger: false,
        formeJuridiqueSyscohada: forme,
    }).map((o) => o.cle);
    it('sert à chaque forme le régime que le contrôle lui reconnaît, et à nulle autre', () => {
        for (const forme of Object.values(client_1.FormeJuridiqueSyscohada)) {
            const regime = (0, moitie_capital_1.regimeMoitieCapital)(forme);
            const c = cles(forme);
            expect(c.includes('moitieCapitalSarl')).toBe(regime === 'SARL');
            expect(c.includes('moitieCapitalSaSas')).toBe(regime === 'SA' || regime === 'SAS');
        }
        expect(cles(null)).not.toContain('moitieCapitalSarl');
        expect(cles(null)).not.toContain('moitieCapitalSaSas');
        expect(cles(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, client_1.Referentiel.SYCEBNL)).not.toContain('moitieCapitalSaSas');
    });
    it('cite les articles de chaque régime, le délai de quatre mois et la publicité de l’art. 666', () => {
        const sarl = planning_cloture_1.OBLIGATIONS_EVENEMENTIELLES.find((o) => o.cle === 'moitieCapitalSarl');
        const sa = planning_cloture_1.OBLIGATIONS_EVENEMENTIELLES.find((o) => o.cle === 'moitieCapitalSaSas');
        expect(sarl.source).toContain('AUSCGIE art. 371 à 373');
        expect(sarl.delai).toContain('quatre mois qui suivent l’approbation');
        expect(sarl.delai).toContain('deux ans qui suivent la clôture de l’exercice déficitaire');
        expect(sa.source).toContain('AUSCGIE art. 664 à 669');
        expect(sa.source).toContain('art. 853-3');
        expect(sa.delai).toContain('quatre mois qui suivent l’approbation');
        expect(sa.delai).toContain('clôture du deuxième exercice suivant');
        expect(sa.delai).toContain('déposée au RCCM et publiée dans un journal d’annonces légales');
    });
});
describe('jalon de déclaration des revenus · réserve de l’art. 57 quater, al. 2', () => {
    it('porte la citation du registre des retenues et garde le 30 avril', () => {
        const j = planning_cloture_1.JALONS_CLOTURE.find((x) => x.libelle === 'Déclaration annuelle des revenus (personne physique)');
        const reserve = correspondance_retenues_1.OBLIGATIONS_DECLARATIVES.find((o) => o.cle === 'declarationIrpp').reserveRegimePhysique;
        expect(reserve).toContain('article 57 quater, alinéa 2');
        expect(j.detail).toContain(reserve);
        expect(j.detail).toContain('« à la souscription de la déclaration auto liquidative, au plus tard le 31 janvier');
        expect(j.source).toContain('57 quater, al. 2');
        expect(j.echeance).toEqual({ moisApres: 4, jour: 'FIN' });
    });
});
describe('recensement · capital à l’affectation et associé unique de la SAS', () => {
    const contexte = (forme, associeUnique) => (0, planning_cloture_1.jalonsApplicables)({
        referentiel: client_1.Referentiel.SYSCOHADA,
        formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
        formeJuridiqueSyscohada: forme,
        droitEtranger: false,
        associeUnique,
    });
    it('O1b D2 · SA, SAS et SARL lisent l’avertissement de la fenêtre d’affectation, les autres formes rien', () => {
        for (const forme of Object.values(client_1.FormeJuridiqueSyscohada)) {
            const j = contexte(forme).find((x) => x.libelle === 'Affectation du résultat');
            const aug = (0, regles_affectation_1.avertissementLigneCapital)(forme, true);
            const red = (0, regles_affectation_1.avertissementLigneCapital)(forme, false);
            if (aug && red) {
                expect(j.detail).toContain(aug);
                expect(j.detail).toContain(red);
            }
            else {
                expect({ forme, capital: j.detail.includes('Capital social (101) ·') }).toEqual({ forme, capital: false });
            }
        }
    });
    it('O1b G6 · la SASU déclarée est approuvée par l’associé unique, sous l’art. 853-11', () => {
        const j = contexte(client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, true).find((x) => x.etape === 23);
        expect(j.libelle).toBe('Approbation des comptes par l’associé unique');
        expect(j.detail).toContain('arrêtés par le président');
        expect(j.source).toBe('AUSCGIE, art. 853-11, al. 4 et 5');
        expect(j.echeance).toEqual({ moisApres: 6, jour: 'FIN' });
    });
    it('O1b G6 · une SAS pluripersonnelle garde l’assemblée, une SAS non déclarée NOMME le cas unipersonnel', () => {
        const pluri = contexte(client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, false).find((x) => x.etape === 23);
        expect(pluri.libelle).toBe('Assemblée générale statuant sur les états financiers');
        expect(pluri.source).toBe('AUSCGIE, art. 140 al. 2');
        const inconnue = contexte(client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, null).find((x) => x.etape === 23);
        expect(inconnue.libelle).toBe('Assemblée générale statuant sur les états financiers');
        expect(inconnue.detail).toContain('pas encore déclaré');
        expect(inconnue.source).toContain('art. 853-11');
        const sa = contexte(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, true).find((x) => x.etape === 23);
        expect(sa.source).toContain('art. 525');
    });
});
//# sourceMappingURL=planning-cloture.spec.js.map