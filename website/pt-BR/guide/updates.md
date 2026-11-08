# Atualizar o TinkerCraft

Por padrão, o TinkerCraft consulta o repositório oficial no GitHub após iniciar, procurando um release estável publicado. Uma atualização disponível aparece em um convite e no rodapé.

## Uma ação de atualização

1. Escolha **Atualizar**.
2. Autorize a instalação na janela do Linux, quando solicitado.
3. Aguarde o TinkerCraft instalar, salvar suas abas e reabrir.

O app baixa apenas o pacote da arquitetura/variante WebKit compatível e verifica o SHA-256 publicado. Confirma a instalação antes do reinício. Se a versão já estiver instalada no disco, o mesmo botão reinicia diretamente, sem reinstalar.

**Lembrar mais tarde** dispensa o convite por enquanto; o indicador continua no rodapé. Abrir o app não baixa nem instala uma atualização automaticamente.

## Consulta manual

Abra **Sobre e atualizações** pela paleta e escolha **Verificar agora**. Nas Preferências estão a opção de consulta ao iniciar e **Salvar e verificar agora**.

Não é necessário criar `.env`, informar URL de repositório ou ter token do GitHub. A fonte de atualização do publicador vem incluída no pacote.

## Se a atualização não terminar

- Cancelar a autorização ou falhar na instalação mantém o aplicativo atual aberto.
- Se instalou, mas não reabriu, feche e abra o TinkerCraft normalmente para usar a versão nova.
- A instalação integrada exige o app oficial instalado pelo `.deb`, APT, pkexec e o agente gráfico de autenticação da sessão.
- Builds pelo código-fonte ou extraídos não alteram a instalação do sistema. Instale um `.deb` publicado pelo gerenciador de pacotes.

Versões antigas ainda podem oferecer **Abrir instalador do sistema**. Conclua esse fluxo antigo uma vez para receber a implementação com a ação única de atualizar.

O canal usa releases estáveis; rascunhos e pré-releases do GitHub não são oferecidos. O workspace é preservado nas atualizações do pacote.
