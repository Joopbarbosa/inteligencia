"""Testes de src/custom_fields.py — lógica pura, sem mock (sem I/O de rede).

Exemplo numérico/valor concreto obrigatório (regra da skill /backend):
"BackEnd" -> "/api/v3/custom_options/2" é o valor real confirmado em
config/custom_fields_map.yaml (mesmo mapa usado pelo Script OP em produção).
"""

import pytest

from src.custom_fields import load_map, resolve_custom_fields, resolve_href


@pytest.fixture
def mapa():
    return load_map()


def test_load_map_carrega_categoria_sistema(mapa):
    assert "sistema" in mapa
    assert mapa["sistema"]["BackEnd"] == "/api/v3/custom_options/2"


def test_resolve_href_retorna_href_correto(mapa):
    assert resolve_href(mapa, "sistema", "BackEnd") == "/api/v3/custom_options/2"
    assert resolve_href(mapa, "sistema", "FrontEnd") == "/api/v3/custom_options/3"
    assert resolve_href(mapa, "sistema", "Mobile") == "/api/v3/custom_options/14"


def test_resolve_href_valor_desconhecido_levanta_erro_claro(mapa):
    with pytest.raises(ValueError) as exc_info:
        resolve_href(mapa, "sistema", "Valor Que Não Existe")

    msg = str(exc_info.value)
    assert "Valor Que Não Existe" in msg
    assert "sistema" in msg
    # Erro deve listar os valores válidos, não só dizer "inválido"
    assert "BackEnd" in msg


def test_resolve_href_categoria_desconhecida_levanta_erro(mapa):
    with pytest.raises(ValueError):
        resolve_href(mapa, "categoria_inexistente", "qualquer coisa")


def test_resolve_custom_fields_monta_links_para_sistema(mapa):
    links = resolve_custom_fields(mapa, sistema="BackEnd")
    assert links == {"customField1": {"href": "/api/v3/custom_options/2"}}


def test_resolve_custom_fields_sem_sistema_retorna_vazio(mapa):
    assert resolve_custom_fields(mapa) == {}


def test_resolve_custom_fields_sistema_invalido_propaga_erro(mapa):
    with pytest.raises(ValueError):
        resolve_custom_fields(mapa, sistema="Não Existe")
