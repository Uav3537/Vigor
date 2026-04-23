const VIGOR_ERROR_MESSAGES = {
  TIMEOUT: ({ limit, attempt }: {limit: number, attempt: number}) => `Timeout: exceeded ${limit}ms (attempt: ${attempt})`,
  EXHAUSTED: ({ maxAttempts }: { maxAttempts: number }) => `Retry exhausted: max ${maxAttempts})`,

  INVALID_URL: ({ received }: { received: unknown }) => `Invalid URL: ${received}`,
  INVALID_PROTOCOL: ({ expected, received }: { expected: Array<string>, received: unknown }) => `Invalid protocol: ${received} (expected ${expected.join(", ")})`,

  FETCH_ERROR: ({ status, statusText, url }: { status: number, statusText: string, url: string }) => `HTTP Error: ${status} ${statusText} (url: ${url})`,

  PARSE_FAILED: ({ expected }: { expected: unknown }) => `Parse failed: expected ${expected}`,
  INVALID_TYPE: ({ expected, received }: { expected: unknown, received: unknown }) => `Invalid parser type: ${expected}`,
  TARGET_MISSING: () => `Target missing`,

  REQUEST_FAILED: ({ index, error }: { index: number, error: Error }) => `Request failed at index ${index}: ${error.message}`,

  UNKNOWN: () => `Unknown error`
} as const;

type VigorErrorCode = keyof typeof VIGOR_ERROR_MESSAGES;
type ErrorData<C extends VigorErrorCode> =
    Parameters<typeof VIGOR_ERROR_MESSAGES[C]> extends [infer A]
        ? A
        : undefined;

type VigorErrorOptions<C extends VigorErrorCode> = {
    method?: string;
    cause?: unknown;
    context?: unknown;
    type?: string;
    data: ErrorData<C>;
};

abstract class VigorError<C extends VigorErrorCode> extends Error {
    public readonly timestamp: Date = new Date();
    public readonly method?: string;
    public readonly code: C;
    public readonly cause?: unknown;
    public readonly context?: unknown;
    public readonly type?: string;
    public readonly data: ErrorData<C>;

    constructor(
        code: C,
        options: VigorErrorOptions<C>
    ) {
        const messageFn = VIGOR_ERROR_MESSAGES[code] as (
            arg: ErrorData<C>
        ) => string;
        const message = `[${code}] ${messageFn(options?.data as ErrorData<C>)}`
        super(message, { cause: options?.cause });
        this.name = new.target.name;

        this.method = options?.method;
        this.code = code
        this.context = options?.context;
        this.type = options?.type;
        this.data = options.data;

        Object.setPrototypeOf(this, new.target.prototype);
        (Error as any).captureStackTrace?.(this, new.target);
    }
}

class VigorRetryError<C extends "TIMEOUT" | "EXHAUSTED"> extends VigorError<C> {
    constructor(code: C, options: VigorErrorOptions<C>) {
        super(code, options)
    }
}

class VigorParseError<C extends "PARSE_FAILED" | "INVALID_TYPE" | "TARGET_MISSING"> extends VigorError<C> {
    constructor(code: C, options: VigorErrorOptions<C>) {
        super(code, options)
    }
}

class VigorFetchError<C extends "FETCH_ERROR" | "INVALID_URL" | "INVALID_PROTOCOL"> extends VigorError<C> {
    constructor(code: C, options: VigorErrorOptions<C>) {
        super(code, options)
    }
}

class VigorAllError<C extends "REQUEST_FAILED" | "TARGET_MISSING"> extends VigorError<C> {
    constructor(code: C, options: VigorErrorOptions<C>) {
        super(code, options)
    }
}
const EMPTY = Symbol("EMPTY");
abstract class VigorStatus<T> {
    protected readonly _config: T
    constructor(
        config: Partial<T>,
        protected readonly _base: T
    ) {
        this._config = {...this._base, ...config}
    }
    public getConfig(): T { return this._config }
    public getBase(): T { return this._base }
    protected _next(config: Partial<T>): this { return new (this.constructor as any)({...this._config, ...config}, this._base) }
    protected _pipsub<C, R extends VigorStatus<C>>(
        config: C,
        fn: (r: R) => R,
        ctor: new (c: C) => R
    ): C {
        return fn(new ctor(config)).getConfig()
    }
}

type VigorIncludeSpread<T> = Array<(T | Array<T>)>

type VigorRetrySettingsConfig<T> = {
    count: number,
    limit: number,
    maxDelay: number,
    default?: T|typeof EMPTY,
}

class VigorRetrySettings<T> extends VigorStatus<VigorRetrySettingsConfig<T>> {
    constructor(config: Partial<VigorRetrySettingsConfig<T>> = {}) {
        super(config, {
            count: 5,
            limit: 10000,
            maxDelay: 10000,
            default: EMPTY
        })
    }
    public count(num: number): this { return this._next({ count: num }) }
    public limit(num: number): this { return this._next({ limit: num }) }
    public maxDelay(num: number): this { return this._next({ maxDelay: num }) }
    public default(obj: T): this { return this._next({ default: obj }) }
}

type VigorRetryBackoffConfig<T> = {
    initialDelay: number,
    baseDelay: number,
    factor: number,
    jitter: number
}

