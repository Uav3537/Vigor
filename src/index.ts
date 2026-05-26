const VigorErrorMessageFuncs = {
    INVALID_TARGET: ({expected, received}: {expected: Array<string>, received: unknown}) => `Invalid Task: ${typeof received} (expected: ${expected.join(', ')})`,
    EXHAUSTED: ({ maxAttempts }: { maxAttempts: number }) => `Retry exhausted: max ${maxAttempts})`,
    TIMED_OUT: ({ limit, attempt }: {limit: number, attempt: number}) => `Timeout: exceeded ${limit}ms (attempt: ${attempt})`,
    INVALID_CONTENT_TYPE: ({expected, received, response}: {expected: Array<string>, received: unknown, response: Response}) => `Invalid Content Type Header: ${typeof received} (expected: ${expected.join(', ')})`,
    PARSER_NOT_FOUND: ({expected, received, response}: {expected: Array<string>, received: unknown, response: Response}) => `Parser Not Found For Header: ${typeof received} (expected: ${expected.join(', ')})`,
    PARSER_ALL_FAILED: ({tried, response}: {tried: Array<unknown>, response: Response}) => `All Parser Failed, Tried: ${tried.join(', ')}`,
    INVALID_PROTOCOL: ({expected, received}: {expected: Array<string>, received: unknown}) => `Invalid Protocol: ${typeof received} (expected: ${expected.join(', ')})`,
    INVALID_BODY: ({expected, received}: {expected: Array<string>, received: unknown}) => `Invalid Body: ${typeof received} (expected: ${expected.join(', ')})`,
    FETCH_FAILED: ({status, response, url, headers, body, statusText}: {status: number, response: Response, url: string, headers: unknown, body: unknown, statusText: string}) => `Fetch Failed: ${status}`,
    EMPTY_TARGET: ({}) => `Empty Body`
}

type VigorErrorCodes = keyof typeof VigorErrorMessageFuncs

type VigorErrorDatas<C extends VigorErrorCodes> =
    Parameters<typeof VigorErrorMessageFuncs[C]> extends [infer A]
        ? A
        : undefined;

type VigorErrorOptions<C extends VigorErrorCodes, S, T> = {
    cause?: unknown;
    data?: VigorErrorDatas<C>;

    method: string
    stats?: S,
    context?: T
}

abstract class VigorError<C extends VigorErrorCodes, S, T> extends Error {
    public readonly timestamp: Date = new Date();
    public readonly cause?: unknown;
    public readonly code: C;
    public readonly data: VigorErrorDatas<C>|undefined

    public readonly method: string
    public readonly stats: S|undefined
    public readonly context: T|undefined

    constructor(
        code: C,
        options: VigorErrorOptions<C, S, T>
    ) {
        const messageFn = VigorErrorMessageFuncs[code] as (
            arg: VigorErrorDatas<C>
        ) => string;
        const message = `[${code}] ${messageFn(options?.data as VigorErrorDatas<C>)}`
        super(message, { cause: options?.cause });
        this.name = new.target.name
        this.code = code
        this.cause = options.cause
        this.data = options.data;

        this.method = options.method
        this.stats = options.stats
        this.context = options.context

        Object.setPrototypeOf(this, new.target.prototype);
        (Error as any).captureStackTrace?.(this, new.target);
    }
}

class VigorRetryError<C extends "INVALID_TARGET" | "EXHAUSTED" | "TIMED_OUT"> extends VigorError<C, VigorRetryConfig, VigorRetryContext> {
    constructor(code: C, options: VigorErrorOptions<C, VigorRetryConfig, VigorRetryContext>) {
        super(code, options)
    }
}

class VigorParseError<C extends "INVALID_CONTENT_TYPE" | "PARSER_NOT_FOUND" | "PARSER_ALL_FAILED" | "INVALID_TARGET"> extends VigorError<C, VigorParseConfig, VigorParseContext> {
    constructor(code: C, options: VigorErrorOptions<C, VigorParseConfig, VigorParseContext>) {
        super(code, options)
    }
}

class VigorFetchError<C extends "INVALID_PROTOCOL" | "INVALID_BODY" | "FETCH_FAILED"> extends VigorError<C, VigorFetchConfig, VigorFetchContext> {
    constructor(code: C, options: VigorErrorOptions<C, VigorFetchConfig, VigorFetchContext>) {
        super(code, options)
    }
}

class VigorAllError<C extends "EMPTY_TARGET"> extends VigorError<C, VigorAllConfig, VigorAllContext|VigorAllEachContext> {
    constructor(code: C, options: VigorErrorOptions<C, VigorAllConfig, VigorAllContext|VigorAllEachContext>) {
        super(code, options)
    }
}

abstract class VigorStatus<C, Self> {
    protected readonly _config: C
    constructor(
        config: Partial<C> = {},
        protected readonly _base: C,
        protected readonly ctor: (config: C) => Self
    ) {
        this._config = {..._base, ...config}
    }
    protected _mergeConfig<C>(source: any, target: C | Partial<C> | undefined): C {
        const isPlainObject = (val: any): boolean => 
            val !== null && typeof val === 'object' && Object.getPrototypeOf(val) === Object.prototype;

        if (target === undefined || target === null) {
            return source;
        }
        if (isPlainObject(source) && isPlainObject(target)) {
            const result = { ...source };
            Object.keys(target).forEach((key) => {
                result[key] = this._mergeConfig(result[key], (target as any)[key]);
            });
            return result as C;
        }
        if (Array.isArray(source) && Array.isArray(target)) {
            return [...source, ...target] as any;
        }
        return target as C;
    }
    protected _next(config: Partial<C>): Self { return this.ctor(this._mergeConfig(this._config , config)) }
    public _getConfig(): C { return this._config }
    public _getBase(): C { return this._base }
}

const VigorDefault = Symbol("DEFAULT") as symbol & {
    __brand__: "Vigor_Default"
}

type VigorDefaultType = typeof VigorDefault
type VigorIncludeSpread<T> = Array<T|Array<T>>


type VigorRetrySettingsConfig = {
    default: unknown
    timeout: number,
    attempt: number
    jitter: number
}

class VigorRetrySettings extends VigorStatus<VigorRetrySettingsConfig, VigorRetrySettings> {
    constructor(config?: Partial<VigorRetrySettingsConfig>) {
        const base = {
            default: VigorDefault,
            timeout: 20 * 1000,
            attempt: 5,
            jitter: 1000
        }
        super(config, base, (c) => new VigorRetrySettings(c))
    }
    
    public default(unk: VigorRetrySettingsConfig["default"]) { return this._next({default: unk}) }
    public timeout(num: VigorRetrySettingsConfig["timeout"]) { return this._next({timeout: num}) }
    public attempt(num: VigorRetrySettingsConfig["attempt"]) { return this._next({attempt: num}) }
    public jitter(num: VigorRetrySettingsConfig["jitter"]) { return this._next({jitter: num}) }
}

type VigorRetryInterceptorsConfig = {
    before: Array<VigorRetryInterceptorsFunctions["before"]>
    after: Array<VigorRetryInterceptorsFunctions["after"]>
    result: Array<VigorRetryInterceptorsFunctions["result"]>
    retryIf: Array<VigorRetryInterceptorsFunctions["retryIf"]>
    onRetry: Array<VigorRetryInterceptorsFunctions["onRetry"]>
    onError: Array<VigorRetryInterceptorsFunctions["onError"]>
}

