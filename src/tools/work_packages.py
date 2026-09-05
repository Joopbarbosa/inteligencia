"""Work package management tools.

Vendoring seletivo (ver docs/estrutura/ARCHITECTURE.md §3): mantidas só as
tools usadas pelas 4 prioridades de João. `get_work_package` foi adicionada
por nós (não existe no projeto original como tool) para suportar os passos
de validação "confirmar via GET" do docs/BACKLOG_V0.1.md.
"""

from typing import Optional
from pydantic import BaseModel, Field

from src.server import mcp, get_client
from src.custom_fields import load_map, resolve_custom_fields
from src.utils.formatting import (
    format_work_package_detail,
    format_success,
    format_error,
)


# Pydantic models for type-safe input validation
class CreateWorkPackageInput(BaseModel):
    """Input model for creating work packages with validation."""

    project_id: int = Field(..., description="Project ID where work package will be created", gt=0)
    subject: str = Field(..., description="Work package title/subject", min_length=1, max_length=255)
    type_id: int = Field(..., description="Type ID (use list_types to see available types)", gt=0)
    description: Optional[str] = Field(None, description="Detailed description in raw format")
    start_date: Optional[str] = Field(None, description="Start date in ISO format (YYYY-MM-DD)")
    due_date: Optional[str] = Field(None, description="Due date in ISO format (YYYY-MM-DD)")
    assignee_id: Optional[int] = Field(None, description="Assignee user ID", gt=0)
    status_id: Optional[int] = Field(None, description="Status ID", gt=0)
    priority_id: Optional[int] = Field(None, description="Priority ID", gt=0)
    version_id: Optional[int] = Field(None, description="Version/milestone ID to assign work package to", gt=0)
    sistema: Optional[str] = Field(None, description="Custom field 'Sistema' (ex: BackEnd, FrontEnd, Back/Front, Processual, Banco de Dados, Mobile) — ver config/custom_fields_map.yaml para os valores atuais")


class UpdateWorkPackageInput(BaseModel):
    """Input model for updating work packages with validation."""

    work_package_id: int = Field(..., description="Work package ID to update", gt=0)
    subject: Optional[str] = Field(None, description="New subject/title", min_length=1, max_length=255)
    description: Optional[str] = Field(None, description="New description")
    type_id: Optional[int] = Field(None, description="New type ID", gt=0)
    status_id: Optional[int] = Field(None, description="New status ID", gt=0)
    priority_id: Optional[int] = Field(None, description="New priority ID", gt=0)
    assignee_id: Optional[int] = Field(None, description="New assignee user ID", gt=0)
    start_date: Optional[str] = Field(None, description="New start date (YYYY-MM-DD)")
    due_date: Optional[str] = Field(None, description="New due date (YYYY-MM-DD)")
    percentage_done: Optional[int] = Field(None, description="Progress percentage (0-100)", ge=0, le=100)
    version_id: Optional[int] = Field(None, description="Version/milestone ID to assign work package to", gt=0)
    sistema: Optional[str] = Field(None, description="Custom field 'Sistema' (ex: BackEnd, FrontEnd, Back/Front, Processual, Banco de Dados, Mobile) — ver config/custom_fields_map.yaml para os valores atuais")


@mcp.tool
async def get_work_package(work_package_id: int) -> str:
    """Get a single work package (task) by ID.

    Args:
        work_package_id: ID of the work package to retrieve

    Returns:
        Formatted work package details
    """
    try:
        client = get_client()
        wp = await client.get_work_package(work_package_id)
        return format_work_package_detail(wp)
    except Exception as e:
        return format_error(f"Failed to get work package #{work_package_id}: {str(e)}")


@mcp.tool
async def create_work_package(input: CreateWorkPackageInput) -> str:
    """Create a new work package (task) - Prioridade 1 (criar com custom fields corretos).

    Args:
        input: Work package data including project_id, subject, type_id, and optional fields

    Returns:
        Success message with created work package ID and details

    Example:
        To create a bug in project 5:
        {
            "project_id": 5,
            "subject": "Fix login issue",
            "type_id": 1,
            "description": "Users cannot login with valid credentials",
            "priority_id": 3,
            "assignee_id": 7,
            "due_date": "2025-01-15"
        }
    """
    try:
        client = get_client()

        # Build data dict for API
        data = {
            "project": input.project_id,
            "subject": input.subject,
            "type": input.type_id,
        }

        # Add optional fields
        if input.description:
            data["description"] = input.description
        if input.priority_id:
            data["priority_id"] = input.priority_id
        if input.assignee_id:
            data["assignee_id"] = input.assignee_id
        if input.version_id:
            data["version_id"] = input.version_id
        if input.sistema:
            mapa = load_map()
            data["custom_fields"] = resolve_custom_fields(mapa, sistema=input.sistema)

        # Add date fields (use camelCase for API)
        if input.start_date:
            data["startDate"] = input.start_date
        if input.due_date:
            data["dueDate"] = input.due_date

        # Create work package
        result = await client.create_work_package(data)

        # Format success response
        wp_id = result.get("id")
        wp_subject = result.get("subject")

        text = format_success(f"Work package #{wp_id} created successfully!\n\n")
        text += f"**Subject**: {wp_subject}\n"

        # Add embedded data
        embedded = result.get("_embedded", {})
        if "type" in embedded:
            text += f"**Type**: {embedded['type'].get('name', 'Unknown')}\n"
        if "status" in embedded:
            text += f"**Status**: {embedded['status'].get('name', 'Unknown')}\n"
        if "priority" in embedded:
            text += f"**Priority**: {embedded['priority'].get('name', 'Unknown')}\n"
        if "assignee" in embedded:
            text += f"**Assignee**: {embedded['assignee'].get('name', 'Unassigned')}\n"

        if result.get('startDate'):
            text += f"**Start Date**: {result['startDate']}\n"
        if result.get('dueDate'):
            text += f"**Due Date**: {result['dueDate']}\n"

        return text

    except Exception as e:
        return format_error(f"Failed to create work package: {str(e)}")


