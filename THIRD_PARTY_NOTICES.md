# Dependências de terceiros

O código próprio do TinkerCraft é MIT. Cada dependência mantém sua licença original.

## Monaco Editor

- Projeto: <https://github.com/microsoft/monaco-editor>
- Licença principal: MIT, Microsoft Corporation.
- Bundle preservado em `frontend/public/vendor/monaco/vs`, sem alteração do código do editor.
- Origem local do artefato: distribuição aberta de Monaco em `mongodb.mongodb-vscode` 1.16.0, diretório `dist/monaco-editor/vs`. O manifesto dessa extensão declara `monaco-editor: ^0.55.1`; a versão exata do bundle não foi deduzida do intervalo. Identidade dos arquivos registrada em `docs/vendor-sha256.txt`.
- Só o diretório de distribuição do Monaco foi usado. Código funcional, assets e implementação da extensão MongoDB não foram copiados.
- O worker `vs/assets/editor.worker-Be8ye1pW.js` também é copiado, sem alterações, em `frontend/src/vendor/editor-worker.js`, para importação como texto no build do TinkerCraft.
- MIT em `frontend/public/vendor/monaco/LICENSE.txt`; comentários/arquivos `*.LICENSE.txt` preservados no bundle.
- O bundle inclui DOMPurify 3.2.7 (Cure53 e colaboradores), sob Apache-2.0 ou MPL-2.0; os avisos originais estão em `vs/editor.api-CalNCsUg.js.LICENSE.txt`. Cópia de Apache-2.0 em `frontend/public/vendor/monaco/Apache-2.0.txt`, também aplicável aos componentes TypeScript ali distribuídos.
- Outras gramáticas e avisos de licença permanecem nos arquivos distribuídos, incluindo os arquivos Swift/NLS.
- Notices upstream: <https://github.com/microsoft/monaco-editor/blob/main/ThirdPartyNotices.txt>.

## nikic/php-parser

- Projeto: <https://github.com/nikic/PHP-Parser>
- Licença BSD-3-Clause, Nikita Popov.
- Código preservado em `runtime/vendor/php-parser`.
- Origem: pacote Composer já disponível em cache; árvore `nikic-PHP-Parser-044a6a3`. O nome da árvore identifica o commit abreviado; não foi assumida uma versão a partir dele.
- Licença original completa: `runtime/vendor/php-parser/LICENSE`.

## Bibliotecas gerenciadas pelos manifestos

| Componente | Projeto | Licença |
| --- | --- | --- |
| Wails 2.15.0 | <https://github.com/wailsapp/wails> | MIT |
| React e React DOM 19.2.8 | <https://github.com/facebook/react> | MIT |
| Lucide React 1.42.0 | <https://github.com/lucide-icons/lucide> | ISC; licenças dos ícones preservadas no pacote |
| Vite 7.3.6 | <https://github.com/vitejs/vite> | MIT |
| TypeScript 5.9.3 | <https://github.com/microsoft/TypeScript> | Apache-2.0 |
| Playwright Core 1.58.2, somente testes | <https://github.com/microsoft/playwright> | Apache-2.0 |

Versões transitivas estão em `go.mod`, `go.sum`, `frontend/package-lock.json` e `package-lock.json`. Pacotes do frontend foram copiados de instalações locais abertas disponíveis, preservando seu conteúdo, para permitir a compilação sem rede. A instalação reproduzível é feita com `npm ci` usando os lockfiles.

## Phpactor

<https://github.com/phpactor/phpactor>, MIT. O script de instalação baixa o release oficial 2026.10.07.0. O PHAR em `.tools/phpactor.phar` é ignorado pelo Git e não está incorporado ao binário Go. O pacote `.deb` padrão distribui uma cópia adjacente ao executável, em `/usr/lib/tinkercraft/phpactor.phar`, com sua licença e SHA-256 em `/usr/share/doc/tinkercraft`. O PHAR preserva as dependências e os avisos upstream. No checkout, a instalação é separada; `--without-phpactor` permite omiti-lo do pacote. Nenhum código de um servidor proprietário foi usado como substituto.

## Referência funcional

Tinkerwell e Beyond Code são nomes de seus respectivos titulares. A consulta à documentação pública fundamenta os fluxos, sem copiar código, marca, screenshots, textos de interface ou assets proprietários. O TinkerCraft é uma implementação independente.
