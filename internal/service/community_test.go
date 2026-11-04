package service

import (
	"testing"
	"tinkercraft/internal/core"
	"tinkercraft/internal/storage"
)

func TestSupportInvitationEligibilityAtStartup(t *testing.T) {
	for _, tc := range []struct {
		name                                         string
		launches                                     int
		used, starDismissed, donationDismissed, want bool
	}{
		{"new user", 0, false, false, false, false},
		{"too early", 3, true, true, false, false},
		{"fifth launch", 4, true, true, false, true},
		{"no execution yet", 4, false, true, false, false},
		{"star invitation pending", 4, true, false, false, false},
		{"donation already dismissed", 4, true, true, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			store, err := storage.Open(dir)
			if err != nil {
				t.Fatal(err)
			}
			if err := store.Update(func(state *core.State) error {
				state.LaunchCount = tc.launches
				state.Settings.StarPromptDismissed = tc.starDismissed
				state.Settings.DonationPromptDismissed = tc.donationDismissed
				if tc.used {
					state.History = []core.History{{ID: "fixture", Code: "42;", Success: true}}
				}
				return nil
			}); err != nil {
				t.Fatal(err)
			}
			svc, err := New(dir)
			if err != nil {
				t.Fatal(err)
			}
			defer svc.Close()
			for range 3 {
				state := svc.Bootstrap()
				if state.SuggestSupport != tc.want {
					t.Fatalf("invitation = %v, want %v", state.SuggestSupport, tc.want)
				}
				if state.LaunchCount != min(5, tc.launches+1) {
					t.Fatal("Bootstrap counted as another application launch")
				}
			}
			if err := svc.DismissStarPrompt(); err != nil {
				t.Fatal(err)
			}
			if !tc.starDismissed && svc.Bootstrap().SuggestSupport {
				t.Fatal("two invitations appeared in the same session")
			}
			stale := svc.Bootstrap().Settings
			if err := svc.DismissDonationPrompt(); err != nil {
				t.Fatal(err)
			}
			if err := svc.SaveSettings(stale); err != nil {
				t.Fatal(err)
			}
			if !svc.Bootstrap().Settings.DonationPromptDismissed || svc.Bootstrap().SuggestSupport {
				t.Fatal("saving settings restored the support invitation")
			}
			svc.Close()
			reopened, err := New(dir)
			if err != nil {
				t.Fatal(err)
			}
			defer reopened.Close()
			if !reopened.Bootstrap().Settings.DonationPromptDismissed || reopened.Bootstrap().SuggestSupport {
				t.Fatal("restarting restored the support invitation")
			}
		})
	}
}
