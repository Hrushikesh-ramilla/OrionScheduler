package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"

	"go-enterprise-scheduler/pkg/models"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now, tighten in production
	},
}

// Hub maintains active WebSocket connections and broadcasts events.
type Hub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]bool
}

// NewHub creates a WebSocket hub ready to accept clients.
func NewHub() *Hub {
	return &Hub{
		clients: make(map[*websocket.Conn]bool),
	}
}

// Run reads events from the scheduler's EventChan and broadcasts
// them to all connected WebSocket clients as JSON.
func (h *Hub) Run(eventChan <-chan models.TaskEvent) {
	for event := range eventChan {
		data, err := json.Marshal(event)
		if err != nil {
			slog.Error("failed to marshal event", "error", err)
			continue
		}
		h.broadcast(data)
	}
}

func (h *Hub) broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for conn := range h.clients {
		if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			slog.Warn("ws write failed, removing client", "error", err)
			conn.Close()
			// Mark for removal — can't delete during iteration with RLock
			go h.removeClient(conn)
		}
	}
}

func (h *Hub) addClient(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[conn] = true
	slog.Info("ws client connected", "total", len(h.clients))
}

func (h *Hub) removeClient(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, conn)
	slog.Info("ws client disconnected", "total", len(h.clients))
}

// HandleWS upgrades an HTTP connection to WebSocket and adds it to the hub.
func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws upgrade failed", "error", err)
		return
	}
	h.addClient(conn)

	// Read loop — we don't expect messages from clients, but we need
	// to read to detect disconnects and process control frames.
	go func() {
		defer h.removeClient(conn)
		defer conn.Close()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}()
}
