// Google Drive provider — extracted from the original server.js (kept for compat).
// Env: GOOGLE_DRIVE_FOLDER_ID, GOOGLE_CREDENTIALS_JSON, GOOGLE_TOKEN_JSON
const { google } = require('googleapis');
const stream = require('stream');

const VALID_CATEGORIES_COMPAT = ['Abstract', 'Pastel', 'Minimalist', 'Interiors'];

let driveClient = null;

async function authorize() {
  const credentialsStr = process.env.GOOGLE_CREDENTIALS_JSON;
  const tokenStr = process.env.GOOGLE_TOKEN_JSON;
  if (!credentialsStr || !tokenStr) throw new Error('Missing Google credentials in environment variables.');
  const credentials = JSON.parse(credentialsStr);
  const token = JSON.parse(tokenStr);
  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);
  return google.drive({ version: 'v3', auth: oAuth2Client });
}

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_DRIVE_FOLDER_ID &&
      process.env.GOOGLE_CREDENTIALS_JSON &&
      process.env.GOOGLE_TOKEN_JSON
  );
}

async function getDrive() {
  if (driveClient) return driveClient;
  driveClient = await authorize();
  return driveClient;
}

async function uploadBuffer(buffer, { alt, author, category, mimetype }) {
  const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const drive = await getDrive();
  const bufferStream = new stream.PassThrough();
  bufferStream.end(buffer);
  const { data: { id: fileId } } = await drive.files.create({
    media: { mimeType: mimetype, body: bufferStream },
    requestBody: { name: alt, parents: [FOLDER_ID], appProperties: { author, category, alt } },
    fields: 'id',
  });
  await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } });
  const file = await drive.files.get({ fileId, fields: 'imageMediaMetadata' });
  return {
    id: fileId,
    url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w2048`,
    alt,
    author,
    category,
    width: file.data.imageMediaMetadata?.width || 1920,
    height: file.data.imageMediaMetadata?.height || 1080,
    provider: 'googledrive',
  };
}

async function list() {
  const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const drive = await getDrive();
  const response = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id, name, appProperties, imageMediaMetadata)',
  });
  return response.data.files
    .filter((file) => file.appProperties?.category)
    .map((file) => ({
      id: file.id,
      url: `https://drive.google.com/thumbnail?id=${file.id}&sz=w2048`,
      alt: file.appProperties?.alt || file.name,
      author: file.appProperties?.author || 'Unknown',
      category: file.appProperties?.category,
      width: file.imageMediaMetadata?.width || 1920,
      height: file.imageMediaMetadata?.height || 1080,
      provider: 'googledrive',
    }));
}

module.exports = { name: 'googledrive', isConfigured, uploadBuffer, list };
