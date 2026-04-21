class VigorError extends Error {
    timestamp;
    method;
    cause;
    context;
    type;
    data;
    constructor(message, options) {
        super(message, { cause: options?.cause });
        this.name = new.target.name;
        this.timestamp = new Date();
        if (options?.method !== undefined)
            this.method = options.method;
        if (options?.context !== undefined)
            this.context = options.context;
        if (options?.type !== undefined)
            this.type = options.type;
        if (options?.data !== undefined)
            this.data = options.data;
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace?.(this, new.target);
    }
}
class VigorRetryError extends VigorError {
    constructor(message, options) {
        super(message, options);
    }
}
class VigorParseError extends VigorError {
    constructor(message, options) {
        super(message, options);
    }
}
class VigorFetchError extends VigorError {
    constructor(message, options) {
        super(message, options);
    }
}
class VigorAllError extends VigorError {
    constructor(message, options) {
        super(message, options);
    }
}
class VigorStatus {
    _config;
    _ctor;
    _errorCtor;
    constructor(_config, _ctor, _errorCtor) {
        this._config = _config;
        this._ctor = _ctor;
        this._errorCtor = _errorCtor;
    }
    _create(config) { return this._ctor(config); }
    _next(config) { return this._create({ ...this._config, ...config }); }
    getConfig() { return this._config; }
    _pipeSub(value, Ctor, fn, errorKey) {
        const ErrorCtor = this._errorCtor?.();
        if (typeof fn !== "function" && ErrorCtor) {
            throw new ErrorCtor("ctor expects function", {
                method: errorKey,
                type: "invalid_input",
                data: { expected: "function", received: fn }
            });
        }
        return fn(new Ctor(value)).getConfig();
    }
}
class VigorRetrySettings extends VigorStatus {
    _base;
    constructor(config) {
        const base = {
            count: 5,
            limit: 10000,
            maxDelay: 10000,
        };
        super({ ...base, ...config }, (c) => new VigorRetrySettings(c));
        this._base = base;
    }
    getBase() { return this._base; }
    count(num) { return this._next({ count: num }); }
    limit(num) { return this._next({ limit: num }); }
    maxDelay(num) { return this._next({ maxDelay: num }); }
    default(obj) { return this._next({ default: obj }); }
}
class VigorRetryBackoff extends VigorStatus {
    _base;
    constructor(config) {
        const base = {
            initialDelay: 0,
            baseDelay: 1000,
            factor: 1.7,
            jitter: 1000
        };
        super({ ...base, ...config }, (c) => new VigorRetryBackoff(c));
        this._base = base;
    }
    getBase() { return this._base; }
    initialDelay(num) { return this._next({ initialDelay: num }); }
    baseDelay(num) { return this._next({ baseDelay: num }); }
    factor(num) { return this._next({ factor: num }); }
    jitter(num) { return this._next({ jitter: num }); }
}
class VigorRetryInterceptors extends VigorStatus {
    _base;
    constructor(config) {
        const base = {
            before: [],
            after: [],
            onError: [],
            onRetry: [],
            retryIf: []
        };
        super({ ...base, ...config }, (c) => new VigorRetryInterceptors(c));
        this._base = base;
    }
    getBase() { return this._base; }
    before(...funcs) { return this._next({ before: [...this.getConfig().before, ...funcs.flat()] }); }
    after(...funcs) { return this._next({ after: [...this.getConfig().after, ...funcs.flat()] }); }
    onError(...funcs) { return this._next({ onError: [...this.getConfig().onError, ...funcs.flat()] }); }
    onRetry(...funcs) { return this._next({ onRetry: [...this.getConfig().onRetry, ...funcs.flat()] }); }
    retryIf(...funcs) { return this._next({ retryIf: [...this.getConfig().retryIf, ...funcs.flat()] }); }
}
class VigorRetry extends VigorStatus {
    _base;
    _controller = new AbortController();
    constructor(config) {
        const base = {
            target: null,
            setting: new VigorRetrySettings().getBase(),
            backoff: new VigorRetryBackoff().getBase(),
            interceptors: new VigorRetryInterceptors().getBase()
        };
        super({ ...base, ...config }, (c) => new VigorRetry(c), () => VigorRetryError);
        this._base = base;
    }
    getBase() { return this._base; }
    target(func) { return new VigorRetry({ ...this._config, target: func, setting: this._config.setting, interceptors: this._config.interceptors }); }
    createController() { const controller = new AbortController(); this._controller = controller; return (error) => controller.abort(error); }
    setting(func) {
        return this._next({
            setting: this._pipeSub(this._config.setting, VigorRetrySettings, func, "setting")
        });
    }
    backoff(func) {
        return this._next({
            backoff: this._pipeSub(this._config.backoff, VigorRetryBackoff, func, "backoff")
        });
    }
    interceptors(func) {
        return this._next({
            interceptors: this._pipeSub(this._config.interceptors, VigorRetryInterceptors, func, "interceptors")
        });
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
            runtime: {
                result: null,
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
                ctx.runtime.attempt++;
                ctx.runtime.controller = new AbortController();
                let listener;
                let timerId;
                const setAttempt = (attempt) => ctx.runtime.attempt = attempt;
                const abort = (error) => { if (!ctx.runtime.aborted) {
                    ctx.runtime.controller?.abort(error);
                } };
                try {
                    ctx.runtime.signal = AbortSignal.any([
                        this._controller.signal,
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
                            abort(new VigorRetryError(`timeouted after ${ctx.setting.limit}`, { method: "request", type: "timeout", data: { limit: ctx.setting.limit, attempt: ctx.runtime.attempt } }));
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
                    ctx.runtime.delay = Math.min(ctx.setting.maxDelay, Math.max(0, ctx.backoff.initialDelay + ctx.backoff.baseDelay * Math.pow(ctx.backoff.factor, ctx.runtime.attempt - 1))) + calculateJitter(ctx.backoff.jitter);
                    const setDelay = (delay) => ctx.runtime.delay = delay;
                    for (const func of ctx.interceptors.onRetry) {
                        await func(ctx, { setAttempt, throwError, setDelay });
                    }
                    await new Promise((resolve, reject) => {
                        const timer = setTimeout(resolve, ctx.runtime.delay);
                        const abortHandler = () => {
                            clearTimeout(timer);
                            reject(this._controller.signal.reason);
                        };
                        if (this._controller.signal.aborted)
                            return abortHandler();
                        this._controller.signal.addEventListener("abort", abortHandler, { once: true });
                    });
                }
                finally {
                    clearTimeout(timerId);
                    if (listener)
                        ctx.runtime.signal.removeEventListener("abort", listener);
                }
            }
            throw new VigorRetryError(`Maximum retry attempts (${ctx.setting.count}) reached. Task failed or timed out.`, { method: "request", type: "exhausted", data: { limit: ctx.setting.limit, attempt: ctx.runtime.attempt, maxAttempts: ctx.setting.count } });
        }
        catch (error) {
            ctx.runtime.error = error;
            let overrided = false;
            const setResult = (result) => { overrided = true; return (ctx.runtime.result = result); };
            for (const func of ctx.interceptors.onError) {
                await func(ctx, { setResult, throwError });
            }
            if (overrided && ctx.runtime.result !== undefined)
                return ctx.runtime.result;
            if (ctx.setting.default !== undefined)
                return ctx.setting.default;
            throw error;
        }
    }
}
const basic = { key: /text/, parse: (res) => res.text(), type: "text" };
const parser = [
    { key: /json/, parse: (res) => res.json(), type: "json" },
    { key: /multipart\/form-data/, parse: (res) => res.formData(), type: "formData" },
    { key: /octet-stream/, parse: (res) => res.arrayBuffer(), type: "arrayBuffer" },
    { key: /(image|video|audio|pdf)/, parse: (res) => res.blob(), type: "blob" },
    basic
];
const supported = parser.map(i => i.type);
class VigorParse extends VigorStatus {
    _base;
    constructor(config) {
        const base = {
            original: false
        };
        super({ ...base, ...config }, (c) => new VigorParse(c));
        this._base = base;
    }
    getBase() { return this._base; }
    target(response) { return this._next({ target: response }); }
    original(bool) { return this._next({ original: bool }); }
    type(str) { return this._next({ type: str }); }
    async request() {
        const config = this._config;
        if (!config.target)
            throw new VigorParseError("target is required", { method: "request", type: "invalid_target", data: {
                    expected: "Response",
                    received: config.target,
                } });
        if (config.original)
            return config.target;
        const contentType = config.target.headers.get("Content-Type") || "";
        let strategy;
        try {
            if (config.type) {
                strategy = { type: config.type };
                const parser = config.target[config.type];
                if (!parser || typeof parser !== 'function')
                    throw new VigorParseError(`failed to parse: '${strategy?.type ?? "unknown"}'`, { method: "request", type: "invalid_type", data: {
                            expected: config.type,
                            supported: supported,
                            response: config.target,
                            headers: contentType,
                        } });
                return await parser();
            }
            strategy = parser.find(i => i.key.test(contentType)) ?? basic;
            return await strategy.parse(config.target);
        }
        catch (error) {
            if (error instanceof VigorParseError)
                throw error;
            throw new VigorParseError(`failed to parse: '${strategy?.type ?? "unknown"}'`, { method: "request", type: "parse_failed", data: {
                    expected: strategy?.type ?? "unknown",
                    supported: supported,
                    response: config.target,
                    headers: contentType,
                    error
                } });
        }
    }
}
class VigorFetchSettings extends VigorStatus {
    _base;
    constructor(config) {
        const base = {
            origin: "",
            path: [],
            query: {},
            unretry: [400, 401, 403, 404, 405, 413, 422],
            retryHeaders: ["retry-after", "ratelimit-reset", "x-ratelimit-reset", "x-retry-after", "x-amz-retry-after", "chrome-proxy-next-link"],
        };
        super({ ...base, ...config }, (c) => new VigorFetchSettings(c));
        this._base = base;
    }
    getBase() { return this._base; }
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
    _base;
    constructor(config) {
        const base = {
            before: [],
            after: [],
            onError: [],
            result: []
        };
        super({ ...base, ...config }, (c) => new VigorFetchInterceptors(c));
        this._base = base;
    }
    getBase() { return this._base; }
    before(...funcs) { return this._next({ before: [...this.getConfig().before, ...funcs.flat()] }); }
    after(...funcs) { return this._next({ after: [...this.getConfig().after, ...funcs.flat()] }); }
    onError(...funcs) { return this._next({ onError: [...this.getConfig().onError, ...funcs.flat()] }); }
    result(...funcs) { return this._next({ result: [...this.getConfig().result, ...funcs.flat()] }); }
}
class VigorFetch extends VigorStatus {
    _base;
    constructor(config) {
        const base = {
            setting: new VigorFetchSettings().getBase(),
            retryConfig: new VigorRetry().getBase(),
            parseConfig: new VigorParse().getBase(),
            interceptors: new VigorFetchInterceptors().getBase(),
        };
        super({ ...base, ...config }, (c) => new VigorFetch(c), () => VigorRetryError);
        this._base = base;
    }
    getBase() { return this._base; }
    origin(str) { return this._next({ setting: { ...this._config.setting, origin: str } }); }
    path(...strs) { return this._next({ setting: { ...this._config.setting, path: [...this._config.setting.path, ...strs.flat()] } }); }
    query(obj) { return this._next({ setting: { ...this._config.setting, query: { ...this._config.setting.query, ...obj } } }); }
    method(str) { return this._next({ setting: { ...this._config.setting, method: str } }); }
    headers(obj) { return this._next({ setting: { ...this._config.setting, headers: obj } }); }
    body(obj) { return this._next({ setting: { ...this._config.setting, body: obj } }); }
    options(obj) { return this._next({ setting: { ...this._config.setting, options: obj } }); }
    setting(func) {
        return this._next({
            setting: this._pipeSub(this._config.setting, VigorFetchSettings, func, "setting")
        });
    }
    retryConfig(func) {
        return this._next({
            retryConfig: this._pipeSub(this._config.retryConfig, VigorRetry, func, "retryConfig")
        });
    }
    parseConfig(func) {
        return this._next({
            parseConfig: this._pipeSub(this._config.parseConfig, VigorParse, func, "parseConfig")
        });
    }
    buildUrl(origin, path, query) {
        if (!origin)
            throw new VigorFetchError("buildUrl expects 'origin'", {
                type: "invalid_input", method: "buildUrl", data: {
                    expected: "string", received: origin
                }
            });
        try {
            const url = new URL(origin);
            if (path && path.length > 0) {
                const cleanPath = path
                    .filter(p => p && typeof p === 'string')
                    .map(p => p.replace(/^\/+|\/+$/g, ''))
                    .join('/');
                if (cleanPath) {
                    const base = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
                    url.pathname = base + cleanPath;
                }
            }
            if (query && typeof query === 'object') {
                Object.entries(query).forEach(([key, value]) => {
                    if (value === null || value === undefined)
                        return;
                    if (Array.isArray(value)) {
                        value.forEach(v => url.searchParams.append(key, String(v)));
                    }
                    else {
                        url.searchParams.set(key, String(value));
                    }
                });
            }
            return url.toString();
        }
        catch (e) {
            throw new VigorFetchError(`Invalid URL origin: ${origin}`, {
                type: "invalid_url", method: "buildUrl", data: { error: e }
            });
        }
    }
    interceptors(func) {
        return this._next({
            interceptors: this._pipeSub(this._config.interceptors, VigorFetchInterceptors, func, "interceptors")
        });
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
            runtime: {}
        };
        const throwError = (error) => { throw error; };
        try {
            ctx.runtime.unretrySet = new Set(ctx.setting.unretry);
            if (!/^(https?|data|blob|file|about):\/\//.test(ctx.setting.origin))
                throw new VigorFetchError(`Invalid Protocol`, { type: "Invalid Protocol", method: "request", data: {
                        expected: ["http", "https", "data", "blob", "file", "about"], received: ctx.setting.origin
                    } });
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
                    return throwError?.(new VigorFetchError(`HTTP Error: ${result.status} ${result.statusText}`, {
                        method: "request", type: "fetch_error",
                        data: { status: result.status, statusText: result.statusText, url: result.url }
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
            if (overrided && ctx.runtime.result !== undefined)
                return ctx.runtime.result;
            if (ctx.setting.default !== undefined)
                return ctx.setting.default;
            throw error;
        }
    }
}
class VigorAllSettings extends VigorStatus {
    _base;
    constructor(config) {
        const base = {
            concurrency: 5,
            jitter: 1000
        };
        super({ ...base, ...config }, (c) => new VigorAllSettings(c));
        this._base = base;
    }
    getBase() { return this._base; }
    concurrency(num) { return this._next({ concurrency: num }); }
    jitter(num) { return this._next({ jitter: num }); }
}
class VigorAllInterceptors extends VigorStatus {
    _base;
    constructor(config) {
        const base = {
            before: [],
            after: [],
            onError: [],
            result: []
        };
        super({ ...base, ...config }, (c) => new VigorAllInterceptors(c));
        this._base = base;
    }
    getBase() { return this._base; }
    before(...funcs) { return this._next({ before: [...this.getConfig().before, ...funcs.flat()] }); }
    after(...funcs) { return this._next({ after: [...this.getConfig().after, ...funcs.flat()] }); }
    onError(...funcs) { return this._next({ onError: [...this.getConfig().onError, ...funcs.flat()] }); }
    result(...funcs) { return this._next({ result: [...this.getConfig().result, ...funcs.flat()] }); }
}
class VigorAll extends VigorStatus {
    _base;
    constructor(config) {
        const base = {
            target: [],
            setting: new VigorAllSettings().getBase(),
            interceptors: new VigorAllInterceptors().getBase()
        };
        super({ ...base, ...config }, (c) => new VigorAll(c), () => VigorAllError);
        this._base = base;
    }
    getBase() { return this._base; }
    target(...funcs) { return this._next({ target: [...this._config.target, ...funcs.flat()] }); }
    setting(func) {
        return this._next({
            setting: this._pipeSub(this._config.setting, VigorAllSettings, func, "setting")
        });
    }
    interceptors(func) {
        return this._next({
            interceptors: this._pipeSub(this._config.interceptors, VigorAllInterceptors, func, "interceptors")
        });
    }
    async request() {
        const config = this._config;
        let ctx = {
            target: [...config.target],
            setting: { ...config.setting },
            interceptors: {
                before: [...config.interceptors.before],
                after: [...config.interceptors.after],
                onError: [...config.interceptors.onError],
                result: [...config.interceptors.result]
            },
            runtime: {
                tasks: [],
                result: []
            }
        };
        if (ctx.target?.length == 0)
            throw new VigorFetchError("request expects 'target'", {
                type: "invalid_input", method: "request", data: {
                    expected: "string", received: ctx.target
                }
            });
        let active = 0;
        const queue = [];
        const runTask = async (task) => {
            await new Promise(resolve => {
                if (active < ctx.setting.concurrency) {
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
            try {
                await new Promise(resolve => setTimeout(resolve, calculateJitter(ctx.setting.jitter)));
                let res;
                for (const func of ctx.interceptors.before) {
                    await func(ctx, { throwError });
                }
                res = await task(ctx, {});
                const setResult = (result) => res = result;
                for (const func of ctx.interceptors.after) {
                    await func(ctx, { setResult, throwError });
                }
                return res;
            }
            catch (error) {
                let res;
                let overrided = false;
                const setResult = (result) => { overrided = true; return (res = result); };
                for (const func of ctx.interceptors.onError) {
                    await func(ctx, { setResult, throwError });
                }
                if (overrided && res !== undefined)
                    return res;
                throw error;
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
        ctx.runtime.result = settled.map(i => {
            if (i.status === "fulfilled")
                return i.value;
            return new VigorAllError(`this request failed`, {
                method: "request", type: "request_failed", data: {
                    error: i.reason
                }
            });
        });
        const setResult = (result) => ctx.runtime.result = result;
        const throwError = (error) => { throw error; };
        for (const func of ctx.interceptors.result) {
            await func(ctx, { setResult, throwError });
        }
        return ctx.runtime.result;
    }
}
function calculateJitter(jitter) {
    return jitter * (Math.random() * 2 - 1);
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
    all(tasks) {
        return this.registry.VigorAll.main().target(tasks.flat());
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
