import type { LecteurDesPieces, ObjetLu, RegleDesPieces } from '../../common/pieces-jointes/table-des-pieces';

/**
 * LE DOCUMENT DE LA FICHE D'UN SALARIÉ (ligne sage-l6, fonction n° 22 · Sage
 * Paie, documents et pièces jointes de la fiche du personnel). Contrat,
 * pièce d'identité, diplôme, certificat, attestation.
 *
 * DÉCISION PAR LA LOI. Ce sont des DONNÉES À CARACTÈRE PERSONNEL ·
 * l'ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique,
 * art. 215, donne à la personne concernée le droit d'obtenir leur effacement
 * « dans un délai de trente (30) jours », et l'art. 216 oblige le responsable
 * du traitement à mettre en place « des mécanismes appropriés » pour
 * l'assurer. Le document se retire donc TOUJOURS ; ce que la loi oblige
 * l'employeur à tenir (le livre de paie, Code du travail art. 213 à 215 ;
 * arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008) vit dans le registre et les
 * bulletins, jamais dans une pièce jointe. Il se lit et se dépose aux
 * DROITS DU REGISTRE (rôles cantonnés · fermé à l'aide-comptable, ouvert au
 * gestionnaire de paie), et son nom et son commentaire n'entrent pas au
 * journal d'audit, que tout le dossier lit (`COLONNES_EXCLUES_PAR_MODELE`).
 */
async function lireSalarieDesPieces(db: LecteurDesPieces, tenantId: string, salarieId: string): Promise<ObjetLu | null> {
  const s = await db.salarie.findFirst({
    where: { id: salarieId, tenantId },
    select: { matricule: true, nom: true, postNom: true, prenoms: true },
  });
  if (!s) return null;
  const nom = [s.nom, s.postNom, s.prenoms].filter((x): x is string => !!x).join(' ');
  return { description: s.matricule ? `${s.matricule} · ${nom}` : nom, motifRefusDepot: null, motifRefusRetrait: null };
}

export const REGLE_PIECES_SALARIE: RegleDesPieces = {
  objet: 'SALARIE',
  designation: 'ce salarié',
  lireObjet: lireSalarieDesPieces,
};
