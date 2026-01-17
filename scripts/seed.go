package main

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
)

const dagPayload = `[
	{"id": "%s-1", "payload": "sleep 1"},
	{"id": "%s-2", "payload": "sleep 2", "dependencies": ["%s-1"]},
	{"id": "%s-3", "payload": "sleep 1", "dependencies": ["%s-1"]},
	{"id": "%s-4", "payload": "sleep 1", "dependencies": ["%s-2", "%s-3"]}
]`

func main() {
	apiURL := os.Getenv("API_URL")
	if apiURL == "" {
		apiURL = "http://localhost:8080"
	}

	for i := 0; i < 5; i++ {
		prefix := uuid.New().String()[:8]
		payload := fmt.Sprintf(dagPayload, prefix, prefix, prefix, prefix, prefix, prefix, prefix, prefix)
		
		req, _ := http.NewRequest("POST", apiURL+"/api/v1/dag", bytes.NewBuffer([]byte(payload)))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Idempotency-Key", uuid.New().String())

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			log.Fatalf("Failed to seed: %v", err)
		}
		resp.Body.Close()

		if resp.StatusCode != http.StatusCreated {
			log.Printf("Warning: received status %d", resp.StatusCode)
		} else {
			log.Printf("Successfully seeded DAG #%d", i+1)
		}
		
		time.Sleep(500 * time.Millisecond)
	}
	
	log.Println("Seeding complete.")
}
