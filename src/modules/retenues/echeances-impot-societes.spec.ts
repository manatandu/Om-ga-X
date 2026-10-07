import { FormeJuridiqueSyscohada, Referentiel } from '@prisma/client';
import { AVERTISSEMENT_PV_SANS_COMMISSAIRE, PV_A_CONFIRMER_SANS_FORME, PV_A_CONFIRMER_SANS_MANDAT, RetenuesService } from './retenues.service';
import { PrismaService } from '../../common/prisma.service';
import { obligationsDeclarativesApplicables } from './correspondance-retenues';

/**
 * L'IMPÔT PROPRE DE L'ENTITÉ, ABSENT DE SON PROPRE ÉCHÉANCIER.
 *
 * Le registre et l'échéancier ont été bâtis pour une ASBL, exemptée d'impôt
 * sur les sociétés (loi n° 23/053, art. 5). Servis à une société commerciale,
 * ils énuméraient scrupuleusement tout ce qu'elle retient POUR AUTRUI · TVA,
 * impôts sur salaires, loyers, prestations d'associés · et passaient sous
 * silence les quatre échéances de son IMPÔT PRINCIPAL.
 *
 * Un échéancier fiscal qui omet l'impôt principal du redevable n'est pas
 * incomplet, il est trompeur : on le consulte précisément pour ne rien
 * oublier.
 *
 * Les quatre échéances, et leur source :
 *  · déclaration, au plus tard le 30 avril de l'année qui suit celle de la
 *    réalisation des revenus (art. 12 LPF, modifié par la loi n° 23/052) ;
 *  · trois acomptes provisionnels de 30 %, 30 % et 20 %, au plus tard les
 *    25 juillet, 25 septembre et 25 novembre (art. 57 bis LPF, tel que modifié
 *    par la loi de finances n° 25/060 du 29 décembre 2025).
 *
 * Le piège de la mémoire, que ce spec verrouille : la rédaction de 2023 disait
 * « avant le 1er août, avant le 1er octobre et avant le 1er décembre ». Elle
 * est périmée, et c'est elle qu'un praticien cite spontanément.
 */

const CLES_IS = ['declarationImpotSocietes', 'premierAcompteIs', 'deuxiemeAcompteIs', 'troisiemeAcompteIs'];

function service(referentiel: 'SYCEBNL' | 'SYSCOHADA') {
  const prisma = {
    exercice: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'e1',
        dateDebut: new Date('2026-01-01'),
        dateFin: new Date('2026-12-31'),
      }),
    },
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel }) },
    ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
    // Aucun report à-nouveau · le solde d'ouverture (audit final F26) se lit
    // alors sur le livre-journal, vide ici.
    ecriture: { findFirst: jest.fn().mockResolvedValue(null) },
    compte: { findMany: jest.fn().mockResolvedValue([]) },
    // Un mandat de commissaire aux comptes qui couvre 2026 · sans lui, le
    // procès-verbal de la LPF art. 13 bis n'est pas servi (décision par la
    // loi du 2026-10-07, constat final ; voir le bloc qui lui est consacré).
    mandatAuditeur: {
      findMany: jest.fn().mockResolvedValue([{ premierExercice: 2026, nombreExercices: 3, refusDeProrogation: false }]),
    },
  } as unknown as PrismaService;
  return new RetenuesService(prisma);
}

const echeances = async (referentiel: 'SYCEBNL' | 'SYSCOHADA', dateReference = '2026-01-15') =>
  (await service(referentiel).echeancierFiscal('t1', { exerciceId: 'e1', dateReference })).echeances;

