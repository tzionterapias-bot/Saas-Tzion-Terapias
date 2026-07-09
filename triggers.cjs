
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^['"]|['"]$/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/^['"]|['"]$/g, '');
fetch(url + '/rest/v1/rpc/get_schema', {
  method: 'POST',
  headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }
}).then(r => r.text()).then(t => console.log(t.substring(0,200))).catch(console.error);

