import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API ROUTES ---

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", system: "Tzion Terapias" });
  });

  // Módulo 1: Folha de Pagamento - Cálculo INSS (progressivo 2024/2026 estivado)
  app.post("/api/financeiro/calculo-folha", (req, res) => {
    const { salarioBruto } = req.body;
    
    // Cálculo simplificado de INSS Progressivo
    let inss = 0;
    if (salarioBruto <= 1412) inss = salarioBruto * 0.075;
    else if (salarioBruto <= 2666.68) inss = (salarioBruto - 1412) * 0.09 + 105.9;
    else if (salarioBruto <= 4000.03) inss = (salarioBruto - 2666.68) * 0.12 + 105.9 + 112.92;
    else inss = (salarioBruto - 4000.03) * 0.14 + 105.9 + 112.92 + 160.00;

    // FGTS 8%
    const fgts = salarioBruto * 0.08;
    const liquido = salarioBruto - inss; // Sem IRRF para simplificar stub

    res.json({ salarioBruto, inss, fgts, liquido });
  });

  // Módulo 4: Gerar Link Google Meet (Simulado)
  app.post("/api/agenda/gerar-link-meet", (req, res) => {
    const meetingId = Math.random().toString(36).substring(7);
    res.json({ link: `https://meet.google.com/tzion-${meetingId}` });
  });

  // Módulo 1: Criar Cobrança Asaas (Stub)
  app.post("/api/financeiro/criar-cobranca", (req, res) => {
    const { valor, pacienteId } = req.body;
    // Aqui chamaria a API do Asaas
    res.json({ 
      id: "pay_123456", 
      invoiceUrl: "https://sandbox.asaas.com/i/123456",
      status: "PENDING"
    });
  });

  // Example Asaas Webhook (stub)
  app.post("/api/webhooks/asaas", (req, res) => {
    console.log("Asaas Webhook received:", req.body);
    res.sendStatus(200);
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
