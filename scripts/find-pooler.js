import pg from 'pg';
const { Client } = pg;

const regions = [
  'ap-southeast-1', // Singapore
  'ap-southeast-2', // Sydney
  'ap-northeast-1', // Tokyo
  'ap-northeast-2', // Seoul
  'ap-south-1',     // Mumbai
  'us-east-1',      // North Virginia
  'us-east-2',      // Ohio
  'us-west-1',      // Northern California
  'us-west-2',      // Oregon
  'eu-west-1',      // Ireland
  'eu-west-2',      // London
  'eu-west-3',      // Paris
  'eu-central-1',   // Frankfurt
  'eu-central-2',   // Zurich
  'eu-north-1',     // Stockholm
  'sa-east-1',      // São Paulo
  'ca-central-1'    // Canada
];

async function findRegion() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    console.log(`Trying region ${region} (${host})...`);
    
    const client = new Client({
      host,
      port: 6543,
      user: 'postgres.shiqfawlgeintqsibqmk',
      password: 'VBu0X4sXFksn9du5',
      database: 'postgres',
      connectionTimeoutMillis: 5000,
      ssl: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      console.log(`\n🎉 SUCCESS! Connected to region: ${region}`);
      await client.end();
      return;
    } catch (err) {
      if (err.message.includes('tenant/user') && err.message.includes('not found')) {
        // Expected for incorrect regions
        console.log(`❌ Tenant not found in ${region}`);
      } else {
        console.log(`❌ Other error in ${region}:`, err.message);
      }
    }
  }
  console.log('\nCould not find the correct region among the list.');
}

findRegion();
