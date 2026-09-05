"""Resolução de custom fields (texto -> href de custom_option).

Portado de `Infraestrutura/Script OP/src/script_op/custom_fields.py` (mesma
instância do OpenProject, mesmos IDs de custom_option — confirmado em
docs/investigacao/INVESTIGACAO_V0.1_P001.md). Assinatura adaptada para
keyword args nomeados (em vez de um único parâmetro posicional `sistema`)
para crescer sem quebrar chamadas existentes quando um novo custom field for
adicionado.
"""

from pathlib import Path
from typing import Optional

import yaml

# Mapa categoria -> nome do custom field na API do OpenProject.
# Hoje só "sistema" está ativo no fluxo (Módulo e Gravidade foram removidos
# do OpenProject / do fluxo — ver config/custom_fields_map.yaml).
CUSTOM_FIELD_IDS = {
    "sistema": "customField1",
}

_DEFAULT_MAP_PATH = Path(__file__).resolve().parent.parent / "config" / "custom_fields_map.yaml"


def load_map(caminho: Optional[Path] = None) -> dict:
    """Carrega o mapa estático categoria -> {texto: href} do YAML."""
    caminho = Path(caminho) if caminho else _DEFAULT_MAP_PATH
    with caminho.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def resolve_href(mapa: dict, categoria: str, texto: str) -> str:
    """Resolve o href de um valor de custom field, ou levanta erro claro."""
    href = mapa.get(categoria, {}).get(texto)
    if not href:
        valores_validos = list(mapa.get(categoria, {}).keys())
        raise ValueError(
            f"Valor '{texto}' não configurado para a categoria '{categoria}' em "
            f"config/custom_fields_map.yaml. Valores válidos: {valores_validos}"
        )
    return href


def resolve_custom_fields(mapa: dict, *, sistema: Optional[str] = None) -> dict:
    """Monta o trecho de `_links` do payload de criação/edição para os
    custom fields informados.

    Args:
        mapa: mapa carregado via load_map()
        sistema: valor textual do custom field "Sistema" (ex: "BackEnd")

    Returns:
        dict pronto para ser mesclado em payload["_links"], ex:
        {"customField1": {"href": "/api/v3/custom_options/2"}}
    """
    links: dict = {}
    if sistema is not None:
        links[CUSTOM_FIELD_IDS["sistema"]] = {"href": resolve_href(mapa, "sistema", sistema)}
    return links
