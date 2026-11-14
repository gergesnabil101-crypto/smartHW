# Locust load test for the mosahah-api backend (Cloud Run).
# Public endpoints only — teacher endpoints need Firebase tokens.
# Run headless:
#   locust -f test/load/locustfile.py --headless -u 20 -r 5 -t 60s \
#     --host=https://mosahah-api-609470896445.europe-west1.run.app
from locust import HttpUser, task, between


class StudentUser(HttpUser):
    """Simulates students opening a shared quiz + teachers hitting light endpoints."""

    wait_time = between(0.5, 1.5)

    @task(3)
    def fetch_quiz(self):
        # The heaviest public path: optional-auth → Firestore quiz read.
        with self.client.get("/api/quizzes/load-test-id", catch_response=True) as r:
            if r.status_code in (200, 401, 404):
                r.success()

    @task(2)
    def health(self):
        self.client.get("/api/health")

    @task(1)
    def privacy(self):
        self.client.get("/privacy")
