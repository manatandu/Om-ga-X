import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Aide } from "../components/chrome/Aide";
import { montant } from "../lib/montants";
import { messageOuDefaut } from "../lib/message-refus";
import {
  corpsAutorisation,
  corpsConditions,
} from "../lib/conditions-bancaires-saisie";

/**
 * CONDITIONS BANCAIRES, AUTORISATIONS DE FINANCEMENT, UNIONS DE COMPTES
 * (ligne sage-l3, fonction 46 · Sage, F_EBANQUECOND, F_AUTORISATIONFINBQ,
 * F_UNION ; décision D15). Structure › Paramètres de saisie, à côté des
 * banques · des STRUCTURES, lues par tous, écrites par l'administrateur.
 * Rien ne passe au journal · les conditions sont recopiées de la convention,
 * aucun agio n'est calculé ; l'autorisation est un engagement hors bilan
 * dont l'inscription est PROPOSÉE (SYSCOHADA) ; l'union est une vue. Les
 * règles et les refus sont au serveur (`banques/conditions-bancaires.ts`).
 */

interface Palier {
  plafond: number;
  taux: number;
}
interface Condition {
  id: string;
  dateEffet: string;
  typePalier: "INTERVALLE" | "SEUIL" | null;
  paliers: Palier[];
  tauxInteretsCrediteurs: number | null;
  tauxCommissionMouvement: number | null;
  tauxCommissionPlusFortDecouvert: number | null;
  fraisTenueCompte: number | null;
  periodiciteFrais: string | null;
  baseCalcul: number | null;
  referenceConvention: string;
  dateConvention: string;
  enVigueur: boolean;
}
interface Situation {
  utilise: number | null;
  nonUtilise: number | null;
  depassement: number | null;
}
interface Autorisation {
  id: string;
  nature: string;
  montant: number;
  dateDebut: string;
  dateFin: string | null;
  irrevocable: boolean;
  referenceConvention: string;
  dateConvention: string;
  enCours: boolean;
  situation: Situation | null;
  motifSituation: string | null;
  horsBilan: { debit: string; credit: string; fondement: string } | null;
}
interface RibServi {
  id: string;
  abrege: string;
  banque: string;
  devise: string | null;
  journal: string | null;
  compte: string | null;
  conditions: Condition[];
  autorisations: Autorisation[];
  /** Plusieurs autorisations en cours sur le même solde · leur situation sur le total (premier tour, M4). */
  situationTotale:
    | (Situation & { autorise: number; motif: string | null; nombre: number })
    | null;
}
interface UnionServie {
  id: string;
  code: string;
  intitule: string;
  fusionEchelles: boolean;
  membres: Array<{
    ribId: string;
    abrege: string;
    solde: number | null;
    motif: string | null;
  }>;
  position: { total: number | null; nonLus: string[]; motif: string | null };
}
interface Lecture {
  date: string;
  referentiel: "SYSCOHADA" | "SYCEBNL";
  motifSansHorsBilan: string | null;
  ribs: RibServi[];
  ribsTronques: boolean;
  totalRibs: number;
  declarationsTronquees: boolean;
  totalConditions: number;
  totalAutorisations: number;
  unions: UnionServie[];
  unionsTronquees: boolean;
}

