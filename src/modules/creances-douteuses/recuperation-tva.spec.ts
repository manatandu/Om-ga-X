import {
  chiffrerFactures,
  EntreeRecuperation,
  FactureDeLaCreance,
  finDuDroit,
  derniereDateEcriture,
  mentionDuplicata,
  MOTIF_FACTURE_PAYEE,
  MOTIF_FACTURE_SANS_TVA,
  MOTIF_TAXE_A_L_ENCAISSEMENT,
  motifRecuperationEnPlace,
  motifRefusAnnulationRecuperation,
  motifRefusPerteAvecTva,
  motifRefusRecuperation,
  RACINE_PROFITS_SUR_CREANCES,
  ventilerPerte,
} from './recuperation-tva';

/**
 * LIGNE A7 BIS, PARTIE 2 · la récupération de la TVA d'une créance
 * irrécouvrable (O.-L. n° 10/001, art. 52 ; décret n° 011/42, art. 126 et
 * 127). Chaque montant est calculé à la main dans le commentaire du cas.
 */

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** Une facture de 1 160 000 TTC · 1 000 000 HT et 160 000 de TVA à 16 %. */
function facture(
  id: string,
  dateFacture: string,
  base: 'DATE_ECRITURE' | 'ENCAISSEMENT',
  o: { montant?: number; ttc?: number; tva?: number; compte?: string } = {},
): FactureDeLaCreance {
  return {
    designationId: id,
    ligneEcritureId: `l-${id}`,
    montant: o.montant ?? 1_160_000,
    dateFacture: d(dateFacture),
    dateEcheance: null,
    libelle: `Facture ${id}`,
    numeroPiece: 1,
    taxe: {
      ttc: o.ttc ?? 1_160_000,
      lignesTva: [{ ligneId: `t-${id}`, compteId: o.compte ?? 'c4431', numero: '44310000', tauxTvaId: 'tva16', tva: o.tva ?? 160_000, base }],
    },
  };
}

