interface VigorErrorOptions {
    type?: string;
    data?: any;
    status?: number;
    response?: any;
    message?: string;
    origin?: string;
}
declare class VigorError extends Error {
    data?: any;
    type?: string;
    status?: number;
    response?: any;
    origin?: string;
    constructor(text: string, options: VigorErrorOptions);
}
declare class VigorRetryError extends VigorError {
    constructor(text: string, options: VigorErrorOptions);
}
declare class VigorParseError extends VigorError {
    constructor(text: string, options: VigorErrorOptions);
}
declare class VigorFetchError extends VigorError {
    constructor(text: string, options: VigorErrorOptions);
}
declare class VigorAllError extends VigorError {
    constructor(text: string, options: VigorErrorOptions);
}
/**
 * VigorRetry
 */
declare class VigorRetry<T = any> {
    private _target;
    private _args;
    private _config;
    constructor(target: (...args: any[]) => Promise<T> | T, args?: any[], config?: any);
    private _next;
    args(...args: any[]): any;
    count(int: number): VigorRetry<T>;
    max(ms: number): VigorRetry<T>;
    backoff(ms: number): VigorRetry<T>;
    baseDelay(ms: number): VigorRetry<T>;
    jitter(ms: number): VigorRetry<T>;
    before(...func: Function[]): VigorRetry<T>;
    onRetry(...func: Function[]): VigorRetry<T>;
    after(...func: Function[]): VigorRetry<T>;
    onError(...func: Function[]): VigorRetry<T>;
    request(): Promise<T>;
}
/**
 * VigorParse
 */
declare class VigorParse<T = any> {
    private _response;
    private _config;
    constructor(response: Response | null, config?: any);
    private _next;
    original(bool: boolean): VigorParse<T>;
    type(str: string): VigorParse<T>;
    before(...func: Function[]): VigorParse<T>;
    after(...func: Function[]): VigorParse<T>;
    onError(...func: Function[]): VigorParse<T>;
    request(): Promise<T>;
}
/**
 * VigorFetch
 */
declare class VigorFetch<T = any> {
    private _config;
    constructor(origin?: string, config?: any);
    private _next;
    origin(str: string): VigorFetch<T>;
    path(str: string): VigorFetch<T>;
    query(obj: object): VigorFetch<T>;
    method(str: string): VigorFetch<T>;
    headers(obj: object): VigorFetch<T>;
    body(obj: any): VigorFetch<T>;
    offset(obj: object): VigorFetch<T>;
    maxDelay(ms: number): VigorFetch<T>;
    retryHeaders(...str: string[]): VigorFetch<T>;
    unretry(...int: number[]): VigorFetch<T>;
    before(...func: Function[]): VigorFetch<T>;
    after(...func: Function[]): VigorFetch<T>;
    result(...func: Function[]): VigorFetch<T>;
    onError(...func: Function[]): VigorFetch<T>;
    retryConfig(func: (r: VigorRetry) => VigorRetry): VigorFetch<T>;
    parseConfig(func: (p: VigorParse) => VigorParse): VigorFetch<T>;
    request(): Promise<T>;
}
/**
 * VigorAll
 */
declare class VigorAll<T = any> {
    private _config;
    constructor(config: any);
    private _next;
    promises(...func: (() => Promise<any>)[]): VigorAll<T>;
    limit(int: number): VigorAll<T>;
    jitter(ms: number): VigorAll<T>;
    before(...func: Function[]): VigorAll<T>;
    after(...func: Function[]): VigorAll<T>;
    onError(...func: Function[]): VigorAll<T>;
    request(): Promise<any[]>;
}
/**
 * Main Vigor Class
 */
declare class Vigor {
    _Fetch: typeof VigorFetch;
    _Retry: typeof VigorRetry;
    _Parse: typeof VigorParse;
    _All: typeof VigorAll;
    use(plugin: (instance: Vigor, options?: any) => void, options?: any): this;
    fetch<T = any>(origin?: string, config?: any): VigorFetch<T>;
    retry<T = any>(target: (...args: any[]) => Promise<T> | T, args?: any[], config?: any): VigorRetry<T>;
    parse<T = any>(response: Response | null, config?: any): VigorParse<T>;
    all<T = any>(config?: any): VigorAll<T>;
}
declare const vigor: Vigor;

export { VigorAll, VigorAllError, VigorError, VigorFetch, VigorFetchError, VigorParse, VigorParseError, VigorRetry, VigorRetryError, vigor as default, vigor };
export type { VigorErrorOptions };
