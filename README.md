# vigor-fetch

## Vigor is a composable, lightweighted (gzipped ~10kb) network workflow toolkit built on top of native Fetch.

> Vigor provides a fluent, chainable API for building robust network logic with built-in retry, backoff, interceptors, parsing, and concurrency control.

---

## Features

- 🧩 **Fluent & Immutable API** — Fully composable, side-effect-free chaining
- 🔁 **Advanced Retry System** — Constant, linear, backoff, custom delay with jitter support.
- 🌐 **Smart Fetch Layer** — Automatic 429 handling & configurable retry rules
- ⚡ **Parallel Requests** — Concurrency-limited task runner
- 🔌 **Smart Response Parsing** — Auto parsing based on Content-Type, Sniffing
- ⚡ **Zero Dependencies** — Built on native Fetch + AbortController
- 🪝 **Powerful Interceptors** — Lifecycle hooks for full control flow
- 🧠 **TypeScript First** — Fully typed inference across all modules

---

## Installation

```bash

npm  install  vigor-fetch

```

## Why Vigor?

| Feature | Vigor | Axios | Ky | Got |
|---|:---:|:---:|:---:|:---:|
| Runtime | Browser + Node | Browser + Node | Browser + Node | Primarily Node.js |
| Built on Fetch | ✅ Native Fetch-based | ❌ Custom adapter-based | ✅ | ❌ |
| Immutable Fluent Builder | ✅ | ❌ | ⚠️ Partial | ⚠️ Partial |
| Built-in Retry Engine | ✅ Advanced | ⚠️ Limited | ✅ | ✅ |
| Custom Retry Algorithms | ✅ | ❌ | ⚠️ Limited | ⚠️ Limited |
| Retry Interceptors | ✅ | ❌ | ❌ | ❌ |
| Automatic RateLimit Handling (`429`) | ✅ | ❌ | ⚠️ Partial | ✅ |
| Automatic Content-Type Parsing | ✅ | ⚠️ Mostly JSON | ✅ | ✅ |
| Standalone Parse Engine | ✅ | ❌ | ❌ | ❌ |
| Custom Parsing Strategies | ✅ | ❌ | ❌ | ⚠️ Hook-level |
| Lifecycle Interceptors | ✅ Full lifecycle | ✅ | ⚠️ Hook-based | ✅ Hook-based |
| Concurrency Queue Engine | ✅ | ❌ | ❌ | ❌ |
| Default Fallback Values | ✅ | ❌ | ❌ | ❌ |

## Quick Start

### Fetch
```ts  
import vigor from "vigor-fetch";  

const data = await vigor  
	.fetch("https://api.example.com", "api")  
	.path("v1", "main")  
	.request();  
// -> https://api.example.com/api/v1/main
```
#### Advanced
```ts
const data = await vigor
  .fetch("https://api.example.com")
  .path("users")
  .retryConfig(r => r
	  .settings(s => s.attempt(5))
  )
  .parseConfig(p => p
  .strategies(s => s.sniff())
  )
  .interceptors(i => i
	  .onError((ctx, api) => {
	      api.retry();
	   })
  )
  .request();
```

### Retry
```ts
import vigor from "vigor-fetch";

const data = await vigor
	.retry(async(ctx, {signal, abort}) => {
		return await db.select(~)
	})
	.request()
```

### Parse
```ts  
import vigor from "vigor-fetch";  
  
const response = await fetch("https://api.example.com");  
const data = await vigor  
	.parse(response)  
	.request();  
```

### Concurrency  
```ts  
import vigor from "vigor-fetch";  
  
const data = await vigor  
	.all(  
		async () => fetch("/api/1"),  
		async () => fetch("/api/2")  
	)  
	.request();  
```

## vigor.retry  
  
### Methods  
  
| Method | Description |  
|---|---|  
| target(fn) | Sets retry target function |  
| settings(fn \| config) | Configures retry settings |  
| interceptors(fn \| config) | Configures retry interceptors |  
| algorithms(fn) | Configures retry delay algorithm |  
| abortSignals(...signals) | Attaches external AbortSignals |  
| request(config?) | Executes retry pipeline |  
  
