package service

import (
	"os"
	"os/exec"
	"path/filepath"
	"tinkercraft/internal/buildinfo"
	"tinkercraft/internal/updates"
)

func missingPhpactor(path string) bool {
	if path == "" {
		return true
	}
	if filepath.IsAbs(path) {
		_, err := os.Stat(path)
		return os.IsNotExist(err)
	}
	_, err := exec.LookPath(path)
	return err != nil
}
func (s *Service) UpdateSource() string {
	source := s.Store.Snapshot().Settings.UpdateSource
	if source == "" {
		return buildinfo.Current().ReleaseSource
	}
	return source
}
func (s *Service) CheckUpdates() (updates.Info, error) {
	return s.Updates.Check(s.root, s.UpdateSource())
}
func (s *Service) DownloadUpdate() (updates.Download, error) {
	return s.Updates.Download(s.root, filepath.Join(s.Dir, "updates"), s.UpdateSource())
}
func (s *Service) InstallerPackage() (string, error) {
	return s.Updates.InstallerPackage(s.UpdateSource())
}
func (s *Service) UpdateReleasePage() (string, error) { return s.Updates.ReleasePage() }
func (s *Service) BuildInfo() buildinfo.Info          { return buildinfo.Current() }
