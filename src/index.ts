interface VigorErrorOptions {
    type?: string;
    data?: any;
    status?: number;
    response?: any;
    message?: string;
    origin?: string;
}

class VigorError extends Error {
    data?: any;
    type?: string;
    status?: number;
    response?: any;
    origin?: string;

    constructor(text: string, options: VigorErrorOptions) {
        const { type, data, status, response, message, origin } = options;
        super(message || `[VigorError] ${text}`);
        
        this.name = this.constructor.name;
        this.data = data;
        this.type = type;
        this.status = status;
        this.response = response;
        this.origin = origin;

        if ((Error as any).captureStackTrace) {
            (Error as any).captureStackTrace(this, this.constructor);
        }
    }
}

class VigorRetryError extends VigorError {
    constructor(text: string, options: VigorErrorOptions) {
        super(text, options);
        this.message = options.message || `[VigorRetryError] ${text}`;
    }
}

class VigorParseError extends VigorError {
    constructor(text: string, options: VigorErrorOptions) {
        super(text, options);
        this.message = options.message || `[VigorParseError] ${text}`;
    }
}

class VigorFetchError extends VigorError {
    constructor(text: string, options: VigorErrorOptions) {
        super(text, options);
        this.message = options.message || `[VigorFetchError] ${text}`;
    }
}

class VigorAllError extends VigorError {
    constructor(text: string, options: VigorErrorOptions) {
        super(text, options);
        this.message = options.message || `[VigorAllError] ${text}`;
    }
}

/**
 * VigorRetry
 */
class VigorRetry<T = any> {
    private _target: (...args: any[]) => Promise<T> | T;
    private _args: any[];
    private _config: any;

    constructor(target: (...args: any[]) => Promise<T> | T, args: any[] = [], config: any = {}) {
        this._target = target;
        this._args = args;
        this._config = {
            retry: {
                count: 5, max: 10000, backoff: 1.3, baseDelay: 1000, jitter: 500
            },
            interceptors: {
                before: [], after: [], onRetry: [], onError: []
            },
            ...config
        };
    }

    private _next(changes: any): VigorRetry<T> {
        return new (this.constructor as any)(this._target, this._args, {
            ...this._config,
            ...changes,
            retry: { 
                ...this._config.retry, 
                ...(changes.retry || {}) 
            },
            interceptors: { 
                ...this._config.interceptors, 
                ...(changes.interceptors || {}) 
            }
        });
    }

    args(...args: any[]) { return new (this.constructor as any)(this._target, args, this._config); }
    count(int: number) { return this._next({ retry: { count: int } }); }
    max(ms: number) { return this._next({ retry: { max: ms } }); }
    backoff(ms: number) { return this._next({ retry: { backoff: ms } }); }
    baseDelay(ms: number) { return this._next({ retry: { baseDelay: ms } }); }
    jitter(ms: number) { return this._next({ retry: { jitter: ms } }); }
    before(...func: Function[]) { return this._next({ interceptors: { before: [...this._config.interceptors.before, ...func.flat()] } }); }
    onRetry(...func: Function[]) { return this._next({ interceptors: { onRetry: [...this._config.interceptors.onRetry, ...func.flat()] } }); }
    after(...func: Function[]) { return this._next({ interceptors: { after: [...this._config.interceptors.after, ...func.flat()] } }); }
    onError(...func: Function[]) { return this._next({ interceptors: { onError: [...this._config.interceptors.onError, ...func.flat()] } }); }

