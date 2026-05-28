declare const VigorErrorMessageFuncs: {
    INVALID_TARGET: ({ expected, received }: {
        expected: Array<string>;
        received: unknown;
    }) => string;
    EXHAUSTED: ({ maxAttempts }: {
        maxAttempts: number;
    }) => string;
    TIMED_OUT: ({ limit, attempt }: {
        limit: number;
        attempt: number;
    }) => string;
    INVALID_CONTENT_TYPE: ({ expected, received, response }: {
        expected: Array<string>;
        received: unknown;
        response: Response;
    }) => string;
    PARSER_NOT_FOUND: ({ expected, received, response }: {
        expected: Array<string>;
        received: unknown;
        response: Response;
    }) => string;
    PARSER_ALL_FAILED: ({ tried, response }: {
        tried: Array<unknown>;
        response: Response;
    }) => string;
    INVALID_PROTOCOL: ({ expected, received }: {
        expected: Array<string>;
        received: unknown;
    }) => string;
    INVALID_BODY: ({ expected, received }: {
        expected: Array<string>;
        received: unknown;
    }) => string;
    FETCH_FAILED: ({ status, response, url, headers, body, statusText }: {
        status: number;
        response: Response;
        url: string;
        headers: unknown;
        body: unknown;
        statusText: string;
    }) => string;
    EMPTY_TARGET: ({}: {}) => string;
};
type VigorErrorCodes = keyof typeof VigorErrorMessageFuncs;
type VigorErrorDatas<C extends VigorErrorCodes> = Parameters<typeof VigorErrorMessageFuncs[C]> extends [infer A] ? A : undefined;
type VigorErrorOptions<C extends VigorErrorCodes, S, T> = {
    cause?: unknown;
    data?: VigorErrorDatas<C>;
    method: string;
    stats?: S;
    context?: T;
};
declare abstract class VigorError<C extends VigorErrorCodes, S, T> extends Error {
    readonly timestamp: Date;
    readonly cause?: unknown;
    readonly code: C;
    readonly data: VigorErrorDatas<C> | undefined;
    readonly method: string;
    readonly stats: S | undefined;
    readonly context: T | undefined;
    constructor(code: C, options: VigorErrorOptions<C, S, T>);
}
declare class VigorRetryError<C extends "INVALID_TARGET" | "EXHAUSTED" | "TIMED_OUT"> extends VigorError<C, VigorRetryConfig, VigorRetryContext> {
    constructor(code: C, options: VigorErrorOptions<C, VigorRetryConfig, VigorRetryContext>);
}
declare class VigorParseError<C extends "INVALID_CONTENT_TYPE" | "PARSER_NOT_FOUND" | "PARSER_ALL_FAILED" | "INVALID_TARGET"> extends VigorError<C, VigorParseConfig, VigorParseContext> {
    constructor(code: C, options: VigorErrorOptions<C, VigorParseConfig, VigorParseContext>);
}
declare class VigorFetchError<C extends "INVALID_PROTOCOL" | "INVALID_BODY" | "FETCH_FAILED"> extends VigorError<C, VigorFetchConfig, VigorFetchContext> {
    constructor(code: C, options: VigorErrorOptions<C, VigorFetchConfig, VigorFetchContext>);
}
declare class VigorAllError<C extends "EMPTY_TARGET"> extends VigorError<C, VigorAllConfig, VigorAllContext | VigorAllEachContext> {
    constructor(code: C, options: VigorErrorOptions<C, VigorAllConfig, VigorAllContext | VigorAllEachContext>);
}
declare abstract class VigorStatus<C, Self> {
    protected readonly _base: C;
    protected readonly ctor: (config: C) => Self;
    protected readonly _config: C;
    constructor(config: Partial<C> | undefined, _base: C, ctor: (config: C) => Self);
    protected _mergeConfig<C>(source: any, target: C | Partial<C> | undefined): C;
    protected _next(config: Partial<C>): Self;
    _getConfig(): C;
    _getBase(): C;
}
type VigorIncludeSpread<T> = Array<T | Array<T>>;
type VigorRetrySettingsConfig = {
    default: unknown;
    timeout: number;
    attempt: number;
    jitter: number;
};
declare class VigorRetrySettings extends VigorStatus<VigorRetrySettingsConfig, VigorRetrySettings> {
    constructor(config?: Partial<VigorRetrySettingsConfig>);
    default(unk: VigorRetrySettingsConfig["default"]): VigorRetrySettings;
    timeout(num: VigorRetrySettingsConfig["timeout"]): VigorRetrySettings;
    attempt(num: VigorRetrySettingsConfig["attempt"]): VigorRetrySettings;
    jitter(num: VigorRetrySettingsConfig["jitter"]): VigorRetrySettings;
}
type VigorRetryInterceptorsConfig = {
    before: Array<VigorRetryInterceptorsFunctions["before"]>;
    after: Array<VigorRetryInterceptorsFunctions["after"]>;
    result: Array<VigorRetryInterceptorsFunctions["result"]>;
    retryIf: Array<VigorRetryInterceptorsFunctions["retryIf"]>;
    onRetry: Array<VigorRetryInterceptorsFunctions["onRetry"]>;
    onError: Array<VigorRetryInterceptorsFunctions["onError"]>;
};
declare class VigorRetryInterceptors extends VigorStatus<VigorRetryInterceptorsConfig, VigorRetryInterceptors> {
    constructor(config?: Partial<VigorRetryInterceptorsConfig>);
    before(...funcs: VigorIncludeSpread<VigorRetryInterceptorsConfig["before"][number]>): VigorRetryInterceptors;
    after(...funcs: VigorIncludeSpread<VigorRetryInterceptorsConfig["after"][number]>): VigorRetryInterceptors;
    result(...funcs: VigorIncludeSpread<VigorRetryInterceptorsConfig["result"][number]>): VigorRetryInterceptors;
    retryIf(...funcs: VigorIncludeSpread<VigorRetryInterceptorsConfig["retryIf"][number]>): VigorRetryInterceptors;
    onRetry(...funcs: VigorIncludeSpread<VigorRetryInterceptorsConfig["onRetry"][number]>): VigorRetryInterceptors;
    onError(...funcs: VigorIncludeSpread<VigorRetryInterceptorsConfig["onError"][number]>): VigorRetryInterceptors;
}
type VigorRetryAlgorithmsConstantConfig = {
    interval: number;
};
declare class VigorRetryAlgorithmsConstant extends VigorStatus<VigorRetryAlgorithmsConstantConfig, VigorRetryAlgorithmsConstant> {
    constructor(config?: Partial<VigorRetryAlgorithmsConstantConfig>);
    interval(num: VigorRetryAlgorithmsConstantConfig["interval"]): VigorRetryAlgorithmsConstant;
}
type VigorRetryAlgorithmsLinearConfig = {
    initial: number;
    increment: number;
    minDelay: number;
    maxDelay: number;
};
declare class VigorRetryAlgorithmsLinear extends VigorStatus<VigorRetryAlgorithmsLinearConfig, VigorRetryAlgorithmsLinear> {
    constructor(config?: Partial<VigorRetryAlgorithmsLinearConfig>);
    initial(num: VigorRetryAlgorithmsLinearConfig["initial"]): VigorRetryAlgorithmsLinear;
    increment(num: VigorRetryAlgorithmsLinearConfig["increment"]): VigorRetryAlgorithmsLinear;
    minDelay(num: VigorRetryAlgorithmsLinearConfig["minDelay"]): VigorRetryAlgorithmsLinear;
    maxDelay(num: VigorRetryAlgorithmsLinearConfig["maxDelay"]): VigorRetryAlgorithmsLinear;
}
type VigorRetryAlgorithmsBackoffConfig = {
    initial: number;
    multiplier: number;
    unit: number;
    minDelay: number;
    maxDelay: number;
};
declare class VigorRetryAlgorithmsBackoff extends VigorStatus<VigorRetryAlgorithmsBackoffConfig, VigorRetryAlgorithmsBackoff> {
    constructor(config?: Partial<VigorRetryAlgorithmsBackoffConfig>);
    initial(num: VigorRetryAlgorithmsBackoffConfig["initial"]): VigorRetryAlgorithmsBackoff;
    multiplier(num: VigorRetryAlgorithmsBackoffConfig["multiplier"]): VigorRetryAlgorithmsBackoff;
    unit(num: VigorRetryAlgorithmsBackoffConfig["unit"]): VigorRetryAlgorithmsBackoff;
    minDelay(num: VigorRetryAlgorithmsBackoffConfig["minDelay"]): VigorRetryAlgorithmsBackoff;
    maxDelay(num: VigorRetryAlgorithmsBackoffConfig["maxDelay"]): VigorRetryAlgorithmsBackoff;
}
type VigorRetryAlgorithmsCustomConfig = {
    func: VigorRetryAlgorithmsConfig;
    minDelay: number;
    maxDelay: number;
};
declare class VigorRetryAlgorithmsCustom extends VigorStatus<VigorRetryAlgorithmsCustomConfig, VigorRetryAlgorithmsCustom> {
    constructor(config?: Partial<VigorRetryAlgorithmsCustomConfig>);
    func(num: VigorRetryAlgorithmsCustomConfig["func"]): VigorRetryAlgorithmsCustom;
}
type VigorRetryAlgorithmsConfig = (attempt: number) => number;
type VigorRetryInterceptorsApi<R> = {
    setResult: (unk: R) => void;
    throwError: <E extends Error>(err: E) => never;
    breakRetry: <E extends Error>(err: E) => never;
    proceedRetry: () => void;
    cancelRetry: () => void;
    setDelay: <D extends number>(num: D) => void;
    setAttempt: <A extends number>(num: A) => void;
    restart: () => void;
    abort: <E extends Error>(err: E) => void;
};
type VigorRetryInterceptorsFn<A extends keyof VigorRetryInterceptorsApi<R>, R = unknown> = (ctx: VigorRetryContext, api: Pick<VigorRetryInterceptorsApi<R>, A>) => void | Promise<void>;
type VigorRetryInterceptorsFunctions = {
    before: VigorRetryInterceptorsFn<"throwError" | "breakRetry" | "abort">;
    after: VigorRetryInterceptorsFn<"setResult" | "throwError" | "breakRetry">;
    result: VigorRetryInterceptorsFn<"setResult" | "throwError">;
    retryIf: VigorRetryInterceptorsFn<"proceedRetry" | "cancelRetry">;
    onRetry: VigorRetryInterceptorsFn<"throwError" | "setDelay" | "setAttempt">;
    onError: VigorRetryInterceptorsFn<"setResult" | "throwError" | "restart">;
};
type VigorRetryConfig = {
    target: (ctx: VigorRetryContext, { abort, signal }: {
        abort: VigorRetryInterceptorsApi<any>["abort"];
        signal: AbortSignal;
    }) => unknown | Promise<unknown>;
    settings: VigorRetrySettingsConfig;
    interceptors: VigorRetryInterceptorsConfig;
    algorithm: VigorRetryAlgorithmsConfig;
    abortSignals: Array<AbortSignal>;
};
type VigorRetryContext = {
    result: unknown;
    error: unknown;
    attempt: number;
    delay: number;
    controller: AbortController;
    timeline: Array<{
        action: string;
        content?: unknown;
    }>;
    stats: VigorRetryConfig;
};
declare class VigorRetry extends VigorStatus<VigorRetryConfig, VigorRetry> {
    constructor(config?: Partial<VigorRetryConfig>);
    private RetryAlgorithms;
    target(func: VigorRetryConfig["target"]): VigorRetry;
    settings(func: ((s: VigorRetrySettings) => VigorRetrySettings) | VigorRetryConfig["settings"]): VigorRetry;
    interceptors(func: ((i: VigorRetryInterceptors) => VigorRetryInterceptors) | VigorRetryConfig["interceptors"]): VigorRetry;
    algorithms(func: (a: typeof this.RetryAlgorithms) => {
        _calculateDelay: VigorRetryConfig["algorithm"];
    }): VigorRetry;
    abortSignals(...abortSignals: VigorIncludeSpread<AbortSignal>): VigorRetry;
    request<R>(config?: VigorRetryConfig, timeline?: VigorRetryContext["timeline"]): Promise<R>;
}
type VigorParseSettingsConfig = {
    raw: boolean;
    default: unknown;
};
declare class VigorParseSettings extends VigorStatus<VigorParseSettingsConfig, VigorParseSettings> {
    constructor(config?: Partial<VigorParseSettingsConfig>);
    original(bool: VigorParseSettingsConfig["raw"]): VigorParseSettings;
    default(unk: VigorParseSettingsConfig["default"]): VigorParseSettings;
}
type VigorParseStrategiesConfig = {
    funcs: Array<(response: Response) => Promise<any>>;
};
declare class VigorParseStrategies extends VigorStatus<VigorParseStrategiesConfig, VigorParseStrategies> {
    constructor(config?: Partial<VigorParseStrategiesConfig>);
    private ParseAutoHeaders;
    private ParseAutoMethods;
    private ParseAutoAlgorithms;
    contentType(): VigorParseStrategies;
    sniff(): VigorParseStrategies;
    json(): VigorParseStrategies;
    text(): VigorParseStrategies;
    arrayBuffer(): VigorParseStrategies;
    blob(): VigorParseStrategies;
    bytes(): VigorParseStrategies;
    formData(): VigorParseStrategies;
}
type VigorParseInterceptorsConfig = {
    before: Array<VigorParseInterceptorsFunctions["before"]>;
    after: Array<VigorParseInterceptorsFunctions["after"]>;
    result: Array<VigorParseInterceptorsFunctions["result"]>;
    onError: Array<VigorParseInterceptorsFunctions["onError"]>;
};
declare class VigorParseInterceptors extends VigorStatus<VigorParseInterceptorsConfig, VigorParseInterceptors> {
    constructor(config?: Partial<VigorParseInterceptorsConfig>);
    before(...funcs: VigorIncludeSpread<VigorParseInterceptorsConfig["before"][number]>): VigorParseInterceptors;
    after(...funcs: VigorIncludeSpread<VigorParseInterceptorsConfig["after"][number]>): VigorParseInterceptors;
    result(...funcs: VigorIncludeSpread<VigorParseInterceptorsConfig["result"][number]>): VigorParseInterceptors;
    onError(...funcs: VigorIncludeSpread<VigorParseInterceptorsConfig["onError"][number]>): VigorParseInterceptors;
}
type VigorParseInterceptorsApi<R> = {
    setResult: (unk: R) => void;
    throwError: <E extends Error>(err: E) => never;
};
type VigorParseInterceptorsFn<A extends keyof VigorParseInterceptorsApi<R>, R = unknown> = (ctx: VigorParseContext, api: Pick<VigorParseInterceptorsApi<R>, A>) => void | Promise<void>;
type VigorParseInterceptorsFunctions = {
    before: VigorParseInterceptorsFn<"throwError">;
    after: VigorParseInterceptorsFn<"setResult" | "throwError">;
    result: VigorParseInterceptorsFn<"setResult" | "throwError">;
    onError: VigorParseInterceptorsFn<"setResult" | "throwError">;
};
type VigorParseConfig = {
    target: Response;
    settings: VigorParseSettingsConfig;
    strategies: VigorParseStrategiesConfig;
    interceptors: VigorParseInterceptorsConfig;
};
type VigorParseContext = {
    stats: VigorParseConfig;
    timeline: Array<{
        action: string;
        content?: unknown;
    }>;
    result: unknown;
    error: unknown;
    response: Response;
};
declare class VigorParse extends VigorStatus<VigorParseConfig, VigorParse> {
    constructor(config?: Partial<VigorParseConfig>);
    target(response: VigorParseConfig["target"]): VigorParse;
    settings(func: ((i: VigorParseSettings) => VigorParseSettings) | VigorParseConfig["settings"]): VigorParse;
    strategies(func: ((i: VigorParseStrategies) => VigorParseStrategies) | VigorParseConfig["strategies"]): VigorParse;
    interceptors(func: ((i: VigorParseInterceptors) => VigorParseInterceptors) | VigorParseConfig["interceptors"]): VigorParse;
    request<R>(config?: VigorParseConfig, timeline?: VigorParseContext["timeline"]): Promise<R>;
}
type VigorFetchSettingsConfig = {
    unretryStatus: Array<number>;
    retryHeaders: Array<string>;
    default: unknown;
};
declare class VigorFetchSettings extends VigorStatus<VigorFetchSettingsConfig, VigorFetchSettings> {
    constructor(config?: Partial<VigorFetchSettingsConfig>);
    retryHeaders(...strs: VigorIncludeSpread<VigorFetchSettingsConfig["retryHeaders"][number]>): VigorFetchSettings;
    unretryStatus(...nums: VigorIncludeSpread<VigorFetchSettingsConfig["unretryStatus"][number]>): VigorFetchSettings;
    default(unk: VigorFetchSettingsConfig["default"]): VigorFetchSettings;
}
type VigorFetchInterceptorsConfig = {
    before: Array<VigorFetchInterceptorsFunctions["before"]>;
    after: Array<VigorFetchInterceptorsFunctions["after"]>;
    result: Array<VigorFetchInterceptorsFunctions["result"]>;
    onError: Array<VigorFetchInterceptorsFunctions["onError"]>;
};
declare class VigorFetchInterceptors extends VigorStatus<VigorFetchInterceptorsConfig, VigorFetchInterceptors> {
    constructor(config?: Partial<VigorFetchInterceptorsConfig>);
    before(...funcs: VigorIncludeSpread<VigorFetchInterceptorsConfig["before"][number]>): VigorFetchInterceptors;
    after(...funcs: VigorIncludeSpread<VigorFetchInterceptorsConfig["after"][number]>): VigorFetchInterceptors;
    result(...funcs: VigorIncludeSpread<VigorFetchInterceptorsConfig["result"][number]>): VigorFetchInterceptors;
    onError(...funcs: VigorIncludeSpread<VigorFetchInterceptorsConfig["onError"][number]>): VigorFetchInterceptors;
}
type VigorFetchOptions<T = Record<string, any>> = {
    headers: HeadersInit | Record<string, any>;
    body?: XMLHttpRequestBodyInit | object | null;
} & T;
type VigorFetchConfig = {
    origin: Array<string>;
    path: Array<string>;
    query: Array<Record<string, VigorStringable | Array<VigorStringable>>>;
    hash: string;
    options: VigorFetchOptions;
    settings: VigorFetchSettingsConfig;
    interceptors: VigorFetchInterceptorsConfig;
    retryConfig: VigorRetryConfig;
    parseConfig: VigorParseConfig;
};
type VigorFetchInterceptorsApi<R> = {
    setResult: (unk: R) => void;
    setOptions: (unk: VigorFetchContext["options"]) => void;
    setHeaders: (unk: VigorFetchConfig["options"]["headers"]) => void;
    setBody: (unk: VigorFetchConfig["options"]["body"]) => void;
    throwError: <E extends Error>(err: E) => never;
    restart: () => void;
};
type VigorFetchInterceptorsFn<A extends keyof VigorFetchInterceptorsApi<R>, R = unknown> = (ctx: VigorFetchContext, api: Pick<VigorFetchInterceptorsApi<R>, A>) => void | Promise<void>;
type VigorFetchInterceptorsFunctions = {
    before: VigorFetchInterceptorsFn<"throwError" | "setOptions" | "setHeaders" | "setBody">;
    after: VigorFetchInterceptorsFn<"setResult" | "throwError">;
    result: VigorFetchInterceptorsFn<"setResult" | "throwError">;
    onError: VigorFetchInterceptorsFn<"setResult" | "throwError" | "restart">;
};
type VigorFetchContext = {
    href: string;
    response: Response;
    result: unknown;
    error: unknown;
    options: VigorFetchOptions;
    timeline: Array<{
        action: string;
        content?: unknown;
    }>;
    stats: VigorFetchConfig;
};
type VigorStringable = string | number | boolean | null | undefined | Date;
declare class VigorFetch extends VigorStatus<VigorFetchConfig, VigorFetch> {
    constructor(config?: Partial<VigorFetchConfig>);
    private _stringifyList;
    origin(...strs: VigorIncludeSpread<VigorStringable>): VigorFetch;
    path(...strs: VigorIncludeSpread<VigorStringable>): VigorFetch;
    query(...strs: VigorIncludeSpread<VigorFetchConfig["query"][number]>): VigorFetch;
    hash(str: VigorFetchConfig["hash"]): VigorFetch;
    options(obj: VigorFetchConfig["options"]): VigorFetch;
    headers(obj: VigorFetchConfig["options"]["headers"]): VigorFetch;
    body(obj: VigorFetchConfig["options"]["body"]): VigorFetch;
    private _buildUrl;
    private _normalizeOptions;
    settings(func: ((s: VigorFetchSettings) => VigorFetchSettings) | VigorFetchConfig["settings"]): VigorFetch;
    interceptors(func: ((s: VigorFetchInterceptors) => VigorFetchInterceptors) | VigorFetchConfig["interceptors"]): VigorFetch;
    retryConfig(func: ((s: VigorRetry) => VigorRetry) | VigorFetchConfig["retryConfig"]): VigorFetch;
    parseConfig(func: ((s: VigorParse) => VigorParse) | VigorFetchConfig["parseConfig"]): VigorFetch;
    request<R>(config?: VigorFetchConfig, timeline?: VigorFetchContext["timeline"]): Promise<R>;
}
type VigorAllSettingsConfig = {
    concurrency: number;
    onlySuccess: boolean;
};
declare class VigorAllSettings extends VigorStatus<VigorAllSettingsConfig, VigorAllSettings> {
    constructor(config?: Partial<VigorAllSettingsConfig>);
    concurrency(num: VigorAllSettingsConfig["concurrency"]): VigorAllSettings;
    onlySuccess(num: VigorAllSettingsConfig["onlySuccess"]): VigorAllSettings;
}
type VigorAllInterceptorsConfig = {
    before: Array<VigorAllInterceptorsFunctions["before"]>;
    after: Array<VigorAllInterceptorsFunctions["after"]>;
    result: Array<VigorAllInterceptorsFunctions["result"]>;
    onError: Array<VigorAllInterceptorsFunctions["onError"]>;
};
declare class VigorAllInterceptors extends VigorStatus<VigorAllInterceptorsConfig, VigorAllInterceptors> {
    constructor(config?: Partial<VigorAllInterceptorsConfig>);
    before(...funcs: VigorIncludeSpread<VigorAllInterceptorsConfig["before"][number]>): VigorAllInterceptors;
    after(...funcs: VigorIncludeSpread<VigorAllInterceptorsConfig["after"][number]>): VigorAllInterceptors;
    result(...funcs: VigorIncludeSpread<VigorAllInterceptorsConfig["result"][number]>): VigorAllInterceptors;
    onError(...funcs: VigorIncludeSpread<VigorAllInterceptorsConfig["onError"][number]>): VigorAllInterceptors;
}
type VigorAllConfig = {
    target: Array<(ctx: VigorAllEachContext) => unknown | Promise<unknown>>;
    settings: VigorAllSettingsConfig;
    interceptors: VigorAllInterceptorsConfig;
};
type VigorAllInterceptorsApi<R> = {
    setResult: (unk: Array<R>) => void;
    throwError: <E extends Error>(err: E) => never;
};
type VigorAllInterceptorsEachApi<R> = {
    setResult: (unk: R) => void;
    throwError: <E extends Error>(err: E) => never;
};
type VigorAllInterceptorsFn<A extends keyof VigorAllInterceptorsApi<R>, R = unknown> = (ctx: VigorAllContext, api: Pick<VigorAllInterceptorsApi<R>, A>) => void | Promise<void>;
type VigorAllInterceptorsEachFn<A extends keyof VigorAllInterceptorsApi<R>, R = unknown> = (ctx: VigorAllEachContext, api: Pick<VigorAllInterceptorsEachApi<R>, A>) => void | Promise<void>;
type VigorAllInterceptorsFunctions = {
    before: VigorAllInterceptorsEachFn<"throwError">;
    after: VigorAllInterceptorsEachFn<"setResult" | "throwError">;
    result: VigorAllInterceptorsFn<"setResult" | "throwError">;
    onError: VigorAllInterceptorsEachFn<"setResult" | "throwError">;
};
type VigorAllContext = {
    result: Array<unknown>;
    timeline: Array<{
        action: string;
        content: unknown;
    }>;
    stats: VigorAllConfig;
    queue: Set<Promise<{
        success: boolean;
        value: unknown;
    }>>;
};
type VigorAllEachContext = {
    result: unknown;
    error: unknown;
    timeline: Array<{
        action: string;
        content: unknown;
    }>;
    stats: VigorAllConfig;
    root: VigorAllContext;
    target: VigorAllConfig["target"][number];
    semaphore: {
        acquire: () => Promise<void>;
        release: () => void;
    };
};
declare class VigorAll extends VigorStatus<VigorAllConfig, VigorAll> {
    constructor(config?: Partial<VigorAllConfig>);
    target(...funcs: VigorIncludeSpread<VigorAllConfig["target"][number]>): VigorAll;
    settings(func: ((s: VigorAllSettings) => VigorAllSettings) | VigorAllConfig["settings"]): VigorAll;
    interceptors(func: ((s: VigorAllInterceptors) => VigorAllInterceptors) | VigorAllConfig["interceptors"]): VigorAll;
    private runTask;
    request<R extends VigorAllContext["result"]>(config?: VigorAllConfig, timeline?: VigorAllContext["timeline"]): Promise<R>;
}
declare const VigorEntry: {
    retry: {
        main: typeof VigorRetry;
        settings: typeof VigorRetrySettings;
        interceptors: typeof VigorRetryInterceptors;
        error: typeof VigorRetryError;
        algorithms: {
            constant: typeof VigorRetryAlgorithmsConstant;
            linear: typeof VigorRetryAlgorithmsLinear;
            backoff: typeof VigorRetryAlgorithmsBackoff;
            custom: typeof VigorRetryAlgorithmsCustom;
        };
    };
    parse: {
        main: typeof VigorParse;
        settings: typeof VigorParseSettings;
        interceptors: typeof VigorParseInterceptors;
        error: typeof VigorParseError;
        strategies: typeof VigorParseStrategies;
    };
    fetch: {
        main: typeof VigorFetch;
        settings: typeof VigorFetchSettings;
        interceptors: typeof VigorFetchInterceptors;
        error: typeof VigorFetchError;
    };
    all: {
        main: typeof VigorAll;
        settings: typeof VigorAllSettings;
        interceptors: typeof VigorAllInterceptors;
        error: typeof VigorAllError;
    };
};
declare const vigor: {
    use: <C, R>(func: (entry: typeof VigorEntry, config: C) => R | Promise<R>, config: C) => Promise<R>;
    fetch: (...strs: Parameters<VigorFetch["origin"]>[0][]) => VigorFetch;
    retry: (target: Parameters<VigorRetry["target"]>[0]) => VigorRetry;
    parse: (response: Parameters<VigorParse["target"]>[0]) => VigorParse;
    all: (...funcs: Parameters<VigorAll["target"]>[0][]) => VigorAll;
    builder: {
        fetch: {
            settings: (c?: Partial<VigorFetchSettingsConfig>) => VigorFetchSettings;
            interceptors: (c?: Partial<VigorFetchInterceptorsConfig>) => VigorFetchInterceptors;
        };
        retry: {
            settings: (c?: Partial<VigorRetrySettingsConfig>) => VigorRetrySettings;
            interceptors: (c?: Partial<VigorRetryInterceptorsConfig>) => VigorRetryInterceptors;
        };
        parse: {
            settings: (c?: Partial<VigorParseSettingsConfig>) => VigorParseSettings;
            interceptors: (c?: Partial<VigorParseInterceptorsConfig>) => VigorParseInterceptors;
        };
        all: {
            settings: (c?: Partial<VigorAllSettingsConfig>) => VigorAllSettings;
            interceptors: (c?: Partial<VigorAllInterceptorsConfig>) => VigorAllInterceptors;
        };
    };
};

export { VigorEntry, vigor as default, vigor };
