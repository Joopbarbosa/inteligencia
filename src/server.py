"""
OpenProject MCP Server - FastMCP Implementation

Main server file that initializes FastMCP and registers all tools.
"""

import os
import logging
from dotenv import load_dotenv
from fastmcp import FastMCP

from src.client import OpenProjectClient

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize FastMCP server
mcp = FastMCP(
    name="openproject-api"
)

# Initialize OpenProject client as global variable
_client = None

try:
    base_url = os.getenv("OPENPROJECT_URL")
    api_key = os.getenv("OPENPROJECT_API_KEY")
    proxy = os.getenv("OPENPROJECT_PROXY")

    if not base_url or not api_key:
        raise ValueError(
            "Missing required environment variables: OPENPROJECT_URL and OPENPROJECT_API_KEY must be set"
        )

    _client = OpenProjectClient(
        base_url=base_url,
        api_key=api_key,
        proxy=proxy
    )

    logger.info(f"✅ OpenProject MCP Server initialized")
    logger.info(f"   Server: {base_url}")
    logger.info(f"   Proxy: {proxy if proxy else 'None'}")

except Exception as e:
    logger.error(f"❌ Failed to initialize OpenProject client: {e}")
    raise


# Dependency injection helper for tools
def get_client():
    """Get OpenProject client instance."""
    return _client


# Import tool modules (decorators auto-register tools)
# Vendoring seletivo (ver docs/estrutura/ARCHITECTURE.md §3): só os módulos usados
# pelas 4 prioridades de João (criar/status/editar/versão) foram mantidos.
logger.info("Loading tool modules...")

try:
    from src.tools import connection      # 2 tools: test_connection, check_permissions
    from src.tools import work_packages   # create, update, get, list_types, list_statuses, list_priorities
    from src.tools import versions        # 2 tools: list, create

    logger.info("✅ Tool modules loaded successfully")
except ImportError as e:
    logger.warning(f"⚠️  Some tool modules failed to import: {e}")
    raise

