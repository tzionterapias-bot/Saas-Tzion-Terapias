import { supabase } from '../lib/supabase';

export interface WifiSettings {
    id?: string;
    clinic_id: string;
    ssid?: string;
    gateway_ip?: string;
    portal_title?: string;
    portal_subtitle?: string;
    portal_logo_url?: string;
    portal_bg_color?: string;
    portal_accent_color?: string;
    require_registration: boolean;
    session_duration_minutes: number;
    enabled: boolean;
    portal_verse?: string;
    show_next_event?: boolean;
    show_linktree?: boolean;
    linktree_links?: Array<{ label: string; url: string; icon?: string }>;
}

export interface WifiCheckinPayload {
    clinic_id: string;
    patient_id?: string;
    guest_name?: string;
    guest_email?: string;
    guest_phone?: string;
    is_patient: boolean;
    device_mac?: string | null;
    ssid?: string | null;
    ap_name?: string | null;
    checkin_at: string;
}

export const wifiService = {
    async getSettings(): Promise<WifiSettings | null> {
        // Since Tzion is a single clinic system for now, we use a fixed clinic_id or the first one found
        const { data, error } = await supabase
            .from('wifi_settings')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (data) return data as WifiSettings;
        return null;
    },

    async checkPatientEmail(email: string) {
        const cleanEmail = email.trim().toLowerCase();
        
        const { data: patient } = await supabase
            .from('leads')
            .select('id, first_name, last_name, email')
            .eq('status', 'converted')
            .ilike('email', cleanEmail)
            .maybeSingle();

        return patient;
    },

    async registerCheckin(payload: WifiCheckinPayload) {
        const { error } = await supabase.from('wifi_checkins').insert(payload);
        if (error) {
            console.error('[wifiService] Check-in insertion failed:', error);
            return { success: false, error };
        }
        return { success: true };
    },

    async getCheckins(limit = 200) {
        const { data, error } = await supabase
            .from('wifi_checkins')
            .select('*')
            .order('checkin_at', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error('[wifiService] Error fetching checkins:', error);
            return [];
        }
        return data || [];
    }
};