class VigorRetryBackoff<T> extends VigorStatus<VigorRetryBackoffConfig<T>> {
    constructor(config: Partial<VigorRetryBackoffConfig<T>> = {}) {
        super(config, {
            initialDelay: 0,
            baseDelay: 1000,
            factor: 1.7,
            jitter: 1000
        })
    }
    public initialDelay(num: number): this { return this._next({ initialDelay: num }) }
    public baseDelay(num: number): this { return this._next({ baseDelay: num }) }
    public factor(num: number): this { return this._next({ factor: num }) }
    public jitter(num: number): this { return this._next({ jitter: num }) }
    static randomJitter(num: number): number { return Math.random() * num }
}

type VigorRetryBefore<T> = {
    setAttempt: (attempt: number) => number;
    throwError: (error: Error) => void;
    abort: (error: Error) => void;
}

type VigorRetryAfter<T> = {
    setAttempt: (attempt: number) => number;
    throwError: (error: Error) => void;
    setResult: (result: T) => T;
}

type VigorRetryRetryIf<T> = {
    throwError: (error: Error) => void;
    proceedRetry: () => boolean;
    cancelRetry: (error?: Error) => boolean;
}

type VigorRetryOnRetry<T> = {
    setAttempt: (attempt: number) => number;
    throwError: (error: Error) => void;
    setDelay: (delay: number) => number;
}

type VigorRetryOnError<T> = {
    setResult: (result: T) => T;
    throwError: (error: Error) => void;
}

type VigorRetryFn<T, O> = (ctx: VigorRetryContext<T>, obj: O) => void|any | Promise<void|any>

type VigorRetryBeforeFn<T> = VigorRetryFn<T, VigorRetryBefore<T>>
type VigorRetryAfterFn<T> = VigorRetryFn<T, VigorRetryAfter<T>>
type VigorRetryOnErrorFn<T> = VigorRetryFn<T, VigorRetryOnError<T>>
type VigorRetryOnRetryFn<T> = VigorRetryFn<T, VigorRetryOnRetry<T>>
type VigorRetryRetryIfFn<T> = VigorRetryFn<T, VigorRetryRetryIf<T>>

type VigorRetryOptionsTask<T> = {
    abort?: (error: Error) => void;
    signal?: AbortSignal;
}

type VigorRetryInterceptorsConfig<T> = {
    before: Array<VigorRetryBeforeFn<T>>,
    after: Array<VigorRetryAfterFn<T>>,
    onError: Array<VigorRetryOnErrorFn<T>>,
    onRetry: Array<VigorRetryOnRetryFn<T>>,
    retryIf: Array<VigorRetryRetryIfFn<T>>
}

class VigorRetryInterceptors<T> extends VigorStatus<VigorRetryInterceptorsConfig<T>> {
    constructor(config: Partial<VigorRetryInterceptorsConfig<T>> = {}) {
        super(config, {
            before: [],
            after: [],
            onError: [],
            onRetry: [],
            retryIf: []
        })
    }
    public before(...funcs: VigorIncludeSpread<VigorRetryBeforeFn<T>>) { return this._next({...this._config, before: [...this._config.before, ...funcs.flat()]}) }
    public after(...funcs: VigorIncludeSpread<VigorRetryAfterFn<T>>) { return this._next({...this._config, after: [...this._config.after, ...funcs.flat()]}) }
    public onError(...funcs: VigorIncludeSpread<VigorRetryOnErrorFn<T>>) { return this._next({...this._config, onError: [...this._config.onError, ...funcs.flat()]}) }
    public onRetry(...funcs: VigorIncludeSpread<VigorRetryOnRetryFn<T>>) { return this._next({...this._config, onRetry: [...this._config.onRetry, ...funcs.flat()]}) }
    public retryIf(...funcs: VigorIncludeSpread<VigorRetryRetryIfFn<T>>) { return this._next({...this._config, retryIf: [...this._config.retryIf, ...funcs.flat()]}) }
}

type VigorRetryTask<T> = (ctx: VigorRetryContext<T>, obj: VigorRetryOptionsTask<T>) => T | Promise<T>;

type VigorRetryConfig<T> = {
    target: VigorRetryTask<T>,
    setting: VigorRetrySettingsConfig<T>,
    backoff: VigorRetryBackoffConfig<T>,
    interceptors: VigorRetryInterceptorsConfig<T>
    controller: AbortController
}

type VigorRetryContext<T> = VigorRetryConfig<T> & {
    runtime: {
        result?: T| typeof EMPTY;
        attempt: number;
        controller: AbortController;
        abortPromise?: Promise<never>;
        aborted: boolean;
        signal: AbortSignal;
        delay: number;
        retry: boolean;
        error?: unknown;
    }
}

class VigorRetry<T> extends VigorStatus<VigorRetryConfig<T>> {
    constructor(config: Partial<VigorRetryConfig<T>> = {}) {
        super(config, {
            target: null as any,
            setting: new VigorRetrySettings<T>().getBase(),
            backoff: new VigorRetryBackoff<T>().getBase(),
            interceptors: new VigorRetryInterceptors<T>().getBase(),
            controller: config.controller || new AbortController()
        })
    }
    private _transfer<U>(config: Partial<VigorRetryConfig<U>>): VigorRetry<U> { return new VigorRetry<U>({...this._config as unknown as VigorRetryConfig<U>, ...config}) }
    private _calculateDelay(initialDelay: number, baseDelay: number, factor: number, attempt: number, jitter: number, maxDelay: number) {
        return Math.max(0, Math.min(maxDelay, initialDelay + baseDelay * Math.pow(factor, attempt) + VigorRetryBackoff.randomJitter(jitter)))
    }

