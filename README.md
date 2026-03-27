# vigor-fetch 🚀

**Vigor** is a lightweight, zero-dependency HTTP client designed for resilience. It intelligently handles server rate limits (429 Too Many Requests) and network instability with built-in retry mechanisms.

## ✨ Features

- 🛡️ **Smart Resilience:** Automatically handles 429 errors by respecting `Retry-After` headers.
- 📈 **Exponential Backoff & Jitter:** Prevents server hammering by increasing wait times with random variation.
- ⚡ **Zero Dependencies:** Built using native Fetch API and AbortController.
- ⚡ **Tiny footprint** (~3 KB)
- 🎯 **Fully Type-Safe:** Written in TypeScript for excellent developer experience and auto-completion.
- 🚦 **Concurrency Control**: Execute bulk requests with a global limit and inter-request jitter using the VigorAll engine.
- 🎯 **Immutable Chaining**: Every configuration method returns a new instance, making it perfect for base templates and functional patterns.

## 📦 Installation
```powershell

npm install vigor-fetch

```

## Why Vigor?

| Feature | Vigor | Axios | Native fetch |
|-------|------|------|-------------|
| Built-in Retry | ✅ | ❌ | ❌ |
| Rate-limit handling | ✅ | ❌ | ❌ |
| Concurrency control | ✅ | ❌ | ❌ |
| Zero dependencies | ✅ | ❌ | ✅ |
| Immutable request builder | ✅ | ❌ | ❌ |

## Use Cases

**Vigor is useful when:**

- Your API frequently returns 429 (Too Many Requests)
- You need automatic retry with exponential backoff
- You want concurrency control for batch requests
- You prefer immutable request builders

## 🛠️ API References

1. **vigor.fetch(origin)**

| Method | Type | Default | Description
| :--- | :--- | :--- | :--- |
| .path(arg) | string | "" | Sets the endpoint path to be appended to the origin. |
| .query(arg) | Record<string, any> | {} | Appends key-value pairs as query parameters to the URL. |
| .method(arg) | string | "POST" | "GET" (depends on body) | Sets the HTTP request method. |
| .headers(arg) | Record<string, string> | {} | Sets the HTTP request headers. |
| .body(arg) | any | null | Sets the request body |
| .offset(arg) | RequestInit | {} | Provides raw fetch options to be merged into the request. |
| .count(arg) | number | 5 | Specifies the maximum number of retry attempts for the request. |
| .max(arg) | number | 5000 | Sets the timeout (in ms) for each individual request attempt. |
| .wait(arg) | number | 10000 | Sets the maximum wait time (in ms) between retry attempts. |
| .backoff(arg) | number | 1.3 | The multiplier used for exponential backoff between retries. |
| .jitter(arg) | number | 500 | Adds a random delay (up to this value in ms) to prevent thundering herd issues. |
| .unretry(arg[]) | number[] | [400, 401, 403, 404, 405, 413, 422] | List of HTTP status codes that should NOT trigger a retry. |
| .retryHeader(...arg) | string[] | ['retry-after', ...] | Custom headers to check for server-defined retry delays |
| .original(bool) | boolean | false | If true, returns the raw Response object instead of parsed data. |
| .parse(key) | keyof Response | null | Forces the use of a specific Response method (e.g., 'json', 'blob') for parsing. |
| .beforeRequest(...hooks) | Function[] | [] | Hooks executed to modify request options before the fetch occurs. |
| .afterRequest(...hooks) | Function[] | [] | Hooks executed immediately after the fetch, before the status check. |
| .beforeResponse(...hooks) | Function[] | [] | Hooks executed on the Response object before parsing the body. |
| .afterResponse(...hooks) | Function[] | [] | Hooks executed on the parsed data before returning the final result. |
| .onError(...hooks) | Function[] | [] | Hooks to handle errors; can recover from error by returning a value. |
| .request() | Promise<T> | - | Executes the request logic including retries and hooks. |

2. **Vigor().all(config)**

| Method | Type | Default | Description
| :--- | :--- | :--- | :--- |
| .limit(arg) | number | 10 | Maximum number of concurrent promises running at once. |
| .jitter(arg) | number | 1000 | Random delay (ms) applied before each task starts. |
| .promises(...args) | Function[] | [] | Adds functions that return promises to the execution queue. |
| .request() | Promise<any[]> | - | Executes all tasks with concurrency control and returns results. |

## 🚀 Quick Start

```javascript

import vigor from 'vigor-fetch';

const data = await vigor.fetch("https://api.example.com")
  .path("/v1/users")
  .method("POST")
  .headers({ "Authorization": "Bearer TOKEN" })
  .body({ name: "Uav1010" })
  .count(5)        // Retry up to 5 times
  .backoff(1.5)    // Multiply wait time by 1.5x each failure
  .parse("json")   // Auto-parse response as JSON
  .request();

```

## 🛠️ Advanced Patterns

1. **Request Templates**

```javascript

import vigor from 'vigor-fetch';

const apiClient = vigor.fetch("https://api.myapp.com")
  .headers({ "Content-Type": "application/json" })
  .unretry([401, 403, 404]) // Don't retry on these statuses
  .max(3000); // 3s timeout per attempt

const user = await apiClient.path("/me").request();
const settings = await apiClient.path("/settings").request();

```

2. **Batch Processing with Concurrency Limit**

```javascript

import vigor from 'vigor-fetch';

const tasks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(id => () => 
  vigor.fetch("https://api.com").path(`/data/${id}`).request()
);

const results = await vigor.all()
  .limit(3)       // Max 3 concurrent requests
  .jitter(500)    // Add up to 500ms random delay between starts
  .promises(...tasks)
  .request();

```

3. **Middleware & Hooks**

```javascript

import vigor from 'vigor-fetch';

const api = vigor.fetch("https://api.com")
  .beforeRequest((opt) => {
    opt.headers = { ...opt.headers, "X-Timestamp": Date.now().toString() };
  })
  .afterResponse((data) => {
    return { ...data, receivedAt: new Date() }; // Transform final result
  })
  .onError((err) => {
    if (err.status === 404) return { error: "Not Found", fallback: true };
    throw err; // Continue throwing if not handled
  });

```