const NATURES: Array<[string, string]> = [
  ["DECOUVERT", "Découvert autorisé"],
  ["FACILITE_CAISSE", "Facilité de caisse"],
  ["CREDIT_TRESORERIE", "Crédit de trésorerie"],
  ["ESCOMPTE", "Ligne d'escompte"],
  ["AUTRE", "Autre financement"],
];
const libelleNature = (n: string) => NATURES.find(([k]) => k === n)?.[1] ?? n;
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" });
const taux = (v: number | null) =>
  v === null
    ? "·"
    : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 6 })} %`;
const champ = "border border-border-dark px-2 py-1 text-[11.5px] w-full";
const etiquette = "flex flex-col gap-0.5 text-[10.5px] text-text-dim";
const bouton =
  "bg-sel text-white px-3.5 py-1 text-[11.5px] font-semibold rounded-full disabled:opacity-50";
const thActions = (
  <th scope="col">
    <span className="sr-only">Actions</span>
  </th>
);

export function ConditionsBancairesPage() {
  const { estAdmin } = useAuth();
  // La date DEMANDÉE (vide · aujourd'hui) et la date TAPÉE · la lecture ne
  // part qu'à la sortie du champ ou sur Entrée, jamais à chaque chiffre
  // (premier tour, m7 · Chrome rendait 0002, 0020, 0202, 2026).
  const [au, setAu] = useState("");
  const [auTape, setAuTape] = useState("");
  // UNE LECTURE SE RANGE AVEC LA DATE QU'ELLE SERT (premier tour, M2) · les
  // situations d'une date ne s'affichent jamais sous une autre, ni pendant le
  // chargement, ni sous l'erreur d'une lecture manquée.
  const [lecture, setLecture] = useState<{
    lueePour: string;
    l: Lecture;
  } | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let vivant = true;
    setErreurLecture(null);
    api
      .get<Lecture>(`/conditions-bancaires${au ? `?au=${au}` : ""}`)
      .then((l) => vivant && setLecture({ lueePour: au, l }))
      .catch(
        (e) =>
          vivant &&
          setErreurLecture(
            `Lecture impossible · ${messageOuDefaut(e, "serveur injoignable")}`,
          ),
      );
    return () => {
      vivant = false;
    };
  }, [au, jeton]);

  const servie = lecture && lecture.lueePour === au ? lecture.l : null;

  /**
   * UN GESTE À LA FOIS (premier tour, M3) · un double clic créait deux
   * autorisations identiques (aucune clé unique), et un second retrait
   * rendait un 404 sous « retirées ». Le refus revient au bloc qui l'a
   * demandé, près de son formulaire, jamais en haut de page.
   */
  const agir: Agir = async (fn, message) => {
    if (envoi) return { ok: false, refus: null };
    setEnvoi(true);
    setInfo(null);
    try {
      await fn();
      setInfo(message);
      setJeton((j) => j + 1);
      return { ok: true, refus: null };
    } catch (e) {
      return { ok: false, refus: messageOuDefaut(e, "Action refusée.") };
    } finally {
      setEnvoi(false);
    }
  };

  const valider = () => {
    if (auTape !== au) setAu(auTape);
  };

  return (
    <div className="p-4 text-[12px]">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <label className="text-[11.5px] font-semibold text-text-dim">
          Situation au
          <input
            type="date"
            value={auTape || servie?.date || ""}
            onChange={(e) => setAuTape(e.target.value)}
            onBlur={valider}
            onKeyDown={(e) => {
              if (e.key === "Enter") valider();
            }}
            className="mt-1 block border border-border-dark px-2.5 py-1.5 text-[12px] font-normal font-mono"
          />
        </label>
        <Aide
          titre="Conditions, autorisations et unions"
          texte={`Les conditions recopient la convention signée avec la banque (référence et date exigées), versionnées par date d'effet · OmegaX ne calcule aucun agio, la banque compte en dates de valeur que le relevé importé ne porte pas. L'autorisation de financement est un engagement de la banque, jamais une dette · son utilisation se lit sur le solde créditeur du compte pour un découvert ou une facilité de caisse, le dépassement se dit sans rien refuser ; plusieurs autorisations en cours sur le même compte se lisent sur leur total. Au SYSCOHADA son inscription hors bilan est proposée (classe 9, facultative). ${servie?.motifSansHorsBilan ?? ""} Une union réunit des comptes d'une même monnaie en une position de trésorerie, sans compensation au bilan.`}
          source="AUDCIF, fiches des comptes 52, 56, 9011 et 9018 ; SYCEBNL, fiches des comptes 52 et 56 · Sage 100, Structure des fichiers, F_EBANQUECOND, F_AUTORISATIONFINBQ, F_UNION"
        />
      </div>
      {erreurLecture && (
        <div
          role="alert"
          className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5 mb-3 max-w-[900px]"
        >
          {erreurLecture}{" "}
          <button
            type="button"
            onClick={() => setJeton((j) => j + 1)}
            className="underline"
          >
            Relire
          </button>
        </div>
      )}
      <div role="status" className="text-[11.5px] text-success mb-2">
        {info}
      </div>
      {!servie && !erreurLecture && (
        <div className="text-[11.5px] text-text-dim">Chargement…</div>
      )}
      {servie && servie.ribs.length === 0 && (
        <div className="text-[11.5px] text-text-dim">
          Aucun RIB dans ce dossier · déclarez d’abord la banque et son RIB
          (Structure › Paramètres de saisie › Banques).
        </div>
      )}
      {servie?.ribsTronques && (
        <div className="text-[11.5px] text-warning mb-2">
          {servie.ribs.length} RIB montrés sur {servie.totalRibs}.
        </div>
      )}
      {servie?.declarationsTronquees && (
        <div className="text-[11.5px] text-warning mb-2">
          Déclarations tronquées · {servie.totalConditions} versions de
          conditions et {servie.totalAutorisations} autorisations au dossier ;
          la version en vigueur n’est pas dite.
        </div>
      )}
      {servie?.ribs.map((r) => (
        <section
          key={r.id}
          aria-label={`RIB ${r.abrege}`}
          className="border border-border bg-surface shadow-posee max-w-[1100px] mb-3"
        >
          <div className="px-3.5 py-1.5 bg-chrome border-b border-border text-[11.5px] font-bold">
            {r.abrege} · {r.banque}
            <span className="font-normal text-text-dim">
              {" "}
              · {r.devise ?? "CDF"}
              {r.journal ? ` · journal ${r.journal}` : " · sans journal"}
              {r.compte ? ` · compte ${r.compte}` : ""}
            </span>
          </div>
          <BlocConditions rib={r} estAdmin={estAdmin} agir={agir} envoi={envoi} />
          <BlocAutorisations
            rib={r}
            estAdmin={estAdmin}
            agir={agir}
            envoi={envoi}
            avecHorsBilan={servie.referentiel === "SYSCOHADA"}
          />
        </section>
      ))}
      {servie && servie.ribs.length > 0 && (
        <BlocUnions lecture={servie} estAdmin={estAdmin} agir={agir} envoi={envoi} />
      )}
    </div>
  );
}