    public createController(): VigorRetryConfig<T>["controller"] { return this._config.controller = new AbortController() }
    public target<U>(func: VigorRetryConfig<U>["target"]): VigorRetry<U> { return this._transfer({target: func}) }
    
    public setting(func: (r: VigorRetrySettings<T>) => VigorRetrySettings<T>): this {
        return this._next({setting: this._pipsub(this._config.setting, func, VigorRetrySettings)})
    }
    public backoff(func: (r: VigorRetryBackoff<T>) => VigorRetryBackoff<T>): this {
        return this._next({backoff: this._pipsub(this._config.backoff, func, VigorRetryBackoff)})
    }
    public interceptors(func: (r: VigorRetryInterceptors<T>) => VigorRetryInterceptors<T>): this {
        return this._next({interceptors: this._pipsub(this._config.interceptors, func, VigorRetryInterceptors)})
    }
    public async request(): Promise<T> {
        const config = this._config
        let ctx: VigorRetryContext<T> = {
            target: config.target,
            setting: {...config.setting},
            interceptors: {
                before: [...config.interceptors.before],
                after: [...config.interceptors.after],
                onError: [...config.interceptors.onError],
                onRetry: [...config.interceptors.onRetry],
                retryIf: [...config.interceptors.retryIf],
            },
            backoff: {...config.backoff},
            controller: config.controller,
            runtime: {
                result: EMPTY,
                controller: null as any,
                attempt: 0,
                aborted: false,
                signal: null as any,
                delay: 0,
                retry: false,
            }
        }
        const throwError = (error: Error) => {throw error}
        const normalizeError = (obj: unknown) => {
            if (obj instanceof Error) {
                throw obj;
            }
            throw new Error(String(obj));
        }
        try {
            while(ctx.runtime.attempt < ctx.setting.count) {
                ctx.runtime.controller = new AbortController()
                let listener: EventListener|undefined
                let timerId:ReturnType<typeof setTimeout> | undefined
                const setAttempt = (attempt: number) => ctx.runtime.attempt = attempt
                const abort = (error: Error) => { if(!ctx.runtime.aborted) {ctx.runtime.controller?.abort(error);} }
                try {
                    ctx.runtime.signal = AbortSignal.any([
                        ctx.controller.signal, 
                        ctx.runtime.controller.signal
                    ]);
                    ctx.runtime.abortPromise = new Promise<never>((_, reject) => {
                        if(ctx.runtime.signal.aborted) reject(ctx.runtime.signal.reason)
                        listener = () => {
                            ctx.runtime.aborted = true
                            reject(ctx.runtime.signal.reason)
                        }
                        ctx.runtime.signal.addEventListener("abort", listener, { once: true })
                        timerId = setTimeout(() => {
                            if(ctx.runtime.aborted) return
                            abort(new VigorRetryError("TIMEOUT", {
                                method: "request",
                                type: "timeout",
                                data: {
                                    limit: ctx.setting.limit,
                                    attempt: ctx.runtime.attempt
                                }
                            }
                            ))
                        }, ctx.setting.limit)
                    })
                    
                    for(const func of ctx.interceptors.before) {
                        await func(ctx, {setAttempt, throwError, abort})
                        if(ctx.runtime.signal.aborted) normalizeError(ctx.runtime.signal.reason)
                    }
                    ctx.runtime.result = await Promise.race([
                        ctx.target(ctx, {abort, signal: ctx.runtime.signal}),
                        ctx.runtime.abortPromise
                    ])
                    const setResult = (result: T) => ctx.runtime.result = result
                    for(const func of ctx.interceptors.after) {
                        await func(ctx, {setAttempt, setResult, throwError})
                        if(ctx.runtime.signal.aborted) normalizeError(ctx.runtime.signal.reason)
                    }
                    return ctx.runtime.result;
                }
                catch(error) {
                    if(ctx.runtime.aborted) normalizeError(ctx.runtime.signal.reason)
                    ctx.runtime.retry = true
                    ctx.runtime.error = error
                    const proceedRetry = () => ctx.runtime.retry = true
                    const cancelRetry = (error?: Error) => {ctx.runtime.error = error; return (ctx.runtime.retry = false)}
                    for(const func of ctx.interceptors.retryIf) {
                        await func(ctx, {throwError, proceedRetry, cancelRetry})
                    }
                    if (!ctx.runtime.retry) {
                        throw ctx.runtime.error
                    }
                    const { initialDelay, baseDelay, factor, jitter } = ctx.backoff
                    ctx.runtime.delay = this._calculateDelay(initialDelay, baseDelay, factor, ctx.runtime.attempt, jitter, ctx.setting.maxDelay)
                    const setDelay = (delay: number) => ctx.runtime.delay = delay
                    for(const func of ctx.interceptors.onRetry) {
                        await func(ctx, {setAttempt, throwError, setDelay})
                    }
                    await new Promise((resolve, reject) => {
                        const timer = setTimeout(resolve, ctx.runtime.delay);
                        const abortHandler = () => {
                            clearTimeout(timer);
                            reject(ctx.controller.signal.reason);
                        };
                        if (ctx.controller.signal.aborted) return abortHandler();
                        ctx.controller.signal.addEventListener("abort", abortHandler, { once: true });
                    });
                }
                finally {
                    clearTimeout(timerId)
                    if(listener) ctx.runtime.signal.removeEventListener("abort", listener)
                }
                ctx.runtime.attempt++
            }
            throw new VigorRetryError("EXHAUSTED", {
                method: "request",
                type: "retry",
                data: {
                    maxAttempts: ctx.setting.count,
                }
            })
        }
        catch(error: unknown) {
            ctx.runtime.error = error
            let overrided = false
            const setResult = (result: T) => { overrided = true ;return (ctx.runtime.result = result)}
            for(const func of ctx.interceptors.onError) {
                await func(ctx, {setResult, throwError})
            }
            if(overrided && ctx.runtime.result !== EMPTY) return ctx.runtime.result as T
            if (ctx.setting.default !== EMPTY) return ctx.setting.default as T
            throw error
        }
    }
}