describe('A7 bis, partie 2 · chiffrage de la taxe récupérable', () => {
  it('livraison de biens · 1 160 000 désignée, 580 000 recouvrés · impayé 580 000, HT 500 000, TVA 80 000 récupérable', () => {
    // 580 000 × 160 000 / 1 160 000 = 80 000 ; 580 000 − 80 000 = 500 000.
    const [f] = chiffrerFactures({ reclasse: 1_160_000, factures: [facture('A', '2026-02-01', 'DATE_ECRITURE')], recouvrements: [{ date: d('2026-05-10'), montant: 580_000 }] });
    expect(f).toMatchObject({ designe: 1_160_000, recouvre: 580_000, impayeTtc: 580_000, impayeHt: 500_000, tvaCorrespondante: 80_000, tvaRecuperable: 80_000, motifs: [] });
    expect(f.recuperable).toEqual([{ compteId: 'c4431', numero: '44310000', tauxTvaId: 'tva16', tva: 80_000 }]);
  });

  it('prestation à l’encaissement · la taxe de l’impayé n’a jamais été acquittée · rien à récupérer, la mention garde la taxe correspondante', () => {
    // O.-L. n° 10/001, art. 25, 2° · 580 000 jamais encaissés.
    const [f] = chiffrerFactures({ reclasse: 1_160_000, factures: [facture('S', '2026-02-01', 'ENCAISSEMENT')], recouvrements: [{ date: d('2026-05-10'), montant: 580_000 }] });
    expect(f).toMatchObject({ impayeTtc: 580_000, impayeHt: 500_000, tvaCorrespondante: 80_000, tvaRecuperable: 0 });
    expect(f.motifs).toEqual([MOTIF_TAXE_A_L_ENCAISSEMENT]);
  });

  it('deux factures · le recouvrement paie la plus ancienne (Code civil, Livre III, art. 154), l’impayé est celui de la plus récente', () => {
    // Prestation du 01/02 (580 000) payée par le recouvrement de 580 000 ;
    // livraison du 01/03 (580 000 TTC, 80 000 de TVA) impayée · 80 000.
    const s = facture('S', '2026-02-01', 'ENCAISSEMENT', { montant: 580_000, ttc: 580_000, tva: 80_000 });
    const b = facture('B', '2026-03-01', 'DATE_ECRITURE', { montant: 580_000, ttc: 580_000, tva: 80_000 });
    const [fs, fb] = chiffrerFactures({ reclasse: 1_160_000, factures: [s, b], recouvrements: [{ date: d('2026-05-10'), montant: 580_000 }] });
    expect(fs).toMatchObject({ recouvre: 580_000, impayeTtc: 0, tvaRecuperable: 0 });
    expect(fs.motifs).toContain(MOTIF_FACTURE_PAYEE);
    expect(fb).toMatchObject({ recouvre: 0, impayeTtc: 580_000, tvaRecuperable: 80_000 });
    // L'ordre inverse · la livraison, plus ancienne, est payée ; la prestation impayée ne rend rien.
    const b2 = facture('B', '2026-02-01', 'DATE_ECRITURE', { montant: 580_000, ttc: 580_000, tva: 80_000 });
    const s2 = facture('S', '2026-03-01', 'ENCAISSEMENT', { montant: 580_000, ttc: 580_000, tva: 80_000 });
    const [gb, gs] = chiffrerFactures({ reclasse: 1_160_000, factures: [b2, s2], recouvrements: [{ date: d('2026-05-10'), montant: 580_000 }] });
    expect(gb.tvaRecuperable).toBe(0);
    expect(gs).toMatchObject({ impayeTtc: 580_000, tvaRecuperable: 0 });
  });

  it('désignation partielle · seule la part désignée du recouvrement est imputée (recouvré × désigné / reclassé), comme la déclaration', () => {
    // Désigné 580 000 sur 1 160 000 reclassés ; recouvré 580 000 · part
    // désignée 580 000 × 580 000 / 1 160 000 = 290 000 ; impayé 290 000 ;
    // TVA 290 000 × 160 000 / 1 160 000 = 40 000 ; HT 250 000.
    const [f] = chiffrerFactures({
      reclasse: 1_160_000,
      factures: [facture('A', '2026-02-01', 'DATE_ECRITURE', { montant: 580_000 })],
      recouvrements: [{ date: d('2026-05-10'), montant: 580_000 }],
    });
    expect(f).toMatchObject({ recouvre: 290_000, impayeTtc: 290_000, impayeHt: 250_000, tvaRecuperable: 40_000 });
  });

  it('relecture, BLOQUANT · désigner B après la récupération de A redistribue le recouvré et ferait récupérer 240 000 pour 160 000 dus · d’où le refus de toute désignation sous une récupération', () => {
    // Reclassé 2 320 000 ; A et B, ventes de 1 160 000 (160 000 de TVA) ;
    // recouvré 1 160 000. A seule désignée · part désignée du recouvré
    // 1 160 000 × 1 160 000 / 2 320 000 = 580 000 ; impayé de A 580 000 ;
    // TVA 80 000, récupérée.
    const a = facture('A', '2026-02-01', 'DATE_ECRITURE');
    const avant = chiffrerFactures({ reclasse: 2_320_000, factures: [a], recouvrements: [{ date: d('2026-05-10'), montant: 1_160_000 }] });
    expect(avant[0].tvaRecuperable).toBe(80_000);
    // B désignée ENSUITE · le recouvré entier va à A, la plus ancienne
    // (art. 154) · A n'a plus d'impayé, B 1 160 000, soit 160 000 offerts.
    const b = facture('B', '2026-03-01', 'DATE_ECRITURE');
    const apres = chiffrerFactures({ reclasse: 2_320_000, factures: [a, b], recouvrements: [{ date: d('2026-05-10'), montant: 1_160_000 }] });
    expect(apres.map((f) => f.tvaRecuperable)).toEqual([0, 160_000]);
    // Total 80 000 + 160 000 = 240 000, pour 1 160 000 impayés, soit 160 000
    // de taxe due · le service refuse la désignation (motifRecuperationEnPlace).
    expect(avant[0].tvaRecuperable + apres[1].tvaRecuperable).toBe(240_000);
    expect(motifRecuperationEnPlace('désigner une facture', 1)).toMatch(/désigner une facture changerait l’impayé/);
  });

  it('une pièce sans ligne de TVA collectée lisible ne rend rien, et le dit', () => {
    const sans = { ...facture('X', '2026-02-01', 'DATE_ECRITURE'), taxe: { ttc: 1_160_000, lignesTva: [] } };
    const [f] = chiffrerFactures({ reclasse: 1_160_000, factures: [sans], recouvrements: [] });
    expect(f).toMatchObject({ impayeTtc: 1_160_000, tvaRecuperable: 0, tvaCorrespondante: 0 });
    expect(f.motifs).toEqual([MOTIF_FACTURE_SANS_TVA]);
  });

  it('la mention du duplicata reprend le texte de l’art. 127, al. 2, montants compris', () => {
    const m = mentionDuplicata(500_000, 80_000);
    expect(m.startsWith('FACTURE DEMEUREE IMPAYEE POUR LA SOMME DE ')).toBe(true);
    expect(m).toContain('PRIX HORS TVA ET POUR LA SOMME DE ');
    expect(m.endsWith('TVA CORRESPONDANTE QUI NE PEUT FAIRE L’OBJET D’UNE DEDUCTION')).toBe(true);
    expect(m.replace(/\s/g, '')).toContain('500000,00');
    expect(m.replace(/\s/g, '')).toContain('80000,00');
  });

  it('le droit s’exerce jusqu’au 31 décembre de l’année qui suit la constatation (art. 37 al. 2, par le renvoi de l’art. 126)', () => {
    expect(finDuDroit(d('2026-03-15')).toISOString().slice(0, 10)).toBe('2027-12-31');
  });
});

