# Pesquisa funcional

Consulta a fontes públicas e oficiais em 3 de novembro de 2026. A especificação funcional foi derivada da documentação, sem ler ou extrair o código/recursos proprietários do Tinkerwell.

| Recurso observado | Fonte | Implementação no TinkerCraft |
| --- | --- | --- |
| Execução em aplicação local com detecção de framework | [Running code](https://tinkerwell.app/docs/5/basic-usage/evaluating-code) | Composer e kernel Laravel; seleção explícita e bootstrap customizado |
| PHP em containers locais ou no servidor | [Docker](https://tinkerwell.app/docs/5/setup-guides/docker) | Listagem/inspeção, botão para detectar diretório; `exec` local ou via SSH |
| Aplicação remota e credenciais SSH | [SSH](https://tinkerwell.app/docs/3/setup-guides/ssh) | OpenSSH, config/agent/chave, host conhecido e modo não interativo |
| Autocomplete indexando cópia local do projeto remoto | [Autocompletion](https://tinkerwell.app/docs/5/setup-guides/autocompletion) | Phpactor local por LSP; fallback por AST; preparação automática de cache solicitada pelo usuário |
| Visualização de arrays/Collections como tabela | [Table mode](https://tinkerwell.app/docs/3/basic-usage/table-mode) | Tabela com filtro, ordenação, paginação e CSV |
| Atalhos de execução/edição | [Shortcuts](https://tinkerwell.app/docs/5/advanced-usage/shortcuts) | Atalhos centrais e interação do Monaco |

As páginas SSH e Table mode da versão 3 foram usadas como referência pública para esses fluxos quando as rotas correspondentes da versão 5 não estavam acessíveis. Isso não comprova igualdade com todos os detalhes de versões atuais do Tinkerwell.

## Stack do produto de referência

A própria Beyond Code identifica o Tinkerwell como um aplicativo Electron no [balanço de 2022](https://tinkerwell.app/blog/tinkerwell-a-year-in-review-2022). O criador relata a reescrita para Electron no [balanço de 2020](https://pociot.dev/34-2020-my-year-in-review). Isso confirma o uso histórico de Electron; não estabelece a árvore atual de dependências nem a versão atual do runtime.

A documentação do Tinkerwell menciona cache de Phpactor ao tratar de autocomplete. Isso é uma evidência do servidor de linguagem usado, não acesso à implementação proprietária. O TinkerCraft integra o projeto aberto [Phpactor](https://github.com/phpactor/phpactor) por seu protocolo público.

## Projetos abertos usados

- [Monaco](https://github.com/microsoft/monaco-editor): editor extraído das fontes de VS Code. Extensões de VS Code não passam automaticamente a funcionar em Monaco.
- [Wails](https://github.com/wailsapp/wails): shell desktop e bindings Go/JavaScript.
- [Phpactor](https://phpactor.readthedocs.io/en/master/usage/standalone.html): servidor de linguagem PHP; instalado separadamente.
- [Phpactor initialization options](https://github.com/phpactor/phpactor/blob/master/lib/Extension/LanguageServer/Dispatcher/PhpactorDispatcherFactory.php): configuração por opções de inicialização LSP.
- [PHP-Parser](https://github.com/nikic/PHP-Parser): análise de AST para o último valor e indexação básica.
- [Laravel framework](https://github.com/laravel/framework): API pública de bootstrap, Collections, Eloquent e AliasLoader.

O TinkerCraft não reproduz integralmente o Tinkerwell e não anuncia compatibilidade com funcionalidades que não estão no escopo da primeira versão.
