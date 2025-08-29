// server.js (Updated for Vercel Deployment)
require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const cors = require('cors');
const stream = require('stream');
const fs = require('fs').promises;
const path = require('path');

const app = express();

// --- Configuration ---
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// --- CORS Configuration ---
// Allow requests from our production frontend and local development environment
const allowedOrigins = ['https://pixelwalls.vercel.app', 'http://localhost:5173'];
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));


app.use(express.json());

// --- Google Drive Authentication ---
async function authorizeAndSetupDrive() {
  try {
    // In production (Vercel), read credentials from environment variables
    const credentialsStr = process.env.GOOGLE_CREDENTIALS_JSON;
    const tokenStr = process.env.GOOGLE_TOKEN_JSON;

    if (!credentialsStr || !tokenStr) {
      throw new Error("Missing Google credentials in environment variables.");
    }

    const credentials = JSON.parse(credentialsStr);
    const token = JSON.parse(tokenStr);

    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(token);

    // This is a simple server, so we don't need to handle token refresh saving for now.
    // Vercel's environment variables will be used on each cold start.

    return google.drive({ version: 'v3', auth: oAuth2Client });
  } catch (error) {
    console.error('CRITICAL: Failed to authorize Google Drive client.');
    console.error(error.message);
    return null; // Return null on failure
  }
}

// Set up Multer
const upload = multer({ storage: multer.memoryStorage() });
const VALID_CATEGORIES = ['Abstract', 'Pastel', 'Minimalist', 'Interiors'];

// --- API Router and Initialization Middleware ---
const apiRouter = express.Router();

apiRouter.post('/upload', upload.single('image'), async (req, res) => {
  const drive = req.app.locals.drive;
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

apiRouter.get('/wallpapers', async (req, res) => {
    const drive = req.app.locals.drive;
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

// Middleware to initialize the Google Drive client on the first request (cold start)
const initializeDriveClient = async (req, res, next) => {
    if (app.locals.drive) {
        return next();
    }
    console.log("Initializing Google Drive client for the first time...");
    const driveClient = await authorizeAndSetupDrive();
    if (driveClient) {
        app.locals.drive = driveClient;
        console.log("Initialization successful.");
        next();
    } else {
        res.status(503).json({ error: 'Failed to initialize backend service. Check server logs.' });
    }
};

// Use the initializer middleware for all API routes
app.use('/api', initializeDriveClient, apiRouter);

// Export the app for Vercel's serverless environment
module.exports = app;
