# Guia de uso — TinkerCraft

> **Referência legada.** O guia atual está em [website/pt-BR/guide](../website/pt-BR/guide/getting-started.md) e no [site de documentação](https://henriquex25.github.io/TinkerCraft/pt-BR/). Para instalação, autocomplete e atualizações, siga o guia novo; as instruções abaixo preservam etapas de versões anteriores.

Um laboratório desktop pessoal para executar PHP no contexto dos seus projetos Laravel. Implementação independente, inspirada nas funcionalidades documentadas do Tinkerwell.

**Stack:** Wails 2.15 + Go + React/TypeScript + Monaco. O editor vem do projeto aberto Monaco; a inferência avançada usa Phpactor via LSP. Não é necessário manter um fork do VS Code.

## Instalar no seu Linux

O pacote para Pop!_OS/Ubuntu 22.04 x86-64 está em `build/dist/`:

```bash
sudo apt install ./build/dist/tinkercraft_0.2.0_linux_amd64_webkit40.deb
```

Abra **TinkerCraft** pelo menu do Linux ou execute `/usr/bin/tinkercraft`. O pacote inclui Phpactor; PHP local 8.2+ continua necessário. Códigos e conexões permanecem no workspace ao atualizar ou remover o aplicativo.

O app verifica novos releases ao iniciar quando há uma fonte configurada, mostra um indicador e permite baixar o pacote com verificação SHA-256 e abrir o instalador do sistema. Em **Preferências → Atualizações**, escolha se deseja consulta automática. O repositório oficial vem definido no build e não é editável na interface. O `.env` é apenas uma configuração do mantenedor para compilar. Para gerar pacotes: `./scripts/package-linux.sh`. Consulte [instalação, configuração do `.env` e publicação de releases](releases.md) para o processo completo e as variantes WebKit.

## Abrir pelo checkout

O executável desta primeira versão está em `build/bin/tinkercraft`:

```bash
cd tinkercraft
./scripts/start.sh
```

O aplicativo cria um workspace em `~/.config/tinkercraft` com um playground de PHP puro. O PHP precisa estar no PATH, ou ser configurado em **Preferências**. Para testar sem usar esse workspace:

```bash
TINKERCRAFT_DATA_DIR="$PWD/.data/manual" ./scripts/start.sh
```

O projeto se chamava Lume. Para preservar configurações existentes, o TinkerCraft reutiliza `~/.config/lume/workspace.json` quando ainda não há workspace no diretório novo e aceita `LUME_DATA_DIR` e `LUME_PHPACTOR` como aliases das variáveis antigas. As variáveis `TINKERCRAFT_DATA_DIR` e `TINKERCRAFT_PHPACTOR` têm prioridade. A pasta anterior `Projects/lume` permanece como um link para `Projects/tinkercraft`, mantendo válidos caminhos de projetos e do Phpactor já salvos. Nenhum histórico ou perfil é sobrescrito pela renomeação.

O executável anterior `build/bin/lume` também aponta para `build/bin/tinkercraft`, para manter atalhos antigos funcionando.

## O que está implementado

- Editor Monaco com realce PHP sem exigir `<?php` ou `?>`, múltiplas abas, desfazer/refazer, atalhos e salvamento automático das abas.
- Interface em preto, cinza e laranja, fontes maiores e navegação lateral recolhida por padrão.
- Execução explícita local, em container Docker, por OpenSSH e em Docker por SSH.
- Bootstrap automático de Laravel e Composer, PHP puro e bootstrap personalizado.
- Avaliação do último valor sem exigir `return`; `dump()` e `dd()` estruturados, incluindo o VarDumper do Laravel.
- Árvore expansível de arrays/objetos, Collections e modelos Eloquent; JSON; tabela com busca, ordenação, paginação e CSV.
- Captura separada de stdout, stderr, avisos, exceções e stack trace, com tempo e memória.
- Perfis de conexão, detecção do diretório de containers, cache automático para autocomplete remoto e histórico das últimas 50 execuções.
- Cancelamento, timeout configurável e limites de inspeção/saída.
- Integração LSP com Phpactor: completions, imports adicionais, hover, assinaturas e diagnósticos. Servidor incluído no pacote padrão; instalação separada no checkout.
- Indexador básico disponível sem Phpactor: funções PHP, classes, propriedades públicas e métodos públicos/herdados.

## Primeira conexão

1. Abra **Nova conexão** e escolha Local, Docker, SSH ou SSH + Docker.
2. Informe o diretório **no ambiente em que o PHP vai executar**. Para Docker, use o caminho interno do container, por exemplo `/var/www/html`.
3. Em Docker, busque os containers e escolha o container PHP. A seleção tenta localizar o projeto; o botão **Detectar diretório** permite repetir a busca. A detecção procura `composer.json`/`artisan` no diretório de trabalho, montagens e caminhos comuns, com busca limitada em subpastas. Também funciona em Docker por SSH.
4. O autocomplete usa o diretório local ou a montagem Docker acessível. Em outros casos, prepara automaticamente um cache dos fontes. Não é preciso manter uma cópia manual.
5. Em **Configurações avançadas**, ajuste o bootstrap se necessário: a detecção automática carrega `vendor/autoload.php` e, se encontrar `artisan` e `bootstrap/app.php`, inicializa o kernel de console Laravel.
6. Use **Testar conexão**, salve e execute com `Ctrl+Enter` ou `Ctrl+R`.

O teste de conexão verifica PHP, hostname e diretório com bootstrap desativado. O carregamento do framework é verificado quando você executa um trecho.

Escreva apenas o corpo do código PHP. As tags são adicionadas internamente quando necessárias; ao salvar um arquivo `.php`, a tag de abertura é incluída. Arquivos importados e abas antigas com tags são normalizados no editor.

### SSH

Usa o OpenSSH instalado na máquina, incluindo aliases de `~/.ssh/config`, agent, chaves e `ProxyJump`. Host obrigatório; usuário, porta e chave são opcionais quando definidos no SSH config. Porta vazia mantém a configuração do OpenSSH.

Antes da primeira conexão, conecte pelo terminal para registrar/verificar a chave do servidor em `known_hosts`. O TinkerCraft usa `BatchMode=yes` e `StrictHostKeyChecking=yes`; não abre prompts de senha nem ignora a chave do host. Chaves com passphrase precisam estar disponíveis no agent. Não há suporte a login por senha nesta versão.

### Docker e Laravel Sail

O container precisa estar em execução e conter PHP CLI. No Sail, escolha o container `laravel.test` e o diretório do projeto dentro dele. Não é necessário instalar o TinkerCraft, PsySH ou outra dependência nos projetos remotos: o runner PHP é enviado ao processo a cada execução. As dependências do próprio projeto precisam estar instaladas.

O ambiente de execução recebe as variáveis já definidas no container/servidor e o `.env` que o Laravel carrega. O TinkerCraft não injeta automaticamente variáveis do seu shell interativo em conexões SSH. Use caminho absoluto para o PHP remoto se ele não estiver no PATH de sessões não interativas.

## Autocomplete e IntelliSense

O Monaco é a interface do editor; a inteligência PHP avançada depende do Phpactor. Para instalar a versão fixada no script:

```bash
./scripts/install-phpactor.sh
```

O script baixa `phpactor.phar` do release oficial **2026.10.07.0**, confere o SHA-256 fixado no repositório antes de iniciá-lo e registra a soma local. Ao reabrir o TinkerCraft pela pasta do projeto, o arquivo em `.tools/phpactor.phar` é detectado. No pacote instalado, o Phpactor é gerenciado internamente e não pode ser substituído nas preferências, pelo PATH ou por variáveis de ambiente. Overrides de desenvolvimento `TINKERCRAFT_PHPACTOR`/`LUME_PHPACTOR` só são aceitos em builds de código-fonte, sem substituir o PHAR adjacente.

O status diferencia **Autocomplete**, **Autocomplete básico**, preparação e erros; passe o mouse para ver o servidor, a origem dos arquivos e a data do cache. O botão **Atualizar autocomplete** refaz a preparação e reinicia a indexação.

### Formatação do código

Use **Alt+Shift+F**, o ícone de formatação na barra das abas ou a ação **Formatar código PHP** na paleta. O atalho pode ser remapeado. O código é formatado localmente, sem execução ou conexão ao projeto; Ctrl+Z desfaz. Código inválido permanece intacto.

O padrão usa quatro espaços, largura preferida de 80 caracteres, aspas simples quando possível, vírgulas finais e chaves no estilo PER Coding Style. Cadeias longas de métodos recebem quebras de linha e alinhamento. A referência são as convenções [PHP-FIG](https://www.php-fig.org/per/coding-style/), implementadas pelo Prettier PHP; não equivale ao preset completo do Laravel Pint.

Em **Preferências → Formatação** (**Alt+4**), ajuste o estilo ou importe um JSON. Exemplo:

```json
{
  "tabWidth": 4,
  "printWidth": 80,
  "useTabs": false,
  "singleQuote": true,
  "trailingCommaPHP": true,
  "braceStyle": "per-cs"
}
```

Campos omitidos usam o padrão. As regras são copiadas para o app ao salvar; edite e importe novamente para atualizar. O arquivo original não é alterado nem acompanhado automaticamente. Arquivos do Pint/PHP-CS-Fixer, PHP, JavaScript e plugins externos não são compatíveis. O botão **Restaurar formatação padrão** desfaz a personalização; feche sem salvar para cancelar alterações nas preferências.

### Cache automático de projetos

O antigo campo **Cópia local para autocomplete** indicava onde o servidor de linguagem encontraria os fontes nesta máquina. Esse processo agora é automático:

- **Local:** indexa diretamente a pasta do projeto.
- **Docker local:** reaproveita uma montagem do tipo bind quando a pasta correspondente está acessível no host.
- **SSH, Docker sem montagem local e Docker por SSH:** lê os arquivos pelo PHP do ambiente selecionado e prepara uma cópia para análise em `<workspace>/cache/autocomplete`.

O cache contém arquivos PHP, manifests/lockfiles Composer e `vendor/composer/installed.json`, incluindo fontes das dependências disponíveis no ambiente. Não copia `.env`, arquivos/pastas ocultos, symlinks, `node_modules`, `bootstrap/cache` nem pastas de dados na raiz como `storage`, `public`, logs e uploads. Não faz upload, não altera os fontes originais e não instala dependências. O Phpactor recebe mapas PSR-4/PSR-0 gerados localmente a partir dos manifests JSON, sem executar autoload ou mapas PHP remotos. Isso permite localizar classes da aplicação e dependências antes de terminar a indexação completa. Tipos dependentes de execução dinâmica podem precisar de IDE Helper.

A preparação reaproveita uma cópia com menos de 15 minutos. Ao abrir novamente o projeto ou atualizar o autocomplete depois desse prazo, tenta obter os fontes atualizados. O botão de atualização força uma nova cópia. Se a atualização falhar e houver uma cópia anterior válida, ela é preservada e o status informa o problema.

Caches inativos são removidos após **7 dias sem uso**; configure entre 1 e 90 dias em **Preferências → Cache do autocomplete**. A limpeza ocorre ao iniciar o app, ao preparar o autocomplete e a cada hora; projetos com sessão de linguagem aberta são preservados. A análise do Phpactor fica junto do cache e expira com ele.

O limite é de 256 MiB e 80.000 arquivos por projeto, com até 4 MiB por arquivo e timeout de coleta de três minutos. Os fontes da aplicação vêm antes das dependências. Testes, fixtures e documentação das dependências e loaders PHP gerados pelo Composer não entram no cache. Ao atingir o orçamento, a coleta termina com um cache parcial válido e aviso, em vez de eliminar o autocomplete. Se a transferência falhar, o editor mantém sugestões de tipos PHP e informa que os fontes do projeto não estão disponíveis. Para indexar fontes além do orçamento, use **Configurações avançadas → Autocomplete → Pasta local**. Também é possível desativar o autocomplete por conexão. Caminhos manuais de perfis antigos continuam sendo respeitados.

O fallback básico lê ASTs sem executar o código do projeto, limita a indexação a 2.000 arquivos e não oferece a inferência de cadeias, generics e métodos mágicos do Phpactor. Para Eloquent/métodos mágicos, o [Laravel IDE Helper](https://github.com/barryvdh/laravel-ide-helper) pode gerar os arquivos de tipos no seu projeto. Gere-os por iniciativa própria no projeto desejado; o TinkerCraft não altera suas dependências.

## Salvar e retomar seus códigos

As abas abertas são salvas automaticamente neste dispositivo, incluindo **nome, código e conexão/projeto associado**, mesmo sem executar o código. Elas são restauradas ao abrir o TinkerCraft no dia seguinte. Renomeie com **F2**, duplo clique no título ou o botão de lápis. Enter confirma; Esc cancela.

**Ctrl+S** grava imediatamente todas as abas no aplicativo. O indicador de salvamento informa quando a gravação terminou. No fechamento normal da janela Wails, o aplicativo aguarda a última gravação antes de sair; se ela falhar, mantém a janela aberta e informa o erro. Encerramento forçado do processo ou queda de energia ainda podem perder edições recentes.

**Ctrl+Shift+S** salva a aba atual como arquivo PHP pelo seletor nativo. **Ctrl+O** abre um arquivo PHP em nova aba. Esses arquivos permitem guardar trechos que você deseja reutilizar depois de fechar suas abas. O histórico mantém as últimas 50 execuções; ele não substitui os arquivos ou as abas para trechos nunca executados. Ainda não há uma biblioteca separada de snippets ou um gerenciador de projetos em disco; os projetos são selecionados pelos perfis de conexão.

## Teclado e atalhos

Abra **Preferências → Atalhos de teclado** para remapear, remover ou restaurar combinações. Os atalhos são persistidos no workspace. Conflitos são verificados por contexto: a mesma combinação pode ter ações distintas no editor e nos formulários. Combinações essenciais de edição e do sistema são reservadas. Um remapeamento substitui também os atalhos alternativos padrão da ação.

**Ctrl+Shift+P** ou **F1** abre a paleta: busque uma ação, navegue com ↑/↓ e confirme com Enter. Ela lista as ações disponíveis no contexto atual, incluindo as que não têm combinação individual. Tooltips e indicações ao lado dos botões refletem os atalhos configurados.

| Atalho padrão | Ação |
| --- | --- |
| `Ctrl+Enter` / `Ctrl+R` | Executar ou cancelar |
| `Ctrl+S` | Salvar todas as abas; em formulário, salvar formulário |
| `Ctrl+Shift+S` | Salvar aba como arquivo PHP |
| `Ctrl+O` | Abrir arquivo PHP |
| `Ctrl+N` / `Ctrl+W` | Nova aba / fechar aba |
| `F2` | Renomear aba |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Próxima aba / anterior |
| `Ctrl+H` / `Ctrl+B` | Histórico / projetos e conexões |
| `Ctrl+,` / `Ctrl+Alt+K` | Preferências / configurar atalhos |
| `Ctrl+Espaço` | Mostrar sugestões de autocomplete |
| `Ctrl+Alt+R` / `Ctrl+Alt+I` | Atualizar autocomplete / diagnóstico |
| `Alt+1` / `Alt+2` | Focar editor / resultado |
| `Ctrl+J` | Ocultar ou mostrar o painel de saída |
| `Ctrl+Shift+Delete` | Limpar o resultado atual |
| `Ctrl+Alt+1`, `2`, `3` | Inspecionar, tabela, JSON |
| `Ctrl+Shift+C` / `Ctrl+Shift+E` | Copiar JSON / exportar CSV |
| `Ctrl+Alt+F` | Filtrar resultado |
| `Alt+←` / `Alt+→` | Página anterior / próxima da tabela |
| `Alt+PageUp` / `Alt+PageDown` | Dump anterior / próximo |

Tab/Shift+Tab percorrem controles; Enter/Espaço acionam botões e seletores. Na árvore, ↑/↓ navegam e ←/→ recolhem/abrem o nó. O divisor entre editor e resultado também aceita ←/→ quando focado. No Monaco, o comportamento padrão de Tab é indentar; **Ctrl+M** alterna a navegação de foco com Tab para sair do editor apenas pelo teclado. Formulários mantêm o foco dentro da janela; a paleta pode ser aberta sobre eles.

O X no painel de saída oculta todo o painel, inclusive quando ainda não há resultado. O código ocupa a largura disponível. O resultado, a visualização, os filtros e a largura anterior são preservados ao reabrir por Ctrl+J ou pelo botão na barra de abas. Executar código e Alt+2 também mostram a saída. O atalho pode ser remapeado em Preferências.

O apoio voluntário está disponível em **Sobre e atualizações → Pague um café**, na paleta e em [Buy Me a Coffee](https://www.buymeacoffee.com/henriquemiranda). Um convite não modal pode aparecer a partir da quinta abertura do app, se houver execução no histórico e o convite de estrela tiver sido respondido em uma sessão anterior. As duas respostas dispensam permanentemente esse convite. O aplicativo abre a página no navegador; não processa pagamentos nem restringe recursos a quem contribui.

## Compilar e desenvolver

Requisitos usados nesta implementação: Go 1.25+, Node 22.12+, PHP local 8.2+, Wails CLI 2.15, GCC, GTK3 e WebKit2GTK 4.0 ou 4.1. A geração de ícones usa Python 3 com os pacotes `python3-gi` e `gir1.2-gdkpixbuf-2.0` da distribuição. PHP no ambiente de execução: 8.1+. Esta entrega foi compilada no Linux x86-64 com Go 1.27.3, Node 22.17, PHP 8.4.1, GTK 3.24.33 e WebKitGTK 2.50.4.

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0
npm --prefix frontend ci
./scripts/build.sh
```

O script detecta `webkit2gtk-4.1` e acrescenta `-tags webkit2_41` quando necessário. Na máquina atual, usa 4.0. Em Ubuntu/Debian, os pacotes de desenvolvimento são `libgtk-3-dev` e `libwebkit2gtk-4.0-dev` ou `libwebkit2gtk-4.1-dev`, conforme a distribuição.

Para desenvolvimento com recarga:

```bash
wails dev
```

O frontend também pode ser testado com o backend Go em loopback, sem o shell desktop:

```bash
npm --prefix frontend run build
go run ./cmd/tinkercraft-devserver
# Abra a URL com token impressa no terminal.
```

Esse harness só aceita IP de loopback, exige token por execução e valida a origem das requisições. Ele não é iniciado nem incluído no fluxo do aplicativo desktop. Seletores nativos de arquivo estão disponíveis apenas no desktop.

## Verificação

```bash
./scripts/check.sh
# Teste adicional com dependências Laravel já instaladas:
TINKERCRAFT_LARAVEL_VENDOR=/caminho/projeto/vendor go test ./internal/execution -run RealLaravel -v
# Interface real com WebKit (requer navegador Playwright e sockets locais):
npm ci
npx playwright-core install webkit
npm run test:ui
# Janela Wails real em display isolado (requer Xvfb, xdotool, Python GI/Xlib):
TINKERCRAFT_NATIVE_TEST=1 xvfb-run -a -s '-screen 0 1440x1000x24' /usr/bin/python3 tests/native.test.py
```

O teste Laravel monta uma aplicação temporária apenas com as dependências abertas do framework. Não carrega `.env`, providers, helpers ou código da aplicação fornecida.

Veja [docs/validation.md](validation.md) para o que foi efetivamente validado nesta sessão e o que continua pendente.

## Limites desta primeira versão

- Cada execução inicia um processo PHP novo; variáveis não persistem entre execuções.
- Um trecho roda com o acesso real do usuário, servidor ou container. Não há sandbox de código, rollback de banco ou proteção contra efeitos do código executado.
- Cancelar termina o transporte/processo local. Em SSH e `docker exec`, isso **não garante** que trabalho remoto já iniciado tenha terminado; timeout do transporte também não desfaz efeitos. O runner ainda aplica `set_time_limit`, cujas regras variam para chamadas bloqueantes.
- A inspeção evita `toArray()`, `jsonSerialize()`, accessors e lazy loading de relações. Eloquent mostra atributos brutos respeitando `hidden`/`visible` e relações já carregadas. Isso pode diferir da serialização JSON da aplicação.
- A saída é limitada a 256 KiB de stdout, 50 dumps, 300 filhos por nó, profundidade 8, 5.000 nós por inspeção e um orçamento global aproximado de 2 MiB para os valores inspecionados. Resultados parciais são indicados e exportações refletem os dados inspecionados, não o conjunto completo na origem.
- Exceções no trecho preservam linhas do código original. Exceções dentro de arquivos do projeto mostram o arquivo real.
- As abas são persistidas com debounce de 350 ms e gravadas antes do fechamento normal; encerramento forçado pode perder alterações recentes. Histórico e perfis ficam em JSON com permissão `0600`. Não salve segredos nos trechos se não quiser mantê-los no histórico.
- Não incluídos: sandbox Laravel embutido, extensão de VS Code, IA, debugger, SQL profiler, sincronização completa de repositórios/edição remota e outros frameworks com bootstrap automático.

## Projeto

- [Instruções e objetivo para agentes](../AGENTS.md)
- [Decisão da stack e arquitetura](architecture.md)
- [Pesquisa funcional e fontes oficiais](research.md)
- [Validação e pendências](validation.md)
- [Pacotes Linux e atualizações](releases.md)
- [Origem das dependências e licenças](../THIRD_PARTY_NOTICES.md)

Código próprio sob MIT. Nomes, marca e interface do TinkerCraft são independentes do Tinkerwell/Beyond Code. Nenhum código ou asset proprietário do Tinkerwell foi usado.
