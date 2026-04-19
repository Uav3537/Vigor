# vigor-fetch

**Vigor** is a lightweight (gzipped ~7.7kb) TypeScript HTTP / Retry utility library.  
Vigor provides a fluent, chainable API for building robust network logic with built-in retry, backoff, interceptors, parsing, and concurrency control.

---

## Features

- 🧩 **Fluent & Immutable API** — Fully composable, side-effect-free chaining
- 🔁 **Advanced Retry System** — Exponential backoff with jitter support.
- 🌐 **Smart Fetch Layer** — Automatic 429 handling & configurable retry rules
- ⚡ **Parallel Requests** — Concurrency-limited task runner
- 🔌 **Smart Response Parsing** — Auto parsing based on Content-Type
- ⚡ **Zero Dependencies** — Built on native Fetch + AbortController
- 🪝 **Powerful Interceptors** — Lifecycle hooks for full control flow
- 🧠 **TypeScript First** — Fully typed inference across all modules


---


## Installation

```bash
npm install vigor-fetch
```

## Why Vigor?
 
| Feature | Vigor | native fetch | ky | axios |
|---|:---:|:---:|:---:|:---:|
| Zero dependencies | ✅ | ✅ | ❌ | ✅ |
| 429 rate-limit handling | ✅ | ❌ | ✅(manual/config-based) | ❌ |
| Retry with jitter | ✅ | ❌ | ✅ | ❌ |
| Exponential backoff | ✅ | ❌ | ✅ | ❌ |
| Auto response parsing | ✅ | ❌ | ✅ | ✅ |
| Fluent chaining API | ✅ | ❌ | ✅ | ❌ |
| Concurrency control | ✅ | ❌ | ❌ | ❌ |
| Lifecycle interceptors | ✅ | ❌ | partial | ❌ |
| Plugin system | ✅ | ❌ | ❌ | ❌ |

## Quick Start

```ts
import vigor from "vigor-fetch";
const data = await vigor
  .fetch("https://api.example.com")
  .path("api", "v1", "main")
  .request()
```

# 🛠️ Vigor API Reference


---


# 📡 vigor.fetch(origin)

vigor.fetch(origin: string)

## Chain Methods

| Method | Type | Description |
|--------|------|-------------|
| origin | (string) => VigorFetch | Set base URL |
| path | (...string[]) => VigorFetch | Append URL path segments |
| query | (object) => VigorFetch | Set query parameters |
| method | (VigorFetchMethods) => VigorFetch | Set HTTP method |
| headers | (HeadersInit) => VigorFetch | Set request headers |
| body | (any) => VigorFetch | Set request body |
| options | (object) => VigorFetch | Merge fetch options |
| setting | (fn: (s: VigorFetchSettings) => VigorFetchSettings) => VigorFetch | Settings pipeline |
| retryConfig | (fn: (r: VigorRetry) => VigorRetry) => VigorFetch | Retry engine config |
| parseConfig | (fn: (p: VigorParse) => VigorParse) => VigorFetch | Response parser config |
| interceptors | (fn: (i: VigorFetchInterceptors) => VigorFetchInterceptors) => VigorFetch | Lifecycle hooks |
| request | () => Promise<T> | Execute request |


---


## ⚙️ fetch().setting(s => s)

| Field | Type | Description |
|------|------|-------------|
| origin | string | Base URL |
| path | string[] | URL segments |
| query | object | Query params |
| unretry | number[] | Non-retry status codes |
| retryHeaders | string[] | Retry-related headers |
| method | string | HTTP method |
| headers | object | Request headers |
| body | any | Request body |
| options | object | Fetch options |
| default | T | Fallback value |


---


## 🧩 fetch().interceptors(i => i)

| Hook | Signature | Description |
|------|----------|-------------|
| before | (ctx, { setOptions, throwError }) => void | Before request |
| after | (ctx, { throwError }) => void | After success |
| onError | (ctx, { setResult, throwError }) => void | Error handler |
| result | (ctx, { setResult, throwError }) => void | Final result hook |


---


# 🔁 vigor.retry(task)

vigor.retry(task: VigorRetryTask<T>)

## Methods

| Method | Type | Description |
|--------|------|-------------|
| target | (fn: VigorRetryTask<T>) => VigorRetry | Set retry function |
| setting | (fn: (s: VigorRetrySettings) => VigorRetrySettings) => VigorRetry | Retry settings |
| backoff | (fn: (b: VigorRetryBackoff) => VigorRetryBackoff) => VigorRetry | Backoff strategy |
| interceptors | (fn: (i: VigorRetryInterceptors) => VigorRetryInterceptors) => VigorRetry | Lifecycle hooks |
| request | () => Promise<T> | Execute retry flow |
| createController | () => (error: Error) => void | Abort controller |


---


## ⚙️ retry().setting(s => s)

| Field | Type | Description |
|------|------|-------------|
| count | number | Max retry attempts |
| limit | number | Timeout per attempt |
| maxDelay | number | Max delay cap |
| default | T | Fallback value |


---


## 📈 retry().backoff(b => b)

| Field | Type | Description |
|------|------|-------------|
| initialDelay | number | Initial delay |
| baseDelay | number | Base delay |
| factor | number | Exponential multiplier |
| jitter | number | Random noise |


---


## 🧩 retry().interceptors(i => i)

