# Deployment Guide

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp config.example.env .env
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Test the API:**
   ```bash
   npm run test-api
   ```

## Production Deployment

### Using Docker

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY src ./src
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build and run:**
   ```bash
   docker build -t bookio-webhook-api .
   docker run -p 3000:3000 --env-file .env bookio-webhook-api
   ```

### Using Google Cloud Run

1. **Create cloudbuild.yaml:**
   ```yaml
   steps:
   - name: 'gcr.io/cloud-builders/docker'
     args: ['build', '-t', 'gcr.io/$PROJECT_ID/bookio-webhook-api', '.']
   - name: 'gcr.io/cloud-builders/docker'
     args: ['push', 'gcr.io/$PROJECT_ID/bookio-webhook-api']
   - name: 'gcr.io/cloud-builders/gcloud'
     args: ['run', 'deploy', 'bookio-webhook-api', '--image', 'gcr.io/$PROJECT_ID/bookio-webhook-api', '--platform', 'managed', '--region', 'us-central1']
   ```

2. **Deploy:**
   ```bash
   gcloud builds submit --config cloudbuild.yaml
   ```

### Environment Variables for Production

Make sure to set these environment variables in your production environment:

- `BOOKIO_FACILITY_ID` - Your Bookio facility ID
- `BOOKIO_BASE_URL` - Bookio base URL (default: https://services.bookio.com)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Set to "production"
- `RATE_LIMIT_WINDOW_MS` - Rate limiting window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS` - Maximum requests per window

### Health Checks

The API includes a health check endpoint at `/health` that can be used for:
- Load balancer health checks
- Container orchestration health probes
- Monitoring systems

Example health check response:
```json
{
  "status": "OK",
  "timestamp": "2025-08-15T10:03:14.000Z",
  "service": "Bookio Webhook API"
}
```

### Monitoring

Consider implementing:
- Application monitoring (e.g., New Relic, DataDog)
- Log aggregation (e.g., ELK stack, Google Cloud Logging)
- Error tracking (e.g., Sentry)
- Uptime monitoring (e.g., Pingdom, StatusCake)

### Security Considerations

- Use HTTPS in production
- Set up proper CORS policies
- Configure rate limiting based on your needs
- Use environment variables for sensitive configuration
- Keep dependencies updated
- Consider implementing API authentication for webhook endpoints
