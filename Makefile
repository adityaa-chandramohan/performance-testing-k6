.PHONY: up down run logs clean ps

# Bring up Prometheus + Grafana + API (without running k6)
up:
	docker compose up -d api prometheus cadvisor grafana
	@echo ""
	@echo "  Grafana  → http://localhost:3001  (pre-loaded dashboard)"
	@echo "  Prometheus → http://localhost:9090"
	@echo "  API      → http://localhost:3000"
	@echo "  cAdvisor → http://localhost:8080"
	@echo ""
	@echo "  Run the k6 test with: make run"

# Run k6 load test (pushes metrics to Prometheus in real time)
run:
	docker compose run --rm k6

# Run k6 test against a custom URL (e.g. make run-local BASE_URL=http://host.docker.internal:3000)
run-local:
	BASE_URL=$(BASE_URL) docker compose run --rm k6

# Show running containers
ps:
	docker compose ps

# Tail logs for all services (or a specific one: make logs s=api)
logs:
	docker compose logs -f $(s)

# Stop and remove containers (keeps volumes)
down:
	docker compose down

# Full reset — remove containers AND named volumes
clean:
	docker compose down -v
	@echo "Volumes removed."
