/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { AI } from "@cloudflare/workers-types";

export default {
  async fetch(request: Request, env: { AI: AI }) {
    const result = await env.AI.run(
      "@cf/meta/llama-3-8b-instruct",
      {
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say hello from Cloudflare AI" }
        ]
      }
    );

    return new Response(result.response, {
      headers: { "Content-Type": "text/plain" }
    });
  }
};