class VigorRetryInterceptors extends VigorStatus<VigorRetryInterceptorsConfig, VigorRetryInterceptors> {
    constructor(config?: Partial<VigorRetryInterceptorsConfig>) {
        const base = {
            before: [],
            after: [],
            result: [],
            retryIf: [],
            onRetry: [],
            onError: []
        }
        super(config, base, (c) => new VigorRetryInterceptors(c))
    }

    public before(...funcs: VigorIncludeSpread<VigorRetryInterceptorsConfig["before"][number]>) { return this._next({before: funcs.flat()}) }
    public after(...funcs: VigorIncludeSpread<VigorRetryInterceptorsConfig["after"][number]>) { return this._next({after: funcs.flat()}) }
    public result(...funcs: VigorIncludeSpread<VigorRetryInterceptorsConfig["result"][number]>) { return this._next({result: funcs.flat()}) }
    public retryIf(...funcs: VigorIncludeSpread<VigorRetryInterceptorsConfig["retryIf"][number]>) { return this._next({retryIf: funcs.flat()}) }
    public onRetry(...funcs: VigorIncludeSpread<VigorRetryInterceptorsConfig["onRetry"][number]>) { return this._next({onRetry: funcs.flat()}) }
    public onError(...funcs: VigorIncludeSpread<VigorRetryInterceptorsConfig["onError"][number]>) { return this._next({onError: funcs.flat()}) }
}

type VigorRetryAlgorithmsConstantConfig = {
    interval: number
}

class VigorRetryAlgorithmsConstant extends VigorStatus<VigorRetryAlgorithmsConstantConfig, VigorRetryAlgorithmsConstant> {
    constructor(config?: Partial<VigorRetryAlgorithmsConstantConfig>) {
        const base = {
            interval: 2000
        }
        super(config, base, (c) => new VigorRetryAlgorithmsConstant(c))
    }

    public interval(num: VigorRetryAlgorithmsConstantConfig["interval"]) { return this._next({interval: num}) }
    /** @internal */
    public _calculateDelay(attempt: number) {
        return this._config.interval
    }
}

type VigorRetryAlgorithmsLinearConfig = {
    initial: number
    increment: number
    minDelay: number
    maxDelay: number
}

class VigorRetryAlgorithmsLinear extends VigorStatus<VigorRetryAlgorithmsLinearConfig, VigorRetryAlgorithmsLinear> {
    constructor(config?: Partial<VigorRetryAlgorithmsLinearConfig>) {
        const base = {
            initial: 1000,
            increment: 1000,
            minDelay: 500,
            maxDelay: 20 * 1000
        }
        super(config, base, (c) => new VigorRetryAlgorithmsLinear(c))
    }

    public initial(num: VigorRetryAlgorithmsLinearConfig["initial"]) { return this._next({initial: num}) }
    public increment(num: VigorRetryAlgorithmsLinearConfig["increment"]) { return this._next({increment: num}) }
    public minDelay(num: VigorRetryAlgorithmsLinearConfig["minDelay"]) { return this._next({minDelay: num}) }
    public maxDelay(num: VigorRetryAlgorithmsLinearConfig["maxDelay"]) { return this._next({maxDelay: num}) }
    /** @internal */
    public _calculateDelay(attempt: number) {
        const {initial, increment, minDelay, maxDelay} = this._config
        return Math.max(minDelay, Math.min(maxDelay, initial + increment * attempt))
    }
}

type VigorRetryAlgorithmsBackoffConfig = {
    initial: number,
    multiplier: number
    unit: number
    minDelay: number
    maxDelay: number
}

class VigorRetryAlgorithmsBackoff extends VigorStatus<VigorRetryAlgorithmsBackoffConfig, VigorRetryAlgorithmsBackoff> {
    constructor(config?: Partial<VigorRetryAlgorithmsBackoffConfig>) {
        const base = {
            initial: 1000,
            multiplier: 1.7,
            unit: 1000,
            minDelay: 500,
            maxDelay: 20 * 1000
        }
        super(config, base, (c) => new VigorRetryAlgorithmsBackoff(c))
    }

    public initial(num: VigorRetryAlgorithmsBackoffConfig["initial"]) { return this._next({initial: num}) }
    public multiplier(num: VigorRetryAlgorithmsBackoffConfig["multiplier"]) { return this._next({multiplier: num}) }
    public unit(num: VigorRetryAlgorithmsBackoffConfig["unit"]) { return this._next({unit: num}) }
    public minDelay(num: VigorRetryAlgorithmsBackoffConfig["minDelay"]) { return this._next({minDelay: num}) }
    public maxDelay(num: VigorRetryAlgorithmsBackoffConfig["maxDelay"]) { return this._next({maxDelay: num}) }
    /** @internal */
    public _calculateDelay(attempt: number) {
        const {initial, multiplier, unit, minDelay, maxDelay} = this._config
        return Math.max(minDelay, Math.min(maxDelay, initial + unit * Math.pow(multiplier, attempt)))
    }
}

type VigorRetryAlgorithmsCustomConfig = {
    func: VigorRetryAlgorithmsConfig
    minDelay: number
    maxDelay: number
}

class VigorRetryAlgorithmsCustom extends VigorStatus<VigorRetryAlgorithmsCustomConfig, VigorRetryAlgorithmsCustom> {
    constructor(config?: Partial<VigorRetryAlgorithmsCustomConfig>) {
        const base = {
            func: (attempt: number) => attempt * 1000,
            minDelay: 500,
            maxDelay: 20 * 1000
        }
        super(config, base, (c) => new VigorRetryAlgorithmsCustom(c))
    }

    public func(num: VigorRetryAlgorithmsCustomConfig["func"]) { return this._next({func: num}) }
    /** @internal */
    public _calculateDelay(attempt: number) {
        const {func, minDelay, maxDelay} = this._config
        return Math.max(minDelay, Math.min(maxDelay, func(attempt)))
    }
}

type VigorRetryAlgorithmsConfig = (attempt: number) => number



type VigorRetryInterceptorsApi<R> = {
    setResult: (unk: R) => R
    throwError: <E extends Error>(err: E) => never
    breakRetry: <E extends Error>(err: E) => never
    proceedRetry: () => true
    cancelRetry: () => false
    setDelay: <D extends number>(num: D) => D
    setAttempt: <A extends number>(num: A) => A
    restart: () => void
    abort: <E extends Error>(err: E) => void
}

type VigorRetryInterceptorsFn<A extends keyof VigorRetryInterceptorsApi<R>, R = unknown> = (
    ctx: VigorRetryContext,
    api: Pick<VigorRetryInterceptorsApi<R>, A>
) => void|Promise<void>

type VigorRetryInterceptorsFunctions = {
    before: VigorRetryInterceptorsFn<"throwError" | "breakRetry" | "abort">
    after: VigorRetryInterceptorsFn<"setResult" | "throwError" | "breakRetry">
    result: VigorRetryInterceptorsFn<"setResult" | "throwError">
    retryIf: VigorRetryInterceptorsFn<"proceedRetry" | "cancelRetry">
    onRetry: VigorRetryInterceptorsFn<"throwError" | "setDelay" | "setAttempt">
    onError: VigorRetryInterceptorsFn<"setResult" | "throwError" | "restart">
}

type VigorRetryConfig = {
    target: (ctx: VigorRetryContext, {abort, signal}: {abort: VigorRetryInterceptorsApi<any>["abort"], signal: AbortSignal}) => unknown | Promise<unknown>
    settings: VigorRetrySettingsConfig
    interceptors: VigorRetryInterceptorsConfig
    algorithm: VigorRetryAlgorithmsConfig
    abortSignals: Array<AbortSignal>
}

