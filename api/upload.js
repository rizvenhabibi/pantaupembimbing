// api/upload.js - VERSI PRODUKSI LENGKAP
const { Octokit } = require("@octokit/rest");

module.exports = async (req, res) => {
  // ==================== CORS HEADERS ====================
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  try {
    console.log('🚀 Upload request received');
    
    // ==================== VALIDASI REQUEST ====================
    const { image, filename } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }
    
    // ==================== VALIDASI ENVIRONMENT VARIABLES ====================
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'rizvenhabibi';
    const GITHUB_REPO = process.env.GITHUB_REPO || 'pantaupembimbing';
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
    const GITHUB_FOLDER = process.env.GITHUB_FOLDER || 'uploads';
    
    if (!GITHUB_TOKEN) {
      console.error('❌ GITHUB_TOKEN is not set in environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error: GitHub token not configured' 
      });
    }
    
    // ==================== SETUP OCTOKIT (GitHub API) ====================
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      userAgent: 'Prakerin-Monitoring-App/1.0'
    });
    
    // ==================== GENERATE FILENAME ====================
    const finalFilename = filename || `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const filePath = `${GITHUB_FOLDER}/${finalFilename}`;
    
    console.log(`📁 Uploading to: ${GITHUB_USERNAME}/${GITHUB_REPO}/${filePath}`);
    
    // ==================== UPLOAD KE GITHUB ====================
    const result = await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_USERNAME,
      repo: GITHUB_REPO,
      path: filePath,
      message: `📷 Upload dokumentasi - ${new Date().toLocaleDateString('id-ID')}`,
      content: image, // Base64 string (tanpa data:image/jpeg;base64,)
      branch: GITHUB_BRANCH,
      committer: {
        name: 'Monitoring Prakerin App',
        email: 'noreply@prakerin.app'
      }
    });
    
    // ==================== GENERATE RAW URL ====================
    let rawUrl = result.data.content.download_url;
    
    // Convert GitHub URL to raw URL
    if (rawUrl.includes('github.com') && rawUrl.includes('/blob/')) {
      rawUrl = rawUrl
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
    }
    
    // ==================== RESPONSE SUKSES ====================
    console.log(`✅ Upload successful: ${rawUrl}`);
    
    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully to GitHub',
      data: {
        url: rawUrl,
        githubUrl: result.data.content.html_url,
        filename: finalFilename,
        path: filePath,
        size: Math.round((image.length * 3) / 4), // Approximate size
        uploadDate: new Date().toISOString(),
        viewUrl: `https://github.com/${GITHUB_USERNAME}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${filePath}`
      }
    });
    
  } catch (error) {
    // ==================== ERROR HANDLING ====================
    console.error('❌ Upload error:', error);
    
    let errorMessage = 'Upload failed';
    let statusCode = 500;
    
    // GitHub API specific errors
    if (error.status) {
      statusCode = error.status;
      
      switch (error.status) {
        case 401:
          errorMessage = 'GitHub token invalid or expired';
          break;
        case 403:
          errorMessage = 'Access denied. Check repository permissions';
          break;
        case 404:
          errorMessage = 'Repository not found';
          break;
        case 422:
          errorMessage = 'File already exists or invalid path';
          break;
        default:
          errorMessage = `GitHub API error: ${error.status}`;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};