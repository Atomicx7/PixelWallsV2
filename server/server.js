// server.js (Updated for OAuth 2.0 with Personal Accounts)
require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const cors = require('cors');
const stream = require('stream');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// --- Configuration ---
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const CREDENTIALS_PATH = path.join(__dirname, 'oauth-credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Middleware
app.use(cors());
app.use(express.json());

// --- Google Drive Authentication ---
let drive;

async function authorizeAndSetupDrive() {
  try {
    const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    const token = JSON.parse(await fs.readFile(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    
    // Auto-refresh the token if it's expired
    oAuth2Client.on('tokens', (newTokens) => {
        if (newTokens.refresh_token) {
            // A new refresh token might be issued, save it.
            token.refresh_token = newTokens.refresh_token;
        }
        token.access_token = newTokens.access_token;
        token.expiry_date = newTokens.expiry_date;
        fs.writeFile(TOKEN_PATH, JSON.stringify(token));
        console.log('Token refreshed and saved.');
    });

    drive = google.drive({ version: 'v3', auth: oAuth2Client });
    console.log('Google Drive client is authorized and ready.');
    return true;
  } catch (error) {
    console.error('CRITICAL: Failed to authorize Google Drive client.');
    console.error('Have you run `node generate-token.js` successfully?');
    console.error(error.message);
    return false;
  }
}


// Set up Multer
const upload = multer({ storage: multer.memoryStorage() });
const VALID_CATEGORIES = ['Abstract', 'Pastel', 'Minimalist', 'Interiors'];

// --- API Routes ---

app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!drive) return res.status(503).json({ error: 'Drive service is not available.' });
  
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const { buffer, mimetype } = req.file;
    const { alt, author, category } = req.body;

    if (!alt || !author || !category) return res.status(400).json({ error: 'Missing required fields.' });
    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category.' });
    if (!mimetype.startsWith('image/')) return res.status(400).json({ error: 'File must be an image.' });

    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    const { data: { id: fileId } } = await drive.files.create({
      media: { mimeType: mimetype, body: bufferStream },
      requestBody: {
        name: alt,
        parents: [FOLDER_ID],
        appProperties: { author, category, alt },
      },
      fields: 'id',
    });

    await drive.permissions.create({
      fileId: fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    const file = await drive.files.get({
      fileId: fileId,
      fields: 'imageMediaMetadata',
    });

    res.status(201).json({
      id: fileId,
      url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w2048`,
      alt, author, category,
      width: file.data.imageMediaMetadata?.width || 1920,
      height: file.data.imageMediaMetadata?.height || 1080,
    });
  } catch (error) {
    console.error('Error uploading to Google Drive:', error.response ? error.response.data : error);
    res.status(500).json({ error: 'Error uploading file.', details: error.message });
  }
});

app.get('/api/wallpapers', async (req, res) => {
    if (!drive) return res.status(503).json({ error: 'Drive service is not available.' });

    try {
        const response = await drive.files.list({
            q: `'${FOLDER_ID}' in parents and trashed=false`,
            fields: 'files(id, name, appProperties, imageMediaMetadata)',
        });
        
        const wallpapers = response.data.files
            .filter(file => file.appProperties?.category && VALID_CATEGORIES.includes(file.appProperties.category))
            .map(file => ({
                id: file.id,
                url: `https://drive.google.com/thumbnail?id=${file.id}&sz=w2048`,
                alt: file.appProperties?.alt || file.name,
                author: file.appProperties?.author || 'Unknown',
                category: file.appProperties?.category,
                width: file.imageMediaMetadata?.width || 1920,
                height: file.imageMediaMetadata?.height || 1080,
            }));
        
        res.json(wallpapers);
    } catch (error) {
        console.error('Error fetching from Google Drive:', error.response ? error.response.data : error);
        res.status(500).json({ error: 'Error fetching wallpapers.', details: error.message });
    }
});

// --- Start Server ---
async function startServer() {
  const isAuthorized = await authorizeAndSetupDrive();
  if (isAuthorized) {
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
      if (!FOLDER_ID) {
        console.warn('CRITICAL: GOOGLE_DRIVE_FOLDER_ID is missing from .env file.');
      }
    });
  } else {
    console.error('Could not start server due to authorization failure.');
    process.exit(1);
  }
}

startServer();