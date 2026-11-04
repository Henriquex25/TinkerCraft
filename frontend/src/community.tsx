import { useRef, useState } from "react";
import { Star, Coffee } from "lucide-react";
import { api, errorText } from "./api";
import { Shortcut, useCommandActions, useCommandHints } from "./commands";
import { t as tr } from "./i18n";

export function CommunityPrompt({
  kind = "star",
  dismissed,
  notify,
}: {
  kind?: "star" | "donation";
  dismissed: () => void;
  notify: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const hints = useCommandHints();
  const donation = kind === "donation";
  const Icon = donation ? Coffee : Star;
  const acceptCommand = donation ? "community.support" : "community.star";
  const dismissCommand = donation
    ? "community.dismissDonation"
    : "community.dismiss";
  async function respond(openRepository: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await (donation ? api.DismissDonationPrompt() : api.DismissStarPrompt());
    } catch (error) {
      setError(errorText(error));
      pending.current = false;
      setBusy(false);
      return;
    }
    dismissed();
    if (openRepository) {
      try {
        await (donation ? api.OpenSupportPage() : api.OpenProjectRepository());
      } catch (error) {
        notify(errorText(error));
      }
    }
  }
  useCommandActions({
    [acceptCommand]: { enabled: !busy, run: () => respond(true) },
    [dismissCommand]: { enabled: !busy, run: () => respond(false) },
  });
  return (
    <aside
      className="repository-prompt"
      data-kind={kind}
      aria-labelledby="repository-prompt-title"
      aria-live="polite"
    >
      <div className="repository-prompt-heading">
        <Icon size={20} aria-hidden="true" />
        <h2 id="repository-prompt-title">
          {tr(donation ? "Support TinkerCraft" : "Enjoying TinkerCraft?")}
        </h2>
      </div>
      <p>
        {tr(
          donation
            ? "If TinkerCraft has been useful, consider buying me a coffee to support its development."
            : "Would you give TinkerCraft a star on GitHub? It helps others discover the project.",
        )}
      </p>
      <small>
        {tr(
          "Either choice dismisses this invitation permanently on this device.",
        )}
      </small>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="repository-prompt-actions">
        <button
          className="secondary-button"
          disabled={busy}
          title={hints.title(dismissCommand)}
          onClick={() => respond(false)}
        >
          {tr("No, thanks")} <Shortcut id={dismissCommand} />
        </button>
        <button
          className="primary-button"
          disabled={busy}
          title={hints.title(acceptCommand)}
          onClick={() => respond(true)}
        >
          <Icon size={15} aria-hidden="true" />
          {tr(donation ? "Buy me a coffee" : "Star on GitHub")}{" "}
          <Shortcut id={acceptCommand} />
        </button>
      </div>
    </aside>
  );
}
