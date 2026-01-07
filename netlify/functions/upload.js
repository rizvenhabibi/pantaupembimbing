const { Octokit } = require("@octokit/rest");

export const handler = async (event, context) => {
  // ==================== CORS HEADERS ====================
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight (OPTIONS)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Hanya izinkan POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' })
    };
  }

  try {
    console.log('🚀 Upload request received (Netlify)');

    // ==================== VALIDASI & PARSING REQUEST ====================
    // Netlify mengirim body dalam bentuk string, kita perlu mem-parse-nya
    const body = JSON.parse(event.body || '{}');
    const { image, filename } = body;

    if (!image) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image data provided' })
      };
    }

    // ==================== VALIDASI ENVIRONMENT VARIABLES ====================
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

    // ==================== SETUP OCTOKIT ====================
    const octokit = new Octokit({
      auth: GITHUB_TOKEN,
      userAgent: 'Prakerin-Monitoring-App/1.0'
    });

    const finalFilename = filename || `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const filePath = `${GITHUB_FOLDER}/${finalFilename}`;

    console.log(`📁 Uploading to: ${GITHUB_USERNAME}/${GITHUB_REPO}/${filePath}`);

    // ==================== UPLOAD KE GITHUB ====================
    const result = await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_USERNAME,
      repo: GITHUB_REPO,
      path: filePath,
      message: `📷 Upload dokumentasi - ${new Date().toLocaleDateString('id-ID')}`,
      content: image, // Base64 string
      branch: GITHUB_BRANCH,
      committer: {
        name: 'Monitoring Prakerin App',
        email: 'noreply@prakerin.app'
      }
    });

    let rawUrl = result.data.content.download_url;

    // ==================== RESPONSE SUKSES ====================
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Image uploaded successfully to GitHub',
        data: {
          url: rawUrl,
          githubUrl: result.data.content.html_url,
          filename: finalFilename,
          path: filePath,
          size: Math.round((image.length * 3) / 4),
          uploadDate: new Date().toISOString(),
          viewUrl: `https://github.com/${GITHUB_USERNAME}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${filePath}`
        }
      })
    };

  } catch (error) {
    console.error('❌ Upload error:', error);
    
    let statusCode = error.status || 500;
    let errorMessage = error.message || 'Upload failed';

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage
      })
    };
  }
};
