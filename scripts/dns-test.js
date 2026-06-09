import dns from 'dns';

const hosts = [
  'shiqfawlgeintqsibqmk.supabase.co',
  'db.shiqfawlgeintqsibqmk.supabase.co'
];

for (const host of hosts) {
  dns.lookup(host, (err, address, family) => {
    if (err) {
      console.error(`Lookup failed for ${host}:`, err.message);
    } else {
      console.log(`Lookup for ${host}: ${address} (IPv${family})`);
    }
  });
}
