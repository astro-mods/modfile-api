const express = require('express');
const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
  region: process.env.AWS_REGION, // Replace with your AWS region
  accessKeyId: process.env.ACCESS_KEY_ID, // Replace with your AWS access key ID
  secretAccessKey: process.env.ACCESS_KEY_SECRET // Replace with your AWS secret access key
});

const bucketName = process.env.BUCKET_NAME;

const router = express.Router();

router.get('/:uniqueId/:filename', (req, res) => {
  const { uniqueId, filename } = req.params;

  // Construct the S3 object key using the unique ID and filename
  const s3Key = `${uniqueId}/${filename}`;

  const downloadParams = {
    Bucket: bucketName,
    Key: s3Key
  };

  s3.getObject(downloadParams, (err, data) => {
    if (err) {
      console.error('Error downloading file:', err);
      return res.status(500).json({ error: 'Failed to download file' });
    }

    console.log('File downloaded successfully!');
    res.setHeader('Content-Type', data.ContentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(data.Body);
  });
});

module.exports = router;
