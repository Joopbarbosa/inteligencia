"""Testes de build_work_package_filters (src/tools/work_packages.py) — lógica
pura de montagem de filtros da API v3, sem mock (sem I/O de rede).

Exemplo numérico concreto obrigatório (regra da skill /backend): version_id=24
é a Versão #24 real usada na validação do P4 (docs/DADOS_DE_TESTE.md).
"""

from src.tools.work_packages import build_work_package_filters


def test_sem_filtros_retorna_lista_vazia():
    assert build_work_package_filters() == []


def test_filtro_por_versao():
    assert build_work_package_filters(version_id=24) == [
        {"version": {"operator": "=", "values": ["24"]}}
    ]


def test_filtro_por_status():
    assert build_work_package_filters(status_id=5) == [
        {"status": {"operator": "=", "values": ["5"]}}
    ]


def test_filtro_por_tipo():
    assert build_work_package_filters(type_id=1) == [
        {"type": {"operator": "=", "values": ["1"]}}
    ]


def test_filtro_por_responsavel():
    assert build_work_package_filters(assignee_id=7) == [
        {"assignee": {"operator": "=", "values": ["7"]}}
    ]


def test_combina_multiplos_filtros_na_ordem_declarada():
    filtros = build_work_package_filters(version_id=24, status_id=5)
    assert filtros == [
        {"version": {"operator": "=", "values": ["24"]}},
        {"status": {"operator": "=", "values": ["5"]}},
    ]
