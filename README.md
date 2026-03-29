# vigor-fetch

**Vigor** is a lightweight TypeScript HTTP utility library.  
It lets you compose `fetch`, retry, response parsing, and parallel requests using a clean fluent chaining API.

---

## Features

- 🔁 **Auto Retry** — Exponential backoff with jitter support
- 🌐 **Smart Fetch** — Automatic 429 Rate Limit header handling, configurable unretry status codes
- 📦 **Auto Parsing** — Content-Type based response parsing (JSON, Blob, FormData, etc.)
- ⚡ **Parallel Requests** — `Promise.allSettled` wrapper with concurrency limit and jitter
- 🔌 **Interceptors** — Lifecycle hooks: `before` / `after` / `onRetry` / `onError`
- 🧩 **Plugins** — Extend functionality via the `use()` method
- 💡 **Immutable Chaining** — Every config method returns a new instance with no side effects
- ⚡ **Zero Dependencies** — Built using native Fetch API and AbortController.
---

## Why Vigor?
 
| Feature | Vigor | native fetch | ky | axios |
|---|:---:|:---:|:---:|:---:|
| Zero dependencies | ✅ | ✅ | ✅ | ❌ |
| Auto retry with backoff | ✅ | ❌ | ✅ | ❌ |
| 429 rate-limit header handling | ✅ | ❌ | ❌ | ❌ |
| Jitter on retry | ✅ | ❌ | ❌ | ❌ |
| Auto response parsing | ✅ | ❌ | partial | partial |
| Fluent chaining API | ✅ | ❌ | ✅ | ❌ |
| Concurrency-limited parallel requests | ✅ | ❌ | ❌ | ❌ |
| Lifecycle interceptors | ✅ | ❌ | ✅ | ✅ |
| Plugin system | ✅ | ❌ | ❌ | ❌ |
| TypeScript-first | ✅ | ❌ | ✅ | partial |

## Installation

```bash
npm install vigor-fetch
```

---

## Quick Start

```typescript
import vigor from 'vigor-fetch';

// Basic GET request
const data = await vigor
  .fetch('https://api.example.com')
  .path('/users')
  .request();

// POST request
const result = await vigor
  .fetch('https://api.example.com')
  .path('/users')
  .body({ name: 'John', age: 30 })
  .request();
```

---

## API Reference

### `vigor.fetch(origin?)` — VigorFetch

Builds and executes an HTTP request.

| Method | Description |
|---|---|
| `.origin(str)` | Set the base URL |
| `.path(str)` | Set the URL path |
| `.query(obj)` | Set query parameters |
| `.method(str)` | Set the HTTP method (default: POST if body present, otherwise GET) |
| `.headers(obj)` | Set request headers |
| `.body(obj)` | Set the request body (objects/arrays are automatically JSON-serialized) |
| `.offset(obj)` | Pass options directly to `fetch` |
| `.maxDelay(ms)` | Maximum wait time per retry (ms) |
| `.retryHeaders(...str)` | Add custom headers for Rate Limit detection |
| `.unretry(...int)` | Set HTTP status codes that should not be retried |
| `.retryConfig(fn)` | Customize the internal VigorRetry configuration |
| `.parseConfig(fn)` | Customize the internal VigorParse configuration |
| `.before(...fn)` | Interceptor called before the request |
| `.after(...fn)` | Interceptor called after response is received (before parsing) |
| `.result(...fn)` | Interceptor called after parsing is complete |
| `.onError(...fn)` | Interceptor called on error |
| `.request()` | Execute the request |

**Example**

```typescript
const data = await vigor
  .fetch('https://api.example.com')
  .path('/items')
  .query({ page: 1, limit: 20 })
  .headers({ Authorization: 'Bearer TOKEN' })
  .retryConfig(r => r.count(3).baseDelay(500))
  .before(async (ctx) => {
    console.log('Request started:', ctx.url);
  })
  .onError(async (ctx, err) => {
    console.error('Error occurred:', err.message);
  })
  .request();
```

---

### `vigor.retry(target, args?, config?)` — VigorRetry

Applies retry logic to any async function.

| Method | Description |
|---|---|
| `.args(...args)` | Set arguments to pass to the target function |
| `.count(n)` | Maximum number of attempts (default: 5) |
| `.max(ms)` | Maximum wait time per attempt (default: 10000ms) |
| `.backoff(factor)` | Exponential backoff multiplier (default: 1.3) |
| `.baseDelay(ms)` | Base delay between retries (default: 1000ms) |
| `.jitter(ms)` | Random jitter range added to each delay (default: 500ms) |
| `.before(...fn)` | Interceptor called before each attempt |
| `.after(...fn)` | Interceptor called after each successful attempt |
| `.onRetry(...fn)` | Interceptor called when a retry is triggered |
| `.onError(...fn)` | Interceptor called on final failure |
| `.request()` | Execute |

