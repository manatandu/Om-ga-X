import { centimesLoinDeZero, exact, fois } from '../../common/decimal-exact';

/**
 * BON DE COMMANDE FOURNISSEUR · les règles pures (ligne microfina-m2, idée 2).
 *
 * SYCEBNL, Guide d'application, ch. 7, APPLICATION 22, règle (d) · la colonne
 * Engagement du tableau d'exécution budgétaire porte, à côté du solde
 * créditeur des comptes 40 et 481, les « bons de commande de biens et
 * services remis aux fournisseurs au cours de l'exercice budgétaire, NON
 * EXÉCUTÉS ». Le bon fait naître ce terme À SA REMISE, ligne budgétaire par
 * ligne budgétaire ; la facture d'achat qui le suit le fait passer au terme 1
 * (le 40, que la fiche du compte 40 crédite « du montant des factures »).
 *
 * TOUT SE CALCULE EN CENTIMES ENTIERS · un engagement se compare à une somme
 * de parts, et le flottant fait de 0,1 + 0,2 un reste de 0,30000000000000004.
 */

/** Le montant HT d'une ligne · quantité × prix, au centime (demi-centime loin de zéro, la règle de la colonne Decimal(18,2)). */
export function montantHTEnCentimes(quantite: number, prixUnitaire: number): number {
  return Number(centimesLoinDeZero(fois(exact(quantite), exact(prixUnitaire))));
}

/**
 * Un montant saisi, en centimes entiers, ou null s'il n'est pas au centime ·
 * même règle que `estAuCentime` (virements-fonds), sans seuil flottant.
 */
export function enCentimesExacts(montant: number): number | null {
  if (!Number.isFinite(montant)) return null;
  return Math.round(montant * 100) / 100 === montant ? Math.round(montant * 100) : null;
}

export interface LigneDuBon {
  sectionId: string;
  montantHTCentimes: number;
  montantTvaCentimes: number;
}

/**
 * CE QUE LE BON ENGAGE, PAR LIGNE BUDGÉTAIRE · le TTC PRÉVU (HT plus taxe
 * prévue). La facture qui l'exécute crédite le 40 de son montant toutes taxes
 * (fiche du compte 40 · « crédité du montant des factures », par le débit de
 * la classe 6 hors taxes récupérables et du 445) · engager le seul HT ferait
 * passer au terme 1 plus que ce qui sortait du terme 2, et le crédit
 * disponible baisserait d'une taxe qui n'était engagée nulle part.
 */
export function engageParSection(lignes: readonly LigneDuBon[]): Map<string, number> {
  const parSection = new Map<string, number>();
  for (const l of lignes) {
    parSection.set(l.sectionId, (parSection.get(l.sectionId) ?? 0) + l.montantHTCentimes + l.montantTvaCentimes);
  }
  return parSection;
}

/** Le reste à facturer de chaque ligne budgétaire · jamais négatif (une facture ne s'impute pas au-delà, refusé plus haut). */
export function resteParSection(
  engage: ReadonlyMap<string, number>,
  executions: readonly { sectionId: string; montantCentimes: number }[],
): Map<string, number> {
  const reste = new Map(engage);
  for (const e of executions) reste.set(e.sectionId, (reste.get(e.sectionId) ?? 0) - e.montantCentimes);
  for (const [k, v] of reste) if (v < 0) reste.set(k, 0);
  return reste;
}

export interface PartDeclaree {
  sectionId: string;
  montantCentimes: number;
}

/**
 * LES PARTS D'UNE FACTURE SONT DÉCLARÉES, JAMAIS RÉPARTIES · une facture peut
 * solder la commande en partie, ou deux commandes ; un prorata deviné
 * ferait baisser une ligne budgétaire que la facture ne touche pas.
 * Le dépassement est REFUSÉ plutôt que rogné (même règle que le registre des
 * engagements) · rogné en silence, la facture se croirait rattachée en entier.
 */
