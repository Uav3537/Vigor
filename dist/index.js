'use strict';

class VigorError extends Error {
    constructor(text, { url = null, status = 0, message, data = null }) {
        super(text);
        this.name = "VigorError";
        this.url = url;
        this.status = status;
        this.message = message || text;
        this.data = data;
    }
}
class VigorFetch {
    constructor(origin, config) {
        this._origin = origin;
        this._config = config || {
            path: "", method: null, offset: {}, headers: {}, body: null,
            count: 5, max: 5000, wait: 10000, backoff: 1.3,
            unretry: new Set([400, 401, 403, 404, 405, 413, 422]),
            retryHeader: ["retry-after", "ratelimit-reset", "x-ratelimit-reset", "x-retry-after", "x-amz-retry-after", "chrome-proxy-next-link"],
            original: false, parse: null, query: {}, jitter: 500,
            beforeRequest: [], afterRequest: [], beforeResponse: [], afterResponse: [], onError: []
        };
    }
    _next(changes) {
        return new VigorFetch(this._origin, { ...this._config, ...changes });
    }
    path(arg) { return this._next({ path: arg }); }
    method(arg) { return this._next({ method: arg }); }
    offset(arg) { return this._next({ offset: arg }); }
    headers(arg) { return this._next({ headers: arg }); }
    body(arg) { return this._next({ body: arg }); }
    count(arg) { return this._next({ count: arg }); }
    max(arg) { return this._next({ max: arg }); }
    wait(arg) { return this._next({ wait: arg }); }
    backoff(arg) { return this._next({ backoff: arg }); }
    unretry(arg) { return this._next({ unretry: new Set(arg) }); }
    retryHeader(...arg) { return this._next({ retryHeader: [...this._config.retryHeader, ...arg] }); }
    original(arg) { return this._next({ original: arg }); }
    parse(arg) { return this._next({ parse: arg }); }
    query(arg) { return this._next({ query: { ...this._config.query, ...arg } }); }
    jitter(arg) { return this._next({ jitter: arg }); }
    beforeRequest(...arg) { return this._next({ beforeRequest: [...this._config.beforeRequest, ...arg] }); }
    afterRequest(...arg) { return this._next({ afterRequest: [...this._config.afterRequest, ...arg] }); }
    beforeResponse(...arg) { return this._next({ beforeResponse: [...this._config.beforeResponse, ...arg] }); }
    afterResponse(...arg) { return this._next({ afterResponse: [...this._config.afterResponse, ...arg] }); }
    onError(...arg) { return this._next({ onError: [...this._config.onError, ...arg] }); }
    async request() {
        const { path, method, offset, headers, body, query, count, max, wait, backoff, unretry, jitter, original, parse, retryHeader, beforeRequest, afterRequest, beforeResponse, afterResponse, onError, } = this._config;
        try {
            if (!/^(https?|data|blob|file|about):\/\//.test(this._origin)) {
                throw new VigorError(`[vigor] ${this._origin} >> Invalid Protocol`, {
                    url: this._origin, status: 0, message: "Invalid Protocol"
                });
            }
            const urlObj = new URL(path.replace(/^\//, ""), this._origin + "/");
            Object.entries(query).forEach(([key, value]) => {
                if (value !== null && value !== undefined)
                    urlObj.searchParams.append(key, String(value));
            });
            const url = urlObj.href;
            const isJson = Array.isArray(body) || (!!body && Object.getPrototypeOf(body) === Object.prototype);
            const waitTimeout = (time) => new Promise(resolve => setTimeout(resolve, time));
            let option = {
                ...offset,
                method: method || (body ? "POST" : "GET"),
                headers: { ...(isJson && { "Content-Type": "application/json" }), ...headers },
                ...(body && { body: isJson ? JSON.stringify(body) : body }),
            };
            for (const hook of beforeRequest) {
                const modified = await hook(option);
                if (modified)
                    option = { ...option, ...modified };
            }
            let req;
            for (let i = 0; i < count; i++) {
                const controller = new AbortController();
                const abort = setTimeout(() => controller.abort(), max);
                option.signal = controller.signal;
                try {
                    req = await fetch(url, option);
                    for (const hook of afterRequest) {
                        req = (await hook(req)) || req;
                    }
                    if (req.ok) {
                        clearTimeout(abort);
                        break;
                    }
                }
                catch (error) {
                    clearTimeout(abort);
                    if (i === count - 1)
                        throw new VigorError(`[vigor] ${url} >> Network Error`, { url, status: 0, message: "Network Error" });
                }
                finally {
                    clearTimeout(abort);
                }
                if (req) {
                    const status = req.status;
                    if (unretry.has(status))
                        throw new VigorError(`[vigor] ${url} >> Unretry ${status}`, { url, status, message: "Unretry", data: status });
                    const basic = Math.min(Math.pow(backoff, i) * 1000, wait) + Math.random() * jitter;
                    if (status === 429) {
                        const rHeader = retryHeader.map(h => req?.headers.get(h)).find(Boolean);
                        const delay = rHeader ? (isNaN(Number(rHeader)) ? new Date(rHeader).getTime() - Date.now() : Number(rHeader) * 1000) : 0;
                        const parsedDelay = Math.max(0, delay) + Math.random() * jitter;
                        if (parsedDelay > wait)
                            throw new VigorError(`[vigor] ${url} >> Timeouted ${parsedDelay}ms`, { url, status, message: "Timeouted", data: parsedDelay });
                        await waitTimeout(parsedDelay || basic);
                    }
                    else {
                        await waitTimeout(basic);
                    }
                }
            }
            if (!req)
                throw new Error("No response");
            let currentReq = req;
            for (const hook of beforeResponse) {
                currentReq = await hook(currentReq);
            }
            if (!currentReq.ok)
                throw new VigorError(`[vigor] ${url} >> Failed`, { url, status: currentReq.status, message: "Failed" });
            let res = await (async () => {
                if (original)
                    return currentReq;
                if (parse) {
                    const target = currentReq[parse];
                    return typeof target === 'function' ? await target.call(currentReq) : target;
                }
                const contentType = currentReq.headers.get("Content-Type") || "";
                if (/json/.test(contentType))
                    return await currentReq.json();
                if (/(image|video|audio|pdf)/.test(contentType))
                    return await currentReq.blob();
                return await currentReq.text();
            })();
            for (const hook of afterResponse) {
                res = await hook(res);
            }
            return res;
        }
        catch (error) {
            let currentError = error;
            for (const hook of onError) {
                const result = await hook(currentError);
                if (result !== undefined && !(result instanceof Error))
                    return result;
                currentError = result || currentError;
            }
            throw currentError;
        }
    }
}
class VigorAll {
    constructor(config) {
        this._config = config || { limit: 10, jitter: 1000, promises: [] };
    }
    _next(changes) { return new VigorAll({ ...this._config, ...changes }); }
    limit(arg) { return this._next({ limit: arg }); }
    jitter(arg) { return this._next({ jitter: arg }); }
    promises(...args) { return this._next({ promises: [...this._config.promises, ...args] }); }
    async request() {
        const { limit, jitter, promises } = this._config;
        const results = [];
        const executing = new Set();
        for (const task of promises) {
            const p = Promise.resolve()
                .then(() => new Promise(res => setTimeout(res, Math.random() * jitter)))
                .then(() => task());
            results.push(p);
            executing.add(p);
            p.finally(() => executing.delete(p));
            if (executing.size >= limit)
                await Promise.race(executing);
        }
        const ready = await Promise.allSettled(results);
        return ready.map(i => {
            if (i.status === "fulfilled")
                return i.value;
            return i.reason instanceof VigorError ? i.reason : new VigorError(i.reason?.message || "Unknown", { message: i.reason?.message || "Unknown" });
        });
    }
}
class Vigor {
    fetch(origin, config) {
        return new VigorFetch(origin, config);
    }
    all(config) {
        return new VigorAll(config);
    }
}
const vigor = new Vigor();

module.exports = vigor;
