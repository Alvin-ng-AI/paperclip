import { Router } from "express";
import http from "http";

const SHOPIFY_BRIDGE_PORT = parseInt(process.env.SHOPIFY_BRIDGE_PORT ?? "18797", 10);

function proxyGet(path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${SHOPIFY_BRIDGE_PORT}${path}`, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error("Invalid JSON from Shopify bridge")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("Shopify bridge timeout")); });
  });
}

export function shopifyProxyRoutes() {
  const router = Router();

  // GET /api/integrations/shopify/health
  router.get("/integrations/shopify/health", async (_req, res) => {
    try {
      const data = await proxyGet("/health");
      res.json(data);
    } catch (err) {
      res.status(503).json({ ok: false, error: "Shopify bridge unavailable" });
    }
  });

  // GET /api/integrations/shopify/sales?days=7
  router.get("/integrations/shopify/sales", async (req, res) => {
    try {
      const days = req.query.days ?? "7";
      const data = await proxyGet(`/api/sales/daily?days=${days}`);
      res.json(data);
    } catch (err) {
      res.status(503).json({ ok: false, error: "Shopify bridge unavailable" });
    }
  });

  // GET /api/integrations/shopify/orders?limit=5
  router.get("/integrations/shopify/orders", async (req, res) => {
    try {
      const limit = req.query.limit ?? "5";
      const data = await proxyGet(`/api/orders?limit=${limit}`);
      res.json(data);
    } catch (err) {
      res.status(503).json({ ok: false, error: "Shopify bridge unavailable" });
    }
  });

  return router;
}
