package api

import (
	"strings"
	"testing"

	"go-enterprise-scheduler/pkg/models"
)

func TestValidateDAGRejectsInvalidGraphs(t *testing.T) {
	tests := []struct {
		name    string
		tasks   []models.Task
		wantErr string
	}{
		{
			name: "duplicate IDs",
			tasks: []models.Task{
				{ID: "A"},
				{ID: "A"},
			},
			wantErr: "duplicate task ID",
		},
		{
			name: "unknown dependency",
			tasks: []models.Task{
				{ID: "A", Dependencies: []string{"missing"}},
			},
			wantErr: "unknown task",
		},
		{
			name: "duplicate dependency",
			tasks: []models.Task{
				{ID: "A"},
				{ID: "B", Dependencies: []string{"A", "A"}},
			},
			wantErr: "duplicate dependency",
		},
		{
			name: "cycle",
			tasks: []models.Task{
				{ID: "A", Dependencies: []string{"B"}},
				{ID: "B", Dependencies: []string{"A"}},
			},
			wantErr: "no root nodes",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateDAG(tt.tasks)
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("validateDAG() error = %v, want substring %q", err, tt.wantErr)
			}
		})
	}
}

func TestValidateDAGAcceptsValidDiamond(t *testing.T) {
	tasks := []models.Task{
		{ID: "root"},
		{ID: "left", Dependencies: []string{"root"}},
		{ID: "right", Dependencies: []string{"root"}},
		{ID: "merge", Dependencies: []string{"left", "right"}},
	}

	if err := validateDAG(tasks); err != nil {
		t.Fatalf("validateDAG() unexpected error = %v", err)
	}
}
