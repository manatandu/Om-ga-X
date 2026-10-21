"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELAI_MAX_MS = exports.DELAI_PAR_OPERATION_MS = exports.DELAI_BASE_MS = void 0;
exports.estConflitDeSerialisation = estConflitDeSerialisation;
exports.delaiSelonVolume = delaiSelonVolume;
exports.avecRetrySerialisable = avecRetrySerialisable;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const transaction_journalisee_1 = require("./audit/transaction-journalisee");
const CODE_CONFLIT_TRANSACTION = 'P2034';
const TENTATIVES_MAX = 5;
function estConflitDeSerialisation(err) {
    for (let e = err, n = 0; e && n < 5; e = e.cause, n++) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            if (e.code === CODE_CONFLIT_TRANSACTION)
                return true;
            if (e.code === 'P2010' && e.meta?.code === '40001')
                return true;
        }
    }
    return false;
}
function attendre(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.DELAI_BASE_MS = 10_000;
exports.DELAI_PAR_OPERATION_MS = 50;
exports.DELAI_MAX_MS = 240_000;
function delaiSelonVolume(operations) {
    return Math.min(exports.DELAI_MAX_MS, exports.DELAI_BASE_MS + Math.max(0, operations) * exports.DELAI_PAR_OPERATION_MS);
}
async function avecRetrySerialisable(prisma, fn, messageConflit, options = {}) {
    for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative++) {
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(prisma, fn, {
                isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
                ...(options.operations === undefined ? {} : { maxWait: 10_000, timeout: delaiSelonVolume(options.operations) }),
            });
        }
        catch (err) {
            const estConflit = estConflitDeSerialisation(err);
            if (!estConflit)
                throw err;
            if (tentative === TENTATIVES_MAX)
                throw new common_1.ConflictException(messageConflit);
            await attendre(20 * tentative + Math.random() * 30);
        }
    }
    throw new Error('Échec inattendu de la transaction sérialisable');
}
//# sourceMappingURL=prisma-retry.util.js.map