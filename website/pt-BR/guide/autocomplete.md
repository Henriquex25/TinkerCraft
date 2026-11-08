# Autocomplete e cache

O autocomplete combina Phpactor, um índice de fontes e helpers estáticos de Laravel. Oferece namespaces, membros, informações ao passar o mouse, assinaturas e diagnósticos.

Use **Ctrl+Espaço** para solicitar sugestões manualmente. Separadores de namespace e operadores de membros também disparam sugestões.

## Origem dos fontes

| Conexão            | Origem padrão da análise                       |
| ------------------ | ---------------------------------------------- |
| Local              | Diretório selecionado                          |
| Docker local       | Montagem bind acessível ou snapshot temporário |
| SSH / SSH + Docker | Snapshot de fontes guardado no seu computador  |

Normalmente não é preciso selecionar uma cópia local manual. As opções avançadas permitem indicar uma pasta específica ou desativar o autocomplete.

Snapshots incluem fontes PHP e metadados Composer. Excluem `.env`, bancos, uploads, diretórios ocultos, loaders gerados pelo Composer e outros dados que não são fontes. O TinkerCraft não envia alterações ao projeto.

## Métodos Laravel

Helpers privados descrevem métodos de consulta Eloquent conhecidos, scopes convencionais e scopes com atributo. Eles tornam chamadas como `User::count()` disponíveis ao autocomplete e ao diagnóstico.

Os helpers gerados ficam no workspace do TinkerCraft, inclusive para projetos locais. `_ide_helper.php` e `_ide_helper_models.php`, quando existentes, são lidos como metadados de fonte e preservados.

O gerador não instala IDE Helper, inicializa a aplicação Laravel, executa os models nem inspeciona o schema do banco. Macros que só existem em runtime e propriedades derivadas do schema ainda podem precisar de metadados existentes.

## Atualização e expiração

Fingerprints do conteúdo invalidam os símbolos gerados na próxima preparação. Enquanto visível, o app prepara novamente a aba ativa após cinco minutos. Snapshots remotos são reutilizados enquanto têm menos de quinze minutos.

**Atualizar autocomplete** (**Ctrl+Alt+R**) força coleta e preparação imediatamente. Use depois de um deploy ou quando um método novo não aparecer.

Caches inativos expiram após sete dias por padrão. Configure entre 1 e 90 dias nas Preferências. Sessões de linguagem ativas são preservadas.

## Diagnóstico

Abra **Diagnóstico do autocomplete** com **Ctrl+Alt+I**. Ele identifica Phpactor ou fallback básico, diretório/cache de origem e avisos da preparação.

A primeira indexação pode demorar. O snapshot é limitado a 256 MiB, 80.000 arquivos e três minutos, com até 4 MiB por arquivo. A indexação dos helpers estáticos cobre até 2.000 arquivos PHP e ignora arquivos maiores que 1 MiB. Caches parciais são sinalizados. O fallback básico tem mais limitações que Phpactor, principalmente em generics e expressões encadeadas.
