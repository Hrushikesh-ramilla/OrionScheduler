package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthorizedAdminDemoRequestRequiresConfiguredToken(t *testing.T) {
	t.Setenv("ADMIN_TOKEN", "demo-secret")

	req := httptest.NewRequest(http.MethodPost, "/admin/simulate-crash", nil)
	rr := httptest.NewRecorder()
	if authorizedAdminDemoRequest(rr, req) {
		t.Fatal("request without token was authorized")
	}
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}

	req = httptest.NewRequest(http.MethodPost, "/admin/simulate-crash", nil)
	req.Header.Set("X-Orion-Admin-Token", "demo-secret")
	rr = httptest.NewRecorder()
	if !authorizedAdminDemoRequest(rr, req) {
		t.Fatal("request with token was rejected")
	}
}

func TestAuthorizedAdminDemoRequestAllowsUnsetTokenForLocalDev(t *testing.T) {
	t.Setenv("ADMIN_TOKEN", "")

	req := httptest.NewRequest(http.MethodPost, "/admin/simulate-crash", nil)
	rr := httptest.NewRecorder()
	if !authorizedAdminDemoRequest(rr, req) {
		t.Fatal("request was rejected when ADMIN_TOKEN is unset")
	}
}
