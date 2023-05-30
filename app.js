const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const uploadRouter = require('./upload');
const contentRouter = require('./content');

const app = express();

// Enable CORS
app.use(cors());

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute
});

// Apply the rate limiter to all requests
app.use(limiter);

// Mount the file upload router
app.use('/upload', uploadRouter);
app.use('/content', contentRouter);

app.get('/healthz', (req, res) => {
  res.send('OK');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
