FROM node:23-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Expose port and start
EXPOSE 3000
CMD [ "node", "server/index.js" ]