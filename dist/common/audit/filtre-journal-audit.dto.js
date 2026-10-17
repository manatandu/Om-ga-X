"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiltreJournalAuditDto = exports.PAGE_JOURNAL_MAX = exports.enEntier = void 0;
exports.lireDateDuFiltre = lireDateDuFiltre;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const journal_audit_service_1 = require("./journal-audit.service");
const FORME_DATE_FILTRE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](\d{2}):(\d{2})))?$/;
function lireDateDuFiltre(texte) {
    const m = FORME_DATE_FILTRE.exec(texte);
    if (!m)
        return null;
    const [, a, mo, j, h, mi, s, , zh, zm] = m;
    const annee = Number(a);
    const mois = Number(mo);
    const jour = Number(j);
    const civil = new Date(0);
    civil.setUTCFullYear(annee, mois - 1, jour);
    if (civil.getUTCFullYear() !== annee || civil.getUTCMonth() !== mois - 1 || civil.getUTCDate() !== jour) {
        return null;
    }
    if (h !== undefined && (Number(h) > 23 || Number(mi) > 59 || (s !== undefined && Number(s) > 59)))
        return null;
    if (zh !== undefined && (Number(zh) > 23 || Number(zm) > 59))
        return null;
    const date = new Date(texte);
    return (0, journal_audit_service_1.instantTransmissible)(date) ? date : null;
}
const enDate = ({ value }) => typeof value === 'string' ? lireDateDuFiltre(value) ?? value : value;
const enEntier = ({ value }) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
exports.enEntier = enEntier;
exports.PAGE_JOURNAL_MAX = Math.floor(Number.MAX_SAFE_INTEGER / journal_audit_service_1.TAILLE_PAGE_JOURNAL_MAX);
const MESSAGE_DATE = 'attendu AAAA-MM-JJ, ou une date et heure ISO 8601 avec son fuseau (Z ou ±HH:MM), des années 0000 à 9999.';
class FiltreJournalAuditDto {
}
exports.FiltreJournalAuditDto = FiltreJournalAuditDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Objet illisible · une seule valeur est attendue.' }),
    (0, class_validator_1.NotContains)(journal_audit_service_1.CARACTERE_NUL, { message: 'Objet illisible · le caractère nul n’est pas admis.' }),
    __metadata("design:type", String)
], FiltreJournalAuditDto.prototype, "entite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Identifiant d’objet illisible · une seule valeur est attendue.' }),
    (0, class_validator_1.NotContains)(journal_audit_service_1.CARACTERE_NUL, { message: 'Identifiant d’objet illisible · le caractère nul n’est pas admis.' }),
    __metadata("design:type", String)
], FiltreJournalAuditDto.prototype, "entiteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Auteur illisible · une seule adresse est attendue.' }),
    (0, class_validator_1.NotContains)(journal_audit_service_1.CARACTERE_NUL, { message: 'Auteur illisible · le caractère nul n’est pas admis.' }),
    __metadata("design:type", String)
], FiltreJournalAuditDto.prototype, "acteurEmail", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(enDate),
    (0, class_validator_1.IsDate)({ message: `Date de début illisible · ${MESSAGE_DATE}` }),
    __metadata("design:type", Date)
], FiltreJournalAuditDto.prototype, "depuis", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(enDate),
    (0, class_validator_1.IsDate)({ message: `Date de fin illisible · ${MESSAGE_DATE}` }),
    __metadata("design:type", Date)
], FiltreJournalAuditDto.prototype, "jusqua", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(exports.enEntier),
    (0, class_validator_1.IsInt)({ message: 'Numéro de page illisible · un entier positif est attendu.' }),
    (0, class_validator_1.Min)(1, { message: 'Numéro de page illisible · un entier positif est attendu.' }),
    (0, class_validator_1.Max)(exports.PAGE_JOURNAL_MAX, { message: 'Numéro de page hors limite.' }),
    __metadata("design:type", Number)
], FiltreJournalAuditDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(exports.enEntier),
    (0, class_validator_1.IsInt)({ message: `Taille de page illisible · un entier de 1 à ${journal_audit_service_1.TAILLE_PAGE_JOURNAL_MAX} est attendu.` }),
    (0, class_validator_1.Min)(1, { message: `Taille de page illisible · un entier de 1 à ${journal_audit_service_1.TAILLE_PAGE_JOURNAL_MAX} est attendu.` }),
    (0, class_validator_1.Max)(journal_audit_service_1.TAILLE_PAGE_JOURNAL_MAX, {
        message: `Taille de page illisible · un entier de 1 à ${journal_audit_service_1.TAILLE_PAGE_JOURNAL_MAX} est attendu.`,
    }),
    __metadata("design:type", Number)
], FiltreJournalAuditDto.prototype, "taille", void 0);
//# sourceMappingURL=filtre-journal-audit.dto.js.map