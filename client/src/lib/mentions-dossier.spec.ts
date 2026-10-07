import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FORMES_CAPITAL_VARIABLE,
  estCooperative,
  faitsDeLaForme,
  faitsDeLaFormeAEnvoyer,
  libelleAdresse,
  lireQuotePart,
  portefeuilleAEnvoyer,
  proposeCapitalVariable,
  transformationDatable,
} from './mentions-dossier';
import { FORMES_SYSCOHADA } from './formes-juridiques-syscohada';

// Aucun import de « vitest » · convention du dépôt, le spec lit des sources.

/**
 * PASSES O1a, O6 ET D1 · ce que l'écran des paramètres propose selon la forme,
 * en miroir des refus du serveur, et les réserves que la liste des formes
 * porte à l'écran.
 */
describe('capital variable · AUSCGIE art. 269-1', () => {
  it('la case n’est proposée qu’à la SA et à la SAS, jamais à la SARL ni à la coopérative', () => {
    expect([
      proposeCapitalVariable('SOCIETE_ANONYME'),
      proposeCapitalVariable('SOCIETE_PAR_ACTIONS_SIMPLIFIEE'),
      proposeCapitalVariable('SOCIETE_RESPONSABILITE_LIMITEE'),
      proposeCapitalVariable('SOCIETE_COOPERATIVE'),
      proposeCapitalVariable(null),
    ]).toEqual([true, true, false, false, false]);
  });

  it('le client porte exactement les formes du serveur', () => {
    const serveur = readFileSync(join(__dirname, '../../../src/modules/tenant/mentions-societe.ts'), 'utf8');
    const bloc = serveur.match(/export const FORMES_CAPITAL_VARIABLE[^=]*=\s*\[([\s\S]*?)\];/);
    expect(bloc).not.toBeNull();
    const formes = [...(bloc as RegExpMatchArray)[1].matchAll(/FormeJuridiqueSyscohada\.(\w+)/g)].map((m) => m[1]);
    expect([...FORMES_CAPITAL_VARIABLE].sort()).toEqual(formes.sort());
  });
});

describe('le siège social · AUSCGIE art. 17 et 25, AUSCOOP art. 19', () => {
  it('le champ se dit « Adresse du siège social » pour une société ou une coopérative, « Adresse » ailleurs', () => {
    expect([
      libelleAdresse('SYSCOHADA', 'SOCIETE_RESPONSABILITE_LIMITEE'),
      libelleAdresse('SYSCOHADA', 'SOCIETE_COOPERATIVE'),
      libelleAdresse('SYSCOHADA', 'ENTREPRENANT'),
      libelleAdresse('SYCEBNL', null),
    ]).toEqual(['Adresse du siège social', 'Adresse du siège social', 'Adresse', 'Adresse']);
    expect(estCooperative('SOCIETE_COOPERATIVE')).toBe(true);
  });
});

describe('la liste des formes · réserves et citations', () => {
  const detail = (valeur: string) => FORMES_SYSCOHADA.find((f) => f.valeur === valeur)!;

  it('l’arrêté de 2014 est dit non lu, à côté de l’affirmation sur la SARL', () => {
    expect(detail('SOCIETE_RESPONSABILITE_LIMITEE').detail).toContain(
      'Arrêté interministériel du 30 décembre 2014, non lu au Journal officiel · à vérifier sur le texte primaire.',
    );
  });

  it('la coopérative est immatriculée au RSC par l’art. 74, qui vaut pour la SCOOPS comme pour la COOP-CA', () => {
    expect(detail('SOCIETE_COOPERATIVE').detail).toContain('PAS au registre du commerce (art. 74)');
  });

  it('l’économie mixte constituée en société se déclare sous sa forme sociale (AUSCGIE art. 1)', () => {
    expect(detail('ENTITE_PUBLIQUE').titre).toBe('Entité publique ou parapublique');
    expect(detail('ENTITE_PUBLIQUE').detail).toContain('se déclare sous sa forme sociale · SA, SARL, SAS (AUSCGIE art. 1)');
  });
});

