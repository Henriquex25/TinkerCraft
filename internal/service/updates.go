package service

import (
	"path/filepath"
	"tinkercraft/internal/buildinfo"
	"tinkercraft/internal/updates"
)

func (s *Service) UpdateSource() string {
	return buildinfo.Current().ReleaseSource
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
