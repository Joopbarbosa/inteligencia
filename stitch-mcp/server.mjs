import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { StitchProxy } from "@google/stitch-sdk";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

config({ path: fileURLToPath(new URL(".env", import.meta.url)), quiet: true });

const apiKey = process.env.STITCH_API_KEY;
if (!apiKey) {
  console.error("STITCH_API_KEY ausente em stitch-mcp/.env");
  process.exit(1);
}

const proxy = new StitchProxy({ apiKey });
await proxy.start(new StdioServerTransport());
