declare abstract class VigorError extends Error {
    readonly timestamp: Date;
    readonly method?: string;
    readonly cause?: unknown;
    readonly context?: unknown;
    readonly type?: string;
    readonly data?: unknown;
    constructor(message: string, options?: {
        method?: string;
        cause?: unknown;
        context?: unknown;
        type?: string;
        data?: unknown;
    });
}
declare class VigorRetryError extends VigorError {
    constructor(message: string, options?: any);
}
declare class VigorParseError extends VigorError {
    constructor(message: string, options?: any);
}
declare class VigorFetchError extends VigorError {
    constructor(message: string, options?: any);
}
declare class VigorAllError extends VigorError {
    constructor(message: string, options?: any);
}
declare abstract class VigorStatus<T, Self> {
    protected readonly _config: T;
    private readonly _ctor;
    private readonly _errorCtor?;
    constructor(_config: T, _ctor: (config: T) => Self, _errorCtor?: (() => new (message: string, data: any) => Error) | undefined);
    protected _create(config: T): Self;
    protected _next(config: Partial<T>): Self;
    getConfig(): T;
    protected _pipeSub<C, R extends VigorStatus<any, any>>(value: C, Ctor: new (c: C) => R, fn: (r: R) => R, errorKey: string): C;
}
type VigorRetrySettingsConfig<T> = {
    count: number;
    limit: number;
    maxDelay: number;
    default?: T;
};
declare class VigorRetrySettings<T> extends VigorStatus<VigorRetrySettingsConfig<T>, VigorRetrySettings<T>> {
    private _base;
    constructor(config?: Partial<VigorRetrySettingsConfig<T>>);
    getBase(): VigorRetrySettingsConfig<T>;
    count(num: number): VigorRetrySettings<T>;
    limit(num: number): VigorRetrySettings<T>;
    maxDelay(num: number): VigorRetrySettings<T>;
    default(obj: T): VigorRetrySettings<T>;
}
type VigorRetryBackoffConfig = {
    initialDelay: number;
    baseDelay: number;
    factor: number;
    jitter: number;
};
declare class VigorRetryBackoff extends VigorStatus<VigorRetryBackoffConfig, VigorRetryBackoff> {
    private readonly _base;
    constructor(config?: Partial<VigorRetryBackoffConfig>);
    getBase(): VigorRetryBackoffConfig;
    initialDelay(num: number): VigorRetryBackoff;
    baseDelay(num: number): VigorRetryBackoff;
    factor(num: number): VigorRetryBackoff;
    jitter(num: number): VigorRetryBackoff;
}
type VigorRetryBefore<T> = {
    setAttempt?: (attempt: number) => number;
    throwError?: (error: Error) => void;
    abort?: (error: Error) => void;
};
type VigorRetryAfter<T> = {
    setAttempt?: (attempt: number) => number;
    throwError?: (error: Error) => void;
    setResult?: (result: T) => T;
};
type VigorRetryRetryIf<T> = {
    throwError?: (error: Error) => void;
    proceedRetry?: () => boolean;
    cancelRetry?: (error?: Error) => boolean;
};
type VigorRetryOnRetry<T> = {
    setAttempt?: (attempt: number) => number;
    throwError?: (error: Error) => void;
    setDelay?: (delay: number) => number;
};
type VigorRetryOnError<T> = {
    setResult?: (result: T) => T;
    throwError?: (error: Error) => void;
};
type VigorRetryBeforeFn<T> = (ctx: VigorRetryContext<T>, obj: VigorRetryBefore<T>) => void | Promise<void>;
type VigorRetryAfterFn<T> = (ctx: VigorRetryContext<T>, obj: VigorRetryAfter<T>) => void | Promise<void>;
type VigorRetryOnErrorFn<T> = (ctx: VigorRetryContext<T>, obj: VigorRetryOnError<T>) => void | Promise<void>;
type VigorRetryOnRetryFn<T> = (ctx: VigorRetryContext<T>, obj: VigorRetryOnRetry<T>) => void | Promise<void>;
type VigorRetryRetryIfFn<T> = (ctx: VigorRetryContext<T>, obj: VigorRetryRetryIf<T>) => void | Promise<void>;
type VigorRetryOptionsTask<T> = {
    abort?: (error: Error) => void;
    signal?: AbortSignal;
};
type VigorRetryTask<T> = (ctx: VigorRetryContext<T>, obj: VigorRetryOptionsTask<T>) => T | Promise<T>;
type VigorRetryInterceptorsConfig<T> = {
    before: VigorRetryBeforeFn<T>[];
    after: VigorRetryAfterFn<T>[];
    onError: VigorRetryOnErrorFn<T>[];
    onRetry: VigorRetryOnRetryFn<T>[];
    retryIf: VigorRetryRetryIfFn<T>[];
};
declare class VigorRetryInterceptors<T> extends VigorStatus<VigorRetryInterceptorsConfig<T>, VigorRetryInterceptors<T>> {
    private readonly _base;
    constructor(config?: Partial<VigorRetryInterceptorsConfig<T>>);
    getBase(): VigorRetryInterceptorsConfig<T>;
    before(...funcs: (VigorRetryBeforeFn<T> | VigorRetryBeforeFn<T>[])[]): VigorRetryInterceptors<T>;
    after(...funcs: (VigorRetryAfterFn<T> | VigorRetryAfterFn<T>[])[]): VigorRetryInterceptors<T>;
    onError(...funcs: (VigorRetryOnErrorFn<T> | VigorRetryOnErrorFn<T>[])[]): VigorRetryInterceptors<T>;
    onRetry(...funcs: (VigorRetryOnRetryFn<T> | VigorRetryOnRetryFn<T>[])[]): VigorRetryInterceptors<T>;
    retryIf(...funcs: (VigorRetryRetryIfFn<T> | VigorRetryRetryIfFn<T>[])[]): VigorRetryInterceptors<T>;
}
type VigorRetryConfig<T> = {
    target: VigorRetryTask<T>;
    setting: VigorRetrySettingsConfig<T>;
    backoff: VigorRetryBackoffConfig;
    interceptors: VigorRetryInterceptorsConfig<T>;
};
type VigorRetryContext<T> = {
    target: VigorRetryTask<T>;
    setting: VigorRetrySettingsConfig<T>;
    backoff: VigorRetryBackoffConfig;
    interceptors: VigorRetryInterceptorsConfig<T>;
    runtime: {
        result?: T;
        attempt: number;
        controller: AbortController;
        abortPromise?: Promise<never>;
        aborted: boolean;
        signal: AbortSignal;
        delay: number;
        retry: boolean;
        error?: unknown;
    };
};
declare class VigorRetry<T> extends VigorStatus<VigorRetryConfig<T>, VigorRetry<T>> {
    private readonly _base;
    private _controller;
    constructor(config?: VigorRetryConfig<T>);
    getBase(): VigorRetryConfig<T>;
    target<U>(func: VigorRetryTask<U>): VigorRetry<U>;
    createController(): (error: Error) => void;
    setting(func: (r: VigorRetrySettings<T>) => VigorRetrySettings<T>): VigorRetry<T>;
    backoff(func: (r: VigorRetryBackoff) => VigorRetryBackoff): VigorRetry<T>;
    interceptors(func: (r: VigorRetryInterceptors<T>) => VigorRetryInterceptors<T>): VigorRetry<T>;
    request(): Promise<T>;
}
type VigorParseConfig<T> = {
    target?: Response;
    original: boolean;
    type?: keyof Response;
    result?: T;
};
declare class VigorParse<T extends any> extends VigorStatus<VigorParseConfig<T>, VigorParse<T>> {
    private _base;
    constructor(config?: Partial<VigorParseConfig<T>>);
    getBase(): VigorParseConfig<T>;
    target(response: Response): VigorParse<T>;
    original(bool: boolean): VigorParse<T>;
    type(str: keyof Response): VigorParse<T>;
    request(): Promise<T>;
}
type VigorFetchMethods = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "CONNECT" | "TRACE";
type VigorFetchSettingsConfig<T> = {
    origin?: string;
    path?: Array<string>;
    query?: object;
    unretry?: Array<number>;
    retryHeaders?: Array<string>;
    method?: VigorFetchMethods;
    headers?: HeadersInit | Record<string, any>;
    body?: XMLHttpRequestBodyInit | object | null;
    options?: object;
    default?: T;
};
declare class VigorFetchSettings<T> extends VigorStatus<VigorFetchSettingsConfig<T>, VigorFetchSettings<T>> {
    private _base;
    constructor(config?: Partial<VigorFetchSettingsConfig<T>>);
    getBase(): VigorFetchSettingsConfig<T>;
    origin(str: string): VigorFetchSettings<T>;
    path(...strs: (string | string[])[]): VigorFetchSettings<T>;
    query(obj: object): VigorFetchSettings<T>;
    unretry(...numbers: (number | number[])[]): VigorFetchSettings<T>;
    retryHeaders(...strs: (string | string[])[]): VigorFetchSettings<T>;
    method(str: VigorFetchMethods): VigorFetchSettings<T>;
    headers(obj: HeadersInit | Record<string, any>): VigorFetchSettings<T>;
    body(obj: XMLHttpRequestBodyInit | object | null): VigorFetchSettings<T>;
    options(obj: object): VigorFetchSettings<T>;
    default(obj: T): VigorFetchSettings<T>;
}
type VigorFetchBefore<T> = {
    setOptions?: (obj: object) => void;
    throwError?: (error: Error) => void;
};
type VigorFetchAfter<T> = {
    throwError?: (error: Error) => void;
};
type VigorFetchOnError<T> = {
    setResult?: (result: T) => T;
    throwError?: (error: Error) => void;
};
type VigorFetchResult<T> = {
    setResult?: (result: T) => T;
    throwError?: (error: Error) => void;
};
type VigorFetchBeforeFn<T> = (ctx: VigorFetchContext<T>, obj: VigorFetchBefore<T>) => void | Promise<void>;
type VigorFetchAfterFn<T> = (ctx: VigorFetchContext<T>, obj: VigorFetchAfter<T>) => void | Promise<void>;
type VigorFetchOnErrorFn<T> = (ctx: VigorFetchContext<T>, obj: VigorFetchOnError<T>) => void | Promise<void>;
type VigorFetchResultFn<T> = (ctx: VigorFetchContext<T>, obj: VigorFetchResult<T>) => void | Promise<void>;
type VigorFetchInterceptorsConfig<T> = {
    before: VigorFetchBeforeFn<T>[];
    after: VigorFetchAfterFn<T>[];
    onError: VigorFetchOnErrorFn<T>[];
    result: VigorFetchResultFn<T>[];
};
declare class VigorFetchInterceptors<T> extends VigorStatus<VigorFetchInterceptorsConfig<T>, VigorFetchInterceptors<T>> {
    private readonly _base;
    constructor(config?: Partial<VigorFetchInterceptorsConfig<T>>);
    getBase(): VigorFetchInterceptorsConfig<T>;
    before(...funcs: (VigorFetchBeforeFn<T> | VigorFetchBeforeFn<T>[])[]): VigorFetchInterceptors<T>;
    after(...funcs: (VigorFetchAfterFn<T> | VigorFetchAfterFn<T>[])[]): VigorFetchInterceptors<T>;
    onError(...funcs: (VigorFetchOnErrorFn<T> | VigorFetchOnErrorFn<T>[])[]): VigorFetchInterceptors<T>;
    result(...funcs: (VigorFetchResultFn<T> | VigorFetchResultFn<T>[])[]): VigorFetchInterceptors<T>;
}
type VigorFetchConfig<T> = {
    setting: VigorFetchSettingsConfig<T>;
    retryConfig: VigorRetryConfig<T>;
    parseConfig: VigorParseConfig<T>;
    interceptors: VigorFetchInterceptorsConfig<T>;
};
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
        error?: unknown;
    };
};
declare class VigorFetch<T extends any> extends VigorStatus<VigorFetchConfig<T>, VigorFetch<T>> {
    private readonly _base;
    constructor(config?: VigorFetchConfig<T>);
    getBase(): VigorFetchConfig<T>;
    origin(str: string): VigorFetch<T>;
    path(...strs: (string | string[])[]): VigorFetch<T>;
    query(obj: object): VigorFetch<T>;
    method(str: VigorFetchMethods): VigorFetch<T>;
    headers(obj: HeadersInit | Record<string, any>): VigorFetch<T>;
    body(obj: XMLHttpRequestBodyInit | object | null): VigorFetch<T>;
    options(obj: object): VigorFetch<T>;
    setting(func: (r: VigorFetchSettings<T>) => VigorFetchSettings<T>): VigorFetch<T>;
    retryConfig(func: (r: VigorRetry<T>) => VigorRetry<T>): VigorFetch<T>;
    parseConfig(func: (r: VigorParse<T>) => VigorParse<T>): VigorFetch<T>;
    buildUrl(origin: string, path: Array<string>, query: object): string;
    interceptors(func: (r: VigorFetchInterceptors<T>) => VigorFetchInterceptors<T>): VigorFetch<T>;
    request(): Promise<T>;
}
type VigorAllSettingsConfig<T> = {
    concurrency: number;
    jitter: number;
};
declare class VigorAllSettings<T> extends VigorStatus<VigorAllSettingsConfig<T>, VigorAllSettings<T>> {
    private _base;
    constructor(config?: Partial<VigorAllSettingsConfig<T>>);
    getBase(): VigorAllSettingsConfig<T>;
    concurrency(num: number): VigorAllSettings<T>;
    jitter(num: number): VigorAllSettings<T>;
}
type VigorAllBefore<T> = {
    throwError?: (error: Error) => void;
};
type VigorAllAfter<T> = {
    setResult?: (result: T) => T;
    throwError?: (error: Error) => void;
};
type VigorAllOnError<T> = {
    setResult?: (result: T) => T;
    throwError?: (error: Error) => void;
};
type VigorAllResult<T> = {
    setResult?: (result: Array<T>) => Array<T>;
    throwError?: (error: Error) => void;
};
type VigorAllBeforeFn<T> = (ctx: VigorAllContext<T>, obj: VigorAllBefore<T>) => void | Promise<void>;
type VigorAllAfterFn<T> = (ctx: VigorAllContext<T>, obj: VigorAllAfter<T>) => void | Promise<void>;
type VigorAllOnErrorFn<T> = (ctx: VigorAllContext<T>, obj: VigorAllOnError<T>) => void | Promise<void>;
type VigorAllResultFn<T> = (ctx: VigorAllContext<T>, obj: VigorAllResult<T>) => void | Promise<void>;
type VigorAllInterceptorsConfig<T> = {
    before: VigorAllBeforeFn<T>[];
    after: VigorAllAfterFn<T>[];
    onError: VigorAllOnErrorFn<T>[];
    result: VigorAllResultFn<T>[];
};
declare class VigorAllInterceptors<T> extends VigorStatus<VigorAllInterceptorsConfig<T>, VigorAllInterceptors<T>> {
    private readonly _base;
    constructor(config?: Partial<VigorAllInterceptorsConfig<T>>);
    getBase(): VigorAllInterceptorsConfig<T>;
    before(...funcs: (VigorAllBeforeFn<T> | VigorAllBeforeFn<T>[])[]): VigorAllInterceptors<T>;
    after(...funcs: (VigorAllAfterFn<T> | VigorAllAfterFn<T>[])[]): VigorAllInterceptors<T>;
    onError(...funcs: (VigorAllOnErrorFn<T> | VigorAllOnErrorFn<T>[])[]): VigorAllInterceptors<T>;
    result(...funcs: (VigorAllResultFn<T> | VigorAllResultFn<T>[])[]): VigorAllInterceptors<T>;
}
type VigorAllOptionsTask<T> = {
    abort?: (error: Error) => void;
    signal?: AbortSignal;
};
type VigorAllTask<T> = (ctx: VigorAllContext<T>, obj: VigorAllOptionsTask<T>) => T | Promise<T>;
type VigorAllConfig<T> = {
    target: Array<VigorAllTask<T>>;
    setting: VigorAllSettingsConfig<T>;
    interceptors: VigorAllInterceptorsConfig<T>;
};
type VigorAllContext<T> = {
    target?: Array<VigorAllTask<T>>;
    setting: VigorAllSettingsConfig<T>;
    interceptors: VigorAllInterceptorsConfig<T>;
    runtime: {
        tasks: Array<Promise<T>>;
        result: Array<T | Error>;
    };
};
declare class VigorAll<T extends any> extends VigorStatus<VigorAllConfig<T>, VigorAll<T>> {
    private readonly _base;
    constructor(config?: VigorAllConfig<T>);
    getBase(): VigorAllConfig<T>;
    target(...funcs: (VigorAllTask<T> | VigorAllTask<T>[])[]): VigorAll<T>;
    setting(func: (r: VigorAllSettings<T>) => VigorAllSettings<T>): VigorAll<T>;
    interceptors(func: (r: VigorAllInterceptors<T>) => VigorAllInterceptors<T>): VigorAll<T>;
    request(): Promise<(T | Error)[]>;
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
declare class Vigor {
    private readonly registry;
    constructor(config?: Partial<VigorConfig>);
    fetch(origin: string): VigorFetch<unknown>;
    all<T>(tasks: (VigorAllTask<T> | VigorAllTask<T>[])[]): VigorAll<T>;
    parse(response: Response): VigorParse<unknown>;
    retry<T>(fn: VigorRetryTask<T>): VigorRetry<T>;
    use(plugin: (ctx: VigorRegistry, options?: object) => void, options?: object): Vigor;
}
declare const vigor: Vigor;

export { Vigor, VigorAll, VigorAllError, VigorAllInterceptors, VigorAllSettings, VigorFetch, VigorFetchError, VigorFetchInterceptors, VigorFetchSettings, VigorParse, VigorParseError, VigorRetry, VigorRetryBackoff, VigorRetryError, VigorRetryInterceptors, VigorRetrySettings, vigor as default, vigor };
