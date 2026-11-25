package language

import (
	"encoding/hex"
	"os"
	"path/filepath"
	"time"
)

func (s *Session) touch() {
	if s.home == "" || time.Since(s.touched) < time.Minute {
		return
	}
	now := time.Now()
	if os.Chtimes(s.home, now, now) == nil {
		s.touched = now
	}
}

func (m *Manager) cleanupAnalysis(days int) error {
	if days <= 0 {
		days = 7
	}
	base := filepath.Join(filepath.Dir(m.RuntimeDir), "language-analysis")
	entries, err := os.ReadDir(base)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	keep := map[string]bool{}
	m.mu.Lock()
	for _, session := range m.sessions {
		keep[session.home] = true
	}
	m.mu.Unlock()
	for _, entry := range entries {
		if !entry.IsDir() || entry.Type()&os.ModeSymlink != 0 || len(entry.Name()) != 64 {
			continue
		}
		if _, err := hex.DecodeString(entry.Name()); err != nil {
			continue
		}
		dir := filepath.Join(base, entry.Name())
		if keep[dir] {
			continue
		}
		if info, err := entry.Info(); err == nil && time.Since(info.ModTime()) > time.Duration(days)*24*time.Hour {
			if err := os.RemoveAll(dir); err != nil {
				return err
			}
		}
	}
	return nil
}
