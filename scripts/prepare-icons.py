#!/usr/bin/env python3

from pathlib import Path

try:
    import gi
    gi.require_version('GdkPixbuf', '2.0')
    from gi.repository import GdkPixbuf
except ImportError:
    raise SystemExit('Instale python3-gi e gir1.2-gdkpixbuf-2.0 para gerar os ícones PNG.')

root = Path(__file__).resolve().parent.parent
icon = GdkPixbuf.Pixbuf.new_from_file(str(root / 'build/appicon.png'))
if icon.get_width() != icon.get_height():
    raise SystemExit('build/appicon.png deve ser quadrado; o original não será recortado.')

icon.scale_simple(128, 128, GdkPixbuf.InterpType.HYPER).savev(
    str(root / 'build/appicon-small.png'), 'png', [], [])
