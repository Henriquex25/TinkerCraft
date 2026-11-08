# Conectar um projeto

O perfil de conexão define onde o PHP executa. Ele não cria um projeto novo nem instala as dependências dele.

Abra **Nova conexão** pelos controles de conexão ou pela paleta de comandos. Dê um nome, escolha o modo, preencha os campos, teste e salve.

## Diretório local

Escolha **Local** e selecione a raiz do projeto, por exemplo `/home/seu-usuario/projetos/loja`. As dependências já devem estar instaladas nesse projeto.

## Docker local

Escolha **Docker**, busque os containers em execução e selecione o que tem PHP CLI.

O diretório do projeto é o caminho **dentro do container**, como `/var/www/html`, e não o caminho do checkout no host. Use **Detectar diretório** para procurar no diretório de trabalho, montagens e locais comuns. Confira o resultado antes de salvar.

Seu usuário do desktop precisa conseguir usar o Docker. O TinkerCraft não inicia containers nem configura permissões do Docker.

## SSH

Escolha **SSH** e informe host (ou um alias da configuração SSH), usuário, porta e chave quando necessário. Informe o diretório do projeto naquele servidor, como `/srv/loja`.

Primeiro estabeleça a confiança no host pelo terminal:

```bash
ssh app@servidor.example.com
```

Verifique o fingerprint antes de aceitar uma chave nova. O TinkerCraft usa OpenSSH não interativo e mantém a verificação da chave do host. Não oferece prompts de senha. Se sua chave privada for criptografada, disponibilize-a no agente SSH usado pela sessão gráfica.

## Docker por SSH

Escolha **SSH + Docker**, configure o SSH e selecione o container PHP remoto. O usuário SSH precisa ter acesso ao Docker naquele servidor. O caminho do projeto continua sendo **dentro do container**.

A detecção de diretório também está disponível nesse modo.

## Escolher o bootstrap

Em **Configurações avançadas**:

| Bootstrap             | Comportamento                                                                           |
| --------------------- | --------------------------------------------------------------------------------------- |
| Automático            | Carrega Composer quando disponível; detecta Laravel por `artisan` e `bootstrap/app.php` |
| Laravel               | Inicializa o kernel de console Laravel                                                  |
| Composer              | Carrega `vendor/autoload.php`                                                           |
| PHP puro              | Não carrega o bootstrap da aplicação                                                    |
| Arquivo personalizado | Carrega o arquivo escolhido no ambiente de execução                                     |

**Testar conexão** verifica o runtime e o bootstrap escolhidos. A preparação do autocomplete é separada e pode demorar mais no primeiro acesso. [Veja como funciona o cache](./autocomplete).
