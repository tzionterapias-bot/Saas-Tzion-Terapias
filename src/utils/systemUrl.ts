import { supabase } from '@/src/lib/supabase';

export async function getSystemBaseUrl(): Promise<string> {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'clinic_profile')
      .maybeSingle();

    if (data?.value?.system_url) {
      // Clean trailing slash
      return data.value.system_url.replace(/\/$/, '');
    }
  } catch (error) {
    console.error('Error fetching system_url from settings:', error);
  }
  return window.location.origin;
}
