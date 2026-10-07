"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fxService = exports.FxService = exports.referenceRates = exports.ReferenceRates = exports.getCurrency = exports.currencies = void 0;
exports.convertMinor = convertMinor;
const currencies_json_1 = __importDefault(require("../config/currencies.json"));
exports.currencies = currencies_json_1.default;
const errors_js_1 = require("../utils/errors.js");
const getCurrency = (code) => {
    const item = currencies_json_1.default.find(c => c.code === code.toUpperCase());
    if (!item)
        throw new errors_js_1.BadRequestError(`Unsupported currency: ${code}`);
    return item;
};
exports.getCurrency = getCurrency;
const URL = 'https://api.frankfurter.dev/v2/rates?base=USD&quotes=' + currencies_json_1.default.filter(c => c.code !== 'USD').map(c => c.code).join(',');
const unavailable = () => new errors_js_1.AppError('Current reference rates are unavailable. Please try again shortly.', 503, 'FX_UNAVAILABLE');
class ReferenceRates {
    fetcher;
    clock;
    cached;
    pending;
    constructor(fetcher = (...args) => fetch(...args), clock = () => Date.now()) {
        this.fetcher = fetcher;
        this.clock = clock;
    }
    async latest() {
        if (this.cached && this.clock() - this.cached.fetchedAt < 3600000)
            return this.cached;
        if (this.pending)
            return this.pending;
        this.pending = this.load().finally(() => { this.pending = undefined; });
        return this.pending;
    }
    async load() {
        try {
            const response = await this.fetcher(URL, { signal: AbortSignal.timeout(8000) });
            if (!response.ok)
                throw unavailable();
            const data = await response.json();
            if (!Array.isArray(data))
                throw unavailable();
            const rates = { USD: 1 }, dates = {};
            for (const value of data) {
                const r = value;
                if (r.base !== 'USD' || !currencies_json_1.default.some(c => c.code === r.quote) || r.quote === 'USD' || rates[r.quote] !== undefined || !Number.isFinite(r.rate) || r.rate <= 0 || r.rate > 1000000 || !/^\d{4}-\d{2}-\d{2}$/.test(r.date))
                    throw unavailable();
                const age = this.clock() - Date.parse(r.date + 'T00:00:00Z');
                if (!Number.isFinite(age) || age > 7 * 86400000 || age < -86400000)
                    throw unavailable();
                rates[r.quote] = r.rate;
                dates[r.quote] = r.date;
            }
            if (currencies_json_1.default.some(c => !rates[c.code]))
                throw unavailable();
            dates.USD = Object.values(dates).sort()[0];
            this.cached = { rates, dates, fetchedAt: this.clock() };
            return this.cached;
        }
        catch {
            throw unavailable();
        }
    }
}
exports.ReferenceRates = ReferenceRates;
exports.referenceRates = new ReferenceRates();
// Integer arithmetic prevents zero/three-decimal currencies from inheriting a 100x scale.
function convertMinor(amount, rate, fromDecimals, toDecimals) {
    const scale = 1000000000000n;
    const numerator = BigInt(amount) * BigInt(Math.round(rate * Number(scale))) * 10n ** BigInt(toDecimals);
    const denominator = scale * 10n ** BigInt(fromDecimals);
    const result = Number((numerator + denominator / 2n) / denominator);
    if (!Number.isSafeInteger(result) || result < 0)
        throw new errors_js_1.BadRequestError('Converted amount is outside the supported range.');
    return result;
}
class FxService {
    provider;
    constructor(provider = exports.referenceRates) {
        this.provider = provider;
    }
    async calculateQuote(sourceCurrency, targetCurrency, sendAmountMinor) {
        const source = (0, exports.getCurrency)(sourceCurrency), target = (0, exports.getCurrency)(targetCurrency);
        if (source.code === target.code)
            throw new errors_js_1.BadRequestError('Choose two different currencies.');
        if (!Number.isSafeInteger(sendAmountMinor) || sendAmountMinor <= 0 || sendAmountMinor > 1000000 * 10 ** source.decimals)
            throw new errors_js_1.BadRequestError('Enter a valid amount of no more than 1,000,000 source currency units.');
        const feeMinor = source.flatFeeMinor + Math.floor((sendAmountMinor + 100) / 200);
        if (sendAmountMinor <= feeMinor)
            throw new errors_js_1.BadRequestError('The sending amount must exceed the transfer fee.');
        const snapshot = await this.provider.latest();
        const exchangeRate = Number((snapshot.rates[target.code] / snapshot.rates[source.code]).toFixed(12));
        const receiveAmountMinor = convertMinor(sendAmountMinor - feeMinor, exchangeRate, source.decimals, target.decimals);
        if (receiveAmountMinor < 1)
            throw new errors_js_1.BadRequestError('Increase the amount so the recipient receives at least one minor currency unit.');
        return { sourceCurrency: source.code, targetCurrency: target.code, sendAmountMinor, feeMinor, netConvertibleMinor: sendAmountMinor - feeMinor, exchangeRate, receiveAmountMinor,
            rateProvider: 'Frankfurter', rateDate: [snapshot.dates[source.code], snapshot.dates[target.code]].sort()[0],
            sendAedMinor: convertMinor(sendAmountMinor, snapshot.rates.AED / snapshot.rates[source.code], source.decimals, 2) };
    }
}
exports.FxService = FxService;
exports.fxService = new FxService();
