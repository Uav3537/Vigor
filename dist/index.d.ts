interface VigorErrorOptions {
    url?: string | null;
    status?: number;
    message?: string;
    data?: any;
}
interface VigorFetchConfig {
    path: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | null;
    offset: RequestInit;
    headers: Record<string, string>;
    body: any;
    count: number;
    max: number;
    wait: number;
    backoff: number;
    unretry: Set<number>;
    retryHeader: string[];
    original: boolean;
    parse: keyof Response | null;
    beforeRequest: Array<(opt: RequestInit) => Promise<Partial<RequestInit> | void> | Partial<RequestInit> | void>;
    afterRequest: Array<(res: Response) => Promise<Response | void> | Response | void>;
    beforeResponse: Array<(res: Response) => Promise<Response> | Response>;
    afterResponse: Array<(data: any) => Promise<any> | any>;
    onError: Array<(err: any) => Promise<any> | any>;
    query: Record<string, any>;
    jitter: number;
}
declare class VigorFetch<T = any> {
    private _origin;
    private _config;
    constructor(origin: string, config?: VigorFetchConfig);
    private _next;
    path(arg: string): VigorFetch<T>;
    method(arg: VigorFetchConfig['method']): VigorFetch<T>;
    offset(arg: RequestInit): VigorFetch<T>;
    headers(arg: Record<string, string>): VigorFetch<T>;
    body(arg: any): VigorFetch<T>;
    count(arg: number): VigorFetch<T>;
    max(arg: number): VigorFetch<T>;
    wait(arg: number): VigorFetch<T>;
    backoff(arg: number): VigorFetch<T>;
    unretry(arg: number[]): VigorFetch<T>;
    retryHeader(...arg: string[]): VigorFetch<T>;
    original(arg: boolean): VigorFetch<T>;
    parse(arg: keyof Response): VigorFetch<T>;
    query(arg: Record<string, any>): VigorFetch<T>;
    jitter(arg: number): VigorFetch<T>;
    beforeRequest(...arg: VigorFetchConfig['beforeRequest']): VigorFetch<T>;
    afterRequest(...arg: VigorFetchConfig['afterRequest']): VigorFetch<T>;
    beforeResponse(...arg: VigorFetchConfig['beforeResponse']): VigorFetch<T>;
    afterResponse(...arg: VigorFetchConfig['afterResponse']): VigorFetch<T>;
    onError(...arg: VigorFetchConfig['onError']): VigorFetch<T>;
    request(): Promise<T>;
}
interface VigorAllConfig {
    limit: number;
    jitter: number;
    promises: Array<() => Promise<any>>;
}
declare class VigorAll {
    private _config;
    constructor(config?: VigorAllConfig);
    private _next;
    limit(arg: number): VigorAll;
    jitter(arg: number): VigorAll;
    promises(...args: Array<() => Promise<any>>): VigorAll;
    request(): Promise<any[]>;
}
declare class Vigor {
    fetch<T = any>(origin: string, config?: VigorFetchConfig): VigorFetch<T>;
    all(config?: VigorAllConfig): VigorAll;
}
declare const vigor: Vigor;

export { vigor as default };
export type { VigorAllConfig, VigorErrorOptions, VigorFetchConfig };
