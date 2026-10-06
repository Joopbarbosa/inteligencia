import { defineConfig } from 'vitest/config';
// Arquivos de teste em sequência: os testes de banco compartilham a mesma base e o worker de alertas lê todos os alertas pendentes.
export default defineConfig({ test: { fileParallelism: false } });
