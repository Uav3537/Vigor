const VIGOR_ERROR_MESSAGES = {
    TIMEOUT: ({ limit, attempt }) => `Timeout: exceeded ${limit}ms (attempt: ${attempt})`,
    EXHAUSTED: ({ maxAttempts }) => `Retry exhausted: max ${maxAttempts})`,
    INVALID_URL: ({ received }) => `Invalid URL: ${received}`,
    INVALID_PROTOCOL: ({ expected, received }) => `Invalid protocol: ${received} (expected ${expected.join(", ")})`,
    FETCH_ERROR: ({ status, statusText, url }) => `HTTP Error: ${status} ${statusText} (url: ${url})`,
    PARSE_FAILED: ({ expected }) => `Parse failed: expected ${expected}`,
    INVALID_TYPE: ({ expected, received }) => `Invalid parser type: ${expected}`,
    TARGET_MISSING: () => `Target missing`,
    REQUEST_FAILED: ({ index, error }) => `Request failed at index ${index}: ${error.message}`,
    UNKNOWN: () => `Unknown error`
};
class VigorError extends Error {
    timestamp = new Date();
    method;
    code;
    cause;
    context;
    type;
    data;
    constructor(code, options) {
        const messageFn = VIGOR_ERROR_MESSAGES[code];
        const message = `[${code}] ${messageFn(options?.data)}`;
        super(message, { cause: options?.cause });
        this.name = new.target.name;
        this.method = options?.method;
        this.code = code;
        this.context = options?.context;
        this.type = options?.type;
        this.data = options.data;
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
const EMPTY = Symbol("EMPTY");
class VigorStatus {
    _base;
    _config;
    constructor(config, _base) {
        this._base = _base;
        this._config = { ...this._base, ...config };
    }
    getConfig() { return this._config; }
    getBase() { return this._base; }
    _next(config) { return new this.constructor({ ...this._config, ...config }, this._base); }
    _pipsub(config, fn, ctor) {
        return fn(new ctor(config)).getConfig();
    }
}
class VigorRetrySettings extends VigorStatus {
    constructor(config = {}) {
        super(config, {
            count: 5,
            limit: 10000,
            maxDelay: 10000,
            default: EMPTY
        });
    }
    count(num) { return this._next({ count: num }); }
    limit(num) { return this._next({ limit: num }); }
    maxDelay(num) { return this._next({ maxDelay: num }); }
    default(obj) { return this._next({ default: obj }); }
}
class VigorRetryBackoff extends VigorStatus {
    constructor(config = {}) {
        super(config, {
            initialDelay: 0,
            baseDelay: 1000,
            factor: 1.7,
            jitter: 1000
        });
    }
    initialDelay(num) { return this._next({ initialDelay: num }); }
    baseDelay(num) { return this._next({ baseDelay: num }); }
    factor(num) { return this._next({ factor: num }); }
    jitter(num) { return this._next({ jitter: num }); }
    static randomJitter(num) { return Math.random() * num; }
}
class VigorRetryInterceptors extends VigorStatus {
    constructor(config = {}) {
        super(config, {
            before: [],
            after: [],
            onError: [],
            onRetry: [],
            retryIf: []
        });
    }
    before(...funcs) { return this._next({ ...this._config, before: [...this._config.before, ...funcs.flat()] }); }
    after(...funcs) { return this._next({ ...this._config, after: [...this._config.after, ...funcs.flat()] }); }
    onError(...funcs) { return this._next({ ...this._config, onError: [...this._config.onError, ...funcs.flat()] }); }
    onRetry(...funcs) { return this._next({ ...this._config, onRetry: [...this._config.onRetry, ...funcs.flat()] }); }
    retryIf(...funcs) { return this._next({ ...this._config, retryIf: [...this._config.retryIf, ...funcs.flat()] }); }
}
class VigorRetry extends VigorStatus {
    constructor(config = {}) {
        super(config, {
            target: null,
            setting: new VigorRetrySettings().getBase(),
            backoff: new VigorRetryBackoff().getBase(),
            interceptors: new VigorRetryInterceptors().getBase(),
            controller: config.controller || new AbortController()
        });
    }
    _transfer(config) { return new VigorRetry({ ...this._config, ...config }); }
    _calculateDelay(initialDelay, baseDelay, factor, attempt, jitter, maxDelay) {
        return Math.max(0, Math.min(maxDelay, initialDelay + baseDelay * Math.pow(factor, attempt) + VigorRetryBackoff.randomJitter(jitter)));
    }
    createController() { return this._config.controller = new AbortController(); }
    target(func) { return this._transfer({ target: func }); }
    setting(func) {
        return this._next({ setting: this._pipsub(this._config.setting, func, VigorRetrySettings) });
    }
    backoff(func) {
        return this._next({ backoff: this._pipsub(this._config.backoff, func, VigorRetryBackoff) });
    }
    interceptors(func) {
        return this._next({ interceptors: this._pipsub(this._config.interceptors, func, VigorRetryInterceptors) });
    }
    async request() {
        const config = this._config;
        let ctx = {
            target: config.target,
            setting: { ...config.setting },
            interceptors: {
                before: [...config.interceptors.before],
                after: [...config.interceptors.after],
                onError: [...config.interceptors.onError],
                onRetry: [...config.interceptors.onRetry],
                retryIf: [...config.interceptors.retryIf],
            },
            backoff: { ...config.backoff },
            controller: config.controller,
            runtime: {
                result: EMPTY,
                controller: null,
                attempt: 0,
                aborted: false,
                signal: null,
                delay: 0,
                retry: false,
            }
        };
        const throwError = (error) => { throw error; };
        const normalizeError = (obj) => {
            if (obj instanceof Error) {
                throw obj;
            }
            throw new Error(String(obj));
        };
        try {
            while (ctx.runtime.attempt < ctx.setting.count) {
                ctx.runtime.controller = new AbortController();
                let listener;
                let timerId;
                const setAttempt = (attempt) => ctx.runtime.attempt = attempt;
                const abort = (error) => { if (!ctx.runtime.aborted) {
                    ctx.runtime.controller?.abort(error);
                } };
                try {
                    ctx.runtime.signal = AbortSignal.any([
                        ctx.controller.signal,
                        ctx.runtime.controller.signal
                    ]);
                    ctx.runtime.abortPromise = new Promise((_, reject) => {
                        if (ctx.runtime.signal.aborted)
                            reject(ctx.runtime.signal.reason);
                        listener = () => {
                            ctx.runtime.aborted = true;
                            reject(ctx.runtime.signal.reason);
                        };
                        ctx.runtime.signal.addEventListener("abort", listener, { once: true });
                        timerId = setTimeout(() => {
                            if (ctx.runtime.aborted)
                                return;
                            abort(new VigorRetryError("TIMEOUT", {
                                method: "request",
                                type: "timeout",
                                data: {
                                    limit: ctx.setting.limit,
                                    attempt: ctx.runtime.attempt
                                }
                            }));
                        }, ctx.setting.limit);
                    });
                    for (const func of ctx.interceptors.before) {
                        await func(ctx, { setAttempt, throwError, abort });
                        if (ctx.runtime.signal.aborted)
                            normalizeError(ctx.runtime.signal.reason);
                    }
                    ctx.runtime.result = await Promise.race([
                        ctx.target(ctx, { abort, signal: ctx.runtime.signal }),
                        ctx.runtime.abortPromise
                    ]);
                    const setResult = (result) => ctx.runtime.result = result;
                    for (const func of ctx.interceptors.after) {
                        await func(ctx, { setAttempt, setResult, throwError });
                        if (ctx.runtime.signal.aborted)
                            normalizeError(ctx.runtime.signal.reason);
                    }
                    return ctx.runtime.result;
                }
                catch (error) {
                    if (ctx.runtime.aborted)
                        normalizeError(ctx.runtime.signal.reason);
                    ctx.runtime.retry = true;
                    ctx.runtime.error = error;
                    const proceedRetry = () => ctx.runtime.retry = true;
                    const cancelRetry = (error) => { ctx.runtime.error = error; return (ctx.runtime.retry = false); };
                    for (const func of ctx.interceptors.retryIf) {
                        await func(ctx, { throwError, proceedRetry, cancelRetry });
                    }
                    if (!ctx.runtime.retry) {
                        throw ctx.runtime.error;
                    }
                    const { initialDelay, baseDelay, factor, jitter } = ctx.backoff;
                    ctx.runtime.delay = this._calculateDelay(initialDelay, baseDelay, factor, ctx.runtime.attempt, jitter, ctx.setting.maxDelay);
                    const setDelay = (delay) => ctx.runtime.delay = delay;
                    for (const func of ctx.interceptors.onRetry) {
                        await func(ctx, { setAttempt, throwError, setDelay });
                    }
                    await new Promise((resolve, reject) => {
                        const timer = setTimeout(resolve, ctx.runtime.delay);
                        const abortHandler = () => {
                            clearTimeout(timer);
                            reject(ctx.controller.signal.reason);
                        };
                        if (ctx.controller.signal.aborted)
                            return abortHandler();
                        ctx.controller.signal.addEventListener("abort", abortHandler, { once: true });
                    });
                }
                finally {
                    clearTimeout(timerId);
                    if (listener)
                        ctx.runtime.signal.removeEventListener("abort", listener);
                }
                ctx.runtime.attempt++;
            }
            throw new VigorRetryError("EXHAUSTED", {
                method: "request",
                type: "retry",
                data: {
                    maxAttempts: ctx.setting.count,
                }
            });
        }
        catch (error) {
            ctx.runtime.error = error;
            let overrided = false;
            const setResult = (result) => { overrided = true; return (ctx.runtime.result = result); };
            for (const func of ctx.interceptors.onError) {
                await func(ctx, { setResult, throwError });
            }
            if (overrided && ctx.runtime.result !== EMPTY)
                return ctx.runtime.result;
            if (ctx.setting.default !== EMPTY)
                return ctx.setting.default;
            throw error;
        }
    }
}
class VigorParse extends VigorStatus {
    constructor(config = {}) {
        super(config, {
            original: false
        });
    }
    static stategy = [
        { key: /text/, parse: (res) => res.text(), type: "text" },
        { key: /json/, parse: (res) => res.json(), type: "json" },
        { key: /multipart\/form-data/, parse: (res) => res.formData(), type: "formData" },
        { key: /octet-stream/, parse: (res) => res.arrayBuffer(), type: "arrayBuffer" },
        { key: /(image|video|audio|pdf)/, parse: (res) => res.blob(), type: "blob" },
    ];
    static supported = this.stategy.map(i => i.type);
    _transfer(config) { return new VigorParse({ ...this._config, ...config }); }
    target(res) { return this._next({ target: res }); }
    original(bool) { return this._transfer({ ...this._config, original: bool }); }
    type(type) { return this._transfer({ ...this._config, result: undefined, type }); }
    async request() {
        const config = this._config;
        if (!(config.target instanceof Response)) {
            throw new VigorParseError("TARGET_MISSING", {
                method: "request",
                type: "args_missing",
                data: undefined
            });
        }
        if (config.original) {
            return config.target;
        }
        const contentType = config.target.headers.get("Content-Type") || "";
        let strategy;
        try {
            if (config.type) {
                strategy = { type: config.type };
                const parser = config.target[config.type];
                if (!parser || typeof parser !== 'function')
                    throw new VigorParseError("PARSE_FAILED", {
                        method: "request",
                        type: "parse_failed",
                        data: {
                            expected: strategy?.type ?? "unknown"
                        }
                    });
                return await parser();
            }
            strategy = VigorParse.stategy.find(i => i.key.test(contentType)) ?? VigorParse.stategy[0];
            return await strategy.parse(config.target);
        }
        catch (error) {
            if (error instanceof VigorParseError)
                throw error;
            throw new VigorParseError("PARSE_FAILED", {
                method: "request",
                type: "parse_failed",
                data: {
                    expected: strategy?.type ?? "unknown"
                }
            });
        }
    }
}
class VigorFetchSettings extends VigorStatus {
    constructor(config = {}) {
        super(config, {
            origin: "",
            path: [],
            query: {},
            unretry: [400, 401, 403, 404, 405, 413, 422],
            retryHeaders: ["retry-after", "ratelimit-reset", "x-ratelimit-reset", "x-retry-after", "x-amz-retry-after", "chrome-proxy-next-link"],
            default: EMPTY
        });
    }
    origin(str) { return this._next({ origin: str }); }
    path(...strs) { return this._next({ path: [...this._config.path, ...strs.flat()] }); }
    query(obj) { return this._next({ query: { ...this._config.query, ...obj } }); }
    unretry(...numbers) { return this._next({ unretry: numbers.flat() }); }
    retryHeaders(...strs) { return this._next({ retryHeaders: [...this._config.retryHeaders, ...strs.flat()] }); }
    method(str) { return this._next({ method: str }); }
    headers(obj) { return this._next({ headers: obj }); }
    body(obj) { return this._next({ body: obj }); }
    options(obj) { return this._next({ options: obj }); }
    default(obj) { return this._next({ default: obj }); }
}
class VigorFetchInterceptors extends VigorStatus {
    constructor(config = {}) {
        super(config, {
            before: [],
            after: [],
            onError: [],
            result: []
        });
    }
    before(...funcs) { return this._next({ before: [...this.getConfig().before, ...funcs.flat()] }); }
    after(...funcs) { return this._next({ after: [...this.getConfig().after, ...funcs.flat()] }); }
    onError(...funcs) { return this._next({ onError: [...this.getConfig().onError, ...funcs.flat()] }); }
    result(...funcs) { return this._next({ result: [...this.getConfig().result, ...funcs.flat()] }); }
}
class VigorFetch extends VigorStatus {
    constructor(config = {}) {
        super(config, {
            setting: new VigorFetchSettings().getBase(),
            retryConfig: new VigorRetry().getBase(),
            parseConfig: new VigorParse().getBase(),
            interceptors: new VigorFetchInterceptors().getBase(),
        });
    }
    origin(str) { return this._next({ setting: { ...this._config.setting, origin: str } }); }
    path(...strs) { return this._next({ setting: { ...this._config.setting, path: [...this._config.setting.path, ...strs.flat()] } }); }
    query(obj) { return this._next({ setting: { ...this._config.setting, query: { ...this._config.setting.query, ...obj } } }); }
    method(str) { return this._next({ setting: { ...this._config.setting, method: str } }); }
    headers(obj) { return this._next({ setting: { ...this._config.setting, headers: obj } }); }
    body(obj) { return this._next({ setting: { ...this._config.setting, body: obj } }); }
    options(obj) { return this._next({ setting: { ...this._config.setting, options: obj } }); }
    setting(func) {
        return this._next({ setting: this._pipsub(this._config.setting, func, VigorFetchSettings) });
    }
    interceptors(func) {
        return this._next({ interceptors: this._pipsub(this._config.interceptors, func, VigorFetchInterceptors) });
    }
    retryConfig(func) {
        return this._next({ retryConfig: this._pipsub(this._config.retryConfig, func, VigorRetry) });
    }
    parseConfig(func) {
        return this._next({ parseConfig: this._pipsub(this._config.parseConfig, func, VigorParse) });
    }
    buildUrl(origin, path, query) {
        if (!origin)
            throw new VigorFetchError("INVALID_URL", {
                method: "buildUrl",
                data: {
                    received: origin
                }
            });
        const url = new URL(origin);
        const segments = [
            url.pathname,
            ...path
        ]
            .flat()
            .filter(Boolean)
            .flatMap(p => p.split('/'))
            .filter(Boolean);
        url.pathname = '/' + segments.join('/');
        const params = new URLSearchParams(url.search);
        for (const [k, v] of Object.entries(query ?? {})) {
            if (v == null)
                continue;
            if (Array.isArray(v)) {
                v.forEach(i => params.append(k, String(i)));
            }
            else {
                params.set(k, String(v));
            }
        }
        url.search = params.toString();
        return url.toString();
    }
    async request() {
        const config = this._config;
        let ctx = {
            setting: { ...config.setting },
            retryConfig: {
                ...config.retryConfig,
                interceptors: {
                    before: [...config.retryConfig.interceptors.before],
                    after: [...config.retryConfig.interceptors.after],
                    onError: [...config.retryConfig.interceptors.onError],
                    onRetry: [...config.retryConfig.interceptors.onRetry],
                    retryIf: [...config.retryConfig.interceptors.retryIf],
                }
            },
            parseConfig: {
                ...config.parseConfig
            },
            interceptors: {
                before: [...config.interceptors.before],
                after: [...config.interceptors.after],
                onError: [...config.interceptors.onError],
                result: [...config.interceptors.result]
            },
            runtime: {
                result: EMPTY
            }
        };
        const throwError = (error) => { throw error; };
        try {
            ctx.runtime.unretrySet = new Set(ctx.setting.unretry);
            if (!/^(https?|data|blob|file|about):\/\//.test(ctx.setting.origin))
                throw new VigorFetchError("INVALID_PROTOCOL", {
                    method: "request",
                    data: {
                        expected: ["http", "https", "data", "blob", "file", "about"],
                        received: ctx.setting.origin
                    }
                });
            ctx.runtime.url = this.buildUrl(config.setting.origin, config.setting.path, config.setting.query);
            const isJson = Array.isArray(ctx.setting.body) || (!!ctx.setting.body && Object.getPrototypeOf(ctx.setting.body) === Object.prototype);
            ctx.runtime.baseOptions = {
                method: ctx.setting.method || (ctx.setting.body ? "POST" : "GET"),
                headers: { ...(isJson && { "Content-Type": "application/json" }), ...ctx.setting.headers },
                ...(ctx.setting.body && { body: isJson ? JSON.stringify(ctx.setting.body) : ctx.setting.body }),
                ...ctx.setting.options,
                signal: null
            };
            const target = async (ctx2, { signal }) => {
                ctx.runtime.options = {
                    ...ctx.runtime.baseOptions,
                    signal
                };
                const response = await fetch(ctx.runtime.url, ctx.runtime.options);
                return response;
            };
            const checkOk = async (ctx2, { throwError }) => {
                const result = ctx2.runtime.result;
                if (!result.ok)
                    return throwError?.(new VigorFetchError("FETCH_ERROR", {
                        method: "request",
                        type: "fetch_error",
                        data: {
                            status: result.status,
                            statusText: result.statusText,
                            url: result.url
                        }
                    }));
            };
            const handleBlacklist = (ctx2, { cancelRetry }) => {
                const result = ctx2.runtime.result;
                if (!result?.status || ctx.runtime.unretrySet.has(result.status))
                    cancelRetry?.();
            };
            const handle429 = (ctx2, { setDelay }) => {
                const result = ctx2.runtime.result;
                if (result?.status === 429) {
                    let rHeader = null;
                    ctx.setting.retryHeaders.some(h => (rHeader = result.headers.get(h)));
                    if (rHeader) {
                        setDelay?.(isNaN(Number(rHeader)) ? new Date(rHeader).getTime() - Date.now() : Number(rHeader) * 1000);
                    }
                }
            };
            ctx.retryConfig.target = target;
            ctx.retryConfig.interceptors.after.unshift(checkOk);
            ctx.retryConfig.interceptors.retryIf.unshift(handleBlacklist);
            ctx.retryConfig.interceptors.onRetry.unshift(handle429);
            ctx.runtime.retryEngine = new VigorRetry(ctx.retryConfig);
            ctx.runtime.parseEngine = new VigorParse(ctx.parseConfig);
            const setOptions = (obj) => ctx.runtime.baseOptions = obj;
            for (const func of ctx.interceptors.before) {
                await func(ctx, { setOptions, throwError });
            }
            ctx.runtime.response = await ctx.runtime.retryEngine.request();
            for (const func of ctx.interceptors.after) {
                await func(ctx, { throwError });
            }
            ctx.runtime.result = await ctx.runtime.parseEngine?.target(ctx.runtime.response).request();
            const setResult = (result) => ctx.runtime.result = result;
            for (const func of ctx.interceptors.result) {
                await func(ctx, { setResult, throwError });
            }
            return ctx.runtime.result;
        }
        catch (error) {
            ctx.runtime.error = error;
            let overrided = false;
            const setResult = (result) => { overrided = true; return (ctx.runtime.result = result); };
            for (const func of ctx.interceptors.onError) {
                await func(ctx, { setResult, throwError });
            }
            if (overrided && ctx.runtime.result !== EMPTY)
                return ctx.runtime.result;
            if (ctx.setting.default !== EMPTY)
                return ctx.setting.default;
            throw error;
        }
    }
}
class VigorAllSettings extends VigorStatus {
    constructor(config = {}) {
        super(config, {
            concurrency: 5,
            jitter: 1000,
            onlySuccess: false
        });
    }
    concurrency(num) { return this._next({ concurrency: num }); }
    jitter(num) { return this._next({ jitter: num }); }
    onlySuccess(bool) { return this._next({ onlySuccess: bool }); }
}
class VigorAllInterceptors extends VigorStatus {
    constructor(config = {}) {
        super(config, {
            before: [],
            after: [],
            onError: [],
            result: []
        });
    }
    before(...funcs) { return this._next({ before: [...this.getConfig().before, ...funcs.flat()] }); }
    after(...funcs) { return this._next({ after: [...this.getConfig().after, ...funcs.flat()] }); }
    onError(...funcs) { return this._next({ onError: [...this.getConfig().onError, ...funcs.flat()] }); }
    result(...funcs) { return this._next({ result: [...this.getConfig().result, ...funcs.flat()] }); }
}
class VigorAll extends VigorStatus {
    constructor(config = {}) {
        super(config, {
            target: [],
            setting: new VigorAllSettings().getBase(),
            interceptors: new VigorAllInterceptors().getBase()
        });
    }
    _transfer(config) {
        return new VigorAll({
            ...this._config,
            ...config
        });
    }
    target(...funcs) {
        return this._transfer({
            target: funcs
        });
    }
    setting(func) {
        return this._next({
            setting: this._pipsub(this._config.setting, func, VigorAllSettings)
        });
    }
    interceptors(func) {
        return this._next({
            interceptors: this._pipsub(this._config.interceptors, func, VigorAllInterceptors)
        });
    }
    async request() {
        const config = this._config;
        let ctx = {
            setting: { ...config.setting },
            target: [...config.target],
            interceptors: {
                before: [...config.interceptors.before],
                after: [...config.interceptors.after],
                onError: [...config.interceptors.onError],
                result: [...config.interceptors.result],
            },
            runtime: {
                tasks: [],
                result: [],
            }
        };
        if (ctx.target.length == 0)
            throw new VigorAllError("TARGET_MISSING", {
                method: "request",
                data: undefined
            });
        let active = 0;
        const queue = [];
        const runTask = async (task) => {
            await new Promise(resolve => {
                if (active < config.setting.concurrency) {
                    active++;
                    resolve();
                }
                else {
                    queue.push(() => {
                        active++;
                        resolve();
                    });
                }
            });
            const throwError = (error) => { throw error; };
            let ctxTask = {
                target: task,
                runtime: {
                    result: EMPTY,
                    error: null,
                    jitter: VigorRetryBackoff.randomJitter(config.setting.jitter)
                }
            };
            try {
                await new Promise(resolve => setTimeout(resolve, ctxTask.runtime.jitter));
                for (const func of config.interceptors.before) {
                    await func(ctxTask, { throwError });
                }
                ctxTask.runtime.result = await task(ctxTask, {});
                const setResult = (result) => ctxTask.runtime.result = result;
                for (const func of config.interceptors.after) {
                    await func(ctxTask, { setResult, throwError });
                }
                if (ctxTask.runtime.result === EMPTY) {
                    throw new Error("Result not set");
                }
                return ctxTask.runtime.result;
            }
            catch (error) {
                ctxTask.runtime.error = error;
                let overrided = false;
                const setResult = (result) => {
                    overrided = true;
                    return (ctxTask.runtime.result = result);
                };
                for (const func of config.interceptors.onError) {
                    await func(ctxTask, { setResult, throwError });
                }
                if (overrided && ctxTask.runtime.result !== EMPTY)
                    return ctxTask.runtime.result;
                throw ctxTask.runtime.error;
            }
            finally {
                active--;
                const next = queue.shift();
                if (next)
                    next();
            }
        };
        ctx.runtime.tasks = ctx.target.map(task => runTask(task));
        const settled = await Promise.allSettled(ctx.runtime.tasks);
        const isFailed = Symbol("FAILED");
        ctx.runtime.result = settled.map((res, idx) => {
            if (res.status === "fulfilled")
                return res.value;
            if (ctx.setting.onlySuccess)
                return isFailed;
            return new VigorAllError("REQUEST_FAILED", {
                method: "request",
                data: {
                    index: idx,
                    error: res.reason
                }
            });
        }).filter(i => i !== isFailed);
        const setResult = (result) => ctx.runtime.result = result;
        const throwError = (error) => { throw error; };
        for (const func of config.interceptors.result) {
            await func(ctx, { setResult, throwError });
        }
        return ctx.runtime.result;
    }
}
class Vigor {
    registry;
    constructor(config) {
        const defaultRegistry = {
            VigorRetry: {
                main: () => new VigorRetry(),
                error: VigorRetryError,
                setting: VigorRetrySettings,
                interceptors: VigorRetryInterceptors,
                backoff: VigorRetryBackoff,
            },
            VigorFetch: {
                main: () => new VigorFetch(),
                error: VigorFetchError,
                setting: VigorFetchSettings,
                interceptors: VigorFetchInterceptors,
            },
            VigorAll: {
                main: () => new VigorAll(),
                error: VigorAllError,
                setting: VigorAllSettings,
                interceptors: VigorAllInterceptors,
            },
            VigorParse: {
                main: () => new VigorParse(),
                error: VigorParseError,
            }
        };
        this.registry = config?.registry ?? defaultRegistry;
    }
    fetch(origin) {
        return this.registry.VigorFetch.main().origin(origin);
    }
    all(...args) {
        const flatTasks = args.flat();
        return this.registry.VigorAll
            .main()
            .target(...flatTasks);
    }
    parse(response) {
        return this.registry.VigorParse.main().target(response);
    }
    retry(fn) {
        return this.registry.VigorRetry.main().target(fn);
    }
    use(plugin, options) {
        const nextRegistry = {
            ...this.registry,
            VigorFetch: {
                ...this.registry.VigorFetch
            },
            VigorRetry: {
                ...this.registry.VigorRetry
            },
            VigorAll: {
                ...this.registry.VigorAll
            },
            VigorParse: {
                ...this.registry.VigorParse
            }
        };
        plugin(nextRegistry, options);
        return new Vigor({
            registry: nextRegistry
        });
    }
}
const vigor = new Vigor();

export { Vigor, VigorAll, VigorAllError, VigorAllInterceptors, VigorAllSettings, VigorFetch, VigorFetchError, VigorFetchInterceptors, VigorFetchSettings, VigorParse, VigorParseError, VigorRetry, VigorRetryBackoff, VigorRetryError, VigorRetryInterceptors, VigorRetrySettings, vigor as default, vigor };