| Hook | Signature | Description |
|------|----------|-------------|
| before | (ctx, { setAttempt, throwError, abort }) => void | Before execution |
| after | (ctx, { setAttempt, setResult, throwError }) => void | After success |
| onError | (ctx, { setResult, throwError }) => void | Error handling |
| onRetry | (ctx, { setDelay }) => void | Retry event |
| retryIf | (ctx, { proceedRetry, cancelRetry }) => void | Retry decision |


---


# ⚡ vigor.all(tasks)

vigor.all(tasks: VigorAllTask<T>[])

## Methods

| Method | Type | Description |
|--------|------|-------------|
| target | (...tasks) => VigorAll | Set tasks |
| setting | (fn: (s: VigorAllSettings) => VigorAllSettings) => VigorAll | Concurrency config |
| interceptors | (fn: (i: VigorAllInterceptors) => VigorAllInterceptors) => VigorAll | Hooks |
| request | () => Promise<Array<T | Error>> | Execute all tasks |


---


## ⚙️ all().setting(s => s)

| Field | Type | Description |
|------|------|-------------|
| concurrency | number | Max parallel tasks |
| jitter | number | Delay randomness |


---


## 🧩 all().interceptors(i => i)

| Hook | Signature | Description |
|------|----------|-------------|
| before | (ctx) => void | Before each task |
| after | (ctx, { setResult }) => void | After success |
| onError | (ctx, { setResult }) => void | Error handling |
| result | (ctx, { setResult }) => void | Final aggregation |


---


# 🧪 vigor.parse(response)

vigor.parse(response: Response)

| Method | Type | Description |
|--------|------|-------------|
| target | Response | Set response |
| original | boolean | Return raw response |
| type | keyof Response | Force parse type |
| request | () => Promise<T> | Execute parsing |


---


# 🚀 vigor.fetch examples

## GET request
```ts
vigor.fetch("https://api.example.com")
  .path("users", "profile")
  .query({ id: 123 })
  .method("GET")
  .request()
```
---

## POST request
```ts
vigor.fetch("https://api.example.com")
  .path("users")
  .method("POST")
  .headers({
    Authorization: "Bearer TOKEN"
  })
  .body({
    name: "John",
    age: 30
  })
  .request()
```
---

## fetch + retry + backoff + parse
```ts
vigor.fetch("https://api.example.com")
  .path("data")
  .retryConfig(r =>
    r
      .setting(s =>
        s
          .count(3)
          .limit(5000)
      )
      .backoff(b =>
        b
          .factor(2)
          .jitter(300)
      )
  )
  .parseConfig(p =>
    p.original(false)
  )
  .request()
```
---

# 🔁 vigor.retry examples

## basic retry
```ts
vigor.retry(async (ctx, { signal }) => {
  const res = await fetch("https://api.example.com/data", { signal })
  if (!res.ok) throw new Error("failed")
  return res.json()
})
.setting(s =>
  s
    .count(5)
    .limit(3000)
)
.backoff(b =>
  b
    .baseDelay(500)
    .factor(2)
)
.request()
```


---


## retryIf control
```ts
vigor.retry(async () => {
  const res = await fetch("https://api.example.com")
  return res.json()
})
.interceptors(i =>
  i.retryIf((ctx, { cancelRetry }) => {
    const result = ctx.runtime.result

    if (result?.error === "fatal") {
      cancelRetry()
    }
  })
)
.request()
```


---


## abort controller
```ts
const retry = vigor.retry(async (ctx, { signal }) => {
  const res = await fetch("https://api.example.com", { signal })
  return res.json()
})

const abort = retry.createController()

setTimeout(() => {
  abort(new Error("manual abort"))
}, 2000)

await retry.request()
```


---


# ⚡ vigor.all examples
```ts
vigor.all([
  async () => fetch("https://api.com/a").then(r => r.json()),
  async () => fetch("https://api.com/b").then(r => r.json()),
  async () => fetch("https://api.com/c").then(r => r.json())
]).request()
```


---


```ts
vigor.all([
  async () => "A",
  async () => "B",
  async () => "C",
  async () => "D"
])
.setting(s =>
  s
    .concurrency(2)
    .jitter(500)
)
.request()
```


---


```ts
vigor.all([
  async () => "ok1",
  async () => { throw new Error("fail") },
  async () => "ok2"
]).request()
```

---


# 🧪 vigor.parse examples
```ts
const res = await fetch("https://api.com/data")

vigor.parse(res).request()
```


---


```ts
const img = await fetch("https://api.com/image.png")

vigor.parse(img)
  .type("blob")
  .request()
```


---


```ts
const raw = await fetch("https://api.com")

vigor.parse(raw)
  .original(true)
  .request()
```


---


# 🔥 full pipeline example
```ts
vigor.fetch("https://api.example.com")
  .path("users")
  .query({ page: 1 })
  .method("GET")
  .retryConfig(r =>
    r
      .setting(s =>
        s
          .count(3)
          .limit(5000)
      )
      .backoff(b =>
        b
          .factor(2)
          .jitter(200)
      )
      .interceptors(i =>
        i.onRetry((ctx, { setDelay }) => {
          setDelay(1000)
        })
      )
  )
  .parseConfig(p =>
    p.original(false)
  )
  .interceptors(i =>
    i.result(() => {
      console.log("done")
    })
  )
  .request()
```


---