import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

import gi
from Xlib import X, display, protocol

gi.require_version('Gdk', '3.0')
gi.require_version('GdkX11', '3.0')
from gi.repository import Gdk, GdkX11

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / 'test-results'
RESULTS.mkdir(exist_ok=True)


def wait_for(check, timeout=20):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        result = check()
        if result:
            return result
        time.sleep(.1)
    raise AssertionError('Native test condition timed out')


def window_for(pid):
    found = subprocess.run(['xdotool', 'search', '--all', '--onlyvisible', '--pid', str(pid), '--name', '^TinkerCraft'], capture_output=True, text=True)
    ids = found.stdout.split()
    return ids[0] if len(ids) == 1 else None


def state_at(directory):
    try:
        return json.loads((directory / 'workspace.json').read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


class App:
    def __init__(self, directory):
        self.log = tempfile.TemporaryFile()
        binary = Path(os.environ.get('TINKERCRAFT_NATIVE_BINARY', ROOT / 'build/bin/tinkercraft'))
        self.process = subprocess.Popen([str(binary)], cwd=os.environ.get('TINKERCRAFT_NATIVE_CWD', ROOT),
            env={**os.environ, 'TINKERCRAFT_DATA_DIR': str(directory), 'LIBGL_ALWAYS_SOFTWARE': '1', 'XDG_CACHE_HOME': str(directory / 'os-cache'), 'XDG_DATA_HOME': str(directory / 'os-data'), 'XDG_CONFIG_HOME': str(directory / 'os-config'), 'TINKERCRAFT_RELEASE_SOURCE': '', 'TINKERCRAFT_PHPACTOR': '', 'LUME_PHPACTOR': ''}, stdout=self.log, stderr=self.log)
        self.window_id = wait_for(lambda: window_for(self.process.pid))
        if (binary.parent / 'phpactor.phar').is_file():
            assert Path(state_at(directory)['settings']['phpactorPath']) == binary.parent / 'phpactor.phar'
        self.action('windowfocus', '--sync', self.window_id)
        time.sleep(4)

    def action(self, *args):
        owner = subprocess.check_output(['xdotool', 'getwindowpid', self.window_id], text=True).strip()
        assert owner == str(self.process.pid), 'Refusing to interact with another process'
        subprocess.run(['xdotool', *args], check=True)

    def key(self, combo):
        assert subprocess.check_output(['xdotool', 'getwindowfocus', 'getwindowpid'], text=True).strip() == str(self.process.pid), 'Refusing keys outside the test window'
        self.action('key', '--clearmodifiers', combo)

    def type(self, text):
        assert subprocess.check_output(['xdotool', 'getwindowfocus', 'getwindowpid'], text=True).strip() == str(self.process.pid), 'Refusing text outside the test window'
        self.action('type', '--clearmodifiers', '--delay', '0', text)

    def screenshot(self, name):
        window = GdkX11.X11Window.foreign_new_for_display(Gdk.Display.get_default(), int(self.window_id))
        Gdk.pixbuf_get_from_window(window, 0, 0, window.get_width(), window.get_height()).savev(str(RESULTS / name), 'png', [], [])

    def close(self):

        owner = subprocess.check_output(['xdotool', 'getwindowpid', self.window_id], text=True).strip()
        assert owner == str(self.process.pid)
        connection = display.Display()
        window = connection.create_resource_object('window', int(self.window_id))
        event = protocol.event.ClientMessage(window=window, client_type=connection.intern_atom('WM_PROTOCOLS'),
            data=(32, [connection.intern_atom('WM_DELETE_WINDOW'), X.CurrentTime, 0, 0, 0]))
        window.send_event(event, event_mask=X.NoEventMask)
        connection.sync()
        connection.close()
        try:
            assert self.process.wait(timeout=15) == 0
        except subprocess.TimeoutExpired:
            self.screenshot('tinkercraft-native-close-failure.png')
            self.log.seek(0)
            raise AssertionError('Native close guard did not finish: ' + self.log.read().decode(errors='replace'))

    def cleanup(self):
        if self.process.poll() is None:
            self.process.terminate()
            self.process.wait(timeout=10)
        self.log.close()



assert 'xvfb-run.' in os.environ.get('XAUTHORITY', ''), 'Run this test through xvfb-run -a'
assert os.environ.get('TINKERCRAFT_NATIVE_TEST') == '1', 'Use TINKERCRAFT_NATIVE_TEST=1 xvfb-run -a /usr/bin/python3 tests/native.test.py'
with tempfile.TemporaryDirectory(prefix='tinkercraft-native-') as folder:
    directory = Path(folder)
    app = App(directory)
    try:
        app.key('ctrl+Return')
        wait_for(lambda: state_at(directory).get('history'))
        assert state_at(directory)['history'][0]['success']
        time.sleep(.5)
        app.action('mousemove', '--window', app.window_id, '350', '300', 'click', '1')
        app.key('ctrl+shift+p')
        time.sleep(.8)
        app.screenshot('tinkercraft-native-commands.png')
        app.key('Escape')
        app.key('F1')
        time.sleep(.3)
        app.type('Configure shortcuts')
        app.key('Return')
        time.sleep(1)
        app.screenshot('tinkercraft-native-shortcuts.png')
        app.key('Escape')
        app.key('F1')
        time.sleep(.3)
        app.type('About')
        app.key('Return')
        time.sleep(.8)
        app.key('ctrl+r')
        time.sleep(.5)
        app.screenshot('tinkercraft-native-updates.png')
        app.key('Escape')
        for command, choice, language in [('Change language', 'End', 'pt-BR'), ('Alterar idioma', 'Home', 'en'), ('Change language', 'End', 'pt-BR')]:
            app.key('ctrl+comma')
            time.sleep(.5)
            app.key('F1')
            time.sleep(.3)
            app.type(command)
            app.key('Return')
            time.sleep(1)
            app.key(choice)
            time.sleep(.3)
            app.screenshot('tinkercraft-native-language-select-' + language + '.png')
            app.key('ctrl+s')
            try:
                wait_for(lambda: state_at(directory).get('settings', {}).get('language') == language)
            except AssertionError:
                app.screenshot('tinkercraft-native-language-failure.png')
                raise
            time.sleep(4)
            app.screenshot('tinkercraft-native-language-' + language + '.png')
        print('PASS: native language selection persisted English and Portuguese through interface reloads.')
        app.key('F2')
        app.type('Retomar no dia seguinte')
        app.key('Return')
        wait_for(lambda: state_at(directory).get('tabs', [{}])[0].get('name') == 'Retomar no dia seguinte')
        app.key('alt+1')
        time.sleep(.2)
        app.key('ctrl+a')
        app.key('BackSpace')
        code = '$nextDay = 42; // LAST_EDIT_BEFORE_CLOSE'
        app.type(code)
        typed_at = time.monotonic()
        app.close()
        assert state_at(directory)['tabs'][0]['code'] == code, 'Last edit mismatch: ' + repr(state_at(directory)['tabs'][0]['code'])
        assert state_at(directory)['tabs'][0]['name'] == 'Retomar no dia seguinte'
        print(f'PASS: native commands, preferences, F2, explicit execution and last edit persisted at close ({time.monotonic() - typed_at:.3f}s).')
    finally:
        app.cleanup()
    reopened = App(directory)
    try:
        reopened.screenshot('tinkercraft-native-restored.png')
        assert state_at(directory)['settings']['language'] == 'pt-BR'
        assert 'Workspace PHP' in subprocess.check_output(['xdotool', 'getwindowname', reopened.window_id], text=True)
        assert state_at(directory)['tabs'][0]['code'] == code
        assert len(state_at(directory)['history']) == 1, 'Unexecuted draft was evaluated'
        reopened.close()
        print('PASS: native reopen retained named, unexecuted draft and connection.')
    finally:
        reopened.cleanup()