---  
  
### target  
  
Sets the retry target.  
  
```ts  
vigor.retry(async () => {  
	return await fetch("/api");  
})  
```  
  
---  
  
### settings  
  
Configures retry behavior.  
  
```ts  
.settings(s => s  
	.attempt(10)  
	.timeout(5000)  
	.jitter(1000)  
)
```  
  
#### Settings API  
  
| Method | Description | Default |  
|---|---|---|  
| attempt(number) | Maximum retry attempts | `5` |  
| timeout(ms) | Timeout per attempt | `20000` |  
| jitter(ms) | Random retry jitter | `1000` |  
| default(value) | Fallback return value | `throws` |  
  
---  
  
### algorithms  
  
Configures retry delay algorithm.  
  
```ts  
.algorithms(a => a
	.backoff()  
	.initial(1000)  
	.multiplier(2)  
)  
```  
  
---  
  
## Retry Algorithms  
  
### constant  
  
Fixed retry delay.  
  
```ts  
.algorithms(a => a
	.constant()  
	.interval(2000)  
)  
```  
  
#### API  
  
| Method | Description |  
|---|---|  
| interval(ms) | Fixed retry interval |  
  
---  
  
### linear  
  
Linearly increasing delay.  
  
```ts  
.algorithms(a => a
	.linear()  
	.initial(1000)  
	.increment(1000)  
)  
```  
  
#### API  
  
| Method | Description |  
|---|---|  
| initial(ms) | Initial delay |  
| increment(ms) | Delay increment |  
| minDelay(ms) | Minimum delay |  
| maxDelay(ms) | Maximum delay |  
  
---  
  
### backoff  
  
Exponential backoff delay.  
  
```ts  
.algorithms(a => a
	.backoff()  
	.initial(1000)  
	.multiplier(1.7)  
)  
```  
  
#### API  
  
| Method | Description |  
|---|---|  
| initial(ms) | Initial delay |  
| multiplier(number) | Exponential multiplier |  
| unit(ms) | Delay unit |  
| minDelay(ms) | Minimum delay |  
| maxDelay(ms) | Maximum delay |  
  
---  
  
### custom  
  
Fully custom retry algorithm.  
  
```ts  
.algorithms(a => a
	.custom()  
	.func(attempt => {  
		return attempt * 3000;  
	})  
)  
```  
  
#### API  
  
| Method | Description |  
|---|---|  
| func(fn) | Custom delay calculator |  
  
---  
  
### abortSignals  
  
Attaches external AbortSignals.  
  
```ts  
const controller = new AbortController();  
  
await vigor  
	.retry(task)  
	.abortSignals(controller.signal)  
	.request();  
```  
  
---  
  
### request  
  
Executes retry workflow.  
  
```ts  
const result = await vigor  
	.retry(task)  
	.request();  
```  
  
---  
  
## Interceptors  
  
| Name | API |  
|---|:---:|  
| before | throwError / breakRetry / abort |  
| after | setResult / throwError / breakRetry |  
| result | setResult / throwError |  
| retryIf | proceedRetry / cancelRetry |  
| onRetry | throwError / setDelay / setAttempt |  
| onError | setResult / throwError / restart |  
  
---  
  
### before  
  
Runs before each retry attempt.  
  
```ts  
.before(async (ctx, api) => {  
	console.log(ctx.attempt);  
})  
```  
  
#### Available APIs  
  
| API | Description |  
|---|---|  
| throwError(error) | Immediately throws an error |  
| breakRetry(error) | Stops retry loop immediately |  
| abort(error) | Aborts current request |  
  
---  
  
### after  
  
Runs after successful task execution.  
  
```ts  
.after(async (ctx, api) => {  
	api.setResult({  
		wrapped: ctx.result  
	});  
})  
```  
  
#### Available APIs  
  
