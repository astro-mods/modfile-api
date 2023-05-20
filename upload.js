const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
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
const upload = multer();

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const file = req.file;

  if (file.size === 0) {
    return res.status(400).json({ error: 'Empty file provided' });
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
