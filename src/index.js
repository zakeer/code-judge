const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const Joi = require('joi');
const config = require('./config/config');
const workerService = require('./services/workerService');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: config.security.maxCodeSize }));

// Rate limiting
app.use(rateLimit(config.security.rateLimit));

// Request validation schema
const testCaseSchema = Joi.object({
  input: Joi.string().allow('').max(1024).required(),
  output: Joi.string().required().max(1024),
  description: Joi.string().allow('').max(200).default(''),
  id: Joi.string().allow('').max(200).default(''),
  problemId: Joi.string().allow('').max(200).default(''),
  isHidden: Joi.boolean().allow('').default(false),
});

const submissionSchema = Joi.object({
  code: Joi.string().required().max(+config.security.maxCodeSize),
  language: Joi.string().valid(...config.security.allowedLanguages).required(),
  testCases: Joi.array().items(testCaseSchema).min(1).required()
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Code submission endpoint
app.post('/submit', async (req, res) => {
  try {
    console.log('Received request:', req.body); // Log the received request details
    // Validate request
    const { error, value } = submissionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { code, language, testCases } = value;
    const taskId = require('crypto').randomBytes(16).toString('hex');

    // Publish task to queue
    await workerService.channel.sendToQueue(
      config.rabbitmq.queues.execution,
      Buffer.from(JSON.stringify({ taskId, code, language, testCases })),
      { persistent: true }
    );

    res.status(202).json({
      taskId,
      message: 'Code submitted successfully',
      statusUrl: `/status/${taskId}`
    });
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Status check endpoint
app.get('/status/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await workerService.redis.get(`result:${taskId}`);

    if (!result) {
      return res.status(202).json({ status: 'pending' });
    }

    res.status(200).json(JSON.parse(result));
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await workerService.initialize();
    console.log('Worker service initialized');
  } catch (error) {
    console.error('Failed to initialize worker service:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM signal. Initiating graceful shutdown...');
  await workerService.shutdown();
  process.exit(0);
});