package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"tinkercraft/internal/core"
)

type Store struct {
	mu    sync.Mutex
	path  string
	state core.State
}

func Open(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	s := &Store{path: filepath.Join(dir, "workspace.json"), state: core.State{Version: 1, Profiles: []core.Profile{}, Settings: core.Settings{PHPBinary: "php"}, Tabs: []core.Tab{}, History: []core.History{}}}
	data, err := os.ReadFile(s.path)
	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	if len(data) > 0 {
		if err := json.Unmarshal(data, &s.state); err != nil {
			return nil, fmt.Errorf("workspace.json inválido; preserve esse arquivo para recuperação: %w", err)
		}
	}
	if s.state.Version != 1 {
		return nil, fmt.Errorf("Versão do workspace não suportada: %d", s.state.Version)
	}
	if s.state.Profiles == nil {
		s.state.Profiles = []core.Profile{}
	}
	if s.state.Tabs == nil {
		s.state.Tabs = []core.Tab{}
	}
	if s.state.History == nil {
		s.state.History = []core.History{}
	}
	return s, nil
}
func (s *Store) Snapshot() core.State {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, _ := json.Marshal(s.state)
	var state core.State
	json.Unmarshal(data, &state)
	return state
}
func (s *Store) Update(fn func(*core.State) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, _ := json.Marshal(s.state)
	var next core.State
	json.Unmarshal(data, &next)
	if err := fn(&next); err != nil {
		return err
	}
	payload, err := json.MarshalIndent(next, "", "  ")
	if err != nil {
		return err
	}
	temp, err := os.CreateTemp(filepath.Dir(s.path), ".workspace-*.json")
	if err != nil {
		return err
	}
	name := temp.Name()
	defer os.Remove(name)
	if _, err = temp.Write(payload); err != nil {
		temp.Close()
		return err
	}
	if err = temp.Sync(); err != nil {
		temp.Close()
		return err
	}
	if err = temp.Close(); err != nil {
		return err
	}
	if err = os.Rename(name, s.path); err != nil {
		return err
	}
	s.state = next
	return nil
}
