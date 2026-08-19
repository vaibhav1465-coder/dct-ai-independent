FROM node:22-alpine AS build
WORKDIR /app
ENV DATABASE_URL=postgresql://dct:dct@127.0.0.1:5432/dct
ENV NEXTAUTH_SECRET=container-build-placeholder
ENV GOOGLE_CLIENT_ID=container-build-placeholder
ENV GOOGLE_CLIENT_SECRET=container-build-placeholder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm","run","start"]
