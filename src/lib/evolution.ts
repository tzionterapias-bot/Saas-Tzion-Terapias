const EVOLUTION_API_URL = import.meta.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY;

export const evolutionService = {
  async getInstances() {
    try {
      const response = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: {
          'apikey': EVOLUTION_API_KEY
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching instances:', error);
      return [];
    }
  },

  async createInstance(instanceName: string) {
    try {
      const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify({
          instanceName,
          token: Math.random().toString(36).substring(7),
          qrcode: true
        })
      });
      return await response.json();
    } catch (error) {
      console.error('Error creating instance:', error);
      throw error;
    }
  },

  async connectInstance(instanceName: string) {
    try {
      const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
        headers: {
          'apikey': EVOLUTION_API_KEY
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Error connecting instance:', error);
      throw error;
    }
  },

  async sendMessage(instanceName: string, number: string, text: string) {
    try {
      const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify({
          number,
          options: {
            delay: 1200,
            presence: 'composing'
          },
          textMessage: {
            text
          }
        })
      });
      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
};
