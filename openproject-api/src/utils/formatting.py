"""Response formatting utilities for consistent output across all tools.

Vendoring seletivo (ver docs/estrutura/ARCHITECTURE.md §3): mantidas só as
funções usadas pelas tools de work_packages, versions e connection.
"""

from typing import Dict


def format_work_package_detail(wp: Dict) -> str:
    """Format single work package with full details.

    Args:
        wp: Work package dictionary from API

    Returns:
        Formatted markdown string
    """
    text = f"✅ Work Package #{wp.get('id')}\n\n"
    text += f"**Subject**: {wp.get('subject', 'No title')}\n\n"

    # Extract data from both _embedded and _links
    embedded = wp.get("_embedded", {})
    links = wp.get("_links", {})

    # Type, Status, Priority, Project are in _embedded
    if "type" in embedded:
        text += f"**Type**: {embedded['type'].get('name', 'Unknown')}\n"
    if "status" in embedded:
        text += f"**Status**: {embedded['status'].get('name', 'Unknown')}\n"
    if "priority" in embedded:
        text += f"**Priority**: {embedded['priority'].get('name', 'Unknown')}\n"
    if "project" in embedded:
        project = embedded['project']
        text += f"**Project**: {project.get('name', 'Unknown')}\n"

    # Assignee is in _links
    assignee_link = links.get("assignee")
    if assignee_link:
        assignee_name = assignee_link.get("title", "Unknown")
        text += f"**Assignee**: {assignee_name}\n"
    else:
        text += f"**Assignee**: Unassigned\n"

    # Dates
    if wp.get('startDate'):
        text += f"**Start Date**: {wp['startDate']}\n"
    if wp.get('dueDate'):
        text += f"**Due Date**: {wp['dueDate']}\n"
    if wp.get('createdAt'):
        text += f"**Created**: {wp['createdAt']}\n"
    if wp.get('updatedAt'):
        text += f"**Updated**: {wp['updatedAt']}\n"

    # Description
    if wp.get('description'):
        desc = wp['description']
        if isinstance(desc, dict):
            desc_text = desc.get('raw', '')
        else:
            desc_text = str(desc)
        if desc_text:
            text += f"\n**Description**:\n{desc_text}\n"

    # Progress
    if 'percentageDone' in wp:
        text += f"\n**Progress**: {wp['percentageDone']}%\n"

    return text


def format_error(error_message: str) -> str:
    """Format error message consistently.

    Args:
        error_message: Error message string

    Returns:
        Formatted error string with ❌ prefix
    """
    return f"❌ Error: {error_message}"


def format_success(message: str) -> str:
    """Format success message consistently.

    Args:
        message: Success message string

    Returns:
        Formatted success string with ✅ prefix
    """
    return f"✅ {message}"