describe('Échéances de l’impôt sur les sociétés', () => {
  it('les quatre figurent à l’échéancier d’une société', async () => {
    const cles = (await echeances('SYSCOHADA')).map((e) => e.cle);
    for (const cle of CLES_IS) expect(cles).toContain(cle);
  });

  it('aucune n’est servie à une ASBL, que la loi en exempte', async () => {
    const cles = (await echeances('SYCEBNL')).map((e) => e.cle);
    for (const cle of CLES_IS) expect(cles).not.toContain(cle);
  });

  it('les acomptes tombent les 25 juillet, septembre et novembre · pas les 1er août, octobre et décembre', async () => {
    const parCle = new Map((await echeances('SYSCOHADA')).map((e) => [e.cle, e]));
    // LE 25 JUILLET 2026 EST UN SAMEDI. Un acompte est un PUR PAIEMENT, versé
    // en banque sur bordereau (décret n° 20/019) · le samedi y est ouvrable,
    // et l'échéance n'est PAS reportée au lundi 27 (décision de Manasse du
    // 2026-10-04 ; le samedi du guichet, décret n° 24/09, ne vaut que pour un
    // dépôt de déclaration).
    expect(parCle.get('premierAcompteIs')!.date.toISOString().slice(0, 10)).toBe('2026-07-25');
    expect(parCle.get('deuxiemeAcompteIs')!.date.toISOString().slice(0, 10)).toBe('2026-09-25');
    expect(parCle.get('troisiemeAcompteIs')!.date.toISOString().slice(0, 10)).toBe('2026-11-25');
  });

  it('la déclaration tombe le 30 avril', async () => {
    const d = (await echeances('SYSCOHADA')).find((e) => e.cle === 'declarationImpotSocietes')!;
    expect(d.date.toISOString().slice(0, 10)).toBe('2026-04-30');
  });

  it('une échéance passée bascule sur l’année suivante, sans disparaître', async () => {
    // Au 1er décembre, les trois acomptes de l'année sont passés · l'échéancier
    // annonce ceux de l'an prochain plutôt que de les taire.
    const parCle = new Map((await echeances('SYSCOHADA', '2026-12-01')).map((e) => [e.cle, e]));
    // Le 25 juillet 2027 est un DIMANCHE · l'échéance légale de l'art. 57 bis
    // reste le 25, et la date à laquelle le versement doit être fait est le
    // lundi 26 par l'art. 110 bis, al. 2 (passe F10). L'échéancier rend la
    // seconde, qui est celle qu'un redevable doit tenir.
    expect(parCle.get('premierAcompteIs')!.date.toISOString().slice(0, 10)).toBe('2027-07-26');
    expect(parCle.get('troisiemeAcompteIs')!.date.toISOString().slice(0, 10)).toBe('2027-11-25');
  });

  it('ce sont des DÉCLARATIONS sans montant · aucune ne se lit dans un solde de compte', async () => {
    // L'IS se liquide sur le résultat fiscal, les acomptes sur l'impôt de
    // l'exercice PRÉCÉDENT : ni l'un ni l'autre ne sort d'une balance. Les
    // ranger en « reversement » aurait affiché un montant dû faux, à zéro.
    for (const e of (await echeances('SYSCOHADA')).filter((x) => CLES_IS.includes(x.cle))) {
      expect(e.genre).toBe('DECLARATION');
      expect(e.montantDu).toBe(0);
      expect(e.contenu).toBeTruthy();
      expect(e.sourceDonnees).toBeTruthy();
    }
  });

  it('la base légale des acomptes nomme la loi de finances, sans inventer son numéro d’article', async () => {
    // La source consultée porte une réserve expresse sur la numérotation de
    // l'article modificateur · un numéro faux serait pire qu'un renvoi par
    // l'intitulé.
    const a = (await echeances('SYSCOHADA')).find((e) => e.cle === 'premierAcompteIs')!;
    expect(a.baseLegale).toContain('57 bis');
    expect(a.baseLegale).toContain('25/060');
    expect(a.baseLegale).not.toMatch(/loi de finances[^.]*art(icle)?\.?\s*\d/i);
  });

  it('la table le dit aussi, hors de tout calcul de date', async () => {
    const syscohada = obligationsDeclarativesApplicables('SYSCOHADA' as never).map((o) => o.cle);
    const sycebnl = obligationsDeclarativesApplicables('SYCEBNL' as never).map((o) => o.cle);
    expect(CLES_IS.every((c) => syscohada.includes(c))).toBe(true);
    expect(CLES_IS.some((c) => sycebnl.includes(c))).toBe(false);
  });
});

