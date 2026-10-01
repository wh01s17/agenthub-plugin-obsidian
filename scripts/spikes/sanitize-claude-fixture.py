"""Recorta datos de configuración personal de fixtures stream-json de Claude (listas largas, salida de hooks)."""
import json, sys

LISTS = ['slash_commands', 'skills', 'plugins', 'tools', 'mcp_servers', 'agents', 'commands',
         'terminal_slash_commands', 'memory_paths']
for path in sys.argv[1:]:
    out = []
    for line in open(path):
        m = json.loads(line)
        for key in LISTS:
            if isinstance(m.get(key), list) and len(m[key]) > 3:
                n = len(m[key]); m[key] = m[key][:3]; m.setdefault('_fixtureNote', {})[key] = f'truncado: {n}'
        if m.get('subtype') == 'hook_response':
            for key in ('output', 'stdout', 'stderr'):
                if m.get(key): m[key] = '<omitido>'
        if 'messaging_socket_path' in m: m['messaging_socket_path'] = '<omitido>'
        out.append(json.dumps(m, ensure_ascii=False))
    open(path, 'w').write('\n'.join(out) + '\n')
