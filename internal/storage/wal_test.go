package storage

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"go-enterprise-scheduler/pkg/models"
)

func TestRecoverTruncatesCorruptTailAndTracksState(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wal.json")
	wal, err := NewWAL(path)
	if err != nil {
		t.Fatalf("NewWAL: %v", err)
	}
	defer wal.Close()

	tasks := []models.Task{{ID: "a"}, {ID: "b"}}
	if err := wal.AppendIngest(tasks); err != nil {
		t.Fatalf("AppendIngest: %v", err)
	}
	if err := wal.AppendStart("a"); err != nil {
		t.Fatalf("AppendStart: %v", err)
	}
	if err := wal.AppendComplete("a"); err != nil {
		t.Fatalf("AppendComplete: %v", err)
	}
	if err := wal.AppendStart("b"); err != nil {
		t.Fatalf("AppendStart: %v", err)
	}

	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		t.Fatalf("open append handle: %v", err)
	}
	if _, err := f.WriteString(`not-json-tail`); err != nil {
		t.Fatalf("write corrupt tail: %v", err)
	}
	if err := f.Close(); err != nil {
		t.Fatalf("close append handle: %v", err)
	}

	state, err := wal.Recover()
	if err != nil {
		t.Fatalf("Recover: %v", err)
	}
	if len(state.Entries) != 4 {
		t.Fatalf("expected 4 recovered entries, got %d", len(state.Entries))
	}
	if !state.CompletedTasks["a"] {
		t.Fatalf("expected task a completed")
	}
	if !state.InProgressTasks["b"] {
		t.Fatalf("expected task b in progress")
	}
	if state.InProgressTasks["a"] {
		t.Fatalf("did not expect completed task a to remain in progress")
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if bytes.Contains(data, []byte(`not-json-tail`)) {
		t.Fatalf("corrupt WAL tail was not truncated: %q", string(data))
	}

	if err := wal.AppendFail("b"); err != nil {
		t.Fatalf("AppendFail after recovery: %v", err)
	}
	data, err = os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile after append: %v", err)
	}
	if !bytes.Contains(data, []byte(`"task_id":"b"`)) {
		t.Fatalf("expected recovered append handle to write at WAL end: %q", string(data))
	}
}
