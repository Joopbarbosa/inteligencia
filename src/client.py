"""
OpenProject API Client

A comprehensive async client for OpenProject API v3 with proxy support.

Vendoring seletivo (ver docs/estrutura/ARCHITECTURE.md §3): só os métodos usados
pelas tools mantidas (connection, work_packages, versions) foram trazidos do
projeto original (github.com/AndyEverything/openproject-mcp-server, MIT — ver
ATTRIBUTION.md). Métodos de projetos, usuários, memberships, roles, time
entries, relações de hierarquia e news foram descartados.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio
import aiohttp
from urllib.parse import quote
import base64
import ssl

# Configure logging
logger = logging.getLogger(__name__)

# Version information
__version__ = "2.0.0"


class OpenProjectClient:
    """Client for the OpenProject API v3 with optional proxy support"""

    def __init__(self, base_url: str, api_key: str, proxy: Optional[str] = None):
        """
        Initialize the OpenProject client.

        Args:
            base_url: The base URL of the OpenProject instance
            api_key: API key for authentication
            proxy: Optional HTTP proxy URL
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.proxy = proxy

        # Setup headers with Basic Auth
        self.headers = {
            "Authorization": f"Basic {self._encode_api_key()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": f"OpenProject-MCP/{__version__}",
        }

        logger.info(f"OpenProject Client initialized for: {self.base_url}")
        if self.proxy:
            logger.info(f"Using proxy: {self.proxy}")

    def _encode_api_key(self) -> str:
        """Encode API key for Basic Auth"""
        credentials = f"apikey:{self.api_key}"
        return base64.b64encode(credentials.encode()).decode()

    async def _request(
        self, method: str, endpoint: str, data: Optional[Dict] = None
    ) -> Dict:
        """
        Execute an API request.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            data: Optional request body data

        Returns:
            Dict: Response data from the API

        Raises:
            Exception: If the request fails
        """
        url = f"{self.base_url}/api/v3{endpoint}"

        logger.debug(f"API Request: {method} {url}")
        if data:
            logger.debug(f"Request body: {json.dumps(data, indent=2)}")

        # Configure SSL and timeout
        ssl_context = ssl.create_default_context()
        connector = aiohttp.TCPConnector(ssl=ssl_context)
        timeout = aiohttp.ClientTimeout(total=30)

        async with aiohttp.ClientSession(
            connector=connector, timeout=timeout
        ) as session:
            try:
                # Build request parameters
                request_params = {
                    "method": method,
                    "url": url,
                    "headers": self.headers,
                    "json": data,
                }

                # Add proxy if configured
                if self.proxy:
                    request_params["proxy"] = self.proxy

                async with session.request(**request_params) as response:
                    response_text = await response.text()

                    logger.debug(f"Response status: {response.status}")

                    # Parse response
                    try:
                        response_json = (
                            json.loads(response_text) if response_text else {}
                        )
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON response: {response_text[:200]}...")
                        response_json = {}

                    # Handle errors
                    if response.status >= 400:
                        error_msg = self._format_error_message(
                            response.status, response_text
                        )
                        raise Exception(error_msg)

                    return response_json

            except aiohttp.ClientError as e:
                logger.error(f"Network error: {str(e)}")
                raise Exception(f"Network error accessing {url}: {str(e)}")

    def _format_error_message(self, status: int, response_text: str) -> str:
        """Format error message based on HTTP status code"""
        base_msg = f"API Error {status}: {response_text}"

        error_hints = {
            401: "Authentication failed. Please check your API key.",
            403: "Access denied. The user lacks required permissions.",
            404: "Resource not found. Please verify the URL and resource exists.",
            407: "Proxy authentication required.",
            500: "Internal server error. Please try again later.",
            502: "Bad gateway. The server or proxy is not responding correctly.",
            503: "Service unavailable. The server might be under maintenance.",
        }

        if status in error_hints:
            base_msg += f"\n\n{error_hints[status]}"

        return base_msg

    async def test_connection(self) -> Dict:
        """Test the API connection and authentication"""
        logger.info("Testing API connection...")
        return await self._request("GET", "")

    async def check_permissions(self) -> Dict:
        """
        Check user permissions and capabilities.

        Returns:
            Dict: User information including permissions
        """
        try:
            # Get current user info which includes permissions
            return await self._request("GET", "/users/me")
        except Exception as e:
            logger.error(f"Failed to check permissions: {e}")
            return {}

    async def create_work_package(self, data: Dict) -> Dict:
        """
        Create a new work package.

        Args:
            data: Work package data including project, subject, type, etc.

        Returns:
            Dict: Created work package data
        """
        # Prepare initial payload for form
        form_payload = {"_links": {}}

        # Set required links
        if "project" in data:
            form_payload["_links"]["project"] = {
                "href": f"/api/v3/projects/{data['project']}"
            }
        if "type" in data:
            form_payload["_links"]["type"] = {"href": f"/api/v3/types/{data['type']}"}

        # Set subject if provided
        if "subject" in data:
            form_payload["subject"] = data["subject"]

        # Get form with initial payload
        form = await self._request("POST", "/work_packages/form", form_payload)

        # Use form payload and add additional fields
        payload = form.get("payload", form_payload)
        payload["lockVersion"] = form.get("lockVersion", 0)

        # Add optional fields
        if "description" in data:
            payload["description"] = {"raw": data["description"]}
        if "priority_id" in data:
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"]["priority"] = {
                "href": f"/api/v3/priorities/{data['priority_id']}"
            }
        if "assignee_id" in data:
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"]["assignee"] = {
                "href": f"/api/v3/users/{data['assignee_id']}"
            }
        if "version_id" in data:
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"]["version"] = {
                "href": f"/api/v3/versions/{data['version_id']}"
            }
        if "status_id" in data:
            # Achado #14 (pocket piloto V0.8.4, 2026-09-11): status_id era aceito
            # pela tool/Pydantic mas nunca aplicado aqui — toda tarefa nascia no
            # status default (BackLog), exigindo update_work_package separado
            # sempre que uma skill pedia criar já em outro status.
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"]["status"] = {
                "href": f"/api/v3/statuses/{data['status_id']}"
            }
        if "parent_id" in data:
            # V1.2 (#403): cria a tarefa já como filha de outra. Diferente do
            # update, não há branch de remoção aqui — na criação, simplesmente
            # omitir o campo já resolve "sem pai".
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"]["parent"] = {
                "href": f"/api/v3/work_packages/{data['parent_id']}"
            }

        # Custom fields (ex: {"customField1": {"href": "/api/v3/custom_options/2"}}),
        # já resolvidos por src/custom_fields.py antes de chegar aqui. Sobrescreve
        # qualquer slot que o form já tenha retornado para o tipo escolhido.
        if "custom_fields" in data:
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"].update(data["custom_fields"])

        # Add date fields (ISO 8601 format: YYYY-MM-DD)
        if "startDate" in data:
            payload["startDate"] = data["startDate"]
        if "dueDate" in data:
            payload["dueDate"] = data["dueDate"]
        if "date" in data:
            payload["date"] = data["date"]

        # Create work package
        return await self._request("POST", "/work_packages", payload)

    async def get_types(self, project_id: Optional[int] = None) -> Dict:
        """
        Retrieve available work package types.

        Args:
            project_id: Optional project ID to filter types by

        Returns:
            Dict: API response containing types
        """
        if project_id:
            endpoint = f"/projects/{project_id}/types"
        else:
            endpoint = "/types"

        result = await self._request("GET", endpoint)

        # Ensure proper response structure
        if "_embedded" not in result:
            result["_embedded"] = {"elements": []}
        elif "elements" not in result.get("_embedded", {}):
            result["_embedded"]["elements"] = []

        return result

    async def get_statuses(self) -> Dict:
        """
        Retrieve available work package statuses.

        Returns:
            Dict: API response containing statuses
        """
        result = await self._request("GET", "/statuses")

        # Ensure proper response structure
        if "_embedded" not in result:
            result["_embedded"] = {"elements": []}
        elif "elements" not in result.get("_embedded", {}):
            result["_embedded"]["elements"] = []

        return result

    async def get_priorities(self) -> Dict:
        """
        Retrieve available work package priorities.

        Returns:
            Dict: API response containing priorities
        """
        result = await self._request("GET", "/priorities")

        # Ensure proper response structure
        if "_embedded" not in result:
            result["_embedded"] = {"elements": []}
        elif "elements" not in result.get("_embedded", {}):
            result["_embedded"]["elements"] = []

        return result

    async def get_work_package(self, work_package_id: int) -> Dict:
        """
        Retrieve a specific work package by ID.

        Args:
            work_package_id: The work package ID

        Returns:
            Dict: Work package data
        """
        return await self._request("GET", f"/work_packages/{work_package_id}")

    async def update_work_package(self, work_package_id: int, data: Dict) -> Dict:
        """
        Update an existing work package.

        Args:
            work_package_id: The work package ID
            data: Update data including fields to modify

        Returns:
            Dict: Updated work package data
        """
        # First get current work package to get lock version
        current_wp = await self.get_work_package(work_package_id)

        # Prepare payload with lock version
        payload = {"lockVersion": current_wp.get("lockVersion", 0)}

        # Add fields to update
        if "subject" in data:
            payload["subject"] = data["subject"]
        if "description" in data:
            payload["description"] = {"raw": data["description"]}
        if "type_id" in data:
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"]["type"] = {"href": f"/api/v3/types/{data['type_id']}"}
        if "status_id" in data:
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"]["status"] = {
                "href": f"/api/v3/statuses/{data['status_id']}"
            }
        if "priority_id" in data:
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"]["priority"] = {
                "href": f"/api/v3/priorities/{data['priority_id']}"
            }
        if "assignee_id" in data:
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"]["assignee"] = {
                "href": f"/api/v3/users/{data['assignee_id']}"
            }
        if "version_id" in data:
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"]["version"] = {
                "href": f"/api/v3/versions/{data['version_id']}"
            }
        if "project_id" in data:
            # V1.2 (#408): mover a tarefa de projeto — mesmo padrão _links já
            # usado por create_work_package (nunca tinha sido portado pro update).
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"]["project"] = {
                "href": f"/api/v3/projects/{data['project_id']}"
            }
            # RN-NOVA-3 (DECISOES_V1.2.md): mover de projeto invalida o vínculo
            # de versão do projeto de origem — limpa automaticamente, a menos
            # que um version_id novo já tenha sido definido acima nesta mesma
            # chamada (nesse caso, respeita o que foi pedido explicitamente).
            if "version" not in payload["_links"]:
                current_version_href = (
                    current_wp.get("_links", {}).get("version", {}).get("href")
                )
                if current_version_href:
                    payload["_links"]["version"] = {"href": None}
        if "percentage_done" in data:
            payload["percentageDone"] = data["percentage_done"]
        if "custom_fields" in data:
            if "_links" not in payload:
                payload["_links"] = {}
            payload["_links"].update(data["custom_fields"])
        if "parent_id" in data:
            if "_links" not in payload:
                payload["_links"] = {}
            if data["parent_id"] is None:
                # Remove parent
                payload["_links"]["parent"] = {"href": None}
            else:
                # Set parent
                payload["_links"]["parent"] = {
                    "href": f"/api/v3/work_packages/{data['parent_id']}"
                }

        # Add date fields (ISO 8601 format: YYYY-MM-DD)
        if "startDate" in data:
            payload["startDate"] = data["startDate"]
        if "dueDate" in data:
            payload["dueDate"] = data["dueDate"]
        if "date" in data:
            payload["date"] = data["date"]

        return await self._request(
            "PATCH", f"/work_packages/{work_package_id}", payload
        )

    async def get_versions(self, project_id: Optional[int] = None) -> Dict:
        """
        Retrieve project versions.

        Args:
            project_id: Optional project ID to filter versions by project

        Returns:
            Dict: API response containing versions
        """
        if project_id:
            endpoint = f"/projects/{project_id}/versions"
        else:
            endpoint = "/versions"

        result = await self._request("GET", endpoint)

        # Ensure proper response structure
        if "_embedded" not in result:
            result["_embedded"] = {"elements": []}
        elif "elements" not in result.get("_embedded", {}):
            result["_embedded"]["elements"] = []

        return result

    async def list_work_packages(
        self,
        project_id: Optional[int] = None,
        filters: Optional[List[Dict]] = None,
        page_size: int = 100,
    ) -> Dict:
        """
        List/filter work packages (P6 — ex: todas as tarefas de uma versão).

        V1.2 (#407): pagina automaticamente por `offset` até coletar todos os
        elementos que a API reporta em `total` — antes, buscava só a primeira
        página e a tool só avisava que havia mais (achado ANALYSIS_V1.2.md).

        Args:
            project_id: Optional project ID to scope the search to
            filters: Optional list of OpenProject API v3 filter objects
                (ex: [{"version": {"operator": "=", "values": ["24"]}}])
            page_size: Max results per page (API default/cap é ~100 por página)

        Returns:
            Dict: API response (HAL collection) com TODOS os elementos que
                casam o filtro, não só a primeira página.
        """
        endpoint = f"/projects/{project_id}/work_packages" if project_id else "/work_packages"

        all_elements: List[Dict] = []
        offset = 1
        first_page: Optional[Dict] = None
        # Trava de segurança: nunca busca mais que 50 páginas (~5000 itens no
        # pageSize padrão) — evita loop indefinido se a API relatar `total`
        # de forma inconsistente. Não esperado na prática hoje.
        max_pages = 50

        for _ in range(max_pages):
            query = f"?pageSize={page_size}&offset={offset}"
            if filters:
                query += f"&filters={quote(json.dumps(filters))}"

            page = await self._request("GET", f"{endpoint}{query}")
            if first_page is None:
                first_page = page

            elements = page.get("_embedded", {}).get("elements", [])
            all_elements.extend(elements)

            total = page.get("total", len(all_elements))
            if not elements or len(all_elements) >= total:
                break
            offset += 1

        result = first_page if first_page is not None else {}

        # Ensure proper response structure
        if "_embedded" not in result:
            result["_embedded"] = {}
        result["_embedded"]["elements"] = all_elements

        return result

    async def create_version(self, project_id: int, data: Dict) -> Dict:
        """
        Create a new project version.

        Args:
            project_id: The project ID
            data: Version data including name, description, etc.

        Returns:
            Dict: Created version data
        """
        # Prepare payload
        payload = {
            "_links": {"definingProject": {"href": f"/api/v3/projects/{project_id}"}}
        }

        # Set required fields
        if "name" in data:
            payload["name"] = data["name"]
        if "description" in data:
            payload["description"] = {"raw": data["description"]}
        if "start_date" in data:
            payload["startDate"] = data["start_date"]
        # BUGFIX (achado em docs/investigacao/INVESTIGACAO_V0.1_P001.md, item 8):
        # o tool original (versions.py) enviava "due_date", mas este método só lia
        # "end_date" — o campo de data final era descartado silenciosamente.
        # Corrigido para aceitar "end_date", alinhado com src/tools/versions.py.
        if "end_date" in data:
            payload["endDate"] = data["end_date"]
        if "status" in data:
            payload["status"] = data["status"]

        return await self._request("POST", "/versions", payload)

    async def delete_version(self, version_id: int) -> Dict:
        """
        Delete a project version (V1.2, #405).

        A checagem de BLOQUEIO (RN-NOVA-1 — recusar se houver tarefas
        vinculadas) é responsabilidade da camada de tool
        (`src/tools/versions.py`), não deste método — aqui é só o DELETE cru,
        no mesmo padrão de `_request` usado pelos outros verbos.

        Args:
            version_id: The version ID to delete

        Returns:
            Dict: API response (vazio — a API retorna 204 No Content em
                exclusões bem-sucedidas; `_request` já trata corpo vazio).
        """
        return await self._request("DELETE", f"/versions/{version_id}")

    async def delete_work_package(self, work_package_id: int) -> Dict:
        """
        Delete a work package (V1.2, #406).

        A checagem de BLOQUEIO (RN-NOVA-2 — recusar se houver filhos) é
        responsabilidade da camada de tool (`src/tools/work_packages.py`),
        não deste método.

        Args:
            work_package_id: The work package ID to delete

        Returns:
            Dict: API response (vazio — 204 No Content em exclusões bem-sucedidas).
        """
        return await self._request("DELETE", f"/work_packages/{work_package_id}")

    async def create_project(self, data: Dict) -> Dict:
        """
        Create a new project (V1.2, #404).

        Não existia nesta vendorização (descartado do fork original — ver
        ARCHITECTURE.md §3 e ACHADO_V1.1_LIST_PROJECTS.md). Payload direto,
        sem fluxo de form — mesmo padrão de `create_version`.

        Args:
            data: Project data — `name` obrigatório, `identifier` e
                `description` opcionais. `identifier` ausente é deixado para
                a própria API do OpenProject gerar a partir do `name`
                (decisão registrada em DECISOES_V1.2.md — sem RN, é contrato
                técnico, não regra de comportamento).

        Returns:
            Dict: Created project data
        """
        payload: Dict[str, Any] = {}

        if "name" in data:
            payload["name"] = data["name"]
        if "identifier" in data:
            payload["identifier"] = data["identifier"]
        if "description" in data:
            payload["description"] = {"raw": data["description"]}

        return await self._request("POST", "/projects", payload)