/**
 * LE CALENDRIER DE PAIEMENT SUIT LA FORME, ET L'ÉCHÉANCIER L'IGNORAIT.
 *
 * Le test ci-dessus verrouillait les quatre échéances de l'impôt sur les
 * sociétés. Il ne disait rien de QUI les doit · et l'échéancier les servait à
 * tout dossier SYSCOHADA, entreprise individuelle et entreprenant compris.
 *
 * Or l'article 57 bis vise « les acomptes provisionnels visés à l'article 57,
 * ALINÉA 2 », et cet alinéa ne couvre que l'impôt sur les sociétés et l'IRPP
 * au régime réel. Une petite entreprise relève de l'alinéa 3 et paie en DEUX
 * quotités (art. 57 quater), que l'échéancier taisait entièrement. Un
 * entrepreneur individuel lisait donc trois versements aux mauvaises dates et
 * ignorait les deux qu'il doit vraiment.
 *
 * CE QUE LE MODULE NE TRANCHE PAS, ET POURQUOI C'EST TESTÉ AUSSI. Le régime se
 * déduit du chiffre d'affaires sur plusieurs exercices (art. 113) et vit dans
 * le module fiscal. L'échéancier sert donc les DEUX calendriers à une personne
 * physique, chacun avec sa condition en réserve. Les assertions ci-dessous
 * gèlent ce choix : servir un seul calendrier ici serait une devinette, et
 * recalculer l'article 113 dans ce module le ferait diverger de l'autre.
 */
describe('Calendrier de paiement de l’impôt · art. 57, al. 2 et 3', () => {
  const cles = (forme: FormeJuridiqueSyscohada | null) =>
    obligationsDeclarativesApplicables(Referentiel.SYSCOHADA, forme).map((o) => o.cle);

  const QUOTITES = ['premiereQuotitePetiteEntreprise', 'secondeQuotitePetiteEntreprise'];
  const ACOMPTES = ['premierAcompteIs', 'deuxiemeAcompteIs', 'troisiemeAcompteIs'];

  it('NE SERT AUCUNE quotité à une personne morale · c’est l’impôt sur les sociétés', () => {
    for (const forme of [
      FormeJuridiqueSyscohada.SOCIETE_ANONYME,
      FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
      FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE,
    ]) {
      const servies = cles(forme);
      expect(servies).toEqual(expect.arrayContaining(ACOMPTES));
      expect(`${forme}: ${servies.filter((c) => QUOTITES.includes(c)).join(', ')}`).toBe(`${forme}: `);
    }
  });

  it('SERT les deux quotités à une personne physique · c’est le défaut corrigé', () => {
    for (const forme of [
      FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      FormeJuridiqueSyscohada.ENTREPRENANT,
    ]) {
      const servies = cles(forme);
      expect(servies).toEqual(expect.arrayContaining(QUOTITES));
      // Les acomptes RESTENT servis : une personne physique au régime réel les
      // doit. C'est le sens de la réserve, pas d'une suppression.
      expect(servies).toEqual(expect.arrayContaining(ACOMPTES));
    }
  });

  it('accompagne CHAQUE calendrier de sa condition quand la forme est physique', () => {
    const servies = obligationsDeclarativesApplicables(
      Referentiel.SYSCOHADA,
      FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
    );
    for (const cle of [...ACOMPTES, ...QUOTITES]) {
      const o = servies.find((x) => x.cle === cle)!;
      expect(`${cle}: ${o.reserve === null ? 'sans réserve' : 'avec réserve'}`).toBe(`${cle}: avec réserve`);
      expect(o.reserve).toMatch(/RÉGIME/);
    }
    // La réserve renvoie à la fenêtre qui tranche, jamais à une devinette.
    expect(servies.find((x) => x.cle === 'premierAcompteIs')!.reserve).toContain('Résultat fiscal');
  });

  it('ne pose AUCUNE réserve à une personne morale, dont le régime est certain', () => {
    const servies = obligationsDeclarativesApplicables(
      Referentiel.SYSCOHADA,
      FormeJuridiqueSyscohada.SOCIETE_ANONYME,
    );
    for (const cle of ACOMPTES) expect(servies.find((x) => x.cle === cle)!.reserve).toBeNull();
  });

  it('FORME NON RENSEIGNÉE · rien n’est retranché de ce qui était servi, rien n’est ajouté', () => {
    const servies = cles(null);
    expect(servies).toEqual(expect.arrayContaining(ACOMPTES));
    expect(servies.filter((c) => QUOTITES.includes(c))).toEqual([]);
  });

  it('date la première quotité au 31 janvier et la seconde au 30 avril, réserve du texte comprise', () => {
    const servies = obligationsDeclarativesApplicables(
      Referentiel.SYSCOHADA,
      FormeJuridiqueSyscohada.ENTREPRENANT,
    );
    const premiere = servies.find((o) => o.cle === 'premiereQuotitePetiteEntreprise')!;
    const seconde = servies.find((o) => o.cle === 'secondeQuotitePetiteEntreprise')!;
    expect([premiere.moisEcheance, premiere.jourEcheance]).toEqual([1, 31]);
    expect([seconde.moisEcheance, seconde.jourEcheance]).toEqual([4, 30]);
    // La coquille de l'art. 57 quater, al. 3 est SIGNALÉE, pas corrigée en
    // silence · le même alinéa ne peut pas fixer deux dates à la 1ère quotité.
    expect(seconde.contenu).toContain('À CONFIRMER');
    expect(seconde.baseLegale).toContain('57 quater');
  });
});