type VigorRetryContext = {
    result: unknown
    error: unknown
    attempt: number
    delay: number
    controller: AbortController
    timeline: Array<{action: string, content?: unknown}>,
    stats: VigorRetryConfig
}

class VigorRetry extends VigorStatus<VigorRetryConfig, VigorRetry> {
    constructor(config?: Partial<VigorRetryConfig>) {
        const base = {
            target: VigorDefault as unknown as VigorRetryConfig["target"],
            settings: new VigorRetrySettings()._getBase(),
            interceptors: new VigorRetryInterceptors()._getBase(),
            algorithm: new VigorRetryAlgorithmsBackoff()._calculateDelay,
            abortSignals: []
        }
        super(config, base, (c) => new VigorRetry(c))
    }
    private RetryAlgorithms = {
        constant: (config?: Partial<VigorRetryAlgorithmsConstantConfig>) => new VigorRetryAlgorithmsConstant(config),
        linear: (config?: Partial<VigorRetryAlgorithmsLinearConfig>) => new VigorRetryAlgorithmsLinear(config),
        backoff: (config?: Partial<VigorRetryAlgorithmsBackoffConfig>) => new VigorRetryAlgorithmsBackoff(config),
        custom: (config?: Partial<VigorRetryAlgorithmsCustomConfig>) => new VigorRetryAlgorithmsCustom(config)
    }
    
    public target(func: VigorRetryConfig["target"]) { return this._next({target: func}) }
    public settings(func: ((s: VigorRetrySettings) => VigorRetrySettings) | VigorRetryConfig["settings"]) {
        if(typeof func === 'function') {
            return this._next({settings: func(new VigorRetrySettings(this._config.settings))._getConfig()})
        }
        return this._next({settings: func})
    }
    public interceptors(func: ((i: VigorRetryInterceptors) => VigorRetryInterceptors) | VigorRetryConfig["interceptors"]) {
        if(typeof func === 'function') {
            return this._next({interceptors: func(new VigorRetryInterceptors(this._config.interceptors))._getConfig()})
        }
        return this._next({interceptors: func})
    }
    public algorithms(func: (a: typeof this.RetryAlgorithms) => {_calculateDelay: VigorRetryConfig["algorithm"]}) {
        const instance = func(this.RetryAlgorithms)
        return this._next({algorithm: (attempt: number) => instance._calculateDelay(attempt)})
    }
    public abortSignals(...abortSignals: VigorIncludeSpread<AbortSignal>) {
        return this._next({abortSignals: abortSignals.flat()})
    }

    public async request<R>(config?: VigorRetryConfig, timeline: VigorRetryContext["timeline"] = []): Promise<R> {
        const stats: VigorRetryConfig = this._mergeConfig(this._config, config)
        let ctx: VigorRetryContext = {
            result: VigorDefault,
            error: VigorDefault,
            attempt: 0,
            delay: 0,
            controller: VigorDefault as unknown as VigorRetryContext["controller"],
            timeline: timeline,
            stats,
        }
        const throwError = <E extends Error>(error: E) => {
            ctx.timeline.push({action: "throwError called", content: error})
            throw error
        }
        try {
            if(typeof stats.target !== 'function') throw new VigorRetryError("INVALID_TARGET", {
                method: "request",
                data: {
                    expected: ["function"],
                    received: stats.target
                },
                stats: stats,
                context: ctx
            })
            
            while(ctx.attempt < stats.settings.attempt) {
                ctx.attempt++
                ctx.timeline.push({action: "increased attempt", content: ctx.attempt})

                let broke = false
                const breakRetry = <E extends Error>(error: E) => {
                    ctx.timeline.push({action: "breakRetry called", content: error})
                    broke = true
                    throw error
                }
                try {
                    ctx.timeline.push({action: "process request_once handling", content: ctx.attempt})
                    
                    const controller = new AbortController()
                    const timeoutController = new AbortController()
                    const signal = AbortSignal.any([controller.signal, timeoutController.signal, ...stats.abortSignals])

                    const abort = <E extends Error>(err: E) => controller.abort(err)
                    ctx.timeline.push({action: "interceptor handling: before", content: stats.interceptors.before})
                    for(const func of stats.interceptors.before) {
                        await func(ctx, {throwError, breakRetry, abort})
                    }

                    const timeoutTimer = setTimeout(() => {
                        clearTimeout(timeoutTimer)
                        timeoutController.abort(new VigorRetryError("TIMED_OUT", {
                            method: "request",
                            data: {
                                limit: stats.settings.timeout,
                                attempt: ctx.attempt
                            },
                        }))
                    }, stats.settings.timeout)
                    
                    signal.throwIfAborted()

                    let onAbort: ((reason?: unknown) => void) | undefined

                    try {
                        ctx.result = await Promise.race([
                            stats.target(ctx, {abort, signal}),
                            new Promise((_, rej) => {
                                onAbort = () => rej(signal.reason)
                                signal.addEventListener("abort", onAbort)
                            })
                        ])
                    }
                    finally {
                        clearTimeout(timeoutTimer)
                        if (onAbort) signal.removeEventListener("abort", onAbort);
                    }
                    
                    const setResult = <R>(unk: R): R => {
                        ctx.timeline.push({action: "setResult called", content: unk})
                        ctx.result = unk
                        return unk
                    }
                    ctx.timeline.push({action: "interceptor handling: after", content: stats.interceptors.after})
                    for(const func of stats.interceptors.after) {
                        await func(ctx, {setResult, throwError, breakRetry})
                    }
                    ctx.timeline.push({action: "interceptor handling: result", content: stats.interceptors.result})
                    for(const func of stats.interceptors.result) {
                        await func(ctx, {setResult, throwError})
                    }
                    return ctx.result as R
                }
                catch(error) {
                    ctx.error = error
                    ctx.timeline.push({action: "process error_once handling", content: error})
                    if(broke) throw error

                    let proceed = true
                    const proceedRetry = (): true => {
                        ctx.timeline.push({action: "proceedRetry called", content: true})
                        return proceed = true
                    }
                    const cancelRetry = (): false => {
                        ctx.timeline.push({action: "cancelRetry called", content: false})
                        return proceed = false
                    }

                    ctx.timeline.push({action: "interceptor handling: retryIf", content: stats.interceptors.result})
                    for(const func of stats.interceptors.retryIf) {
                        await func(ctx, {proceedRetry, cancelRetry})
                    }
                    if(!proceed) throw error

                    ctx.delay = VigorDefault as unknown as VigorRetryContext["delay"]

                    const setDelay = <D extends number>(num: D): D => {
                        ctx.timeline.push({action: "setDelay called", content: num})
                        return ctx.delay = num
                    }
                    const setAttempt = <A extends number>(num: A): A => {
                        ctx.timeline.push({action: "setAttempt called", content: num})
                        return ctx.attempt = num
                    }
                    
                    ctx.timeline.push({action: "interceptor handling: onRetry", content: stats.interceptors.onRetry})
                    for(const func of stats.interceptors.onRetry) {
                        await func(ctx, {throwError, setDelay, setAttempt})
                    }

                    if(typeof ctx.delay !== 'number') ctx.delay = stats.algorithm(ctx.attempt) + Math.random() * stats.settings.jitter
                    const delay = ctx.delay
                    await new Promise(r => setTimeout(r, delay))
                }
            }
            throw new VigorRetryError("EXHAUSTED", {
                method: "request",
                data: {
                    maxAttempts: stats.settings.attempt,
                },
                context: ctx
            })
        }
        catch(error) {
            ctx.error = error
            let overwritten = false
            const setResult = <R>(unk: R): R => {
                ctx.timeline.push({action: "setResult called", content: unk})
                ctx.result = unk
                overwritten = true
                return unk
            }
            let restarted = false
            const restart = () => {
                ctx.timeline.push({action: "restart called"})
                restarted = true
            }
            ctx.timeline.push({action: "interceptor handling: onError", content: stats.interceptors.onError})
            for(const func of stats.interceptors.onError) {
                await func(ctx, {setResult, throwError, restart})
            }
            if(restarted) {
                return await this.request<R>(stats, ctx.timeline)
            }
            if(overwritten) return ctx.result as R
            if(stats.settings.default !== VigorDefault) return stats.settings.default as R
            throw error
        }
    }
}

