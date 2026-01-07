// netlify/functions/upload.js
const { Octokit } = require("@octokit/rest");

exports.handler = async (event, context) => {
  // === 1. HANDLE CORS & PREFLIGHT ===
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' })
    };
  }

  try {
    console.log('🚀 Upload request received (Netlify)');

    // === 2. PARSE REQUEST ===
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    let { image, filename } = body;

    if (!image) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image data provided' })
      };
    }

    // === 3. VALIDASI & EKSTRAKSI BASE64 ===
    // **Perbaikan penting:** Hilangkan 'data:image/...;base64,' prefix jika ada
    let base64Data;
    if (image.startsWith('data:image/')) {
      base64Data = image.split(',')[1];
    } else {
      base64Data = image;
    }

    // === 4. LOAD ENV VARS ===
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'rizvenhabibi';
    const GITHUB_REPO = process.env.GITHUB_REPO || 'pantaupembimbing';
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
    const GITHUB_FOLDER = process.env.GITHUB_FOLDER || 'uploads';

    if (!GITHUB_TOKEN) {
      console.error('❌ GITHUB_TOKEN is not set');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error: GitHub token not configured' })
      };
    }

    // === 5. SETUP & UPLOAD KE GITHUB ===
    const octokit = new Octokit({ auth: GITHUB_TOKEN });
    const finalFilename = filename || `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const filePath = `${GITHUB_FOLDER}/${finalFilename}`;

    console.log(`📁 Uploading to: ${GITHUB_USERNAME}/${GITHUB_REPO}/${filePath}`);

    const result = await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_USERNAME,
      repo: GITHUB_REPO,
      path: filePath,
      message: `📷 Upload dokumentasi - ${new Date().toLocaleDateString('id-ID')}`,
      content: base64Data, // Gunakan base64Data yang sudah dibersihkan
      branch: GITHUB_BRANCH,
      committer: {
        name: 'Monitoring Prakerin App',
        email: 'noreply@prakerin.app'
      }
    });

    // === 6. BUILD RESPONSE URL ===
    // GitHub API tidak selalu konsisten memberikan download_url, lebih baik buat sendiri
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;

    // === 7. RETURN SUCCESS ===
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Image uploaded successfully to GitHub',
        data: {
          url: rawUrl, // Gunakan URL yang kita buat
          githubUrl: `https://github.com/${GITHUB_USERNAME}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${filePath}`,
          rawUrl: rawUrl,
          filename: finalFilename,
          path: filePath,
          size: Math.round((base64Data.length * 3) / 4),
          uploadDate: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('❌ Upload error:', error);

    return {
      statusCode: error.status || 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Upload failed'
      })
    };
  }
};