describe('A7 bis, partie 2 · les refus nommés', () => {
  const chiffrees = chiffrerFactures({
    reclasse: 1_160_000,
    factures: [facture('A', '2026-02-01', 'DATE_ECRITURE')],
    recouvrements: [{ date: d('2026-05-10'), montant: 580_000 }],
  });
  const base = (): EntreeRecuperation => ({
    creanceAnnulee: false,
    creanceCorrigee: false,
    resteFinal: 0,
    pertes: [{ date: d('2026-06-15'), validee: true, numeroPiece: 12, compteId: 'c6511' }],
    designationsActives: 1,
    chiffrees,
    dejaRecuperees: new Set(),
    duplicatas: [{ designationId: 'A', reference: 'DUP-A', dateEnvoi: '2026-07-02' }],
    motif: 'Client en liquidation, aucun actif',
    pieces: [{ nature: 'Jugement de clôture pour insuffisance d’actif', reference: 'RCCM-2026-118', date: '2026-06-30' }],
    date: d('2026-07-10'),
    exerciceOuvert: true,
    dateDansExercice: true,
    journalGeneral: true,
    finDerniereLiquidation: d('2026-06-30'),
  });

  it('le cas complet passe', () => {
    expect(motifRefusRecuperation(base())).toBeNull();
  });

  const cas: Array<[string, (e: EntreeRecuperation) => void, RegExp]> = [
    ['aucune perte', (e) => (e.pertes = []), /Aucune perte n’est constatée/],
    ['créance non éteinte', (e) => (e.resteFinal = 100_000), /n’est pas éteinte · il reste 100000\.00 au 416.*réellement et définitivement irrécouvrable/],
    ['perte au brouillard', (e) => (e.pertes = [{ ...e.pertes[0], validee: false }]), /au brouillard · la constatation du non-paiement/],
    ['aucune désignation', (e) => (e.designationsActives = 0), /Aucune facture n’est désignée.*ne la devine jamais/],
    ['aucun duplicata', (e) => (e.duplicatas = []), /au moins une facture dont le duplicata surchargé/],
    ['désignation inconnue', (e) => (e.duplicatas = [{ designationId: 'Z', reference: 'x', dateEnvoi: '2026-07-01' }]), /n’est pas une désignation active/],
    ['choisie deux fois', (e) => (e.duplicatas = [e.duplicatas[0], e.duplicatas[0]]), /choisie deux fois/],
    ['déjà récupérée', (e) => (e.dejaRecuperees = new Set(['A'])), /déjà récupérée par une récupération non annulée/],
    ['référence du duplicata', (e) => (e.duplicatas = [{ ...e.duplicatas[0], reference: '  ' }]), /référence du duplicata.*art\. 52, al\. 3/],
    ['date d’envoi absente', (e) => (e.duplicatas = [{ ...e.duplicatas[0], dateEnvoi: null }]), /date d’envoi du duplicata est exigée/],
    ['duplicata postérieur au geste', (e) => (e.duplicatas = [{ ...e.duplicatas[0], dateEnvoi: '2026-07-11' }]), /la récupération suit l’envoi/],
    ['duplicata antérieur à la facture', (e) => (e.duplicatas = [{ ...e.duplicatas[0], dateEnvoi: '2026-01-15' }]), /ne peut pas précéder la facture/],
    ['motif', (e) => (e.motif = ' '), /motif est exigé/],
    ['preuve de l’irrécouvrabilité', (e) => (e.pieces = []), /preuve de la créance irrécouvrable incombe à l’assujetti/],
    ['exercice clos', (e) => (e.exerciceOuvert = false), /exercice choisi est clôturé/],
    ['hors exercice', (e) => (e.dateDansExercice = false), /sort de l’exercice/],
    ['journal', (e) => (e.journalGeneral = false), /opérations diverses/],
    ['avant la perte', (e) => (e.date = d('2026-06-14')), /ne précède pas la constatation.*2026-06-15/],
    ['après le délai', (e) => ((e.date = d('2028-01-01')), (e.finDerniereLiquidation = null), (e.duplicatas = [{ ...e.duplicatas[0], dateEnvoi: '2027-12-01' }])), /jusqu’au 2027-12-31.*art\. 37, al\. 2.*perte du 2026-06-15.*après le 2027-11-30.*déclaration de 2028/],
    ['dans une période liquidée', (e) => (e.date = d('2026-06-30')), /liquidée jusqu’au 2026-06-30/],
  ];
  it.each(cas)('refus · %s', (_n, changer, attendu) => {
    const e = base();
    if (_n === 'duplicata postérieur au geste' || _n === 'dans une période liquidée' || _n === 'avant la perte') {
      // La date d'envoi reste antérieure à la date testée.
      e.duplicatas = [{ ...e.duplicatas[0], dateEnvoi: '2026-06-10' }];
    }
    changer(e);
    expect(motifRefusRecuperation(e)).toMatch(attendu);
  });

  /*
    DÉCISION PAR LA LOI DU 2026-10-08 (point C) · le délai court de la
    constatation du non-paiement (la dernière perte, décret n° 011/42,
    art. 126) et se juge à la DÉCLARATION qui inscrit la récupération · celle
    du mois qui suit son écriture. L'écriture du 30 novembre de l'année qui
    suit est inscrite en décembre, dans le délai ; celle du 1er décembre le
    serait en janvier, hors du délai (O.-L. n° 10/001, art. 37, al. 2).
  */
  it('le 30 novembre de l’année qui suit passe encore · la déclaration de décembre l’inscrit', () => {
    const e = base();
    e.date = d('2027-11-30');
    expect(motifRefusRecuperation(e)).toBeNull();
    expect(derniereDateEcriture(d('2026-06-15')).toISOString().slice(0, 10)).toBe('2027-11-30');
  });

  it('le 1er décembre de l’année qui suit est refusé · sa déclaration (janvier) sortirait du délai, la date du geste n’y change rien', () => {
    const e = base();
    e.date = d('2027-12-01');
    expect(motifRefusRecuperation(e)).toMatch(/datée après le 2027-11-30, elle tomberait dans une déclaration de 2028/);
    e.date = d('2027-12-31');
    expect(motifRefusRecuperation(e)).toMatch(/hors du délai/);
  });

  it('le délai court de la DERNIÈRE perte, jamais de l’envoi du duplicata', () => {
    const e = base();
    // Deux pertes · la seconde, en 2027, ouvre le délai jusqu'au 31/12/2028.
    e.pertes = [...e.pertes, { date: d('2027-03-01'), validee: true, numeroPiece: 14, compteId: e.pertes[0].compteId }];
    e.date = d('2028-11-30');
    e.finDerniereLiquidation = null;
    expect(motifRefusRecuperation(e)).toBeNull();
    // Le duplicata envoyé en 2028 ne repousse rien · décembre 2028 reste au-delà.
    e.duplicatas = [{ ...e.duplicatas[0], dateEnvoi: '2028-11-01' }];
    e.date = d('2028-12-01');
    expect(motifRefusRecuperation(e)).toMatch(/perte du 2027-03-01.*après le 2028-11-30/);
  });

  it('une facture à la taxe datée à l’encaissement seule · refus nommé, avec son motif', () => {
    const e = base();
    e.chiffrees = chiffrerFactures({ reclasse: 1_160_000, factures: [facture('A', '2026-02-01', 'ENCAISSEMENT')], recouvrements: [] });
    expect(motifRefusRecuperation(e)).toMatch(/Aucune taxe acquittée.*art\. 25, 2°/);
  });

  it('une facture payée en entier ne se choisit pas', () => {
    const e = base();
    e.chiffrees = chiffrerFactures({ reclasse: 1_160_000, factures: [facture('A', '2026-02-01', 'DATE_ECRITURE')], recouvrements: [{ date: d('2026-05-10'), montant: 1_160_000 }] });
    expect(motifRefusRecuperation(e)).toMatch(/aucun impayé/);
  });
});

