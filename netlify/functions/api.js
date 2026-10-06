const serverless = require('serverless-http');
const app = require('../../server');

const serverlessHandler = serverless(app);

exports.handler = async (event, context) => {
  // Normalize paths so Express routes like /api/leads match cleanly
  if (event.path && event.path.startsWith('/.netlify/functions/api')) {
    event.path = event.path.replace('/.netlify/functions/api', '/api');
  }
  return await serverlessHandler(event, context);
};