type VigorParseSettingsConfig = {
    raw: boolean
    default: unknown,
}

class VigorParseSettings extends VigorStatus<VigorParseSettingsConfig, VigorParseSettings> {
    constructor(config?: Partial<VigorParseSettingsConfig>) {
        const base = {
            raw: false,
            default: VigorDefault
        }
        super(config, base, (c) => new VigorParseSettings(c))
    }

    public original(bool: VigorParseSettingsConfig["raw"]) { return this._next({raw: bool}) }
    public default(unk: VigorParseSettingsConfig["default"]) { return this._next({default: unk}) }
}

type VigorParseStrategiesConfig = {
    funcs: Array<(response: Response) => Promise<any>>
}

class VigorParseStrategies extends VigorStatus<VigorParseStrategiesConfig, VigorParseStrategies> {
    constructor(config?: Partial<VigorParseStrategiesConfig>) {
        const base = {
            funcs: []
        }
        super(config, base, (c) => new VigorParseStrategies(c))
        this._config.funcs.push(this.ParseAutoAlgorithms.contentType)
    }

    private ParseAutoHeaders = [
        {header: "application/json", regExp: /application\/(.+\+)?json(.+\+)?/i, method: (res: Response) => res.json()},
        {header: "application/xml", regExp: /application\/(.+\+)?xml(.+\+)?/i, method: (res: Response) => res.text()},
        {header: "application/x-www-form-urlencoded", regExp: /application\/(.+\+)?x-www-form-urlencoded(.+\+)?/i, method: (res: Response) => res.formData()},
        {header: "application/octet-stream", regExp: /application\/(.+\+)?octet-stream(.+\+)?/i, method: (res: Response) => res.arrayBuffer()},

        {header: "image/*", regExp: /^image\/.+/i, method: (res: Response) => res.blob()},
        {header: "audio/*", regExp: /^audio\/.+/i, method: (res: Response) => res.blob()},
        {header: "video/*", regExp: /^video\/.+/i, method: (res: Response) => res.blob()},

        {header: "multipart/form-data", regExp: /multipart\/(.+\+)?form-data(.+\+)?/i, method: (res: Response) => res.formData()},

        {header: "text/*", regExp: /^text\/.+/i, method: (res: Response) => res.text()},
    ]

    private ParseAutoMethods = [
        {title: "json", method: (res: Response) => res.json()},
        {title: "formData", method: (res: Response) => res.formData()},
        {title: "text", method: (res: Response) => res.text()},
        {title: "blob", method: (res: Response) => res.blob()},
    ]
    
    private ParseAutoAlgorithms = {
        contentType: async(response: Response) => {
            const parsers = this.ParseAutoHeaders

            const contentTypeHeader = response.headers.get("content-type")
            if(!contentTypeHeader) throw new VigorParseError("INVALID_CONTENT_TYPE", {
                method: "ParseAutoAlgorithms.contentType",
                data: {
                    expected: ["string"],
                    received: contentTypeHeader,
                    response: response
                }
            })

            const toDo = parsers.find(parser => parser.regExp.test(contentTypeHeader))
            if(!toDo) throw new VigorParseError("PARSER_NOT_FOUND", {
                method: "ParseAutoAlgorithms.contentType",
                data: {
                    expected: parsers.map(parser => parser.header),
                    received: contentTypeHeader,
                    response: response
                }
            })
            return await toDo.method(response)
        },
        sniff: async(response: Response) => {
            const parsers = this.ParseAutoMethods

            for(const [i, parser] of parsers.entries()) {
                const cloned = (i === parsers.length - 1)
                    ? response
                    : response.clone()
                try {
                    const data = await parser.method(cloned)
                    return data
                }
                catch {}
            }
            throw new VigorParseError("PARSER_ALL_FAILED", {
                method: "ParseAutoAlgorithms.sniff",
                data: {
                    tried: parsers.map(parser => parser.title),
                    response: response
                }
            })
        }
    }

    public contentType() { return this._next({ funcs: [this.ParseAutoAlgorithms.contentType] }) }
    public sniff() { return this._next({ funcs: [this.ParseAutoAlgorithms.sniff] }) }
    public json() { return this._next({ funcs: [(res: Response) => res.json()] }) }
    public text() { return this._next({ funcs: [(res: Response) => res.text()] }) }
    public arrayBuffer() { return this._next({ funcs: [(res: Response) => res.arrayBuffer()] }) }
    public blob() { return this._next({ funcs: [(res: Response) => res.blob()] }) }
    public bytes() { return this._next({ funcs: [(res: Response) => res.arrayBuffer().then(r => new Uint8Array(r))] }) }
    public formData() { return this._next({ funcs: [(res: Response) => res.formData()] }) }
}

type VigorParseInterceptorsConfig = {
    before: Array<VigorParseInterceptorsFunctions["before"]>,
    after: Array<VigorParseInterceptorsFunctions["after"]>,
    result: Array<VigorParseInterceptorsFunctions["result"]>,
    onError: Array<VigorParseInterceptorsFunctions["onError"]>
}

class VigorParseInterceptors extends VigorStatus<VigorParseInterceptorsConfig, VigorParseInterceptors> {
    constructor(config?: Partial<VigorParseInterceptorsConfig>) {
        const base = {
            before: [],
            after: [],
            result: [],
            onError: []
        }
        super(config, base, (c) => new VigorParseInterceptors(c))
    }

    public before(...funcs: VigorIncludeSpread<VigorParseInterceptorsConfig["before"][number]>) { return this._next({before: funcs.flat()}) }
    public after(...funcs: VigorIncludeSpread<VigorParseInterceptorsConfig["after"][number]>) { return this._next({after: funcs.flat()}) }
    public result(...funcs: VigorIncludeSpread<VigorParseInterceptorsConfig["result"][number]>) { return this._next({result: funcs.flat()}) }
    public onError(...funcs: VigorIncludeSpread<VigorParseInterceptorsConfig["onError"][number]>) { return this._next({onError: funcs.flat()}) }
}

type VigorParseInterceptorsApi<R> = {
    setResult: (unk: R) => R
    throwError: <E extends Error>(err: E) => never
}

type VigorParseInterceptorsFn<A extends keyof VigorParseInterceptorsApi<R>, R = unknown> = (
    ctx: VigorParseContext,
    api: Pick<VigorParseInterceptorsApi<R>, A>
) => void|Promise<void>

type VigorParseInterceptorsFunctions = {
    before: VigorParseInterceptorsFn<"throwError">
    after: VigorParseInterceptorsFn<"setResult" | "throwError">
    result: VigorParseInterceptorsFn<"setResult" | "throwError">
    onError: VigorParseInterceptorsFn<"setResult" | "throwError">
}

type VigorParseConfig = {
    target: Response
    settings: VigorParseSettingsConfig
    strategies: VigorParseStrategiesConfig
    interceptors: VigorParseInterceptorsConfig
}

type VigorParseContext = {
    stats: VigorParseConfig
    timeline: Array<{action: string, content?: unknown}>,
    result: unknown,
    error: unknown
    response: Response
}