    async request(): Promise<T> {
        const [target, args, config] = [this._target, this._args, this._config];
        const { retry: { count, max, backoff, baseDelay, jitter }, interceptors: { before, after, onRetry, onError } } = config;

        let ctx: any = { target, args, attempt: 0, result: null, error: null, try: true, retry: true, max, backoff, jitter, wait: 0, baseDelay };

        try {
            if (typeof target !== 'function') throw new VigorRetryError('target is not a function', { type: "not a function", data: "target" });

            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            for (let i = 0; i < count; i++) {
                ctx.attempt = i + 1;
                ctx.error = null;
                ctx.result = null;
                ctx.retry ??= true;
                for (const func of before) {
                    if (typeof func !== 'function') throw new VigorRetryError('Interceptor<before> is not a function', { type: "not a function", data: "before" });
                    const next = await func(ctx, ctx.args);
                    if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
                }
                if (!ctx.try) break;
                try {
                    ctx.result = await ctx.target(...ctx.args);
                    for (const func of after) {
                        if (typeof func !== 'function') throw new VigorRetryError('Interceptor<after> is not a function', { type: "not a function", data: "after" });
                        const next = await func(ctx, ctx.result);
                        if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
                    }
                    if (ctx.error instanceof Error) throw ctx.error;
                    if (ctx.result instanceof Error) throw ctx.result;
                    return ctx.result;
                } catch (error) {
                    ctx.error = error;
                    ctx.wait = Math.min(Math.pow(ctx.backoff, ctx.attempt - 1) * ctx.baseDelay, max) + ctx.jitter;
                    for (const func of onRetry) {
                        if (typeof func !== 'function') throw new VigorRetryError('Interceptor<onRetry> is not a function', { type: "not a function", data: "retry" });
                        const next = await func(ctx, ctx.error);
                        if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
                    }
                    if (!ctx.retry) break;
                    await sleep(ctx.wait);
                }
            }
            if (ctx.error instanceof Error) throw ctx.error;
            if (ctx.result instanceof Error) throw ctx.result;
        } catch (mainError: any) {
            ctx.mainError = mainError;
            for (const func of onError) {
                if (typeof func !== 'function') throw new VigorRetryError('Interceptor<onError> is not a function', { type: "not a function", data: "onError" });
                const next = await func(ctx, ctx.mainError);
                if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
            }
            if (ctx.mainError instanceof Error) throw ctx.mainError;
            return ctx.mainError;
        }
        return ctx.result;
    }
}

/**
 * VigorParse
 */
class VigorParse<T = any> {
    private _response: Response | null;
    private _config: any;

    constructor(response: Response | null, config: any = {}) {
        this._response = response;
        this._config = {
            settings: { original: false, parse: null },
            interceptors: { before: [], after: [], onError: [] },
            ...config,
        };
    }

    private _next(changes: any): VigorParse<T> {
        return new (this.constructor as any)(this._response, {
            ...this._config,
            ...changes,
            settings: { 
                ...this._config.settings, 
                ...(changes.settings || {}) 
            },
            interceptors: { 
                ...this._config.interceptors, 
                ...(changes.interceptors || {}) 
            }
        });
    }

    original(bool: boolean) { return this._next({ settings: { original: bool } }); }
    type(str: string) { return this._next({ settings: { parse: str } }); }
    before(...func: Function[]) { return this._next({ interceptors: { before: [...this._config.interceptors.before, ...func.flat()] } }); }
    after(...func: Function[]) { return this._next({ interceptors: { after: [...this._config.interceptors.after, ...func.flat()] } }); }
    onError(...func: Function[]) { return this._next({ interceptors: { onError: [...this._config.interceptors.onError, ...func.flat()] } }); }

    async request(): Promise<T> {
        const { settings: { original, parse }, interceptors: { before, after, onError } } = this._config;
        let ctx: any = { original, parse, result: null, response: this._response };
        try {
            for (const func of before) {
                if (typeof func !== 'function') throw new VigorParseError('Interceptor<before> is not a function', { type: "not a function", data: "before" });
                const next = await func(ctx, ctx.response);
                if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
            }

            ctx.result = await (async (response: Response) => {
                if (ctx.original) return response;
                if (ctx.parse) {
                    const method = (response as any)[ctx.parse];
                    if (!method || typeof method !== 'function') throw new VigorParseError(`Invalid method such as ${ctx.parse}`, { type: "Invalid method", data: ctx.parse });
                    return await method.call(response);
                }
                const contentType = response.headers.get("Content-Type") || "";
                if (/json/.test(contentType)) return await response.json();
                if (/multipart\/form-data/.test(contentType)) return await response.formData();
                if (/octet-stream/.test(contentType)) return await response.arrayBuffer();
                if (/(image|video|audio|pdf)/.test(contentType)) return await response.blob();
                return await response.text();
            })(ctx.response);

            for (const func of after) {
                if (typeof func !== 'function') throw new VigorParseError('Interceptor<after> is not a function', { type: "not a function", data: "after" });
                const next = await func(ctx, ctx.result);
                if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
            }
            if (ctx.result instanceof Error) throw ctx.result;
            return ctx.result;
        } catch (mainError: any) {
            ctx.mainError = mainError;
            for (const func of onError) {
                if (typeof func !== 'function') throw new VigorParseError('Interceptor<onError> is not a function', { type: "not a function", data: "onError" });
                const next = await func(ctx, ctx.mainError);
                if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
            }
            if (ctx.mainError instanceof Error) throw ctx.mainError;
            return ctx.mainError;
        }
    }
}