type VigorParseConfig<T, O = false> = {
    target?: Response,
    original: O,
    type?: (keyof Response) | undefined,
    result?: T
}

class VigorParse<T, O extends boolean = false> extends VigorStatus<VigorParseConfig<T, O>> {
    constructor(config: Partial<VigorParseConfig<T, O> & { original: O }> = {}) {
        super(config, {
            original: false as O
        })
    }
    public static stategy = [
        { key: /text/, parse: (res: Response) => res.text(), type: "text" },
        { key: /json/, parse: (res: Response) => res.json(), type: "json" },
        { key: /multipart\/form-data/, parse: (res: Response) => res.formData(), type: "formData" },
        { key: /octet-stream/, parse: (res: Response) => res.arrayBuffer(), type: "arrayBuffer" },
        { key: /(image|video|audio|pdf)/, parse: (res: Response) => res.blob(), type: "blob" },
    ]
    public static supported = this.stategy.map(i => i.type)
    private _transfer<U, B extends boolean>(config: Partial<VigorParseConfig<U, B>>) { return new VigorParse<U, B>({...this._config as unknown as VigorParseConfig<U, B>, ...config}) }

    public target(res: Response): this { return this._next({target: res}) }
    public original<B extends boolean>(bool: B): VigorParse<T, B> { return this._transfer<T, B>({...this._config, original: bool}) }
    public type<K extends keyof Response>(type: K): VigorParse<Response[K] extends (...args: any) => Promise<infer R> ? R : never, O> { return this._transfer<Response[K] extends (...args: any) => Promise<infer R> ? R : never, O>({...this._config, result: undefined, type}) }
    public async request<U = T>(): Promise<O extends true ? Response : U> {
        const config = this._config;
        if (!(config.target instanceof Response)) {
            throw new VigorParseError("TARGET_MISSING", {
                method: "request",
                type: "args_missing",
                data: undefined
            })
        }
        if (config.original) {
            return config.target as O extends true ? Response : U;
        }
        const contentType = config.target.headers.get("Content-Type") || ""
        let strategy
        try {
            if(config.type) {
                strategy = {type: config.type}
                const parser = config.target[config.type]
                if(!parser || typeof parser !== 'function') throw new VigorParseError("PARSE_FAILED", {
                    method: "request",
                    type: "parse_failed",
                    data: {
                        expected: strategy?.type ?? "unknown"
                    }
                })
                
                return await parser()
            }
            strategy = VigorParse.stategy.find(i => i.key.test(contentType)) ?? VigorParse.stategy[0]
            return await strategy.parse(config.target)
        } catch(error) {
            if (error instanceof VigorParseError) throw error;
            throw new VigorParseError("PARSE_FAILED", {
                method: "request",
                type: "parse_failed",
                data: {
                    expected: strategy?.type ?? "unknown"
                }
            })
        }
    }
}

type VigorFetchMethods = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "CONNECT" | "TRACE"

type VigorFetchSettingsConfig<T> = {
    origin?: string;
    path?: Array<string>;
    query?: object,
    unretry?: Array<number>,
    retryHeaders?: Array<string>,
    method?: VigorFetchMethods,
    headers?: HeadersInit | Record<string, any>;
    body?: XMLHttpRequestBodyInit | object | null;
    options?: object;
    default?: T|typeof EMPTY
}

class VigorFetchSettings<T> extends VigorStatus<VigorFetchSettingsConfig<T>> {
    constructor(config: Partial<VigorFetchSettingsConfig<T>> = {}) {
        super(config, {
            origin: "",
            path: [],
            query: {},
            unretry: [400, 401, 403, 404, 405, 413, 422],
            retryHeaders: ["retry-after", "ratelimit-reset", "x-ratelimit-reset", "x-retry-after", "x-amz-retry-after", "chrome-proxy-next-link"],
            default: EMPTY
        })
    }
    public origin(str: string): VigorFetchSettings<T> { return this._next({ origin: str }) }
    public path(...strs: (string | string[])[]): VigorFetchSettings<T> { return this._next({ path: [...this._config.path!, ...strs.flat()] }) }
    public query(obj: object): VigorFetchSettings<T> { return this._next({ query: { ...this._config.query, ...obj } }) }
    public unretry(...numbers: (number | number[])[]): VigorFetchSettings<T> { return this._next({ unretry: numbers.flat() }) }
    public retryHeaders(...strs: (string | string[])[]): VigorFetchSettings<T> { return this._next({ retryHeaders: [...this._config.retryHeaders!, ...strs.flat()] }) }
    public method(str: VigorFetchMethods): VigorFetchSettings<T> { return this._next({ method: str }) }
    public headers(obj: HeadersInit | Record<string, any>): VigorFetchSettings<T> { return this._next({ headers: obj }) }
    public body(obj: XMLHttpRequestBodyInit | object | null): VigorFetchSettings<T> { return this._next({ body: obj }) }
    public options(obj: object): VigorFetchSettings<T> { return this._next({ options: obj }) }
    public default(obj: T): VigorFetchSettings<T> { return this._next({ default: obj }) }
}