| API | Description |  
|---|---|  
| setResult(value) | Replaces current result |  
| throwError(error) | Throws an error |  
| breakRetry(error) | Stops retry loop |  
  
---  
  
### result  
  
Runs before returning final result.  
  
```ts  
.result(async (ctx, api) => {  
	api.setResult(transform(ctx.result));  
})  
```  
  
#### Available APIs  
  
| API | Description |  
|---|---|  
| setResult(value) | Replaces current result |  
| throwError(error) | Throws an error |  
  
---  
  
### retryIf  
  
Controls retry continuation.  
  
```ts  
.retryIf(async (ctx, api) => {  
	if (ctx.error instanceof TypeError) {  
		api.proceedRetry();  
	}  
	else {  
		api.cancelRetry();  
	}  
})  
```  
  
#### Available APIs  
  
| API | Description |  
|---|---|  
| proceedRetry() | Continues retry |  
| cancelRetry() | Cancels retry |  
  
---  
  
### onRetry  
  
Runs before retry delay.  
  
```ts  
.onRetry(async (ctx, api) => {  
	api.setDelay(5000);  
})  
```  
  
#### Available APIs  
  
| API | Description |  
|---|---|  
| throwError(error) | Throws an error |  
| setDelay(ms) | Overrides retry delay |  
| setAttempt(num) | Overrides attempt count |  
  
---  
  
### onError  
  
Runs after retry exhaustion.  
  
```ts  
.onError(async (ctx, api) => {  
	console.error(ctx.error);  
	api.restart();  
})  
```  
  
#### Available APIs  
  
| API | Description |  
|---|---|  
| setResult(value) | Returns fallback value |  
| throwError(error) | Throws an error |  
| restart() | Restarts retry pipeline |  
  
---

## vigor.parse

### Methods

| Method | Description |
|---|---|
| target(response) | Sets target Response object |
| settings(fn \| config) | Configures parser settings |
| strategies(fn) | Configures parser strategies |
| parsers(fn \| config) | Registers custom parsers |
| interceptors(fn \| config) | Configures parser interceptors |
| request(config?) | Executes parse pipeline |

---

### target

Sets the target `Response`.

```ts
const response = await fetch("/api");

await vigor
  .parse(response)
  .request();
```

---

### settings

Configures parser behavior.

```ts
.settings(s =>
  s
    .original(false)
    .fallback(null)
)
```

#### Settings API

| Method | Description | Default |
|---|---|---|
| original(boolean) | Returns original Response object | `false` |
| fallback(value) | Fallback return value on parse failure | `throws` |

---

### strategies

Configures parser strategy.

```ts
.strategies(s =>
  s.contentType()
)
```

---

## Parse Strategies

### contentType

Parses response using `content-type` header.

```ts
.strategies(s =>
  s.contentType()
)
```

Supported:

- JSON
- Text
- Blob
- FormData
- ArrayBuffer
- Audio
- Video
- Image

---

### sniff

Attempts all parsers until one succeeds.

```ts
.strategies(s =>
  s.sniff()
)
```

Useful when:

- content-type is invalid
- server responses are inconsistent
- APIs return malformed headers

---

### custom

Uses custom parser strategy.

```ts
.strategies(s =>
  s.custom()
    .func(async ({ response, parsers }) => {
      return await parsers.json();
    })
)
```

#### API

| Method | Description |
|---|---|
| func(fn) | Custom parse resolver |

---

### parsers

Registers custom parsers.

```ts
.parsers(p =>
  p.add("csv", async response => {
    return parseCSV(await response.text());
  })
)
```

#### Parser API

| Method | Description |
|---|---|
| add(name, parser) | Adds custom parser |
| remove(name) | Removes parser |
| clear() | Removes all parsers |

---

### request

Executes parse workflow.

```ts
const result = await vigor
  .parse(response)
  .request();
```

---

## Interceptors

| Name | API |
|---|:---:|
| before | throwError |
| after | setResult / throwError |
| result | setResult / throwError |
| onError | setResult / throwError |

