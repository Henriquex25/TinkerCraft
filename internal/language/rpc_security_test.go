package language

import (
	"bufio"
	"strings"
	"testing"
)

func TestLSPRejectsMalformedAndUnboundedFrames(t *testing.T) {
	for _, frame := range []string{
		"Content-Length: invalid\r\n\r\n",
		"Content-Length: -1\r\n\r\n",
		"Content-Length: 16777217\r\n\r\n",
		"Content-Length: 2\r\nContent-Length: 2\r\n\r\n{}",
		"Content-Type: application/json\r\n\r\n{}",
		"X-Padding: " + strings.Repeat("x", 20000) + "\r\n\r\n",
		strings.Repeat("X-Padding: value\r\n", 600) + "Content-Length: 2\r\n\r\n{}",
		"Content-Length: 10\r\n\r\n{}",
	} {
		if _, err := readFrame(bufio.NewReader(strings.NewReader(frame))); err == nil {
			t.Fatal("invalid LSP frame accepted")
		}
	}
	payload, err := readFrame(bufio.NewReader(strings.NewReader("Content-Length: 2\r\n\r\n{}")))
	if err != nil || string(payload) != "{}" {
		t.Fatal(string(payload), err)
	}
}
