# Instalação e atualizações no Linux

O formato inicial é **Debian `.deb`**, com entrada no menu de aplicativos, ícone e comando `tinkercraft`. O pacote inclui o frontend, o backend e o PHAR do Phpactor. Não depende da pasta do checkout depois de instalado. O PHP local 8.2+ continua sendo uma dependência externa, inclusive para analisar código executado remotamente. Em instalações via Herd ou fora do PATH gráfico, informe o caminho absoluto do PHP em Preferências.

## Instalar o pacote já gerado

Para Pop!_OS/Ubuntu 22.04 x86-64, a variante desta máquina é `webkit40`:

```bash
cd tinkercraft
sudo apt install ./build/dist/tinkercraft_0.2.0_linux_amd64_webkit40.deb
```

Depois, abra **TinkerCraft** pelo menu do Linux ou execute `/usr/bin/tinkercraft`. Feche uma instância antiga antes de abrir a instalada. Instalar uma versão nova do mesmo pacote atualiza os arquivos do aplicativo; feche e reabra para usá-la. O pacote não altera os códigos, perfis ou preferências no workspace. A remoção com `sudo apt remove tinkercraft` também preserva esse workspace.

Os arquivos vão para `/usr/lib/tinkercraft`, com launcher em `/usr/bin`, entrada em `/usr/share/applications` e ícones em `/usr/share/icons/hicolor`. Não há scripts de instalação que executem o app ou escrevam nas pastas pessoais. O gerenciador de pacotes do sistema registra os arquivos e resolve as bibliotecas GTK/WebKit. Docker é apenas sugerido: não é instalado automaticamente como requisito do app.

### Logo e ícones

O arquivo original é `build/appicon.png`, fornecido pelo usuário, em PNG quadrado com transparência. Não é necessário convertê-lo para SVG. O empacotador gera PNGs de 16, 24, 32, 48, 64, 96, 128, 256, 512 e 1024 pixels para o tema `hicolor`, preservando a proporção e a transparência. A entrada desktop usa `Icon=tinkercraft`. O build também gera `build/appicon-small.png` de 128 pixels para a janela Wails e a interface, evitando transferir a imagem original inteira e a omissão de ícones grandes pelo GTK/X11. Para trocar a logo, substitua o original e execute `./scripts/package-linux.sh`; o original não é alterado pelo build. Para preparar apenas a imagem derivada, use `/usr/bin/python3 scripts/prepare-icons.py`. Mantenha a derivada no checkout para permitir compilações Go diretas.

Se já instalou a versão 0.2.0 anterior, aplique este pacote reconstruído com `sudo apt install --reinstall ./build/dist/tinkercraft_0.2.0_linux_amd64_webkit40.deb` e reabra o aplicativo.

## Configurar o repositório do build — apenas para o mantenedor

Quem instala o `.deb` **não precisa criar `.env` nem informar a URL do repositório**. Os pacotes publicados recebem a URL embutida durante a compilação; o workflow GitHub a obtém automaticamente de `github.repository`. O `.env` é apenas uma configuração local de quem gera o pacote e não é incluído nele. A fonte é interna: preferências antigas e variáveis de ambiente em runtime não podem sobrescrever o canal do build.

O `.env` foi criado na raiz e está ignorado pelo Git. Use uma URL pública de repositório, sem `/releases`:

```dotenv
TINKERCRAFT_RELEASE_SOURCE="https://github.com/SEU_USUARIO/SEU_REPOSITORIO"
TINKERCRAFT_MAINTAINER="TinkerCraft <seu-email>"
```

O destino padrão é o repositório oficial `https://github.com/Henriquex25/TinkerCraft`. O mantenedor pode definir outro destino ao compilar um fork. `.env.example` documenta os campos; para outro checkout, copie-o para `.env`. O parser lê esses campos como dados, sem executar comandos ou interpolar o shell. Variáveis exportadas no ambiente têm prioridade. Esse arquivo pertence ao TinkerCraft; ele não é o `.env` Laravel dos projetos.

