# Dados de teste criados na instância real — apagar ao final da V0.1

> Registro obrigatório de qualquer work package/versão/etc. criado contra a instância real do OpenProject durante a validação das prioridades (P1-P4). Apagar tudo listado aqui antes de considerar o pocket V0.1 fechado.

| Data | O quê | ID | Projeto | Criado por | Status |
|---|---|---|---|---|---|
| 05/09/2026 | Work package (teste de custom field, P1) | **#397** | Pense & Precifique (id=6) | script de validação manual (`validar_p1.py`, fora do repo) | ⬜ pendente de apagar |
| 05/09/2026 | Mesmo #397, status alterado para "Prioridade" (teste de mudança de status, P2) | #397 | Pense & Precifique (id=6) | script de validação manual (`validar_p2.py`, fora do repo) | — (mesma linha acima, só mudou de estado) |
| 05/09/2026 | Mesmo #397, subject/prioridade alterados (teste de edição, P3) | #397 | Pense & Precifique (id=6) | script de validação manual (`validar_p3.py`, fora do repo) | — (mesma linha acima, só mudou de estado) |
| 05/09/2026 | Versão (teste de create_version via client, P4) | **Versão #24** ("[TESTE OPAPI - APAGAR] Validação P4") | Pense & Precifique (id=6) | script de validação manual (`validar_p4.py`, fora do repo) | ⬜ pendente de apagar |
| 05/09/2026 | Versão (teste de create_version via tool MCP, P4) | **Versão #25** ("[TESTE OPAPI - APAGAR] Validação P4 (via tool)") | Pense & Precifique (id=6) | script de validação manual (`validar_p4.py`, fora do repo) | ⬜ pendente de apagar |

## Como apagar

- **Work package #397**: pela UI, abrir o work package → menu "..." → Excluir. (Não implementamos `delete_work_package` no vendoring — foi descartado por não estar nas 4 prioridades — então a exclusão é manual mesmo.)
- **Versões #24 e #25**: Pense & Precifique → Configurações do projeto → Versões → excluir as duas marcadas "[TESTE OPAPI - APAGAR]".

## Configuração alterada na instância real (não é dado, é config — registrar por transparência)

- **Projeto `Pense & Precifique`**: tipo "Task" habilitado em Configurações do projeto → Tipos de pacote de trabalho (estava com **todos os tipos desabilitados**, bloqueando qualquer criação de work package via API ou UI — não era um problema do P1, era configuração pré-existente do projeto). Feito por João em 05/09/2026. Não precisa reverter — é uma correção de configuração legítima do projeto, não algo específico da nossa validação.
