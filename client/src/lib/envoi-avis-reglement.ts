/**
 * L'AVIS DE RÈGLEMENT ENVOYÉ PAR LA MESSAGERIE (ligne gl-saisie, fonction 35)
 * · ce que le serveur rend (`EnvoiAvisReglementService`) et la phrase du
 * compte rendu. Les avis sont ÉCRITS en file ; ils partent par la reprise, que
 * l'écran enchaîne comme pour les relances.
 */
export interface BilanEnvoiAvis {
  misesEnFile: { ligneId: string; beneficiaire: string; destinataire: string; messageId: string; statut: string }[];
  dejaEnvoyes: { ligneId: string; beneficiaire: string }[];
  sansAdresse: { ligneId: string; beneficiaire: string }[];
  refuses: { ligneId: string; beneficiaire: string; motif: string }[];
}

/** Le compte rendu, chaque cas nommé · jamais « envoyé » pour un avis seulement écrit en file. */
export function phraseEnvoiAvis(b: BilanEnvoiAvis): string {
  const parts: string[] = [];
  // « avis » est invariable.
  parts.push(b.misesEnFile.length ? `${b.misesEnFile.length} avis mis en file` : 'Aucun avis mis en file');
  if (b.dejaEnvoyes.length) parts.push(`déjà en file ou envoyé · ${b.dejaEnvoyes.map((d) => d.beneficiaire).join(', ')}`);
  if (b.sansAdresse.length) parts.push(`sans adresse sur la fiche du tiers · ${b.sansAdresse.map((d) => d.beneficiaire).join(', ')}`);
  if (b.refuses.length) parts.push(`refusés · ${b.refuses.map((d) => `${d.beneficiaire} (${d.motif})`).join(', ')}`);
  return `${parts.join(' ; ')}.`;
}

/** Combien attendent la reprise · ceux que la file a pris EN_ATTENTE (une messagerie est configurée). */
export function avisEnAttente(b: BilanEnvoiAvis): number {
  return b.misesEnFile.filter((m) => m.statut === 'EN_ATTENTE').length;
}
