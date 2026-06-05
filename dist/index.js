'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const VigorErrorMessageFuncs = {
    INVALID_TARGET: ({ expected, received }) => `Invalid Task: ${typeof received} (expected: ${expected.join(', ')})`,
    EXHAUSTED: ({ maxAttempts }) => `Retry exhausted, (max ${maxAttempts})`,
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
    _createTimelineHandler(timeline) {
        return (action, content) => {
            timeline.push({
                action: action,
                content: content,
                time: Date.now()
            });
        };
    }
    _createInterceptorHandler(ctx, addTimeline) {
        return async (interceptorType, api) => {
            const interceptorsConfig = ctx["stats"]["interceptors"];
            const interceptors = interceptorsConfig[interceptorType];
            addTimeline("INTERCEPTOR_LOOP_STARTED", {
                interceptorType: interceptorType,
                interceptors,
            });
            const startTime = performance.now();
            for (const func of interceptors) {
                const scopedApi = api(interceptorType, func);
                await func(ctx, scopedApi);
            }
            const endTime = performance.now();
            addTimeline("INTERCEPTOR_LOOP_ENDED", {
                interceptorType: interceptorType,
                interceptors,
                took: endTime - startTime
            });
        };
    }
    target(func) { return this._next({ target: func }); }
    settings(func) {
        if (func instanceof VigorRetrySettings) {
            return this._next({ settings: func._getConfig() });
        }
        if (typeof func === 'function') {
            return this._next({ settings: func(new VigorRetrySettings(this._config.settings))._getConfig() });
        }
        return this._next({ settings: func });
    }
    interceptors(func) {
        if (func instanceof VigorRetryInterceptors) {
            return this._next({ interceptors: func._getConfig() });
        }
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
            flag: {
                broke: false,
                overwritten: false,
                restarted: false
            }
        };
        const addTimeline = this._createTimelineHandler(ctx.timeline);
        const handleInterceptor = this._createInterceptorHandler(ctx, addTimeline);
        addTimeline("PROCESS_HANDLING", {
            type: "REQUEST_START",
            data: {}
        });
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
                addTimeline("ATTEMPT_INCREASED", {
                    attempt: ctx.attempt
                });
                try {
                    addTimeline("PROCESS_HANDLING", {
                        type: "RETRY_START",
                        data: {}
                    });
                    const controller = new AbortController();
                    const timeoutController = new AbortController();
                    const signal = AbortSignal.any([controller.signal, timeoutController.signal, ...stats.abortSignals]);
                    await handleInterceptor("before", (interceptorType, func) => ({
                        abort: (error) => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "abort",
                                args: [error]
                            });
                            controller.abort(error);
                            throw error;
                        },
                        breakRetry: (error) => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "breakRetry",
                                args: [error]
                            });
                            ctx.flag.broke = true;
                            throw error;
                        },
                        throwError: (error) => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "throwError",
                                args: [error]
                            });
                            throw error;
                        }
                    }));
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
                        addTimeline("TARGET_REQUEST_STARTED", {
                            target: stats.target
                        });
                        const abort = (error) => {
                            addTimeline("TARGET_API_CALLED", {
                                target: stats.target,
                                method: "abort"
                            });
                            controller.abort(error);
                            throw error;
                        };
                        const started = performance.now();
                        ctx.result = await Promise.race([
                            stats.target(ctx, { abort, signal }),
                            new Promise((_, rej) => {
                                onAbort = () => rej(signal.reason);
                                signal.addEventListener("abort", onAbort);
                            })
                        ]);
                        const endTime = performance.now();
                        addTimeline("TARGET_REQUEST_ENDED", {
                            target: stats.target,
                            took: endTime - started
                        });
                    }
                    finally {
                        clearTimeout(timeoutTimer);
                        if (onAbort)
                            signal.removeEventListener("abort", onAbort);
                    }
                    await handleInterceptor("after", (interceptorType, func) => ({
                        setResult: (unknown) => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "setResult",
                                args: [unknown]
                            });
                            ctx.result = unknown;
                            return unknown;
                        },
                        throwError: (error) => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "throwError",
                                args: [error]
                            });
                            throw error;
                        },
                        breakRetry: (error) => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "breakRetry",
                                args: [error]
                            });
                            ctx.flag.broke = true;
                            throw error;
                        },
                    }));
                    await handleInterceptor("result", (interceptorType, func) => ({
                        setResult: (unknown) => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "setResult",
                                args: [unknown]
                            });
                            ctx.result = unknown;
                            return unknown;
                        },
                        throwError: (error) => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "throwError",
                                args: [error]
                            });
                            throw error;
                        },
                    }));
                    return ctx.result;
                }
                catch (error) {
                    ctx.error = error;
                    addTimeline("PROCESS_HANDLING", {
                        type: "RETRY_ERROR",
                        data: {
                            error
                        }
                    });
                    if (ctx.flag.broke)
                        throw error;
                    let proceed = true;
                    await handleInterceptor("retryIf", (interceptorType, func) => ({
                        proceedRetry: () => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "proceedRetry",
                                args: []
                            });
                            return proceed = true;
                        },
                        cancelRetry: () => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "cancelRetry",
                                args: []
                            });
                            return proceed = false;
                        }
                    }));
                    if (!proceed)
                        throw error;
                    ctx.delay = VigorDefault;
                    await handleInterceptor("onRetry", (interceptorType, func) => ({
                        throwError: (error) => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "throwError",
                                args: [error]
                            });
                            throw error;
                        },
                        setDelay: (number) => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "setDelay",
                                args: [number]
                            });
                            return ctx.delay = number;
                        },
                        setAttempt: (number) => {
                            addTimeline("INTERCEPTOR_API_CALLED", {
                                interceptorType,
                                interceptor: func,
                                method: "setAttempt",
                                args: [number]
                            });
                            return ctx.attempt = number;
                        }
                    }));
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
            addTimeline("PROCESS_HANDLING", {
                type: "REQUEST_ERROR",
                data: {
                    error
                }
            });
            await handleInterceptor("onError", (interceptorType, func) => ({
                setResult: (unknown) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "setResult",
                        args: [unknown]
                    });
                    ctx.result = unknown;
                    ctx.flag.overwritten = true;
                    return unknown;
                },
                throwError: (error) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "throwError",
                        args: [error]
                    });
                    throw error;
                },
                restart: () => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "restart",
                        args: []
                    });
                    ctx.flag.restarted = true;
                }
            }));
            if (ctx.flag.restarted) {
                return await this.request(stats, ctx.timeline);
            }
            if (ctx.flag.overwritten)
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
    _createTimelineHandler(timeline) {
        return (action, content) => {
            timeline.push({
                action: action,
                content: content,
                time: Date.now()
            });
        };
    }
    _createInterceptorHandler(ctx, addTimeline) {
        return async (interceptorType, api) => {
            const interceptorsConfig = ctx["stats"]["interceptors"];
            const interceptors = interceptorsConfig[interceptorType];
            addTimeline("INTERCEPTOR_LOOP_STARTED", {
                interceptorType: interceptorType,
                interceptors,
            });
            const startTime = performance.now();
            for (const func of interceptors) {
                const scopedApi = api(interceptorType, func);
                await func(ctx, scopedApi);
            }
            const endTime = performance.now();
            addTimeline("INTERCEPTOR_LOOP_ENDED", {
                interceptorType: interceptorType,
                interceptors,
                took: endTime - startTime
            });
        };
    }
    target(response) { return this._next({ target: response }); }
    settings(func) {
        if (func instanceof VigorParseSettings) {
            return this._next({ settings: func._getConfig() });
        }
        if (typeof func === 'function') {
            return this._next({ settings: func(new VigorParseSettings(this._config.settings))._getConfig() });
        }
        return this._next({ settings: func });
    }
    strategies(func) {
        if (func instanceof VigorParseStrategies) {
            return this._next({ strategies: func._getConfig() });
        }
        if (typeof func === 'function') {
            return this._next({ strategies: func(new VigorParseStrategies(this._config.strategies))._getConfig() });
        }
        return this._next({ strategies: func });
    }
    interceptors(func) {
        if (func instanceof VigorParseInterceptors) {
            return this._next({ interceptors: func._getConfig() });
        }
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
            flag: {
                overwritten: false
            }
        };
        const addTimeline = this._createTimelineHandler(ctx.timeline);
        const handleInterceptor = this._createInterceptorHandler(ctx, addTimeline);
        addTimeline("PROCESS_HANDLING", {
            type: "REQUEST_START",
            data: {}
        });
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
            await handleInterceptor("before", (interceptorType, func) => ({
                throwError: (error) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "throwError",
                        args: [error]
                    });
                    throw error;
                },
            }));
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
            await handleInterceptor("after", (interceptorType, func) => ({
                setResult: (unknown) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "setResult",
                        args: [unknown]
                    });
                    ctx.result = unknown;
                    return unknown;
                },
                throwError: (error) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "throwError",
                        args: [error]
                    });
                    throw error;
                },
            }));
            await handleInterceptor("result", (interceptorType, func) => ({
                setResult: (unknown) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "setResult",
                        args: [unknown]
                    });
                    ctx.result = unknown;
                    return unknown;
                },
                throwError: (error) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "throwError",
                        args: [error]
                    });
                    throw error;
                },
            }));
            return ctx.result;
        }
        catch (error) {
            ctx.error = error;
            addTimeline("PROCESS_HANDLING", {
                type: "REQUEST_ERROR",
                data: {
                    error
                }
            });
            await handleInterceptor("onError", (interceptorType, func) => ({
                setResult: (unknown) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "setResult",
                        args: [unknown]
                    });
                    ctx.result = unknown;
                    ctx.flag.overwritten = true;
                    return unknown;
                },
                throwError: (error) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "throwError",
                        args: [error]
                    });
                    throw error;
                },
            }));
            if (ctx.flag.overwritten)
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
    _createTimelineHandler(timeline) {
        return (action, content) => {
            timeline.push({
                action: action,
                content: content,
                time: Date.now()
            });
        };
    }
    _createInterceptorHandler(ctx, addTimeline) {
        return async (interceptorType, api) => {
            const interceptorsConfig = ctx["stats"]["interceptors"];
            const interceptors = interceptorsConfig[interceptorType];
            addTimeline("INTERCEPTOR_LOOP_STARTED", {
                interceptorType: interceptorType,
                interceptors,
            });
            const startTime = performance.now();
            for (const func of interceptors) {
                const scopedApi = api(interceptorType, func);
                await func(ctx, scopedApi);
            }
            const endTime = performance.now();
            addTimeline("INTERCEPTOR_LOOP_ENDED", {
                interceptorType: interceptorType,
                interceptors,
                took: endTime - startTime
            });
        };
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
    method(str) { return this._next({ method: str }); }
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
        if (func instanceof VigorFetchSettings) {
            return this._next({ settings: func._getConfig() });
        }
        if (typeof func === 'function') {
            return this._next({ settings: func(new VigorFetchSettings(this._config.settings))._getConfig() });
        }
        return this._next({ settings: func });
    }
    interceptors(func) {
        if (func instanceof VigorFetchInterceptors) {
            return this._next({ interceptors: func._getConfig() });
        }
        if (typeof func === 'function') {
            return this._next({ interceptors: func(new VigorFetchInterceptors(this._config.interceptors))._getConfig() });
        }
        return this._next({ interceptors: func });
    }
    retryConfig(func) {
        if (func instanceof VigorRetry) {
            return this._next({ retryConfig: func._getConfig() });
        }
        if (typeof func === 'function') {
            return this._next({ retryConfig: func(new VigorRetry(this._config.retryConfig))._getConfig() });
        }
        return this._next({ retryConfig: func });
    }
    parseConfig(func) {
        if (func instanceof VigorParse) {
            return this._next({ parseConfig: func._getConfig() });
        }
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
            flag: {
                overwritten: false,
                restarted: false
            }
        };
        const addTimeline = this._createTimelineHandler(ctx.timeline);
        const handleInterceptor = this._createInterceptorHandler(ctx, addTimeline);
        addTimeline("PROCESS_HANDLING", {
            type: "REQUEST_START",
            data: {}
        });
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
            addTimeline("BUILT_URL", {
                url: ctx.href
            });
            const { headers, body, ...others } = stats.options;
            const hasBody = body !== VigorDefault &&
                body !== undefined;
            const method = stats.method || (hasBody ? 'POST' : 'GET');
            ctx.options = {
                ...others,
                method: method,
                headers: {}
            };
            if (hasBody) {
                const normalized = this._normalizeOptions(body);
                if (normalized.body !== undefined) {
                    ctx.options.body = normalized.body;
                }
                Object.assign(ctx.options.headers, normalized.headers);
            }
            Object.assign(ctx.options.headers, headers);
            addTimeline("SET_OPTIONS", {
                options: ctx.options
            });
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
            stats.retryConfig.interceptors.after = [throwStatus, ...stats.retryConfig.interceptors.after];
            stats.retryConfig.interceptors.retryIf = [handleBlacklist, ...stats.retryConfig.interceptors.retryIf];
            stats.retryConfig.interceptors.onRetry = [handleRatelimit, ...stats.retryConfig.interceptors.onRetry];
            const retryEngine = new VigorRetry(stats.retryConfig)
                .target(fetchTask);
            const parseEngine = new VigorParse(stats.parseConfig);
            addTimeline("ENGINE_CREATED", {
                retryEngine,
                parseEngine
            });
            await handleInterceptor("before", (interceptorType, func) => ({
                throwError: (error) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "throwError",
                        args: [error]
                    });
                    throw error;
                },
                setOptions: (unknown) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "setOptions",
                        args: [unknown]
                    });
                    return ctx.options = unknown;
                },
                setHeaders: (unknown) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "setHeaders",
                        args: [unknown]
                    });
                    return ctx.options.headers = unknown;
                },
                setBody: (unknown) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "setBody",
                        args: [unknown]
                    });
                    return ctx.options.body = unknown;
                }
            }));
            addTimeline("RETRY_STARTED", {
                engine: retryEngine
            });
            const retryStart = performance.now();
            const retryTimeline = [];
            ctx.response = await retryEngine.request(undefined, retryTimeline);
            const retryEnd = performance.now();
            addTimeline("RETRY_ENDED", {
                engine: retryEngine,
                timeline: retryTimeline,
                took: retryEnd - retryStart,
                response: ctx.response
            });
            addTimeline("PARSE_STARTED", {
                engine: parseEngine
            });
            const parseStart = performance.now();
            const parseTimeline = [];
            ctx.result = await parseEngine.target(ctx.response).request(undefined, parseTimeline);
            const parseEnd = performance.now();
            addTimeline("PARSE_ENDED", {
                engine: parseEngine,
                timeline: parseTimeline,
                took: parseEnd - parseStart,
                result: ctx.result
            });
            await handleInterceptor("after", (interceptorType, func) => ({
                setResult: (unknown) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "setResult",
                        args: [unknown]
                    });
                    ctx.result = unknown;
                    return unknown;
                },
                throwError: (error) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "throwError",
                        args: [error]
                    });
                    throw error;
                },
            }));
            await handleInterceptor("result", (interceptorType, func) => ({
                setResult: (unknown) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "setResult",
                        args: [unknown]
                    });
                    ctx.result = unknown;
                    return unknown;
                },
                throwError: (error) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "throwError",
                        args: [error]
                    });
                    throw error;
                },
            }));
            return ctx.result;
        }
        catch (error) {
            ctx.error = error;
            addTimeline("PROCESS_HANDLING", {
                type: "REQUEST_ERROR",
                data: {
                    error
                }
            });
            await handleInterceptor("onError", (interceptorType, func) => ({
                setResult: (unknown) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "setResult",
                        args: [unknown]
                    });
                    ctx.result = unknown;
                    ctx.flag.overwritten = true;
                    return unknown;
                },
                throwError: (error) => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "throwError",
                        args: [error]
                    });
                    throw error;
                },
                restart: () => {
                    addTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "restart",
                        args: []
                    });
                    ctx.flag.restarted = true;
                }
            }));
            if (ctx.flag.restarted) {
                return await this.request(stats, ctx.timeline);
            }
            if (ctx.flag.overwritten)
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
    _createTimelineHandler(timeline) {
        return (action, content) => {
            timeline.push({
                action: action,
                content: content,
                time: Date.now()
            });
        };
    }
    _createInterceptorHandler(ctx, addTimeline) {
        return async (interceptorType, api) => {
            const interceptorsConfig = ctx["stats"]["interceptors"];
            const interceptors = interceptorsConfig[interceptorType];
            addTimeline("INTERCEPTOR_LOOP_STARTED", {
                interceptorType: interceptorType,
                interceptors,
            });
            const startTime = performance.now();
            for (const func of interceptors) {
                const scopedApi = api(interceptorType, func);
                await func(ctx, scopedApi);
            }
            const endTime = performance.now();
            addTimeline("INTERCEPTOR_LOOP_ENDED", {
                interceptorType: interceptorType,
                interceptors,
                took: endTime - startTime
            });
        };
    }
    _createEachTimelineHandler(timeline) {
        return (action, content) => {
            timeline.push({
                action: action,
                content: content,
                time: Date.now()
            });
        };
    }
    _createEachInterceptorHandler(ctx, addEachTimeline) {
        return async (interceptorType, api) => {
            const interceptorsConfig = ctx["stats"]["interceptors"];
            const interceptors = interceptorsConfig[interceptorType];
            addEachTimeline("INTERCEPTOR_LOOP_STARTED", {
                interceptorType: interceptorType,
                interceptors,
            });
            const startTime = performance.now();
            for (const func of interceptors) {
                const scopedApi = api(interceptorType, func);
                await func(ctx, scopedApi);
            }
            const endTime = performance.now();
            addEachTimeline("INTERCEPTOR_LOOP_ENDED", {
                interceptorType: interceptorType,
                interceptors,
                took: endTime - startTime
            });
        };
    }
    target(...funcs) { return this._next({ target: funcs.flat() }); }
    settings(func) {
        if (func instanceof VigorAllSettings) {
            return this._next({ settings: func._getConfig() });
        }
        if (typeof func === 'function') {
            return this._next({ settings: func(new VigorAllSettings(this._config.settings))._getConfig() });
        }
        return this._next({ settings: func });
    }
    interceptors(func) {
        if (func instanceof VigorAllInterceptors) {
            return this._next({ interceptors: func._getConfig() });
        }
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
            semaphore,
            flag: {
                overwritten: false
            }
        };
        const addEachTimeline = this._createEachTimelineHandler(ctx.timeline);
        const handleEachInterceptor = this._createEachInterceptorHandler(ctx, addEachTimeline);
        addEachTimeline("PROCESS_HANDLING", {
            type: "TASK_START",
            data: {}
        });
        try {
            try {
                await semaphore.acquire();
                addEachTimeline("TASK_ACQUIRED", {
                    target: ctx.target
                });
                await handleEachInterceptor("before", (interceptorType, func) => ({
                    throwError: (error) => {
                        addEachTimeline("INTERCEPTOR_API_CALLED", {
                            interceptorType,
                            interceptor: func,
                            method: "throwError",
                            args: [error]
                        });
                        throw error;
                    }
                }));
                addEachTimeline("TASK_STARTED", {
                    target: ctx.target
                });
                const startTime = performance.now();
                ctx.result = await ctx.target(ctx);
                const endTime = performance.now();
                addEachTimeline("TASK_ENDED", {
                    target: ctx.target,
                    took: endTime - startTime
                });
                await handleEachInterceptor("after", (interceptorType, func) => ({
                    setResult: (unknown) => {
                        addEachTimeline("INTERCEPTOR_API_CALLED", {
                            interceptorType,
                            interceptor: func,
                            method: "setResult",
                            args: [unknown]
                        });
                        ctx.result = unknown;
                        return unknown;
                    },
                    throwError: (error) => {
                        addEachTimeline("INTERCEPTOR_API_CALLED", {
                            interceptorType,
                            interceptor: func,
                            method: "throwError",
                            args: [error]
                        });
                        throw error;
                    }
                }));
            }
            finally {
                semaphore.release();
                addEachTimeline("TASK_RELEASED", {
                    target: ctx.target
                });
            }
        }
        catch (error) {
            ctx.error = error;
            addEachTimeline("PROCESS_HANDLING", {
                type: "TASK_ERROR",
                data: {
                    error
                }
            });
            await handleEachInterceptor("onError", (interceptorType, func) => ({
                setResult: (unknown) => {
                    addEachTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "setResult",
                        args: [unknown]
                    });
                    ctx.result = unknown;
                    ctx.flag.overwritten = true;
                    return unknown;
                },
                throwError: (error) => {
                    addEachTimeline("INTERCEPTOR_API_CALLED", {
                        interceptorType,
                        interceptor: func,
                        method: "throwError",
                        args: [error]
                    });
                    throw error;
                },
            }));
            if (ctx.flag.overwritten)
                return ctx.result;
            throw error;
        }
        return ctx.result;
    }
    async request(config, timeline = []) {
        const stats = this._mergeConfig(this._config, config);
        let ctx = {
            result: VigorDefault,
            timeline,
            stats,
            queue: new Set(),
            active: 0
        };
        const addTimeline = this._createTimelineHandler(ctx.timeline);
        const handleInterceptor = this._createInterceptorHandler(ctx, addTimeline);
        addTimeline("PROCESS_HANDLING", {
            type: "REQUEST_START",
            data: {}
        });
        if (stats.target.length === 0)
            throw new VigorAllError("EMPTY_TARGET", {
                method: "request",
                data: {}
            });
        const waitQueue = [];
        const acquire = () => {
            if (ctx.active < stats.settings.concurrency) {
                ctx.active++;
                return Promise.resolve();
            }
            return new Promise((res) => waitQueue.push(() => { ctx.active++; res(); }));
        };
        const release = () => {
            ctx.active--;
            if (waitQueue.length > 0) {
                const next = waitQueue.shift();
                if (next)
                    next();
            }
        };
        for (const task of stats.target) {
            let promise;
            promise = this.runTask(task, { stats, root: ctx }, { acquire, release })
                .then(res => ({ success: true, value: res }))
                .catch(err => ({ success: false, value: err }))
                .finally(() => ctx.queue.delete(promise));
            ctx.queue.add(promise);
        }
        addTimeline("QUEUE_REQUEST_STARTED", {
            queue: ctx.queue
        });
        const startTime = performance.now();
        const raw = await Promise.all(ctx.queue);
        const endTime = performance.now();
        addTimeline("QUEUE_REQUEST_ENDED", {
            queue: ctx.queue,
            took: endTime - startTime
        });
        ctx.result = stats.settings.onlySuccess
            ? raw.filter(r => r.success).map(r => r.value)
            : raw.map(r => r.value);
        await handleInterceptor("result", (interceptorType, func) => ({
            setResult: (unknown) => {
                addTimeline("INTERCEPTOR_API_CALLED", {
                    interceptorType,
                    interceptor: func,
                    method: "setResult",
                    args: [unknown]
                });
                ctx.result = unknown;
                return unknown;
            },
            throwError: (error) => {
                addTimeline("INTERCEPTOR_API_CALLED", {
                    interceptorType,
                    interceptor: func,
                    method: "throwError",
                    args: [error]
                });
                throw error;
            },
        }));
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
