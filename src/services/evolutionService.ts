import { supabase } from '@/src/lib/supabase';

const EVOLUTION_API_URL = '/api/whatsapp';

async function authFetch(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };

  return fetch(url, {
    ...options,
    headers
  });
}

export const evolutionService = {
  /**
   * Configura uma nova instância para um cliente
   * Cria, ajusta parâmetros e define o webhook automaticamente
   */
  async setupNewCustomerInstance(customerName: string, customerId: string) {
    try {
      // Slugify o nome da instância para evitar erros na API (remover espaços e caracteres especiais)
      const instanceName = customerName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '_')
        .replace(/^-+|-+$/g, '');
      
      const instanceId = customerId;
      
      console.log(`Iniciando setup da instância: ${instanceName} para ${customerName}`);

      // 1. Criar a Instância via Proxy Seguro
      const createRes = await authFetch(`${EVOLUTION_API_URL}/setup`, {
        method: 'POST',
        body: JSON.stringify({
          instanceName
        })
      });

      const createData = await createRes.json();
      
      if (!createRes.ok) {
        console.error('Erro detalhado da Evolution API:', createData);
        
        // Extrair todas as mensagens de erro possíveis, incluindo de objetos aninhados (NestJS)
        const errorMsg = [
          createData.message,
          createData.error,
          ...(createData.response && Array.isArray(createData.response.message) ? createData.response.message : [createData.response?.message])
        ].filter(Boolean).join(' ').toLowerCase();

        if (errorMsg.includes('already exists') || errorMsg.includes('already in use') || errorMsg.includes('in use') || errorMsg.includes('exists')) {
          console.log('Instância já existe, continuando setup...');
        } else {
          throw new Error(createData.message || createData.error || 'Erro ao criar instância');
        }
      }

      const token = createData.hash || createData.instance?.token;

      // 2. Configurações da Instância via Proxy Seguro (Padrão Evolution v2)
      await authFetch(`${EVOLUTION_API_URL}/settings/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({
          rejectCall: true,
          msgCall: "Desculpe, este número não aceita chamadas de voz.",
          groupsIgnore: true,
          alwaysOnline: true,
          readMessages: true,
          readStatus: true,
          syncFullHistory: false
        })
      });

      // 3. Configurar Webhook via Proxy Seguro (Padrão Evolution v2)
      const webhookUrl = `https://youxrufxufxxcgixymdd.supabase.co/functions/v1/whatsapp-evolution-v2`;
      
      await authFetch(`${EVOLUTION_API_URL}/webhook/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: true,
            events: ["MESSAGES_UPSERT"]
          }
        })
      });

      // 4. Salvar/Atualizar no Supabase (Opcional, não trava se falhar)
      try {
        if (token || createData.instance) {
          await supabase
            .from('whatsapp_instances')
            .upsert({
              customer_id: instanceId,
              instance_name: instanceName,
              instance_token: token || createData.instance?.token,
              status: 'created',
              updated_at: new Date().toISOString()
            }, { onConflict: 'instance_name' });
        }
      } catch (dbErr) {
        console.warn('Aviso: Tabela whatsapp_instances não encontrada, mas a instância foi criada.', dbErr);
      }

      return { 
        success: true, 
        instanceName, 
        token: token || createData.instance?.token 
      };

    } catch (error) {
      console.error('Falha no setupNewCustomerInstance:', error);
      throw error;
    }
  },

  /**
   * Obtém o QR Code em Base64 para conexão
   */
  async getQRCode(instanceName: string) {
    try {
      const response = await authFetch(`${EVOLUTION_API_URL}/qrcode/${instanceName}`);
      const data = await response.json();
      
      // A Evolution retorna o base64 em diferentes campos dependendo da versão
      return data.base64 || data.code || data.qrcode?.base64;
    } catch (error) {
      console.error('Erro ao obter QR Code:', error);
      throw error;
    }
  },

  /**
   * Verifica o status de uma instância
   */
  async checkInstanceStatus(instanceName: string) {
    try {
      const response = await authFetch(`${EVOLUTION_API_URL}/status/${instanceName}`);
      return await response.json();
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return { status: 'error' };
    }
  },

  async getInstances() {
    try {
      const response = await authFetch(`${EVOLUTION_API_URL}/instances`);
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error);
      return [];
    }
  },

  async deleteInstance(instanceName: string) {
    try {
      const response = await authFetch(`${EVOLUTION_API_URL}/instance/${instanceName}`, {
        method: 'DELETE'
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao deletar instância:', error);
      throw error;
    }
  },

  async logoutInstance(instanceName: string) {
    try {
      const response = await authFetch(`${EVOLUTION_API_URL}/logout/${instanceName}`, {
        method: 'DELETE'
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      throw error;
    }
  },

  /**
   * Envia uma mensagem de texto simples
   */
  async sendMessage(instanceName: string, remoteJid: string, text: string) {
    try {
      const response = await authFetch(`${EVOLUTION_API_URL}/sendText/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({
          number: remoteJid,
          text: text,
          delay: 1200,
          linkPreview: false
        })
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao enviar mensagem de texto:', error);
      throw error;
    }
  },

  /**
   * Envia mídia (Imagem ou PDF) via Base64
   */
  async sendMedia(instanceName: string, remoteJid: string, base64: string, fileName: string, caption?: string) {
    try {
      const isPdf = fileName.toLowerCase().endsWith('.pdf');
      const mediaType = isPdf ? 'document' : 'image';
      
      const response = await authFetch(`${EVOLUTION_API_URL}/sendMedia/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({
          number: remoteJid,
          mediaMessage: {
            mediatype: mediaType,
            caption: caption || '',
            media: base64,
            fileName: fileName
          },
          delay: 1200
        })
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao enviar mídia:', error);
      throw error;
    }
  }
};