type Agir = (
  fn: () => Promise<unknown>,
  message: string,
) => Promise<{ ok: boolean; refus: string | null }>;

/** Le refus d'un geste, dit près du formulaire qui l'a demandé. */
function Refus({ texte }: { texte: string | null }) {
  if (!texte) return null;
  return (
    <div
      role="alert"
      className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5 mt-1.5"
    >
      {texte}
    </div>
  );
}

function BlocConditions({
  rib,
  estAdmin,
  agir,
  envoi,
}: {
  rib: RibServi;
  estAdmin: boolean;
  agir: Agir;
  envoi: boolean;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [refus, setRefus] = useState<string | null>(null);
  const geste = async (fn: () => Promise<unknown>, message: string) => {
    setRefus(null);
    const r = await agir(fn, message);
    setRefus(r.refus);
    return r.ok;
  };
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const lu = corpsConditions(f);
    if ("refus" in lu) {
      setRefus(lu.refus);
      return;
    }
    const corps = lu.corps;
    if (
      await geste(
        () =>
          api.post(`/conditions-bancaires/ribs/${rib.id}/conditions`, corps),
        "Conditions déclarées.",
      )
    )
      setF({});
  };
  const s = (k: string) => ({
    value: f[k] ?? "",
    onChange: (e: { target: { value: string } }) =>
      setF((x) => ({ ...x, [k]: e.target.value })),
  });
  return (
    <div className="px-3.5 py-2 border-b border-border">
      <div className="text-[11.5px] font-semibold mb-1">
        Conditions bancaires
      </div>
      {rib.conditions.length === 0 ? (
        <div className="text-[11px] text-text-dim mb-1">
          Aucune condition déclarée.
        </div>
      ) : (
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={`Défilement des conditions du RIB ${rib.abrege}`}
        >
          <table
            className="w-full text-[11.5px] min-w-[860px]"
            aria-label={`Conditions du RIB ${rib.abrege}`}
          >
            <thead>
              <tr>
                <th className="text-left">Effet</th>
                <th className="text-left">Convention</th>
                <th className="text-left">Découvert</th>
                <th className="text-right">Intérêts créditeurs</th>
                <th className="text-right">Commission de mouvement</th>
                <th className="text-right">Plus fort découvert</th>
                <th className="text-right">Frais de tenue</th>
                <th className="text-right">Base</th>
                {thActions}
              </tr>
            </thead>
            <tbody>
              {rib.conditions.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono">
                    {date(c.dateEffet)}
                    {c.enVigueur && (
                      <span className="ml-1 text-success font-sans">
                        · en vigueur
                      </span>
                    )}
                  </td>
                  <td>
                    {c.referenceConvention} · {date(c.dateConvention)}
                  </td>
                  <td>
                    {c.paliers.length === 0
                      ? "·"
                      : `${c.typePalier === "SEUIL" ? "Par seuil" : "Par intervalle"} · ${c.paliers.map((p) => `${montant(p.plafond)} à ${taux(p.taux)}`).join(" ; ")}`}
                  </td>
                  <td className="text-right font-mono">
                    {taux(c.tauxInteretsCrediteurs)}
                  </td>
                  <td className="text-right font-mono">
                    {taux(c.tauxCommissionMouvement)}
                  </td>
                  <td className="text-right font-mono">
                    {taux(c.tauxCommissionPlusFortDecouvert)}
                  </td>
                  <td className="text-right font-mono">
                    {c.fraisTenueCompte === null
                      ? "·"
                      : `${montant(c.fraisTenueCompte)} · ${(c.periodiciteFrais ?? "").toLowerCase()}`}
                  </td>
                  <td className="text-right font-mono">
                    {c.baseCalcul === null ? "·" : `${c.baseCalcul} j`}
                  </td>
                  <td>
                    {estAdmin && (
                      <button
                        type="button"
                        disabled={envoi}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Retirer les conditions à effet du ${date(c.dateEffet)} ?`,
                            )
                          )
                            void geste(
                              () =>
                                api.delete(
                                  `/conditions-bancaires/conditions/${c.id}`,
                                ),
                              "Conditions retirées.",
                            );
                        }}
                        className="text-danger hover:underline"
                      >
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {estAdmin && (
        <form
          onSubmit={envoyer}
          aria-label={`Déclarer des conditions sur ${rib.abrege}`}
          className="mt-1.5 grid grid-cols-2 md:grid-cols-6 gap-1.5 items-end"
        >
          <label className={etiquette}>
            Date d’effet
            <input
              type="date"
              aria-label="Conditions · date d’effet"
              {...s("dateEffet")}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Référence de la convention
            <input
              aria-label="Conditions · référence de la convention"
              maxLength={100}
              {...s("referenceConvention")}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Date de la convention
            <input
              type="date"
              aria-label="Conditions · date de la convention"
              {...s("dateConvention")}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Paliers
            <select
              aria-label="Conditions · type de palier"
              {...s("typePalier")}
              className={champ}
            >
              <option value="">·</option>
              <option value="INTERVALLE">Par intervalle</option>
              <option value="SEUIL">Par seuil</option>
            </select>
          </label>
          {[1, 2, 3].map((i) => (
            <label key={i} className={etiquette}>
              Palier {i} · plafond et taux
              <span className="flex gap-1">
                <input
                  aria-label={`Palier ${i} · plafond`}
                  inputMode="decimal"
                  {...s(`plafond${i}`)}
                  className={champ}
                />
                <input
                  aria-label={`Palier ${i} · taux`}
                  inputMode="decimal"
                  {...s(`taux${i}`)}
                  className={`${champ} max-w-[70px]`}
                />
              </span>
            </label>
          ))}
          <label className={etiquette}>
            Intérêts créditeurs (%)
            <input
              aria-label="Conditions · intérêts créditeurs"
              inputMode="decimal"
              {...s("tauxInteretsCrediteurs")}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Commission de mouvement (%)
            <input
              aria-label="Conditions · commission de mouvement"
              inputMode="decimal"
              {...s("tauxCommissionMouvement")}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Plus fort découvert (%)
            <input
              aria-label="Conditions · plus fort découvert"
              inputMode="decimal"
              {...s("tauxCommissionPlusFortDecouvert")}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Frais de tenue de compte
            <input
              aria-label="Conditions · frais de tenue de compte"
              inputMode="decimal"
              {...s("fraisTenueCompte")}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Périodicité des frais
            <select
              aria-label="Conditions · périodicité des frais"
              {...s("periodiciteFrais")}
              className={champ}
            >
              <option value="">·</option>
              <option value="MENSUELLE">Mensuelle</option>
              <option value="TRIMESTRIELLE">Trimestrielle</option>
              <option value="ANNUELLE">Annuelle</option>
            </select>
          </label>
          <label className={etiquette}>
            Base des intérêts
            <select
              aria-label="Conditions · base des intérêts"
              {...s("baseCalcul")}
              className={champ}
            >
              <option value="">·</option>
              <option value="360">360 jours</option>
              <option value="365">365 jours</option>
            </select>
          </label>
          <button type="submit" disabled={envoi} className={bouton}>
            Déclarer les conditions
          </button>
        </form>
      )}
      <Refus texte={refus} />
    </div>
  );
}

function BlocAutorisations({
  rib,
  estAdmin,
  agir,
  envoi,
  avecHorsBilan,
}: {
  rib: RibServi;
  estAdmin: boolean;
  agir: Agir;
  envoi: boolean;
  /** Au SYCEBNL la classe 9 ne porte aucun engagement · la colonne n'y montrerait que « · » (premier tour, m3). */
  avecHorsBilan: boolean;
}) {
  const [refus, setRefus] = useState<string | null>(null);
  const geste = async (fn: () => Promise<unknown>, message: string) => {
    setRefus(null);
    const r = await agir(fn, message);
    setRefus(r.refus);
    return r.ok;
  };
  const [f, setF] = useState<Record<string, string>>({
    nature: "DECOUVERT",
    irrevocable: "non",
  });
  const s = (k: string) => ({
    value: f[k] ?? "",
    onChange: (e: { target: { value: string } }) =>
      setF((x) => ({ ...x, [k]: e.target.value })),
  });
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const lu = corpsAutorisation(f);
    if ("refus" in lu) {
      setRefus(lu.refus);
      return;
    }
    const corps = lu.corps;
    if (
      await geste(
        () =>
          api.post(`/conditions-bancaires/ribs/${rib.id}/autorisations`, corps),
        "Autorisation déclarée.",
      )
    )
      setF({ nature: "DECOUVERT", irrevocable: "non" });
  };
  const unite = rib.devise ?? "CDF";
  return (
    <div className="px-3.5 py-2">
      <div className="text-[11.5px] font-semibold mb-1">
        Autorisations de financement
      </div>
      {rib.autorisations.length === 0 ? (
        <div className="text-[11px] text-text-dim mb-1">
          Aucune autorisation déclarée.
        </div>
      ) : (
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={`Défilement des autorisations du RIB ${rib.abrege}`}
        >
          <table
            className="w-full text-[11.5px] min-w-[860px]"
            aria-label={`Autorisations du RIB ${rib.abrege}`}
          >
            <thead>
              <tr>
                <th className="text-left">Nature</th>
                <th className="text-right">Autorisé ({unite})</th>
                <th className="text-left">Période</th>
                <th className="text-left">Convention</th>
                <th className="text-right">Utilisé</th>
                <th className="text-right">Non utilisé</th>
                <th className="text-right">Dépassement</th>
                {avecHorsBilan && (
                  <th className="text-left">Hors bilan proposé</th>
                )}
                {thActions}
              </tr>
            </thead>
            <tbody>
              {rib.autorisations.map((a) => (
                <tr key={a.id}>
                  <td>
                    {libelleNature(a.nature)}
                    {a.irrevocable ? " · irrévocable" : ""}
                  </td>
                  <td className="text-right font-mono">{montant(a.montant)}</td>
                  <td className="font-mono">
                    {date(a.dateDebut)} au {a.dateFin ? date(a.dateFin) : "·"}
                  </td>
                  <td>
                    {a.referenceConvention} · {date(a.dateConvention)}
                  </td>
                  {a.situation && a.situation.utilise !== null ? (
                    <>
                      <td className="text-right font-mono">
                        {montant(a.situation.utilise)}
                      </td>
                      <td className="text-right font-mono">
                        {montant(a.situation.nonUtilise)}
                      </td>
                      <td
                        className={`text-right font-mono ${(a.situation.depassement ?? 0) > 0 ? "text-danger font-semibold" : ""}`}
                      >
                        {montant(a.situation.depassement)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={3} className="text-text-dim">
                      Non calculé · {a.motifSituation ?? "solde non lu"}
                    </td>
                  )}
                  {avecHorsBilan && (
                    <td title={a.horsBilan?.fondement}>
                      {a.horsBilan && a.enCours
                        ? `D ${a.horsBilan.debit} / C ${a.horsBilan.credit}${a.situation?.nonUtilise != null ? ` · ${montant(a.situation.nonUtilise)}` : ""}`
                        : "·"}
                    </td>
                  )}
                  <td>
                    {estAdmin && (
                      <button
                        type="button"
                        disabled={envoi}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Retirer l'autorisation ${a.referenceConvention} ?`,
                            )
                          )
                            void geste(
                              () =>
                                api.delete(
                                  `/conditions-bancaires/autorisations/${a.id}`,
                                ),
                              "Autorisation retirée.",
                            );
                        }}
                        className="text-danger hover:underline"
                      >
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rib.situationTotale && (
                <tr className="font-semibold">
                  <td>
                    Total des {rib.situationTotale.nombre} autorisations en
                    cours
                  </td>
                  <td className="text-right font-mono">
                    {montant(rib.situationTotale.autorise)}
                  </td>
                  <td />
                  <td />
                  {rib.situationTotale.utilise !== null ? (
                    <>
                      <td className="text-right font-mono">
                        {montant(rib.situationTotale.utilise)}
                      </td>
                      <td className="text-right font-mono">
                        {montant(rib.situationTotale.nonUtilise)}
                      </td>
                      <td
                        className={`text-right font-mono ${(rib.situationTotale.depassement ?? 0) > 0 ? "text-danger" : ""}`}
                      >
                        {montant(rib.situationTotale.depassement)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={3} className="text-text-dim font-normal">
                      Non calculé · {rib.situationTotale.motif ?? "solde non lu"}
                    </td>
                  )}
                  {avecHorsBilan && <td />}
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {estAdmin && (
        <form
          onSubmit={envoyer}
          aria-label={`Déclarer une autorisation sur ${rib.abrege}`}
          className="mt-1.5 grid grid-cols-2 md:grid-cols-6 gap-1.5 items-end"
        >
          <label className={etiquette}>
            Nature
            <select
              aria-label="Autorisation · nature"
              {...s("nature")}
              className={champ}
            >
              {NATURES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className={etiquette}>
            Montant autorisé ({unite})
            <input
              aria-label="Autorisation · montant"
              inputMode="decimal"
              {...s("montant")}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Du
            <input type="date" {...s("dateDebut")} className={champ} />
          </label>
          <label className={etiquette}>
            Au
            <input type="date" {...s("dateFin")} className={champ} />
          </label>
          <label className={etiquette}>
            Engagement irrévocable
            <select
              aria-label="Autorisation · irrévocable"
              {...s("irrevocable")}
              className={champ}
            >
              <option value="non">Non</option>
              <option value="oui">Oui</option>
            </select>
          </label>
          <label className={etiquette}>
            Référence de la convention
            <input
              aria-label="Autorisation · référence de la convention"
              maxLength={100}
              {...s("referenceConvention")}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Date de la convention
            <input
              type="date"
              aria-label="Autorisation · date de la convention"
              {...s("dateConvention")}
              className={champ}
            />
          </label>
          <button type="submit" disabled={envoi} className={bouton}>
            Déclarer l’autorisation
          </button>
        </form>
      )}
      <Refus texte={refus} />
    </div>
  );
}

function BlocUnions({
  lecture,
  estAdmin,
  agir,
  envoi,
}: {
  lecture: Lecture;
  estAdmin: boolean;
  agir: Agir;
  envoi: boolean;
}) {
  const [refus, setRefus] = useState<string | null>(null);
  const geste = async (fn: () => Promise<unknown>, message: string) => {
    setRefus(null);
    const r = await agir(fn, message);
    setRefus(r.refus);
    return r.ok;
  };
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [fusion, setFusion] = useState(false);
  const [choisis, setChoisis] = useState<string[]>([]);
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (
      await geste(
        () =>
          api.post("/conditions-bancaires/unions", {
            code,
            intitule,
            ribIds: choisis,
            fusionEchelles: fusion,
          }),
        "Union créée.",
      )
    ) {
      setCode("");
      setIntitule("");
      setFusion(false);
      setChoisis([]);
    }
  };
  return (
    <section
      aria-label="Unions de comptes bancaires"
      className="border border-border bg-surface shadow-posee max-w-[1100px] mb-3"
    >
      <div className="px-3.5 py-1.5 bg-chrome border-b border-border text-[11.5px] font-bold">
        Unions de comptes
      </div>
      <div className="px-3.5 py-2">
        {lecture.unionsTronquees && (
          <div className="text-[11.5px] text-warning mb-1">
            La liste des unions est tronquée.
          </div>
        )}
        {lecture.unions.length === 0 ? (
          <div className="text-[11px] text-text-dim mb-1">
            Aucune union déclarée.
          </div>
        ) : (
          <table className="w-full text-[11.5px]" aria-label="Unions">
            <thead>
              <tr>
                <th className="text-left">Code</th>
                <th className="text-left">Intitulé</th>
                <th className="text-left">Comptes</th>
                <th className="text-right">Position au {date(lecture.date)}</th>
                <th className="text-left">Échelles</th>
                {thActions}
              </tr>
            </thead>
            <tbody>
              {lecture.unions.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono">{u.code}</td>
                  <td>{u.intitule}</td>
                  <td>
                    {u.membres.map((m, i) => (
                      <span key={m.ribId} title={m.motif ?? undefined}>
                        {i > 0 ? " ; " : ""}
                        {m.abrege}{" "}
                        {m.solde === null
                          ? `(non lu · ${m.motif ?? "solde non lu"})`
                          : montant(m.solde)}
                      </span>
                    ))}
                  </td>
                  <td className="text-right font-mono">
                    {u.position.total !== null
                      ? montant(u.position.total)
                      : u.position.motif
                        ? `Non calculée · ${u.position.motif}`
                        : `Non calculée · ${u.position.nonLus.join(", ")} non lu(s)`}
                  </td>
                  <td>{u.fusionEchelles ? "Fusionnées" : "Séparées"}</td>
                  <td>
                    {estAdmin && (
                      <button
                        type="button"
                        disabled={envoi}
                        onClick={() => {
                          if (window.confirm(`Supprimer l'union ${u.code} ?`))
                            void geste(
                              () =>
                                api.delete(
                                  `/conditions-bancaires/unions/${u.id}`,
                                ),
                              "Union supprimée.",
                            );
                        }}
                        className="text-danger hover:underline"
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {estAdmin && (
          <form
            onSubmit={envoyer}
            aria-label="Créer une union"
            className="mt-1.5 flex flex-wrap gap-2 items-end"
          >
            <label className={etiquette}>
              Code
              <input
                aria-label="Union · code"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${champ} w-[90px]`}
              />
            </label>
            <label className={etiquette}>
              Intitulé
              <input
                aria-label="Union · intitulé"
                maxLength={60}
                value={intitule}
                onChange={(e) => setIntitule(e.target.value)}
                className={`${champ} w-[220px]`}
              />
            </label>
            <fieldset className="flex flex-wrap gap-2 text-[11.5px]">
              <legend className="text-[10.5px] text-text-dim">
                Comptes réunis
              </legend>
              {lecture.ribs.map((r) => (
                <label key={r.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={choisis.includes(r.id)}
                    onChange={(e) =>
                      setChoisis((c) =>
                        e.target.checked
                          ? [...c, r.id]
                          : c.filter((x) => x !== r.id),
                      )
                    }
                  />
                  {r.abrege} ({r.devise ?? "CDF"})
                </label>
              ))}
            </fieldset>
            <label className="flex items-center gap-1 text-[11.5px]">
              <input
                type="checkbox"
                checked={fusion}
                onChange={(e) => setFusion(e.target.checked)}
              />
              Échelles fusionnées par la convention
            </label>
            <button type="submit" disabled={envoi} className={bouton}>
              Créer l’union
            </button>
          </form>
        )}
        <Refus texte={refus} />
      </div>
    </section>
  );
}
