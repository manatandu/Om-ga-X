import { ConflictException } from "@nestjs/common";
import { CODE_DOSSIER_OCCUPE } from "../../common/audit/extension-audit";
import { CODE_CONFLIT_SERIALISATION } from "../../common/prisma-retry.util";

/**
 * UN RÈGLEMENT À PLUSIEURS TIERS NE S'INTERROMPT PAS EN SILENCE (point 6 de
 * la relecture lettrage-verrou, 2026-10-29). Chaque tiers a sa pièce et son
 * lettrage, chacun dans sa transaction · tout se vérifie avant la première
 * pièce (F56), mais une étape peut encore être refusée par la concurrence,
 * le lettrage du second tiers surtout, derrière une opération longue du même
 * dossier (`DOSSIER_OCCUPE`). Deux règles.
 *
 * (1) L'ÉTAPE REFUSÉE SANS RIEN ÉCRIRE SE REJOUE ici · le 409
 * `DOSSIER_OCCUPE` ou `CONFLIT_SERIALISATION` garantit que SA transaction n'a
 * rien écrit (`reprise-conflit.ts` côté écran) · le lettrage d'une pièce, son
 * délettrage, le retrait d'une compensation se rejouent sans risque, la
 * requête entière jamais (elle paierait deux fois le premier tiers).
 *
 * (2) INTERROMPU APRÈS UN TIERS PASSÉ, LE RÈGLEMENT LE DIT · les pièces déjà
 * passées sont nommées, la pièce restée au brouillard sans son lettrage aussi
 * (jusqu'ici dite au seul journal du serveur), et le refus porte son propre
 * code, `REGLEMENT_INTERROMPU` · jamais celui d'un refus qui n'a rien écrit,
 * qu'une interface rejouerait.
 */
export const CODE_REGLEMENT_INTERROMPU = "REGLEMENT_INTERROMPU";
export const TENTATIVES_ETAPE = 3;

/** Le refus d'une étape qui n'a rien écrit · reconnu à son CODE, jamais au texte. */
export function estRefusSansEcriture(e: unknown): boolean {
  if (!(e instanceof ConflictException)) return false;
  const r = e.getResponse();
  const code =
    typeof r === "object" && r !== null
      ? (r as { code?: unknown }).code
      : undefined;
  return code === CODE_DOSSIER_OCCUPE || code === CODE_CONFLIT_SERIALISATION;
}

export async function rejouerSiRienEcrit<T>(
  etape: () => Promise<T>,
  attendre: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  for (let tentative = 1; ; tentative++) {
    try {
      return await etape();
    } catch (e) {
      if (tentative >= TENTATIVES_ETAPE || !estRefusSansEcriture(e)) throw e;
      await attendre(250 * tentative);
    }
  }
}

export interface PiecePassee {
  compte: string;
  piece: string;
}

const motifDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Le refus d'un règlement interrompu · `null` quand rien n'est passé et que la
 * pièce du tiers refusé a bien été retirée (l'erreur d'origine remonte alors
 * telle quelle, elle dit vrai).
 */
export function refusReglementInterrompu(
  e: unknown,
  compteRefuse: string,
  passees: PiecePassee[],
  resteeAuBrouillard: string | null,
): ConflictException | null {
  if (passees.length === 0 && resteeAuBrouillard === null) return null;
  const parties = [
    `Le règlement s'est interrompu au compte ${compteRefuse} · ${motifDe(e)}`,
  ];
  if (passees.length > 0) {
    parties.push(
      `Déjà passés, et gardés · ${passees.map((p) => `${p.compte} (pièce ${p.piece})`).join(", ")} ; l'ordre de virement n'a pas été établi.`,
    );
  }
  if (resteeAuBrouillard !== null) {
    parties.push(
      `La pièce ${resteeAuBrouillard} du compte ${compteRefuse} est restée au brouillard sans son lettrage · lettrez-la ou supprimez-la.`,
    );
  }
  parties.push(
    "Ne relancez pas le règlement entier · réglez seulement les tiers restants.",
  );
  return new ConflictException({
    message: parties.join(" "),
    code: CODE_REGLEMENT_INTERROMPU,
    passees,
    resteeAuBrouillard,
  });
}
