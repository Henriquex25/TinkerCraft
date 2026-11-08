# Preferências e formatação

Abra Preferências com **Ctrl+,** ou pela paleta. Salve o formulário com **Ctrl+S**.

## Geral

- **Idioma:** inglês ou português do Brasil. A troca salva os rascunhos e recarrega a interface. Código, nomes de conexão e resultados não são traduzidos.
- **Executável PHP local:** PHP CLI usado na análise local. Veja a [configuração do PHP](./local-php).
- **Cache do autocomplete:** remove projetos inativos após 1–90 dias; o padrão é sete.

A fonte de atualização e o caminho do Phpactor incluído no pacote são gerenciados internamente. Não são campos de configuração do usuário.

## Atalhos de teclado

A seção **Atalhos de teclado** permite substituir ou remover combinações e restaurar os padrões. Verifica conflitos por contexto e protege combinações essenciais de edição. Indicadores e tooltips acompanham as mudanças.

## Atualizações

Ative ou desative **Verificar atualizações ao iniciar**. Use **Salvar e verificar agora** para solicitar uma consulta. Veja [atualizações](./updates) para o funcionamento da instalação.

## Formatação

Pressione **Alt+Shift+F**, use o botão do editor ou encontre **Formatar código PHP** na paleta. A formatação é explícita, local, permite desfazer e nunca executa seu trecho.

O padrão usa quatro espaços, largura de 80 caracteres, aspas simples, vírgulas finais e estilo PER-CS para chaves. Isso não significa compatibilidade completa com as regras do Laravel Pint.

Ajuste as opções ou importe um arquivo JSON puro de até 64 KiB:

```json
{
  "tabWidth": 4,
  "printWidth": 100,
  "useTabs": false,
  "singleQuote": true,
  "trailingCommaPHP": true,
  "braceStyle": "per-cs"
}
```

A indentação aceita 1–8 e a largura 40–240. O estilo de chaves aceita `per-cs` ou `1tbs`. As chaves importadas precisam ser opções escalares suportadas. Configuração PHP/JavaScript, plugins personalizados e carregamento automático das regras do projeto não são suportados.

PHP inválido é mantido sem alterações. O formatador também evita substituir um trecho que você editar enquanto a formatação está em andamento.