describe('Procès-verbal de l’assemblée à la DGI (LPF art. 13 bis)', () => {
  it('compté depuis l’assemblée DÉCLARÉE sur l’exercice · dix jours, reportés au jour ouvrable', async () => {
    const svc = service('SYSCOHADA');
    const prisma = (svc as unknown as { prisma: { exercice: { findFirst: jest.Mock } } }).prisma;
    prisma.exercice.findFirst.mockResolvedValue({
      id: 'e1',
      dateDebut: new Date('2026-01-01'),
      dateFin: new Date('2026-12-31'),
      // Samedi 20 mars 2027 · plus dix jours, mardi 30 mars 2027.
      dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)),
    });
    const pv = (await svc.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2027-03-01' })).echeances.find(
      (e) => e.cle === 'procesVerbalAssemblee',
    )!;
    expect(pv.date.toISOString().slice(0, 10)).toBe('2027-03-30');
    expect(pv.echeance).toContain('assemblée déclarée tenue le 20/03/2027');
    // Sans assemblée déclarée, le repère du 10 juillet demeure (samedi en 2027, reporté au lundi 12).
    const sans = (await echeances('SYSCOHADA', '2027-03-01')).find((e) => e.cle === 'procesVerbalAssemblee')!;
    expect(sans.date.toISOString().slice(0, 10)).toBe('2027-07-12');
  });

  it('ÉCHUE, elle n’est plus servie · le 07/10/2027, le 30/03/2027 cède la place à la prochaine occurrence', async () => {
    const svc = service('SYSCOHADA');
    const prisma = (svc as unknown as { prisma: { exercice: { findFirst: jest.Mock } } }).prisma;
    prisma.exercice.findFirst.mockResolvedValue({
      id: 'e1',
      dateDebut: new Date('2026-01-01'),
      dateFin: new Date('2026-12-31'),
      dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)),
    });
    const pv = (await svc.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2027-10-07' })).echeances.find(
      (e) => e.cle === 'procesVerbalAssemblee',
    )!;
    // Le repère suivant (10 juillet 2028, lundi), jamais une date passée en tête de liste.
    expect(pv.date.toISOString().slice(0, 10)).toBe('2028-07-10');
    expect(pv.echeance).not.toContain('assemblée déclarée');
    expect(pv.date.getTime()).toBeGreaterThanOrEqual(Date.UTC(2027, 9, 7));
  });

  it('entreprise du portefeuille sans assemblée déclarée · repère au 31 mars plus dix jours (10 avril), reporté', async () => {
    const svc = service('SYSCOHADA');
    const prisma = (svc as unknown as { prisma: { tenant: { findUniqueOrThrow: jest.Mock } } }).prisma;
    prisma.tenant.findUniqueOrThrow.mockResolvedValue({
      referentiel: 'SYSCOHADA',
      formeJuridiqueSyscohada: 'SOCIETE_ANONYME',
      entreprisePortefeuilleEtat: true,
    });
    const pv = (await svc.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2027-03-01' })).echeances.find(
      (e) => e.cle === 'procesVerbalAssemblee',
    )!;
    // Samedi 10 avril 2027 · reporté au lundi 12 (déclaration, LPF art. 110 bis).
    expect(pv.date.toISOString().slice(0, 10)).toBe('2027-04-12');
    expect(pv.echeance).toContain('portefeuille de l’État');
    // Hors portefeuille, le 10 juillet demeure.
    prisma.tenant.findUniqueOrThrow.mockResolvedValue({ referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'SOCIETE_ANONYME', entreprisePortefeuilleEtat: false });
    const ordinaire = (await svc.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2027-03-01' })).echeances.find(
      (e) => e.cle === 'procesVerbalAssemblee',
    )!;
    expect(ordinaire.date.toISOString().slice(0, 10)).toBe('2027-07-12');
  });
});