/**
 * VigorFetch
 */
class VigorFetch<T = any> {
    private _config: any;

    constructor(origin = "", config: any = {}) {
        this._config = {
            request: {
                origin, path: "", query: {},
                method: "", headers: {}, body: null, offset: {},
                ...(config.request || {})
            },
            retry: {
                limit: 10000,
                retryHeaders: ["retry-after", "ratelimit-reset", "x-ratelimit-reset", "x-retry-after", "x-amz-retry-after", "chrome-proxy-next-link"],
                unretry: new Set([400, 401, 403, 404, 406, 409, 410, 411, 413, 414, 415, 422]),
                ...(config.retry || {})
            },
            response: { 
                retryConfig: undefined, 
                parseConfig: undefined,
                ...(config.response || {})
            },
            interceptors: { 
                before: [], after: [], onError: [], result: [],
                ...(config.interceptors || {})
            },
            ...config
        };
    }

    private _next(changes: any): VigorFetch<T> {
        return new (this.constructor as any)(this._config.request.origin, {
            ...this._config,
            ...changes,
            request: { ...this._config.request, ...(changes.request || {}) },
            retry: { ...this._config.retry, ...(changes.retry || {}) },
            response: { ...this._config.response, ...(changes.response || {}) },
            interceptors: { 
                ...this._config.interceptors, 
                ...(changes.interceptors || {}) 
            }
        });
    }

    origin(str: string) { return this._next({ request: { origin: str } }); }
    path(str: string) { return this._next({ request: { path: str } }); }
    query(obj: object) { return this._next({ request: { query: obj } }); }
    method(str: string) { return this._next({ request: { method: str } }); }
    headers(obj: object) { return this._next({ request: { headers: obj } }); }
    body(obj: any) { return this._next({ request: { body: obj } }); }
    offset(obj: object) { return this._next({ request: { offset: obj } }); }
    maxDelay(ms: number) { return this._next({ retry: { maxDelay: ms } }); }
    retryHeaders(...str: string[]) { return this._next({ retry: { retryHeaders: [...this._config.retry.retryHeaders, ...str.flat()] } }); }
    unretry(...int: number[]) { return this._next({ retry: { unretry: new Set(int.flat()) } }); }
    before(...func: Function[]) { return this._next({ interceptors: { before: [...this._config.interceptors.before, ...func.flat()] } }); }
    after(...func: Function[]) { return this._next({ interceptors: { after: [...this._config.interceptors.after, ...func.flat()] } }); }
    result(...func: Function[]) { return this._next({ interceptors: { result: [...this._config.interceptors.result, ...func.flat()] } }); }
    onError(...func: Function[]) { return this._next({ interceptors: { onError: [...this._config.interceptors.onError, ...func.flat()] } }); }

    retryConfig(func: (r: VigorRetry) => VigorRetry) {
        if (typeof func !== 'function') throw new VigorFetchError("retryConfig is not a function", { type: "not a function", data: "retryConfig" });
        const dummyRetry = func(new VigorRetry(async () => { }));
        return this._next({ retry: { retryConfig: dummyRetry['_config'] } });
    }

    parseConfig(func: (p: VigorParse) => VigorParse) {
        if (typeof func !== 'function') throw new VigorFetchError("parseConfig is not a function", { type: "not a function", data: "parseConfig" });
        const dummyParse = func(new VigorParse(null));
        return this._next({ response: { parseConfig: dummyParse['_config'] } });
    }

