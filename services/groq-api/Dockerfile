FROM node:22-alpine AS build
WORKDIR /src
COPY app/api/karaoke/groq/route.ts app/api/karaoke/groq/route.ts
COPY app/lib/karaoke.ts app/lib/karaoke.ts
COPY components/v4/lyrics-clean.ts components/v4/lyrics-clean.ts
COPY services/groq-api services/groq-api
RUN node services/groq-api/build.mjs
FROM node:22-alpine
ENV NODE_ENV=production PORT=8021
WORKDIR /app
COPY --from=build /src/services/groq-api/dist ./dist
COPY services/groq-api/server.mjs ./server.mjs
USER node
EXPOSE 8021
CMD ["node", "--max-old-space-size=96", "server.mjs"]
