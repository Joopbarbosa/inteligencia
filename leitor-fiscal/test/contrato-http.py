"""Valida o serviço já iniciado no API_PORT isolado; chave efêmera revogada no fim."""
import json
import os
import subprocess
import uuid
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse

repo = Path(__file__).resolve().parents[1]
isolado = dict(l.split('=', 1) for l in (repo / '.pocket.env').read_text().splitlines() if l and not l.startswith('#'))
assert isolado['POCKET_TEST_DB'] == '1' and isolado['DB_NAME'].startswith('test_') and isolado['DB_CONTAINER'].startswith('test_')
url = urlparse(isolado['DATABASE_URL'])
assert url.hostname == 'localhost' and str(url.port) == isolado['DB_PORT'] and url.path == '/' + isolado['DB_NAME']
ambiente = {**os.environ, **isolado}
base = 'http://localhost:' + isolado['API_PORT']
with urlopen(base + '/saude', timeout=5) as r:
    assert json.load(r) == {'status': 'ok'}
criada = subprocess.run(['npm', 'run', '--silent', 'chave:criar', '--', 'contrato-677-' + str(uuid.uuid4())], cwd=repo, env=ambiente, capture_output=True, text=True, check=True)
chave = json.loads(criada.stdout)
ambiente['TEST_ENDPOINT_TOKEN'] = chave['chave']
ambiente['TEST_CONTA_ID'] = str(uuid.uuid4())
try:
    boundary = 'contrato-677'
    xml = (repo / 'test/fixtures/nfe.xml').read_bytes()
    body = (b'--contrato-677\r\nContent-Disposition: form-data; name="modelo"\r\n\r\nNFE\r\n'
            b'--contrato-677\r\nContent-Disposition: form-data; name="arquivo"; filename="nota.xml"\r\nContent-Type: application/xml\r\n\r\n' + xml + b'\r\n--contrato-677--\r\n')
    req = Request(base + '/v1/leituras', data=body, headers={
        'Authorization': 'Bearer ' + chave['chave'], 'X-Conta-Id': ambiente['TEST_CONTA_ID'],
        'Content-Type': 'multipart/form-data; boundary=' + boundary})
    with urlopen(req, timeout=10) as r:
        nota = json.load(r)
        assert r.status == 200 and nota['metodo'] == 'XML' and nota['numero'] == '1234'
        assert len(nota['itens']) == 3 and nota['totalPago'] == '61.9513'
    log = Path('/tmp/lf677-schemathesis.log')
    with log.open('w') as f:
        result = subprocess.run(['schemathesis', '--config-file', 'test/schemathesis.toml', 'run', 'docs/openapi.yaml',
            '--url', base, '--phases', 'coverage,fuzzing', '--max-examples', '30', '--seed', '677', '--generation-database', 'none',
            '--checks', 'not_a_server_error,status_code_conformance,content_type_conformance,response_schema_conformance',
            '--max-failures', '3', '--request-timeout', '5', '--report', 'junit', '--report-junit-path', '/tmp/lf677-schemathesis.xml'],
            cwd=repo, env=ambiente, stdout=f, stderr=subprocess.STDOUT)
    print('HTTP XML real: 200, 3 itens, total 61.9513; Schemathesis exit=' + str(result.returncode))
    print('Log: ' + str(log))
    raise SystemExit(result.returncode)
finally:
    subprocess.run(['npm', 'run', '--silent', 'chave:revogar', '--', chave['id']], cwd=repo, env=ambiente, capture_output=True, check=True)
