abstract class VigorError extends Error {
    public readonly timestamp: Date;
    public readonly method?: string;
    public readonly cause?: unknown;
    public readonly context?: unknown;
    public readonly type?: string;
    public readonly data?: unknown;
    constructor(
        message: string,
        options?: {
            method?: string,
            cause?: unknown;
            context?: unknown;
            type?: string,
            data?: unknown
        }
    ) {
        super(message, { cause: options?.cause });

        this.name = new.target.name;
        this.timestamp = new Date();
        if (options?.method !== undefined) this.method = options.method;
        if (options?.context !== undefined) this.context = options.context;
        if (options?.type !== undefined) this.type = options.type;
        if (options?.data !== undefined) this.data = options.data;

        Object.setPrototypeOf(this, new.target.prototype);
        (Error as any).captureStackTrace?.(this, new.target);
    }
}


class VigorRetryError extends VigorError {
    constructor(
        message: string,
        options?: any
    ) {
        super(message, options)
    }
}

class VigorParseError extends VigorError {
    constructor(
        message: string,
        options?: any
    ) {
        super(message, options)
    }
}

class VigorFetchError extends VigorError {
    constructor(
        message: string,
        options?: any
    ) {
        super(message, options)
    }
}

class VigorAllError extends VigorError {
    constructor(
        message: string,
        options?: any
    ) {
        super(message, options)
    }
}

abstract class VigorStatus<T, Self> {
    constructor(
        protected readonly _config: T,
        private readonly _ctor: (config: T) => Self,
        private readonly _errorCtor?: () => new (message: string, data: any) => Error
    ) {

    }