export function motifRefusParts(
  parts: readonly PartDeclaree[],
  reste: ReadonlyMap<string, number>,
  codeSection: (id: string) => string,
): string | null {
  if (parts.length === 0) return 'Déclarez au moins une part · la facture exécute une ou plusieurs lignes budgétaires du bon.';
  const vues = new Set<string>();
  for (const p of parts) {
    if (vues.has(p.sectionId)) return `La ligne budgétaire ${codeSection(p.sectionId)} est déclarée deux fois · une part par ligne.`;
    vues.add(p.sectionId);
    if (!reste.has(p.sectionId)) return `La ligne budgétaire ${codeSection(p.sectionId)} ne figure pas sur ce bon de commande.`;
    if (!Number.isInteger(p.montantCentimes) || p.montantCentimes <= 0) {
      return `La part de la ligne ${codeSection(p.sectionId)} doit être un montant positif, au centime.`;
    }
    const r = reste.get(p.sectionId) ?? 0;
    if (p.montantCentimes > r) {
      return (
        `La part de la ligne ${codeSection(p.sectionId)} (${francs(p.montantCentimes)}) dépasse ce qui reste à facturer ` +
        `sur elle (${francs(r)}) · déclarez au plus le reste ; si la dépense réelle excède la commande, l'excédent suit ` +
        "son cours comptable et la colonne Décaissement le porte déjà."
      );
    }
  }
  return null;
}

/**
 * La référence de l'engagement né d'un bon · le numéro du bon et le code de la
 * ligne budgétaire, ce qui reste unique sous la clé du registre
 * (dossier, exercice, nature, référence) quand le bon porte plusieurs lignes.
 */
export function referenceEngagement(numero: number, codeSection: string): string {
  return `BC ${numero} · ${codeSection}`;
}

export function francs(centimes: number): string {
  return (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Un jour AAAA-MM-JJ valide, ou null. */
export function jourValide(iso: unknown): string | null {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

/**
 * UNE FACTURE QUI EXÉCUTE UN BON NE SE BARRE PAS EN SILENCE (relecture M1).
 * La note de crédit annule la facture « annulant et remplaçant » (décret
 * n° 011/42, art. 127) · la dépense sort du 40, mais la part déclarée sur le
 * bon resterait posée, et l'engagement de la commande, tenu pour exécuté,
 * sortirait lui aussi de la colonne Engagement (règle (d) de l'Application 22) ·
 * la commande disparaîtrait du tableau sans que rien ne bouge ailleurs.
 *
 * VOIE RETENUE · le refus, avec son issue (retirer la facture du bon, puis
 * barrer), plutôt que des factures barrées écartées en lecture · un rattachement
 * qui ne vaudrait plus rien mais resterait au registre se lirait de travers
 * partout où l'exécution est sommée (registre des engagements, plafond de la
 * pièce, reste du bon).
 *
 * SEULE EXCEPTION, pour ne pas enfermer le dossier · une part que le bon ne
 * peut plus rendre parce que l'exercice où elle pèse est CLÔTURÉ (le tableau
 * arrêté ne change plus, `retirerFacture` la refuse) · la note passe alors, et
 * c'est dit. Rend le refus, ou les bons à nommer en avertissement.
 */
export function issueNoteDeCreditSurFactureDUnBon(
  numeroSerie: string,
  parts: readonly { numeroBon: number | null; pesePourUnExerciceClos: boolean }[],
): { motif: string } | { avertissements: string[] } {
  if (parts.length === 0) return { avertissements: [] };
  const retirables = [...new Set(parts.filter((p) => !p.pesePourUnExerciceClos).map((p) => p.numeroBon ?? 0))];
  if (retirables.length > 0) {
    return {
      motif:
        `La facture ${numeroSerie} exécute le(s) bon(s) de commande n° ${retirables.join(', ')} · barrée, elle laisserait la commande tenue pour exécutée ` +
        "et la ferait sortir du tableau d'exécution budgétaire sans un mot. Retirez-la du bon d'abord (Traitement > Achats > Bons de commande fournisseur, « Retirer »), puis émettez la note de crédit.",
    };
  }
  const clos = [...new Set(parts.map((p) => p.numeroBon ?? 0))];
  return {
    avertissements: [
      `La facture exécutait le(s) bon(s) n° ${clos.join(', ')} dans un exercice clôturé · le tableau arrêté ne change plus, et le bon garde la part que cette facture lui a portée.`,
    ],
  };
}