class VigorParse extends VigorStatus<VigorParseConfig, VigorParse> {
    constructor(config?: Partial<VigorParseConfig>) {
        const base = {
            target: VigorDefault as unknown as VigorParseConfig["target"],
            settings: new VigorParseSettings()._getBase(),
            strategies: new VigorParseStrategies()._getBase(),
            interceptors: new VigorParseInterceptors()._getBase()
        }
        super(config, base, (c) => new VigorParse(c))
    }
    public target(response: VigorParseConfig["target"]) { return this._next({target: response}) }
    public settings(func: ((i: VigorParseSettings) => VigorParseSettings) | VigorParseConfig["settings"]) {
        if(typeof func === 'function') {
            return this._next({settings: func(new VigorParseSettings(this._config.settings))._getConfig()})
        }
        return this._next({settings: func})
    }
    public strategies(func: ((i: VigorParseStrategies) => VigorParseStrategies) | VigorParseConfig["strategies"]) {
        if(typeof func === 'function') {
            return this._next({strategies: func(new VigorParseStrategies(this._config.strategies))._getConfig()})
        }
        return this._next({strategies: func})
    }
    public interceptors(func: ((i: VigorParseInterceptors) => VigorParseInterceptors) | VigorParseConfig["interceptors"]) {
        if(typeof func === 'function') {
            return this._next({interceptors: func(new VigorParseInterceptors(this._config.interceptors))._getConfig()})
        }
        return this._next({interceptors: func})
    }

    public async request<R>(config?: VigorParseConfig, timeline: VigorParseContext["timeline"] = []): Promise<R> {
        const stats: VigorParseConfig = this._mergeConfig(this._config, config)
        const target = stats.target

        let ctx: VigorParseContext = {
            timeline: timeline,
            stats,
            response: target as Response,
            result: VigorDefault,
            error: VigorDefault,
        }

        const throwError = <E extends Error>(err: E) => {
            ctx.timeline.push({action: "throwError called", content: err})
            throw err
        }
        try {
            if(target === VigorDefault as unknown) throw new VigorParseError("INVALID_TARGET", {
                method: "request",
                data: {
                    expected: ["Response"],
                    received: target
                },
                context: ctx
            })

            ctx.timeline.push({action: "interceptor handling: before", content: stats.interceptors.before})
            for(const func of stats.interceptors.before) {
                await func(ctx, {throwError})
            }
            if(stats.settings.raw) {
                ctx.result = ctx.response
            }
            else {
                let parsed = false
                for(const [i, func] of stats.strategies.funcs.length > 0
                        ? stats.strategies.funcs.entries()
                        : new VigorParseStrategies().contentType()._getConfig().funcs.entries()
                    ) {
                    const cloned = (i === stats.strategies.funcs.length - 1)
                        ? ctx.response
                        : ctx.response.clone()
                    try {
                        ctx.result = await func(cloned)
                        parsed = true
                        break
                    }
                    catch {}
                }
                if(!parsed) throw new VigorParseError("PARSER_ALL_FAILED", {
                    method: "request",
                    data: {
                        tried: stats.strategies.funcs,
                        response: ctx.response
                    },
                    context: ctx
                })
            }
            
            const setResult = <R>(unk: R): R => {
                ctx.timeline.push({action: "setResult called", content: unk})
                ctx.result = unk
                return unk
            }
            ctx.timeline.push({action: "interceptor handling: after", content: stats.interceptors.after})
            for(const func of stats.interceptors.after) {
                await func(ctx, {setResult, throwError})
            }

            ctx.timeline.push({action: "interceptor handling: result", content: stats.interceptors.result})
            for(const func of stats.interceptors.result) {
                await func(ctx, {setResult, throwError})
            }
            return ctx.result as R
        }
        catch(error) {
            ctx.error = error
            let overwritten = false
            const setResult = <R>(unk: R): R => {
                ctx.timeline.push({action: "setResult called", content: unk})
                ctx.result = unk
                overwritten = true
                return unk
            }

            ctx.timeline.push({action: "interceptor handling: onError", content: stats.interceptors.onError})
            for(const func of stats.interceptors.onError) {
                await func(ctx, {setResult, throwError})
            }
            if(overwritten) return ctx.result as R
            if(stats.settings.default !== VigorDefault) return stats.settings.default as R
            throw error
        }
    }
}

type VigorFetchSettingsConfig = {
    unretryStatus: Array<number>
    retryHeaders: Array<string>
    default: unknown
}

class VigorFetchSettings extends VigorStatus<VigorFetchSettingsConfig, VigorFetchSettings> {
    constructor(config?: Partial<VigorFetchSettingsConfig>) {
        const base = {
            retryHeaders: ["retry-after", "ratelimit-reset", "x-ratelimit-reset", "x-retry-after", "x-amz-retry-after", "chrome-proxy-next-link"],
            unretryStatus: [400, 401, 403, 404, 405, 413, 422],
            default: VigorDefault
        }
        super(config, base, (c) => new VigorFetchSettings(c))
    }

    public retryHeaders(...strs: VigorIncludeSpread<VigorFetchSettingsConfig["retryHeaders"][number]>) { return this._next({retryHeaders: strs.flat()}) }
    public unretryStatus(...nums: VigorIncludeSpread<VigorFetchSettingsConfig["unretryStatus"][number]>) { return this._next({unretryStatus: nums.flat()}) }
    public default(unk: VigorFetchSettingsConfig["default"]) { return this._next({default: unk}) }
}

type VigorFetchInterceptorsConfig = {
    before: Array<VigorFetchInterceptorsFunctions["before"]>
    after: Array<VigorFetchInterceptorsFunctions["after"]>
    result: Array<VigorFetchInterceptorsFunctions["result"]>
    onError: Array<VigorFetchInterceptorsFunctions["onError"]>
}

class VigorFetchInterceptors extends VigorStatus<VigorFetchInterceptorsConfig, VigorFetchInterceptors> {
    constructor(config?: Partial<VigorFetchInterceptorsConfig>) {
        const base = {
            before: [],
            after: [],
            result: [],
            onError: []
        }
        super(config, base, (c) => new VigorFetchInterceptors(c))
    }

    public before(...funcs: VigorIncludeSpread<VigorFetchInterceptorsConfig["before"][number]>) { return this._next({before: funcs.flat()}) }
    public after(...funcs: VigorIncludeSpread<VigorFetchInterceptorsConfig["after"][number]>) { return this._next({after: funcs.flat()}) }
    public result(...funcs: VigorIncludeSpread<VigorFetchInterceptorsConfig["result"][number]>) { return this._next({result: funcs.flat()}) }
    public onError(...funcs: VigorIncludeSpread<VigorFetchInterceptorsConfig["onError"][number]>) { return this._next({onError: funcs.flat()}) }
}

type VigorFetchOptions<T = Record<string, any>> = {
    headers: HeadersInit | Record<string, any>
    body?: XMLHttpRequestBodyInit | object | null
} & T

type VigorFetchConfig = {
    origin: Array<string>
    path: Array<string>
    query: Array<Record<string, VigorStringable|Array<VigorStringable>>>
    hash: string
    options: VigorFetchOptions
    settings: VigorFetchSettingsConfig
    interceptors: VigorFetchInterceptorsConfig
    retryConfig: VigorRetryConfig
    parseConfig: VigorParseConfig
}

