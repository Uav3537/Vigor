type VigorErrorOptions<T> = {
    method?: string;
    cause?: unknown;
    context?: unknown;
    type?: string;
    data?: T;
};
declare abstract class VigorError<D = unknown> extends Error {
    readonly timestamp: Date;
    readonly method?: string;
    readonly cause?: unknown;
    readonly context?: unknown;
    readonly type?: string;
    readonly data?: D;
    constructor(message: string, options: VigorErrorOptions<D>);
}
type VigorRetryErrorData = Partial<{
    limit: number;
    attempt: number;
    maxAttempts: number;
}>;
declare class VigorRetryError extends VigorError {
    constructor(message: string, options: VigorErrorOptions<VigorRetryErrorData>);
}
declare class VigorParseError extends VigorError {
    constructor(message: string, options: any);
}
declare class VigorFetchError extends VigorError {
    constructor(message: string, options: any);
}
declare class VigorAllError extends VigorError {
    constructor(message: string, options: any);
}
declare abstract class VigorStatus<T> {
    protected readonly _base: T;
    protected readonly _config: T;
    constructor(config: Partial<T>, _base: T);
    getConfig(): T;
    getBase(): T;
    protected _next(config: Partial<T>): this;
    protected _pipsub<C, R extends VigorStatus<C>>(config: C, fn: (r: R) => R, ctor: new (c: C) => R): C;
}
type VigorIncludeSpread<T> = Array<(T | Array<T>)>;
type VigorRetrySettingsConfig<T> = {
    count: number;
    limit: number;
    maxDelay: number;
    default?: T;
};
declare class VigorRetrySettings<T> extends VigorStatus<VigorRetrySettingsConfig<T>> {
    constructor(config?: Partial<VigorRetrySettingsConfig<T>>);
    count(num: number): this;
    limit(num: number): this;
    maxDelay(num: number): this;
    default(obj: T): this;
}
type VigorRetryBackoffConfig<T> = {
    initialDelay: number;
    baseDelay: number;
    factor: number;
    jitter: number;
};
declare class VigorRetryBackoff<T> extends VigorStatus<VigorRetryBackoffConfig<T>> {
    constructor(config?: Partial<VigorRetryBackoffConfig<T>>);
    initialDelay(num: number): this;
    baseDelay(num: number): this;
    factor(num: number): this;
    jitter(num: number): this;
    static randomJitter(num: number): number;
}
type VigorRetryBefore<T> = {
    setAttempt: (attempt: number) => number;
    throwError: (error: Error) => void;
    abort: (error: Error) => void;
};
type VigorRetryAfter<T> = {
    setAttempt: (attempt: number) => number;
    throwError: (error: Error) => void;
    setResult: (result: T) => T;
};
type VigorRetryRetryIf<T> = {
    throwError: (error: Error) => void;
    proceedRetry: () => boolean;
    cancelRetry: (error?: Error) => boolean;
};
type VigorRetryOnRetry<T> = {
    setAttempt: (attempt: number) => number;
    throwError: (error: Error) => void;
    setDelay: (delay: number) => number;
};
type VigorRetryOnError<T> = {
    setResult: (result: T) => T;
    throwError: (error: Error) => void;
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
type VigorRetryInterceptorsConfig<T> = {
    before: Array<VigorRetryBeforeFn<T>>;
    after: Array<VigorRetryAfterFn<T>>;
    onError: Array<VigorRetryOnErrorFn<T>>;
    onRetry: Array<VigorRetryOnRetryFn<T>>;
    retryIf: Array<VigorRetryRetryIfFn<T>>;
};
declare class VigorRetryInterceptors<T> extends VigorStatus<VigorRetryInterceptorsConfig<T>> {
    constructor(config?: Partial<VigorRetryInterceptorsConfig<T>>);
    before(...funcs: VigorIncludeSpread<VigorRetryBeforeFn<T>>): this;
    after(...funcs: VigorIncludeSpread<VigorRetryAfterFn<T>>): this;
    onError(...funcs: VigorIncludeSpread<VigorRetryOnErrorFn<T>>): this;
    onRetry(...funcs: VigorIncludeSpread<VigorRetryOnRetryFn<T>>): this;
    retryIf(...funcs: VigorIncludeSpread<VigorRetryRetryIfFn<T>>): this;
}
type VigorRetryTask<T> = (ctx: VigorRetryContext<T>, obj: VigorRetryOptionsTask<T>) => T | Promise<T>;
type VigorRetryConfig<T> = {
    target: VigorRetryTask<T>;
    setting: VigorRetrySettingsConfig<T>;
    backoff: VigorRetryBackoffConfig<T>;
    interceptors: VigorRetryInterceptorsConfig<T>;
    controller: AbortController;
};
type VigorRetryContext<T> = VigorRetryConfig<T> & {
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
declare class VigorRetry<T> extends VigorStatus<VigorRetryConfig<T>> {
    constructor(config?: Partial<VigorRetryConfig<T>>);
    private _transfer;
    private _calculateDelay;
    createController(): VigorRetryConfig<T>["controller"];
    target<U>(func: VigorRetryConfig<U>["target"]): VigorRetry<U>;
    setting(func: (r: VigorRetrySettings<T>) => VigorRetrySettings<T>): this;
    backoff(func: (r: VigorRetryBackoff<T>) => VigorRetryBackoff<T>): this;
    interceptors(func: (r: VigorRetryInterceptors<T>) => VigorRetryInterceptors<T>): this;
    request(): Promise<T>;
}
type VigorParseConfig<T, O = false> = {
    target?: Response;
    original: O;
    type?: (keyof Response) | undefined;
    result?: T;
};
declare class VigorParse<T, O extends boolean = false> extends VigorStatus<VigorParseConfig<T, O>> {
    constructor(config?: Partial<VigorParseConfig<T, O> & {
        original: O;
    }>);
    static stategy: {
        key: RegExp;
        parse: (res: Response) => Promise<any>;
        type: string;
    }[];
    static supported: string[];
    private _transfer;
    target(res: Response): this;
    original<B extends boolean>(bool: B): VigorParse<T, B>;
    type<K extends keyof Response>(type: K): VigorParse<Response[K] extends (...args: any) => Promise<infer R> ? R : never, O>;
    request<U = T>(): Promise<O extends true ? Response : U>;
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
declare class VigorFetchSettings<T> extends VigorStatus<VigorFetchSettingsConfig<T>> {
    constructor(config?: Partial<VigorFetchSettingsConfig<T>>);
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
type VigorFetchFn<T, O> = (ctx: VigorFetchContext<T>, obj: O) => void | Promise<void>;
type VigorFetchBeforeFn<T> = VigorFetchFn<T, VigorFetchBefore<T>>;
type VigorFetchAfterFn<T> = VigorFetchFn<T, VigorFetchAfter<T>>;
type VigorFetchOnErrorFn<T> = VigorFetchFn<T, VigorFetchOnError<T>>;
type VigorFetchResultFn<T> = VigorFetchFn<T, VigorFetchResult<T>>;
type VigorFetchInterceptorsConfig<T> = {
    before: VigorFetchBeforeFn<T>[];
    after: VigorFetchAfterFn<T>[];
    onError: VigorFetchOnErrorFn<T>[];
    result: VigorFetchResultFn<T>[];
};
declare class VigorFetchInterceptors<T> extends VigorStatus<VigorFetchInterceptorsConfig<T>> {
    constructor(config?: Partial<VigorFetchInterceptorsConfig<T>>);
    before(...funcs: VigorIncludeSpread<VigorFetchBeforeFn<T>>): VigorFetchInterceptors<T>;
    after(...funcs: VigorIncludeSpread<VigorFetchAfterFn<T>>): VigorFetchInterceptors<T>;
    onError(...funcs: VigorIncludeSpread<VigorFetchOnErrorFn<T>>): VigorFetchInterceptors<T>;
    result(...funcs: VigorIncludeSpread<VigorFetchResultFn<T>>): VigorFetchInterceptors<T>;
}
type VigorFetchConfig<T> = {
    setting: VigorFetchSettingsConfig<T>;
    retryConfig: VigorRetryConfig<T>;
    parseConfig: VigorParseConfig<T>;
    interceptors: VigorFetchInterceptorsConfig<T>;
};
type VigorFetchContext<T> = VigorFetchConfig<T> & {
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
declare class VigorFetch<T> extends VigorStatus<VigorFetchConfig<T>> {
    constructor(config?: Partial<VigorFetchConfig<T>>);
    origin(str: string): this;
    path(...strs: (string | string[])[]): this;
    query(obj: object): this;
    method(str: VigorFetchMethods): this;
    headers(obj: HeadersInit | Record<string, any>): this;
    body(obj: XMLHttpRequestBodyInit | object | null): this;
    options(obj: object): this;
    setting(func: (r: VigorFetchSettings<T>) => VigorFetchSettings<T>): this;
    interceptors(func: (r: VigorFetchInterceptors<T>) => VigorFetchInterceptors<T>): this;
    retryConfig(func: (r: VigorRetry<T>) => VigorRetry<T>): this;
    parseConfig(func: (r: VigorParse<T>) => VigorParse<T>): this;
    buildUrl(origin: string, path: string[], query: object): string;
    request<U = T>(): Promise<U>;
}
type VigorAllSettingsConfig = {
    concurrency: number;
    jitter: number;
};
declare class VigorAllSettings extends VigorStatus<VigorAllSettingsConfig> {
    constructor(config?: Partial<VigorAllSettingsConfig>);
    concurrency(num: number): VigorAllSettings;
    jitter(num: number): VigorAllSettings;
}
type VigorAllBefore = {
    throwError?: (error: Error) => void;
};
type VigorAllAfter = {
    setResult?: (result: any) => any;
    throwError?: (error: Error) => void;
};
type VigorAllOnError = {
    setResult?: (result: any) => any;
    throwError?: (error: Error) => void;
};
type VigorAllResult = {
    setResult?: (result: Array<any>) => Array<any>;
    throwError?: (error: Error) => void;
};
type VigorAllFn<O> = (ctx: VigorAllContext<any>, obj: O) => void | Promise<void>;
type VigorAllBeforeFn = VigorAllFn<VigorAllBefore>;
type VigorAllAfterFn = VigorAllFn<VigorAllAfter>;
type VigorAllOnErrorFn = VigorAllFn<VigorAllOnError>;
type VigorAllResultFn = VigorAllFn<VigorAllResult>;
type VigorAllInterceptorsConfig = {
    before: VigorAllBeforeFn[];
    after: VigorAllAfterFn[];
    onError: VigorAllOnErrorFn[];
    result: VigorAllResultFn[];
};
declare class VigorAllInterceptors extends VigorStatus<VigorAllInterceptorsConfig> {
    constructor(config?: Partial<VigorAllInterceptorsConfig>);
    before(...funcs: (VigorAllBeforeFn | VigorAllBeforeFn[])[]): VigorAllInterceptors;
    after(...funcs: (VigorAllAfterFn | VigorAllAfterFn[])[]): VigorAllInterceptors;
    onError(...funcs: (VigorAllOnErrorFn | VigorAllOnErrorFn[])[]): VigorAllInterceptors;
    result(...funcs: (VigorAllResultFn | VigorAllResultFn[])[]): VigorAllInterceptors;
}
type VigorAllOptionsTask = {
    abort?: (error: Error) => void;
    signal?: AbortSignal;
};
type VigorAllTask<R = any> = (ctx: VigorAllContext<any>, obj: VigorAllOptionsTask) => R | Promise<R>;
type TaskReturn<T> = T extends VigorAllTask<infer R> ? R : never;
type MapTasks<T extends readonly VigorAllTask<any>[]> = {
    [K in keyof T]: T[K] extends VigorAllTask<infer R> ? R : never;
};
type VigorAllConfig = {
    target: VigorAllTask<any>[];
    setting: VigorAllSettingsConfig;
    interceptors: VigorAllInterceptorsConfig;
};
type VigorAllContext<Tasks extends readonly VigorAllTask<any>[]> = {
    target: Tasks;
    runtime: {
        tasks: {
            [K in keyof Tasks]: Promise<TaskReturn<Tasks[K]>>;
        };
        result: {
            [K in keyof Tasks]: TaskReturn<Tasks[K]> | Error;
        };
    };
};
declare class VigorAll<Tasks extends readonly VigorAllTask<any>[]> extends VigorStatus<VigorAllConfig> {
    constructor(config?: Partial<VigorAllConfig>);
    target(...funcs: VigorIncludeSpread<VigorAllTask<any>>): VigorAll<Tasks>;
    setting(func: (r: VigorAllSettings) => VigorAllSettings): this;
    interceptors(func: (r: VigorAllInterceptors) => VigorAllInterceptors): this;
    request(): Promise<MapTasks<Tasks>>;
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
        main: () => VigorAll<any>;
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
    all<T extends VigorAllTask<any>[] | readonly VigorAllTask<any>[]>(...args: T extends any ? (T[number] | T)[] : never): VigorAll<any>;
    parse(response: Response): VigorParse<unknown, false>;
    retry<T>(fn: VigorRetryTask<T>): VigorRetry<T>;
    use(plugin: (ctx: VigorRegistry, options?: object) => void, options?: object): Vigor;
}
declare const vigor: Vigor;

export { Vigor, VigorAll, VigorAllError, VigorAllInterceptors, VigorAllSettings, VigorFetch, VigorFetchError, VigorFetchInterceptors, VigorFetchSettings, VigorParse, VigorParseError, VigorRetry, VigorRetryBackoff, VigorRetryError, VigorRetryInterceptors, VigorRetrySettings, vigor as default, vigor };
