import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Aide } from "../components/chrome/Aide";
import { montant } from "../lib/montants";
import { montantSaisi } from "../lib/montant-saisi";
import { messageOuDefaut } from "../lib/message-refus";

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
  position: { total: number | null; nonLus: string[] };
}
interface Lecture {
  date: string;
  referentiel: "SYSCOHADA" | "SYCEBNL";
  motifSansHorsBilan: string | null;
  ribs: RibServi[];
  ribsTronques: boolean;
  totalRibs: number;
  declarationsTronquees: boolean;
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
/** Un taux tapé (virgule ou point), ou rien · une saisie illisible reste au serveur, qui la refuse nommée. */
const tauxSaisi = (t: string): number | null =>
  t.trim() === "" ? null : Number(t.replace(/\s/g, "").replace(",", "."));

export function ConditionsBancairesPage() {
  const { estAdmin } = useAuth();
  const [au, setAu] = useState("");
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  useEffect(() => {
    let vivant = true;
    setErreur(null);
    api
      .get<Lecture>(`/conditions-bancaires${au ? `?au=${au}` : ""}`)
      .then((l) => vivant && setLecture(l))
      .catch(
        (e) =>
          vivant &&
          setErreur(
            `Lecture impossible · ${messageOuDefaut(e, "serveur injoignable")}`,
          ),
      );
    return () => {
      vivant = false;
    };
  }, [au, jeton]);

  const agir = async (fn: () => Promise<unknown>, message: string) => {
    setErreur(null);
    setInfo(null);
    try {
      await fn();
      setInfo(message);
      setJeton((j) => j + 1);
      return true;
    } catch (e) {
      setErreur(messageOuDefaut(e, "Action refusée."));
      return false;
    }
  };

  return (
    <div className="p-4 text-[12px]">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <label className="text-[11.5px] font-semibold text-text-dim">
          Situation au
          <input
            type="date"
            aria-label="Situation au"
            value={au || lecture?.date || ""}
            onChange={(e) => setAu(e.target.value)}
            className="mt-1 block border border-border-dark px-2.5 py-1.5 text-[12px] font-normal font-mono"
          />
        </label>
        <Aide
          titre="Conditions, autorisations et unions"
          texte="Les conditions recopient la convention signée avec la banque (référence et date exigées), versionnées par date d'effet · OmegaX ne calcule aucun agio, la banque compte en dates de valeur que le relevé importé ne porte pas. L'autorisation de financement est un engagement de la banque, jamais une dette · son utilisation se lit sur le solde créditeur du compte pour un découvert ou une facilité de caisse, le dépassement se dit sans rien refuser ; au SYSCOHADA son inscription hors bilan est proposée (classe 9, facultative), au SYCEBNL elle se décrit aux notes annexes. Une union réunit des comptes d'une même monnaie en une position de trésorerie, sans compensation au bilan."
          source="AUDCIF, fiches des comptes 52, 56, 9011 et 9018 ; SYCEBNL, fiches des comptes 52 et 56 · Sage 100, Structure des fichiers, F_EBANQUECOND, F_AUTORISATIONFINBQ, F_UNION"
        />
      </div>
      {erreur && (
        <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5 mb-3 max-w-[900px]">
          {erreur}{" "}
          <button
            type="button"
            onClick={() => setJeton((j) => j + 1)}
            className="underline"
          >
            Relire
          </button>
        </div>
      )}
      {info && <div className="text-[11.5px] text-success mb-2">{info}</div>}
      {!lecture && !erreur && (
        <div className="text-[11.5px] text-text-dim">Chargement…</div>
      )}
      {lecture && lecture.ribs.length === 0 && (
        <div className="text-[11.5px] text-text-dim">
          Aucun RIB dans ce dossier · déclarez d’abord la banque et son RIB
          (Structure › Paramètres de saisie › Banques).
        </div>
      )}
      {lecture?.ribsTronques && (
        <div className="text-[11.5px] text-warning mb-2">
          {lecture.ribs.length} RIB montrés sur {lecture.totalRibs}.
        </div>
      )}
      {lecture?.declarationsTronquees && (
        <div className="text-[11.5px] text-warning mb-2">
          La liste des conditions ou des autorisations est tronquée.
        </div>
      )}
      {lecture?.motifSansHorsBilan && (
        <div className="text-[11.5px] text-text-dim mb-2">
          {lecture.motifSansHorsBilan}
        </div>
      )}
      {lecture?.ribs.map((r) => (
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
          <BlocConditions rib={r} estAdmin={estAdmin} agir={agir} />
          <BlocAutorisations rib={r} estAdmin={estAdmin} agir={agir} />
        </section>
      ))}
      {lecture && lecture.ribs.length > 0 && (
        <BlocUnions lecture={lecture} estAdmin={estAdmin} agir={agir} />
      )}
    </div>
  );
}

type Agir = (fn: () => Promise<unknown>, message: string) => Promise<boolean>;

function BlocConditions({
  rib,
  estAdmin,
  agir,
}: {
  rib: RibServi;
  estAdmin: boolean;
  agir: Agir;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const paliers: Palier[] = [1, 2, 3]
      .map((i) => ({
        plafond: montantSaisi(f[`plafond${i}`] ?? ""),
        taux: tauxSaisi(f[`taux${i}`] ?? ""),
      }))
      .filter((p) => p.plafond !== null || p.taux !== null)
      .map((p) => ({ plafond: p.plafond ?? NaN, taux: p.taux ?? NaN }));
    const corps = {
      dateEffet: f.dateEffet ?? "",
      referenceConvention: f.referenceConvention ?? "",
      dateConvention: f.dateConvention ?? "",
      typePalier: paliers.length > 0 ? (f.typePalier ?? null) || null : null,
      paliers,
      tauxInteretsCrediteurs: tauxSaisi(f.tauxInteretsCrediteurs ?? ""),
      tauxCommissionMouvement: tauxSaisi(f.tauxCommissionMouvement ?? ""),
      tauxCommissionPlusFortDecouvert: tauxSaisi(
        f.tauxCommissionPlusFortDecouvert ?? "",
      ),
      fraisTenueCompte:
        (f.fraisTenueCompte ?? "").trim() === ""
          ? null
          : montantSaisi(f.fraisTenueCompte ?? ""),
      periodiciteFrais: f.periodiciteFrais || null,
      baseCalcul: f.baseCalcul ? Number(f.baseCalcul) : null,
    };
    if (
      await agir(
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
        <div className="overflow-x-auto">
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
                <th />
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
                        onClick={() => {
                          if (
                            window.confirm(
                              `Retirer les conditions à effet du ${date(c.dateEffet)} ?`,
                            )
                          )
                            void agir(
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
          <button
            type="submit"
            className="bg-sel text-white px-3.5 py-1 text-[11.5px] font-semibold rounded-full"
          >
            Déclarer les conditions
          </button>
        </form>
      )}
    </div>
  );
}

function BlocAutorisations({
  rib,
  estAdmin,
  agir,
}: {
  rib: RibServi;
  estAdmin: boolean;
  agir: Agir;
}) {
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
    const corps = {
      nature: f.nature,
      montant: montantSaisi(f.montant ?? "") ?? NaN,
      dateDebut: f.dateDebut ?? "",
      dateFin: f.dateFin || null,
      irrevocable: f.irrevocable === "oui",
      referenceConvention: f.referenceConvention ?? "",
      dateConvention: f.dateConvention ?? "",
    };
    if (
      await agir(
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
        <div className="overflow-x-auto">
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
                <th className="text-left">Hors bilan proposé</th>
                <th />
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
                  <td title={a.horsBilan?.fondement}>
                    {a.horsBilan
                      ? `D ${a.horsBilan.debit} / C ${a.horsBilan.credit}${a.situation?.nonUtilise != null ? ` · ${montant(a.situation.nonUtilise)}` : ""}`
                      : "·"}
                  </td>
                  <td>
                    {estAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Retirer l'autorisation ${a.referenceConvention} ?`,
                            )
                          )
                            void agir(
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
            <input
              type="date"
              aria-label="Autorisation · début"
              {...s("dateDebut")}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Au
            <input
              type="date"
              aria-label="Autorisation · fin"
              {...s("dateFin")}
              className={champ}
            />
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
          <button
            type="submit"
            className="bg-sel text-white px-3.5 py-1 text-[11.5px] font-semibold rounded-full"
          >
            Déclarer l’autorisation
          </button>
        </form>
      )}
    </div>
  );
}

function BlocUnions({
  lecture,
  estAdmin,
  agir,
}: {
  lecture: Lecture;
  estAdmin: boolean;
  agir: Agir;
}) {
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [fusion, setFusion] = useState(false);
  const [choisis, setChoisis] = useState<string[]>([]);
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (
      await agir(
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
                <th />
              </tr>
            </thead>
            <tbody>
              {lecture.unions.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono">{u.code}</td>
                  <td>{u.intitule}</td>
                  <td>
                    {u.membres
                      .map(
                        (m) =>
                          `${m.abrege} ${m.solde === null ? "(non lu)" : montant(m.solde)}`,
                      )
                      .join(" ; ")}
                  </td>
                  <td className="text-right font-mono">
                    {u.position.total === null
                      ? `Non calculée · ${u.position.nonLus.join(", ")} non lu(s)`
                      : montant(u.position.total)}
                  </td>
                  <td>{u.fusionEchelles ? "Fusionnées" : "Séparées"}</td>
                  <td>
                    {estAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Supprimer l'union ${u.code} ?`))
                            void agir(
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
            <button
              type="submit"
              className="bg-sel text-white px-3.5 py-1 text-[11.5px] font-semibold rounded-full"
            >
              Créer l’union
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