type VigorFetchInterceptorsApi<R> = {
    setResult: (unk: R) => R
    setOptions: (unk: VigorFetchContext["options"]) => VigorFetchContext["options"]
    setHeaders: (unk: VigorFetchConfig["options"]["headers"]) => VigorFetchConfig["options"]["headers"]
    setBody: (unk: VigorFetchConfig["options"]["body"]) => VigorFetchConfig["options"]["body"]
    throwError: <E extends Error>(err: E) => never
    restart: () => void
}

type VigorFetchInterceptorsFn<A extends keyof VigorFetchInterceptorsApi<R>, R = unknown> = (
    ctx: VigorFetchContext,
    api: Pick<VigorFetchInterceptorsApi<R>, A>
) => void|Promise<void>

type VigorFetchInterceptorsFunctions = {
    before: VigorFetchInterceptorsFn<"throwError" | "setOptions" | "setHeaders" | "setBody">
    after: VigorFetchInterceptorsFn<"setResult" | "throwError">
    result: VigorFetchInterceptorsFn<"setResult" | "throwError">
    onError: VigorFetchInterceptorsFn<"setResult" | "throwError" | "restart">
}

type VigorFetchContext = {
    href: string,
    response: Response
    result: unknown
    error: unknown
    options: VigorFetchOptions
    timeline: Array<{action: string, content?: unknown}>
    stats: VigorFetchConfig
}

type VigorStringable = string | number | boolean | null | undefined | Date

class VigorFetch extends VigorStatus<VigorFetchConfig, VigorFetch> {
    constructor(config?: Partial<VigorFetchConfig>) {
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
        }
        super(config, base, (c) => new VigorFetch(c))
    }
    
    private _stringifyList(unkList: Array<VigorStringable>): Array<string> {
        return unkList
            .filter(unk => unk !== null && unk !== undefined)
            .map(unk => {
            if(unk instanceof Date) return unk.toISOString()
            return String(unk)
        })
    }
    public origin(...strs: VigorIncludeSpread<VigorStringable>) { return this._next({ origin: this._stringifyList(strs.flat()) }) }
    public path(...strs: VigorIncludeSpread<VigorStringable>) { return this._next({ path: this._stringifyList(strs.flat()) }) }
    public query(...strs: VigorIncludeSpread<VigorFetchConfig["query"][number]>) { return this._next({query: strs.flat()}) }
    public hash(str: VigorFetchConfig["hash"]) { return this._next({hash: str}) }
    public options(obj: VigorFetchConfig["options"]) { return this._next({options: obj}) }
    public headers(obj: VigorFetchConfig["options"]["headers"]) { return this._next({options: {headers: obj}}) }
    public body(obj: VigorFetchConfig["options"]["body"]) { return this._next({options: {headers: this._config.options.headers, body: obj}}) }

    private _buildUrl(origin: VigorFetchConfig["origin"], path: VigorFetchConfig["path"], query: VigorFetchConfig["query"], hash: VigorFetchConfig["hash"]) {
        const originObj = new URL(origin[0])
        const baseStr = originObj.origin
        const pathObj = [originObj.pathname.replace(/^\/+|\/+$/g, '')]
        for(const str of path) {
            pathObj.push(str.replace(/^\/+|\/+$/g, ''))
        }
        const pathStr = pathObj.join('/')
        
        const mainObj = new URL(pathStr, baseStr)
        const parseVal = (val: VigorStringable): string => {
            if(val instanceof Date) return val.toISOString()
            return String(val)
        }
        const queryObj = [...Array.from(originObj.searchParams.entries()), ...query.flatMap(qu => Object.entries(qu))]
        for(const [key, val] of queryObj) {
            if(val === undefined || val === null) continue
            if(Array.isArray(val)) for(const e of val) {
                mainObj.searchParams.append(key, parseVal(e))
            }
            else {
                mainObj.searchParams.append(key, parseVal(val))
            }
        }
        mainObj.hash = hash ?? originObj.hash
        return mainObj.href
    }
    private _normalizeOptions(body: unknown): {isJson: boolean, headers: Record<string, unknown>, body: BodyInit | null | undefined} {
        if (body == null) return {isJson: false, headers: {

        }, body}

        if (typeof body === "string") return {isJson: false, headers: {
            "Content-Type": "text/plain;charset=UTF-8"
        }, body}
        if (body instanceof Blob) return {isJson: false, headers: {
            ...(body.type && {"Content-Type": body.type})
        }, body}
        if (body instanceof ArrayBuffer) return {isJson: false, headers: {
            "Content-Type": "application/octet-stream"
        }, body}
        if (body instanceof URLSearchParams) return {isJson: false, headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        }, body}
        if (body instanceof FormData) return {isJson: false, headers: {
        }, body}

        if (typeof body === "object") {
            return {isJson: true, headers: {
                "Content-Type": "application/json"
            }, body: JSON.stringify(body)}
        }

        throw new VigorFetchError("INVALID_BODY", {
            method: "_normalizeBody",
            data: {
                expected: ["string", "Blob", "ArrayBuffer", "URLSearchParams", "FormData"],
                received: body
            }
        })
    }

    public settings(func: ((s: VigorFetchSettings) => VigorFetchSettings) | VigorFetchConfig["settings"]) {
        if(typeof func === 'function') {
            return this._next({settings: func(new VigorFetchSettings(this._config.settings))._getConfig()})
        }
        return this._next({settings: func})
    }
    public interceptors(func: ((s: VigorFetchInterceptors) => VigorFetchInterceptors) | VigorFetchConfig["interceptors"]) {
        if(typeof func === 'function') {
            return this._next({interceptors: func(new VigorFetchInterceptors(this._config.interceptors))._getConfig()})
        }
        return this._next({interceptors: func})
    }
    public retryConfig(func: ((s: VigorRetry) => VigorRetry) | VigorFetchConfig["retryConfig"]) {
        if(typeof func === 'function') {
            return this._next({retryConfig: func(new VigorRetry(this._config.retryConfig))._getConfig()})
        }
        return this._next({retryConfig: func})
    }
    public parseConfig(func: ((s: VigorParse) => VigorParse) | VigorFetchConfig["parseConfig"]) {
        if(typeof func === 'function') {
            return this._next({parseConfig: func(new VigorParse(this._config.parseConfig))._getConfig()})
        }
        return this._next({parseConfig: func})
    }
    public async request<R>(config?: VigorFetchConfig, timeline: VigorFetchContext["timeline"] = []): Promise<R> {
        const stats: VigorFetchConfig = this._mergeConfig(this._config, config)

        let ctx: VigorFetchContext = {
            href: "",
            result: VigorDefault,
            response: VigorDefault as unknown as VigorFetchContext["response"],
            options: {
                headers: VigorDefault,
                body: VigorDefault
            },
            error: VigorDefault,
            timeline: timeline,
            stats,
        }
        const throwError = <E extends Error>(err: E) => {
            ctx.timeline.push({action: "throwError called", content: err})
            throw err
        }

        try {
            try {
                new URL(stats.origin[0])
            }
            catch {
                throw new VigorFetchError("INVALID_PROTOCOL", {
                    method: "request",
                    data: {
                        expected: ["valid URL protocol"],
                        received: stats.origin
                    }
                })
            }
            ctx.href = this._buildUrl(
                stats.origin,
                stats.path,
                stats.query,
                stats.hash
            )

            const { headers, body, ...others } = stats.options

            ctx.options = {
                ...others,
                headers: {}
            }
            const hasBody =
                body !== VigorDefault &&
                body !== undefined
            if (hasBody) {
                const normalized = this._normalizeOptions(body)

                if (normalized.body !== undefined) {
                    ctx.options.body = normalized.body
                }

                Object.assign(ctx.options.headers, normalized.headers)
            }

            Object.assign(ctx.options.headers, headers)
            ctx.timeline.push({action: "options set", content: ctx.options})

            const setOptions = (unk: VigorFetchConfig["options"]): VigorFetchConfig["options"] => {
                ctx.timeline.push({action: "setOptions called", content: unk})
                return ctx.options = unk
            }
            const setHeaders = (unk: VigorFetchConfig["options"]["headers"]): VigorFetchConfig["options"]["headers"] => {
                ctx.timeline.push({action: "setHeaders called", content: unk})
                return ctx.options.headers = unk
            }
            const setBody = (unk: VigorFetchConfig["options"]["body"]): VigorFetchConfig["options"]["body"] => {
                ctx.timeline.push({action: "setBody called", content: unk})
                return ctx.options.body = unk
            }

            const fetchTask: VigorRetryConfig["target"] = async(ctx2, {abort, signal}) => {
                ctx.options.signal = signal
                const result = await fetch(ctx.href, ctx.options as any)
                return result
            }
            const throwStatus: VigorRetryInterceptorsFunctions["after"] = async(ctx2, api) => {
                const response = ctx2.result as Response
                if(!response.ok) {
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
                    }))
                }
            }
            const handleBlacklist: VigorRetryInterceptorsFunctions["retryIf"] = async(ctx2, api) => {
                const response = ctx2.result
                ctx.error = ctx2.error
                if(response instanceof Response) {
                    if(stats.settings.unretryStatus.includes(response.status)) api.cancelRetry()
                    else api.proceedRetry()
                }
            }
            const handleRatelimit: VigorRetryInterceptorsFunctions["onRetry"] = async(ctx2, api) => {
                const response = ctx2.result
                ctx.error = ctx2.error
                if(response instanceof Response) {
                    if(response.status === 429) {
                        let retryHeader = null
                        for(const header of stats.settings.retryHeaders) {
                            retryHeader = response.headers.get(header)
                            if(retryHeader) break
                        }
                        if(retryHeader) {
                            const toNumber = Number(retryHeader)
                            const delay = !isNaN(toNumber)
                                ? toNumber * 1000
                                : (() => {
                                    const toDate = new Date(retryHeader).getTime()
                                    return !isNaN(toDate)
                                        ? toDate - Date.now()
                                        : null
                                })()
                            if(delay !== null && delay > 0) api.setDelay(delay + Math.random() * ctx2.stats.settings.jitter)
                        }
                    }
                }
            }
            stats.retryConfig.interceptors.after.unshift(throwStatus)
            stats.retryConfig.interceptors.retryIf.unshift(handleBlacklist)
            stats.retryConfig.interceptors.onRetry.unshift(handleRatelimit)
            const retryEngine = new VigorRetry(stats.retryConfig)
                .target(fetchTask)
            const parseEngine = new VigorParse(stats.parseConfig)
            
            ctx.timeline.push({action: "interceptor handling: before", content: stats.interceptors.before})
            for(const func of stats.interceptors.before) {
                await func(ctx, {throwError, setOptions, setHeaders, setBody})
            }
            ctx.response = await retryEngine.request<Response>(undefined, timeline)
            ctx.result = await parseEngine.target(ctx.response).request<R>(undefined, timeline)
            const setResult = <R>(unk: R): R => {
                ctx.timeline.push({action: "setResult called", content: unk})
                ctx.result = unk
                return unk
            }

            ctx.timeline.push({action: "interceptor handling: after", content: stats.interceptors.after})
            for(const func of stats.interceptors.after) {
                await func(ctx, {setResult, throwError})
            }

            ctx.timeline.push({action: "interceptor handling: result", content: stats.interceptors.result})
            for(const func of stats.interceptors.result) {
                await func(ctx, {setResult, throwError})
            }
            return ctx.result as R
        }
        catch(error) {
            ctx.error = error

            let overwritten = false
            const setResult = <R>(unk: R): R => {
                ctx.timeline.push({action: "setResult called", content: unk})
                ctx.result = unk
                overwritten = true
                return unk
            }

            let restarted = false
            const restart = () => {
                ctx.timeline.push({action: "restart called"})
                restarted = true
            }

            ctx.timeline.push({action: "interceptor handling: onError", content: stats.interceptors.onError})
            for(const func of stats.interceptors.onError) {
                await func(ctx, {setResult, throwError, restart})
            }
            if(restarted) {
                return await this.request<R>(stats, timeline)
            }
            if(overwritten) return ctx.result as R
            if(stats.settings.default !== VigorDefault) return stats.settings.default as R
            throw error
        }
    }
}

