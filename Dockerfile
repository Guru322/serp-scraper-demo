# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /app

COPY package*.json ./

# Use 'npm ci' for faster, more reliable installs
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD [ "npm", "start" ]
