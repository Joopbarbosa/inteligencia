"""Project management tools.

V1.2 (docs/V1.2/, #404): não existia nesta vendorização — `src/tools/projects.py`
do fork original foi descartado deliberadamente (ver ARCHITECTURE.md §3 e
docs/V1.1/investigacao/ACHADO_V1.1_LIST_PROJECTS.md). Só `create_project` é
adicionado aqui — `list_projects`/busca por nome segue como achado em aberto,
fora do escopo deste pocket.
"""

from typing import Optional
from pydantic import BaseModel, Field

from src.server import mcp, get_client
from src.utils.formatting import format_success, format_error


class CreateProjectInput(BaseModel):
    """Input model for creating a project."""

    name: str = Field(..., description="Project name", min_length=1, max_length=255)
    identifier: Optional[str] = Field(
        None,
        description=(
            "Identifier único do projeto (slug). Se ausente, a própria API do "
            "OpenProject gera a partir do name — decisão de contrato técnico "
            "registrada em DECISOES_V1.2.md, sem RN de comportamento."
        ),
    )
    description: Optional[str] = Field(None, description="Project description")


@mcp.tool
async def create_project(input: CreateProjectInput) -> str:
    """Create a new project in OpenProject - V1.2 (#404).

    Args:
        input: name obrigatório; identifier e description opcionais

    Returns:
        Success message with created project ID and details
    """
    try:
        client = get_client()

        data = {"name": input.name}
        if input.identifier:
            data["identifier"] = input.identifier
        if input.description:
            data["description"] = input.description

        result = await client.create_project(data)

        text = format_success("Project created successfully!\n\n")
        text += f"**Name**: {result.get('name', 'N/A')}\n"
        text += f"**ID**: {result.get('id', 'N/A')}\n"
        text += f"**Identifier**: {result.get('identifier', 'N/A')}\n"

        if result.get("description", {}).get("raw"):
            text += f"**Description**: {result['description']['raw']}\n"

        return text

    except Exception as e:
        return format_error(f"Failed to create project: {str(e)}")
