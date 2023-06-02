const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.ACCESS_KEY_SECRET
  }
});

const bucketName = process.env.BUCKET_NAME;

const router = express.Router();
const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB size limit
  }
});

// Rate limiting configuration
const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute for file uploads
});


router.post('/', uploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const file = req.file;

  if (file.size === 0) {
    return res.status(400).json({ error: 'Empty file provided' });
  }

  // Perform additional file validation checks here
  // For example, check file type, size limits, or perform custom validations

// Example: File type validation (allow mod files only)
const allowedFileExtensions = ['.zip', '.pack', '.dll'];
const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
if (!allowedFileExtensions.includes(fileExtension)) {
  return res.status(400).json({ error: 'Invalid file type. Only .zip, .pack, and .dll files are allowed' });
}


  // Example: File size validation (limit to 10MB)
  const maxSizeBytes = 10 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return res.status(400).json({ error: 'File size exceeds the maximum limit of 10MB' });
  }

  const uniqueId = uuidv4();
  const filename = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
  const s3Key = `${uniqueId}/${filename}`;

  const uploadParams = {
    Bucket: bucketName,
    Key: s3Key,
    Body: file.buffer
  };

  try {
    const response = await s3Client.send(new PutObjectCommand(uploadParams));
    console.log('File uploaded successfully:', response);
    return res.status(200).json({ uniqueId, filename });
  } catch (err) {
    console.error('Error uploading file:', err);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
});

module.exports = router;
