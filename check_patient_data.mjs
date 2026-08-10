import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPatientData() {
    // Get a patient with appointments or anything
    const { data: patient, error: patientError } = await supabase.from('patients').select('*').limit(5);
    
    for (const p of patient) {
        console.log(`Checking patient ${p.name}`);
        const [appRes, recRes, evoRes, payRes, packRes, conRes] = await Promise.all([
            supabase.from('appointments').select('*, therapists(name)').eq('patient_id', p.id),
            supabase.from('medical_records').select('*, therapists(name)').eq('patient_id', p.id),
            supabase.from('patient_evolutions').select('*, therapists(name)').eq('patient_id', p.id),
            supabase.from('payments').select('*').eq('patient_id', p.id).order('created_at', { ascending: false }),
            supabase.from('patient_packages').select('*, services(name, price, type)').eq('patient_id', p.id),
            supabase.from('patient_contracts').select('*').eq('patient_id', p.id).order('created_at', { ascending: false })
          ]);
          
          console.log(`Appointments:`, appRes.data?.length);
          appRes.data?.forEach(a => console.log('App:', a.start_time, new Date(a.start_time)));
          
          console.log(`Payments:`, payRes.data?.length);
          payRes.data?.forEach(p => console.log('Pay amount:', p.amount, typeof p.amount));
    }
}
checkPatientData();
