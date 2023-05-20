const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
require('dotenv').config();

const s3Client = new S3Client({
  region: 'us-east-1', // Replace with your AWS region
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID, // Replace with your AWS access key ID
    secretAccessKey: process.env.ACCESS_KEY_SECRET // Replace with your AWS secret access key
  }
});

const bucketName = 'modlist-data-bucket';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const file = req.file;

  // Generate a unique ID for the file
  const uniqueId = uuidv4();

  // Secure the filename
  const filename = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');

  // Construct the S3 object key using the generated ID and filename
  const s3Key = `${uniqueId}/${filename}`;

  const uploadParams = {
    Bucket: bucketName,
    Key: s3Key,
    Body: file.buffer
  };

  try {
    await s3Client.send(new PutObjectCommand(uploadParams));
    console.log('File uploaded successfully!');

    // Delete the temporary file after upload
    fs.unlink(file.path, (error) => {
      if (error) {
        console.error('Error deleting temporary file:', error);
      }
    });

    return res.status(200).json({ uniqueId, filename });
  } catch (err) {
    console.error('Error uploading file:', err);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
});

module.exports = router;
