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

# Expose port (serve uses 3000 by default)
EXPOSE 3000

# Serve built files (serve uses PORT env var automatically)
CMD ["npx", "serve", "-s", "dist"]