- `scripts/start.sh` abre o executável já compilado; não redefine a fonte ao iniciar.
- A versão do app vem exclusivamente do arquivo `VERSION`, embutido no desktop durante a compilação. Não há override por `.env`, ambiente ou campo do workflow. A chave antiga `TINKERCRAFT_VERSION` em `.env` é ignorada para compatibilidade.
- A versão **instalada** usa exclusivamente a fonte embutida no build. Alterar o `.env` do checkout não reconfigura um pacote já instalado; alterações do mantenedor exigem recompilação.
- Para desabilitar consultas automáticas, desmarque **Verificar atualizações ao iniciar**. Não há campo de URL nas preferências; valores antigos são ignorados e descartados no próximo salvamento.

Não é necessário token para consultar releases públicos. Se o repositório ainda não tiver um release publicado, a API pode responder 404; o editor e a execução continuam funcionando.

## Fluxo de atualização

1. Dois segundos após abrir, o app consulta o último release estável quando existe fonte configurada e a preferência está habilitada. A consulta não bloqueia o editor; falhas ficam disponíveis na tela de atualizações.
2. Uma versão superior produz o indicador **Atualização X** no rodapé. **Sobre e atualizações**, acessível pela paleta, também permite verificar manualmente.
3. **Baixar atualização** baixa somente o `.deb` da arquitetura e variante WebKit da instalação. O app confere nome, limite de tamanho, SHA-256 e formato Debian antes de disponibilizar o instalador. Não baixa nem instala automaticamente ao iniciar.
4. **Abrir instalador do sistema** envia o arquivo verificado ao aplicativo associado a `.deb` via `xdg-open`. A instalação e a autorização administrativa ficam a cargo do sistema. É necessário ter um instalador gráfico associado a esse formato.
5. Conclua a instalação, feche o TinkerCraft e abra-o pelo menu do Linux. Não há reinicialização automática nem substituição do binário em uso pelo próprio app.

Se não houver instalador gráfico, o pacote verificado fica em `<workspace>/updates/`; pode ser instalado com `sudo apt install /caminho/absoluto/pacote.deb`. O workspace padrão é `~/.config/tinkercraft`, com compatibilidade para `~/.config/lume`. Downloads completos são mantidos para instalação manual; temporários incompletos são removidos.

Todos os novos comandos estão na paleta e aceitam remapeamento. Dentro da janela de atualização: **Ctrl+R** verifica, **Ctrl+D** baixa e **Ctrl+Enter** abre o instalador depois do download. Em Preferências, **Alt+3** abre Atualizações.

As consultas usam HTTPS e timeouts; não enviam trechos, perfis, fontes ou credenciais SSH. A fonte recebe os dados normais de uma requisição HTTP, incluindo IP e versão do TinkerCraft no User-Agent. SHA-256 verifica integridade em relação ao release configurado; não é uma assinatura independente do publicador. O mantenedor do build é responsável pela fonte embutida.

## Gerar um pacote

```bash
# Dependências de desenvolvimento da distribuição, além de Go/Node/PHP/Wails:
sudo apt install dpkg-dev desktop-file-utils python3-gi gir1.2-gdkpixbuf-2.0 librsvg2-common
./scripts/install-phpactor.sh
./scripts/package-linux.sh
```

O script compila e gera o `.deb`, `checksums.txt` e `release-metadata.json` em `build/dist/`. Quando a fonte GitHub existe no build, também gera `manifest.json`. O empacotador aceita `--skip-build` somente com um binário compilado para distribuição `deb`, e `--without-phpactor` para um pacote que exige configurar o servidor separadamente. Não instala o pacote no sistema durante a geração.

`./scripts/build.sh` permanece disponível para gerar apenas o executável. `build/bin/tinkercraft --version-json` informa versão, distribuição, arquitetura, ABI WebKit e commit. A versão publicável tem formato `MAJOR.MINOR.PATCH`, sem prefixo `v`; a tag GitHub usa `vMAJOR.MINOR.PATCH`.

