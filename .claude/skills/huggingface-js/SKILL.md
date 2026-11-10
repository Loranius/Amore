---
name: huggingface-js
description: Using the Hugging Face JavaScript libraries (huggingface/huggingface.js, MIT) from TypeScript — @huggingface/inference (InferenceClient: chat completion, text generation, text-to-image, speech, vision and the other pipeline tasks across Inference Providers and Inference Endpoints), @huggingface/hub (create repos, upload/download/list files, buckets, OAuth, local cache), @huggingface/mcp-client and @huggingface/tiny-agents (MCP agents on top of InferenceClient), @huggingface/gguf (read GGUF metadata over HTTP ranges), @huggingface/jinja (chat templates) and @huggingface/tasks (task and library definitions). Use when the task mentions Hugging Face, huggingface.co, HF token, InferenceClient, Inference Providers, a model id like "org/model", FLUX, Llama, GGUF, chat templates, or wants to call an ML model or upload to the Hub from JS/TS.
---

# Hugging Face JS

Source: https://github.com/huggingface/huggingface.js (MIT, see `LICENSE`).
Snapshot of package READMEs taken 2026-11-10 at commit `37679030` — versions at that time:
`@huggingface/inference` 4.13.32, `@huggingface/hub` 2.17.11, `@huggingface/mcp-client` 0.2.3,
`@huggingface/tiny-agents` 0.3.4, `@huggingface/gguf` 0.4.6, `@huggingface/jinja` 0.5.11,
`@huggingface/tasks` 0.22.6. Pin an exact version when adding a dependency.

Full per-package docs are in `references/<package>.md` — open only the one you need:

| Need | Read |
|---|---|
| Call a model (chat, image, audio, vision, embeddings…), providers, endpoints, errors | `references/inference.md` |
| Create/delete repos, upload/download/list files, buckets, OAuth login, HF cache, CLI | `references/hub.md` |
| MCP client / agent loop with tools | `references/mcp-client.md`, `references/tiny-agents.md` |
| Older agents package | `references/agents.md` |
| Parse GGUF metadata/tensors from a remote file | `references/gguf.md` |
| Render a model's chat template | `references/jinja.md` |
| Pipeline task / model library definitions | `references/tasks.md` |

## Core usage

```ts
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(token); // HF token or a provider's own key

const out = await client.chatCompletion({
  model: "meta-llama/Llama-3.1-8B-Instruct",
  provider: "auto", // default: first available provider in the user's hf.co settings order
  messages: [{ role: "user", content: "Hello" }],
  max_tokens: 512,
});

for await (const chunk of client.chatCompletionStream({ model, messages, max_tokens: 512 })) {
  chunk.choices[0]?.delta.content;
}

const image: Blob = await client.textToImage({
  model: "black-forest-labs/FLUX.1-dev",
  provider: "fal-ai",
  inputs: "a picture of a green bird",
});

// Dedicated Inference Endpoint or a local OpenAI-compatible server
const ep = client.endpoint("https://xyz.endpoints.huggingface.cloud/model");
```

Tree-shakable form: `import { textGeneration } from "@huggingface/inference"` and pass `accessToken` in the args.
Errors: `InferenceClientProviderApiError`, `InferenceClientHubApiError`, `InferenceClientProviderOutputError`,
`InferenceClientInputError` — catch by type, never swallow (see "Error handling" in `references/inference.md`).

```ts
import { createRepo, uploadFile, listFiles, downloadFile } from "@huggingface/hub";

await createRepo({ repo: "user/name", accessToken: token }); // or { type: "model" | "dataset" | "space", name }
await uploadFile({ repo: "user/name", accessToken: token, file: { path: "a.bin", content: new Blob([bytes]) } });
for await (const f of listFiles({ repo: "user/name" })) f.path;
```

Runtime: modern browsers, Node ≥ 18, Bun, Deno (ESM; `npm:` / esm.sh / jsDelivr `+esm` also work).

## Rules in this repository

- **Token never in code or the repo.** Read it from an environment secret (e.g. `HF_TOKEN`). In the browser it
  must not ship in the bundle: route calls through a server/edge function that holds the token, as the
  upstream README advises.
- **Not in deterministic code.** `src/engine/**` and any canonical evaluation function must not import these
  packages or make network calls (CLAUDE.md: no network inside deterministic evaluation; core packages import no
  clients). Model output is nondeterministic — never let it feed an authoritative hash or decision.
- **Generated art for the game** still has to fit the game's 32×32 PixelLab style and rules in CLAUDE.md; a
  generated image is a reference to adapt, not a drop-in asset.
- **Network.** In this cloud environment `huggingface.co` and `router.huggingface.co` were refused by the egress
  proxy (2026-11-10). If a call is blocked, the host has to be allowed in the environment and the token saved as a
  network secret — do not substitute made-up responses.