    async request(): Promise<T> {
        const {
            request: { origin, path, query, method, headers, body, offset },
            retry: { limit, retryHeaders, unretry },
            interceptors: { before, after, onError, result },
            response: { retryConfig, parseConfig }
        } = this._config;

        let ctx: any = { option: null, result: null, path, origin };

        try {
            if (!/^(https?|data|blob|file|about):\/\//.test(origin)) throw new VigorFetchError(`${origin} Invalid Protocol`, { type: "Invalid Protocol", data: origin, origin: origin, status: 0 });

            const isJson = Array.isArray(body) || (!!body && Object.getPrototypeOf(body) === Object.prototype);
            ctx.option = {
                method: method || (body ? "POST" : "GET"),
                headers: { ...(isJson && { "Content-Type": "application/json" }), ...headers },
                ...(body && { body: isJson ? JSON.stringify(body) : body }),
                ...offset
            };

            for (const func of before) {
                if (typeof func !== 'function') throw new VigorFetchError('Interceptor<before> is not a function', { type: "not a function", data: "before" });
                const next = await func(ctx, ctx.option);
                if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
            }

            const originBase = ctx.origin.endsWith('/') ? ctx.origin : ctx.origin + '/';
            const cleanPath = ctx.path.replace(/^\//, "");
            const urlObj = cleanPath ? new URL(cleanPath, originBase) : new URL(ctx.origin);

            Object.entries(query).forEach(([key, value]) => {
                if (value !== null && value !== undefined) urlObj.searchParams.append(key, String(value));
            });

            const url = urlObj.href;
            ctx.url = url;

            const fetchTarget = async () => {
                const controller = new AbortController();
                const abort = setTimeout(() => controller.abort(), limit);
                const http = ctx.option;
                http.signal = controller.signal;
                const res = await fetch(url, http);
                clearTimeout(abort);
                return res;
            };

            const handle429 = async (ctx: any) => {
                const res = ctx.result;
                if(unretry.has(res.status)) throw new Error(`Unretry ${res.status}`)
                if (!res || res.status !== 429) return;
                const rHeader = retryHeaders.map((h: string) => res.headers.get(h)).find(Boolean);
                let delay = 0;
                if (rHeader) {
                    delay = isNaN(Number(rHeader)) ? new Date(rHeader).getTime() - Date.now() : Number(rHeader) * 1000;
                }
                ctx.wait = Math.max(0, delay) + Math.random() * ctx.jitter;
                if (ctx.wait > ctx.max) throw new Error(`${url} Timeouted ${ctx.wait}ms`);
                await new Promise(r => setTimeout(r, ctx.wait));
                ctx.retry = true;
            };

            const retryInstance = new VigorRetry(fetchTarget, [], retryConfig).onRetry(handle429);
            ctx.result = await retryInstance.request();

            for (const func of after) {
                if (typeof func !== 'function') throw new VigorFetchError('Interceptor<after> is not a function', { type: "not a function", data: "after" });
                const next = await func(ctx, ctx.result);
                if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
            }

            const parseInstance = new VigorParse(ctx.result, parseConfig);
            ctx.final = await parseInstance.request();

            for (const func of result) {
                if (typeof func !== 'function') throw new VigorFetchError('Interceptor<result> is not a function', { type: "not a function", data: "result" });
                const next = await func(ctx.final);
                if (next !== undefined) ctx.final = next;
            }

            if (ctx.final instanceof Error) throw ctx.final;
            return ctx.final;
        } catch (mainError: any) {
            ctx.mainError = mainError;
            for (const func of onError) {
                if (typeof func !== 'function') throw new VigorFetchError('Interceptor<onError> is not a function', { type: "not a function", data: "onError" });
                const next = await func(ctx, ctx.mainError);
                if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
            }
            if (ctx.mainError instanceof Error) throw ctx.mainError;
            return ctx.mainError;
        }
    }
}

/**
 * VigorAll
 */
class VigorAll<T = any> {
    private _config: any;

    constructor(config: any) {
        this._config = {
            settings: { limit: 10, jitter: 1000 },
            request: { promises: [] },
            response: { retryConfig: undefined, parseConfig: undefined },
            interceptors: { before: [], after: [], onError: [] },
            ...config
        };
    }

    private _next(changes: any): VigorAll<T> {
        return new (this.constructor as any)({
            ...this._config,
            ...changes,
            settings: { 
                ...this._config.settings, 
                ...(changes.settings || {}) 
            },
            request: { 
                ...this._config.request, 
                ...(changes.request || {}) 
            },
            interceptors: { 
                ...this._config.interceptors, 
                ...(changes.interceptors || {}) 
            }
        });
    }

    promises(...func: (() => Promise<any>)[]) { return this._next({ request: { promises: [...this._config.request.promises, ...func.flat()] } }); }
    limit(int: number) { return this._next({ settings: { limit: int } }); }
    jitter(ms: number) { return this._next({ settings: { jitter: ms } }); }
    before(...func: Function[]) { return this._next({ interceptors: { before: [...this._config.interceptors.before, ...func.flat()] } }); }
    after(...func: Function[]) { return this._next({ interceptors: { after: [...this._config.interceptors.after, ...func.flat()] } }); }
    onError(...func: Function[]) { return this._next({ interceptors: { onError: [...this._config.interceptors.onError, ...func.flat()] } }); }

    async request(): Promise<any[]> {
        const { settings: { limit, jitter }, request: { promises }, interceptors: { before, after, onError } } = this._config;
        let ctx: any = { limit, jitter, promises, result: null };

        try {
            for (const func of before || []) {
                if (typeof func !== 'function') throw new VigorAllError('Interceptor<before> is not a function', { type: "not a function", data: "before" });
                const next = await func(ctx, ctx.promises);
                if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
            }

            const results: Promise<any>[] = [];
            const executing = new Set<Promise<any>>();

            for (const task of ctx.promises) {
                const p: Promise<any> = Promise.resolve()
                    .then(() => new Promise(res => setTimeout(res, Math.random() * ctx.jitter)))
                    .then(() => task());

                results.push(p);
                executing.add(p);
                p.finally(() => executing.delete(p));

                if (executing.size >= ctx.limit) {
                    await Promise.race(executing);
                }
            }

            const ready = await Promise.allSettled(results);
            ctx.result = ready.map(i => {
                if (i.status === "fulfilled") return i.value;
                return i.reason instanceof VigorAllError ? i.reason : new VigorAllError(i.reason?.message || "Unknown", { message: i.reason?.message || "Unknown" });
            });

            for (const func of after) {
                if (typeof func !== 'function') throw new VigorAllError('Interceptor<after> is not a function', { type: "not a function", data: "after" });
                const next = await func(ctx, ctx.result);
                if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
            }
            if (ctx.result instanceof Error) throw ctx.result;
            return ctx.result;
        } catch (mainError: any) {
            ctx.mainError = mainError;
            for (const func of onError) {
                if (typeof func !== 'function') throw new VigorAllError('Interceptor<onError> is not a function', { type: "not a function", data: "onError" });
                const next = await func(ctx, ctx.mainError);
                if (next !== undefined && typeof next === 'object' && !Array.isArray(next)) ctx = { ...ctx, ...next };
            }
            if (ctx.mainError instanceof Error) throw ctx.mainError;
            return ctx.mainError;
        }
    }
}

/**
 * Main Vigor Class
 */
class Vigor {
    _Fetch = VigorFetch;
    _Retry = VigorRetry;
    _Parse = VigorParse;
    _All = VigorAll;

    use(plugin: (instance: Vigor, options?: any) => void, options: any = {}) {
        if (typeof plugin === 'function') {
            plugin(this, options);
        }
        return this;
    }

    fetch<T = any>(origin?: string, config?: any) { 
        return new this._Fetch<T>(origin, config); 
    }
    
    retry<T = any>(target: (...args: any[]) => Promise<T> | T, args?: any[], config?: any) { 
        return new this._Retry<T>(target, args, config); 
    }
    
    parse<T = any>(response: Response | null, config?: any) { 
        return new this._Parse<T>(response, config); 
    }
    
    all<T = any>(config?: any) { 
        return new this._All<T>(config); 
    }
}

const vigor = new Vigor();

const vigorInstance = vigor as any;
vigorInstance.VigorError = VigorError;
vigorInstance.VigorRetryError = VigorRetryError;
vigorInstance.VigorParseError = VigorParseError;
vigorInstance.VigorFetchError = VigorFetchError;
vigorInstance.VigorAllError = VigorAllError;
vigorInstance.VigorFetch = VigorFetch;
vigorInstance.VigorRetry = VigorRetry;
vigorInstance.VigorParse = VigorParse;
vigorInstance.VigorAll = VigorAll;

export { 
  VigorAll, VigorAllError, VigorError, VigorFetch, 
  VigorFetchError, VigorParse, VigorParseError, 
  VigorRetry, VigorRetryError, 
  vigor 
};
export default vigor;
export type { VigorErrorOptions };