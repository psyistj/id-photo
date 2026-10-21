#!/usr/bin/env python3
"""Unit tests for the hub gateway domain-composition logic (no server access needed)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import importlib.util

spec = importlib.util.spec_from_file_location('remote_deploy', Path(__file__).with_name('remote-deploy.py'))
remote_deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(remote_deploy)

HUB = """# Include inside http {} in /etc/nginx/novelco-gateway.conf.
server {
    listen 80;
    server_name hub.plustech.cc tibo.help;
    include /etc/nginx/pagerouter-legacy.conf;
    location / {
        return 308 https://hub.plustech.cc$request_uri;
    }
}

server {
    listen 127.0.0.1:8443 ssl proxy_protocol;
    server_name hub.plustech.cc;
    root /srv/novelco/current;
    index index.html;

    include /etc/nginx/tool-qr.locations.conf;
    include /etc/nginx/pagerouter-legacy.conf;
    location / {
        root /srv/pagerouter/current/hub;
        try_files $uri $uri/ =404;
    }
}
"""


class ComposeDomainTest(unittest.TestCase):
    def test_inserts_include_into_hub_https_server(self):
        result = remote_deploy.compose_domain(HUB)
        self.assertIn('include /etc/nginx/id-photo.locations.conf;', result)
        # Must land in the HTTPS server, before the legacy include and catch-all route.
        https_start = result.index('listen 127.0.0.1:8443')
        self.assertGreater(result.index('id-photo.locations.conf'), https_start)
        self.assertLess(
            result.index('id-photo.locations.conf'),
            result.index('include /etc/nginx/pagerouter-legacy.conf;', https_start),
        )
        # HTTP server block stays untouched.
        http_block = result[:https_start]
        self.assertNotIn('id-photo.locations.conf', http_block)

    def test_is_idempotent(self):
        once = remote_deploy.compose_domain(HUB)
        self.assertEqual(remote_deploy.compose_domain(once), once)

    def test_rejects_unknown_layout_without_hub_listener(self):
        with self.assertRaises(ValueError):
            remote_deploy.compose_domain(HUB.replace('    listen 127.0.0.1:8443 ssl proxy_protocol;\n', ''))

    def test_rejects_duplicate_hub_listener(self):
        duplicated = HUB.replace(
            '    listen 127.0.0.1:8443 ssl proxy_protocol;\n',
            '    listen 127.0.0.1:8443 ssl proxy_protocol;\n    listen 127.0.0.1:8443 ssl proxy_protocol;\n')
        with self.assertRaises(ValueError):
            remote_deploy.compose_domain(duplicated)

    def test_rejects_block_without_hub_server_name(self):
        with self.assertRaises(ValueError):
            remote_deploy.compose_domain(HUB.replace('    server_name hub.plustech.cc;\n', '    server_name other.example;\n'))


class RouteConfigTest(unittest.TestCase):
    def test_route_config_routes_to_release_symlink(self):
        text = Path(__file__).with_name('nginx-location.conf').read_text()
        self.assertIn('alias /srv/id-photo/current/;', text)
        self.assertIn('location = /id-photo {', text)
        self.assertIn("connect-src 'none'", text)
        self.assertNotIn('/var/www/id-photo', text)


if __name__ == '__main__':
    unittest.main()