| Variante | Build | Destino inicial |
| --- | --- | --- |
| `linux-amd64-webkit40` | `TINKERCRAFT_WEBKIT=4.0` | Pop!_OS/Ubuntu 22.04 x86-64 |
| `linux-amd64-webkit41` | `TINKERCRAFT_WEBKIT=4.1` | Ubuntu 24.04 x86-64 |

Sem seleção explícita, o build prefere os headers WebKit 4.1 se disponíveis, senão usa 4.0. As dependências nativas reais são obtidas por `dpkg-shlibdeps`. Uma variante não é binariamente intercambiável com a outra; o updater mantém a variante da instalação. A escolha da distribuição-base do build também define o mínimo de glibc. Apenas a variante 4.0 foi gerada e executada nesta máquina. ARM64, AppImage, Flatpak, RPM, macOS e Windows não foram validados nem incluídos na automação inicial.

## GitHub Releases

O repositório público é `https://github.com/Henriquex25/TinkerCraft`. O [guia do mantenedor](github-maintainer.md) explica o primeiro setup do GitHub, PRs e publicação passo a passo. A versão 0.2.0 já foi publicada; as instruções abaixo descrevem o fluxo para versões seguintes.

1. Preencha o `.env` para builds locais e envie o código ao repositório. O `.env`, arquivos de workspace, cache, ferramentas e pacotes gerados permanecem fora do Git.
2. Altere somente `VERSION` para a nova versão, faça commit/push e, se aplicável, merge em `main`. Aguarde o CI de push desse mesmo commit passar, inclusive quando só a versão mudou. Em **Actions**, execute **Build Linux release draft** na branch **main**; não há campo de versão para preencher.
3. A automação verifica branch, formato de `VERSION` e CI aprovado no SHA exato, compila em Ubuntu 22.04/24.04, testa Go/TypeScript/renderização, reúne os dois `.deb`, verifica hashes e cria um **release em rascunho** com `checksums.txt` e `manifest.json`. A URL do próprio repositório é embutida automaticamente; não precisa cadastrar segredo de URL.
4. Revise as notas e os pacotes; publique o rascunho pelo GitHub. Só releases estáveis publicados entram na consulta `releases/latest`. Rascunhos e pré-releases ficam fora desse canal.

O workflow está em `.github/workflows/release.yml`; usa o token temporário do GitHub, com permissão de escrita apenas no job que cria o rascunho. Ainda não foi executado na nuvem nesta revisão. O repositório público `Henriquex25/TinkerCraft` já possui a primeira release. Esta revisão do fluxo ainda precisa ser enviada e validada na nuvem. Ele não publica automaticamente.

Para versões seguintes, altere apenas `VERSION`. Os pacotes npm privados não declaram a versão do aplicativo; o código Go e a interface recebem o valor do arquivo central. O guia do mantenedor traz os comandos. Não use `[skip ci]` ou `[skip actions]` no commit de versão: o workflow continua exigindo CI aprovado para o commit exato, sem reaproveitar resultados de commits anteriores. Não reutilize um número já publicado para pacotes com código diferente; gere uma versão superior. O agregador rejeita artefatos com versões divergentes, variantes duplicadas ou hash/tamanho incorretos. Um release sem pacote compatível ainda pode ser anunciado, mas o botão de download não é habilitado.

O backend também aceita um manifesto HTTPS no formato gerado, caso a hospedagem mude no futuro. O caminho padrão desta implementação é GitHub Releases público, usando o digest SHA-256 da API ou o arquivo `checksums.txt` do release.

## Referências oficiais

- [Compatibilidade Linux do Wails](https://v2.wails.io/docs/v2.15.0/guides/linux-distro-support/).
- [Dependências de instalação e WebKit do Wails](https://v2.wails.io/docs/gettingstarted/installation/).
- [API de releases do GitHub](https://docs.github.com/en/rest/releases/releases).
- [Especificação de entradas desktop do freedesktop.org](https://specifications.freedesktop.org/desktop-entry/latest-single/).