type VigorAllSettingsConfig = {
    concurrency: number
    onlySuccess: boolean
}

class VigorAllSettings extends VigorStatus<VigorAllSettingsConfig, VigorAllSettings> {
    constructor(config?: Partial<VigorAllSettingsConfig>) {
        const base = {
            concurrency: 5,
            onlySuccess: false
        }
        super(config, base, (c) => new VigorAllSettings(c))
    }
    public concurrency(num: VigorAllSettingsConfig["concurrency"]) { return this._next({concurrency: num}) }
    public onlySuccess(num: VigorAllSettingsConfig["onlySuccess"]) { return this._next({onlySuccess: num}) }
}

type VigorAllInterceptorsConfig = {
    before: Array<VigorAllInterceptorsFunctions["before"]>
    after: Array<VigorAllInterceptorsFunctions["after"]>
    result: Array<VigorAllInterceptorsFunctions["result"]>
    onError: Array<VigorAllInterceptorsFunctions["onError"]>
}

class VigorAllInterceptors extends VigorStatus<VigorAllInterceptorsConfig, VigorAllInterceptors> {
    constructor(config?: Partial<VigorAllInterceptorsConfig>) {
        const base = {
            before: [],
            after: [],
            result: [],
            onError: []
        }
        super(config, base, (c) => new VigorAllInterceptors(c))
    }
    public before(...funcs: VigorIncludeSpread<VigorAllInterceptorsConfig["before"][number]>) { return this._next({before: funcs.flat()}) }
    public after(...funcs: VigorIncludeSpread<VigorAllInterceptorsConfig["after"][number]>) { return this._next({after: funcs.flat()}) }
    public result(...funcs: VigorIncludeSpread<VigorAllInterceptorsConfig["result"][number]>) { return this._next({result: funcs.flat()}) }
    public onError(...funcs: VigorIncludeSpread<VigorAllInterceptorsConfig["onError"][number]>) { return this._next({onError: funcs.flat()}) }
}

type VigorAllConfig = {
    target: Array<(ctx: VigorAllEachContext) => unknown | Promise<unknown>>
    settings: VigorAllSettingsConfig
    interceptors: VigorAllInterceptorsConfig
}

type VigorAllInterceptorsApi<R> = {
    setResult: (unk: Array<R>) => Array<R>
    throwError: <E extends Error>(err: E) => never
}

type VigorAllInterceptorsEachApi<R> = {
    setResult: (unk: R) => R
    throwError: <E extends Error>(err: E) => never
}

type VigorAllInterceptorsFn<A extends keyof VigorAllInterceptorsApi<R>, R = unknown> = (
    ctx: VigorAllContext,
    api: Pick<VigorAllInterceptorsApi<R>, A>
) => void|Promise<void>

type VigorAllInterceptorsEachFn<A extends keyof VigorAllInterceptorsApi<R>, R = unknown> = (
    ctx: VigorAllEachContext,
    api: Pick<VigorAllInterceptorsEachApi<R>, A>
) => void|Promise<void>