type VigorFetchBefore<T> = {
    setOptions?: (obj: object) => void
    throwError?: (error: Error) => void;
}

type VigorFetchAfter<T> = {
    throwError?: (error: Error) => void;
}

type VigorFetchOnError<T> = {
    setResult?: (result: T) => T;
    throwError?: (error: Error) => void;
}

type VigorFetchResult<T> = {
    setResult?: (result: T) => T;
    throwError?: (error: Error) => void;
}

type VigorFetchFn<T, O> = (ctx: VigorFetchContext<T>, obj: O) => void|any | Promise<void|any>

type VigorFetchBeforeFn<T> = VigorFetchFn<T, VigorFetchBefore<T>>
type VigorFetchAfterFn<T> = VigorFetchFn<T, VigorFetchAfter<T>>
type VigorFetchOnErrorFn<T> = VigorFetchFn<T, VigorFetchOnError<T>>
type VigorFetchResultFn<T> = VigorFetchFn<T, VigorFetchResult<T>>

type VigorFetchInterceptorsConfig<T> = {
    before: VigorFetchBeforeFn<T>[],
    after: VigorFetchAfterFn<T>[],
    onError: VigorFetchOnErrorFn<T>[],
    result: VigorFetchResultFn<T>[],
}

class VigorFetchInterceptors<T> extends VigorStatus<VigorFetchInterceptorsConfig<T>> {
    constructor(config: Partial<VigorFetchInterceptorsConfig<T>> = {}) {
        super(config, {
            before: [],
            after: [],
            onError: [],
            result: []
        })
    }
    public before(...funcs: VigorIncludeSpread<VigorFetchBeforeFn<T>>): VigorFetchInterceptors<T> { return this._next({ before: [...this.getConfig().before, ...funcs.flat()] }) }
    public after(...funcs: VigorIncludeSpread<VigorFetchAfterFn<T>>): VigorFetchInterceptors<T> { return this._next({ after: [...this.getConfig().after, ...funcs.flat()] }) }
    public onError(...funcs:VigorIncludeSpread<VigorFetchOnErrorFn<T>>): VigorFetchInterceptors<T> { return this._next({ onError: [...this.getConfig().onError, ...funcs.flat()] }) }
    public result(...funcs: VigorIncludeSpread<VigorFetchResultFn<T>>): VigorFetchInterceptors<T> { return this._next({ result: [...this.getConfig().result, ...funcs.flat()] }) }
}

type VigorFetchConfig<T> = {
    setting: VigorFetchSettingsConfig<T>;
    retryConfig: VigorRetryConfig<T>;
    parseConfig: VigorParseConfig<T>;
    interceptors: VigorFetchInterceptorsConfig<T>
}

type VigorFetchContext<T> = VigorFetchConfig<T> & {
    runtime: {
        retryEngine?: VigorRetry<T>;
        parseEngine?: VigorParse<T>;
        unretrySet?: Set<number>;
        url?: string;
        baseOptions?: object;
        options?: object;
        response?: Response;
        result?: T|typeof EMPTY;
        error?: unknown
    }
}

class VigorFetch<T> extends VigorStatus<VigorFetchConfig<T>> {
    constructor(config: Partial<VigorFetchConfig<T>> = {}) {
        super(config, {
            setting: new VigorFetchSettings<T>().getBase(),
            retryConfig: new VigorRetry<T>().getBase(),
            parseConfig: new VigorParse<T>().getBase(),
            interceptors: new VigorFetchInterceptors<T>().getBase(),
        })
    }
    public origin(str: string): this { return this._next({ setting: { ...this._config.setting, origin: str } }) }
    public path(...strs: (string | string[])[]): this { return this._next({ setting: { ...this._config.setting, path: [...this._config.setting.path!, ...strs.flat()] } }) }
    public query(obj: object): this { return this._next({ setting: { ...this._config.setting, query: { ...this._config.setting.query, ...obj } } }) }
    public method(str: VigorFetchMethods): this { return this._next({ setting: {...this._config.setting, method: str} }) }
    public headers(obj: HeadersInit | Record<string, any>): this { return this._next({ setting: {...this._config.setting, headers: obj} }) }
    public body(obj: XMLHttpRequestBodyInit | object | null): this { return this._next({ setting: {...this._config.setting, body: obj} }) }
    public options(obj: object): this { return this._next({ setting: {...this._config.setting, options: obj} }) }
    public setting(func: (r: VigorFetchSettings<T>) => VigorFetchSettings<T>): this {
        return this._next({setting: this._pipsub(this._config.setting, func, VigorFetchSettings)})
    }
    public interceptors(func: (r: VigorFetchInterceptors<T>) => VigorFetchInterceptors<T>): this {
        return this._next({interceptors: this._pipsub(this._config.interceptors, func, VigorFetchInterceptors)})
    }
    public retryConfig(func: (r: VigorRetry<T>) => VigorRetry<T>): this {
        return this._next({retryConfig: this._pipsub(this._config.retryConfig, func, VigorRetry)})
    }
    public parseConfig(func: (r: VigorParse<T>) => VigorParse<T>): this {
        return this._next({parseConfig: this._pipsub(this._config.parseConfig, func, VigorParse)})
    }
    public buildUrl(origin: string, path: string[], query: object): string {
        if (!origin) throw new VigorFetchError("INVALID_URL", {
            method: "buildUrl",
            data: {
                received: origin
            }
        })

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
            if (v == null) continue;

            if (Array.isArray(v)) {
                v.forEach(i => params.append(k, String(i)));
            } else {
                params.set(k, String(v));
            }
        }

