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

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    if (request.method === "GET") {
      return new Response(html, {
        headers: { "Content-Type": "text/html" }
      });
    }

    if (request.method === "POST") {
      const { messages } = await request.json();

      const result = await env.AI.run(
        "@cf/meta/llama-3-8b-instruct",
        { messages }
      );

      return new Response(
        JSON.stringify({ reply: result.response }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Method Not Allowed", { status: 405 });
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
    <h2> AI Chatbot</h2>
    <div id="messages"></div>
    <input id="input" placeholder="Type a message..." />
    <button onclick="send()">Send</button>
  </div>

  <script>
    let messages = [
      { role: "system", content: "You are a friendly AI chatbot." }
    ];

    async function send() {
      const input = document.getElementById("input");
      const text = input.value;
      if (!text) return;

      messages.push({ role: "user", content: text });
      add("You", text);
      input.value = "";

      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });

      const data = await res.json();
      messages.push({ role: "assistant", content: data.reply });
      add("Bot", data.reply);
    }

    function add(who, text) {
      const div = document.createElement("div");
      div.className = "msg";
      div.innerHTML = "<span class='" + (who === "You" ? "user" : "bot") + "'>" + who + ":</span> " + text;
      document.getElementById("messages").appendChild(div);
    }
  </script>
</body>
</html>
`;