---

### before

Runs before parsing starts.

```ts
.before(async (ctx, api) => {
  console.log(ctx.response.headers);
})
```

#### Available APIs

| API | Description |
|---|---|
| throwError(error) | Immediately throws error |

---

### after

Runs after parser succeeds.

```ts
.after(async (ctx, api) => {
  api.setResult({
    wrapped: ctx.result
  });
})
```

#### Available APIs

| API | Description |
|---|---|
| setResult(value) | Replaces parsed result |
| throwError(error) | Throws error |

---

### result

Runs before returning final result.

```ts
.result(async (ctx, api) => {
  api.setResult(transform(ctx.result));
})
```

#### Available APIs

| API | Description |
|---|---|
| setResult(value) | Replaces final result |
| throwError(error) | Throws error |

---

### onError

Runs when parsing fails.

```ts
.onError(async (ctx, api) => {
  api.setResult(null);
})
```

#### Available APIs

| API | Description |
|---|---|
| setResult(value) | Returns fallback value |
| throwError(error) | Throws error |

---

## Example

```ts
const response = await fetch("/api");

const data = await vigor
  .parse(response)
  .strategies(s =>
    s.sniff()
  )
  .interceptors(i =>
    i.onError((ctx, api) => {
      console.log(ctx.error);

      api.setResult(null);
    })
  )
  .request();
```

## vigor.fetch

### Methods

| Method | Description |
|---|---|
| origin(...paths) | Sets base URL and origin paths |
| path(...paths) | Appends request paths |
| query(params) | Sets query parameters |
| headers(headers) | Sets request headers |
| options(options) | Sets fetch options |
| retryConfig(fn \| config) | Configures retry engine |
| parseConfig(fn \| config) | Configures parse engine |
| interceptors(fn \| config) | Configures fetch interceptors |
| abortSignals(...signals) | Attaches external AbortSignals |
| request(config?) | Executes fetch pipeline |

---

### origin

Sets base URL and origin paths.

```ts
.fetch("https://api.example.com/", "/api")
```

Produces:

```txt
https://api.example.com/api
```

---

### path

Appends request paths.

```ts
.path("v1", "users")
```

Produces:

```txt
https://api.example.com/api/v1/users
```

---

### query

Adds query parameters.

```ts
.query({
  page: 1,
  limit: 10
})
```

Produces:

```txt
?page=1&limit=10
```

---

### headers

Sets request headers.

```ts
.headers({
  Authorization: "Bearer token"
})
```

---

### options

Sets native fetch options.

```ts
.options({
  method: "POST",
  body: JSON.stringify({
    username: "john"
  })
})
```

---

### retryConfig

Configures internal retry engine.

```ts
.retryConfig(r => r
	.settings(s => s
		.attempt(5)
  )
)
```

---

### parseConfig

Configures internal parse engine.

```ts
.parseConfig(p => p
	.strategies(s => s
		.sniff()
  )
)
```

---

### abortSignals

Attaches external AbortSignals.

```ts
const controller = new AbortController();

await vigor
  .fetch("/api")
  .abortSignals(controller.signal)
  .request();
```

---

### request

Executes fetch workflow.

```ts
const data = await vigor
  .fetch("https://api.example.com")
  .request();
```

---

## Interceptors

| Name | API |
|---|:---:|
| before | throwError / abort |
| after | setResponse / throwError |
| result | setResult / throwError |
| onError | setResult / throwError / retry |

---

### before

Runs before fetch execution.

```ts
.before(async (ctx, api) => {
  console.log(ctx.url);
})
```

#### Available APIs

| API | Description |
|---|---|
| throwError(error) | Immediately throws error |
| abort(error) | Aborts request |

---

### after

Runs after receiving Response.

```ts
.after(async (ctx, api) => {
  console.log(ctx.response.status);
})
```

#### Available APIs

| API | Description |
|---|---|
| setResponse(response) | Replaces Response object |
| throwError(error) | Throws error |

