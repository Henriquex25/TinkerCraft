package phpruntime

import "testing"

func TestStripPHPTagAcceptsLFAndCRLF(t *testing.T) {
	for _, source := range []string{"<?php\necho 1;", "<?php\r\necho 1;"} {
		if got := stripPHPTag([]byte(source)); got != "echo 1;" {
			t.Fatalf("stripPHPTag(%q) = %q", source, got)
		}
	}
}
