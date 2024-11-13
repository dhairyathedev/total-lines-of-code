FROM node:18-alpine

# Install git and other dependencies needed for line counting
RUN apk add --no-cache git

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "index.js"] 