@mcp.tool
async def update_work_package(input: UpdateWorkPackageInput) -> str:
    """Update an existing work package (task) - Prioridades 2 (mudar status) e 3 (editar).

    Args:
        input: Work package update data including work_package_id and fields to update

    Returns:
        Success message with updated work package details

    Example:
        To update work package #123 status and assignee:
        {
            "work_package_id": 123,
            "status_id": 5,
            "assignee_id": 7,
            "percentage_done": 50,
            "due_date": "2025-01-20"
        }
    """
    try:
        client = get_client()

        # Build data dict for API (only include provided fields)
        data = {}

        if input.subject is not None:
            data["subject"] = input.subject
        if input.description is not None:
            data["description"] = input.description
        if input.type_id is not None:
            data["type_id"] = input.type_id
        if input.status_id is not None:
            data["status_id"] = input.status_id
        if input.priority_id is not None:
            data["priority_id"] = input.priority_id
        if input.assignee_id is not None:
            data["assignee_id"] = input.assignee_id
        if input.percentage_done is not None:
            data["percentage_done"] = input.percentage_done
        if input.version_id is not None:
            data["version_id"] = input.version_id
        if input.sistema is not None:
            mapa = load_map()
            data["custom_fields"] = resolve_custom_fields(mapa, sistema=input.sistema)

        # Add date fields (use camelCase for API)
        if input.start_date is not None:
            data["startDate"] = input.start_date
        if input.due_date is not None:
            data["dueDate"] = input.due_date

        if not data:
            return format_error("No fields provided to update")

        # Update work package
        result = await client.update_work_package(input.work_package_id, data)

        # Format success response
        wp_id = result.get("id")
        wp_subject = result.get("subject")

        text = format_success(f"Work package #{wp_id} updated successfully!\n\n")
        text += f"**Subject**: {wp_subject}\n"

        # Add embedded data
        embedded = result.get("_embedded", {})
        if "type" in embedded:
            text += f"**Type**: {embedded['type'].get('name', 'Unknown')}\n"
        if "status" in embedded:
            text += f"**Status**: {embedded['status'].get('name', 'Unknown')}\n"
        if "priority" in embedded:
            text += f"**Priority**: {embedded['priority'].get('name', 'Unknown')}\n"
        if "assignee" in embedded:
            text += f"**Assignee**: {embedded['assignee'].get('name', 'Unassigned')}\n"

        if result.get('startDate'):
            text += f"**Start Date**: {result['startDate']}\n"
        if result.get('dueDate'):
            text += f"**Due Date**: {result['dueDate']}\n"
        if 'percentageDone' in result:
            text += f"**Progress**: {result['percentageDone']}%\n"

        return text

    except Exception as e:
        return format_error(f"Failed to update work package: {str(e)}")


@mcp.tool
async def list_types(project_id: Optional[int] = None) -> str:
    """List available work package types (Bug, Task, Feature, etc.).

    Args:
        project_id: Optional project ID to filter types by project

    Returns:
        List of work package types with IDs
    """
    try:
        client = get_client()

        result = await client.get_types(project_id)
        types = result.get("_embedded", {}).get("elements", [])

        if not types:
            return "No work package types found."

        text = "✅ **Available Work Package Types:**\n\n"
        for type_item in types:
            text += f"- **{type_item.get('name', 'Unnamed')}** (ID: {type_item.get('id', 'N/A')})\n"
            if type_item.get("isDefault"):
                text += "  ✓ Default type\n"
            if type_item.get("isMilestone"):
                text += "  ✓ Milestone\n"

        return text

    except Exception as e:
        return format_error(f"Failed to list work package types: {str(e)}")


@mcp.tool
async def list_statuses() -> str:
    """List available work package statuses (New, In Progress, Closed, etc.).

    Returns:
        List of work package statuses with IDs and properties
    """
    try:
        client = get_client()

        result = await client.get_statuses()
        statuses = result.get("_embedded", {}).get("elements", [])

        if not statuses:
            return "No statuses found."

        text = "✅ **Available Work Package Statuses:**\n\n"
        for status in statuses:
            text += f"- **{status.get('name', 'Unnamed')}** (ID: {status.get('id', 'N/A')})\n"
            text += f"  Position: {status.get('position', 'N/A')}\n"
            if status.get("isDefault"):
                text += "  ✓ Default status\n"
            if status.get("isClosed"):
                text += "  ✓ Closed status\n"

        return text

    except Exception as e:
        return format_error(f"Failed to list work package statuses: {str(e)}")


@mcp.tool
async def list_priorities() -> str:
    """List available work package priorities (Low, Normal, High, Immediate).

    Returns:
        List of work package priorities with IDs
    """
    try:
        client = get_client()

        result = await client.get_priorities()
        priorities = result.get("_embedded", {}).get("elements", [])

        if not priorities:
            return "No priorities found."

        text = "✅ **Available Work Package Priorities:**\n\n"
        for priority in priorities:
            text += f"- **{priority.get('name', 'Unnamed')}** (ID: {priority.get('id', 'N/A')})\n"
            text += f"  Position: {priority.get('position', 'N/A')}\n"
            if priority.get("isDefault"):
                text += "  ✓ Default priority\n"
            if priority.get("isActive"):
                text += "  ✓ Active\n"

        return text

    except Exception as e:
        return format_error(f"Failed to list work package priorities: {str(e)}")
