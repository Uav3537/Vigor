'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const VigorErrorMessageFuncs = {
    INVALID_TARGET: ({ expected, received }) => `Invalid Task: ${typeof received} (expected: ${expected.join(', ')})`,
    EXHAUSTED: ({ maxAttempts }) => `Retry exhausted: max ${maxAttempts})`,
    TIMED_OUT: ({ limit, attempt }) => `Timeout: exceeded ${limit}ms (attempt: ${attempt})`,
    INVALID_CONTENT_TYPE: ({ expected, received, response }) => `Invalid Content Type Header: ${typeof received} (expected: ${expected.join(', ')})`,
    PARSER_NOT_FOUND: ({ expected, received, response }) => `Parser Not Found For Header: ${typeof received} (expected: ${expected.join(', ')})`,
    PARSER_ALL_FAILED: ({ tried, response }) => `All Parser Failed, Tried: ${tried.join(', ')}`,
    INVALID_PROTOCOL: ({ expected, received }) => `Invalid Protocol: ${typeof received} (expected: ${expected.join(', ')})`,
    INVALID_BODY: ({ expected, received }) => `Invalid Body: ${typeof received} (expected: ${expected.join(', ')})`,
    FETCH_FAILED: ({ status, response, url, headers, body, statusText }) => `Fetch Failed: ${status}`,
    EMPTY_TARGET: ({}) => `Empty Body`
};
class VigorError extends Error {
    timestamp = new Date();
    cause;
    code;
    data;
    method;
    stats;
    context;
    constructor(code, options) {
        const messageFn = VigorErrorMessageFuncs[code];
        const message = `[${code}] ${messageFn(options?.data)}`;
        super(message, { cause: options?.cause });
        this.name = new.target.name;
        this.code = code;
        this.cause = options.cause;
        this.data = options.data;
        this.method = options.method;
        this.stats = options.stats;
        this.context = options.context;
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace?.(this, new.target);
    }
}
class VigorRetryError extends VigorError {
    constructor(code, options) {
        super(code, options);
    }
}
class VigorParseError extends VigorError {
    constructor(code, options) {
        super(code, options);
    }
}
class VigorFetchError extends VigorError {
    constructor(code, options) {
        super(code, options);
    }
}
class VigorAllError extends VigorError {
    constructor(code, options) {
        super(code, options);
    }
}
class VigorStatus {
    _base;
    ctor;
    _config;
    constructor(config = {}, _base, ctor) {
        this._base = _base;
        this.ctor = ctor;
        this._config = { ...this._base, ...(config || {}) };
    }
    _mergeConfig(source, target) {
        const isPlainObject = (val) => val !== null && typeof val === 'object' && Object.getPrototypeOf(val) === Object.prototype;
        if (target === undefined || target === null) {
            return source;
        }
        if (isPlainObject(source) && isPlainObject(target)) {
            const result = { ...source };
            Object.keys(target).forEach((key) => {
                result[key] = this._mergeConfig(result[key], target[key]);
            });
            return result;
        }
        if (Array.isArray(source) && Array.isArray(target)) {
            return [...source, ...target];
        }
        return target;
    }
    _next(config) { return this.ctor(this._mergeConfig(this._config, config)); }
    _getConfig() { return this._config; }
    _getBase() { return this._base; }
}
const VigorDefault = Symbol("DEFAULT");
class VigorRetrySettings extends VigorStatus {
    constructor(config) {
        const base = {
            default: VigorDefault,
            timeout: 20 * 1000,
            attempt: 5,
            jitter: 1000
        };
        super(config, base, (c) => new VigorRetrySettings(c));
    }
    default(unk) { return this._next({ default: unk }); }
    timeout(num) { return this._next({ timeout: num }); }
    attempt(num) { return this._next({ attempt: num }); }
    jitter(num) { return this._next({ jitter: num }); }
}
class VigorRetryInterceptors extends VigorStatus {
    constructor(config) {
        const base = {
            before: [],
            after: [],
            result: [],
            retryIf: [],
            onRetry: [],
            onError: []
        };
        super(config, base, (c) => new VigorRetryInterceptors(c));
    }
    before(...funcs) { return this._next({ before: funcs.flat() }); }
    after(...funcs) { return this._next({ after: funcs.flat() }); }
    result(...funcs) { return this._next({ result: funcs.flat() }); }
    retryIf(...funcs) { return this._next({ retryIf: funcs.flat() }); }
    onRetry(...funcs) { return this._next({ onRetry: funcs.flat() }); }
    onError(...funcs) { return this._next({ onError: funcs.flat() }); }
}
class VigorRetryAlgorithmsConstant extends VigorStatus {
    constructor(config) {
        const base = {
            interval: 2000
        };
        super(config, base, (c) => new VigorRetryAlgorithmsConstant(c));
    }
    interval(num) { return this._next({ interval: num }); }
    /** @internal */
    _calculateDelay(attempt) {
        return this._config.interval;
    }
}
class VigorRetryAlgorithmsLinear extends VigorStatus {
    constructor(config) {
        const base = {
            initial: 1000,
            increment: 1000,
            minDelay: 500,
            maxDelay: 20 * 1000
        };
        super(config, base, (c) => new VigorRetryAlgorithmsLinear(c));
    }
    initial(num) { return this._next({ initial: num }); }
    increment(num) { return this._next({ increment: num }); }
    minDelay(num) { return this._next({ minDelay: num }); }
    maxDelay(num) { return this._next({ maxDelay: num }); }
    /** @internal */
    _calculateDelay(attempt) {
        const { initial, increment, minDelay, maxDelay } = this._config;
        return Math.max(minDelay, Math.min(maxDelay, initial + increment * attempt));
    }
}
class VigorRetryAlgorithmsBackoff extends VigorStatus {
    constructor(config) {
        const base = {
            initial: 1000,
            multiplier: 1.7,
            unit: 1000,
            minDelay: 500,
            maxDelay: 20 * 1000
        };
        super(config, base, (c) => new VigorRetryAlgorithmsBackoff(c));
    }
    initial(num) { return this._next({ initial: num }); }
    multiplier(num) { return this._next({ multiplier: num }); }
    unit(num) { return this._next({ unit: num }); }
    minDelay(num) { return this._next({ minDelay: num }); }
    maxDelay(num) { return this._next({ maxDelay: num }); }
    /** @internal */
    _calculateDelay(attempt) {
        const { initial, multiplier, unit, minDelay, maxDelay } = this._config;
        return Math.max(minDelay, Math.min(maxDelay, initial + unit * Math.pow(multiplier, attempt)));
    }
}
class VigorRetryAlgorithmsCustom extends VigorStatus {
    constructor(config) {
        const base = {
            func: (attempt) => attempt * 1000,
            minDelay: 500,
            maxDelay: 20 * 1000
        };
        super(config, base, (c) => new VigorRetryAlgorithmsCustom(c));
    }
    func(num) { return this._next({ func: num }); }
    /** @internal */
    _calculateDelay(attempt) {
        const { func, minDelay, maxDelay } = this._config;
        return Math.max(minDelay, Math.min(maxDelay, func(attempt)));
    }
}
class VigorRetry extends VigorStatus {
    constructor(config) {
        const base = {
            target: VigorDefault,
            settings: new VigorRetrySettings()._getBase(),
            interceptors: new VigorRetryInterceptors()._getBase(),
            algorithm: (attempt) => new VigorRetryAlgorithmsBackoff()._calculateDelay(attempt),
            abortSignals: []
        };
        super(config, base, (c) => new VigorRetry(c));
    }
    RetryAlgorithms = {
        constant: (config) => new VigorRetryAlgorithmsConstant(config),
        linear: (config) => new VigorRetryAlgorithmsLinear(config),
        backoff: (config) => new VigorRetryAlgorithmsBackoff(config),
        custom: (config) => new VigorRetryAlgorithmsCustom(config)
    };
    target(func) { return this._next({ target: func }); }
    settings(func) {
        if (typeof func === 'function') {
            return this._next({ settings: func(new VigorRetrySettings(this._config.settings))._getConfig() });
        }
        return this._next({ settings: func });
    }
    interceptors(func) {
        if (typeof func === 'function') {
            return this._next({ interceptors: func(new VigorRetryInterceptors(this._config.interceptors))._getConfig() });
        }
        return this._next({ interceptors: func });
    }
    algorithms(func) {
        const instance = func(this.RetryAlgorithms);
        return this._next({ algorithm: (attempt) => instance._calculateDelay(attempt) });
    }
    abortSignals(...abortSignals) {
        return this._next({ abortSignals: abortSignals.flat() });
    }
    async request(config, timeline = []) {
        const stats = this._mergeConfig(this._config, config);
        let ctx = {
            result: VigorDefault,
            error: VigorDefault,
            attempt: 0,
            delay: 0,
            controller: VigorDefault,
            timeline: timeline,
            stats,
        };
        const throwError = (error) => {
            ctx.timeline.push({ action: "throwError called", content: error });
            throw error;
        };
        try {
            if (typeof stats.target !== 'function')
                throw new VigorRetryError("INVALID_TARGET", {
                    method: "request",
                    data: {
                        expected: ["function"],
                        received: stats.target
                    },
                    stats: stats,
                    context: ctx
                });
            while (ctx.attempt < stats.settings.attempt) {
                ctx.attempt++;
                ctx.timeline.push({ action: "increased attempt", content: ctx.attempt });
                let broke = false;
                const breakRetry = (error) => {
                    ctx.timeline.push({ action: "breakRetry called", content: error });
                    broke = true;
                    throw error;
                };
                try {
                    ctx.timeline.push({ action: "process request_once handling", content: ctx.attempt });
                    const controller = new AbortController();
                    const timeoutController = new AbortController();
                    const signal = AbortSignal.any([controller.signal, timeoutController.signal, ...stats.abortSignals]);
                    const abort = (err) => controller.abort(err);
                    ctx.timeline.push({ action: "interceptor handling: before", content: stats.interceptors.before });
                    for (const func of stats.interceptors.before) {
                        await func(ctx, { throwError, breakRetry, abort });
                    }
                    const timeoutTimer = setTimeout(() => {
                        clearTimeout(timeoutTimer);
                        timeoutController.abort(new VigorRetryError("TIMED_OUT", {
                            method: "request",
                            data: {
                                limit: stats.settings.timeout,
                                attempt: ctx.attempt
                            },
                        }));
                    }, stats.settings.timeout);
                    signal.throwIfAborted();
                    let onAbort;
                    try {
                        ctx.result = await Promise.race([
                            stats.target(ctx, { abort, signal }),
                            new Promise((_, rej) => {
                                onAbort = () => rej(signal.reason);
                                signal.addEventListener("abort", onAbort);
                            })
                        ]);
                    }
                    finally {
                        clearTimeout(timeoutTimer);
                        if (onAbort)
                            signal.removeEventListener("abort", onAbort);
                    }
                    const setResult = (unk) => {
                        ctx.timeline.push({ action: "setResult called", content: unk });
                        ctx.result = unk;
                        return unk;
                    };
                    ctx.timeline.push({ action: "interceptor handling: after", content: stats.interceptors.after });
                    for (const func of stats.interceptors.after) {
                        await func(ctx, { setResult, throwError, breakRetry });
                    }
                    ctx.timeline.push({ action: "interceptor handling: result", content: stats.interceptors.result });
                    for (const func of stats.interceptors.result) {
                        await func(ctx, { setResult, throwError });
                    }
                    return ctx.result;
                }
                catch (error) {
                    ctx.error = error;
                    ctx.timeline.push({ action: "process error_once handling", content: error });
                    if (broke)
                        throw error;
                    let proceed = true;
                    const proceedRetry = () => {
                        ctx.timeline.push({ action: "proceedRetry called", content: true });
                        return proceed = true;
                    };
                    const cancelRetry = () => {
                        ctx.timeline.push({ action: "cancelRetry called", content: false });
                        return proceed = false;
                    };
                    ctx.timeline.push({ action: "interceptor handling: retryIf", content: stats.interceptors.result });
                    for (const func of stats.interceptors.retryIf) {
                        await func(ctx, { proceedRetry, cancelRetry });
                    }
                    if (!proceed)
                        throw error;
                    ctx.delay = VigorDefault;
                    const setDelay = (num) => {
                        ctx.timeline.push({ action: "setDelay called", content: num });
                        return ctx.delay = num;
                    };
                    const setAttempt = (num) => {
                        ctx.timeline.push({ action: "setAttempt called", content: num });
                        return ctx.attempt = num;
                    };
                    ctx.timeline.push({ action: "interceptor handling: onRetry", content: stats.interceptors.onRetry });
                    for (const func of stats.interceptors.onRetry) {
                        await func(ctx, { throwError, setDelay, setAttempt });
                    }
                    if (typeof ctx.delay !== 'number')
                        ctx.delay = stats.algorithm(ctx.attempt) + Math.random() * stats.settings.jitter;
                    const delay = ctx.delay;
                    await new Promise(r => setTimeout(r, delay));
                }
            }
            throw new VigorRetryError("EXHAUSTED", {
                method: "request",
                data: {
                    maxAttempts: stats.settings.attempt,
                },
                context: ctx
            });
        }
        catch (error) {
            ctx.error = error;
            let overwritten = false;
            const setResult = (unk) => {
                ctx.timeline.push({ action: "setResult called", content: unk });
                ctx.result = unk;
                overwritten = true;
                return unk;
            };
            let restarted = false;
            const restart = () => {
                ctx.timeline.push({ action: "restart called" });
                restarted = true;
            };
            ctx.timeline.push({ action: "interceptor handling: onError", content: stats.interceptors.onError });
            for (const func of stats.interceptors.onError) {
                await func(ctx, { setResult, throwError, restart });
            }
            if (restarted) {
                return await this.request(stats, ctx.timeline);
            }
            if (overwritten)
                return ctx.result;
            if (stats.settings.default !== VigorDefault)
                return stats.settings.default;
            throw error;
        }
    }
}
class VigorParseSettings extends VigorStatus {
    constructor(config) {
        const base = {
            raw: false,
            default: VigorDefault
        };
        super(config, base, (c) => new VigorParseSettings(c));
    }
    original(bool) { return this._next({ raw: bool }); }
    default(unk) { return this._next({ default: unk }); }
}
class VigorParseStrategies extends VigorStatus {
    constructor(config) {
        const base = {
            funcs: []
        };
        super(config, base, (c) => new VigorParseStrategies(c));
        this._config.funcs.push(this.ParseAutoAlgorithms.contentType);
    }
    ParseAutoHeaders = [
        { header: "application/json", regExp: /application\/(.+\+)?json(.+\+)?/i, method: (res) => res.json() },
        { header: "application/xml", regExp: /application\/(.+\+)?xml(.+\+)?/i, method: (res) => res.text() },
        { header: "application/x-www-form-urlencoded", regExp: /application\/(.+\+)?x-www-form-urlencoded(.+\+)?/i, method: (res) => res.formData() },
        { header: "application/octet-stream", regExp: /application\/(.+\+)?octet-stream(.+\+)?/i, method: (res) => res.arrayBuffer() },
        { header: "image/*", regExp: /^image\/.+/i, method: (res) => res.blob() },
        { header: "audio/*", regExp: /^audio\/.+/i, method: (res) => res.blob() },
        { header: "video/*", regExp: /^video\/.+/i, method: (res) => res.blob() },
        { header: "multipart/form-data", regExp: /multipart\/(.+\+)?form-data(.+\+)?/i, method: (res) => res.formData() },
        { header: "text/*", regExp: /^text\/.+/i, method: (res) => res.text() },
    ];
    ParseAutoMethods = [
        { title: "json", method: (res) => res.json() },
        { title: "formData", method: (res) => res.formData() },
        { title: "text", method: (res) => res.text() },
        { title: "blob", method: (res) => res.blob() },
    ];
    ParseAutoAlgorithms = {
        contentType: async (response) => {
            const parsers = this.ParseAutoHeaders;
            const contentTypeHeader = response.headers.get("content-type");
            if (!contentTypeHeader)
                throw new VigorParseError("INVALID_CONTENT_TYPE", {
                    method: "ParseAutoAlgorithms.contentType",
                    data: {
                        expected: ["string"],
                        received: contentTypeHeader,
                        response: response
                    }
                });
            const toDo = parsers.find(parser => parser.regExp.test(contentTypeHeader));
            if (!toDo)
                throw new VigorParseError("PARSER_NOT_FOUND", {
                    method: "ParseAutoAlgorithms.contentType",
                    data: {
                        expected: parsers.map(parser => parser.header),
                        received: contentTypeHeader,
                        response: response
                    }
                });
            return await toDo.method(response);
        },
        sniff: async (response) => {
            const parsers = this.ParseAutoMethods;
            for (const [i, parser] of parsers.entries()) {
                const cloned = (i === parsers.length - 1)
                    ? response
                    : response.clone();
                try {
                    const data = await parser.method(cloned);
                    return data;
                }
                catch { }
            }
            throw new VigorParseError("PARSER_ALL_FAILED", {
                method: "ParseAutoAlgorithms.sniff",
                data: {
                    tried: parsers.map(parser => parser.title),
                    response: response
                }
            });
        }
    };
    contentType() { return this._next({ funcs: [this.ParseAutoAlgorithms.contentType] }); }
    sniff() { return this._next({ funcs: [this.ParseAutoAlgorithms.sniff] }); }
    json() { return this._next({ funcs: [(res) => res.json()] }); }
    text() { return this._next({ funcs: [(res) => res.text()] }); }
    arrayBuffer() { return this._next({ funcs: [(res) => res.arrayBuffer()] }); }
    blob() { return this._next({ funcs: [(res) => res.blob()] }); }
    bytes() { return this._next({ funcs: [(res) => res.arrayBuffer().then(r => new Uint8Array(r))] }); }
    formData() { return this._next({ funcs: [(res) => res.formData()] }); }
}
class VigorParseInterceptors extends VigorStatus {
    constructor(config) {
        const base = {
            before: [],
            after: [],
            result: [],
            onError: []
        };
        super(config, base, (c) => new VigorParseInterceptors(c));
    }
    before(...funcs) { return this._next({ before: funcs.flat() }); }
    after(...funcs) { return this._next({ after: funcs.flat() }); }
    result(...funcs) { return this._next({ result: funcs.flat() }); }
    onError(...funcs) { return this._next({ onError: funcs.flat() }); }
}
class VigorParse extends VigorStatus {
    constructor(config) {
        const base = {
            target: VigorDefault,
            settings: new VigorParseSettings()._getBase(),
            strategies: new VigorParseStrategies()._getBase(),
            interceptors: new VigorParseInterceptors()._getBase()
        };
        super(config, base, (c) => new VigorParse(c));
    }
    target(response) { return this._next({ target: response }); }
    settings(func) {
        if (typeof func === 'function') {
            return this._next({ settings: func(new VigorParseSettings(this._config.settings))._getConfig() });
        }
        return this._next({ settings: func });
    }
    strategies(func) {
        if (typeof func === 'function') {
            return this._next({ strategies: func(new VigorParseStrategies(this._config.strategies))._getConfig() });
        }
        return this._next({ strategies: func });
    }
    interceptors(func) {
        if (typeof func === 'function') {
            return this._next({ interceptors: func(new VigorParseInterceptors(this._config.interceptors))._getConfig() });
        }
        return this._next({ interceptors: func });
    }
    async request(config, timeline = []) {
        const stats = this._mergeConfig(this._config, config);
        const target = stats.target;
        let ctx = {
            timeline: timeline,
            stats,
            response: target,
            result: VigorDefault,
            error: VigorDefault,
        };
        const throwError = (err) => {
            ctx.timeline.push({ action: "throwError called", content: err });
            throw err;
        };
        try {
            if (target === VigorDefault)
                throw new VigorParseError("INVALID_TARGET", {
                    method: "request",
                    data: {
                        expected: ["Response"],
                        received: target
                    },
                    context: ctx
                });
            ctx.timeline.push({ action: "interceptor handling: before", content: stats.interceptors.before });
            for (const func of stats.interceptors.before) {
                await func(ctx, { throwError });
            }
            if (stats.settings.raw) {
                ctx.result = ctx.response;
            }
            else {
                let parsed = false;
                for (const [i, func] of stats.strategies.funcs.length > 0
                    ? stats.strategies.funcs.entries()
                    : new VigorParseStrategies().contentType()._getConfig().funcs.entries()) {
                    const cloned = (i === stats.strategies.funcs.length - 1)
                        ? ctx.response
                        : ctx.response.clone();
                    try {
                        ctx.result = await func(cloned);
                        parsed = true;
                        break;
                    }
                    catch { }
                }
                if (!parsed)
                    throw new VigorParseError("PARSER_ALL_FAILED", {
                        method: "request",
                        data: {
                            tried: stats.strategies.funcs,
                            response: ctx.response
                        },
                        context: ctx
                    });
            }
            const setResult = (unk) => {
                ctx.timeline.push({ action: "setResult called", content: unk });
                ctx.result = unk;
                return unk;
            };
            ctx.timeline.push({ action: "interceptor handling: after", content: stats.interceptors.after });
            for (const func of stats.interceptors.after) {
                await func(ctx, { setResult, throwError });
            }
            ctx.timeline.push({ action: "interceptor handling: result", content: stats.interceptors.result });
            for (const func of stats.interceptors.result) {
                await func(ctx, { setResult, throwError });
            }
            return ctx.result;
        }
        catch (error) {
            ctx.error = error;
            let overwritten = false;
            const setResult = (unk) => {
                ctx.timeline.push({ action: "setResult called", content: unk });
                ctx.result = unk;
                overwritten = true;
                return unk;
            };
            ctx.timeline.push({ action: "interceptor handling: onError", content: stats.interceptors.onError });
            for (const func of stats.interceptors.onError) {
                await func(ctx, { setResult, throwError });
            }
            if (overwritten)
                return ctx.result;
            if (stats.settings.default !== VigorDefault)
                return stats.settings.default;
            throw error;
        }
    }
}
class VigorFetchSettings extends VigorStatus {
    constructor(config) {
        const base = {
            retryHeaders: ["retry-after", "ratelimit-reset", "x-ratelimit-reset", "x-retry-after", "x-amz-retry-after", "chrome-proxy-next-link"],
            unretryStatus: [400, 401, 403, 404, 405, 413, 422],
            default: VigorDefault
        };
        super(config, base, (c) => new VigorFetchSettings(c));
    }
    retryHeaders(...strs) { return this._next({ retryHeaders: strs.flat() }); }
    unretryStatus(...nums) { return this._next({ unretryStatus: nums.flat() }); }
    default(unk) { return this._next({ default: unk }); }
}
class VigorFetchInterceptors extends VigorStatus {
    constructor(config) {
        const base = {
            before: [],
            after: [],
            result: [],
            onError: []
        };
        super(config, base, (c) => new VigorFetchInterceptors(c));
    }
    before(...funcs) { return this._next({ before: funcs.flat() }); }
    after(...funcs) { return this._next({ after: funcs.flat() }); }
    result(...funcs) { return this._next({ result: funcs.flat() }); }
    onError(...funcs) { return this._next({ onError: funcs.flat() }); }
}
class VigorFetch extends VigorStatus {
    constructor(config) {
        const base = {
            origin: [],
            path: [],
            query: [],
            hash: "",
            options: {
                headers: {},
                body: VigorDefault
            },
            settings: new VigorFetchSettings()._getBase(),
            interceptors: new VigorFetchInterceptors()._getBase(),
            retryConfig: new VigorRetry()._getBase(),
            parseConfig: new VigorParse()._getBase()
        };
        super(config, base, (c) => new VigorFetch(c));
    }
    _stringifyList(unkList) {
        return unkList
            .filter(unk => unk !== null && unk !== undefined)
            .map(unk => {
            if (unk instanceof Date)
                return unk.toISOString();
            return String(unk);
        });
    }
    origin(...strs) { return this._next({ origin: this._stringifyList(strs.flat()) }); }
    path(...strs) { return this._next({ path: this._stringifyList(strs.flat()) }); }
    query(...strs) { return this._next({ query: strs.flat() }); }
    hash(str) { return this._next({ hash: str }); }
    options(obj) { return this._next({ options: obj }); }
    headers(obj) { return this._next({ options: { headers: obj } }); }
    body(obj) { return this._next({ options: { headers: this._config.options.headers, body: obj } }); }
    _buildUrl(origin, path, query, hash) {
        const originObj = new URL(origin[0]);
        const baseStr = originObj.origin;
        const pathObj = [originObj.pathname.replace(/^\/+|\/+$/g, '')];
        for (const str of path) {
            pathObj.push(str.replace(/^\/+|\/+$/g, ''));
        }
        const pathStr = pathObj.join('/');
        const mainObj = new URL(pathStr, baseStr);
        const parseVal = (val) => {
            if (val instanceof Date)
                return val.toISOString();
            return String(val);
        };
        const queryObj = [...Array.from(originObj.searchParams.entries()), ...query.flatMap(qu => Object.entries(qu))];
        for (const [key, val] of queryObj) {
            if (val === undefined || val === null)
                continue;
            if (Array.isArray(val))
                for (const e of val) {
                    mainObj.searchParams.append(key, parseVal(e));
                }
            else {
                mainObj.searchParams.append(key, parseVal(val));
            }
        }
        mainObj.hash = hash ?? originObj.hash;
        return mainObj.href;
    }
    _normalizeOptions(body) {
        if (body == null)
            return { isJson: false, headers: {}, body };
        if (typeof body === "string")
            return { isJson: false, headers: {
                    "Content-Type": "text/plain;charset=UTF-8"
                }, body };
        if (body instanceof Blob)
            return { isJson: false, headers: {
                    ...(body.type && { "Content-Type": body.type })
                }, body };
        if (body instanceof ArrayBuffer)
            return { isJson: false, headers: {
                    "Content-Type": "application/octet-stream"
                }, body };
        if (body instanceof URLSearchParams)
            return { isJson: false, headers: {
                    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
                }, body };
        if (body instanceof FormData)
            return { isJson: false, headers: {}, body };
        if (typeof body === "object") {
            return { isJson: true, headers: {
                    "Content-Type": "application/json"
                }, body: JSON.stringify(body) };
        }
        throw new VigorFetchError("INVALID_BODY", {
            method: "_normalizeBody",
            data: {
                expected: ["string", "Blob", "ArrayBuffer", "URLSearchParams", "FormData"],
                received: body
            }
        });
    }
    settings(func) {
        if (typeof func === 'function') {
            return this._next({ settings: func(new VigorFetchSettings(this._config.settings))._getConfig() });
        }
        return this._next({ settings: func });
    }
    interceptors(func) {
        if (typeof func === 'function') {
            return this._next({ interceptors: func(new VigorFetchInterceptors(this._config.interceptors))._getConfig() });
        }
        return this._next({ interceptors: func });
    }
    retryConfig(func) {
        if (typeof func === 'function') {
            return this._next({ retryConfig: func(new VigorRetry(this._config.retryConfig))._getConfig() });
        }
        return this._next({ retryConfig: func });
    }
    parseConfig(func) {
        if (typeof func === 'function') {
            return this._next({ parseConfig: func(new VigorParse(this._config.parseConfig))._getConfig() });
        }
        return this._next({ parseConfig: func });
    }
    async request(config, timeline = []) {
        const stats = this._mergeConfig(this._config, config);
        let ctx = {
            href: "",
            result: VigorDefault,
            response: VigorDefault,
            options: {
                headers: VigorDefault,
                body: VigorDefault
            },
            error: VigorDefault,
            timeline: timeline,
            stats,
        };
        const throwError = (err) => {
            ctx.timeline.push({ action: "throwError called", content: err });
            throw err;
        };
        try {
            try {
                new URL(stats.origin[0]);
            }
            catch {
                throw new VigorFetchError("INVALID_PROTOCOL", {
                    method: "request",
                    data: {
                        expected: ["valid URL protocol"],
                        received: stats.origin
                    }
                });
            }
            ctx.href = this._buildUrl(stats.origin, stats.path, stats.query, stats.hash);
            const { headers, body, ...others } = stats.options;
            ctx.options = {
                ...others,
                headers: {}
            };
            const hasBody = body !== VigorDefault &&
                body !== undefined;
            if (hasBody) {
                const normalized = this._normalizeOptions(body);
                if (normalized.body !== undefined) {
                    ctx.options.body = normalized.body;
                }
                Object.assign(ctx.options.headers, normalized.headers);
            }
            Object.assign(ctx.options.headers, headers);
            ctx.timeline.push({ action: "options set", content: ctx.options });
            const setOptions = (unk) => {
                ctx.timeline.push({ action: "setOptions called", content: unk });
                return ctx.options = unk;
            };
            const setHeaders = (unk) => {
                ctx.timeline.push({ action: "setHeaders called", content: unk });
                return ctx.options.headers = unk;
            };
            const setBody = (unk) => {
                ctx.timeline.push({ action: "setBody called", content: unk });
                return ctx.options.body = unk;
            };
            const fetchTask = async (ctx2, { abort, signal }) => {
                ctx.options.signal = signal;
                const result = await fetch(ctx.href, ctx.options);
                return result;
            };
            const throwStatus = async (ctx2, api) => {
                const response = ctx2.result;
                if (!response.ok) {
                    api.throwError(new VigorFetchError("FETCH_FAILED", {
                        method: "request",
                        data: {
                            status: response.status,
                            response: response,
                            url: response.url,
                            headers: response.headers,
                            body: response.body,
                            statusText: response.statusText
                        }
                    }));
                }
            };
            const handleBlacklist = async (ctx2, api) => {
                const response = ctx2.result;
                ctx.error = ctx2.error;
                if (response instanceof Response) {
                    if (stats.settings.unretryStatus.includes(response.status))
                        api.cancelRetry();
                    else
                        api.proceedRetry();
                }
            };
            const handleRatelimit = async (ctx2, api) => {
                const response = ctx2.result;
                ctx.error = ctx2.error;
                if (response instanceof Response) {
                    if (response.status === 429) {
                        let retryHeader = null;
                        for (const header of stats.settings.retryHeaders) {
                            retryHeader = response.headers.get(header);
                            if (retryHeader)
                                break;
                        }
                        if (retryHeader) {
                            const toNumber = Number(retryHeader);
                            const delay = !isNaN(toNumber)
                                ? toNumber * 1000
                                : (() => {
                                    const toDate = new Date(retryHeader).getTime();
                                    return !isNaN(toDate)
                                        ? toDate - Date.now()
                                        : null;
                                })();
                            if (delay !== null && delay > 0)
                                api.setDelay(delay + Math.random() * ctx2.stats.settings.jitter);
                        }
                    }
                }
            };
            stats.retryConfig.interceptors.after.unshift(throwStatus);
            stats.retryConfig.interceptors.retryIf.unshift(handleBlacklist);
            stats.retryConfig.interceptors.onRetry.unshift(handleRatelimit);
            const retryEngine = new VigorRetry(stats.retryConfig)
                .target(fetchTask);
            const parseEngine = new VigorParse(stats.parseConfig);
            ctx.timeline.push({ action: "interceptor handling: before", content: stats.interceptors.before });
            for (const func of stats.interceptors.before) {
                await func(ctx, { throwError, setOptions, setHeaders, setBody });
            }
            ctx.response = await retryEngine.request(undefined, timeline);
            ctx.result = await parseEngine.target(ctx.response).request(undefined, timeline);
            const setResult = (unk) => {
                ctx.timeline.push({ action: "setResult called", content: unk });
                ctx.result = unk;
                return unk;
            };
            ctx.timeline.push({ action: "interceptor handling: after", content: stats.interceptors.after });
            for (const func of stats.interceptors.after) {
                await func(ctx, { setResult, throwError });
            }
            ctx.timeline.push({ action: "interceptor handling: result", content: stats.interceptors.result });
            for (const func of stats.interceptors.result) {
                await func(ctx, { setResult, throwError });
            }
            return ctx.result;
        }
        catch (error) {
            ctx.error = error;
            let overwritten = false;
            const setResult = (unk) => {
                ctx.timeline.push({ action: "setResult called", content: unk });
                ctx.result = unk;
                overwritten = true;
                return unk;
            };
            let restarted = false;
            const restart = () => {
                ctx.timeline.push({ action: "restart called" });
                restarted = true;
            };
            ctx.timeline.push({ action: "interceptor handling: onError", content: stats.interceptors.onError });
            for (const func of stats.interceptors.onError) {
                await func(ctx, { setResult, throwError, restart });
            }
            if (restarted) {
                return await this.request(stats, timeline);
            }
            if (overwritten)
                return ctx.result;
            if (stats.settings.default !== VigorDefault)
                return stats.settings.default;
            throw error;
        }
    }
}
class VigorAllSettings extends VigorStatus {
    constructor(config) {
        const base = {
            concurrency: 5,
            onlySuccess: false
        };
        super(config, base, (c) => new VigorAllSettings(c));
    }
    concurrency(num) { return this._next({ concurrency: num }); }
    onlySuccess(num) { return this._next({ onlySuccess: num }); }
}
class VigorAllInterceptors extends VigorStatus {
    constructor(config) {
        const base = {
            before: [],
            after: [],
            result: [],
            onError: []
        };
        super(config, base, (c) => new VigorAllInterceptors(c));
    }
    before(...funcs) { return this._next({ before: funcs.flat() }); }
    after(...funcs) { return this._next({ after: funcs.flat() }); }
    result(...funcs) { return this._next({ result: funcs.flat() }); }
    onError(...funcs) { return this._next({ onError: funcs.flat() }); }
}
class VigorAll extends VigorStatus {
    constructor(config) {
        const base = {
            target: [],
            settings: new VigorAllSettings()._getBase(),
            interceptors: new VigorAllInterceptors()._getBase()
        };
        super(config, base, (c) => new VigorAll(c));
    }
    target(...funcs) { return this._next({ target: funcs.flat() }); }
    settings(func) {
        if (typeof func === 'function') {
            return this._next({ settings: func(new VigorAllSettings(this._config.settings))._getConfig() });
        }
        return this._next({ settings: func });
    }
    interceptors(func) {
        if (typeof func === 'function') {
            return this._next({ interceptors: func(new VigorAllInterceptors(this._config.interceptors))._getConfig() });
        }
        return this._next({ interceptors: func });
    }
    async runTask(task, { stats, root }, semaphore) {
        let ctx = {
            result: VigorDefault,
            error: VigorDefault,
            timeline: [],
            stats,
            root,
            target: task,
            semaphore
        };
        const throwError = (err) => {
            ctx.timeline.push({ action: "throwError called", content: err });
            throw err;
        };
        try {
            try {
                await semaphore.acquire();
                ctx.timeline.push({ action: "task acquired", content: ctx.target });
                ctx.timeline.push({ action: "interceptor handling: before", content: stats.interceptors.before });
                for (const func of stats.interceptors.before) {
                    await func(ctx, { throwError });
                }
                ctx.timeline.push({ action: "task started", content: ctx.target });
                ctx.result = await task(ctx);
            }
            finally {
                ctx.timeline.push({ action: "task ended", content: ctx.target });
                const setResult = (unk) => {
                    ctx.timeline.push({ action: "setResult called", content: unk });
                    ctx.result = unk;
                    return unk;
                };
                ctx.timeline.push({ action: "interceptor handling: after", content: stats.interceptors.after });
                for (const func of stats.interceptors.after) {
                    await func(ctx, { setResult, throwError });
                }
                semaphore.release();
                ctx.timeline.push({ action: "task released", content: ctx.target });
                return ctx.result;
            }
        }
        catch (error) {
            ctx.error = error;
            let overwritten = false;
            const setResult = (unk) => {
                ctx.timeline.push({ action: "setResult called", content: unk });
                ctx.result = unk;
                overwritten = true;
                return unk;
            };
            ctx.timeline.push({ action: "interceptor handling: onError", content: stats.interceptors.onError });
            for (const func of stats.interceptors.onError) {
                await func(ctx, { setResult, throwError });
            }
            if (overwritten)
                return ctx.result;
            throw error;
        }
    }
    async request(config, timeline = []) {
        const stats = this._mergeConfig(this._config, config);
        let ctx = {
            result: VigorDefault,
            timeline,
            stats,
            queue: new Set()
        };
        if (stats.target.length === 0)
            throw new VigorAllError("EMPTY_TARGET", {
                method: "request",
                data: {}
            });
        const waitQueue = [];
        for (const task of stats.target) {
            const acquire = () => {
                if (ctx.queue.size < stats.settings.concurrency) {
                    return Promise.resolve();
                }
                return new Promise((res) => waitQueue.push(res));
            };
            const release = () => {
                if (waitQueue.length > 0) {
                    const next = waitQueue.shift();
                    if (next)
                        next();
                }
            };
            acquire();
            let promise;
            promise = this.runTask(task, { stats, root: ctx }, { acquire, release }).then(res => {
                ctx.queue.delete(promise);
                return { success: true, value: res };
            }).catch(err => ({ success: false, value: err }));
            ctx.queue.add(promise);
        }
        const raw = await Promise.all(ctx.queue);
        ctx.result = stats.settings.onlySuccess
            ? raw.filter(r => r.success).map(r => r.value)
            : raw.map(r => r.value);
        const setResult = (unk) => {
            ctx.timeline.push({ action: "setResult called", content: unk });
            ctx.result = unk;
            return unk;
        };
        const throwError = (err) => {
            ctx.timeline.push({ action: "throwError called", content: err });
            throw err;
        };
        ctx.timeline.push({ action: "interceptor handling: result", content: stats.interceptors.result });
        for (const func of stats.interceptors.result) {
            await func(ctx, { setResult, throwError });
        }
        return ctx.result;
    }
}
const VigorEntry = {
    retry: {
        main: VigorRetry,
        settings: VigorRetrySettings,
        interceptors: VigorRetryInterceptors,
        error: VigorRetryError,
        algorithms: {
            constant: VigorRetryAlgorithmsConstant,
            linear: VigorRetryAlgorithmsLinear,
            backoff: VigorRetryAlgorithmsBackoff,
            custom: VigorRetryAlgorithmsCustom
        }
    },
    parse: {
        main: VigorParse,
        settings: VigorParseSettings,
        interceptors: VigorParseInterceptors,
        error: VigorParseError,
        strategies: VigorParseStrategies
    },
    fetch: {
        main: VigorFetch,
        settings: VigorFetchSettings,
        interceptors: VigorFetchInterceptors,
        error: VigorFetchError,
    },
    all: {
        main: VigorAll,
        settings: VigorAllSettings,
        interceptors: VigorAllInterceptors,
        error: VigorAllError
    }
};
const vigor = {
    use: async (func, config) => {
        return await func(VigorEntry, config);
    },
    fetch: (...strs) => {
        return new VigorFetch().origin(...strs);
    },
    retry: (target) => {
        return new VigorRetry().target(target);
    },
    parse: (response) => {
        return new VigorParse().target(response);
    },
    all: (...funcs) => {
        return new VigorAll().target(...funcs);
    },
    builder: {
        fetch: {
            settings: (c) => new VigorFetchSettings(c),
            interceptors: (c) => new VigorFetchInterceptors(c),
        },
        retry: {
            settings: (c) => new VigorRetrySettings(c),
            interceptors: (c) => new VigorRetryInterceptors(c),
        },
        parse: {
            settings: (c) => new VigorParseSettings(c),
            interceptors: (c) => new VigorParseInterceptors(c),
        },
        all: {
            settings: (c) => new VigorAllSettings(c),
            interceptors: (c) => new VigorAllInterceptors(c),
        }
    }
};

exports.VigorEntry = VigorEntry;
exports.default = vigor;
exports.vigor = vigor;
