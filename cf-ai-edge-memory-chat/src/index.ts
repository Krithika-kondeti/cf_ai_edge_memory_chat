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


type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export class ChatMemory {
  state: DurableObjectState;
  env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private trim(msgs: ChatMsg[], maxMessages: number) {
    if (msgs.length <= maxMessages) return msgs;
    const system = msgs[0]?.role === "system" ? [msgs[0]] : [];
    const remaining = Math.max(1, maxMessages - system.length);
    return [...system, ...msgs.slice(-remaining)];
  }

  private async runAIWithRetry(model: string, payload: any, attempts = 3) {
    let lastErr: unknown;

    for (let i = 0; i < attempts; i++) {
      try {
        return await this.env.AI.run(model, payload);
      } catch (err) {
        lastErr = err;
        const delay = Math.round(200 * Math.pow(2, i) + Math.random() * 120);
        console.error(`Workers AI error (model=${model}, attempt ${i + 1}/${attempts}):`, err);
        if (i < attempts - 1) await this.sleep(delay);
      }
    }

    throw lastErr;
  }

  private async runAIWithFallback(messages: ChatMsg[]) {
    const models = [
      "@cf/meta/llama-3-8b-instruct",
  "@cf/mistral/mistral-7b-instruct-v0.1"
    ];

    let lastErr: any = null;

    for (const model of models) {
      try {
        const result = await this.runAIWithRetry(
          model,
          { messages, max_tokens: 256 },
          3
        );

        const text = String(result?.response ?? "").trim();
        if (text) return { reply: text, model };
      } catch (e) {
        lastErr = e;
      }
    }

    return {
      reply:
        "⚠️ Workers AI is temporarily failing upstream. Your message was saved in memory — please try again in a moment.",
      model: "none",
      error: lastErr ? String(lastErr) : "unknown"
    };
  }

  async fetch(request: Request) {
    if (request.method === "DELETE") {
      await this.state.storage.delete("messages");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (!this.env.AI) {
      return new Response(JSON.stringify({ reply: "AI binding missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const userText = String(body?.message ?? "").trim();
    if (!userText) {
      return new Response(JSON.stringify({ reply: "Please type a message." }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    let messages =
      (await this.state.storage.get<ChatMsg[]>("messages")) ?? [
        { role: "system", content: "You are a friendly, helpful AI chatbot." }
      ];

    messages.push({ role: "user", content: userText });
    messages = this.trim(messages, 18);

    const out = await this.runAIWithFallback(messages);

    messages.push({ role: "assistant", content: out.reply });
    messages = this.trim(messages, 18);

    await this.state.storage.put("messages", messages);

    return new Response(JSON.stringify({ reply: out.reply, model: out.model }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }
 if (request.method === "GET" && url.pathname === "/ai-test") {
      try {
        const r = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
          messages: [{ role: "user", content: "Say hello in one short sentence." }],
          max_tokens: 64
        });

        return new Response(
          JSON.stringify({ ok: true, response: r?.response ?? null }),
          { headers: { "Content-Type": "application/json" } }
        );

      } catch (e: any) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: String(e?.message ?? e),
            full: String(e)
          }),
          { headers: { "Content-Type": "application/json" }, status: 500 }
        );
      }
    }
    const id = env.CHAT_MEMORY.idFromName("default-user");
    const stub = env.CHAT_MEMORY.get(id);

    if (url.pathname === "/chat") {
      return stub.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};

const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Cloudflare AI Chatbot</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; }
    #chat { max-width: 700px; margin: 40px auto; background: #fff; padding: 20px; border-radius: 8px; }
    .msg { margin: 10px 0; white-space: pre-wrap; }
    .user { font-weight: bold; }
    .bot { color: #444; }
    input { width: 76%; padding: 10px; }
    button { padding: 10px; margin-left: 6px; }
    .row { display: flex; gap: 6px; }
    .meta { color: #777; font-size: 12px; margin-top: 8px; }
  </style>
</head>
<body>
  <div id="chat">
    <h2>AI Chatbot</h2>
    <div id="messages"></div>
    <div class="row">
      <input id="input" placeholder="Type a message..." />
      <button onclick="send()">Send</button>
      <button onclick="resetChat()">Reset</button>
    </div>
    <div class="meta" id="meta"></div>
  </div>

  <script>
    async function send() {
      const input = document.getElementById("input");
      const text = input.value.trim();
      if (!text) return;

      add("You", text);
      input.value = "";

      try {
        const res = await fetch("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text })
        });

        const data = await res.json();
        add("Bot", data.reply);
        document.getElementById("meta").textContent = data.model ? ("Model used: " + data.model) : "";
      } catch {
        add("Bot", "⚠️ Unable to reach the server.");
      }
    }

    async function resetChat() {
      document.getElementById("messages").innerHTML = "";
      document.getElementById("meta").textContent = "";
      try {
        await fetch("/chat", { method: "DELETE" });
        add("Bot", "Memory cleared.");
      } catch {
        add("Bot", "Unable to reset memory.");
      }
    }

    function add(who, text) {
      const div = document.createElement("div");
      div.className = "msg";
      div.innerHTML =
        "<span class='" + (who === "You" ? "user" : "bot") + "'>" +
        who +
        ":</span> " +
        escapeHtml(text);
      document.getElementById("messages").appendChild(div);
    }

    function escapeHtml(str) {
      return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });
  </script>
</body>
</html>
`;
