# syntax=docker/dockerfile:1
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Port 25 is privileged; allow the unprivileged node user to bind it.
RUN apt-get update && apt-get install -y --no-install-recommends libcap2-bin \
  && setcap 'cap_net_bind_service=+ep' "$(readlink -f "$(command -v node)")" \
  && apt-get purge -y libcap2-bin && apt-get autoremove -y && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /tmp/inkwell-relay && chown node:node /tmp/inkwell-relay
USER node
EXPOSE 25 8080
CMD ["node", "dist/index.js"]