describe('Paramètres du dossier · la coopérative et les mentions', () => {
  const page = readFileSync(join(__dirname, '../pages/ParametresDossierPage.tsx'), 'utf8');

  it('le portefeuille de l’État ne se propose et ne s’envoie qu’aux cinq sociétés commerciales (loi n° 08/010, art. 3)', () => {
    // Le serveur refuse « oui » ailleurs, entreprenant compris · l'écran ne le
    // propose pas, et ne l'envoie pas d'une forme qui ne le porte pas.
    const ligne = page.indexOf('<Ligne label="Portefeuille de l’État">');
    expect(ligne).toBeGreaterThan(-1);
    const garde = page.lastIndexOf('{!estSycebnl', ligne);
    expect(page.slice(garde, ligne)).toMatch(/^\{!estSycebnl && estSocieteCommerciale\(params\?\.formeJuridiqueSyscohada\) && \(/);
    expect(page).toMatch(
      /params\?\.referentiel === 'SYSCOHADA' && estSocieteCommerciale\(params\.formeJuridiqueSyscohada\)\s*\?\s*portefeuilleAEnvoyer\(\{ portefeuille,/,
    );
  });

  it('la coopérative reçoit le champ du Registre des Sociétés Coopératives, et c’est lui qui part, jamais un RCCM', () => {
    const champs = page.slice(page.indexOf('const champsImmatriculation'), page.indexOf("label: 'RCCM'"));
    expect(champs).toContain(": estCoop\n");
    expect(champs).toContain("label: 'N° Registre des Sociétés Coopératives'");
    const debutEnvoi = page.indexOf("api.patch<ParametresDossier>('/dossier/identite'");
    const envoi = page.slice(debutEnvoi, page.indexOf('                    rccm,\n', debutEnvoi));
    expect(envoi).toContain('numeroRegistreCooperatives: numeroRsc');
    expect(envoi).toContain('varianteCooperative: varianteCoop');
    expect(envoi).toContain('...faitsDeLaFormeAEnvoyer(params?.formeJuridiqueSyscohada, {');
  });

  it('les mentions de l’émetteur s’affichent aussi quand seul le manque parle, hors du bloc du capital', () => {
    const debutCapital = page.indexOf('{peutPorterCapital && (');
    const mentions = page.indexOf('<Ligne label="Mentions légales" large>');
    const condition = page.slice(page.lastIndexOf('{(', mentions), mentions);
    expect(condition).toContain('params?.mentionsSociete.manquantes.length');
    // Le bloc du capital se ferme avant la ligne des mentions.
    expect(page.indexOf('</>\n                  )}', debutCapital)).toBeLessThan(mentions);
  });

  it('la bulle de la forme cite la transformation de la coopérative et la réserve sur l’arrêté de 2014', () => {
    const aide = page.slice(page.indexOf('titre="Forme et planning de clôture"'), page.indexOf('</SectionTitre>', page.indexOf('titre="Forme et planning de clôture"')));
    expect(aide).toContain('celle d’une coopérative par les articles 167 à 173 de l’AUSCOOP');
    expect(aide).toContain('Cet arrêté n’est pas lu au Journal officiel');
  });
});

describe('Périmètre de consolidation · ce que veut dire l’appel public à l’épargne', () => {
  it('la case cite l’AUSCGIE art. 81 et ses deux exclusions de l’art. 81-1', () => {
    const page = readFileSync(join(__dirname, '../pages/PerimetreConsolidationPage.tsx'), 'utf8');
    const ligne = page.slice(page.indexOf("'appelPublicEpargne',"), page.indexOf('],', page.indexOf("'appelPublicEpargne',")));
    expect(ligne).toContain('AUSCGIE art. 81');
    expect(ligne).toContain('cinquante millions (50.000.000) de francs CFA');
    expect(ligne).toContain('moins de cent (100) personnes');
  });
});

describe('Paramètres du dossier · l’enregistrement au ministère du secteur (loi n° 004/2001, art. 31 et 36)', () => {
  const page = readFileSync(join(__dirname, '../pages/ParametresDossierPage.tsx'), 'utf8');

  it('les deux champs suivent la règle du serveur, servie par GET /constitution, jamais une condition recopiée', () => {
    const lecture = page.slice(page.indexOf('async function lireChampsPortes()'), page.indexOf('async function lireChampsPortes()') + 400);
    expect(lecture).toContain("api.get<{ champsPortes?: ChampsPortes }>('/constitution')");
    expect(page).toContain('const champsOng = champsPortes ? champsPortes.enregistrementSecteur :');
    expect(page).toContain('const champsPlan = champsPortes ? champsPortes.certificatPlan :');
  });

  it('la règle est relue quand la forme ou le droit étranger change', () => {
    const debut = page.indexOf('const changerForme = async');
    const corps = page.slice(debut, page.indexOf('\n  };', debut));
    expect(corps).toContain('await lireChampsPortes();');
  });
});

/**
 * RELIQUATS DES LOTS « SOCIÉTÉS » · la route acceptait le mode
 * d'administration de la SA, l'associé unique de la SAS, la dissolution des
 * cinq sociétés et la date d'une transformation, et l'écran ne les proposait
 * pas. Le manque restait dit sur chaque pièce, sans rien pour le combler.
 */
describe('Paramètres du dossier · les faits de la dénomination, forme par forme', () => {
  const saisie = {
    modeAdministrationSa: 'CONSEIL_ADMINISTRATION' as const,
    associeUniqueSas: 'OUI' as const,
    dateDissolution: '2026-06-30',
    liquidateurs: 'M. Liquidateur',
  };

  it('chaque fait ne part qu’à la forme qui le porte (AUSCGIE art. 204, 386, 853-2 · AUSCOOP art. 183)', () => {
    expect(faitsDeLaFormeAEnvoyer('SOCIETE_ANONYME', saisie)).toEqual({
      modeAdministrationSa: 'CONSEIL_ADMINISTRATION',
      dateDissolution: '2026-06-30',
      liquidateurs: 'M. Liquidateur',
    });
    expect(faitsDeLaFormeAEnvoyer('SOCIETE_PAR_ACTIONS_SIMPLIFIEE', saisie)).toEqual({
      associeUniqueSas: 'OUI',
      dateDissolution: '2026-06-30',
      liquidateurs: 'M. Liquidateur',
    });
    expect(faitsDeLaFormeAEnvoyer('SOCIETE_RESPONSABILITE_LIMITEE', saisie)).toEqual({
      dateDissolution: '2026-06-30',
      liquidateurs: 'M. Liquidateur',
    });
    expect(faitsDeLaFormeAEnvoyer('SOCIETE_COOPERATIVE', saisie)).toEqual({
      dateDissolution: '2026-06-30',
      liquidateurs: 'M. Liquidateur',
    });
    expect(faitsDeLaFormeAEnvoyer('ENTREPRENANT', saisie)).toEqual({});
    expect(faitsDeLaFormeAEnvoyer('GROUPEMENT_INTERET_ECONOMIQUE', saisie)).toEqual({});
  });


  it('la dissolution est proposée aux cinq sociétés du serveur et à la coopérative, rien d’autre', () => {
    const serveur = readFileSync(join(__dirname, '../../../src/modules/tenant/mentions-societe.ts'), 'utf8');
    const bloc = serveur.match(/export const FORMES_SOCIETES_COMMERCIALES[^=]*=\s*\[([\s\S]*?)\];/);
    expect(bloc).not.toBeNull();
    const societes = [...(bloc as RegExpMatchArray)[1].matchAll(/FormeJuridiqueSyscohada\.(\w+)/g)].map((m) => m[1]);
    const avecDissolution = FORMES_SYSCOHADA.map((f) => f.valeur).filter((f) => faitsDeLaForme(f).dissolution);
    expect(avecDissolution.sort()).toEqual([...societes, 'SOCIETE_COOPERATIVE'].sort());
  });

  it('une transformation ne se date qu’entre deux sociétés commerciales distinctes (AUSCGIE art. 181 et 188)', () => {
    expect(transformationDatable('SOCIETE_RESPONSABILITE_LIMITEE', 'SOCIETE_ANONYME')).toBe(true);
    expect(transformationDatable('SOCIETE_ANONYME', 'SOCIETE_ANONYME')).toBe(false);
    expect(transformationDatable('ENTREPRENANT', 'SOCIETE_ANONYME')).toBe(false);
    expect(transformationDatable('SOCIETE_ANONYME', 'SOCIETE_COOPERATIVE')).toBe(false);
    expect(transformationDatable(null, 'SOCIETE_ANONYME')).toBe(false);
  });

  const page = readFileSync(join(__dirname, '../pages/ParametresDossierPage.tsx'), 'utf8');

  it('l’écran propose le mode de la SA et l’associé unique de la SAS, et les envoie par la règle commune', () => {
    expect(page).toContain('faitsDeLaForme(params?.formeJuridiqueSyscohada).modeAdministration && (');
    expect(page).toContain('faitsDeLaForme(params?.formeJuridiqueSyscohada).associeUnique && (');
    const debutEnvoi = page.indexOf("api.patch<ParametresDossier>('/dossier/identite'");
    const branchesSyscohada = page.slice(debutEnvoi, page.indexOf("params?.referentiel === 'SYCEBNL'", debutEnvoi));
    // La branche coopérative ET la branche des sociétés passent par la même règle.
    expect(branchesSyscohada.split('...faitsDeLaFormeAEnvoyer(params?.formeJuridiqueSyscohada, {').length - 1).toBe(2);
  });

  it('le changement de forme envoie la date d’effet de la transformation, seulement quand elle est datable', () => {
    const debut = page.indexOf('const changerFormeSyscohada = async');
    const corps = page.slice(debut, page.indexOf('\n  };', debut));
    expect(corps).toContain('dateEffetTransformation && transformationDatable(params.formeJuridiqueSyscohada, forme)');
    expect(corps).toContain('...(date === undefined ? {} : { dateEffetTransformation: date })');
  });
});

describe('Paramètres du dossier · le numéro CNSS de l’employeur sous ses deux noms (D2-E5)', () => {
  const page = readFileSync(join(__dirname, '../pages/ParametresDossierPage.tsx'), 'utf8');

  it('l’aide dit que le numéro de l’art. 212, 2° est celui du certificat d’affiliation de l’arrêté n° 146/2018, art. 7', () => {
    const debut = page.indexOf('titre="N° CNSS de l’employeur"');
    const aide = page.slice(debut, page.indexOf('/>', debut));
    expect(aide).toContain('CERTIFICAT D’AFFILIATION');
    expect(aide).toContain('source="Code du travail, art. 212, point 2 · arrêté n° 146/2018, art. 7"');
  });
});

describe('Paramètres du dossier · la liquidation d’une société commerciale (décision du 2026-10-04, point 4)', () => {
  const saisie = {
    modeAdministrationSa: 'PAS_ENCORE_DIT' as const,
    associeUniqueSas: 'PAS_ENCORE_DIT' as const,
    dateDissolution: '2026-05-31',
    liquidateurs: 'M. Liquidateur',
    dateNominationLiquidateur: '2026-06-15',
    regimeLiquidation: 'ARTICLE_223_1' as const,
    associeUniquePersonneMorale: 'NON' as const,
  };

  it('nomination, régime et associé unique personne morale ne partent qu’à une société commerciale', () => {
    expect(faitsDeLaFormeAEnvoyer('SOCIETE_RESPONSABILITE_LIMITEE', saisie)).toEqual({
      dateDissolution: '2026-05-31',
      liquidateurs: 'M. Liquidateur',
      dateNominationLiquidateur: '2026-06-15',
      regimeLiquidation: 'ARTICLE_223_1',
      associeUniquePersonneMorale: 'NON',
    });
    // La coopérative garde sa dissolution (AUSCOOP art. 183), pas la liquidation de l'AUSCGIE.
    expect(faitsDeLaFormeAEnvoyer('SOCIETE_COOPERATIVE', saisie)).toEqual({
      dateDissolution: '2026-05-31',
      liquidateurs: 'M. Liquidateur',
    });
  });
});

/**
 * ENTREPRISE MINIÈRE DU PORTEFEUILLE (décision par la loi du 2026-10-07,
 * point 3) · secteur et quote-part sous la qualité seulement, la quote-part
 * jamais envoyée illisible (JSON écrirait `NaN` en `null` et l'effacerait).
 */
describe('Paramètres du dossier · portefeuille de l’État, secteur minier et quote-part', () => {
  it('la quote-part se lit en pourcentage, virgule comprise ; vide efface ; illisible ou hors de 0 à 100 n’est jamais envoyée', () => {
    expect(lireQuotePart('')).toBeNull();
    expect(lireQuotePart('  ')).toBeNull();
    expect(lireQuotePart('20')).toBe(20);
    expect(lireQuotePart('33,3333')).toBe(33.3333);
    expect(lireQuotePart('100')).toBe(100);
    expect(lireQuotePart('100,5')).toBeUndefined();
    expect(lireQuotePart('-3')).toBeUndefined();
    expect(lireQuotePart('vingt')).toBeUndefined();
    expect(lireQuotePart('12,34567')).toBeUndefined();
  });

  it('secteur et quote-part ne partent que sous « oui » ; la source s’efface avec la quote-part', () => {
    const saisie = { secteurMinier: 'OUI' as const, quotePart: 51, sourceQuotePart: 'Statuts' };
    expect(portefeuilleAEnvoyer({ portefeuille: 'OUI', ...saisie })).toEqual({
      entreprisePortefeuilleEtat: 'OUI',
      portefeuilleSecteurMinier: 'OUI',
      quotePartEtatCapital: 51,
      sourceQuotePartEtat: 'Statuts',
    });
    expect(portefeuilleAEnvoyer({ portefeuille: 'NON', ...saisie })).toEqual({ entreprisePortefeuilleEtat: 'NON' });
    expect(portefeuilleAEnvoyer({ portefeuille: 'OUI', ...saisie, quotePart: null })).toEqual({
      entreprisePortefeuilleEtat: 'OUI',
      portefeuilleSecteurMinier: 'OUI',
      quotePartEtatCapital: null,
      sourceQuotePartEtat: null,
    });
  });

  /*
    PAR STRUCTURE, JAMAIS PAR LIGNE EXACTE (CLAUDE.md § 10) · le corps de la
    fonction d'enregistrement, et l'élément <input> que chaque <Ligne> porte.
  */
  const page = readFileSync(join(__dirname, '../pages/ParametresDossierPage.tsx'), 'utf8');
  /** Le corps de `const nom = async (…) => { … };`, accolades équilibrées. */
  const corpsDe = (nom: string) => {
    const debut = page.indexOf(`const ${nom} = async`);
    expect(debut).toBeGreaterThan(-1);
    const ouvre = page.indexOf('{', page.indexOf('=>', debut));
    let profondeur = 0;
    for (let i = ouvre; i < page.length; i++) {
      if (page[i] === '{') profondeur++;
      if (page[i] === '}' && --profondeur === 0) return page.slice(ouvre, i + 1);
    }
    throw new Error(`corps de ${nom} introuvable`);
  };
  /** Le premier élément <input …/> ou <select …> sous la <Ligne> de ce libellé. */
  const champDeLaLigne = (libelle: string) => {
    const ligne = page.indexOf(`<Ligne label="${libelle}">`);
    expect(ligne).toBeGreaterThan(-1);
    const ouvre = page.indexOf('<', ligne + 1);
    return page.slice(ouvre, page.indexOf('/>', ouvre) + 2);
  };

  it('l’enregistrement refuse une quote-part illisible AVANT l’envoi, la dit sous le champ, et envoie par la règle commune', () => {
    const envoi = corpsDe('enregistrerIdentite');
    const refus = envoi.indexOf('quoteLue === undefined');
    expect(refus).toBeGreaterThan(-1);
    expect(refus).toBeLessThan(envoi.indexOf('api.patch'));
    const blocRefus = envoi.slice(refus, envoi.indexOf('return;', refus));
    expect(blocRefus).toContain('setInfo(null);');
    expect(blocRefus).toContain('setErreurQuotePart(');
    expect(blocRefus).toContain('champQuotePart.current?.focus();');
    expect(envoi).toContain('portefeuilleAEnvoyer({ portefeuille, secteurMinier, quotePart: quoteLue ?? null, sourceQuotePart })');
  });

  it('chaque champ du portefeuille porte le libellé de sa ligne ; la quote-part dit son erreur ; la source est grisée sans elle', () => {
    for (const libelle of ['Secteur minier', 'Quote-part de l’État (%)', 'Source de la quote-part']) {
      expect(champDeLaLigne(libelle)).toContain(`aria-label="${libelle}"`);
    }
    const quote = champDeLaLigne('Quote-part de l’État (%)');
    expect(quote).toContain('aria-invalid={erreurQuotePart !== null}');
    expect(quote).toContain("aria-describedby={erreurQuotePart !== null ? 'erreur-quote-part' : undefined}");
    expect(page).toContain('id="erreur-quote-part"');
    expect(champDeLaLigne('Source de la quote-part')).toContain("quotePart.trim() === ''");
  });
});