describe('Procès-verbal de la LPF art. 13 bis · seulement sous commissaire aux comptes', () => {
  /*
    Décision par la loi du 2026-10-07 (constat final) · « dans les dix jours
    de la tenue de l'Assemblée générale ordinaire approuvant les états
    financiers CERTIFIÉS PAR LES COMMISSAIRES AUX COMPTES » · sans mandat qui
    couvre l'exercice, rien n'est présenté comme dû, et c'est dit.
  */
  const avecMandats = (mandats: Array<Record<string, unknown>>, tenant: Record<string, unknown> = { referentiel: 'SYSCOHADA' }) => {
    const svc = service('SYSCOHADA');
    const prisma = (svc as unknown as {
      prisma: { mandatAuditeur: { findMany: jest.Mock }; tenant: { findUniqueOrThrow: jest.Mock } };
    }).prisma;
    prisma.mandatAuditeur.findMany.mockResolvedValue(mandats);
    prisma.tenant.findUniqueOrThrow.mockResolvedValue(tenant);
    return svc.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2027-03-01' });
  };

  it('aucun mandat, SARL · le procès-verbal n’est pas servi, et l’avertissement dit pourquoi', async () => {
    const r = await avecMandats([], { referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    expect(r.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeUndefined();
    expect(r.avertissements).toContain(AVERTISSEMENT_PV_SANS_COMMISSAIRE);
    expect(AVERTISSEMENT_PV_SANS_COMMISSAIRE).toContain('certifiés par les commissaires aux comptes');
    // Les autres déclarations de la société restent servies.
    expect(r.echeances.find((e) => e.cle === 'declarationImpotSocietes')).toBeDefined();
  });

  it('aucun mandat, forme non renseignée · le procès-verbal reste servi « à confirmer » (la société peut être une SA)', async () => {
    const r = await avecMandats([]);
    const pv = r.echeances.find((e) => e.cle === 'procesVerbalAssemblee');
    expect(pv).toBeDefined();
    expect(pv!.echeance).toContain(PV_A_CONFIRMER_SANS_FORME);
    expect(r.avertissements).not.toContain(AVERTISSEMENT_PV_SANS_COMMISSAIRE);
  });

  it('un mandat échu en 2025 ne couvre pas 2026, sauf prorogation de la SA (AUSCGIE art. 709)', async () => {
    const echu = [{ premierExercice: 2023, nombreExercices: 3, refusDeProrogation: false }];
    const sarl = await avecMandats(echu, { referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    expect(sarl.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeUndefined();
    const sa = await avecMandats(echu, { referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'SOCIETE_ANONYME' });
    expect(sa.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeDefined();
    expect(sa.avertissements).not.toContain(AVERTISSEMENT_PV_SANS_COMMISSAIRE);
    // Refus exprès du commissaire · pas de prorogation, mais une SA a TOUJOURS
    // un commissaire (AUSCGIE art. 694 et 702) · le procès-verbal reste servi,
    // « à confirmer ».
    const refus = await avecMandats([{ ...echu[0], refusDeProrogation: true }], {
      referentiel: 'SYSCOHADA',
      formeJuridiqueSyscohada: 'SOCIETE_ANONYME',
    });
    expect(refus.echeances.find((e) => e.cle === 'procesVerbalAssemblee')?.echeance).toContain(PV_A_CONFIRMER_SANS_MANDAT);
  });

  it('SA sans mandat enregistré · le commissaire existe par la loi (art. 694, 702), le procès-verbal reste servi « à confirmer »', async () => {
    const sa = await avecMandats([], { referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'SOCIETE_ANONYME' });
    const pv = sa.echeances.find((e) => e.cle === 'procesVerbalAssemblee');
    expect(pv?.echeance).toContain('à confirmer · mandat de commissaire non enregistré');
    expect(sa.avertissements).not.toContain(AVERTISSEMENT_PV_SANS_COMMISSAIRE);
    // Avec un mandat qui couvre l'exercice, rien n'est « à confirmer ».
    const couvert = await avecMandats([{ premierExercice: 2026, nombreExercices: 6, refusDeProrogation: false }], {
      referentiel: 'SYSCOHADA',
      formeJuridiqueSyscohada: 'SOCIETE_ANONYME',
    });
    expect(couvert.echeances.find((e) => e.cle === 'procesVerbalAssemblee')?.echeance).not.toContain(PV_A_CONFIRMER_SANS_MANDAT);
  });

  it('un mandat terminé par anticipation couvre encore l’exercice clos avant sa fin, jamais celui clos après', async () => {
    const sarl = { referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' };
    const mandat = { premierExercice: 2025, nombreExercices: 3, refusDeProrogation: false };
    // L'exercice de la doublure se clôt le 31/12/2026.
    const finApres = await avecMandats([{ ...mandat, finAnticipeeLe: new Date(Date.UTC(2027, 5, 30)) }], sarl);
    expect(finApres.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeDefined();
    const finAvant = await avecMandats([{ ...mandat, finAnticipeeLe: new Date(Date.UTC(2026, 5, 30)) }], sarl);
    expect(finAvant.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeUndefined();
    expect(finAvant.avertissements).toContain(AVERTISSEMENT_PV_SANS_COMMISSAIRE);
  });

  it('la forme de l’EXERCICE décide (formeApplicable) · une SARL devenue SA en 2027 reste lue SARL pour 2026', async () => {
    const r = await avecMandats([], {
      referentiel: 'SYSCOHADA',
      formeJuridiqueSyscohada: 'SOCIETE_ANONYME',
      formeJuridiqueSyscohadaAnterieure: 'SOCIETE_RESPONSABILITE_LIMITEE',
      dateTransformationForme: new Date(Date.UTC(2027, 1, 1)),
    });
    // SARL sans commissaire · pas de procès-verbal, l'avertissement le dit.
    expect(r.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeUndefined();
    expect(r.avertissements).toContain(AVERTISSEMENT_PV_SANS_COMMISSAIRE);
  });

  it('une association n’a ni procès-verbal ni avertissement · l’obligation ne la vise pas', async () => {
    const svc = service('SYCEBNL');
    const prisma = (svc as unknown as { prisma: { mandatAuditeur: { findMany: jest.Mock } } }).prisma;
    prisma.mandatAuditeur.findMany.mockResolvedValue([]);
    const r = await svc.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2027-03-01' });
    expect(r.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeUndefined();
    expect(r.avertissements).not.toContain(AVERTISSEMENT_PV_SANS_COMMISSAIRE);
  });
});

/**
 * UNE SOCIÉTÉ DISSOUTE (décision par la loi du 2026-10-07, quatrième lot,
 * points 3, 4 et 5 ; constat 9) · le câblage de l'échéancier, testé avec la
 * règle. Dissolution le 15 mai 2026, clôture de la liquidation le 10 septembre
 * 2026, échéancier lu le 1er juin 2026.
 */
describe('Échéancier d’une société dissoute', () => {
  function serviceDissoute() {
    const tenant = {
      referentiel: Referentiel.SYSCOHADA,
      formeJuridiqueSyscohada: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
      dateDissolution: new Date('2026-05-15'),
      dateClotureLiquidation: new Date('2026-09-10'),
      regimeLiquidation: 'AMIABLE_STATUTAIRE',
      associeUniquePersonneMorale: false,
      dateDeclarationCotisationActivite: null,
      dateDeclarationCotisationLiquidation: null,
    };
    const prisma = {
      exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-05-15') }) },
      tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(tenant) },
      ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
      ecriture: { findFirst: jest.fn().mockResolvedValue(null) },
      compte: { findMany: jest.fn().mockResolvedValue([]) },
      mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    return new RetenuesService(prisma);
  }

  it('ni déclaration annuelle de 2026, ni acompte après la dernière cotisation · les deux cotisations à leur place', async () => {
    const { echeances: liste } = await serviceDissoute().echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-06-01' });
    const parCle = new Map(liste.map((e) => [e.cle, e]));
    // Le 30 avril 2027 vise les revenus de 2026, l'année de la dissolution.
    expect(parCle.has('declarationImpotSocietes')).toBe(false);
    expect(parCle.get('premierAcompteIs')!.reserve).toContain('57 bis');
    expect(parCle.has('deuxiemeAcompteIs')).toBe(true);
    // 25 novembre 2026, après l'échéance de la seconde cotisation (12 octobre).
    expect(parCle.has('troisiemeAcompteIs')).toBe(false);
    const activite = parCle.get('cotisationSpecialeActivite')!;
    const liquidation = parCle.get('cotisationSpecialeLiquidation')!;
    expect([activite.periodicite, activite.genre]).toEqual(['PONCTUELLE', 'DECLARATION']);
    expect(activite.date.toISOString().slice(0, 10)).toBe('2026-06-15');
    expect(liquidation.date.toISOString().slice(0, 10)).toBe('2026-10-12');
  });
});
