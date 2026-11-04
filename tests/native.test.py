import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
from contextlib import contextmanager

import gi
from Xlib import X, display, protocol

gi.require_version('Gdk', '3.0')
gi.require_version('GdkX11', '3.0')
gi.require_version('Atspi', '2.0')
from gi.repository import Atspi, Gdk, GdkX11, GLib

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / 'test-results'
RESULTS.mkdir(exist_ok=True)


def wait_for(check, timeout=20):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        while GLib.MainContext.default().pending():
            GLib.MainContext.default().iteration(False)
        result = check()
        if result:
            return result
        time.sleep(.1)
    raise AssertionError('Native test condition timed out')


@contextmanager
def accessibility_session():
    processes = []
    initialized = False
    keys = ['DBUS_SESSION_BUS_ADDRESS', 'AT_SPI_BUS_ADDRESS', 'NO_AT_BRIDGE']
    previous = {key: os.environ.get(key) for key in keys}
    try:
        for key, arguments in [
            ('DBUS_SESSION_BUS_ADDRESS', ['--session']),
            ('AT_SPI_BUS_ADDRESS', ['--config-file=/usr/share/defaults/at-spi2/accessibility.conf']),
        ]:
            process = subprocess.Popen(['dbus-daemon', *arguments, '--nofork', '--print-address=1'], stdout=subprocess.PIPE, text=True)
            processes.append(process)
            address = process.stdout.readline().strip()
            if not address:
                raise AssertionError('Could not start the isolated ' + key)
            os.environ[key] = address
        os.environ['NO_AT_BRIDGE'] = '0'
        processes.append(subprocess.Popen(['/usr/libexec/at-spi2-registryd'], stdout=subprocess.DEVNULL))
        Atspi.init()
        initialized = True
        Atspi.set_timeout(1000, 2000)
        yield
    finally:
        if initialized:
            Atspi.exit()
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)
            if process.stdout:
                process.stdout.close()
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


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
        if not (directory / 'workspace.json').exists():
            (directory / 'workspace.json').write_text(json.dumps({'version': 1, 'settings': {'phpBinary': 'php', 'checkUpdatesOnStartup': False}}))
        self.process = subprocess.Popen([str(binary)], cwd=os.environ.get('TINKERCRAFT_NATIVE_CWD', ROOT),
            env={**os.environ, 'TINKERCRAFT_DATA_DIR': str(directory), 'LIBGL_ALWAYS_SOFTWARE': '1', 'XDG_CACHE_HOME': str(directory / 'os-cache'), 'XDG_DATA_HOME': str(directory / 'os-data'), 'XDG_CONFIG_HOME': str(directory / 'os-config'), 'TINKERCRAFT_RELEASE_SOURCE': '', 'TINKERCRAFT_PHPACTOR': '', 'LUME_PHPACTOR': ''}, stdout=self.log, stderr=self.log)
        try:
            self.window_id = wait_for(lambda: window_for(self.process.pid))
            assert 'phpactorPath' not in state_at(directory)['settings']
            assert 'updateSource' not in state_at(directory)['settings']
            self.action('windowfocus', '--sync', self.window_id)
            self.directory = directory
            self.accessible = wait_for(self.accessible_app)
            self.wait_control(lambda node: node.get_role() == Atspi.Role.PUSH_BUTTON and node.get_name().startswith(('Run', 'Executar')), 'main interface ready')
            if (binary.parent / 'phpactor.phar').is_file():
                self.wait_control(lambda node: node.get_role() == Atspi.Role.PUSH_BUTTON and node.get_name() in ('Completion ready', 'Autocomplete pronto'), 'bundled Phpactor ready')
        except BaseException:
            self.cleanup()
            raise

    def accessible_app(self):
        desktop = Atspi.get_desktop(0)
        for index in range(desktop.get_child_count()):
            child = desktop.get_child_at_index(index)
            if child and child.get_process_id() == self.process.pid:
                return child

    def controls(self):
        assert self.accessible.get_process_id() == self.process.pid, 'Refusing accessibility access to another process'
        pending = [self.accessible]
        visited = 0
        while pending and visited < 3000:
            node = pending.pop()
            visited += 1
            try:
                node.clear_cache()
                if node.get_state_set().contains(Atspi.StateType.DEFUNCT):
                    continue
                yield node
                for index in reversed(range(node.get_child_count())):
                    child = node.get_child_at_index(index)
                    if child:
                        pending.append(child)
            except GLib.Error:
                continue

    def wait_control(self, predicate, description):
        def find():
            for node in self.controls():
                try:
                    if node.get_state_set().contains(Atspi.StateType.SHOWING) and predicate(node):
                        return node
                except GLib.Error:
                    continue
        try:
            return wait_for(find)
        except AssertionError:
            self.diagnostics(description)
            raise AssertionError('Native UI did not reach: ' + description)

    def diagnostics(self, description):
        self.screenshot('tinkercraft-native-wait-failure.png')
        focused = []
        for node in self.controls():
            try:
                if node.get_state_set().contains(Atspi.StateType.FOCUSED):
                    focused.append({'role': node.get_role_name(), 'name': node.get_name()[:300]})
            except GLib.Error:
                continue
        report = {'waitingFor': description, 'language': state_at(self.directory).get('settings', {}).get('language'), 'focused': focused}
        (RESULTS / 'tinkercraft-native-diagnostics.json').write_text(json.dumps(report, indent=2, ensure_ascii=False))
        print(json.dumps(report, ensure_ascii=False), flush=True)

    def command(self, label):
        search = 'Buscar comando' if state_at(self.directory).get('settings', {}).get('language') == 'pt-BR' else 'Search commands'
        self.key('F1')
        self.wait_control(lambda node: node.get_name() == search, 'command search visible')
        self.wait_control(lambda node: node.get_state_set().contains(Atspi.StateType.FOCUSED) and (node.get_name() == search or (node.get_role() == Atspi.Role.LIST_ITEM and node.get_state_set().contains(Atspi.StateType.SELECTED))), 'command search focused')
        self.type(label)
        self.wait_control(lambda node: label in node.get_name() and node.get_state_set().contains(Atspi.StateType.SELECTED), 'selected command: ' + label)
        self.key('Return')

    def close_dialog(self):
        self.key('Escape')
        def closed():
            return not any(node.get_role() == Atspi.Role.DIALOG and node.get_state_set().contains(Atspi.StateType.SHOWING) for node in self.controls())
        try:
            wait_for(closed)
        except AssertionError:
            self.diagnostics('dialog closed')
            raise

    def action(self, *args):
        owner = subprocess.check_output(['xdotool', 'getwindowpid', self.window_id], text=True).strip()
        assert owner == str(self.process.pid), 'Refusing to interact with another process'
        subprocess.run(['xdotool', *args], check=True)

    def key(self, combo):
        assert subprocess.check_output(['xdotool', 'getwindowfocus', 'getwindowpid'], text=True).strip() == str(self.process.pid), 'Refusing keys outside the test window'
        self.action('key', '--clearmodifiers', combo)

    def type(self, text):
        assert subprocess.check_output(['xdotool', 'getwindowfocus', 'getwindowpid'], text=True).strip() == str(self.process.pid), 'Refusing text outside the test window'
        self.action('type', '--clearmodifiers', '--delay', '50', text)

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
with accessibility_session():
    with tempfile.TemporaryDirectory(prefix='tinkercraft-native-') as folder:
        directory = Path(folder)
        app = App(directory)
        try:
            app.screenshot('tinkercraft-native-star-invitation.png')
            app.command('Dismiss GitHub invitation')
            wait_for(lambda: state_at(directory).get('settings', {}).get('starPromptDismissed') is True)
            time.sleep(.3)
            app.key('ctrl+j')
            time.sleep(.4)
            app.screenshot('tinkercraft-native-editor-only.png')
            app.key('ctrl+j')
            time.sleep(.3)
            app.key('ctrl+Return')
            wait_for(lambda: state_at(directory).get('history'))
            assert state_at(directory)['history'][0]['success']
            time.sleep(.5)
            app.action('mousemove', '--window', app.window_id, '350', '300', 'click', '1')
            app.key('ctrl+shift+p')
            app.wait_control(lambda node: node.get_name() == 'Search commands', 'command palette visible after Ctrl+Shift+P')
            app.screenshot('tinkercraft-native-commands.png')
            app.close_dialog()
            app.command('Configure shortcuts')
            time.sleep(1)
            app.screenshot('tinkercraft-native-shortcuts.png')
            app.close_dialog()
            app.command('About and updates')
            time.sleep(.8)
            app.key('ctrl+r')
            time.sleep(.5)
            app.screenshot('tinkercraft-native-updates.png')
            app.close_dialog()
            for command, choice, language in [('Change language', 'End', 'pt-BR'), ('Alterar idioma', 'Home', 'en'), ('Change language', 'End', 'pt-BR')]:
                app.key('ctrl+comma')
                time.sleep(.5)
                app.command(command)
                select_name = 'Idioma da interface' if state_at(directory).get('settings', {}).get('language') == 'pt-BR' else 'Interface language'
                app.wait_control(lambda node: node.get_role() == Atspi.Role.COMBO_BOX and node.get_name() == select_name and node.get_state_set().contains(Atspi.StateType.FOCUSED), 'interface language selector focused')
                app.key('space')
                app.wait_control(lambda node: node.get_role() in (Atspi.Role.MENU, Atspi.Role.POPUP_MENU, Atspi.Role.TREE_TABLE), 'language dropdown open')
                app.key(choice)
                selected_name = 'Português (Brasil)' if language == 'pt-BR' else 'English'
                app.wait_control(lambda node: node.get_role() in (Atspi.Role.MENU_ITEM, Atspi.Role.TABLE_CELL) and node.get_name() == selected_name and (node.get_state_set().contains(Atspi.StateType.SELECTED) or node.get_state_set().contains(Atspi.StateType.FOCUSED)), 'language selected: ' + selected_name)
                app.key('Return')
                app.key('Tab')
                app.wait_control(lambda node: node.get_state_set().contains(Atspi.StateType.FOCUSED) and node.get_state_set().contains(Atspi.StateType.EDITABLE), 'language dropdown committed')
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
            app.key('alt+1')
            app.key('ctrl+a')
            app.type('21*2')
            wait_for(lambda: state_at(directory).get('tabs', [{}])[0].get('code') == '21*2')
            app.key('alt+shift+f')
            wait_for(lambda: state_at(directory).get('tabs', [{}])[0].get('code') == '21 * 2;\n')
            app.key('ctrl+z')
            wait_for(lambda: state_at(directory).get('tabs', [{}])[0].get('code') == '21*2')
            assert len(state_at(directory)['history']) == 1
            print('PASS: native inline worker formats tag-free PHP through the keyboard and preserves undo without execution.')
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
            assert state_at(directory)['settings']['starPromptDismissed'] is True
            assert 'Workspace PHP' in subprocess.check_output(['xdotool', 'getwindowname', reopened.window_id], text=True)
            assert state_at(directory)['tabs'][0]['code'] == code
            assert len(state_at(directory)['history']) == 1, 'Unexecuted draft was evaluated'
            reopened.close()
            print('PASS: native reopen retained named, unexecuted draft and connection.')
        finally:
            reopened.cleanup()
        fixture = state_at(directory)
        fixture['launchCount'] = 4
        (directory / 'workspace.json').write_text(json.dumps(fixture))
        support = App(directory)
        try:
            assert state_at(directory)['launchCount'] == 5
            support.screenshot('tinkercraft-native-support-invitation.png')
            support.command('Dispensar convite de apoio')
            wait_for(lambda: state_at(directory).get('settings', {}).get('donationPromptDismissed') is True)
            support.close()
        finally:
            support.cleanup()
        support_reopened = App(directory)
        try:
            assert state_at(directory)['launchCount'] == 5
            assert state_at(directory)['settings']['donationPromptDismissed'] is True
            assert len(state_at(directory)['history']) == 1
            support_reopened.close()
            print('PASS: delayed support invitation, keyboard dismissal, capped launch count and persistence after native restart.')
        finally:
            support_reopened.cleanup()
