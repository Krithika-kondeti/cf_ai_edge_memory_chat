# cf_ai_edge_memory_chat

An AI-powered chat application built on **Cloudflare Workers** that demonstrates how to run **LLMs at the edge with persistent memory** using **Durable Objects** and **Workers AI**.

---

## 🌍 Live Demo

Deployed Worker:
https://cf_ai_edge_memory_chat.krithika-k2410.workers.dev

Test endpoint:
https://cf_ai_edge_memory_chat.krithika-k2410.workers.dev/ai-test

---

## 📌 Project Description

This project showcases how to build a **stateful AI chatbot running entirely on Cloudflare’s edge platform**.

Users can chat with an AI assistant via a browser interface.  
Each conversation is stored and remembered across requests using Durable Objects.

The application demonstrates how Cloudflare primitives can be combined to build scalable AI applications without traditional servers.

---

## 🧠 Architecture

Browser Chat UI  
⬇  
Cloudflare Worker (Routing)  
⬇  
Durable Object (Chat Memory)  
⬇  
Workers AI (Llama 3 Instruct)

---

## 🔑 Cloudflare Features Used

### Workers AI (LLM)
- Model: `@cf/meta/llama-3-8b-instruct`
- Invoked via:

```ts
env.AI.run("@cf/meta/llama-3-8b-instruct", { messages })
