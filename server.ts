import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== "your-service-role-key"
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

export const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

async function requireStaffAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Cabeçalho de autorização inválido ou ausente." });
      return;
    }

    const token = authHeader.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Sessão inválida ou expirada." });
      return;
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      if (user.email === 'tzionterapias@gmail.com' || user.email === 'admin@tzion.com.br') {
        (req as any).user = { id: user.id, email: user.email, role: 'admin' };
        return next();
      }
      res.status(403).json({ error: "Perfil de usuário não encontrado no sistema." });
      return;
    }

    if (profile.status === 'inactive') {
      res.status(403).json({ error: "Este usuário está inativo." });
      return;
    }

    if (profile.role === 'paciente') {
      res.status(403).json({ error: "Acesso restrito apenas para a equipe clínica." });
      return;
    }

    (req as any).user = { id: user.id, email: user.email, role: profile.role };
    next();
  } catch (err: any) {
    console.error("[AUTH MIDDLEWARE] Erro interno:", err);
    res.status(500).json({ error: "Erro interno no servidor durante autenticação." });
  }
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const root = process.cwd();

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);
  console.log(`Project root: ${root}`);

  // --- API ROUTES ---
  // ... (keeping existing routes)
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", system: "Tzion Terapias" });
  });

  // --- SECURE N8N WEBHOOK PROXY ---
  app.post("/api/n8n-proxy", requireStaffAuth, async (req, res) => {
    try {
      const { webhookUrl, payload } = req.body;
      if (!webhookUrl) {
         res.status(400).json({ error: "Missing webhookUrl" });
         return;
      }
      
      console.log(`[N8N PROXY] Forwarding request to: ${webhookUrl}`);
      console.log(`[N8N PROXY] Payload:`, JSON.stringify(payload, null, 2));
      
      const response = await fetch(webhookUrl, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json'
         },
         body: JSON.stringify(payload)
      });
      
      console.log(`[N8N PROXY] Response status: ${response.status}`);
      const text = await response.text();
      console.log(`[N8N PROXY] Response body:`, text);
      
      let data = {};
      try {
         data = JSON.parse(text);
      } catch (e) {
         data = { text };
      }
      
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error("[N8N PROXY] Error forwarding request:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- SECURE WHATSAPP PROXY ---
  app.get("/api/whatsapp/instances", requireStaffAuth, async (req, res) => {
    try {
      const apiKey = process.env.VITE_EVOLUTION_GLOBAL_KEY || "";
      const apiUrl = process.env.VITE_EVOLUTION_API_URL || "";
      const response = await fetch(`${apiUrl}/instance/fetchInstances`, {
        headers: { 'apikey': apiKey }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error("Error fetching instances:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/whatsapp/setup", requireStaffAuth, async (req, res) => {
    try {
      const { instanceName } = req.body;
      const apiKey = process.env.VITE_EVOLUTION_GLOBAL_KEY || "";
      const apiUrl = process.env.VITE_EVOLUTION_API_URL || "";
      
      console.log(`[PROXY SETUP] URL: ${apiUrl}/instance/create`);
      console.log(`[PROXY SETUP] Instance Name: ${instanceName}`);
      console.log(`[PROXY SETUP] Global Key: "${apiKey}" (length: ${apiKey.length})`);
      
      const createRes = await fetch(`${apiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      });
      const createData = await createRes.json();
      console.log(`[PROXY SETUP] Status: ${createRes.status}`);
      console.log(`[PROXY SETUP] Response:`, JSON.stringify(createData));
      res.status(createRes.status).json(createData);
    } catch (err: any) {
      console.error("Error setting up instance:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/whatsapp/settings/:instanceName", requireStaffAuth, async (req, res) => {
    try {
      const { instanceName } = req.params;
      const apiKey = process.env.VITE_EVOLUTION_GLOBAL_KEY || "";
      const apiUrl = process.env.VITE_EVOLUTION_API_URL || "";
      
      const settingsRes = await fetch(`${apiUrl}/settings/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify(req.body)
      });
      const settingsData = await settingsRes.json();
      res.status(settingsRes.status).json(settingsData);
    } catch (err: any) {
      console.error("Error setting settings:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/whatsapp/webhook/:instanceName", requireStaffAuth, async (req, res) => {
    try {
      const { instanceName } = req.params;
      const apiKey = process.env.VITE_EVOLUTION_GLOBAL_KEY || "";
      const apiUrl = process.env.VITE_EVOLUTION_API_URL || "";
      
      const webhookRes = await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify(req.body)
      });
      const webhookData = await webhookRes.json();
      res.status(webhookRes.status).json(webhookData);
    } catch (err: any) {
      console.error("Error setting webhook:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/whatsapp/qrcode/:instanceName", requireStaffAuth, async (req, res) => {
    try {
      const { instanceName } = req.params;
      const apiKey = process.env.VITE_EVOLUTION_GLOBAL_KEY || "";
      const apiUrl = process.env.VITE_EVOLUTION_API_URL || "";
      
      const response = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
        headers: { 'apikey': apiKey }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error("Error getting qrcode:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/whatsapp/status/:instanceName", requireStaffAuth, async (req, res) => {
    try {
      const { instanceName } = req.params;
      const apiKey = process.env.VITE_EVOLUTION_GLOBAL_KEY || "";
      const apiUrl = process.env.VITE_EVOLUTION_API_URL || "";
      
      const response = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
        headers: { 'apikey': apiKey }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error("Error checking status:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/whatsapp/instance/:instanceName", requireStaffAuth, async (req, res) => {
    try {
      const { instanceName } = req.params;
      const apiKey = process.env.VITE_EVOLUTION_GLOBAL_KEY || "";
      const apiUrl = process.env.VITE_EVOLUTION_API_URL || "";
      
      const response = await fetch(`${apiUrl}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: { 'apikey': apiKey }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error("Error deleting instance:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/whatsapp/logout/:instanceName", requireStaffAuth, async (req, res) => {
    try {
      const { instanceName } = req.params;
      const apiKey = process.env.VITE_EVOLUTION_GLOBAL_KEY || "";
      const apiUrl = process.env.VITE_EVOLUTION_API_URL || "";
      
      const response = await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { 'apikey': apiKey }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error("Error logging out instance:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/whatsapp/sendText/:instanceName", requireStaffAuth, async (req, res) => {
    try {
      const { instanceName } = req.params;
      const apiKey = process.env.VITE_EVOLUTION_GLOBAL_KEY || "";
      const apiUrl = process.env.VITE_EVOLUTION_API_URL || "";
      
      console.log(`[PROXY SEND_TEXT] Instance: ${instanceName}, URL: ${apiUrl}/message/sendText/${instanceName}`);
      console.log(`[PROXY SEND_TEXT] Body:`, JSON.stringify(req.body));
      
      const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify(req.body)
      });
      
      const data = await response.json();
      console.log(`[PROXY SEND_TEXT] Evolution Response Status: ${response.status}`);
      console.log(`[PROXY SEND_TEXT] Evolution Response Data:`, JSON.stringify(data));
      
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error("[PROXY SEND_TEXT] Error sending text:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/whatsapp/sendMedia/:instanceName", requireStaffAuth, async (req, res) => {
    try {
      const { instanceName } = req.params;
      const apiKey = process.env.VITE_EVOLUTION_GLOBAL_KEY || "";
      const apiUrl = process.env.VITE_EVOLUTION_API_URL || "";
      const response = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error("Error sending media:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/financeiro/calculo-folha", requireStaffAuth, (req, res) => {
    const { salarioBruto } = req.body;
    let inss = 0;
    if (salarioBruto <= 1412) inss = salarioBruto * 0.075;
    else if (salarioBruto <= 2666.68) inss = (salarioBruto - 1412) * 0.09 + 105.9;
    else if (salarioBruto <= 4000.03) inss = (salarioBruto - 2666.68) * 0.12 + 105.9 + 112.92;
    else inss = (salarioBruto - 4000.03) * 0.14 + 105.9 + 112.92 + 160.00;
    const fgts = salarioBruto * 0.08;
    const liquido = salarioBruto - inss;
    res.json({ salarioBruto, inss, fgts, liquido });
  });

  app.post("/api/auth/request-code", async (req, res) => {
    try {
      const { emailOrPhone } = req.body;
      if (!emailOrPhone) {
        return res.status(400).json({ error: "E-mail ou WhatsApp é obrigatório." });
      }

      console.log(`[AUTH] Solicitando código de login para: ${emailOrPhone}`);

      const cleanPhone = emailOrPhone.replace(/\D/g, "");
      
      let query = supabase.from('profiles').select('*');
      if (emailOrPhone.includes('@')) {
        query = query.eq('email', emailOrPhone.trim());
      } else {
        const phoneVariants = [emailOrPhone.trim(), cleanPhone];
        if (cleanPhone.startsWith('55')) {
          phoneVariants.push(cleanPhone.substring(2));
        } else {
          phoneVariants.push(`55${cleanPhone}`);
        }
        query = query.or(`phone.in.(${phoneVariants.map(p => `"${p}"`).join(',')})`);
      }

      const { data: profile, error: fetchError } = await query.maybeSingle();
      if (fetchError || !profile) {
        return res.status(404).json({ error: "Usuário não cadastrado com estes dados." });
      }

      if (!profile.phone) {
        return res.status(400).json({ error: "Este usuário não possui WhatsApp cadastrado para envio do código." });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          whatsapp_login_code: code,
          whatsapp_login_code_expires_at: expiresAt
        })
        .eq('id', profile.id);

      if (updateError) {
        console.error("Erro ao salvar código no banco:", updateError);
        return res.status(500).json({ error: "Erro interno ao gerar código." });
      }

      const firstName = profile.name ? profile.name.split(' ')[0] : 'Paciente';
      const appUrl = process.env.APP_URL || `http://${req.headers.host}`;
      const directLink = `${appUrl}/login?email=${encodeURIComponent(profile.email)}&code=${code}`;

      const msg = `[Código de Acesso - Tzion Terapias]\n\nOlá, *${firstName}*! ✨\n\nSeu código de acesso de uso único é: *${code}*\n\nOu acesse diretamente pelo link:\n🔗 ${directLink}\n\n*Nota:* Este código expira em 15 minutos.\n\nQualquer dúvida, estamos à disposição! 💙`;
      
      console.log(`[AUTH] Enviando código via WhatsApp para ${profile.phone}...`);
      await sendWhatsAppBackend(profile.id, profile.phone, msg, 'access_code_requested');

      return res.json({ success: true, message: "Código enviado com sucesso!" });

    } catch (err: any) {
      console.error("[AUTH] Erro ao processar requisição de código:", err);
      return res.status(500).json({ error: "Erro interno no servidor." });
    }
  });

  app.post("/api/agenda/gerar-link-meet", requireStaffAuth, (req, res) => {
    const meetingId = Math.random().toString(36).substring(7);
    res.json({ link: `https://meet.google.com/tzion-${meetingId}` });
  });

  app.post("/api/financeiro/criar-cobranca", requireStaffAuth, async (req, res) => {
    const { valor, pacienteId, description } = req.body;
    
    console.log(`Criando cobrança Asaas para paciente: ${pacienteId}, valor: ${valor}`);

    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey || apiKey === "your-asaas-key") {
      console.log("Asaas API Key não configurada. Usando MOCK.");
      return res.json({
        id: `mock_${Math.random().toString(36).substring(7)}`,
        invoiceUrl: "https://sandbox.asaas.com/i/mock_payment_url",
        status: "PENDING"
      });
    }

    const isProduction = process.env.ASAAS_ENV === "production";
    const asaasBaseUrl = isProduction ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

    try {
      // 1. Obter paciente
      const { data: patient, error: patientErr } = await supabase
        .from("patients")
        .select("*")
        .eq("id", pacienteId)
        .single();

      if (patientErr || !patient) {
        return res.status(400).json({ error: "Paciente não encontrado." });
      }

      if (!patient.cpf) {
        return res.status(400).json({ error: "O CPF do paciente é obrigatório para gerar cobrança no Asaas. Por favor, cadastre o CPF do paciente primeiro." });
      }

      // Limpar CPF (deixar apenas números)
      const cleanCpf = patient.cpf.replace(/\D/g, "");
      if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
        return res.status(400).json({ error: "CPF/CNPJ inválido. Digite um documento válido." });
      }

      let asaasCustomerId = patient.asaas_customer_id;

      // 2. Se não tiver ID do Asaas, tentar buscar ou criar
      if (!asaasCustomerId) {
        console.log(`Buscando cliente no Asaas pelo CPF/CNPJ: ${cleanCpf}`);
        const searchRes = await fetch(`${asaasBaseUrl}/customers?cpfCnpj=${cleanCpf}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "access_token": apiKey
          }
        });

        if (searchRes.ok) {
          const searchData: any = await searchRes.json();
          if (searchData.data && searchData.data.length > 0) {
            asaasCustomerId = searchData.data[0].id;
            console.log(`Cliente encontrado no Asaas: ${asaasCustomerId}`);
            
            // Salvar no Supabase
            await supabase
              .from("patients")
              .update({ asaas_customer_id: asaasCustomerId })
              .eq("id", pacienteId);
          }
        }
      }

      // Se ainda não tiver, criar o cliente
      if (!asaasCustomerId) {
        console.log("Cliente não encontrado. Criando novo cliente no Asaas...");
        // Limpar telefone (apenas números)
        const cleanPhone = patient.phone ? patient.phone.replace(/\D/g, "") : undefined;
        
        const createCustRes = await fetch(`${asaasBaseUrl}/customers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "access_token": apiKey
          },
          body: JSON.stringify({
            name: patient.name,
            cpfCnpj: cleanCpf,
            email: patient.email || undefined,
            mobilePhone: cleanPhone || undefined,
            notificationDisabled: true
          })
        });

        if (!createCustRes.ok) {
          const errData = await createCustRes.text();
          console.error("Erro ao criar cliente no Asaas:", errData);
          return res.status(500).json({ error: `Erro no Asaas ao cadastrar cliente: ${errData}` });
        }

        const newCustData: any = await createCustRes.json();
        asaasCustomerId = newCustData.id;
        console.log(`Novo cliente cadastrado no Asaas: ${asaasCustomerId}`);

        // Salvar no Supabase
        await supabase
          .from("patients")
          .update({ asaas_customer_id: asaasCustomerId })
          .eq("id", pacienteId);
      }

      // 3. Criar cobrança no Asaas
      const dueDate = new Date().toISOString().split("T")[0]; // Vencimento hoje
      console.log(`Gerando cobrança Asaas para cliente ${asaasCustomerId} de R$ ${valor} vencendo em ${dueDate}`);

      const createPaymentRes = await fetch(`${asaasBaseUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": apiKey
        },
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: "UNDEFINED", // permite PIX, Cartão ou Boleto no checkout
          value: Number(valor),
          dueDate: dueDate,
          description: description || "Tzion Terapias - Serviços Terapêuticos",
          postalService: false
        })
      });

      if (!createPaymentRes.ok) {
        const errData = await createPaymentRes.text();
        console.error("Erro ao criar cobrança no Asaas:", errData);
        return res.status(500).json({ error: `Erro no Asaas ao criar cobrança: ${errData}` });
      }

      const paymentData: any = await createPaymentRes.json();
      console.log(`Cobrança criada com sucesso no Asaas. ID: ${paymentData.id}, Link: ${paymentData.invoiceUrl}`);

      return res.json({
        id: paymentData.id,
        invoiceUrl: paymentData.invoiceUrl,
        status: paymentData.status
      });

    } catch (err: any) {
      console.error("Erro interno ao criar cobrança Asaas:", err);
      return res.status(500).json({ error: "Erro interno no servidor ao processar pagamento Asaas." });
    }
  });

  app.post("/api/webhooks/asaas", async (req, res) => {
    console.log("Asaas Webhook received:", req.body);
    const { event, payment } = req.body;
    
    if (!payment || !payment.id) {
      return res.sendStatus(200);
    }
    
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const asaasId = payment.id;
      console.log(`Asaas Payment ${asaasId} is CONFIRMED/RECEIVED. Updating status...`);
      
      // Update the payment record in Supabase to paid
      const { data: updatedPayment, error: payError } = await supabase
        .from('payments')
        .update({ status: 'paid' })
        .eq('asaas_id', asaasId)
        .select()
        .single();
        
      if (payError) {
        console.error("Error updating payment status via webhook:", payError);
      } else if (updatedPayment) {
        console.log("Payment status updated to paid for payment:", updatedPayment.id);
        
        // If it's a patient package income, activate pending packages and generate contract
        if (updatedPayment.patient_id && updatedPayment.type === 'income') {
          await activatePendingPackagesForPatient(updatedPayment.patient_id);
        }
      }
    }
    
    res.sendStatus(200);
  });

  app.post("/api/financeiro/sincronizar", requireStaffAuth, async (req, res) => {
    try {
      const result = await executeFinancialSync();
      res.json(result);
    } catch (err: any) {
      console.error("Erro geral na sincronização:", err);
      res.status(500).json({ error: "Erro interno no servidor ao sincronizar." });
    }
  });

  // --- PUBLIC SECURE ANAMNESIS ENDPOINTS ---
  app.get("/api/public/anamnese/:token", async (req, res) => {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ error: "Token é obrigatório." });
      }

      // 1. Obter paciente pelo token
      const { data: patient, error: pError } = await supabase
        .from('patients')
        .select('id, name')
        .eq('anamnesis_token', token)
        .maybeSingle();

      if (pError || !patient) {
        return res.status(404).json({ error: "Paciente não encontrado ou link inválido." });
      }

      // 2. Obter template ativo de anamnese
      const { data: templates } = await supabase
        .from('clinical_templates')
        .select('*')
        .eq('category', 'anamnesis')
        .eq('active', true)
        .order('created_at', { ascending: false });

      let selectedTemplate = templates && templates.length > 0 ? templates[0] : null;

      // 3. Buscar anamnese existente se houver
      const { data: ana } = await supabase
        .from('patient_anamnesis')
        .select('*')
        .eq('patient_id', patient.id)
        .maybeSingle();

      if (ana && ana.template_id) {
        const { data: specTemplate } = await supabase
          .from('clinical_templates')
          .select('*')
          .eq('id', ana.template_id)
          .maybeSingle();
        if (specTemplate) {
          selectedTemplate = specTemplate;
        }
      }

      return res.json({
        patientName: patient.name,
        patientId: patient.id,
        template: selectedTemplate,
        responses: ana?.responses || {},
        complaint: ana?.complaint || '',
        familyHistory: ana?.family_history || '',
        lifestyle: ana?.lifestyle || ''
      });
    } catch (err: any) {
      console.error("[PUBLIC ANAMNESE GET] Erro:", err);
      return res.status(500).json({ error: "Erro interno ao carregar a anamnese." });
    }
  });

  app.post("/api/public/anamnese/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { templateId, responses, complaint, familyHistory, lifestyle } = req.body;

      if (!token) {
        return res.status(400).json({ error: "Token é obrigatório." });
      }

      // 1. Obter paciente pelo token
      const { data: patient, error: pError } = await supabase
        .from('patients')
        .select('id')
        .eq('anamnesis_token', token)
        .maybeSingle();

      if (pError || !patient) {
        return res.status(404).json({ error: "Paciente não encontrado ou link inválido." });
      }

      // 2. Verificar se já existe registro de anamnese
      const { data: existing } = await supabase
        .from('patient_anamnesis')
        .select('id')
        .eq('patient_id', patient.id)
        .maybeSingle();

      const payload = {
        patient_id: patient.id,
        template_id: templateId || null,
        responses: responses || {},
        complaint: complaint || '',
        family_history: familyHistory || '',
        lifestyle: lifestyle || '',
        updated_at: new Date().toISOString(),
      };

      let dbError;
      if (existing?.id) {
        const { error: err } = await supabase
          .from('patient_anamnesis')
          .update(payload)
          .eq('id', existing.id);
        dbError = err;
      } else {
        const { error: err } = await supabase
          .from('patient_anamnesis')
          .insert([payload]);
        dbError = err;
      }

      if (dbError) {
        throw dbError;
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error("[PUBLIC ANAMNESE POST] Erro:", err);
      return res.status(500).json({ error: "Erro interno ao salvar a anamnese." });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: ".", // Use relative root
      server: { middlewareMode: true },
      appType: "custom",
    });
    
    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      
      // Skip API and files with extensions
      if (url.startsWith('/api') || url.includes('.')) {
        return next();
      }

      try {
        // Use relative path for template
        let template = fs.readFileSync("./index.html", "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(root, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start the background workers and listen only when not running on Vercel
  if (!process.env.VERCEL) {
    startCampaignWorker();
    startRemindersWorker();
    startNpsWorker();
    startFinancialSyncWorker();
    startTicketCleanupWorker();
    startRetentionWorker();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

async function startCampaignWorker() {
  const isProduction = !!process.env.VITE_EVOLUTION_API_URL;
  const apiKey = process.env.VITE_EVOLUTION_GLOBAL_KEY || "";
  const apiUrl = process.env.VITE_EVOLUTION_API_URL || "";
  const instance = process.env.VITE_EVOLUTION_INSTANCE_NAME || "";

  console.log("[WORKER] Campaign Worker initialized.");

  setInterval(async () => {
    try {
      // 1. Fetch campaigns that are in 'running' status
      const { data: runningCampaigns, error: campaignsErr } = await supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'running');

      if (campaignsErr) {
        console.error("[WORKER] Error fetching running campaigns:", campaignsErr);
        return;
      }

      if (!runningCampaigns || runningCampaigns.length === 0) {
        return;
      }

      for (const campaign of runningCampaigns) {
        // 2. Check delay constraints by querying the last sent campaign log
        const { data: lastLog, error: lastLogErr } = await supabase
          .from('campaign_logs')
          .select('sent_at')
          .eq('campaign_id', campaign.id)
          .neq('status', 'pending')
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastLogErr) {
          console.error(`[WORKER] Error querying last log for campaign ${campaign.id}:`, lastLogErr);
          continue;
        }

        if (lastLog && lastLog.sent_at) {
          const lastSentTime = new Date(lastLog.sent_at).getTime();
          const nextAllowedTime = lastSentTime + (campaign.delay_seconds * 1000);
          if (Date.now() < nextAllowedTime) {
            continue; // Not enough time has passed yet
          }
        }

        // 3. Fetch the next pending contact log
        const { data: nextLog, error: nextLogErr } = await supabase
          .from('campaign_logs')
          .select('id, patient_id, patient_phone')
          .eq('campaign_id', campaign.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: true }) // First-In-First-Out
          .limit(1)
          .maybeSingle();

        if (nextLogErr) {
          console.error(`[WORKER] Error querying next log for campaign ${campaign.id}:`, nextLogErr);
          continue;
        }

        if (!nextLog) {
          // All contacts sent! Mark campaign as completed.
          console.log(`[WORKER] Campaign "${campaign.name}" has completed sending to all contacts.`);
          await supabase
            .from('campaigns')
            .update({ status: 'completed' })
            .eq('id', campaign.id);
          continue;
        }

        console.log(`[WORKER] Preparing to send message to ${nextLog.patient_phone} for campaign "${campaign.name}"`);

        // 4. Download attachment media if available
        let mediaAttachment: { base64: string; mimeType: string; fileName: string } | null = null;
        if (campaign.attachment_url) {
          try {
            console.log(`[WORKER] Downloading attachment from URL: ${campaign.attachment_url}`);
            const fileRes = await fetch(campaign.attachment_url);
            if (fileRes.ok) {
              const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
              const fileBuffer = await fileRes.arrayBuffer();
              const base64Data = Buffer.from(fileBuffer).toString('base64');
              const fileName = campaign.attachment_url.split('/').pop() || 'anexo';
              
              mediaAttachment = {
                base64: base64Data,
                mimeType: contentType,
                fileName: fileName
              };
              console.log(`[WORKER] Downloaded attachment successfully. Size: ${fileBuffer.byteLength} bytes.`);
            } else {
              console.error(`[WORKER] Failed to download attachment: status ${fileRes.status}`);
            }
          } catch (fileErr) {
            console.error("[WORKER] Error downloading/converting attachment:", fileErr);
          }
        }

        // 5. Send message using the Evolution API (similar to src/lib/whatsapp.ts)
        let success = false;
        let finalStatus = 'failed';
        let errorMessage: string | null = null;

        if (isProduction && nextLog.patient_phone) {
          const cleanPhone = String(nextLog.patient_phone).replace(/\D/g, '');
          const waNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

          try {
            let endpoint = `${apiUrl}/message/sendText/${instance}`;
            let body: any = {
              number: waNumber,
              text: campaign.message,
              options: { delay: 1200, presence: 'composing' }
            };

            if (mediaAttachment) {
              endpoint = `${apiUrl}/message/sendMedia/${instance}`;
              let mediaType = 'document';
              if (mediaAttachment.mimeType.startsWith('image/')) mediaType = 'image';
              else if (mediaAttachment.mimeType.startsWith('video/')) mediaType = 'video';
              else if (mediaAttachment.mimeType.startsWith('audio/')) mediaType = 'audio';

              body = {
                number: waNumber,
                options: { delay: 1200, presence: 'composing' },
                mediatype: mediaType,
                mimetype: mediaAttachment.mimeType,
                caption: campaign.message,
                media: mediaAttachment.base64,
                fileName: mediaAttachment.fileName
              };
            }

            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
              },
              body: JSON.stringify(body)
            });

            if (response.ok) {
              success = true;
              finalStatus = 'sent';
              console.log(`[WORKER] Successfully sent to ${waNumber}.`);
            } else {
              const errBody = await response.text();
              console.error(`[WORKER] Failed to send message to ${waNumber}. Status: ${response.status}. Error:`, errBody);
              errorMessage = `Status ${response.status}: ${errBody.substring(0, 150)}`;
            }
          } catch (err: any) {
            console.error(`[WORKER] Network error sending message to ${waNumber}:`, err);
            errorMessage = err.message || 'Network connection error';
          }
        } else {
          // Dev mock environment
          console.log(`[WORKER][MOCK] Sent message to ${nextLog.patient_phone}. Msg: "${campaign.message}"`);
          success = true;
          finalStatus = 'test_sent';
        }

        // 6. Update campaign log status
        await supabase
          .from('campaign_logs')
          .update({
            status: success ? 'sent' : 'failed',
            error_message: errorMessage,
            sent_at: new Date().toISOString()
          })
          .eq('id', nextLog.id);

        // 7. Insert entry into communications_log
        await supabase.from('communications_log').insert([{
          patient_id: nextLog.patient_id,
          type: 'whatsapp',
          trigger_event: 'marketing_campaign',
          status: finalStatus,
          content: campaign.attachment_url ? `[Anexo Enviado] ${campaign.message}` : campaign.message
        }]);

        // 8. Recalculate campaign sent_contacts count
        const { data: sentCountRes } = await supabase
          .from('campaign_logs')
          .select('id')
          .eq('campaign_id', campaign.id)
          .eq('status', 'sent');

        const totalSent = sentCountRes?.length || 0;
        await supabase
          .from('campaigns')
          .update({ sent_contacts: totalSent })
          .eq('id', campaign.id);
      }
    } catch (err) {
      console.error("[WORKER] Fatal error in campaign worker processing iteration:", err);
    }
  }, 5000);
}

function getReminderState() {
  const scratchDir = path.join(process.cwd(), 'scratch');
  if (!fs.existsSync(scratchDir)) {
    try {
      fs.mkdirSync(scratchDir, { recursive: true });
    } catch (e) {
      console.error("[REMINDERS] Failed to create scratch folder:", e);
    }
  }
  const filePath = path.join(scratchDir, 'reminders_state.json');
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error("[REMINDERS] Error reading reminder state:", e);
  }
  return { last_reminder_run: "", last_birthday_run: "", last_retention_run: "" };
}

function saveReminderState(state: any) {
  const scratchDir = path.join(process.cwd(), 'scratch');
  const filePath = path.join(scratchDir, 'reminders_state.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("[REMINDERS] Error saving reminder state:", e);
  }
}

async function startRemindersWorker() {
  console.log("[WORKER][REMINDERS] Reminders Worker initialized.");

  // Check every 15 minutes
  setInterval(async () => {
    try {
      const now = new Date();
      const currentHour = now.getHours();

      // Envia os lembretes entre as 9h e 10h da manhã
      if (currentHour >= 9 && currentHour < 10) {
        const state = getReminderState();
        const todayStr = now.toDateString();

        if (state.last_reminder_run !== todayStr) {
          console.log("[WORKER][REMINDERS] Running daily appointment reminders...");
          await runDailyRemindersBackend();
          state.last_reminder_run = todayStr;
          saveReminderState(state);
        }

        if (state.last_birthday_run !== todayStr) {
          console.log("[WORKER][REMINDERS] Running daily birthdays...");
          await runDailyBirthdaysBackend();
          state.last_birthday_run = todayStr;
          saveReminderState(state);
        }
      }
    } catch (err) {
      console.error("[WORKER][REMINDERS] Error in reminders worker interval:", err);
    }
  }, 15 * 60 * 1000);
}

async function runDailyRemindersBackend() {
  try {
    // Buscar agendamentos para o dia seguinte
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const startOfTomorrow = tomorrow.toISOString();

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const startOfDayAfter = dayAfter.toISOString();

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*, patients(id, phone, name), therapists(name, phone)')
      .gte('start_time', startOfTomorrow)
      .lt('start_time', startOfDayAfter)
      .eq('status', 'scheduled');

    if (error) {
      console.error('[WORKER][REMINDERS] Error fetching appointments:', error);
      return;
    }

    if (appointments && appointments.length > 0) {
      console.log(`[WORKER][REMINDERS] Found ${appointments.length} appointments for tomorrow.`);
      for (const app of appointments) {
        const time = new Date(app.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // Lembrete para o Paciente
        if (app.patients?.phone) {
          const msgPatient = `Olá, ${app.patients.name}! 🌟 Passando para lembrar do seu agendamento AMANHÃ às ${time} com ${app.therapists?.name || 'seu terapeuta'}. Modalidade: ${app.type || 'Presencial'}. Confirma sua presença? Responda com SIM ou NÃO.`;
          await sendWhatsAppBackend(app.patients.id, app.patients.phone, msgPatient, 'appointment_reminder');
        }

        // Lembrete para o Terapeuta
        if (app.therapists?.phone) {
          const msgTherapist = `Olá, ${app.therapists.name}! 📅 Lembrete de Agenda: Você tem uma sessão AMANHÃ às ${time} com o paciente ${app.patients?.name}. Modalidade: ${app.type || 'Presencial'}. Prepare-se!`;
          await sendWhatsAppBackend(null, app.therapists.phone, msgTherapist, 'appointment_reminder_therapist');
        }
      }
    }
  } catch (err) {
    console.error('[WORKER][REMINDERS] Error running daily reminders:', err);
  }
}

async function runDailyBirthdaysBackend() {
  try {
    const { data: setts } = await supabase.from('settings').select('value').eq('key', 'notifications').maybeSingle();
    const config = setts?.value || { 
      birthdayReminder: true, 
      birthdayMessage: 'Olá, {{nome}}! 🎂✨\nA equipe da Tzion Terapias deseja um feliz aniversário! Que este novo ano seja repleto de evolução, paz e conquistas. Parabéns!' 
    };

    if (config.birthdayReminder === false) {
      return;
    }

    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, name, phone, birth_date')
      .eq('status', 'Ativo')
      .not('birth_date', 'is', null);

    if (error) {
      console.error('[WORKER][REMINDERS] Error fetching birthdays:', error);
      return;
    }

    const todayBRT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const [, currentMonth, currentDay] = todayBRT.split('-').map(Number);

    if (patients && patients.length > 0) {
      for (const p of patients) {
        if (!p.birth_date) continue;
        const [, birthMonth, birthDay] = p.birth_date.split('-').map(Number);
        
        if (birthMonth === currentMonth && birthDay === currentDay) {
          if (p.phone) {
            const msg = (config.birthdayMessage || 'Olá, {{nome}}! 🎂✨\nA equipe da Tzion Terapias deseja um feliz aniversário! Que este novo ano seja repleto de evolução, paz e conquistas. Parabéns!').replace(/\{\{nome\}\}/g, p.name || 'Paciente');
            await sendWhatsAppBackend(p.id, p.phone, msg, 'birthday_wishes');
          }
        }
      }
    }
  } catch (err) {
    console.error('[WORKER][REMINDERS] Error running daily birthdays:', err);
  }
}

async function runDailyRetentionBackend() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStart = new Date(thirtyDaysAgo);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(thirtyDaysAgo);
    dateEnd.setHours(23, 59, 59, 999);

    // 1. Buscar todos os pacientes ativos
    const { data: patients, error: patientErr } = await supabase
      .from('patients')
      .select('id, name, phone')
      .eq('status', 'Ativo');

    if (patientErr || !patients) {
      console.error('[WORKER][RETENTION] Error fetching active patients:', patientErr);
      return;
    }

    const nowIso = new Date().toISOString();

    for (const patient of patients) {
      // 2. Verificar se tem consultas futuras agendadas
      const { data: futureAppts, error: futureErr } = await supabase
        .from('appointments')
        .select('id')
        .eq('patient_id', patient.id)
        .neq('status', 'cancelled')
        .gt('start_time', nowIso)
        .limit(1);

      if (futureErr || (futureAppts && futureAppts.length > 0)) {
        continue; // Tem consulta agendada no futuro, não está inativo
      }

      // 3. Verificar se a última consulta finalizada/realizada foi há exatamente 30 dias
      const { data: lastAppt, error: lastErr } = await supabase
        .from('appointments')
        .select('start_time')
        .eq('patient_id', patient.id)
        .eq('status', 'completed')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastErr) continue;

      let isInactive30Days = false;

      if (lastAppt && lastAppt.start_time) {
        const apptDate = new Date(lastAppt.start_time);
        if (apptDate >= dateStart && apptDate <= dateEnd) {
          isInactive30Days = true;
        }
      } else {
        // Se nunca teve consulta, verificar se o último pacote terminou há 30 dias (usados == totais)
        const { data: lastPackage, error: pkgErr } = await supabase
          .from('patient_packages')
          .select('updated_at')
          .eq('patient_id', patient.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!pkgErr && lastPackage && lastPackage.updated_at) {
          const pkgDate = new Date(lastPackage.updated_at);
          if (pkgDate >= dateStart && pkgDate <= dateEnd) {
            isInactive30Days = true;
          }
        }
      }

      if (isInactive30Days && patient.phone) {
        const firstName = patient.name.split(' ')[0];
        const msg = `Olá, *${firstName}*! ✨\n\nHá algum tempo não nos vemos na Tzion Terapias. Como você está se sentindo?\n\nPassando para lembrar da importância de manter a constância no seu processo terapêutico e autocuidado. Que tal agendar a sua próxima sessão de retorno?\n\nEntre em contato conosco para escolher um horário. Esperamos você! 💙`;
        console.log(`[WORKER][RETENTION] Sending retention message to patient ${patient.name} (${patient.phone})`);
        await sendWhatsAppBackend(patient.id, patient.phone, msg, 'retention_reminder');
      }
    }
  } catch (err) {
    console.error('[WORKER][RETENTION] Error running daily retention worker:', err);
  }
}

async function startRetentionWorker() {
  console.log("[WORKER][RETENTION] Retention Worker initialized.");

  // Check every 15 minutes
  setInterval(async () => {
    try {
      const now = new Date();
      const currentHour = now.getHours();

      // Envia os lembretes de retenção entre as 9h e 10h da manhã
      if (currentHour >= 9 && currentHour < 10) {
        const state = getReminderState();
        const todayStr = now.toDateString();

        if (state.last_retention_run !== todayStr) {
          console.log("[WORKER][RETENTION] Running daily retention check...");
          await runDailyRetentionBackend();
          state.last_retention_run = todayStr;
          saveReminderState(state);
        }
      }
    } catch (err) {
      console.error("[WORKER][RETENTION] Error in retention worker interval:", err);
    }
  }, 15 * 60 * 1000);
}

async function sendWhatsAppBackend(patientId: string | null, phone: string, message: string, triggerEvent: string) {
  const isProduction = !!process.env.VITE_EVOLUTION_API_URL;
  const apiKey = process.env.VITE_EVOLUTION_GLOBAL_KEY || "";
  const apiUrl = process.env.VITE_EVOLUTION_API_URL || "";
  const instance = process.env.VITE_EVOLUTION_INSTANCE_NAME || "";

  let status = 'failed';

  if (isProduction && phone) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const waNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    try {
      const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          number: waNumber,
          text: message,
          options: { delay: 1200, presence: 'composing' }
        })
      });

      if (response.ok) {
        status = 'sent';
      }
    } catch (err) {
      console.error('[WORKER][REMINDERS] Error sending WhatsApp:', err);
    }
  } else {
    console.log(`[WORKER][REMINDERS][MOCK] To: ${phone} | Msg: ${message}`);
    status = 'test_sent';
  }

  await supabase.from('communications_log').insert([{
    patient_id: patientId,
    type: 'whatsapp',
    trigger_event: triggerEvent,
    status: status,
    content: message
  }]);
}

async function activatePendingPackagesForPatient(patientId: string) {
  console.log(`[ACTIVATION] Activating pending packages for patient ${patientId}...`);
  
  const { data: activatedPackages, error: pkgError } = await supabase
    .from('patient_packages')
    .update({ status: 'active' })
    .eq('patient_id', patientId)
    .eq('status', 'pending')
    .select();

  if (pkgError) {
    console.error(`[ACTIVATION] Error activating packages for patient ${patientId}:`, pkgError);
    return;
  }

  if (!activatedPackages || activatedPackages.length === 0) {
    console.log(`[ACTIVATION] No pending packages activated for patient ${patientId}.`);
    return;
  }

  console.log(`[ACTIVATION] Activated ${activatedPackages.length} package(s) for patient ${patientId}.`);

  const { data: patient, error: patientErr } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .single();

  if (patientErr || !patient) {
    console.error(`[ACTIVATION] Patient ${patientId} not found to generate contract.`);
    return;
  }

  for (const pkg of activatedPackages) {
    const { data: service, error: serviceErr } = await supabase
      .from('services')
      .select('*')
      .eq('id', pkg.service_id)
      .single();

    if (serviceErr || !service) {
      console.error(`[ACTIVATION] Service ${pkg.service_id} not found for package.`);
      continue;
    }

    if (service.type === 'pacote') {
      try {
        console.log(`[ACTIVATION] Service is 'pacote'. Creating contract for patient ${patient.name}...`);
        
        const { data: setts } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'contract_template')
          .single();

        let tpl = setts?.value || 'Contrato Tzion — Paciente: {{nome_paciente}}, Data: {{data_atual}}.';
        tpl = tpl
          .replace(/\{\{nome_paciente\}\}/g, patient.name || '')
          .replace(/\{\{cpf_paciente\}\}/g, patient.cpf || '')
          .replace(/\{\{data_atual\}\}/g, new Date().toLocaleDateString('pt-BR'));

        const { data: contract, error: contractErr } = await supabase
          .from('patient_contracts')
          .insert({
            patient_id: patient.id,
            content: tpl,
            status: 'pending',
          })
          .select()
          .single();

        if (contractErr) {
          console.error(`[ACTIVATION] Error inserting contract for patient ${patient.id}:`, contractErr);
          continue;
        }

        if (contract && patient.phone) {
          const firstName = patient.name.split(' ')[0];
          const siteUrl = process.env.APP_URL || "https://agente.agenciahigher.com.br";
          const link = `${siteUrl}/contrato/${contract.id}`;
          const msg = `Olá, *${firstName}*! ✨\n\nSeu pacote foi iniciado! Por favor, assine o termo de serviço:\n\n🔗 ${link}\n\nQualquer dúvida, estamos à disposição! 💙`;
          
          console.log(`[ACTIVATION] Sending contract WhatsApp message to ${patient.phone}...`);
          await sendWhatsAppBackend(patient.id, patient.phone, msg, 'contract_sent');
        }
      } catch (err) {
        console.error('[ACTIVATION] Error in contract generation / sending:', err);
      }
    }
  }
}

async function executeFinancialSync() {
  const syncLog: string[] = [];
  let updatedPaymentsCount = 0;
  let createdPayouts = 0;
  let updatedPayouts = 0;

  console.log("Iniciando sincronização geral...");

  // 1. Sincronizar cobranças Asaas Pendentes
  const { data: pendingAsaasPayments, error: pErr } = await supabase
    .from("payments")
    .select("*")
    .eq("status", "pending")
    .not("asaas_id", "is", null);

  if (pErr) {
    console.error("Erro ao buscar pagamentos pendentes:", pErr);
    throw pErr;
  }

  const apiKey = process.env.ASAAS_API_KEY;
  const isMock = !apiKey || apiKey === "your-asaas-key";
  const isProduction = process.env.ASAAS_ENV === "production";
  const asaasBaseUrl = isProduction ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

  for (const pay of (pendingAsaasPayments || [])) {
    let asaasStatus = "PENDING";
    if (isMock) {
      asaasStatus = Math.random() > 0.5 ? "RECEIVED" : "PENDING";
    } else {
      try {
        const getRes = await fetch(`${asaasBaseUrl}/payments/${pay.asaas_id}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "access_token": apiKey
          }
        });
        if (getRes.ok) {
          const resData: any = await getRes.json();
          asaasStatus = resData.status;
        }
      } catch (err) {
        console.error(`Erro ao consultar Asaas para pagamento ${pay.id}:`, err);
      }
    }

    if (asaasStatus === "RECEIVED" || asaasStatus === "CONFIRMED") {
      const { error: updErr } = await supabase
        .from("payments")
        .update({ status: "paid" })
        .eq("id", pay.id);

      if (!updErr) {
        updatedPaymentsCount++;
        if (pay.patient_id && pay.type === 'income') {
          await activatePendingPackagesForPatient(pay.patient_id);
        }
      }
    }
  }
  syncLog.push(`Sincronização Asaas: ${updatedPaymentsCount} cobrança(s) pendente(s) confirmada(s).`);

  // 2. Recalcular e Atualizar Repasses/Comissões (commission_payouts)
  const now = new Date();
  const periods: { month: number; year: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  const { data: therapistsList } = await supabase.from("therapists").select("*");

  if (therapistsList && therapistsList.length > 0) {
    for (const period of periods) {
      const startOfMonth = new Date(period.year, period.month - 1, 1).toISOString();
      const endOfMonth = new Date(period.year, period.month, 0, 23, 59, 59).toISOString();

      const { data: periodPayments } = await supabase
        .from("payments")
        .select("*")
        .eq("status", "paid")
        .eq("type", "income")
        .not("therapist_id", "is", null)
        .gte("created_at", startOfMonth)
        .lte("created_at", endOfMonth);

      const { data: existingPayouts } = await supabase
        .from("commission_payouts")
        .select("*")
        .eq("month", period.month)
        .eq("year", period.year);

      for (const therapist of therapistsList) {
        const therapistPayments = (periodPayments || []).filter(p => p.therapist_id === therapist.id);
        if (therapistPayments.length === 0) continue;

        const rate_clinic = therapist.commission_rate_clinic ?? 50;
        const rate_self = therapist.commission_rate_self ?? 25;

        let grossTotal = 0;
        let totalClinicShare = 0;

        for (const p of therapistPayments) {
          const base = Math.abs(p.amount);
          const referral = p.referral_source || 'therapist';
          const rate = referral === 'clinic' ? rate_clinic : rate_self;
          
          grossTotal += base;
          totalClinicShare += base * (rate / 100);
        }

        const therapistNet = grossTotal - totalClinicShare;
        const existing = (existingPayouts || []).find(po => po.therapist_id === therapist.id);

        if (existing) {
          if (existing.status === 'pending') {
            if (
              Math.abs(Number(existing.gross_total) - grossTotal) > 0.01 ||
              Math.abs(Number(existing.clinic_share) - totalClinicShare) > 0.01
            ) {
              await supabase
                .from("commission_payouts")
                .update({
                  gross_total: grossTotal,
                  clinic_share: totalClinicShare,
                  therapist_net: therapistNet
                })
                .eq("id", existing.id);
              updatedPayouts++;
            }
          }
        } else {
          await supabase
            .from("commission_payouts")
            .insert({
              therapist_id: therapist.id,
              month: period.month,
              year: period.year,
              gross_total: grossTotal,
              clinic_share: totalClinicShare,
              therapist_net: therapistNet,
              status: 'pending'
            });
          createdPayouts++;
        }
      }
    }
  }

  syncLog.push(`Repasses calculados: ${createdPayouts} criado(s) pendente(s), ${updatedPayouts} atualizado(s).`);

  return {
    success: true,
    log: syncLog,
    updatedPayments: updatedPaymentsCount,
    createdPayouts,
    updatedPayouts
  };
}

async function runNpsSurveyBackend() {
  try {
    const { data: setts } = await supabase.from('settings').select('value').eq('key', 'nps_settings').maybeSingle();
    const npsSettings = setts?.value;
    if (!npsSettings) return;

    const delayMinutes = npsSettings.delay_minutes || 30;
    const messageTemplate = npsSettings.message;

    const cutoffTime = new Date(Date.now() - delayMinutes * 60 * 1000).toISOString();

    const { data: pendingAppointments, error } = await supabase
      .from('appointments')
      .select('id, patient_id, therapist_id, completed_at, patients(name, phone)')
      .eq('status', 'completed')
      .eq('nps_sent', false)
      .lte('completed_at', cutoffTime);

    if (error) {
      console.error('[WORKER][NPS] Error fetching pending NPS appointments:', error);
      return;
    }

    if (pendingAppointments && pendingAppointments.length > 0) {
      console.log(`[WORKER][NPS] Found ${pendingAppointments.length} pending NPS surveys to send.`);
      for (const app of pendingAppointments) {
        const patientData = app.patients as any;
        if (patientData && patientData.phone) {
          const firstName = patientData.name.split(' ')[0];
          
          const baseUrl = process.env.SITE_URL 
            || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
            || "http://localhost:3000";
          const npsLink = `${baseUrl}/avaliacao/${app.id}`;
          let finalMessage = messageTemplate.replace('{{nome}}', firstName);
          finalMessage += `\n\nAcesse o link para avaliar: ${npsLink}`;

          try {
            await sendWhatsAppBackend(app.patient_id, patientData.phone, finalMessage, 'nps_survey');
            await supabase.from('appointments').update({ nps_sent: true }).eq('id', app.id);
            console.log(`[WORKER][NPS] NPS sent successfully to ${patientData.name}`);
          } catch (e) {
            console.error(`[WORKER][NPS] Error sending NPS to ${patientData.name}:`, e);
          }
        } else {
          await supabase.from('appointments').update({ nps_sent: true }).eq('id', app.id);
        }
      }
    }
  } catch (err) {
    console.error('[WORKER][NPS] General error in NPS worker cycle:', err);
  }
}

async function startNpsWorker() {
  console.log("[WORKER][NPS] NPS Worker initialized.");
  setInterval(async () => {
    try {
      await runNpsSurveyBackend();
    } catch (e) {
      console.error('[WORKER][NPS] Error in NPS worker interval:', e);
    }
  }, 60 * 1000);
}

async function startFinancialSyncWorker() {
  console.log("[WORKER][FINANCE] Financial Sync Worker initialized.");
  setInterval(async () => {
    try {
      console.log("[WORKER][FINANCE] Starting automatic financial sync...");
      const result = await executeFinancialSync();
      console.log("[WORKER][FINANCE] Sync complete. Result:", JSON.stringify(result.log));
    } catch (err) {
      console.error("[WORKER][FINANCE] Error in automatic financial sync:", err);
    }
  }, 30 * 60 * 1000);
}

async function runTicketCleanupBackend() {
  try {
    const { data: setts } = await supabase.from('settings').select('value').eq('key', 'ticket_automation').maybeSingle();
    const ticketSettings = setts?.value || { autoCloseHours: 24, closeMessage: 'Seu atendimento foi encerrado devido à falta de interação nas últimas 24 horas. Caso precise de ajuda, envie uma nova mensagem!' };

    if (!ticketSettings.autoCloseHours) return;

    const limitHours = ticketSettings.autoCloseHours;
    const cutoffTime = new Date(Date.now() - limitHours * 60 * 60 * 1000).toISOString();

    const { data: openTickets, error } = await supabase
      .from('service_tickets')
      .select('id, customer_phone, created_at')
      .in('status', ['open', 'in_progress']);

    if (error) {
      console.error('[WORKER][TICKETS] Error fetching open tickets:', error);
      return;
    }

    if (openTickets && openTickets.length > 0) {
      for (const ticket of openTickets) {
        const { data: lastMsg } = await supabase
          .from('chat_messages')
          .select('created_at')
          .eq('customer_phone', ticket.customer_phone)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastInteraction = lastMsg ? new Date(lastMsg.created_at) : new Date(ticket.created_at);
        const cutoffDate = new Date(cutoffTime);

        if (lastInteraction < cutoffDate) {
          await supabase.from('service_tickets').update({ status: 'closed' }).eq('id', ticket.id);
          console.log(`[WORKER][TICKETS] Ticket ${ticket.id} fechado por inatividade.`);

          if (ticketSettings.closeMessage && ticketSettings.closeMessage.trim() !== '') {
            if (ticket.customer_phone) {
              await sendWhatsAppBackend(null, ticket.customer_phone, ticketSettings.closeMessage, 'ticket_closed');
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[WORKER][TICKETS] General error in ticket cleanup worker cycle:', err);
  }
}

async function startTicketCleanupWorker() {
  console.log("[WORKER][TICKETS] Ticket Cleanup Worker initialized.");
  setInterval(async () => {
    try {
      await runTicketCleanupBackend();
    } catch (e) {
      console.error('[WORKER][TICKETS] Error in ticket cleanup worker interval:', e);
    }
  }, 15 * 60 * 1000);
}

startServer();

export default app;