        url.search = params.toString();

        return url.toString();
    }
    public async request<U = T>(): Promise<U> {
        const config = this._config
        let ctx: VigorFetchContext<T> = {
            setting: {...config.setting},
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
        }
        const throwError = (error?: Error) => {throw error}
        try {
            ctx.runtime.unretrySet = new Set(ctx.setting.unretry)
            if (!/^(https?|data|blob|file|about):\/\//.test(ctx.setting.origin!)) throw new VigorFetchError("INVALID_PROTOCOL", {
                method: "request",
                data: {
                    expected: ["http", "https", "data", "blob", "file", "about"],
                    received: ctx.setting.origin
                }
            })
            ctx.runtime.url = this.buildUrl(config.setting.origin!, config.setting.path!, config.setting.query!)
            const isJson: boolean = Array.isArray(ctx.setting.body) || (!!ctx.setting.body && Object.getPrototypeOf(ctx.setting.body) === Object.prototype);
            ctx.runtime.baseOptions = {
                method: ctx.setting.method || (ctx.setting.body ? "POST" : "GET"),
                headers: { ...(isJson && { "Content-Type": "application/json" }), ...ctx.setting.headers },
                ...(ctx.setting.body && { body: isJson ? JSON.stringify(ctx.setting.body) : ctx.setting.body }),
                ...ctx.setting.options,
                signal: null
            }

            const target: VigorRetryTask<T> = async(ctx2, {signal}) => {
                ctx.runtime.options = {
                    ...ctx.runtime.baseOptions,
                    signal
                }
                const response = await fetch(ctx.runtime.url!, ctx.runtime.options)
                return response as Response as T;
            }
            const checkOk: VigorRetryAfterFn<T> = async(ctx2, {throwError}) => {
                const result = ctx2.runtime.result as Response
                if(!result.ok) return throwError?.(new VigorFetchError("FETCH_ERROR", {
                    method: "request",
                    type: "fetch_error",
                    data: {
                        status: result.status,
                        statusText: result.statusText,
                        url: result.url
                    }
                }))
            }
            const handleBlacklist: VigorRetryRetryIfFn<T> = (ctx2, {cancelRetry}) => {
                const result = ctx2.runtime.result as Response
                if(!result?.status || ctx.runtime.unretrySet!.has(result.status)) cancelRetry?.()
            }
            const handle429: VigorRetryOnRetryFn<T> = (ctx2, {setDelay}) => {
                const result = ctx2.runtime.result as Response
                if(result?.status === 429) {
                    let rHeader: string | null = null;
                    ctx.setting.retryHeaders!.some(h => (rHeader = result.headers.get(h)));
                    if(rHeader) {
                        setDelay?.(isNaN(Number(rHeader)) ? new Date(rHeader).getTime() - Date.now() : Number(rHeader) * 1000)
                    }
                }
            }
            ctx.retryConfig.target = target
            ctx.retryConfig.interceptors.after.unshift(checkOk)
            ctx.retryConfig.interceptors.retryIf.unshift(handleBlacklist)
            ctx.retryConfig.interceptors.onRetry.unshift(handle429)
            ctx.runtime.retryEngine = new VigorRetry(ctx.retryConfig)
            ctx.runtime.parseEngine = new VigorParse(ctx.parseConfig)

            const setOptions = (obj: object) => ctx.runtime.baseOptions = obj
            for(const func of ctx.interceptors.before) {
                await func(ctx, {setOptions, throwError})
            }
            ctx.runtime.response = await ctx.runtime.retryEngine.request() as Response
            for(const func of ctx.interceptors.after) {
                await func(ctx, {throwError})
            }
            ctx.runtime.result = await ctx.runtime.parseEngine?.target(ctx.runtime.response).request() as T
            const setResult = (result: T) => ctx.runtime.result = result
            for(const func of ctx.interceptors.result) {
                await func(ctx, {setResult, throwError})
            }
            return ctx.runtime.result as unknown as U
        }
        catch(error) {
            ctx.runtime.error = error
            let overrided = false
            const setResult = (result: T) => { overrided = true ;return (ctx.runtime.result = result)}
            for(const func of ctx.interceptors.onError) {
                await func(ctx, {setResult, throwError})
            }
            if(overrided && ctx.runtime.result !== EMPTY) return ctx.runtime.result as unknown as U
            if (ctx.setting.default !== EMPTY) return ctx.setting.default as unknown as U
            throw error
        }
    }
}









type VigorAllSettingsConfig = {
    concurrency: number,
    jitter: number,
    onlySuccess: boolean
}

class VigorAllSettings extends VigorStatus<VigorAllSettingsConfig> {
    constructor(config: Partial<VigorAllSettingsConfig> = {}) {
        super(config, {
            concurrency: 5,
            jitter: 1000,
            onlySuccess: false
        })
    }
    public concurrency(num: number): VigorAllSettings { return this._next({ concurrency: num }) }
    public jitter(num: number): VigorAllSettings { return this._next({ jitter: num }) }
    public onlySuccess(bool: boolean): VigorAllSettings { return this._next({ onlySuccess: bool }) }
}

type VigorAllBefore = {
    throwError?: (error: Error) => void;
}

type VigorAllAfter = {
    setResult?: (result: any) => any
    throwError?: (error: Error) => void;
}

type VigorAllOnError = {
    setResult?: (result: any) => any;
    throwError?: (error: Error) => void;
}

