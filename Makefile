.PHONY: dev-build dev-up dev-down dev-logs compose-config

# Build (or rebuild) the api + frontend Docker images without starting containers.
dev-build:
	docker compose -f deploy/compose/docker-compose.yml build

# Build the images, then start the local PostGIS database, Rust API, and
# Vite/nginx frontend in detached mode.
dev-up: dev-build
	docker compose -f deploy/compose/docker-compose.yml up -d

# Stop local services without removing the database volume.
dev-down:
	docker compose -f deploy/compose/docker-compose.yml down

# Follow local service logs.
dev-logs:
	docker compose -f deploy/compose/docker-compose.yml logs -f

# Validate Compose interpolation and structure without starting services.
compose-config:
	docker compose -f deploy/compose/docker-compose.yml config
