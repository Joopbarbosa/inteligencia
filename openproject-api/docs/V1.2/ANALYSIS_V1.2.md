# Análise — inteligencia/openproject-api — V1.2

**Tarefa âncora:** [#402](http://localhost:8090/work_packages/402)
**Tarefas do pocket:** #403 (parent_id), #404 (create_project), #405 (delete_version), #406 (delete_work_package), #407 (paginação em list_work_packages), #408 (mover tarefa de projeto)
**Fase:** 2 — Investigação (read-only estrito, sem código de correção)

---

## #403 — Ativar parent_id em create_work_package/update_work_package

**Causa raiz:** o suporte a `parent_id` já existe na camada de comunicação com a API (`src/client.py`), mas nunca foi conectado à camada de entrada (tool MCP). Não é limitação da API do OpenProject nem do client — é uma tool nunca ligada até a ponta.

**Arquivos/camada envolvidos:**
- `src/client.py::update_work_package` (linhas 373-383) — **já trata** `parent_id`, montando `payload["_links"]["parent"]` (com suporte a remoção de pai via `href: None`).
- `src/client.py::create_work_package` (linhas 173-244) — **não trata** `parent_id` em lugar nenhum; monta `_links` para `project`/`type`/`priority_id`/`assignee_id`/`version_id`/`custom_fields`, mas não para `parent`.
- `src/tools/work_packages.py::UpdateWorkPackageInput`/`CreateWorkPackageInput` — nenhum dos dois modelos Pydantic declara o campo `parent_id`; por isso o schema da tool MCP não expõe esse campo e nada do que chega no `data` do client depende dele.

**Evidência exata:**
```python
# src/client.py:373-383 (update_work_package — já existe)
if "parent_id" in data:
    if "_links" not in payload:
        payload["_links"] = {}
    if data["parent_id"] is None:
        payload["_links"]["parent"] = {"href": None}
    else:
        payload["_links"]["parent"] = {
            "href": f"/api/v3/work_packages/{data['parent_id']}"
        }
```
Padrão de merge de `_links` opcionais usado pelo `create_work_package` (linhas 208-225) é idêntico em forma — cada campo opcional testa `if "X" in data`, garante `_links` e atribui `{"href": f"/api/v3/tipo/{data['X']}"}`. `parent_id` seguiria o mesmo formato se conectado.

**Camada de teste:** não há teste automatizado que exercite `create_work_package`/`update_work_package` do client hoje (`tests/` só cobre funções puras: `build_work_package_filters` e `custom_fields`). A regra do próprio projeto ("nenhuma tool sem validação manual antes de expor") se aplica sem cobertura automatizada — validação terá que ser manual contra a instância real.

---

## #404 — Nova tool create_project

**Causa raiz:** `src/tools/projects.py` (e o método de client correspondente) foi descartado deliberadamente durante a vendorização seletiva do fork original (`ARCHITECTURE.md` §3) — não é um bug, é escopo nunca coberto pelas 4 prioridades originais do projeto.

**Arquivos/camada envolvidos:**
- `src/client.py` — confirmado por grep: **zero ocorrências** de `get_projects`/`list_projects`/`create_project`, ativas ou mortas/comentadas.
- Padrão de referência mais próximo: `src/client.py::create_version` (linhas 456-488) — monta payload direto (sem fluxo de form) e faz um único `POST`.

**Evidência exata:**
```python
# src/client.py:456-488 (create_version — padrão de referência)
async def create_version(self, project_id: int, data: Dict) -> Dict:
    payload = {
        "_links": {"definingProject": {"href": f"/api/v3/projects/{project_id}"}}
    }
    if "name" in data:
        payload["name"] = data["name"]
    ...
    return await self._request("POST", "/versions", payload)
```
`create_project` não tem um `project_id` pai para linkar (é o próprio projeto sendo criado) — precisa de investigação adicional na Fase de Spec/Backend para confirmar o payload mínimo aceito por `POST /projects` na API v3 (campo `name` obrigatório é conhecido pela documentação pública da API; `identifier` opcional, mas isso não foi confirmado empiricamente contra esta instância nesta investigação read-only).

**Diferença estrutural importante:** `create_work_package` usa fluxo em duas etapas (`POST /work_packages/form` → `POST /work_packages`); `create_version` usa payload direto num único `POST`. Ainda não está confirmado se `POST /projects` exige ou aceita um fluxo de form — isso é uma pergunta em aberto para a próxima fase (Spec/Backend), não uma causa raiz fechada.

---

## #405 — Nova tool delete_version

**Causa raiz:** nenhuma operação de exclusão (`delete_*` de qualquer recurso) foi portada do fork original nem implementada depois — confirmado por `grep -n "async def delete\|DELETE" src/client.py` retornando zero resultados. Esse gap foi o que obrigou a exclusão manual pela UI das versões de teste `#24`/`#25` na correção V1.1 (documentado em `docs/V1.1/RELEASE_NOTES_V1.1.md`).

**Arquivos/camada envolvidos:**
- `src/client.py::_request` (linhas 64-133) — método HTTP genérico já aceita qualquer `method` (string), incluindo `"DELETE"`, sem necessidade de alteração nessa camada.
- `src/client.py:116` — trata `response_text` vazio como `{}` (`json.loads(response_text) if response_text else {}`), o que já cobre corretamente o `204 No Content` que a API do OpenProject retorna em exclusões bem-sucedidas — não é uma barreira técnica.

**Evidência exata (padrão de chamada a replicar):**
```python
# src/client.py:393-395 (update_work_package — padrão PATCH)
return await self._request(
    "PATCH", f"/work_packages/{work_package_id}", payload
)
```
Um `delete_version` seguiria a mesma forma trocando o verbo e removendo o payload — mas isso é decisão de implementação, não causa raiz; não escrita aqui.

**Pergunta em aberto para a próxima fase:** o que acontece com tarefas associadas a uma versão excluída (a API pode rejeitar, desvincular automaticamente, ou exigir reatribuição prévia) — não confirmado nesta investigação read-only, precisa de teste manual controlado.

---

## #406 — Nova tool delete_work_package

**Causa raiz:** mesmo gap do #405 (nenhum `delete_*` existe) — mesma dor concreta, desta vez para a tarefa de teste `#397` na correção V1.1.

**Arquivos/camada envolvidos:** idênticos ao #405 (`_request` genérico já suporta `DELETE`; nenhuma barreira técnica identificada).

**Pergunta em aberto para a próxima fase:** se a API v3 impõe alguma trava ao excluir uma tarefa que tem filhos (relevante porque #403, uma vez implementado, vai gerar exatamente esse cenário — tarefas com parent/child) — não confirmado nesta investigação, precisa de teste manual controlado.

---

## #407 — Paginação automática em list_work_packages

**Causa raiz:** o método de client sempre faz uma única chamada `GET` com `pageSize` fixo (default `100`) e nunca lê `total`/`offset` da resposta HAL para buscar páginas seguintes — a tool (`src/tools/work_packages.py::list_work_packages`, linhas 138-141) já lê `total` e **avisa** no texto quando há mais itens, mas não busca o resto.

**Arquivos/camada envolvidos:**
- `src/client.py::list_work_packages` (linhas 422-454) — `page_size: int = 100` (linha 426), monta `query = f"?pageSize={page_size}"` (linha 442) e faz **uma única** chamada `GET` (linha 446). Nenhum loop, nenhuma leitura de `offset`/`total` da resposta pra decidir buscar mais.
- `src/tools/work_packages.py::list_work_packages` (linhas 138-141) — já lê `result.get("total", ...)` e monta o aviso textual, mas isso é só UX de aviso, não busca de fato.

**Evidência exata:**
```python
# src/client.py:422-454
async def list_work_packages(
    self,
    project_id: Optional[int] = None,
    filters: Optional[List[Dict]] = None,
    page_size: int = 100,
) -> Dict:
    endpoint = f"/projects/{project_id}/work_packages" if project_id else "/work_packages"
    query = f"?pageSize={page_size}"
    if filters:
        query += f"&filters={quote(json.dumps(filters))}"
    result = await self._request("GET", f"{endpoint}{query}")
    ...
    return result
```
Não é limitação da API (a API v3 do OpenProject suporta paginação real via `offset`/`pageSize` e devolve `total`/`count` na resposta) — é simplesmente um loop nunca implementado.

**Pergunta em aberto para a próxima fase:** confirmar empiricamente o cap real de `pageSize` aceito por esta instância (a doc da API v3 permite valores altos, mas instâncias podem limitar) — decide se a estratégia correta é "aumentar pageSize" ou "loop com offset incrementando".

---

## #408 — Mover tarefa de projeto em update_work_package

**Causa raiz:** simétrico ao achado de `parent_id` (#403) — o padrão de montar `_links.project` **já existe em `create_work_package`** (linhas 187-190), mas nunca foi portado para `update_work_package`. Motivação concreta e imediata: sem isso não há como migrar `#402`-`#408` para o projeto `inteligencia` quando ele for criado (ver plano de migração registrado na tarefa `#402`).

**Arquivos/camada envolvidos:**
- `src/client.py::update_work_package` (bloco de `if "X_id" in data` entre as linhas ~332-372) — trata `type_id`, `status_id`, `priority_id`, `assignee_id`, `version_id`, mas **não** `project_id`.
- `src/client.py::create_work_package` (linhas 187-190) — já tem o padrão exato a replicar:
```python
if "project" in data:
    form_payload["_links"]["project"] = {
        "href": f"/api/v3/projects/{data['project']}"
    }
```

**Evidência exata:** `grep -n "project" src/client.py` dentro do corpo de `update_work_package` não retorna nenhuma ocorrência — confirmado por leitura direta do método completo.

---

## Cruzamento de achados (obrigatório, Fase 2)

- **#403 ↔ #406:** uma vez que `parent_id` esteja ativo (#403), passa a ser possível ter tarefas com filhos — isso torna a pergunta em aberto do #406 ("o que acontece ao excluir uma tarefa com filhos?") diretamente relevante e não apenas teórica. Recomendação: validar #406 manualmente **depois** de #403 estar implementado e testado, usando justamente um par pai/filho real como caso de teste.
- **#404 ↔ padrão de #Fase 1.6 da própria skill `recepcao-analise`:** a `anti-padroes.md` desta skill hoje presume que "o MCP do OpenProject não tem ferramenta de relação entre tarefas" para a quebra de tarefas grandes (Fase 1.6) — com #403 pronto, essa premissa muda (existe hierarquia nativa). Fica registrado como achado de documentação desatualizada a atualizar depois que #403 for validado (fora do escopo de código deste pocket, mas dentro do escopo de handoff).
- **#404 e #405/#406 não têm dependência técnica entre si** nem com #403 — são gaps independentes na mesma categoria (funcionalidade nunca portada/implementada), podem ser feitos em qualquer ordem.
- **#404 ↔ #408 ↔ plano de migração:** o plano registrado na tarefa `#402` (criar projeto "inteligencia" e migrar `#402`-`#408` pra lá) depende dessas duas tarefas estarem prontas primeiro — não dá pra migrar sem `#408` (mover projeto), e não dá pra ter o projeto sem `#404` (criar projeto). Recomendação: implementar/validar `#404` e `#408` antes das demais, para poder migrar o pocket inteiro assim que possível.
- **#403 e #408 usam exatamente o mesmo padrão** (`_links.X` que já existe em `create_work_package` mas nunca foi portado pro `update_work_package`) — mesma causa raiz estrutural, arquivos vizinhos no `client.py`. Podem ser implementados juntos no mesmo commit/sessão de Backend por eficiência, sem misturar o teste de validação de cada um.
- **Nenhum teste automatizado cobre `client.py` hoje** (achado transversal às 4 tarefas) — o padrão do projeto é extrair lógica pura testável (como já feito para filtros e custom fields) em vez de mockar HTTP. Vale considerar para as 4 implementações, mas é decisão de Backend, não registrada aqui como causa raiz.

## Gravidades

Nenhuma das 4 tarefas é Bug ou Débito Técnico — gravidade não se aplica (`gravidade.md`, `dicionario-demandas.md`). Nenhuma gravidade sugerida na Fase 1 precisou de correção.

## Documentação desatualizada identificada

- `docs/V1.0/prompt/estrutura/CONTRATO_TOOLS.md` não documenta `parent_id`, `create_project`, `delete_version`, `delete_work_package` — desatualização esperada (features ainda não implementadas), não é achado de doc *errada*, só incompleta. Atualizar junto da implementação de cada tool (Backend), conforme já registrado nas etapas do `POCKET_V1.2.md`.
- `references/anti-padroes.md` da skill `recepcao-analise` (linha "Não presumir uma ferramenta de relação entre tarefas no MCP") ficará desatualizada assim que #403 for implementado e validado — registrado acima no cruzamento, fica para handoff futuro (fora do escopo de código deste pocket).