type VigorAllResult = {
    setResult?: (result: Array<any>) => Array<any>;
    throwError?: (error: Error) => void;
}

type VigorAllFn<O> = (ctx: VigorAllContext<any>, obj: O) => void|any | Promise<void|any>

type VigorAllTaskFn<O> = (ctx: VigorAllTaskContext<any>, obj: O) => void|any | Promise<void|any>

type VigorAllBeforeFn = VigorAllTaskFn<VigorAllBefore>
type VigorAllAfterFn = VigorAllTaskFn<VigorAllAfter>
type VigorAllOnErrorFn = VigorAllTaskFn<VigorAllOnError>
type VigorAllResultFn = VigorAllFn<VigorAllResult>

type VigorAllInterceptorsConfig = {
    before: VigorAllBeforeFn[],
    after: VigorAllAfterFn[],
    onError: VigorAllOnErrorFn[],
    result: VigorAllResultFn[],
}

class VigorAllInterceptors extends VigorStatus<VigorAllInterceptorsConfig> {
    constructor(config: Partial<VigorAllInterceptorsConfig> = {}) {
        super(config, {
            before: [],
            after: [],
            onError: [],
            result: []
        })
    }
    public before(...funcs: (VigorAllBeforeFn | VigorAllBeforeFn[])[]): VigorAllInterceptors { return this._next({ before: [...this.getConfig().before, ...funcs.flat()] }) }
    public after(...funcs: (VigorAllAfterFn | VigorAllAfterFn[])[]): VigorAllInterceptors { return this._next({ after: [...this.getConfig().after, ...funcs.flat()] }) }
    public onError(...funcs: (VigorAllOnErrorFn | VigorAllOnErrorFn[])[]): VigorAllInterceptors { return this._next({ onError: [...this.getConfig().onError, ...funcs.flat()] }) }
    public result(...funcs: (VigorAllResultFn | VigorAllResultFn[])[]): VigorAllInterceptors { return this._next({ result: [...this.getConfig().result, ...funcs.flat()] }) }
}

type VigorAllOptionsTask = {
    abort?: (error: Error) => void;
    signal?: AbortSignal;
}

type VigorAllTask<R = any> =
    (ctx: VigorAllTaskContext<any>, obj: VigorAllOptionsTask) =>
        R | Promise<R>;

type TaskReturn<T> = T extends VigorAllTask<infer R> ? R : never ;

type MapTasks<T extends readonly VigorAllTask<any>[]> = {
    [K in keyof T]:
    T[K] extends VigorAllTask<infer R> ? R : never;
}

type VigorAllConfig<Tasks extends readonly VigorAllTask<any>[]> = {
    target: Tasks
    setting: VigorAllSettingsConfig
    interceptors: VigorAllInterceptorsConfig
}

type VigorAllContext<Tasks extends readonly VigorAllTask<any>[]> = VigorAllConfig<Tasks> & {
    runtime: {
        tasks: {
            [K in keyof Tasks]: Promise<TaskReturn<Tasks[K]>>
        };
        result: {
            [K in keyof Tasks]: TaskReturn<Tasks[K]> | Error
        };
    }
}

type VigorAllTaskContext<Task extends VigorAllTask<any>> = {
    target: Task
    runtime: {
        result: TaskReturn<Task>|typeof EMPTY,
        error: unknown,
        jitter: number
    }
}

