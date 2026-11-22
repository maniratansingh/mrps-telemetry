package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func contentType(name string) string {
	switch {
	case name == "Packages", name == "Release", name == "InRelease":
		return "text/plain; charset=utf-8"
	case strings.HasSuffix(name, ".deb"):
		return "application/vnd.debian.binary-package"
	case strings.HasSuffix(name, ".gz"):
		return "application/gzip"
	case strings.HasSuffix(name, ".xz"):
		return "application/x-xz"
	case strings.HasSuffix(name, ".asc"):
		return "text/plain; charset=utf-8"
	case strings.HasSuffix(name, ".gpg"):
		return "application/pgp-signature"
	default:
		return "application/octet-stream"
	}
}

func main() {
	port := env("PORT", "8090")
	root, err := filepath.Abs(env("ROOT", filepath.Join(os.Getenv("HOME"), "apt-repo")))
	if err != nil {
		log.Fatal(err)
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		clean := filepath.Clean("/" + r.URL.Path)
		full := filepath.Join(root, strings.TrimPrefix(clean, "/"))

		info, err := os.Stat(full)
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}

		cache := "no-cache"
		if strings.HasPrefix(clean, "/pool/") {
			cache = "public, max-age=31536000, immutable"
		}

		w.Header().Set("Content-Type", contentType(info.Name()))
		w.Header().Set("Cache-Control", cache)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		http.ServeFile(w, r, full)
	})

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("[apt-repo] http://0.0.0.0:%s -> %s", port, root)
	log.Fatal(server.ListenAndServe())
}
