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

export class ChatMemory {
  state: DurableObjectState;
  messages: any[];

  constructor(state: DurableObjectState) {
    this.state = state;
    this.messages = [];
  }

  async fetch(request: Request, env: any) {
    if (this.messages.length === 0) {
      this.messages =
        (await this.state.storage.get("messages")) || [
          { role: "system", content: "You are a friendly AI chatbot." }
        ];
    }

    if (request.method === "POST") {
      const { message } = await request.json();

      this.messages.push({ role: "user", content: message });

      const result = await env.AI.run(
        "@cf/meta/llama-3-8b-instruct",
        { messages: this.messages }
      );

      this.messages.push({
        role: "assistant",
        content: result.response
      });

      await this.state.storage.put("messages", this.messages);

      return new Response(
        JSON.stringify({ reply: result.response }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Method Not Allowed", { status: 405 });
  }
}

export default {
  async fetch(request: Request, env: any) {
    if (request.method === "GET") {
      return new Response(html, {
        headers: { "Content-Type": "text/html" }
      });
    }

    const id = env.CHAT_MEMORY.idFromName("default-user");
    const stub = env.CHAT_MEMORY.get(id);
    return stub.fetch(request);
  }
};

const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Cloudflare AI Chatbot</title>
  <style>
    body { font-family: Arial; background:#f4f4f4; }
    #chat { max-width:600px; margin:40px auto; background:#fff; padding:20px; border-radius:8px; }
    .msg { margin:10px 0; }
    .user { font-weight:bold; }
    .bot { color:#444; }
    input { width:80%; padding:10px; }
    button { padding:10px; }
  </style>
</head>
<body>
  <div id="chat">
    <h2>AI Chatbot</h2>
    <div id="messages"></div>
    <input id="input" placeholder="Type a message..." />
    <button onclick="send()">Send</button>
  </div>

  <script>
    async function send() {
      const input = document.getElementById("input");
      const text = input.value;
      if (!text) return;

      add("You", text);
      input.value = "";

      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      const data = await res.json();
      add("Bot", data.reply);
    }

    function add(who, text) {
      const div = document.createElement("div");
      div.className = "msg";
      div.innerHTML = "<b>" + who + ":</b> " + text;
      document.getElementById("messages").appendChild(div);
    }
  </script>
</body>
</html>
`;
