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
		return true // Allow all origins; tighten via CORS in production
	},
}

// Hub maintains active WebSocket connections and broadcasts task events.
type Hub struct {
	mu      sync.Mutex
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

// broadcast sends a message to every connected client. Clients that
// fail to receive are removed immediately. Uses a full Mutex because
// gorilla/websocket does not support concurrent writes to a single conn.
func (h *Hub) broadcast(msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	var dead []*websocket.Conn
	for conn := range h.clients {
		if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			slog.Warn("ws write failed, removing client", "error", err)
			conn.Close()
			dead = append(dead, conn)
		}
	}
	for _, conn := range dead {
		delete(h.clients, conn)
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
	if h.clients[conn] {
		delete(h.clients, conn)
		conn.Close()
		slog.Info("ws client disconnected", "total", len(h.clients))
	}
}

// ClientCount returns the number of active WebSocket clients.
func (h *Hub) ClientCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.clients)
}

// HandleWS upgrades an HTTP connection to WebSocket and registers it with the hub.
func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws upgrade failed", "error", err)
		return
	}
	h.addClient(conn)

	// Read loop — we don't expect messages from clients, but we need
	// to read to detect disconnects and process control frames (ping/pong).
	go func() {
		defer h.removeClient(conn)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}()
}
