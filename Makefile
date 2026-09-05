.PHONY: dev-up dev-down dev-logs compose-config

# Start the local PostGIS database and placeholder services.
dev-up:
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
