import Markdown from "react-markdown";

export function ReleaseNotes({ notes }: { notes: string }) {
  return (
    <div className="release-markdown">
      <Markdown
        skipHtml
        allowedElements={[
          "p",
          "h1",
          "h2",
          "h3",
          "h4",
          "ul",
          "ol",
          "li",
          "strong",
          "em",
          "code",
          "pre",
          "blockquote",
          "hr",
          "br",
        ]}
        unwrapDisallowed
      >
        {notes}
      </Markdown>
    </div>
  );
}
