import net from 'net';

const CLAMAV_HOST = process.env.CLAMAV_HOST || 'clamav';
const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT || '3310', 10);

function scanBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const chunks = [];

    client.connect(CLAMAV_PORT, CLAMAV_HOST, () => {
      client.write('zINSTREAM\0');
      const sizeBuffer = Buffer.alloc(4);
      sizeBuffer.writeUInt32BE(buffer.length, 0);
      client.write(sizeBuffer);
      client.write(buffer);
      const end = Buffer.alloc(4, 0);
      client.write(end);
    });

    client.on('data', (data) => chunks.push(data));
    client.on('end', () => {
      const response = Buffer.concat(chunks).toString().trim();
      if (response.includes('OK')) {
        resolve({ clean: true, raw: response });
      } else if (response.includes('FOUND')) {
        const virus = response.replace(/^.*stream:\s*/, '').replace(/\s*FOUND$/, '');
        resolve({ clean: false, virus, raw: response });
      } else {
        reject(new Error(`Unexpected ClamAV response: ${response}`));
      }
    });
    client.on('error', (err) => reject(err));

    setTimeout(() => {
      client.destroy();
      reject(new Error('ClamAV scan timeout'));
    }, 30000);
  });
}

export async function scanVirusHandler(req, res) {
  try {
    const { fileBase64, fileName } = req.body;
    if (!fileBase64) return res.status(400).json({ error: 'Missing fileBase64' });

    const buffer = Buffer.from(fileBase64, 'base64');
    const result = await scanBuffer(buffer);

    res.json({ fileName, ...result });
  } catch (err) {
    if (err.message?.includes('ECONNREFUSED')) {
      return res.json({ clean: true, skipped: true, reason: 'ClamAV not available' });
    }
    console.error('[scan-virus] Error:', err.message);
    res.status(500).json({ error: 'Scan failed', details: err.message });
  }
}