type VigorAllInterceptorsFunctions = {
    before: VigorAllInterceptorsEachFn<"throwError">
    after: VigorAllInterceptorsEachFn<"setResult" | "throwError">
    result: VigorAllInterceptorsFn<"setResult" | "throwError">
    onError: VigorAllInterceptorsEachFn<"setResult" | "throwError">
}

type VigorAllContext = {
    result: Array<unknown>
    timeline: Array<{action: string, content: unknown}>
    stats: VigorAllConfig
    queue: Set<Promise<{success: boolean, value: unknown}>>
}

type VigorAllEachContext = {
    result: unknown
    error: unknown
    timeline: Array<{action: string, content: unknown}>
    stats: VigorAllConfig
    root: VigorAllContext
    target: VigorAllConfig["target"][number]
    semaphore: {
        acquire: () => Promise<void>
        release: () => void
    }
}

class VigorAll extends VigorStatus<VigorAllConfig, VigorAll> {
    constructor(config?: Partial<VigorAllConfig>) {
        const base = {
            target: [],
            settings: new VigorAllSettings()._getBase(),
            interceptors: new VigorAllInterceptors()._getBase()
        }
        super(config, base, (c) => new VigorAll(c))
    }
    public target(...funcs: VigorIncludeSpread<VigorAllConfig["target"][number]>) { return this._next({target: funcs.flat()}) }
    public settings(func: ((s: VigorAllSettings) => VigorAllSettings) | VigorAllConfig["settings"]) {
        if(typeof func === 'function') {
            return this._next({settings: func(new VigorAllSettings(this._config.settings))._getConfig()})
        }
        return this._next({settings: func})
    }
    public interceptors(func: ((s: VigorAllInterceptors) => VigorAllInterceptors) | VigorAllConfig["interceptors"]) {
        if(typeof func === 'function') {
            return this._next({interceptors: func(new VigorAllInterceptors(this._config.interceptors))._getConfig()})
        }
        return this._next({interceptors: func})
    }
    private async runTask(
        task: VigorAllEachContext["target"],
        {stats, root}: {stats: VigorAllEachContext["stats"], root: VigorAllEachContext["root"]},
        semaphore: {acquire: VigorAllEachContext["semaphore"]["acquire"], release: VigorAllEachContext["semaphore"]["release"]}
    ) {
        let ctx: VigorAllEachContext = {
            result: VigorDefault,
            error: VigorDefault,
            timeline: [],
            stats,
            root,
            target: task,
            semaphore
        }
        const throwError = <E extends Error>(err: E) => {
            ctx.timeline.push({action: "throwError called", content: err})
            throw err
        }

        try {
            try {
                await semaphore.acquire();
                ctx.timeline.push({action: "task acquired", content: ctx.target})

                ctx.timeline.push({action: "interceptor handling: before", content: stats.interceptors.before})
                for(const func of stats.interceptors.before) {
                    await func(ctx, {throwError})
                }

                ctx.timeline.push({action: "task started", content: ctx.target})
                ctx.result = await task(ctx)
            }
            finally {
                ctx.timeline.push({action: "task ended", content: ctx.target})

                const setResult = <R>(unk: R): R => {
                    ctx.timeline.push({action: "setResult called", content: unk})
                    ctx.result = unk
                    return unk
                }

                ctx.timeline.push({action: "interceptor handling: after", content: stats.interceptors.after})
                for(const func of stats.interceptors.after) {
                    await func(ctx, {setResult, throwError})
                }

                semaphore.release()
                ctx.timeline.push({action: "task released", content: ctx.target})
                return ctx.result
            }
        } catch(error) {
            ctx.error = error

            let overwritten = false
            const setResult = <R>(unk: R): R => {
                ctx.timeline.push({action: "setResult called", content: unk})
                ctx.result = unk
                overwritten = true
                return unk
            }

            ctx.timeline.push({action: "interceptor handling: onError", content: stats.interceptors.onError})
            for(const func of stats.interceptors.onError) {
                await func(ctx, {setResult, throwError})
            }

            if(overwritten) return ctx.result
            throw error
        }
    }
    public async request<R extends VigorAllContext["result"]>(config?: VigorAllConfig, timeline: VigorAllContext["timeline"] = []) {
        const stats = this._mergeConfig(this._config, config)
        let ctx: VigorAllContext = {
            result: VigorDefault as unknown as VigorAllContext["result"],
            timeline,
            stats,
            queue: new Set()
        }

        if(stats.target.length === 0) throw new VigorAllError("EMPTY_TARGET", {
            method: "request",
            data: {}
        })
        const waitQueue: Array<() => void> = []
        for(const task of stats.target) {
            const acquire = (): Promise<void> => {
                if (ctx.queue.size < stats.settings.concurrency) {
                    return Promise.resolve();
                }
                return new Promise((res) => waitQueue.push(res))
            }
            const release = () => {
                if (waitQueue.length > 0) {
                    const next = waitQueue.shift();
                    if (next) next();
                }
            }
                acquire();
            let promise: Promise<{success: boolean, value: unknown}>;
            promise = this.runTask(task, {stats, root: ctx}, {acquire, release}).then(res => {
                ctx.queue.delete(promise)
                return {success: true, value: res}
            }).catch(err => ({success: false, value: err}))
            ctx.queue.add(promise)
        }

        const raw = await Promise.all(ctx.queue)
        ctx.result = stats.settings.onlySuccess
            ? raw.filter(r => r.success).map(r => r.value)
            : raw.map(r => r.value)
        
        const setResult = <R extends Array<unknown>>(unk: R): R => {
            ctx.timeline.push({action: "setResult called", content: unk})
            ctx.result = unk
            return unk
        }
        const throwError = <E extends Error>(err: E) => {
            ctx.timeline.push({action: "throwError called", content: err})
            throw err
        }

        ctx.timeline.push({action: "interceptor handling: result", content: stats.interceptors.result})
        for(const func of stats.interceptors.result) {
            await func(ctx, {setResult, throwError})
        }
        return ctx.result as R
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
}

const vigor = {
    use: async<C, R>(
        func: (entry: typeof VigorEntry, config: C) => R | Promise<R>, 
        config: C
    ): Promise<R> => {
        return await func(VigorEntry, config);
    },
    fetch: (...strs: Parameters<VigorFetch["origin"]>[0][]) => {
        return new VigorFetch().origin(...strs)
    },
    retry: (target: Parameters<VigorRetry["target"]>[0]) => {
        return new VigorRetry().target(target)
    },
    parse: (response: Parameters<VigorParse["target"]>[0]) => {
        return new VigorParse().target(response)
    },
    all: (...funcs: Parameters<VigorAll["target"]>[0][]) => {
        return  new VigorAll().target(...funcs)
    },
    builder: {
        fetch: {
            settings: (c?: Partial<VigorFetchSettingsConfig>) => new VigorFetchSettings(c),
            interceptors: (c?: Partial<VigorFetchInterceptorsConfig>) => new VigorFetchInterceptors(c),
        },
        retry: {
            settings: (c?: Partial<VigorRetrySettingsConfig>) => new VigorRetrySettings(c),
            interceptors: (c?: Partial<VigorRetryInterceptorsConfig>) => new VigorRetryInterceptors(c),
        },
        parse: {
            settings: (c?: Partial<VigorParseSettingsConfig>) => new VigorParseSettings(c),
            interceptors: (c?: Partial<VigorParseInterceptorsConfig>) => new VigorParseInterceptors(c),
        },
        all: {
            settings: (c?: Partial<VigorAllSettingsConfig>) => new VigorAllSettings(c),
            interceptors: (c?: Partial<VigorAllInterceptorsConfig>) => new VigorAllInterceptors(c),
        }
    }
}


export default vigor
export { vigor, VigorEntry }