describe('A7 bis, partie 2 · annulation et gestes qui changeraient l’impayé', () => {
  const ok = { dejaAnnulee: null, exerciceClos: false, liquidationCouvrante: null, periodeClose: null, motif: 'Duplicata erroné' };
  it('passe avec un motif, avant toute liquidation qui la couvre', () => {
    expect(motifRefusAnnulationRecuperation(ok)).toBeNull();
  });
  it('refus · déjà annulée, exercice clos, liquidation couvrante (déclaration figée), motif', () => {
    expect(motifRefusAnnulationRecuperation({ ...ok, dejaAnnulee: '2026-08-01' })).toMatch(/déjà annulée/);
    expect(motifRefusAnnulationRecuperation({ ...ok, exerciceClos: true })).toMatch(/art\. 20, al\. 3/);
    expect(motifRefusAnnulationRecuperation({ ...ok, liquidationCouvrante: '2026-07-31' })).toMatch(/liquidée jusqu’au 2026-07-31.*figée/);
    expect(motifRefusAnnulationRecuperation({ ...ok, motif: 'x' })).toMatch(/de 3 à 500 caractères/);
    // Relecture, MAJEUR 2 · une clôture de période qui couvre la date refuse, avec l'issue.
    expect(motifRefusAnnulationRecuperation({ ...ok, periodeClose: '2027-02-01' })).toMatch(
      /clôture de période couvre la date.*inscrit au 2027-02-01.*art\. 22, 4°.*glisserait d’une période de déclaration.*clôture PARTIELLE du journal s’annule.*se déclare alors à la main/,
    );
  });
  it('une récupération en place refuse l’annulation d’un mouvement et le retrait d’une désignation', () => {
    expect(motifRecuperationEnPlace('annuler ce mouvement', 0)).toBeNull();
    expect(motifRecuperationEnPlace('annuler ce mouvement', 1)).toMatch(/annuler ce mouvement changerait l’impayé.*Annulez d’abord la récupération/);
  });
});