    protected _create(config: T): Self { return this._ctor(config) }
    protected _next(config: Partial<T>): Self { return this._create({ ...this._config, ...config }) }
    public getConfig(): T { return this._config }
    protected _pipeSub<C, R extends VigorStatus<any, any>>(
        value: C,
        Ctor: new (c: C) => R,
        fn: (r: R) => R,
        errorKey: string
    ): C {
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

type VigorRetrySettingsConfig<T> = {
    count: number,
    limit: number,
    maxDelay: number,
    default?: T,
}

class VigorRetrySettings<T> extends VigorStatus<VigorRetrySettingsConfig<T>, VigorRetrySettings<T> > {
    private _base: VigorRetrySettingsConfig<T>
    constructor(config?:  Partial<VigorRetrySettingsConfig<T>>) {
        const base: VigorRetrySettingsConfig<T> = {
            count: 5,
            limit: 10000,
            maxDelay: 10000,
        }
        super({...base, ...config}, (c) => new VigorRetrySettings(c))
        this._base = base
    }
    public getBase(): VigorRetrySettingsConfig<T> { return this._base }
    public count(num: number): VigorRetrySettings<T> { return this._next({ count: num }) }
    public limit(num: number): VigorRetrySettings<T> { return this._next({ limit: num }) }
    public maxDelay(num: number): VigorRetrySettings<T> { return this._next({ maxDelay: num }) }
    public default(obj: T): VigorRetrySettings<T> { return this._next({ default: obj }) }
}

type VigorRetryBackoffConfig = {
    initialDelay: number,
    baseDelay: number,
    factor: number,
    jitter: number
}

class VigorRetryBackoff extends VigorStatus<VigorRetryBackoffConfig, VigorRetryBackoff > {
    private readonly _base: VigorRetryBackoffConfig;
    constructor(config?: Partial<VigorRetryBackoffConfig>) {
        const base = {
            initialDelay: 0,
            baseDelay: 1000,
            factor: 1.7,
            jitter: 1000
        }
        super({...base, ...config}, (c) => new VigorRetryBackoff(c))
        this._base = base
    }
    public getBase(): VigorRetryBackoffConfig { return this._base }
    public initialDelay(num: number): VigorRetryBackoff { return this._next({ initialDelay: num }) }
    public baseDelay(num: number): VigorRetryBackoff { return this._next({ baseDelay: num }) }
    public factor(num: number): VigorRetryBackoff { return this._next({ factor: num }) }
    public jitter(num: number): VigorRetryBackoff { return this._next({ jitter: num }) }
}

type VigorRetryBefore<T> = {
    setAttempt?: (attempt: number) => number;
    throwError?: (error: Error) => void;
    abort?: (error: Error) => void;
}

type VigorRetryAfter<T> = {
    setAttempt?: (attempt: number) => number;
    throwError?: (error: Error) => void;
    setResult?: (result: T) => T;
}

type VigorRetryRetryIf<T> = {
    throwError?: (error: Error) => void;
    proceedRetry?: () => boolean;
    cancelRetry?: (error?: Error) => boolean;
}

type VigorRetryOnRetry<T> = {
    setAttempt?: (attempt: number) => number;
    throwError?: (error: Error) => void;
    setDelay?: (delay: number) => number;
}

type VigorRetryOnError<T> = {
    setResult?: (result: T) => T;
    throwError?: (error: Error) => void;
}

type VigorRetryBeforeFn<T> =
  (ctx: VigorRetryContext<T>, obj: VigorRetryBefore<T>) => void | Promise<void>

type VigorRetryAfterFn<T> =
  (ctx: VigorRetryContext<T>, obj: VigorRetryAfter<T>) => void | Promise<void>

type VigorRetryOnErrorFn<T> =
  (ctx: VigorRetryContext<T>, obj: VigorRetryOnError<T>) => void | Promise<void>

type VigorRetryOnRetryFn<T> =
  (ctx: VigorRetryContext<T>, obj: VigorRetryOnRetry<T>) => void | Promise<void>

type VigorRetryRetryIfFn<T> =
  (ctx: VigorRetryContext<T>, obj: VigorRetryRetryIf<T>) => void | Promise<void>

type VigorRetryOptionsTask<T> = {
    abort?: (error: Error) => void;
    signal?: AbortSignal;
}

type VigorRetryTask<T> = (ctx: VigorRetryContext<T>, obj: VigorRetryOptionsTask<T>) => T | Promise<T>;


type VigorRetryInterceptorsConfig<T> = {
    before: VigorRetryBeforeFn<T>[],
    after: VigorRetryAfterFn<T>[],
    onError: VigorRetryOnErrorFn<T>[],
    onRetry: VigorRetryOnRetryFn<T>[],
    retryIf: VigorRetryRetryIfFn<T>[]
}

class VigorRetryInterceptors<T> extends VigorStatus<VigorRetryInterceptorsConfig<T>, VigorRetryInterceptors<T>> {
    private readonly _base: VigorRetryInterceptorsConfig<T>
    constructor(config?: Partial<VigorRetryInterceptorsConfig<T>>) {
        const base = {
            before: [],
            after: [],
            onError: [],
            onRetry: [],
            retryIf: []
        }
        super({...base, ...config}, (c) => new VigorRetryInterceptors<T>(c))
        this._base = base
    }
    public getBase(): VigorRetryInterceptorsConfig<T> { return this._base }
    public before(...funcs: (VigorRetryBeforeFn<T> | VigorRetryBeforeFn<T>[])[]): VigorRetryInterceptors<T> { return this._next({ before: [...this.getConfig().before, ...funcs.flat()] }) }
    public after(...funcs: (VigorRetryAfterFn<T> | VigorRetryAfterFn<T>[])[]): VigorRetryInterceptors<T> { return this._next({ after: [...this.getConfig().after, ...funcs.flat()] }) }
    public onError(...funcs:(VigorRetryOnErrorFn<T> | VigorRetryOnErrorFn<T>[])[]): VigorRetryInterceptors<T> { return this._next({ onError: [...this.getConfig().onError, ...funcs.flat()] }) }
    public onRetry(...funcs: (VigorRetryOnRetryFn<T> | VigorRetryOnRetryFn<T>[])[]): VigorRetryInterceptors<T> { return this._next({ onRetry: [...this.getConfig().onRetry, ...funcs.flat()] }) }
    public retryIf(...funcs: (VigorRetryRetryIfFn<T> | VigorRetryRetryIfFn<T>[])[]): VigorRetryInterceptors<T> { return this._next({ retryIf: [...this.getConfig().retryIf, ...funcs.flat()] }) }
}

type VigorRetryConfig<T> = {
    target: VigorRetryTask<T>,
    setting: VigorRetrySettingsConfig<T>,
    backoff: VigorRetryBackoffConfig,
    interceptors: VigorRetryInterceptorsConfig<T>
}

type VigorRetryContext<T> = {
    target: VigorRetryTask<T>,
    setting: VigorRetrySettingsConfig<T>,
    backoff: VigorRetryBackoffConfig,
    interceptors: VigorRetryInterceptorsConfig<T>,
    runtime: {
        result?: T;
        attempt: number;
        controller: AbortController;
        abortPromise?: Promise<never>;
        aborted: boolean;
        signal: AbortSignal;
        delay: number,
        retry: boolean,
        error?: unknown
    }
}

class VigorRetry<T> extends VigorStatus<VigorRetryConfig<T>, VigorRetry<T>> {
    private readonly _base: VigorRetryConfig<T>
    private _controller: AbortController = new AbortController();
    constructor(config?: VigorRetryConfig<T>) {
        const base = {
            target: null as any,
            setting: new VigorRetrySettings<T>().getBase(),
            backoff: new VigorRetryBackoff().getBase(),
            interceptors: new VigorRetryInterceptors<T>().getBase()
        }
        super({...base, ...config}, (c) => new VigorRetry(c), () => VigorRetryError)
        this._base = base
    }
    public getBase(): VigorRetryConfig<T> { return this._base }
    public target<U>(func: VigorRetryTask<U>): VigorRetry<U> { return new VigorRetry<U>({...this._config, target: func, setting: this._config.setting as unknown as VigorRetrySettingsConfig<U>, interceptors: this._config.interceptors as unknown as VigorRetryInterceptorsConfig<U>}) }
    public createController(): (error: Error) => void { const controller = new AbortController(); this._controller = controller; return (error: Error) => controller.abort(error) }
    public setting(func: (r: VigorRetrySettings<T>) => VigorRetrySettings<T>): VigorRetry<T> {
        return this._next({
            setting: this._pipeSub(
                this._config.setting,
                VigorRetrySettings,
                func,
                "setting"
            )
        });
    }
    public backoff(func: (r: VigorRetryBackoff) => VigorRetryBackoff): VigorRetry<T> {
        return this._next({
            backoff: this._pipeSub(
                this._config.backoff,
                VigorRetryBackoff,
                func,
                "backoff"
            )
        });
    }
    public interceptors(func: (r: VigorRetryInterceptors<T>) => VigorRetryInterceptors<T>): VigorRetry<T> {
        return this._next({
            interceptors: this._pipeSub(
                this._config.interceptors,
                VigorRetryInterceptors,
                func,
                "interceptors"
            )
        });
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
            runtime: {
                result: null as T,
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
                ctx.runtime.attempt++
                
                ctx.runtime.controller = new AbortController()
                let listener: EventListener|undefined
                let timerId:ReturnType<typeof setTimeout> | undefined
                const setAttempt = (attempt: number) => ctx.runtime.attempt = attempt
                const abort = (error: Error) => { if(!ctx.runtime.aborted) {ctx.runtime.controller?.abort(error);} }
                try {
                    ctx.runtime.signal = AbortSignal.any([
                        this._controller.signal, 
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
                            abort(new VigorRetryError(
                                `timeouted after ${ctx.setting.limit}`,
                                {method: "request", type: "timeout",data: {limit: ctx.setting.limit, attempt: ctx.runtime.attempt}}
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

                    ctx.runtime.delay = Math.min(ctx.setting.maxDelay, Math.max(0, ctx.backoff.initialDelay + ctx.backoff.baseDelay * Math.pow(ctx.backoff.factor, ctx.runtime.attempt - 1))) + calculateJitter(ctx.backoff.jitter)
                    const setDelay = (delay: number) => ctx.runtime.delay = delay
                    for(const func of ctx.interceptors.onRetry) {
                        await func(ctx, {setAttempt, throwError, setDelay})
                    }
                    await new Promise((resolve, reject) => {
                        const timer = setTimeout(resolve, ctx.runtime.delay);
                        const abortHandler = () => {
                            clearTimeout(timer);
                            reject(this._controller.signal.reason);
                        };
                        if (this._controller.signal.aborted) return abortHandler();
                        this._controller.signal.addEventListener("abort", abortHandler, { once: true });
                    });
                }
                finally {
                    clearTimeout(timerId)
                    if(listener) ctx.runtime.signal.removeEventListener("abort", listener)
                }
            }
            throw new VigorRetryError(
                `Maximum retry attempts (${ctx.setting.count}) reached. Task failed or timed out.`,
                {method: "request", type: "exhausted",data: {limit: ctx.setting.limit, attempt: ctx.runtime.attempt, maxAttempts: ctx.setting.count}}
            )
        }
        catch(error: unknown) {
            ctx.runtime.error = error
            let overrided = false
            const setResult = (result: T) => { overrided = true ;return (ctx.runtime.result = result)}
            for(const func of ctx.interceptors.onError) {
                await func(ctx, {setResult, throwError})
            }
            if(overrided && ctx.runtime.result !== undefined) return ctx.runtime.result
            if (ctx.setting.default !== undefined) return ctx.setting.default
            throw error
        }
    }
}

type VigorParseConfig<T> = {
    target?: Response,
    original: boolean,
    type?: keyof Response,
    result?: T
}

const basic = { key: /text/, parse: (res: Response) => res.text(), type: "text" };
const parser = [
    { key: /json/, parse: (res: Response) => res.json(), type: "json" },
    { key: /multipart\/form-data/, parse: (res: Response) => res.formData(), type: "formData" },
    { key: /octet-stream/, parse: (res: Response) => res.arrayBuffer(), type: "arrayBuffer" },
    { key: /(image|video|audio|pdf)/, parse: (res: Response) => res.blob(), type: "blob" },
    basic
]
const supported = parser.map(i => i.type)

class VigorParse<T extends any> extends VigorStatus<VigorParseConfig<T>, VigorParse<T> > {
    private _base: VigorParseConfig<T>
    constructor(config?:  Partial<VigorParseConfig<T>>) {
        const base: VigorParseConfig<T> = {
            original: false
        }
        super({...base, ...config}, (c) => new VigorParse(c))
        this._base = base
    }
    public getBase(): VigorParseConfig<T> { return this._base }

    public target(response: Response): VigorParse<T> { return this._next({ target: response }) }
    public original(bool: boolean): VigorParse<T> { return this._next({ original: bool }) }
    public type(str: keyof Response): VigorParse<T> { return this._next({ type: str }) }
    public async request(): Promise<T> {
        const config = this._config
        if(!config.target) throw new VigorParseError("target is required",
            {method: "request", type: "invalid_target", data: {
                expected: "Response",
                received: config.target,
            }}
        )
        if(config.original) return config.target as unknown as T
        const contentType = config.target.headers.get("Content-Type") || ""

        let strategy
        try {
            if(config.type) {
                strategy = {type: config.type}
                const parser = config.target[config.type]
                if(!parser || typeof parser !== 'function') throw new VigorParseError(`failed to parse: '${strategy?.type ?? "unknown"}'`,
                    {method: "request", type: "invalid_type", data: {
                        expected: config.type,
                        supported: supported,
                        response: config.target,
                        headers: contentType,
                    }}
                )
                
                return await parser()
            }
            strategy = parser.find(i => i.key.test(contentType)) ?? basic
            return await strategy.parse(config.target)
        } catch(error) {
            if (error instanceof VigorParseError) throw error;
            throw new VigorParseError(`failed to parse: '${strategy?.type ?? "unknown"}'`,
                {method: "request", type: "parse_failed", data: {
                    expected: strategy?.type ?? "unknown",
                    supported: supported,
                    response: config.target,
                    headers: contentType,
                    error
                }}
            )
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
    default?: T
}

class VigorFetchSettings<T> extends VigorStatus<VigorFetchSettingsConfig<T>, VigorFetchSettings<T> > {
    private _base: VigorFetchSettingsConfig<T>
    constructor(config?:  Partial<VigorFetchSettingsConfig<T>>) {
        const base: VigorFetchSettingsConfig<T> = {
            origin: "",
            path: [],
            query: {},
            unretry: [400, 401, 403, 404, 405, 413, 422],
            retryHeaders: ["retry-after", "ratelimit-reset", "x-ratelimit-reset", "x-retry-after", "x-amz-retry-after", "chrome-proxy-next-link"],
        }
        super({...base, ...config}, (c) => new VigorFetchSettings(c))
        this._base = base
    }
    public getBase(): VigorFetchSettingsConfig<T> { return this._base }
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

type VigorFetchBeforeFn<T> =
  (ctx: VigorFetchContext<T>, obj: VigorFetchBefore<T>) => void | Promise<void>

type VigorFetchAfterFn<T> =
  (ctx: VigorFetchContext<T>, obj: VigorFetchAfter<T>) => void | Promise<void>

type VigorFetchOnErrorFn<T> =
  (ctx: VigorFetchContext<T>, obj: VigorFetchOnError<T>) => void | Promise<void>

type VigorFetchResultFn<T> =
  (ctx: VigorFetchContext<T>, obj: VigorFetchResult<T>) => void | Promise<void>


type VigorFetchInterceptorsConfig<T> = {
    before: VigorFetchBeforeFn<T>[],
    after: VigorFetchAfterFn<T>[],
    onError: VigorFetchOnErrorFn<T>[],
    result: VigorFetchResultFn<T>[],
}

class VigorFetchInterceptors<T> extends VigorStatus<VigorFetchInterceptorsConfig<T>, VigorFetchInterceptors<T>> {
    private readonly _base: VigorFetchInterceptorsConfig<T>
    constructor(config?: Partial<VigorFetchInterceptorsConfig<T>>) {
        const base = {
            before: [],
            after: [],
            onError: [],
            result: []
        }
        super({...base, ...config}, (c) => new VigorFetchInterceptors<T>(c))
        this._base = base
    }
    public getBase(): VigorFetchInterceptorsConfig<T> { return this._base }
    public before(...funcs: (VigorFetchBeforeFn<T> | VigorFetchBeforeFn<T>[])[]): VigorFetchInterceptors<T> { return this._next({ before: [...this.getConfig().before, ...funcs.flat()] }) }
    public after(...funcs: (VigorFetchAfterFn<T> | VigorFetchAfterFn<T>[])[]): VigorFetchInterceptors<T> { return this._next({ after: [...this.getConfig().after, ...funcs.flat()] }) }
    public onError(...funcs:(VigorFetchOnErrorFn<T> | VigorFetchOnErrorFn<T>[])[]): VigorFetchInterceptors<T> { return this._next({ onError: [...this.getConfig().onError, ...funcs.flat()] }) }
    public result(...funcs: (VigorFetchResultFn<T> | VigorFetchResultFn<T>[])[]): VigorFetchInterceptors<T> { return this._next({ result: [...this.getConfig().result, ...funcs.flat()] }) }
}

type VigorFetchConfig<T> = {
    setting: VigorFetchSettingsConfig<T>;
    retryConfig: VigorRetryConfig<T>;
    parseConfig: VigorParseConfig<T>;
    interceptors: VigorFetchInterceptorsConfig<T>
}

type VigorFetchContext<T> = {
    setting: VigorFetchSettingsConfig<T>;
    retryConfig: VigorRetryConfig<T>;
    parseConfig: VigorParseConfig<T>;
    interceptors: VigorFetchInterceptorsConfig<T>;
    runtime: {
        retryEngine?: VigorRetry<T>;
        parseEngine?: VigorParse<T>;
        unretrySet?: Set<number>;
        url?: string;
        baseOptions?: object;
        options?: object;
        response?: Response;
        result?: T;
        error?: unknown
    }
}


class VigorFetch<T extends any> extends VigorStatus<VigorFetchConfig<T>, VigorFetch<T> > {
    private readonly _base: VigorFetchConfig<T>
    constructor(config?: VigorFetchConfig<T>) {
        const base = {
            setting: new VigorFetchSettings<T>().getBase(),
            retryConfig: new VigorRetry<T>().getBase(),
            parseConfig: new VigorParse<T>().getBase(),
            interceptors: new VigorFetchInterceptors<T>().getBase(),
        }
        super({...base, ...config}, (c) => new VigorFetch(c), () => VigorRetryError)
        this._base = base
    }
    public getBase(): VigorFetchConfig<T> { return this._base }
    public origin(str: string): VigorFetch<T> { return this._next({ setting: { ...this._config.setting, origin: str } }) }
    public path(...strs: (string | string[])[]): VigorFetch<T> { return this._next({ setting: { ...this._config.setting, path: [...this._config.setting.path!, ...strs.flat()] } }) }
    public query(obj: object): VigorFetch<T> { return this._next({ setting: { ...this._config.setting, query: { ...this._config.setting.query, ...obj } } }) }
    public method(str: VigorFetchMethods): VigorFetch<T> { return this._next({ setting: {...this._config.setting, method: str} }) }
    public headers(obj: HeadersInit | Record<string, any>): VigorFetch<T> { return this._next({ setting: {...this._config.setting, headers: obj} }) }
    public body(obj: XMLHttpRequestBodyInit | object | null): VigorFetch<T> { return this._next({ setting: {...this._config.setting, body: obj} }) }
    public options(obj: object): VigorFetch<T> { return this._next({ setting: {...this._config.setting, options: obj} }) }
    public setting(func: (r: VigorFetchSettings<T>) => VigorFetchSettings<T>): VigorFetch<T> {
        return this._next({
            setting: this._pipeSub(
                this._config.setting,
                VigorFetchSettings,
                func,
                "setting"
            )
        });
    }
    public retryConfig(func: (r: VigorRetry<T>) => VigorRetry<T>): VigorFetch<T> {
        return this._next({
            retryConfig: this._pipeSub(
                this._config.retryConfig,
                VigorRetry,
                func,
                "retryConfig"
            )
        });
    }
    public parseConfig(func: (r: VigorParse<T>) => VigorParse<T>): VigorFetch<T> {
        return this._next({
            parseConfig: this._pipeSub(
                this._config.parseConfig,
                VigorParse,
                func,
                "parseConfig"
            )
        });
    }
    public buildUrl(origin: string, path: Array<string>, query: object): string {
        if(!origin) throw new VigorFetchError("buildUrl expects 'origin'", {
            type: "invalid_input", method: "buildUrl", data: {
                expected: "string", received: origin
            }
        })
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
                    if (value === null || value === undefined) return;
                    if (Array.isArray(value)) {
                        value.forEach(v => url.searchParams.append(key, String(v)));
                    } else {
                        url.searchParams.set(key, String(value));
                    }
                });
            }

            return url.toString();
        } catch (e) {
            throw new VigorFetchError(`Invalid URL origin: ${origin}`, {
                type: "invalid_url", method: "buildUrl", data: { error: e }
            });
        }
    }
    public interceptors(func: (r: VigorFetchInterceptors<T>) => VigorFetchInterceptors<T>): VigorFetch<T> {
        return this._next({
            interceptors: this._pipeSub(
                this._config.interceptors,
                VigorFetchInterceptors,
                func,
                "interceptors"
            )
        });
    }
    public async request(): Promise<T> {
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
            }
        }
        const throwError = (error?: Error) => {throw error}
        try {
            ctx.runtime.unretrySet = new Set(ctx.setting.unretry)
            if (!/^(https?|data|blob|file|about):\/\//.test(ctx.setting.origin!)) throw new VigorFetchError(`Invalid Protocol`,
                { type: "Invalid Protocol", method: "request", data: {
                    expected: ["http", "https", "data", "blob", "file", "about"], received: ctx.setting.origin
                }}
            );
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
                if(!result.ok) return throwError?.(new VigorFetchError(`HTTP Error: ${result.status} ${result.statusText}`, {
                    method: "request", type: "fetch_error",
                    data: {status: result.status, statusText: result.statusText, url: result.url}
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
            ctx.runtime.result = await ctx.runtime.parseEngine?.target(ctx.runtime.response).request()
            const setResult = (result: T) => ctx.runtime.result = result
            for(const func of ctx.interceptors.result) {
                await func(ctx, {setResult, throwError})
            }
            return ctx.runtime.result
        }
        catch(error) {
            ctx.runtime.error = error
            let overrided = false
            const setResult = (result: T) => { overrided = true ;return (ctx.runtime.result = result)}
            for(const func of ctx.interceptors.onError) {
                await func(ctx, {setResult, throwError})
            }
            if(overrided && ctx.runtime.result !== undefined) return ctx.runtime.result
            if (ctx.setting.default !== undefined) return ctx.setting.default
            throw error
        }
    }
}




type VigorAllSettingsConfig<T> = {
    concurrency: number,
    jitter: number
}

class VigorAllSettings<T> extends VigorStatus<VigorAllSettingsConfig<T>, VigorAllSettings<T> > {
    private _base: VigorAllSettingsConfig<T>
    constructor(config?:  Partial<VigorAllSettingsConfig<T>>) {
        const base: VigorAllSettingsConfig<T> = {
            concurrency: 5,
            jitter: 1000
        }
        super({...base, ...config}, (c) => new VigorAllSettings(c))
        this._base = base
    }
    public getBase(): VigorAllSettingsConfig<T> { return this._base }
    public concurrency(num: number): VigorAllSettings<T> { return this._next({ concurrency: num }) }
    public jitter(num: number): VigorAllSettings<T> { return this._next({ jitter: num }) }
}

type VigorAllBefore<T> = {
    throwError?: (error: Error) => void;
}

type VigorAllAfter<T> = {
    setResult?: (result: T) => T
    throwError?: (error: Error) => void;
}

type VigorAllOnError<T> = {
    setResult?: (result: T) => T;
    throwError?: (error: Error) => void;
}

type VigorAllResult<T> = {
    setResult?: (result: Array<T>) => Array<T>;
    throwError?: (error: Error) => void;
}

type VigorAllBeforeFn<T> =
  (ctx: VigorAllContext<T>, obj: VigorAllBefore<T>) => void | Promise<void>

type VigorAllAfterFn<T> =
  (ctx: VigorAllContext<T>, obj: VigorAllAfter<T>) => void | Promise<void>

type VigorAllOnErrorFn<T> =
  (ctx: VigorAllContext<T>, obj: VigorAllOnError<T>) => void | Promise<void>

type VigorAllResultFn<T> =
  (ctx: VigorAllContext<T>, obj: VigorAllResult<T>) => void | Promise<void>


type VigorAllInterceptorsConfig<T> = {
    before: VigorAllBeforeFn<T>[],
    after: VigorAllAfterFn<T>[],
    onError: VigorAllOnErrorFn<T>[],
    result: VigorAllResultFn<T>[],
}

class VigorAllInterceptors<T> extends VigorStatus<VigorAllInterceptorsConfig<T>, VigorAllInterceptors<T>> {
    private readonly _base: VigorAllInterceptorsConfig<T>
    constructor(config?: Partial<VigorAllInterceptorsConfig<T>>) {
        const base = {
            before: [],
            after: [],
            onError: [],
            result: []
        }
        super({...base, ...config}, (c) => new VigorAllInterceptors<T>(c))
        this._base = base
    }
    public getBase(): VigorAllInterceptorsConfig<T> { return this._base }
    public before(...funcs: (VigorAllBeforeFn<T> | VigorAllBeforeFn<T>[])[]): VigorAllInterceptors<T> { return this._next({ before: [...this.getConfig().before, ...funcs.flat()] }) }
    public after(...funcs: (VigorAllAfterFn<T> | VigorAllAfterFn<T>[])[]): VigorAllInterceptors<T> { return this._next({ after: [...this.getConfig().after, ...funcs.flat()] }) }
    public onError(...funcs:(VigorAllOnErrorFn<T> | VigorAllOnErrorFn<T>[])[]): VigorAllInterceptors<T> { return this._next({ onError: [...this.getConfig().onError, ...funcs.flat()] }) }
    public result(...funcs: (VigorAllResultFn<T> | VigorAllResultFn<T>[])[]): VigorAllInterceptors<T> { return this._next({ result: [...this.getConfig().result, ...funcs.flat()] }) }
}

type VigorAllOptionsTask<T> = {
    abort?: (error: Error) => void;
    signal?: AbortSignal;
}

type VigorAllTask<T> = (ctx: VigorAllContext<T>, obj: VigorAllOptionsTask<T>) => T | Promise<T>;

type VigorAllConfig<T> = {
    target: Array<VigorAllTask<T>>
    setting: VigorAllSettingsConfig<T>;
    interceptors: VigorAllInterceptorsConfig<T>
}

type VigorAllContext<T> = {
    target?: Array<VigorAllTask<T>>
    setting: VigorAllSettingsConfig<T>;
    interceptors: VigorAllInterceptorsConfig<T>;
    runtime: {
        tasks: Array<Promise<T>>,
        result: Array<T|Error>
    }
}

class VigorAll<T extends any> extends VigorStatus<VigorAllConfig<T>, VigorAll<T> > {
    private readonly _base: VigorAllConfig<T>
    constructor(config?: VigorAllConfig<T>) {
        const base = {
            target: [],
            setting: new VigorAllSettings<T>().getBase(),
            interceptors: new VigorAllInterceptors<T>().getBase()
        }
        super({...base, ...config}, (c) => new VigorAll(c), () => VigorAllError)
        this._base = base
    }
    public getBase(): VigorAllConfig<T> { return this._base }
    public target(...funcs: (VigorAllTask<T> | VigorAllTask<T>[])[]): VigorAll<T> { return this._next({target: [...this._config.target, ...funcs.flat()]}) }
    public setting(func: (r: VigorAllSettings<T>) => VigorAllSettings<T>): VigorAll<T> {
        return this._next({
            setting: this._pipeSub(
                this._config.setting,
                VigorAllSettings,
                func,
                "setting"
            )
        });
    }
    public interceptors(func: (r: VigorAllInterceptors<T>) => VigorAllInterceptors<T>): VigorAll<T> {
        return this._next({
            interceptors: this._pipeSub(
                this._config.interceptors,
                VigorAllInterceptors,
                func,
                "interceptors"
            )
        });
    }
    public async request() {
        const config = this._config
        let ctx: VigorAllContext<T> = {
            target: [...config.target],
            setting: {...config.setting},
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
        }
        if(ctx.target?.length==0) throw new VigorFetchError("request expects 'target'", {
            type: "invalid_input", method: "request", data: {
                expected: "string", received: ctx.target
            }
        })

        let active = 0;
        const queue: (() => void)[] = [];
        const runTask = async(task: VigorAllTask<T>) => {
            await new Promise<void>(resolve => {
                if (active < ctx.setting.concurrency) {
                    active++;
                    resolve();
                } else {
                    queue.push(() => {
                        active++;
                        resolve();
                    });
                }
            })
            const throwError = (error?: Error) => {throw error}
            try {
                await new Promise(resolve => setTimeout(resolve, calculateJitter(ctx.setting.jitter)))
                let res: T
                for(const func of ctx.interceptors.before) {
                    await func(ctx, {throwError})
                }
                res = await task(ctx, {})
                const setResult = (result: T) => res = result
                for(const func of ctx.interceptors.after) {
                    await func(ctx, {setResult, throwError})
                }
                return res
            } catch(error) {
                let res: T
                let overrided = false
                const setResult = (result: T) => { overrided = true ;return (res = result)}
                for(const func of ctx.interceptors.onError) {
                    await func(ctx, {setResult, throwError})
                }
                if(overrided && res! !== undefined) return res
                throw error
            } finally {
                active--;
                const next = queue.shift();
                if (next) next();
            }
        }

        ctx.runtime.tasks = ctx.target!.map(task => runTask(task))

        const settled = await Promise.allSettled(ctx.runtime.tasks)
        ctx.runtime.result = settled.map(i => {
            if (i.status === "fulfilled") return i.value;
            return new VigorAllError(`this request failed`, {
                method: "request", type: "request_failed", data: {
                    error: i.reason
                }
            })
        })
        const setResult = (result: Array<T>) => ctx.runtime.result = result
        const throwError = (error?: Error) => {throw error}
        for(const func of ctx.interceptors.result) {
            await func(ctx, {setResult, throwError})
        }
        return ctx.runtime.result
    }
}

function calculateJitter(jitter: number) {
    return jitter * (Math.random() * 2 - 1)
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
        main: <T>() => VigorAll<T>;
        error: typeof VigorAllError;
        setting: typeof VigorAllSettings;
        interceptors: typeof VigorAllInterceptors;
    };

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
                main: () => new VigorRetry<any>(),
                error: VigorRetryError,
                setting: VigorRetrySettings,
                interceptors: VigorRetryInterceptors,
                backoff: VigorRetryBackoff,
            },

            VigorFetch: {
                main: () => new VigorFetch<any>(),
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
                main: () => new VigorParse<any>(),
                error: VigorParseError,
            }
        };
        this.registry = config?.registry ?? defaultRegistry;
    }
    public fetch(origin: string) {
        return this.registry.VigorFetch.main().origin(origin);
    }

    public all<T>(tasks: (VigorAllTask<T> | VigorAllTask<T>[])[]) {
        return this.registry.VigorAll.main<T>().target(tasks.flat());
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