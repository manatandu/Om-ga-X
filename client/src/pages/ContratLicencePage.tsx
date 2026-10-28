import { Fragment } from 'react';
import {
  A_ARRETER,
  articlesDesConditions,
  LANGUE_DU_CONTRAT,
  texteBrutDesConditions,
  VERSION_CONDITIONS_LICENCE,
} from '../../../src/modules/conditions-licence/conditions-de-licence';
import { VERSIONS_PUBLIEES } from '../../../src/modules/conditions-licence/versions-publiees';
import { CadrePagePublique, CorpsFenetreLegale } from '../components/CadrePagePublique';
import { AcceptationConditionsLicence } from '../components/AcceptationConditionsLicence';
import { telechargerTexteDeVersion } from '../components/telechargerContrat';

/**
 * LE CONTRAT DE LICENCE D'OMEGAX · le texte vient du module partagé
 * (`src/modules/conditions-licence/conditions-de-licence.ts`), le même que le
 * serveur joint à l'accusé de réception d'une acceptation. Rien n'est rédigé
 * ici · une page qui reformulerait le contrat en ferait un second.
 *
 * PUBLIC, comme la politique de confidentialité · le Code du numérique
 * (ordonnance-loi n° 23/10 du 13 mars 2023) veut les conditions « mises à la
 * disposition de la clientèle » (art. 53, al. 1er) et publiées (art. 31).
 * Dans l'espace de travail, la fenêtre ajoute l'état de l'acceptation du
 * dossier et, pour son administrateur, le geste d'accepter.
 */

const LIGNE_VERSION = `Version ${VERSION_CONDITIONS_LICENCE.numero} du ${VERSION_CONDITIONS_LICENCE.dateLisible} · langue du contrat · ${LANGUE_DU_CONTRAT}`;

/** Ce qui reste à arrêter par l'éditeur se voit · jamais un blanc qu'on lirait comme une réponse. */
function AvecMentionsAArreter({ texte }: { texte: string }) {
  const morceaux = texte.split(`(${A_ARRETER})`);
  return (
    <>
      {morceaux.map((m, i) => (
        <Fragment key={i}>
          {m}
          {i < morceaux.length - 1 && <em className="text-warning not-italic font-semibold">({A_ARRETER})</em>}
        </Fragment>
      ))}
    </>
  );
}

/** Le texte du contrat, article par article. */
export function ContenuContratLicence() {
  return (
    <div className="text-[11.5px] leading-relaxed">
      {articlesDesConditions().map((a) => (
        <section key={a.numero} id={`article-${a.numero}`} className="eviter-coupure">
          <h2 className="text-[12px] font-bold mt-4 mb-1.5">{`${a.numero}. ${a.titre}`}</h2>
          {a.alineas.map((al, i) =>
            typeof al === 'string' ? (
              <p key={i} className="mb-2">
                <AvecMentionsAArreter texte={al} />
              </p>
            ) : (
              <ul key={i} className="list-disc pl-5 mb-2 space-y-1">
                {al.liste.map((l, j) => (
                  <li key={j}>
                    <AvecMentionsAArreter texte={l} />
                  </li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * Le texte en fichier · conservation et reproduction (art. 53, al. 1er), le
 * même fichier que la pièce jointe de l'accusé de réception.
 */
export function telechargerTexteDuContrat() {
  telechargerTexteDeVersion(VERSION_CONDITIONS_LICENCE.numero, texteBrutDesConditions());
}

function BoutonTexte() {
  return (
    <button type="button" onClick={telechargerTexteDuContrat} className="ecran-seul text-[11.5px] text-sel underline mb-2">
      Télécharger le texte
    </button>
  );
}

/**
 * LES VERSIONS ANTÉRIEURES, LUES DANS L'ARCHIVE (relecture M2) · le contrat
 * promet que le texte de chaque version publiée reste consultable (articles
 * 15 et 18 ; Code du numérique, art. 53, 9°). Rien tant qu'une seule version
 * a été publiée.
 */
function VersionsAnterieures() {
  const anterieures = VERSIONS_PUBLIEES.filter((v) => v.numero !== VERSION_CONDITIONS_LICENCE.numero);
  if (anterieures.length === 0) return null;
  return (
    <section className="ecran-seul mt-5 text-[11.5px]" aria-label="Versions antérieures">
      <h2 className="text-[12px] font-bold mb-1.5">Versions antérieures</h2>
      <ul className="list-disc pl-5 space-y-1">
        {anterieures.map((v) => (
          <li key={v.numero}>
            Version {v.numero} du {v.dateLisible} ·{' '}
            <button type="button" onClick={() => telechargerTexteDeVersion(v.numero, v.texte)} className="text-sel underline">
              Télécharger le texte
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** La page publique, hors de la zone protégée. */
export function ContratLicencePage() {
  return (
    <CadrePagePublique titre="Contrat de licence d’OmegaX" sousTitre={LIGNE_VERSION}>
      <BoutonTexte />
      <ContenuContratLicence />
      <VersionsAnterieures />
    </CadrePagePublique>
  );
}

/** La fenêtre du menu « ? » · le texte, puis l'acceptation du dossier. */
export function ContratLicenceFenetre() {
  return (
    <CorpsFenetreLegale sousTitre={LIGNE_VERSION}>
      <BoutonTexte />
      <ContenuContratLicence />
      <VersionsAnterieures />
      <AcceptationConditionsLicence />
    </CorpsFenetreLegale>
  );
}
