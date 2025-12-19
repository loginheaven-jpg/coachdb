FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build for production
RUN npm run build:prod

# Expose port (Railway provides PORT env var)
EXPOSE 3000

# Serve built files with Railway PORT env var
# Using shell form to enable environment variable expansion
CMD ["sh", "-c", "npx serve -s dist -l ${PORT:-3000}"]