---

### result

Runs before returning parsed result.

```ts
.result(async (ctx, api) => {
  api.setResult({
    data: ctx.result
  });
})
```

#### Available APIs

| API | Description |
|---|---|
| setResult(value) | Replaces final result |
| throwError(error) | Throws error |

---

### onError

Runs when fetch fails.

```ts
.onError(async (ctx, api) => {
  api.retry();
})
```

#### Available APIs

| API | Description |
|---|---|
| setResult(value) | Returns fallback value |
| throwError(error) | Throws error |
| retry() | Re-executes fetch pipeline |

---

## Example

```ts
const data = await vigor
  .fetch("https://api.example.com", "api")
  .path("v1", "users")
  .query({
    page: 1
  })
  .headers({
    Authorization: "Bearer token"
  })
  .retryConfig(r =>
    r.settings(s =>
      s.attempt(5)
    )
  )
  .request();
```

## vigor.all

### Methods

| Method | Description |
|---|---|
| target(...tasks) | Sets async task list |
| settings(fn \| config) | Configures concurrency settings |
| interceptors(fn \| config) | Configures concurrency interceptors |
| abortSignals(...signals) | Attaches external AbortSignals |
| request(config?) | Executes concurrency pipeline |

---

### target

Sets async task list.

```ts
.all(
  async () => fetch("/api/1"),
  async () => fetch("/api/2")
)
```

---

### settings

Configures concurrency behavior.

```ts
.settings(s => s
    .concurrency(2)
    .onlySuccess(true)
)
```

#### Settings API

| Method | Description | Default |
|---|---|---|
| concurrency(number) | Maximum concurrent tasks | `Infinity` |
| onlySuccess(boolean) | Returns only successful results | `false` |
| fallback(value) | Fallback return value | `throws` |

---

### abortSignals

Attaches external AbortSignals.

```ts
const controller = new AbortController();

await vigor
  .all(task1, task2)
  .abortSignals(controller.signal)
  .request();
```

---

### request

Executes concurrency workflow.

```ts
const results = await vigor
  .all(task1, task2)
  .request();
```

---

## Interceptors

| Name | API |
|---|:---:|
| before | throwError / abort |
| afterEach | setResult / throwError |
| after | setResults / throwError |
| result | setResults / throwError |
| onError | setResults / throwError |

---

### before

Runs before task execution starts.

```ts
.before(async (ctx, api) => {
  console.log(ctx.tasks.length);
})
```

#### Available APIs

| API | Description |
|---|---|
| throwError(error) | Immediately throws error |
| abort(error) | Aborts execution |

---

### afterEach

Runs after each task resolves.

```ts
.afterEach(async (ctx, api) => {
  console.log(ctx.result);
})
```

#### Available APIs

| API | Description |
|---|---|
| setResult(value) | Replaces task result |
| throwError(error) | Throws error |

---

### after

Runs after all tasks complete.

```ts
.after(async (ctx, api) => {
  console.log(ctx.results);
})
```

#### Available APIs

| API | Description |
|---|---|
| setResults(value) | Replaces result array |
| throwError(error) | Throws error |

---

### result

Runs before returning final results.

```ts
.result(async (ctx, api) => {
  api.setResults(
    ctx.results.filter(Boolean)
  );
})
```

#### Available APIs

| API | Description |
|---|---|
| setResults(value) | Replaces final results |
| throwError(error) | Throws error |

---

### onError

Runs when concurrency execution fails.

```ts
.onError(async (ctx, api) => {
  api.setResults([]);
})
```

#### Available APIs

| API | Description |
|---|---|
| setResults(value) | Returns fallback results |
| throwError(error) | Throws error |

---

## Example

```ts
const results = await vigor
  .all(
    async () => fetch("/api/1"),
    async () => fetch("/api/2"),
    async () => fetch("/api/3")
  )
  .settings(s =>
    s
      .concurrency(2)
      .onlySuccess(true)
  )
  .request();
```