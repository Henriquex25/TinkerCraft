import { defineConfig } from "vitepress";

const base = "/TinkerCraft/";
const repository = "https://github.com/Henriquex25/TinkerCraft";
const pages = [
  ["getting-started", "Installation", "Instalação"],
  ["local-php", "Configure local PHP", "Configurar o PHP local"],
  ["connections", "Connect a project", "Conectar um projeto"],
  ["running-code", "Run PHP and Laravel", "Executar PHP e Laravel"],
  [
    "output",
    "Explore output and export CSV",
    "Explorar a saída e exportar CSV",
  ],
  ["saving", "Save and restore snippets", "Salvar e restaurar trechos"],
  ["autocomplete", "Autocomplete and cache", "Autocomplete e cache"],
  ["preferences", "Preferences and formatting", "Preferências e formatação"],
  ["keyboard-shortcuts", "Keyboard shortcuts", "Atalhos de teclado"],
  ["updates", "Update TinkerCraft", "Atualizar o TinkerCraft"],
  ["troubleshooting", "Troubleshooting", "Solução de problemas"],
];
const sidebar = (prefix: string, language: number) => [
  {
    text: language === 1 ? "User guide" : "Guia de uso",
    items: pages.map(([slug, english, portuguese]) => ({
      text: language === 1 ? english : portuguese,
      link: `${prefix}/guide/${slug}`,
    })),
  },
];

export default defineConfig({
  title: "TinkerCraft",
  description:
    "Write PHP, run it in your Laravel project, and explore the result. A focused Linux desktop workspace.",
  base,
  srcExclude: ["README.md"],
  cleanUrls: true,
  lastUpdated: true,
  appearance: "dark",
  head: [
    ["link", { rel: "icon", type: "image/png", href: `${base}favicon.png` }],
    ["meta", { name: "theme-color", content: "#191919" }],
  ],
  sitemap: { hostname: `https://henriquex25.github.io${base}` },
  markdown: { theme: { light: "github-light", dark: "github-dark" } },
  themeConfig: {
    logo: { src: "/favicon.png", alt: "TinkerCraft" },
    socialLinks: [{ icon: "github", link: repository }],
    search: {
      provider: "local",
      options: {
        locales: {
          "pt-BR": {
            translations: {
              button: {
                buttonText: "Buscar",
                buttonAriaLabel: "Buscar na documentação",
              },
              modal: {
                noResultsText: "Nenhum resultado para",
                resetButtonTitle: "Limpar busca",
                footer: {
                  selectText: "selecionar",
                  navigateText: "navegar",
                  closeText: "fechar",
                },
              },
            },
          },
        },
      },
    },
  },
  locales: {
    root: {
      label: "English",
      lang: "en",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/guide/getting-started" },
          { text: "Download", link: `${repository}/releases/latest` },
        ],
        sidebar: sidebar("", 1),
        editLink: {
          pattern: `${repository}/edit/main/website/:path`,
          text: "Edit this page on GitHub",
        },
        docFooter: { prev: "Previous page", next: "Next page" },
        footer: {
          message: `Open source under the <a href="${base}license.txt">MIT license</a>. <a href="${base}third-party-notices.txt">Third-party notices</a>.`,
          copyright: "TinkerCraft · An independent PHP and Laravel workspace.",
        },
      },
    },
    "pt-BR": {
      label: "Português (Brasil)",
      lang: "pt-BR",
      link: "/pt-BR/",
      title: "TinkerCraft",
      description:
        "Escreva PHP, execute no seu projeto Laravel e explore o resultado. Um workspace desktop para Linux.",
      themeConfig: {
        nav: [
          { text: "Guia", link: "/pt-BR/guide/getting-started" },
          { text: "Download", link: `${repository}/releases/latest` },
        ],
        sidebar: sidebar("/pt-BR", 2),
        editLink: {
          pattern: `${repository}/edit/main/website/:path`,
          text: "Editar esta página no GitHub",
        },
        docFooter: { prev: "Página anterior", next: "Próxima página" },
        outline: { label: "Nesta página" },
        lastUpdated: { text: "Atualizado em" },
        sidebarMenuLabel: "Menu",
        returnToTopLabel: "Voltar ao topo",
        darkModeSwitchLabel: "Aparência",
        lightModeSwitchTitle: "Usar tema claro",
        darkModeSwitchTitle: "Usar tema escuro",
        langMenuLabel: "Trocar idioma",
        skipToContentLabel: "Pular para o conteúdo",
        notFound: {
          title: "PÁGINA NÃO ENCONTRADA",
          quote:
            "Este endereço não está no guia. Continue pela página inicial.",
          linkLabel: "Voltar para a página inicial",
          linkText: "Página inicial",
        },
        footer: {
          message: `Código aberto sob a <a href="${base}license.txt">licença MIT</a>. <a href="${base}third-party-notices.txt">Licenças de terceiros</a>.`,
          copyright:
            "TinkerCraft · Um workspace independente para PHP e Laravel.",
        },
      },
    },
  },
});
