"""Version/milestone management tools.

V1.2 (docs/V1.2/): `delete_version` é novo (RN-NOVA-1 — bloqueia se houver
tarefas vinculadas, ver ANALYSIS/DECISOES_V1.2.md).
"""

from typing import Optional
from pydantic import BaseModel, Field
from src.server import mcp, get_client
from src.utils.formatting import format_success, format_error


class CreateVersionInput(BaseModel):
    """Input model for creating versions."""
    project_id: int = Field(..., description="Project ID", gt=0)
    name: str = Field(..., description="Version name", min_length=1, max_length=255)
    description: Optional[str] = Field(None, description="Version description")
    start_date: Optional[str] = Field(None, description="Start date (YYYY-MM-DD)")
    due_date: Optional[str] = Field(None, description="Due date (YYYY-MM-DD)")
    status: Optional[str] = Field(None, description="Status (open, locked, closed)")


class DeleteVersionInput(BaseModel):
    """Input model for deleting a version (V1.2, #405)."""
    version_id: int = Field(..., description="Version ID to delete", gt=0)
    project_id: int = Field(..., description="Project ID the version belongs to (necessário para checar tarefas vinculadas antes de excluir)", gt=0)


@mcp.tool
async def list_versions(project_id: int) -> str:
    """List all versions/milestones in a project.

    Args:
        project_id: The project ID

    Returns:
        List of versions with their details
    """
    try:
        client = get_client()

        result = await client.get_versions(project_id)
        versions = result.get("_embedded", {}).get("elements", [])

        if not versions:
            return f"No versions found for project #{project_id}."

        text = f"✅ **Versions for Project #{project_id} ({len(versions)}):**\n\n"
        for version in versions:
            text += f"**{version.get('name', 'Unnamed')}** (ID: {version.get('id', 'N/A')})\n"

            if version.get('description', {}).get('raw'):
                text += f"  Description: {version['description']['raw']}\n"

            if version.get('startDate'):
                text += f"  Start: {version['startDate']}\n"
            if version.get('endDate'):
                text += f"  End: {version['endDate']}\n"

            text += f"  Status: {version.get('status', 'Unknown')}\n"

            if "_embedded" in version and "definingProject" in version["_embedded"]:
                project = version["_embedded"]["definingProject"]
                text += f"  Project: {project.get('name', 'Unknown')}\n"

            text += "\n"

        return text

    except Exception as e:
        return format_error(f"Failed to list versions: {str(e)}")


@mcp.tool
async def create_version(input: CreateVersionInput) -> str:
    """Create a new version/milestone in a project.

    Args:
        input: Version data including project_id, name, and optional fields

    Returns:
        Success message with created version details

    Example:
        {
            "project_id": 5,
            "name": "Version 1.0",
            "description": "First major release",
            "due_date": "2025-03-31",
            "status": "open"
        }
    """
    try:
        client = get_client()

        data = {
            "name": input.name,
        }

        if input.description:
            data["description"] = input.description
        if input.start_date:
            data["start_date"] = input.start_date
        if input.due_date:
            # BUGFIX (docs/investigacao/INVESTIGACAO_V0.1_P001.md, item 8):
            # client.create_version só lê a chave "end_date" — o payload original
            # enviava "due_date" e o campo era descartado silenciosamente pela API.
            data["end_date"] = input.due_date
        if input.status:
            data["status"] = input.status

        result = await client.create_version(input.project_id, data)

        text = format_success("Version created successfully!\n\n")
        text += f"**Name**: {result.get('name', 'N/A')}\n"
        text += f"**ID**: #{result.get('id', 'N/A')}\n"

        if result.get('description', {}).get('raw'):
            text += f"**Description**: {result['description']['raw']}\n"

        if result.get('startDate'):
            text += f"**Start Date**: {result['startDate']}\n"
        if result.get('endDate'):
            text += f"**End Date**: {result['endDate']}\n"

        text += f"**Status**: {result.get('status', 'Unknown')}\n"

        return text

    except Exception as e:
        return format_error(f"Failed to create version: {str(e)}")


@mcp.tool
async def delete_version(input: DeleteVersionInput) -> str:
    """Delete a project version/milestone - V1.2 (#405).

    RN-NOVA-1 (DECISOES_V1.2.md): recusa a exclusão se houver tarefas
    vinculadas a essa versão — usuário precisa reatribuir/remover a versão
    de cada tarefa primeiro (update_work_package, version_id).

    Args:
        input: version_id a excluir + project_id (pra checar tarefas vinculadas)

    Returns:
        Success message, ou erro de BLOQUEIO com a contagem de tarefas vinculadas
    """
    try:
        client = get_client()

        # Import tardio: evita import circular no boot (server.py importa
        # work_packages antes de versions; um import no topo deste arquivo
        # pegaria work_packages ainda parcialmente inicializado se este
        # módulo for importado isoladamente, como faz o teste de filtros).
        from src.tools.work_packages import build_work_package_filters

        # RN-NOVA-1: checar tarefas vinculadas antes de excluir (BLOQUEIO).
        filters = build_work_package_filters(version_id=input.version_id)
        linked = await client.list_work_packages(project_id=input.project_id, filters=filters)
        elements = linked.get("_embedded", {}).get("elements", [])
        if elements:
            return format_error(
                f"BLOQUEIO: a versão #{input.version_id} tem {len(elements)} "
                "tarefa(s) vinculada(s) — reatribua ou remova a versão de cada "
                "uma primeiro (update_work_package, version_id) antes de excluir."
            )

        await client.delete_version(input.version_id)

        return format_success(f"Version #{input.version_id} deleted successfully!")

    except Exception as e:
        return format_error(f"Failed to delete version #{input.version_id}: {str(e)}")