class VigorAll<Tasks extends readonly VigorAllTask<any>[]> extends VigorStatus<VigorAllConfig<Tasks>> {
    constructor(config: Partial<VigorAllConfig<Tasks>> = {}) {
        super(config, {
            target: [] as unknown as Tasks,
            setting: new VigorAllSettings().getBase(),
            interceptors: new VigorAllInterceptors().getBase()
        })
    }
    private _transfer<U extends readonly VigorAllTask<any>[]>(
        config: Partial<VigorAllConfig<U>>
        ): VigorAll<U> {
        return new VigorAll<U>({
            ...this._config as unknown as VigorAllConfig<U>,
            ...config
        })
    }
    public target<T extends readonly VigorAllTask<any>[]>(
        ...funcs: T
        ): VigorAll<T> {
        return this._transfer<T>({
            target: funcs
        })
    }
    public setting(func: (r: VigorAllSettings) => VigorAllSettings): this {
        return this._next({
            setting: this._pipsub(this._config.setting, func, VigorAllSettings)
        })
    }
    public interceptors(func: (r: VigorAllInterceptors) => VigorAllInterceptors): this {
        return this._next({
            interceptors: this._pipsub(this._config.interceptors, func, VigorAllInterceptors)
        })
    }
    public async request(): Promise<MapTasks<Tasks>> {
        const config = this._config
        let ctx: VigorAllContext<Tasks> = {
            setting: {...config.setting},
            target: [...config.target] as unknown as Tasks,
            interceptors: {
                before: [...config.interceptors.before],
                after: [...config.interceptors.after],
                onError: [...config.interceptors.onError],
                result: [...config.interceptors.result],
            },
            runtime: {
                tasks: [] as any,
                result: [] as any,
            }
        }
        if (ctx.target.length == 0)
            throw new VigorAllError("TARGET_MISSING", {
                method: "request",
                data: undefined
            })
        let active = 0;
        const queue: (() => void)[] = [];
        const runTask = async <K extends number>(
            task: Tasks[K]
        ): Promise<TaskReturn<Tasks[K]>> => {
            await new Promise<void>(resolve => {
                if (active < config.setting.concurrency) {
                    active++;
                    resolve();
                } else {
                    queue.push(() => {
                        active++;
                        resolve();
                    });
                }
            })
            const throwError = (error?: Error) => { throw error }
            let ctxTask: VigorAllTaskContext<typeof task> = {
                target: task,
                runtime: {
                    result: EMPTY,
                    error: null,
                    jitter: VigorRetryBackoff.randomJitter(config.setting.jitter)
                }
            }
            try {
                await new Promise(resolve => setTimeout(resolve, ctxTask.runtime.jitter))
                for (const func of config.interceptors.before) {
                    await func(ctxTask, { throwError })
                }
                ctxTask.runtime.result = await task(ctxTask, {})
                const setResult = (result: any) => ctxTask.runtime.result = result
                for (const func of config.interceptors.after) {
                    await func(ctxTask, { setResult, throwError })
                }
                if (ctxTask.runtime.result === EMPTY) {
                    throw new Error("Result not set");
                }

                return ctxTask.runtime.result

            } catch (error) {
                ctxTask.runtime.error = error
                let overrided = false
                const setResult = (result: any) => {
                    overrided = true
                    return (ctxTask.runtime.result = result)
                }
                for (const func of config.interceptors.onError) {
                    await func(ctxTask, { setResult, throwError })
                }
                if (overrided && ctxTask.runtime.result !== EMPTY) return ctxTask.runtime.result
                throw ctxTask.runtime.error
            } finally {
                active--;
                const next = queue.shift();
                if (next) next();
            }
        }
        ctx.runtime.tasks = ctx.target.map(task => runTask(task)) as any
        const settled = await Promise.allSettled(ctx.runtime.tasks)
        const isFailed = Symbol("FAILED")
        ctx.runtime.result = settled.map((res, idx) => {
            if (res.status === "fulfilled") return res.value;
            if(ctx.setting.onlySuccess) return isFailed
            return new VigorAllError("REQUEST_FAILED", {
                method: "request",
                data: {
                    index: idx,
                    error: res.reason
                }
            })
        }).filter(i => i !== isFailed) as any
        const setResult = (result: any[]) =>
            ctx.runtime.result = result as any
        const throwError = (error?: Error) => { throw error }
        for (const func of config.interceptors.result) {
            await func(ctx as any, { setResult, throwError })
        }
        return ctx.runtime.result as any
    }
}

type VigorRegistry = {
    VigorRetry: {
        main: <T>() => VigorRetry<T>;
        error: typeof VigorRetryError;
        setting: typeof VigorRetrySettings;
        interceptors: typeof VigorRetryInterceptors;
        backoff: typeof VigorRetryBackoff;
    };

    VigorFetch: {
        main: <T>() => VigorFetch<T>;
        error: typeof VigorFetchError;
        setting: typeof VigorFetchSettings;
        interceptors: typeof VigorFetchInterceptors;
    };

    VigorAll: {
        main: () => VigorAll<any>,
        error: typeof VigorAllError;
        setting: typeof VigorAllSettings;
        interceptors: typeof VigorAllInterceptors;
    }

    VigorParse: {
        main: <T>() => VigorParse<T>;
        error: typeof VigorParseError;
    };
};

type VigorConfig = {
    registry: VigorRegistry;
};

class Vigor  {
    private readonly registry: VigorRegistry;    
    constructor(config?: Partial<VigorConfig>) {
        const defaultRegistry: VigorRegistry = {
            VigorRetry: {
                main: <R>() => new VigorRetry<R>(),
                error: VigorRetryError,
                setting: VigorRetrySettings,
                interceptors: VigorRetryInterceptors,
                backoff: VigorRetryBackoff,
            },

            VigorFetch: {
                main: <R>() => new VigorFetch<R>(),
                error: VigorFetchError,
                setting: VigorFetchSettings,
                interceptors: VigorFetchInterceptors,
            },

            VigorAll: {
                main: () => new VigorAll<any>(),
                error: VigorAllError,
                setting: VigorAllSettings,
                interceptors: VigorAllInterceptors,
            },

            VigorParse: {
                main: <R>() => new VigorParse<R>(),
                error: VigorParseError,
            }
        };
        this.registry = config?.registry ?? defaultRegistry;
    }
    public fetch(origin: string) {
        return this.registry.VigorFetch.main().origin(origin);
    }

    public all<T extends VigorAllTask<any>[] | readonly VigorAllTask<any>[]>(
        ...args: T extends any ? (T[number] | T)[] : never
    ) {
        const flatTasks = args.flat() as VigorAllTask<any>[];

        return this.registry.VigorAll
            .main()
            .target(...flatTasks);
    }
    public parse(response: Response) {
        return this.registry.VigorParse.main().target(response);
    }

    public retry<T>(fn: VigorRetryTask<T>) {
        return this.registry.VigorRetry.main<T>().target(fn);
    }
    public use(
        plugin: (ctx: VigorRegistry, options?: object) => void,
        options?: object
    ): Vigor {
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
        }

        plugin(nextRegistry, options);

        return new Vigor({
            registry: nextRegistry
        });
    }
}
const vigor = new Vigor()

export default vigor
export {
    VigorRetry, VigorRetryError, VigorRetrySettings, VigorRetryInterceptors, VigorRetryBackoff,
    VigorFetch, VigorFetchError, VigorFetchSettings, VigorFetchInterceptors,
    VigorAll, VigorAllError, VigorAllSettings, VigorAllInterceptors,
    VigorParse, VigorParseError,
    Vigor, vigor
}