/*
  POINT D · DÉCISION DE MANASSE DU 2026-10-08 · aucun montant négatif, aucun
  crédit au 651. (1) La perte qui récupère la taxe la passe en UNE écriture de
  perte · D 651 (HT) / D 443 (taxe acquittée) / C compte d'origine (TTC),
  précédée du retour de la créance au compte d'origine. (2) La taxe à
  l'encaissement s'annule au 443 sans être déduite. (3) La perte déjà au TTC
  se complète par D 443 / C 751.
*/
describe('point D · la perte qui récupère la TVA', () => {
  const chiffrer = (base: 'DATE_ECRITURE' | 'ENCAISSEMENT', recouvre = 0) =>
    chiffrerFactures({
      reclasse: 1_160_000,
      factures: [facture('A', '2026-02-01', base)],
      recouvrements: recouvre > 0 ? [{ date: d('2026-05-10'), montant: recouvre }] : [],
    });
  const entree = (o: Partial<Parameters<typeof motifRefusPerteAvecTva>[0]> = {}): Parameters<typeof motifRefusPerteAvecTva>[0] => ({
    montant: 1_160_000,
    resteFinal: 1_160_000,
    pertesAnterieures: 0,
    chiffrees: chiffrer('DATE_ECRITURE'),
    dejaRecuperees: new Set(),
    duplicatas: [{ designationId: 'A', reference: 'DUP-A', dateEnvoi: '2027-03-01' }],
    date: d('2027-03-15'),
    finDerniereLiquidation: d('2027-02-28'),
    ...o,
  });

  it('exemple de référence · 1 160 000 au 4162, perte · D 6511 1 000 000 / D 4431 160 000 / C 4111 1 160 000', () => {
    // 1 160 000 × 160 000 / 1 160 000 = 160 000 ; 1 160 000 − 160 000 = 1 000 000.
    expect(motifRefusPerteAvecTva(entree())).toBeNull();
    const v = ventilerPerte(chiffrer('DATE_ECRITURE'));
    expect(v).toEqual({
      recuperee: [{ compteId: 'c4431', numero: '44310000', tauxTvaId: 'tva16', tva: 160_000 }],
      annulee: [],
      tva: 160_000,
      tvaAnnulee: 0,
    });
    expect(1_160_000 - v.tva - v.tvaAnnulee).toBe(1_000_000);
  });

  it('règle 2 · taxe à l’encaissement · annulée au 443 sans taux, rien de récupéré (art. 25, 2° ; art. 52, al. 1)', () => {
    const v = ventilerPerte(chiffrer('ENCAISSEMENT'));
    expect(v.recuperee).toEqual([]);
    expect(v.annulee).toEqual([{ compteId: 'c4431', numero: '44310000', tva: 160_000 }]);
    expect(v.tvaAnnulee).toBe(160_000);
    // Rien à récupérer · aucune période liquidée ne la refuse.
    expect(
      motifRefusPerteAvecTva(
        entree({ chiffrees: chiffrer('ENCAISSEMENT'), date: d('2027-02-10'), duplicatas: [{ designationId: 'A', reference: 'DUP-A', dateEnvoi: '2027-02-01' }] }),
      ),
    ).toBeNull();
  });

  it('(iv) perte partielle après un recouvrement de 580 000 · seul le reste sort, 500 000 HT et 80 000 de taxe', () => {
    const chiffrees = chiffrer('DATE_ECRITURE', 580_000);
    expect(motifRefusPerteAvecTva(entree({ chiffrees, montant: 580_000, resteFinal: 580_000 }))).toBeNull();
    const v = ventilerPerte(chiffrees);
    expect(v.tva).toBe(80_000);
    expect(580_000 - v.tva).toBe(500_000);
  });

  const refus: Array<[string, Partial<Parameters<typeof motifRefusPerteAvecTva>[0]>, RegExp]> = [
    ['une perte déjà au TTC', { pertesAnterieures: 1 }, /déjà passée au TTC.*D 443 \/ C 751/],
    ['perte qui n’éteint pas la créance', { montant: 1_000_000 }, /n° 10\/001, art\. 52, al\. 3.*Il reste 1160000\.00 au 416/],
    ['duplicata sans référence', { duplicatas: [{ designationId: 'A', reference: ' ', dateEnvoi: '2027-03-01' }] }, /référence du duplicata/],
    ['facture payée', { chiffrees: chiffrer('DATE_ECRITURE', 1_160_000), montant: 0, resteFinal: 0 }, /aucun impayé|Aucune taxe/],
    ['période liquidée', { date: d('2027-02-15'), duplicatas: [{ designationId: 'A', reference: 'DUP-A', dateEnvoi: '2027-02-01' }] }, /liquidée jusqu’au 2027-02-28/],
  ];
  it.each(refus)('refus · %s', (_n, o, attendu) => {
    expect(motifRefusPerteAvecTva(entree(o))).toMatch(attendu);
  });

  it('règle 3 · la perte déjà au TTC se complète au 751, semé 75100000 aux deux plans, jamais au 651', () => {
    expect(RACINE_PROFITS_SUR_CREANCES).toBe('751');
    const lire = (f: string) => require('fs').readFileSync(require('path').join(__dirname, '..', '..', f), 'utf8') as string;
    for (const semis of ['modules/comptes/compte-seed.ts', 'modules/comptes/compte-seed-syscohada.ts']) {
      expect(lire(semis)).toMatch(/'75100000'/);
    }
  });
});
