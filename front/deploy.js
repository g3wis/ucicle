const mime = require('mime');
const fs = require('fs');
const zlib = require('zlib');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const BUILD_PATH = './build';

for (const name of ['ACCESS_KEY', 'SECRET_KEY', 'DOMAIN', 'BUCKET_NAME']) {
  if (!process.env[name]) {
    console.error(`${name} environment variable not defined`);
    process.exit(1);
  }
}

const client = new S3Client({
  region: process.env.REGION || 'fr-par',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
  },
  endpoint: `https://${process.env.DOMAIN}`,
});

// index.html must always be revalidated so a deploy is picked up at once;
// Vite's hashed bundles never change and can be cached forever.
const cacheControl = (key) => {
  if (key.endsWith('.html')) return 'no-cache';
  if (/-[0-9a-f]{8}\.[a-z0-9]+$/.test(key)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
};

// The bucket serves files as stored: text is stored gzipped and served with
// Content-Encoding: gzip. Fonts (woff2) and images are already compressed.
const COMPRESSIBLE = /\.(js|css|html|svg|json|txt|xml)$/;

const upload = async (filename) => {
  const raw = fs.readFileSync(filename);
  const key = filename.replace(`${BUILD_PATH}/`, '');
  const gzip = COMPRESSIBLE.test(key);
  const content = gzip ? zlib.gzipSync(raw, { level: 9 }) : raw;

  await client.send(new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
    Body: content,
    ACL: 'public-read',
    StorageClass: 'ONEZONE_IA',
    ContentType: mime.getType(filename) || 'application/octet-stream',
    CacheControl: cacheControl(key),
    ContentLength: content.length,
    ...(gzip ? { ContentEncoding: 'gzip' } : {}),
  }));
  console.log(`Uploaded ${key}`);
};

function listBuiltFiles(path) {
  return fs.readdirSync(path).flatMap((element) => {
    const elementPath = `${path}/${element}`;
    return fs.statSync(elementPath).isDirectory() ? listBuiltFiles(elementPath) : [elementPath];
  });
}

async function main() {
  // index.html goes last: it must never reference a bundle that is not uploaded yet.
  const files = listBuiltFiles(BUILD_PATH);
  const assets = files.filter((file) => !file.endsWith('/index.html'));
  const pages = files.filter((file) => file.endsWith('/index.html'));

  let failures = 0;
  for (const batch of [assets, pages]) {
    const results = await Promise.allSettled(batch.map(upload));
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        failures += 1;
        console.error(`Error while uploading ${batch[i]}: ${result.reason}`);
      }
    });
    if (failures) break;
  }

  if (failures) {
    console.error(`${failures} file(s) failed to upload`);
    process.exit(1);
  }
  console.log(`Deployed ${files.length} files to ${process.env.BUCKET_NAME}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