**Example**

```typescript
const result = await vigor
  .retry(async () => {
    const res = await fetch('https://api.example.com/unstable');
    if (!res.ok) throw new Error('Failed');
    return res.json();
  })
  .count(5)
  .baseDelay(1000)
  .backoff(1.5)
  .jitter(300)
  .onRetry(async (ctx) => {
    console.log(`Retry #${ctx.attempt}, waiting ${ctx.wait}ms`);
  })
  .request();
```

---

### `vigor.parse(response?)` — VigorParse

Automatically parses a `Response` object based on its Content-Type.

| Content-Type | Parsing Method |
|---|---|
| `application/json` | `response.json()` |
| `multipart/form-data` | `response.formData()` |
| `application/octet-stream` | `response.arrayBuffer()` |
| `image/*`, `video/*`, `audio/*`, `pdf` | `response.blob()` |
| anything else | `response.text()` |

| Method | Description |
|---|---|
| `.original(bool)` | If `true`, returns the raw Response without parsing |
| `.type(str)` | Force a specific parsing method: `'json'`, `'text'`, `'blob'`, etc. |
| `.before(...fn)` | Interceptor called before parsing |
| `.after(...fn)` | Interceptor called after parsing |
| `.onError(...fn)` | Interceptor called on error |
| `.request()` | Execute parsing |

**Example**

```typescript
const raw = await fetch('https://api.example.com/data');

// Auto parsing based on Content-Type
const parsed = await vigor.parse(raw).request();

// Force text parsing
const text = await vigor.parse(raw).type('text').request();

// Return the raw Response object
const original = await vigor.parse(raw).original(true).request();
```

---

### `vigor.all(config?)` — VigorAll

Runs multiple async tasks in parallel with a concurrency limit.

| Method | Description |
|---|---|
| `.promises(...fn)` | Add Promise factory functions to execute |
| `.limit(n)` | Maximum number of concurrent tasks (default: 10) |
| `.jitter(ms)` | Random delay before each task starts (default: 1000ms) |
| `.before(...fn)` | Interceptor called before execution |
| `.after(...fn)` | Interceptor called after all tasks complete |
| `.onError(...fn)` | Interceptor called on error |
| `.request()` | Execute — always returns an array; failed items are `VigorAllError` instances |

**Example**

```typescript
const tasks = [1, 2, 3, 4, 5].map(id =>
  () => vigor.fetch('https://api.example.com').path(`/items/${id}`).request()
);

const results = await vigor
  .all()
  .promises(...tasks)
  .limit(3)     // Run at most 3 tasks concurrently
  .jitter(200)  // Add 0–200ms random delay before each task starts
  .request();

results.forEach((res, i) => {
  if (res instanceof VigorAllError) {
    console.error(`Task ${i} failed:`, res.message);
  } else {
    console.log(`Task ${i} succeeded:`, res);
  }
});
```

---

## Interceptor Context (`ctx`)

All interceptor functions receive a `ctx` object as their first argument.  
Returning a plain object from an interceptor merges its keys into `ctx`, making them available to subsequent interceptors.

```typescript
vigor
  .fetch('https://api.example.com')
  .before(async (ctx, option) => {
    // Access ctx.origin, ctx.path, ctx.option, etc.
    return { requestId: 'abc-123' }; // merged into ctx
  })
  .after(async (ctx, response) => {
    // ctx.requestId === 'abc-123'
    // ctx.result: current response object
  })
  .request();
```

---

## Error Classes

| Class | Description |
|---|---|
| `VigorError` | Base error class |
| `VigorFetchError` | Error thrown during fetch |
| `VigorRetryError` | Error thrown during retry |
| `VigorParseError` | Error thrown during parsing |
| `VigorAllError` | Error thrown during parallel execution |

All errors share the following shape:

```typescript
interface VigorErrorOptions {
  type?: string;    // Error category
  data?: any;       // Related data
  status?: number;  // HTTP status code
  response?: any;   // Original response
  message?: string; // Custom message
  origin?: string;  // Request origin
}
```

---

## Plugins

Use `vigor.use(plugin, options?)` to extend behavior.

```typescript
const authPlugin = (instance, options) => {
  const original = instance.fetch.bind(instance);
  instance.fetch = (origin, config) =>
    original(origin, config).headers({ Authorization: `Bearer ${options.token}` });
};

vigor.use(authPlugin, { token: 'MY_TOKEN' });

// Authorization header is now automatically attached to every vigor.fetch() call
const data = await vigor.fetch('https://api.example.com').path('/me').request();
```

---