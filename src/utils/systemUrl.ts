import { supabase } from '@/src/lib/supabase';

export async function getSystemBaseUrl(): Promise<string> {
  const DEFAULT_PRODUCTION_URL = 'https://saas-tzion-terapias-six.vercel.app';

  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'clinic_profile')
      .maybeSingle();

    if (data?.value?.system_url && data.value.system_url.trim() !== '') {
      const url = data.value.system_url.trim().replace(/\/$/, '');
      if (!url.includes('localhost')) {
        return url;
      }
    }
  } catch (error) {
    console.error('Error fetching system_url from settings:', error);
  }

  // Se o navegador estiver acessando em um dominio publico (nao localhost)
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')) {
    return window.location.origin.replace(/\/$/, '');
  }

  // Fallback seguro de producao para envios de WhatsApp
  return DEFAULT_PRODUCTION_URL;
}
