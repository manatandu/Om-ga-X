"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estTenueParUnLettrage = estTenueParUnLettrage;
exports.designationLettrage = designationLettrage;
function estTenueParUnLettrage(l) {
    return l.lettre != null || l.lettrageId != null;
}
function designationLettrage(l) {
    return l.lettre ?? 'lettrage partiel';
}
//# sourceMappingURL=ligne-lettree.js.map