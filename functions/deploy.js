import { dirname } from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import fs from 'fs';
import axios from 'axios';

const SCRIPT_DIR_NAME = dirname(fileURLToPath(import.meta.url));
const FUNCTION_ARCHIVE = 'functions.zip';
const FUNCTION_ID = process.env.FUNCTION_ID;
const REGION = process.env.REGION;
const FUNCTION_API = `https://api.scaleway.com/functions/v1beta1/regions/${REGION}/functions/${FUNCTION_ID}`;
const AUTH_HEADERS = { 'X-Auth-Token': process.env.SECRET_KEY };

function createArchive() {
  const zip = AdmZip();
  zip.addLocalFolder(`${SCRIPT_DIR_NAME}/build/`, 'build');
  zip.addLocalFolder(`${SCRIPT_DIR_NAME}/node_modules/`, 'node_modules');
  zip.addLocalFile(`${SCRIPT_DIR_NAME}/package.json`);
  zip.writeZip(`${SCRIPT_DIR_NAME}/${FUNCTION_ARCHIVE}`);
}

async function getUploadLink(zipSize) {
  const response = await axios.get(`${FUNCTION_API}/upload-url?content_length=${zipSize}`, { headers: AUTH_HEADERS });
  return response.data;
}

async function uploadZip(uploadEndpoint) {
  const data = fs.readFileSync(`${SCRIPT_DIR_NAME}/${FUNCTION_ARCHIVE}`);
  await axios.put(uploadEndpoint.url, data, { headers: { ...uploadEndpoint.headers, ...AUTH_HEADERS } });
}

async function deploy() {
  await axios.post(`${FUNCTION_API}/deploy`, {}, { headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS } });
  console.info('Function deployment launched');
}

async function main() {
  if (!FUNCTION_ID || !REGION || !process.env.SECRET_KEY) {
    throw new Error('FUNCTION_ID, REGION and SECRET_KEY environment variables are required');
  }

  createArchive();
  const zipSize = fs.statSync(`${SCRIPT_DIR_NAME}/${FUNCTION_ARCHIVE}`).size;

  const uploadEndpoint = await getUploadLink(zipSize);
  await uploadZip(uploadEndpoint);
  await deploy();
}

main().catch((err) => {
  const details = err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message;
  console.error(`Function deployment failed: ${details}`);
  process.exitCode = 1;
});
