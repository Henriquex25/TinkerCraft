# Instalar e começar

O TinkerCraft é um aplicativo desktop para Linux que permite escrever trechos PHP e executá-los no contexto do seu projeto. É um projeto open source independente, inspirado no Tinkerwell.

## Antes da instalação

Você precisa de **PHP CLI local 8.2+**, mesmo quando o projeto está em um servidor remoto. Ele analisa os trechos e fornece suporte de linguagem. O ambiente onde o código executa também precisa de um PHP CLI compatível e das dependências do projeto.

Docker e OpenSSH só são necessários nas conexões que os utilizam.

## Baixar o instalador

Abra [GitHub Releases](https://github.com/Henriquex25/TinkerCraft/releases/latest) e baixe o `.deb` adequado ao seu Linux:

| Sistema                        | Final do nome do pacote    |
| ------------------------------ | -------------------------- |
| Ubuntu / Pop!_OS 22.04, x86-64 | `linux_amd64_webkit40.deb` |
| Ubuntu 24.04, x86-64           | `linux_amd64_webkit41.deb` |

Esses são os alvos atuais de compilação. Outras distribuições e arquiteturas não foram validadas para este guia. Os arquivos automáticos **Source code** não são instaladores.

Dê dois cliques no `.deb`, escolha **Instalar** no instalador de pacotes do sistema e autorize. Ele resolve as bibliotecas declaradas pelo pacote. Depois, abra **TinkerCraft** no menu de aplicativos.

::: tip Sem ferramentas de compilação
Não é necessário instalar Go, Node.js, npm, Wails, headers de desenvolvimento ou criar `.env` para usar o pacote publicado. Phpactor e a fonte de atualização já estão incluídos. Instruções de compilação são para contribuidores.
:::

Se seu desktop não tiver um instalador gráfico, abra um terminal no diretório do download e execute `sudo apt install ./arquivo.deb`, substituindo `arquivo.deb` pelo nome real do pacote.

## Primeiro trecho

Configure o [PHP local](./local-php), selecione a conexão inicial **PHP Playground** e execute:

```php
['message' => 'Olá do TinkerCraft', 'total' => 6 * 7];
```

Pressione **Ctrl+Enter**. A última expressão vira o valor de retorno; as tags de abertura e fechamento do PHP são opcionais.

Depois, [conecte seu próprio projeto](./connections). Os trechos usam o acesso e a configuração real de banco desse projeto; execute apenas o código que deseja rodar.
