import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop() || ''; // Gets the last part, e.g. 'checkout', 'webhook', or 'pix/:id' handled via query params if we want

    // Initialize Supabase Client. If webhook, we must use the Service Role Key to bypass RLS.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
    const supabaseKey = (path === 'webhook' ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')) || '';
    const authHeader = req.headers.get('Authorization');
    
    // For webhooks, don't pass the empty Authorization header because we want to use the service role key
    const supabase = createClient(supabaseUrl, supabaseKey, path === 'webhook' ? {} : {
      global: { headers: { Authorization: authHeader || '' } }
    });

    // Default API keys (production or sandbox)
    let asaasApiKey = Deno.env.get('ASAAS_API_KEY') || "your-asaas-key";
    
    // Fetch Asaas Key from DB if not present in Env
    if (!asaasApiKey || asaasApiKey === "your-asaas-key") {
      try {
        const { data: dbKey } = await supabase.rpc('get_asaas_key');
        if (dbKey) asaasApiKey = dbKey;
      } catch (err) {}

      if (!asaasApiKey || asaasApiKey === "your-asaas-key") {
        const { data: settings } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'integrations')
          .maybeSingle();
        
        if (settings?.value?.asaas_token) {
          asaasApiKey = settings.value.asaas_token;
        }
      }
    }

    const isProduction = (asaasApiKey && asaasApiKey.startsWith('$aact_prod_')) ? true : Deno.env.get('ASAAS_ENV') === "production";
    const asaasBaseUrl = isProduction ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

    // ROUTE: POST /checkout (gerar-cobranca)
    if (path === 'checkout' && req.method === 'POST') {
      const { valor, pacienteId, billingType, description } = await req.json();

      if (!valor || !pacienteId) {
        return new Response(JSON.stringify({ error: "Valor e ID do paciente são obrigatórios." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: patient, error: patientErr } = await supabase
        .from("patients")
        .select("name, cpf, email, phone, asaas_customer_id")
        .eq("id", pacienteId)
        .single();

      if (patientErr || !patient) {
        return new Response(JSON.stringify({ error: "Paciente não encontrado." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!patient.cpf) {
        return new Response(JSON.stringify({ error: "O CPF do paciente é obrigatório para gerar cobrança no Asaas." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const cleanCpf = patient.cpf.replace(/\D/g, "");
      if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
        return new Response(JSON.stringify({ error: "CPF/CNPJ inválido. Digite um documento válido." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let asaasCustomerId = patient.asaas_customer_id;

      if (!asaasCustomerId) {
        const cleanPhone = patient.phone ? patient.phone.replace(/\D/g, "") : undefined;
        
        const createCustRes = await fetch(`${asaasBaseUrl}/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "access_token": asaasApiKey },
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
          // Retornar 200 com { error } para que o frontend consiga ler o erro ao invés de explodir com HttpError
          return new Response(JSON.stringify({ error: `Erro no Asaas ao cadastrar cliente: ${errData}` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const newCustData = await createCustRes.json();
        asaasCustomerId = newCustData.id;

        await supabase.from("patients").update({ asaas_customer_id: asaasCustomerId }).eq("id", pacienteId);
      }

      const { data: settsData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "integrations")
        .maybeSingle();

      const dueDate = new Date().toISOString().split("T")[0];
      const maxInstallments = Number(settsData?.value?.asaas_max_installments) || 12;
      const interestFreeInstallments = Number(settsData?.value?.asaas_interest_free_installments) || 6;

      const paymentPayload: any = {
        customer: asaasCustomerId,
        billingType: billingType || "UNDEFINED",
        value: Number(valor),
        dueDate: dueDate,
        description: description || "Tzion Terapias - Serviços Terapêuticos",
        postalService: false,
        maxInstallmentCount: maxInstallments,
        maxInterestFreeInstallmentCount: interestFreeInstallments
      };

      const createPaymentRes = await fetch(`${asaasBaseUrl}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": asaasApiKey },
        body: JSON.stringify(paymentPayload)
      });

      if (!createPaymentRes.ok) {
        const errData = await createPaymentRes.text();
        return new Response(JSON.stringify({ error: `Erro no Asaas ao criar cobrança: ${errData}` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const paymentData = await createPaymentRes.json();
      return new Response(JSON.stringify({
        id: paymentData.id,
        invoiceUrl: paymentData.invoiceUrl,
        status: paymentData.status
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ROUTE: POST /subscription (gerar-assinatura-recorrente)
    if ((path === 'subscription' || path === 'assinatura') && req.method === 'POST') {
      const { valor, pacienteId, billingType, cycle, description, maxPayments } = await req.json();

      if (!valor || !pacienteId) {
        return new Response(JSON.stringify({ error: "Valor e ID do paciente são obrigatórios." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: patient, error: patientErr } = await supabase
        .from("patients")
        .select("name, cpf, email, phone, asaas_customer_id")
        .eq("id", pacienteId)
        .single();

      if (patientErr || !patient) {
        return new Response(JSON.stringify({ error: "Paciente não encontrado." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!patient.cpf) {
        return new Response(JSON.stringify({ error: "O CPF do paciente é obrigatório para gerar assinatura no Asaas." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const cleanCpf = patient.cpf.replace(/\D/g, "");
      if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
        return new Response(JSON.stringify({ error: "CPF/CNPJ inválido. Digite um documento válido." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let asaasCustomerId = patient.asaas_customer_id;

      if (!asaasCustomerId) {
        const cleanPhone = patient.phone ? patient.phone.replace(/\D/g, "") : undefined;
        
        const createCustRes = await fetch(`${asaasBaseUrl}/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "access_token": asaasApiKey },
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
          return new Response(JSON.stringify({ error: `Erro no Asaas ao cadastrar cliente: ${errData}` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const newCustData = await createCustRes.json();
        asaasCustomerId = newCustData.id;

        await supabase.from("patients").update({ asaas_customer_id: asaasCustomerId }).eq("id", pacienteId);
      }

      const dueDate = new Date().toISOString().split("T")[0];

      const subPayload: any = {
        customer: asaasCustomerId,
        billingType: billingType || "CREDIT_CARD",
        value: Number(valor),
        nextDueDate: dueDate,
        cycle: cycle || "MONTHLY",
        description: description || "Tzion Terapias - Assinatura Plano Tzion Care",
      };

      if (maxPayments && Number(maxPayments) > 0) {
        subPayload.maxPayments = Number(maxPayments);
      }

      const createSubRes = await fetch(`${asaasBaseUrl}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": asaasApiKey },
        body: JSON.stringify(subPayload)
      });

      if (!createSubRes.ok) {
        const errData = await createSubRes.text();
        return new Response(JSON.stringify({ error: `Erro no Asaas ao criar assinatura recorrente: ${errData}` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const subData = await createSubRes.json();

      // Obter primeira cobrança gerada para a assinatura para devolver invoiceUrl e paymentId
      let firstPayment: any = null;
      try {
        const paymentsRes = await fetch(`${asaasBaseUrl}/subscriptions/${subData.id}/payments`, {
          headers: { "Content-Type": "application/json", "access_token": asaasApiKey }
        });
        if (paymentsRes.ok) {
          const paymentsJson = await paymentsRes.json();
          firstPayment = paymentsJson?.data?.[0];
        }
      } catch (err) {
        console.error("Erro ao buscar primeira fatura da assinatura:", err);
      }

      return new Response(JSON.stringify({
        subscriptionId: subData.id,
        id: firstPayment ? firstPayment.id : subData.id,
        invoiceUrl: firstPayment ? firstPayment.invoiceUrl : (subData.invoiceUrl || null),
        status: firstPayment ? firstPayment.status : subData.status,
        cycle: subData.cycle,
        billingType: subData.billingType
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ROUTE: POST /pix
    if (path === 'pix' && req.method === 'POST') {
      const { paymentId } = await req.json();

      if (!asaasApiKey || asaasApiKey === "your-asaas-key" || paymentId.startsWith("mock_")) {
        return new Response(JSON.stringify({
          success: true,
          encodedImage: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          payload: "00020101021226870014br.gov.bcb.pix25650000000000000000000000000000000000000000000000000000005303986540510.005802BR5920Tzion Terapias6009Sao Paulo62070503***6304E22A"
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const response = await fetch(`${asaasBaseUrl}/payments/${paymentId}/pixQrCode`, {
        method: "GET",
        headers: { "Content-Type": "application/json", "access_token": asaasApiKey }
      });

      if (!response.ok) {
        const errText = await response.text();
        return new Response(JSON.stringify({ error: `Erro no Asaas ao obter QR Code: ${errText}` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const data = await response.json();
      return new Response(JSON.stringify({
        success: data.success,
        encodedImage: data.encodedImage,
        payload: data.payload
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ROUTE: POST /webhook
    if (path === 'webhook' && req.method === 'POST') {
      const payload = await req.json();
      const { event, payment } = payload;
      
      const { data: setts } = await supabase.from('settings').select('value').eq('key', 'integrations').maybeSingle();
      const expectedToken = setts?.value?.asaas_webhook_token;
      
      if (expectedToken && expectedToken.trim() !== '') {
        const headerToken = req.headers.get('asaas-access-token');
        if (!headerToken || headerToken !== expectedToken) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      
      if (!payment || !payment.id) {
        return new Response('OK', { headers: corsHeaders });
      }
      
      if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        const asaasId = payment.id;
        
        // 1. Tentar atualizar venda de produto (E-book)
        const { data: updatedSale } = await supabase
          .from('product_sales')
          .update({ status: 'paid' })
          .eq('asaas_payment_id', asaasId)
          .select()
          .maybeSingle();

        if (updatedSale) {
            const { data: n8nSetts } = await supabase.from('settings').select('value').eq('key', 'integrations').maybeSingle();
            const n8nUrl = n8nSetts?.value?.n8n_webhook_url;
            if (n8nUrl) {
              await fetch(n8nUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  type: 'ebook_purchase', 
                  customer_name: updatedSale.customer_name,
                  customer_phone: updatedSale.customer_phone,
                  product_name: updatedSale.product_name || 'E-book',
                  product_url: updatedSale.product_url || '',
                  asaas_id: asaasId
                })
              });
            }
        }

        // 2. Tentar atualizar pagamento de serviço (Pacotes/Consultas)
        const asaasGrossVal = payment.value !== undefined && payment.value !== null ? Number(payment.value) : null;
        const asaasNetVal = payment.netValue !== undefined && payment.netValue !== null ? Number(payment.netValue) : null;
        const asaasFeeVal = (asaasGrossVal !== null && asaasNetVal !== null) ? Math.max(0, asaasGrossVal - asaasNetVal) : null;
        const asaasFeeRate = (asaasGrossVal && asaasFeeVal !== null && asaasGrossVal > 0) ? Number(((asaasFeeVal / asaasGrossVal) * 100).toFixed(2)) : null;

        const updateData: Record<string, any> = { status: 'paid' };
        if (asaasNetVal !== null) updateData.net_amount = asaasNetVal;
        if (asaasFeeVal !== null) updateData.card_fee_val = asaasFeeVal;
        if (asaasFeeRate !== null) updateData.card_fee_rate = asaasFeeRate;

        let { data: updatedPayment, error: payError } = await supabase
          .from('payments')
          .update(updateData)
          .eq('asaas_id', asaasId)
          .select()
          .maybeSingle();

        // 3. Se for renovação de assinatura recorrente (novo mês gerado pelo Asaas) e ainda não existir em payments:
        if (!updatedPayment && payment.subscription) {
          const { data: refPayment } = await supabase
            .from('payments')
            .select('*')
            .eq('asaas_subscription_id', payment.subscription)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (refPayment) {
            const desc = `Renovação de Assinatura (${refPayment.subscription_cycle || 'Mensal'}): ${refPayment.description?.replace(/^Assinatura:\s*/, '') || 'Tzion Care'}`;
            const { data: insertedRecurrence } = await supabase
              .from('payments')
              .insert({
                amount: asaasGrossVal !== null ? asaasGrossVal : refPayment.amount,
                net_amount: asaasNetVal !== null ? asaasNetVal : (refPayment.net_amount || refPayment.amount),
                card_fee_rate: asaasFeeRate !== null ? asaasFeeRate : refPayment.card_fee_rate,
                card_fee_val: asaasFeeVal !== null ? asaasFeeVal : refPayment.card_fee_val,
                type: 'income',
                status: 'paid',
                description: desc,
                category: refPayment.category || 'Plano Recorrente',
                payment_method: 'asaas_subscription',
                patient_id: refPayment.patient_id,
                therapist_id: refPayment.therapist_id,
                referral_source: refPayment.referral_source,
                asaas_id: asaasId,
                asaas_subscription_id: payment.subscription,
                subscription_cycle: refPayment.subscription_cycle,
                created_at: new Date().toISOString()
              })
              .select()
              .single();

            if (insertedRecurrence) {
              updatedPayment = insertedRecurrence;
            }
          }
        }
          
        if (updatedPayment && updatedPayment.patient_id && updatedPayment.type === 'income') {
          // Ativar pacotes
          const { data: activatedPackages } = await supabase
            .from('patient_packages')
            .update({ status: 'active' })
            .eq('patient_id', updatedPayment.patient_id)
            .eq('status', 'pending')
            .select();

          if (activatedPackages && activatedPackages.length > 0) {
            const { data: patient } = await supabase.from('patients').select('*').eq('id', updatedPayment.patient_id).single();
            if (patient) {
              for (const pkg of activatedPackages) {
                const { data: service } = await supabase.from('services').select('*').eq('id', pkg.service_id).single();
                if (service && service.type === 'pacote') {
                  const { data: contractSetts } = await supabase.from('settings').select('value').eq('key', 'contract_template').single();
                  let tpl = contractSetts?.value || 'Contrato Tzion — Paciente: {{nome_paciente}}, Data: {{data_atual}}.';
                  tpl = tpl
                    .replace(/\{\{nome_paciente\}\}/g, patient.name || '')
                    .replace(/\{\{cpf_paciente\}\}/g, patient.cpf || '')
                    .replace(/\{\{data_atual\}\}/g, new Date().toLocaleDateString('pt-BR'));

                  const { data: contract } = await supabase.from('patient_contracts').insert({
                    patient_id: patient.id,
                    content: tpl,
                    status: 'pending',
                  }).select().single();

                  if (contract && patient.phone) {
                    const firstName = patient.name.split(' ')[0];
                    const { data: clinicProfileSetting } = await supabase.from('settings').select('value').eq('key', 'clinic_profile').maybeSingle();
                    const siteUrl = clinicProfileSetting?.value?.system_url || Deno.env.get('APP_URL') || "https://tzionterapias.com.br";
                    const cleanSiteUrl = siteUrl.replace(/\/+$/, '');
                    const link = `${cleanSiteUrl}/contrato/${contract.id}`;
                    const msg = `Olá, *${firstName}*! ✨\n\nSeu pacote foi iniciado! Por favor, assine o termo de serviço:\n\n🔗 ${link}\n\nQualquer dúvida, estamos à disposição! 💙`;
                    
                    // Enviar notificação para o N8N Webhook do cliente
                    const { data: n8nSetts } = await supabase.from('settings').select('value').eq('key', 'integrations').maybeSingle();
                    const n8nUrl = n8nSetts?.value?.n8n_webhook_url;
                    if (n8nUrl) {
                      await fetch(n8nUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          type: 'contract_sent', 
                          patient_id: patient.id,
                          patient_phone: patient.phone, 
                          message: msg 
                        })
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
      return new Response('OK', { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Route not found" }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
